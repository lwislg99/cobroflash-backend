// tests/scrum1719-baja-repetida-silencio.test.mjs — SCRUM-1719 (① de SCRUM-1513; regla 28, J3)
//
// UN CLIENTE QUE YA ESTÁ DE BAJA Y ESCRIBE «BAJA» OTRA VEZ → SILENCIO.
//
// El defecto, medido en SCRUM-1509 c.18923 (y en `docs/master/evidencias/SCRUM-1509d/avisos.cjs`,
// casos R3/R4): `handleOptOutRequest` avisaba al profesional y le contestaba al cliente en CADA
// «BAJA», sin mirar si ya tenía `waOptOut`. 120 BAJA = 120 avisos y 120 textos de vuelta.
//
// GO de Javier en SCRUM-1719 c.21766: con `waOptOut` ya puesto, ni aviso al profesional ni texto
// al cliente. La PRIMERA BAJA queda exactamente igual. Sin texto nuevo y sin envío nuevo.
//
// Se ejecuta la RUTA de `dist/` montada en un express y pedida por HTTP, con su firma. Se doblan la
// base (en memoria, con estado) y el transporte de axios (no sale un byte; se cuenta cada petición
// por tipo y destinatario). Los números son del rango imposible.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin la lectura previa de la baja, todos cuentan como «primera BAJA»: vuelven los 120 avisos.
    fichero: 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts',
    de: 'const nuevos = customers.filter((c) => !c.waOptOut);',
    a: 'const nuevos = customers;',
    cae: 'cliente YA de baja escribe BAJA 120 veces',
  },
  {
    // Sin la salida en silencio, el aviso desaparece (no hay negocio nuevo) pero el texto de vuelta no.
    fichero: 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts',
    de: '  if (!nuevos.length) return;\n',
    a: '',
    cae: 'cliente YA de baja escribe BAJA 120 veces',
  },
];

for (const k of ['WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP', 'BOT_INBOUND_ENABLED']) delete process.env[k];
// ANTES de cargar `dist/`: `config` se congela al importarse. En dry-run los senders pasan TODOS sus
// guards y sólo se saltan la llamada HTTP; cada envío queda en `globalThis.__waDryRunOutbox`.
process.env.WHATSAPP_DRY_RUN = '1';
globalThis.__waDryRunOutbox = [];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
const requiere = createRequire(path.join(DIST, 'integrations/whatsapp.js'));

const MERCHANT_A = 7191;
const MERCHANT_B = 7192;
const SECRETO = 'laboratorio-1719';

// ── EL DOBLE DE LA BASE (con estado) ──────────────────────────────────────────────────────────
let t = {};
const NOMBRES = ['customer', 'merchant', 'quote', 'whatsAppMessage', 'botSession', 'charge', 'event'];
function casaValor(x, v) {
  if (v === null) return x == null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    for (const [op, val] of Object.entries(v)) {
      if (op === 'gte') { if (!(x >= val)) return false; }
      else if (op === 'gt') { if (!(x > val)) return false; }
      else if (op === 'lte') { if (!(x <= val)) return false; }
      else if (op === 'lt') { if (!(x < val)) return false; }
      else if (op === 'in') { if (!val.includes(x)) return false; }
      else if (op === 'not') { if (val === null) { if (x == null) return false; } else if (x === val) return false; }
      else throw new Error('BANCO: operador no modelado en el where: ' + op);
    }
    return true;
  }
  return x === v;
}
function casa(fila, where) {
  for (const [k, v] of Object.entries(where || {})) {
    if (v === undefined) continue;
    if (k === 'OR') { if (!v.some((w) => casa(fila, w))) return false; continue; }
    if (k === 'AND') { if (![].concat(v).every((w) => casa(fila, w))) return false; continue; }
    if (!casaValor(fila[k], v)) return false;
  }
  return true;
}
const elegir = (fila, select) => {
  if (!select) return { ...fila };
  const o = {}; for (const k of Object.keys(select)) if (select[k]) o[k] = fila[k]; return o;
};
const tabla = (n) => ({
  findMany: async ({ where, take, select } = {}) => t[n].filter((f) => casa(f, where)).slice(0, take || undefined).map((f) => elegir(f, select)),
  findFirst: async ({ where, select } = {}) => { const v = t[n].filter((f) => casa(f, where)); return v.length ? elegir(v[v.length - 1], select) : null; },
  findUnique: async ({ where, select }) => { const f = t[n].find((x) => casa(x, where)); return f ? elegir(f, select) : null; },
  count: async ({ where } = {}) => t[n].filter((f) => casa(f, where)).length,
  create: async ({ data }) => { const f = { id: t[n].length + 1, createdAt: new Date(), ...data }; t[n].push(f); return f; },
  createMany: async ({ data }) => { for (const d of [].concat(data)) t[n].push({ id: t[n].length + 1, createdAt: new Date(), ...d }); return { count: [].concat(data).length }; },
  update: async ({ where, data }) => { const f = t[n].find((x) => casa(x, where)); if (!f) { const e = new Error('no casa'); e.code = 'P2025'; throw e; } Object.assign(f, data); return f; },
  updateMany: async ({ where, data }) => { const v = t[n].filter((x) => casa(x, where)); v.forEach((f) => Object.assign(f, data)); return { count: v.length }; },
  upsert: async () => ({ id: 1 }),
});
const modelos = {};
for (const n of NOMBRES) modelos[n] = tabla(n);
const neutro = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }), upsert: async () => ({ id: 1 }) };
globalThis.prisma = new Proxy({}, { get: (_, m) => {
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => {
    if (modelos[m] && modelos[m][met]) return modelos[m][met];
    if (typeof met !== 'string' || !neutro[met]) return undefined;
    return neutro[met];
  } });
} });

// ── LO QUE SALDRÍA HACIA META, contado en el buzón dry-run ─────────────────────────────────────
const buzon = () => globalThis.__waDryRunOutbox;
let aMeta = [];
let avisos = 0;
const trazas = [];
const axios = requiere('axios');
let serie = 0;
axios.defaults.adapter = async (cfg) => {
  let cuerpo = {};
  try { cuerpo = JSON.parse(cfg.data); } catch { /* vacío */ }
  const tipo = String(cuerpo.type || (cuerpo.status ? 'leido' : 'ilegible'));
  aMeta.push({ tipo, to: String(cuerpo.to || '') }); // red de seguridad: no debe salir nada por aquí
  return { data: { messages: [{ id: 'wamid.salida-1719.' + (++serie) }] }, status: 200, statusText: '200', headers: {}, config: cfg, request: {} };
};

const { config } = requiere(path.join(DIST, 'core/config/env.js'));
config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1719';
config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1719';
config.WHATSAPP_APP_SECRET = SECRETO;
const { normalizePhone } = requiere(path.join(DIST, 'core/utils/utils.js'));
const PROF_A = normalizePhone(telefonoDePrueba(17190901));
const PROF_B = normalizePhone(telefonoDePrueba(17190902));
// Un número de cliente NUEVO por caso: el límite de entrantes por número y hora (SCRUM-1509,
// `limiteDeEntrantes`) vive en memoria del módulo y pasaría de un caso al siguiente.
let serieCliente = 17190150;
let CLI = null;
const DESCONOCIDO = normalizePhone(telefonoDePrueba(17190777));

const limite = requiere(path.join(DIST, 'modules/whatsappBot/domain/limiteDeEntrantes.js'));
const notif = requiere(path.join(DIST, 'integrations/whatsappNotifications.js'));
const avisoOriginal = notif.notifyMerchantAlert;
notif.notifyMerchantAlert = async (p) => { avisos += 1; return avisoOriginal(p); };

const express = requiere('express');
const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use('/webhooks/whatsapp', requiere(path.join(DIST, 'modules/whatsappBot/app/routes/whatsappIncoming.routes.js')).default);

const consolaOriginal = { log: console.log, error: console.error, warn: console.warn };
let servidor; let puerto;
test.before(async () => {
  console.log = () => {};
  console.error = (...a) => trazas.push(a.map(String).join(' '));
  console.warn = (...a) => trazas.push(a.map(String).join(' '));
  servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidor.address().port;
});
test.after(async () => {
  Object.assign(console, consolaOriginal);
  await new Promise((r) => servidor.close(r));
});

function escenario({ clientes }) {
  t = {}; for (const n of NOMBRES) t[n] = [];
  CLI = normalizePhone(telefonoDePrueba(++serieCliente));
  aMeta = []; buzon().length = 0; avisos = 0; trazas.length = 0;
  t.merchant.push({ id: MERCHANT_A, name: 'Taller A', whatsappPhone: PROF_A, flags: null, country: 'ES' });
  t.merchant.push({ id: MERCHANT_B, name: 'Taller B', whatsappPhone: PROF_B, flags: null, country: 'ES' });
  clientes.forEach((c, i) => t.customer.push({ id: 50 + i, name: 'Cliente ' + i, phone: CLI, mobile: null, ...c }));
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let serieEntrada = 0;
function pedir(cuerpo, firma) {
  return new Promise((resolve, reject) => {
    const datos = Buffer.from(cuerpo);
    const req = http.request({ host: '127.0.0.1', port: puerto, path: '/webhooks/whatsapp', method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', 'content-length': datos.length, 'x-hub-signature-256': firma } }, (res) => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.end(datos);
  });
}
async function entrante(body, from) {
  from = from || CLI;
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: [{ from, id: 'wamid.entrada-1719.' + (++serieEntrada), type: 'text', text: { body } }] } }] }] });
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex');
  const st = await pedir(cuerpo, firma);
  assert.equal(st, 200, 'el webhook no aceptó la entrega');
  await dormir(15); // el webhook contesta y sigue trabajando por detrás
}
function resumen() {
  const errores = trazas.filter((l) => /handler error|Parse error|error/i.test(l) && !/tope diario/.test(l));
  return {
    avisos,
    alProfesional: buzon().filter((p) => p.to === PROF_A || p.to === PROF_B).length,
    textosAlCliente: buzon().filter((p) => p.to === CLI).length,
    alDesconocido: buzon().filter((p) => p.to === DESCONOCIDO).length,
    fugaAMeta: aMeta.filter((p) => p.tipo !== 'leido').length,
    errores: errores.length,
    primerError: errores[0] || null,
  };
}

test('SCRUM-1719 · cliente YA de baja escribe BAJA 120 veces → 0 avisos y 0 textos', async () => {
  escenario({ clientes: [{ merchantId: MERCHANT_A, waOptOut: true }] });
  const descartesAntes = limite.descartesDeEntrantes();
  for (let i = 0; i < 120; i += 1) await entrante('BAJA');
  const r = resumen();
  // POBLACIÓN: de las 120, el límite por número y hora deja llegar ENTRANTES_POR_HORA al manejador.
  assert.equal(limite.descartesDeEntrantes() - descartesAntes, 120 - limite.ENTRANTES_POR_HORA, 'cuántas BAJA llegaron al manejador');
  assert.equal(r.errores, 0, 'el manejador reventó: el caso no vale (' + r.primerError + ')');
  assert.equal(r.fugaAMeta, 0, 'un envío salió por HTTP: el dry-run no estaba puesto');
  assert.equal(r.avisos, 0, 'avisos al profesional');
  assert.equal(r.alProfesional, 0, 'peticiones a Meta hacia el profesional');
  assert.equal(r.textosAlCliente, 0, 'textos de vuelta al cliente');
  assert.equal(t.customer[0].waOptOut, true, 'la baja tiene que seguir puesta');
});

test('SCRUM-1719 · POSITIVO: la primera BAJA avisa y contesta como hoy; las siguientes, silencio', async () => {
  escenario({ clientes: [{ merchantId: MERCHANT_A, waOptOut: false }] });
  await entrante('BAJA');
  let r = resumen();
  assert.equal(r.errores, 0, 'el manejador reventó: el caso no vale (' + r.primerError + ')');
  assert.equal(r.fugaAMeta, 0, 'un envío salió por HTTP: el dry-run no estaba puesto');
  assert.equal(r.avisos, 1, 'la primera BAJA avisa al profesional');
  assert.ok(r.alProfesional >= 1, 'el aviso llega a Meta hacia el profesional');
  assert.equal(r.textosAlCliente, 1, 'la primera BAJA le contesta al cliente');
  assert.match(buzon().find((p) => p.to === CLI).text, /No te enviaremos más mensajes por WhatsApp/, 'el texto de la primera BAJA es el de siempre');
  assert.equal(t.customer[0].waOptOut, true, 'la primera BAJA guarda la baja');
  for (let i = 0; i < limite.ENTRANTES_POR_HORA - 1; i += 1) await entrante('BAJA'); // todas admitidas por el límite
  r = resumen();
  assert.equal(r.errores, 0, 'el manejador reventó: el caso no vale (' + r.primerError + ')');
  assert.equal(r.fugaAMeta, 0, 'un envío salió por HTTP: el dry-run no estaba puesto');
  assert.equal(r.avisos, 1, 'tras la primera, ni un aviso más');
  assert.equal(r.textosAlCliente, 1, 'tras la primera, ni un texto más');
});

test('SCRUM-1719 · dos negocios: sólo avisa al que aún no tenía la baja, y al cliente se le contesta una vez', async () => {
  escenario({ clientes: [{ merchantId: MERCHANT_A, waOptOut: true }, { merchantId: MERCHANT_B, waOptOut: false }] });
  await entrante('BAJA');
  const r = resumen();
  assert.equal(r.errores, 0, 'el manejador reventó: el caso no vale (' + r.primerError + ')');
  assert.equal(r.fugaAMeta, 0, 'un envío salió por HTTP: el dry-run no estaba puesto');
  assert.equal(r.avisos, 1, 'un aviso: el del negocio B');
  assert.equal(buzon().filter((p) => p.to === PROF_A).length, 0, 'el negocio A ya sabía la baja: nada hacia él');
  assert.ok(buzon().filter((p) => p.to === PROF_B).length >= 1, 'el negocio B recibe su aviso');
  assert.equal(r.textosAlCliente, 1, 'es la primera BAJA para B: se contesta como hoy');
  assert.ok(t.customer.every((c) => c.waOptOut === true), 'la baja queda puesta en los dos');
});

test('SCRUM-1719 · CONTROL: un número que no es cliente de nadie sigue recibiendo la respuesta de siempre', async () => {
  escenario({ clientes: [{ merchantId: MERCHANT_A, waOptOut: false }] });
  await entrante('BAJA', DESCONOCIDO);
  const r = resumen();
  assert.equal(r.errores, 0, 'el manejador reventó: el caso no vale (' + r.primerError + ')');
  assert.equal(r.fugaAMeta, 0, 'un envío salió por HTTP: el dry-run no estaba puesto');
  assert.equal(r.avisos, 0);
  assert.equal(r.alDesconocido, 1, 'al desconocido se le contesta como hoy');
  assert.equal(t.customer[0].waOptOut, false, 'la baja de un desconocido no toca a nadie');
});

test('SCRUM-1719 · CONTROL: un cliente sin baja que escribe otra cosa, sin cambios (no pasa por la baja)', async () => {
  escenario({ clientes: [{ merchantId: MERCHANT_A, waOptOut: false }] });
  await entrante('hola, una duda');
  const r = resumen();
  assert.equal(r.errores, 0, 'el manejador reventó: el caso no vale (' + r.primerError + ')');
  assert.equal(r.fugaAMeta, 0, 'un envío salió por HTTP: el dry-run no estaba puesto');
  assert.equal(r.avisos, 0, 'sin albarán reciente no hay aviso (como K2 de SCRUM-1509d)');
  assert.equal(r.textosAlCliente, 1, 'la respuesta de siempre (K2 de SCRUM-1509d: 1 texto)');
  assert.equal(t.customer[0].waOptOut, false, 'escribir otra cosa no da de baja');
});
