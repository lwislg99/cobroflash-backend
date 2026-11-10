// tests/scrum1509h-veinte-entrantes-por-hora.test.mjs — SCRUM-1509h (regla 28, J2)
//
// EL LÍMITE DE MENSAJES ENTRANTES, por la RUTA REAL.
//
// Decisión del fundador (SCRUM-1509 c.20141, «ok vamos con tu recomendación»): 20 mensajes por
// número de teléfono y hora · el exceso se descarta sin contestar al cliente y sin avisar al
// profesional · cada descarte se cuenta.
//
// El defecto, medido en SCRUM-1509f (c.18923): delante de `POST /webhooks/whatsapp` no había
// ningún límite, y un cliente con albarán reciente que escribe 120 textos producía 120 avisos al
// profesional (100 plantillas y 20 bloqueadas por el tope de comercio). Este fichero lo repite
// pidiéndole a la APP ENTERA de `dist/app.js` por HTTP, con la firma de Meta: no se saca el
// manejador de su ruta (SCRUM-1344).
//
// LO QUE SE DOBLA: la base (una en memoria con estado, la técnica de
// `docs/master/evidencias/SCRUM-1509f/limite.cjs`); a Meta no se llama (dry-run). No sale un byte
// hacia Meta ni se toca ninguna base. Los teléfonos son del rango imposible.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const requiere = createRequire(import.meta.url);

// Qué pieza trabaja: cada una de estas, aplicada al fuente y compilada, pone en ROJO el caso que
// nombra `cae` (contrato de `scripts/meta-guard-mutaciones.mjs`, SCRUM-745). Las aplica también
// `docs/master/evidencias/SCRUM-1509h/mutar.mjs`, que las lee de aquí y no lleva lista propia.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La ruta deja de preguntar: vuelven los 120 avisos de 1509f.
    fichero: 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts',
    de: 'if (!admitirEntrante(from)) {',
    a: 'if (false) {',
    cae: 'EL ROJO DE 1509f',
  },
  {
    // El límite admite uno más: el 21.º pasa.
    fichero: 'src/modules/whatsappBot/domain/limiteDeEntrantes.ts',
    de: 'dentro.length < ENTRANTES_POR_HORA',
    a: 'dentro.length <= ENTRANTES_POR_HORA',
    cae: 'EL BORDE',
  },
  {
    // La hora no caduca nunca: un número que llegó a 20 queda fuera para siempre.
    fichero: 'src/modules/whatsappBot/domain/limiteDeEntrantes.ts',
    de: '.filter((t) => t > desde)',
    a: '.filter(() => true)',
    cae: 'LA HORA ES DESLIZANTE',
  },
  {
    // Se descarta pero no se cuenta.
    fichero: 'src/modules/whatsappBot/domain/limiteDeEntrantes.ts',
    de: 'else descartes += 1;',
    a: '',
    cae: 'EL ROJO DE 1509f',
  },
];

// ANTES de cargar `dist/`: `config` se congela al importarse.
for (const k of ['WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP', 'BOT_INBOUND_ENABLED']) delete process.env[k];
process.env.WHATSAPP_DRY_RUN = '1';

// El número FIRMADO (c.20141). Los bordes salen de la constante del módulo; este literal sólo
// sirve para comprobar que la constante es la firmada, y para que el rojo contra un `dist` sin
// el límite enseñe lo que pasa en la ruta en vez de morir al importar.
const FIRMADO = 20;
let limite = null;
try { limite = requiere('../dist/modules/whatsappBot/domain/limiteDeEntrantes.js'); } catch { /* el rojo: no existe */ }
const N = limite?.ENTRANTES_POR_HORA ?? FIRMADO;
const VENTANA = 60 * 60 * 1000; // «y hora», también firmado; el módulo no lo exporta (nadie en src/ lo lee)
const descartes = () => (limite ? limite.descartesDeEntrantes() : 0);

const MERCHANT = 7;
const SECRETO = 'laboratorio-1509h';

// ── LA BASE EN MEMORIA ─────────────────────────────────────────────────────────────────────
let t = {};
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
const tabla = (nombre) => ({
  findMany: async ({ where, take } = {}) => t[nombre].filter((f) => casa(f, where)).slice(0, take || undefined),
  findFirst: async ({ where } = {}) => { const v = t[nombre].filter((f) => casa(f, where)); return v[v.length - 1] || null; },
  findUnique: async ({ where }) => t[nombre].find((f) => casa(f, where)) || null,
  count: async ({ where } = {}) => t[nombre].filter((f) => casa(f, where)).length,
  create: async ({ data }) => { const f = { id: t[nombre].length + 1, createdAt: new Date(), ...data }; t[nombre].push(f); return f; },
  createMany: async ({ data }) => { for (const d of [].concat(data)) t[nombre].push({ id: t[nombre].length + 1, createdAt: new Date(), ...d }); return { count: [].concat(data).length }; },
  update: async ({ where, data }) => { const f = t[nombre].find((x) => casa(x, where)); if (!f) { const e = new Error('no casa'); e.code = 'P2025'; throw e; } Object.assign(f, data); return f; },
  updateMany: async ({ where, data }) => { const v = t[nombre].filter((x) => casa(x, where)); v.forEach((f) => Object.assign(f, data)); return { count: v.length }; },
});
const NOMBRES = ['customer', 'merchant', 'quote', 'whatsAppMessage', 'botSession', 'charge', 'event'];
const modelos = {};
for (const n of NOMBRES) modelos[n] = tabla(n);
let entrantesRegistrados = 0;
const createManyMensajes = modelos.whatsAppMessage.createMany;
modelos.whatsAppMessage.createMany = async (args) => { entrantesRegistrados += 1; return createManyMensajes(args); };
const neutro = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }), upsert: async () => ({ id: 1 }) };
const doble = new Proxy({}, { get: (_, m) => {
  if (m === '$transaction') return async (arg) => (typeof arg === 'function' ? arg(doble) : Promise.all(arg));
  if (m === '$executeRaw') return async () => 0; // el candado de la reserva del tope (SCRUM-1509g)
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => (modelos[m] && modelos[m][met]) || neutro[met] });
} });
globalThis.prisma = doble;
globalThis.fetch = () => { throw new Error('BANCO: alguien llamó a fetch'); };

// ── EL TRANSPORTE ──────────────────────────────────────────────────────────────────────────
// `WHATSAPP_DRY_RUN=1`: los senders pasan TODOS sus guards y sólo se saltan la llamada HTTP,
// apuntando cada envío en `__waDryRunOutbox` (y un proceso de test sin él lo BLOQUEA, SCRUM-180).
const salidas = [];
globalThis.__waDryRunOutbox = salidas;
const { normalizePhone } = requiere('../dist/core/utils/utils.js');
const PROF = normalizePhone(telefonoDePrueba(15090900));

// Los avisos al profesional se cuentan en la función que los manda (la ruta la llama por el
// objeto del módulo, así que el envoltorio se ve).
const notif = requiere('../dist/integrations/whatsappNotifications.js');
let avisos = 0;
const avisoOriginal = notif.notifyMerchantAlert;
notif.notifyMerchantAlert = async (p) => { avisos += 1; return avisoOriginal(p); };

const trazas = [];
const { config } = requiere('../dist/core/config/env.js');
config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1509h';
config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1509h';
config.WHATSAPP_APP_SECRET = SECRETO;

const { app } = requiere('../dist/app.js');
let servidor; let puerto;

// ── EL RELOJ ───────────────────────────────────────────────────────────────────────────────
const ahoraReal = Date.now;
let desfaseMs = 0;
Date.now = () => ahoraReal() + desfaseMs;

// ── UTILIDADES ─────────────────────────────────────────────────────────────────────────────
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
function pedir(cuerpo, firma) {
  return new Promise((resolve, reject) => {
    const datos = Buffer.from(cuerpo);
    const req = http.request({ host: '127.0.0.1', port: puerto, path: '/webhooks/whatsapp', method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': datos.length, 'x-hub-signature-256': firma } }, (res) => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.end(datos);
  });
}
// el webhook contesta 200 y SIGUE trabajando por detrás: se espera a que deje de moverse
async function asentar() {
  let antes = -1; let quietos = 0;
  for (let i = 0; i < 400 && quietos < 3; i += 1) {
    await dormir(10);
    const ahora = salidas.length + avisos + trazas.length + t.whatsAppMessage.length + entrantesRegistrados;
    quietos = ahora === antes ? quietos + 1 : 0; antes = ahora;
  }
}
let serieEntrada = 0;
/** UNA petición firmada con `n` textos de `from` dentro. `wamid` fijo = la misma entrega repetida. */
async function entrega(from, n, { wamid, firmaMala } = {}) {
  const msgs = Array.from({ length: n }, (_, i) => ({ from, id: wamid || 'wamid.entrada-1509h.' + (++serieEntrada), type: 'text', text: { body: 'hola ' + i } }));
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: msgs } }] }] });
  const firma = firmaMala ? 'sha256=' + '0'.repeat(64) : 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex');
  const codigo = await pedir(cuerpo, firma);
  if (!firmaMala) await asentar(); // un 401 no deja trabajo por detrás
  return codigo;
}
/**
 * Un cliente NUEVO con albarán hace 3 días: cada texto suyo avisa al profesional. Cada uno en SU
 * comercio, para que el tope de plantillas por comercio (100/día) no se mezcle entre casos.
 */
let serieCliente = 0;
function clienteConAlbaran() {
  serieCliente += 1;
  const phone = normalizePhone(telefonoDePrueba(15090000 + serieCliente));
  const id = 500 + serieCliente;
  const merchantId = MERCHANT * 100 + serieCliente;
  t.merchant.push({ id: merchantId, name: 'Taller 1509h', legalName: 'Taller 1509h', whatsappPhone: PROF, flags: null, country: 'ES', publicSlug: null });
  t.customer.push({ id, merchantId, name: 'Cliente ' + serieCliente, phone, mobile: null, waOptOut: false });
  t.whatsAppMessage.push({ id: 9000 + serieCliente, merchantId, customerId: id, type: 'template', relatedType: 'albaran', relatedId: 1,
    waMessageId: 'wamid.albaran-1509h.' + serieCliente, status: 'sent', createdAt: new Date(ahoraReal() - 3 * 24 * 3600 * 1000) });
  return phone;
}
/** Lo que una tanda de entregas produjo: se mide la DIFERENCIA, no el total acumulado. */
function foto() {
  return { avisos, alProfesional: salidas.filter((s) => s.to === PROF).length, entrantesRegistrados, descartes: descartes(),
    trazasDeDescarte: trazas.filter((l) => /\[WA in\] DESCARTADO/.test(l)).length,
    erroresDeManejador: trazas.filter((l) => /handler error|button error|Parse error/.test(l)).length };
}
const resta = (d, a) => Object.fromEntries(Object.keys(d).map((k) => [k, d[k] - a[k]]));

test.before(async () => {
  t = {}; for (const n of NOMBRES) t[n] = [];
  console.warn = (...a) => trazas.push(a.map(String).join(' '));
  console.error = (...a) => trazas.push(a.map(String).join(' '));
  servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidor.address().port;
});
test.after(() => { Date.now = ahoraReal; servidor?.close(); });

test('SCRUM-1509h · el límite existe y es el FIRMADO: 20 por número y hora (c.20141)', () => {
  assert.ok(limite, 'no hay módulo del límite en dist/modules/whatsappBot/domain/limiteDeEntrantes.js');
  assert.equal(limite.ENTRANTES_POR_HORA, FIRMADO);
});

test('SCRUM-1509h · POSITIVO: un cliente con albarán escribe UNA vez → 1 aviso al profesional, 0 descartes', async () => {
  const cli = clienteConAlbaran();
  const a = foto();
  assert.equal(await entrega(cli, 1), 200);
  const d = resta(foto(), a);
  assert.deepEqual(d, { avisos: 1, alProfesional: 1, entrantesRegistrados: 1, descartes: 0, trazasDeDescarte: 0, erroresDeManejador: 0 });
});

test('SCRUM-1509h · EL ROJO DE 1509f: 120 textos del mismo número, uno por petición → pasan 20; 100 se descartan EN SILENCIO y se cuentan', async () => {
  const cli = clienteConAlbaran();
  const a = foto();
  const salidasAlCliente = salidas.filter((s) => s.to === cli).length;
  for (let i = 0; i < 120; i += 1) assert.equal(await entrega(cli, 1), 200);
  const d = resta(foto(), a);
  assert.equal(d.erroresDeManejador, 0, 'el manejador reventó: el caso no vale');
  assert.deepEqual(d, { avisos: N, alProfesional: N, entrantesRegistrados: N, descartes: 120 - N, trazasDeDescarte: 120 - N, erroresDeManejador: 0 },
    `hoy (sin límite) 1509f midió 120 avisos; salió ${JSON.stringify(d)}`);
  // EN SILENCIO: cada mensaje admitido lleva su acuse al cliente (lo que ya hacía la ruta); los
  // descartados, ninguno. Así que al cliente le llegan N, no 120 ni N + 1.
  assert.equal(salidas.filter((s) => s.to === cli).length - salidasAlCliente, N);
});

test('SCRUM-1509h · EL LOTE: una sola petición con 120 mensajes dentro → pasan 20 (la unidad es el mensaje, no la petición)', async () => {
  const cli = clienteConAlbaran();
  const a = foto();
  assert.equal(await entrega(cli, 120), 200);
  assert.deepEqual(resta(foto(), a), { avisos: N, alProfesional: N, entrantesRegistrados: N, descartes: 120 - N, trazasDeDescarte: 120 - N, erroresDeManejador: 0 });
});

test('SCRUM-1509h · EL BORDE: pasa el mensaje N y se descarta el N+1; la entrega REPETIDA de Meta no gasta cupo', async () => {
  const cli = clienteConAlbaran();
  const a = foto();
  for (let i = 0; i < 30; i += 1) await entrega(cli, 1, { wamid: 'wamid.repetida-1509h' }); // 30 reintentos de UNA entrega
  assert.deepEqual(resta(foto(), a), { avisos: 1, alProfesional: 1, entrantesRegistrados: 1, descartes: 0, trazasDeDescarte: 0, erroresDeManejador: 0 });
  const b = foto();
  for (let i = 0; i < N - 2; i += 1) await entrega(cli, 1); // hasta el N-1
  assert.equal(resta(foto(), b).avisos, N - 2);
  const c = foto();
  await entrega(cli, 1); // el N: pasa
  assert.deepEqual(resta(foto(), c), { avisos: 1, alProfesional: 1, entrantesRegistrados: 1, descartes: 0, trazasDeDescarte: 0, erroresDeManejador: 0 });
  const e = foto();
  await entrega(cli, 1); // el N+1: fuera
  assert.deepEqual(resta(foto(), e), { avisos: 0, alProfesional: 0, entrantesRegistrados: 0, descartes: 1, trazasDeDescarte: 1, erroresDeManejador: 0 });
});

test('SCRUM-1509h · POR NÚMERO: con un número ya en su límite, OTRO cliente del mismo comercio sigue entrando', async () => {
  const lleno = clienteConAlbaran();
  await entrega(lleno, N + 5);
  const otro = clienteConAlbaran();
  const a = foto();
  await entrega(otro, 1);
  assert.deepEqual(resta(foto(), a), { avisos: 1, alProfesional: 1, entrantesRegistrados: 1, descartes: 0, trazasDeDescarte: 0, erroresDeManejador: 0 });
});

test('SCRUM-1509h · LA FIRMA MALA no gasta cupo: 120 peticiones sin firmar y el cliente sigue entrando', async () => {
  const cli = clienteConAlbaran();
  const a = foto();
  for (let i = 0; i < 120; i += 1) assert.equal(await entrega(cli, 1, { firmaMala: true }), 401);
  assert.equal(await entrega(cli, 1), 200);
  assert.deepEqual(resta(foto(), a), { avisos: 1, alProfesional: 1, entrantesRegistrados: 1, descartes: 0, trazasDeDescarte: 0, erroresDeManejador: 0 });
});

// Las N llegadas y las dos comprobaciones caben en menos de un minuto real (el caso entero tarda
// décimas): por eso «un minuto antes de la hora» sigue dentro y «un minuto después» ya está fuera.
// Una hora de RELOJ (10:59 → 11:00) dejaría pasar 2N en un minuto: la ventana es deslizante.
test('SCRUM-1509h · LA HORA ES DESLIZANTE: un minuto antes de cumplirse sigue fuera; cumplida, vuelve a entrar', async () => {
  const cli = clienteConAlbaran();
  const inicio = desfaseMs;
  await entrega(cli, N);
  try {
    desfaseMs = inicio + VENTANA - 60_000;
    const a = foto();
    await entrega(cli, 1);
    assert.deepEqual(resta(foto(), a), { avisos: 0, alProfesional: 0, entrantesRegistrados: 0, descartes: 1, trazasDeDescarte: 1, erroresDeManejador: 0 });
    desfaseMs = inicio + VENTANA + 60_000;
    const b = foto();
    await entrega(cli, 1);
    assert.deepEqual(resta(foto(), b), { avisos: 1, alProfesional: 1, entrantesRegistrados: 1, descartes: 0, trazasDeDescarte: 0, erroresDeManejador: 0 });
  } finally {
    desfaseMs = inicio;
  }
});
