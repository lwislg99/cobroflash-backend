// SCRUM-1509d (2) - Los AVISOS AL PROFESIONAL (`notifyMerchantAlert`): cuantos produce cada disparo
// que se puede repetir desde fuera, y si comparten contador con las plantillas al cliente.
//
// Se ejecutan las RUTAS de `dist` montadas en un express y pedidas por HTTP:
//   - el webhook de entrantes de WhatsApp, con su firma (secreto de laboratorio, calculada aqui);
//   - la pagina publica de Bizum (`POST /pay/bizum/:token/claimed`).
// Se doblan la base (en memoria, con estado; lo no modelado se contesta neutro y SE APUNTA) y el
// transporte de axios (no sale un byte; se cuenta cada peticion por tipo y destinatario).
// Un manejador que revienta daria «0 avisos» igual que uno que no avisa: se cuentan sus trazas de
// error y un caso con alguna NO vale.
//
// Uso:  node avisos.cjs <dist> [--esperado-menos-uno]
//   --esperado-menos-uno  resta 1 a lo que este guion espera en los casos de repeticion: debe salir rojo.
// Sale 0 si todo cuadra, 1 si algo no cuadra, 2 si el guion se rompe o sale mudo.
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const dist = path.resolve(process.argv[2] || 'dist');
const menosUno = process.argv.includes('--esperado-menos-uno');
if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('CIEGO: proceso de test.'); process.exit(2);
}
for (const k of ['WHATSAPP_DRY_RUN', 'WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP', 'BOT_INBOUND_ENABLED']) delete process.env[k];

const RealDate = Date;
let desfaseMs = 0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfaseMs); else super(...a); }
  static now() { return RealDate.now() + desfaseMs; }
}
global.Date = FakeDate;
{ const d = new RealDate(); d.setHours(12, 0, 0, 0); desfaseMs = d.getTime() - RealDate.now(); }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const MERCHANT = 7;
const SECRETO = 'laboratorio-1509d';
let t = {}; let est = {}; let modo = {};
const noModeladas = {};

function casaValor(x, v) {
  if (v === null) return x == null;
  if (typeof v === 'object' && !(v instanceof RealDate)) {
    for (const [op, val] of Object.entries(v)) {
      if (op === 'gte') { if (!(x >= val)) return false; }
      else if (op === 'gt') { if (!(x > val)) return false; }
      else if (op === 'lte') { if (!(x <= val)) return false; }
      else if (op === 'lt') { if (!(x < val)) return false; }
      else if (op === 'in') { if (!val.includes(x)) return false; }
      else if (op === 'not') { if (val === null) { if (x == null) return false; } else if (x === val) return false; }
      else throw new Error('INSTRUMENTO: operador no modelado en el where: ' + op);
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
const tabla = (nombre, extra) => ({
  findMany: async ({ where, take } = {}) => t[nombre].filter((f) => casa(f, where)).slice(0, take || undefined),
  findFirst: async ({ where } = {}) => { const v = t[nombre].filter((f) => casa(f, where)); return v[v.length - 1] || null; },
  findUnique: async ({ where }) => t[nombre].find((f) => casa(f, where)) || null,
  count: async ({ where } = {}) => t[nombre].filter((f) => casa(f, where)).length,
  create: async ({ data }) => { const f = { id: t[nombre].length + 1, createdAt: new FakeDate(), ...data }; t[nombre].push(f); return f; },
  createMany: async ({ data }) => { for (const d of [].concat(data)) t[nombre].push({ id: t[nombre].length + 1, createdAt: new FakeDate(), ...d }); return { count: [].concat(data).length }; },
  update: async ({ where, data }) => { const f = t[nombre].find((x) => casa(x, where)); if (!f) { const e = new Error('no casa'); e.code = 'P2025'; throw e; } Object.assign(f, data); return f; },
  updateMany: async ({ where, data }) => { const v = t[nombre].filter((x) => casa(x, where)); v.forEach((f) => Object.assign(f, data)); return { count: v.length }; },
  ...extra,
});
const NOMBRES = ['customer', 'merchant', 'quote', 'whatsAppMessage', 'botSession', 'charge', 'event'];
const modelos = {};
for (const n of NOMBRES) modelos[n] = tabla(n);
// el tope: se apunta QUE se pregunta (con cliente o sin el) y que se contesta
modelos.whatsAppMessage.count = async ({ where }) => {
  const n = t.whatsAppMessage.filter((f) => casa(f, where)).length;
  est.preguntas.push({ conCliente: 'customerId' in where, where, respuesta: n });
  return n;
};
// el cobro de Bizum se carga con sus relaciones
modelos.charge.findUnique = async ({ where }) => {
  const c = t.charge.find((f) => casa(f, where)); if (!c) return null;
  return { ...c, customer: t.customer.find((x) => x.id === c.customerId) || null, merchant: t.merchant.find((x) => x.id === c.merchantId) || null };
};
const neutro = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }), upsert: async () => ({ id: 1 }) };
global.prisma = new Proxy({}, { get: (_, m) => {
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => {
    if (modelos[m] && modelos[m][met]) return modelos[m][met];
    if (typeof met !== 'string' || !neutro[met]) return undefined;
    return async (...a) => { noModeladas[m + '.' + met] = (noModeladas[m + '.' + met] || 0) + 1; return neutro[met](...a); };
  } });
} });
global.fetch = () => { throw new Error('INSTRUMENTO: alguien llamo a fetch'); };

const requiereDist = createRequire(path.join(dist, 'integrations/whatsapp.js'));
// El host de Meta NO se escribe aqui: se lee del propio modulo que habla con Meta (asi este guion
// no nombra el destino, y si el modulo cambiara de host la comprobacion le seguiria).
const HOST_DE_META = (() => { const m = /https:\/\/([a-z0-9.-]+)\/v\d+/.exec(require('fs').readFileSync(path.join(dist, 'integrations/whatsapp.js'), 'utf8')); if (!m) { console.log('GUION MUDO: no se pudo leer el host de Meta del modulo'); process.exit(2); } return m[1]; })();
const axios = requiereDist('axios');
axios.defaults.adapter = async (cfg) => {
  let cuerpo = {};
  try { cuerpo = JSON.parse(cfg.data); } catch { /* vacio */ }
  const tipo = String(cuerpo.type || (cuerpo.status ? 'leido' : 'ilegible'));
  est.aMeta.push({ host: new URL(String(cfg.url)).host, tipo, to: String(cuerpo.to || ''), plantilla: (cuerpo.template && cuerpo.template.name) || null });
  const resp = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
  // texto o boton al PROFESIONAL con su ventana cerrada: Meta lo rechaza y el aviso cae a la plantilla
  if (tipo !== 'template' && cuerpo.to === PROF && !modo.ventanaDelProfesionalAbierta) {
    throw new axios.AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', cfg, {}, resp(400, { error: { message: 'laboratorio: fuera de ventana', code: 131047 } }));
  }
  return resp(200, { messages: [{ id: 'wamid.salida-1509d.' + (++serieSalida) }] });
};
let serieSalida = 0;

const trazas = [];
console.error = (...a) => trazas.push(a.map(String).join(' '));
console.warn = (...a) => trazas.push(a.map(String).join(' '));
const hablar = console.log;
console.log = () => {};

let wa; let notif; let puerto; let tel; let PROF; let CLI; let C; let D; let normalizePhone;
let serieEntrada = 0;
const noCuadran = []; const filasTabla = [];

function nuevoCaso(m) {
  modo = { ...m };
  trazas.length = 0;
  t = {}; for (const n of NOMBRES) t[n] = [];
  est = { aMeta: [], preguntas: [], avisos: 0, http: {} };
  t.merchant.push({ id: MERCHANT, name: 'Taller Sonda', legalName: 'Taller Sonda', whatsappPhone: PROF, flags: null, country: 'ES', publicSlug: null });
  t.customer.push({ id: 50, merchantId: MERCHANT, name: 'Cliente Sonda', phone: CLI, mobile: null, waOptOut: false });
  if (m.bot) process.env.BOT_INBOUND_ENABLED = 'true'; else delete process.env.BOT_INBOUND_ENABLED;
}
const conAlbaran = () => t.whatsAppMessage.push({ id: 9000, merchantId: MERCHANT, customerId: 50, type: 'template', relatedType: 'albaran', relatedId: 1, waMessageId: 'wamid.albaran', status: 'sent',
  createdAt: new FakeDate(FakeDate.now() - 3 * 24 * 3600 * 1000) });
const filaDeHoy = (customerId) => ({ merchantId: MERCHANT, customerId, type: 'template', waMessageId: 'wamid.previa', status: 'sent', createdAt: new FakeDate() });

function pedir(ruta, cuerpo, cabeceras) {
  return new Promise((resolve, reject) => {
    const datos = Buffer.from(cuerpo || '');
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': datos.length, ...(cabeceras || {}) } }, (res) => {
      res.resume(); res.on('end', () => { est.http[res.statusCode] = (est.http[res.statusCode] || 0) + 1; resolve(res.statusCode); });
    });
    req.on('error', reject); req.end(datos);
  });
}
async function entrante(msg, opciones) {
  const o = opciones || {};
  const id = o.wamid || ('wamid.entrada-1509d.' + (++serieEntrada));
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: o.from || CLI, id, ...msg }] } }] }] });
  const firma = o.firmaMala ? 'sha256=' + '0'.repeat(64) : 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex');
  await pedir('/webhooks/whatsapp', cuerpo, { 'x-hub-signature-256': firma });
  await dormir(25); // el webhook contesta y sigue trabajando por detras
}
const texto = (body) => ({ type: 'text', text: { body } });
const lista = (id) => ({ type: 'interactive', interactive: { list_reply: { id } } });

function resumen() {
  const alProf = est.aMeta.filter((p) => p.to === PROF);
  return {
    avisos: est.avisos,
    plantillasAlProfesional: alProf.filter((p) => p.tipo === 'template').length,
    otrosAlProfesional: alProf.filter((p) => p.tipo !== 'template').length,
    plantillasAlCliente: est.aMeta.filter((p) => p.to === CLI && p.tipo === 'template').length,
    otrosAlCliente: est.aMeta.filter((p) => p.to === CLI && p.tipo !== 'template' && p.tipo !== 'leido').length,
    hostAjeno: est.aMeta.filter((p) => p.host !== HOST_DE_META).length,
    erroresDeManejador: trazas.filter((l) => /handler error|button error|Parse error|photo error/.test(l)).length,
    bloqueoComercio: trazas.filter((l) => /alcanz. el tope diario de plantillas/.test(l)).length,
    preguntasComercio: est.preguntas.filter((p) => !p.conCliente).length,
    preguntasCliente: est.preguntas.filter((p) => p.conCliente).length,
    http: Object.entries(est.http).map(([k, v]) => k + 'x' + v).join(' ') || '-',
  };
}
function anotar(nombre, esperado, sinErrores) {
  const r = resumen();
  const fallos = [];
  for (const [k, v] of Object.entries(esperado || {})) {
    if (!(k in r)) fallos.push(k + ': el esperado nombra una clave que el resumen no tiene');
    else if (r[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + r[k]);
  }
  if (r.hostAjeno) fallos.push('peticiones a un host que no es Meta: ' + r.hostAjeno);
  if (sinErrores !== false && r.erroresDeManejador) fallos.push('el manejador revento ' + r.erroresDeManejador + ' veces: el caso NO vale (' + trazas.filter((l) => /handler error/.test(l))[0] + ')');
  if (fallos.length) noCuadran.push(nombre);
  filasTabla.push({ nombre, r, fallos });
  hablar((fallos.length ? 'ROJO   ' : 'cuadra ') + nombre.padEnd(70) + ' avisos=' + String(r.avisos).padStart(3) + ' plantProf=' + String(r.plantillasAlProfesional).padStart(3) + ' otrosProf=' + String(r.otrosAlProfesional).padStart(3)
    + ' plantCli=' + String(r.plantillasAlCliente).padStart(3) + ' otrosCli=' + String(r.otrosAlCliente).padStart(3) + ' bloqCom=' + String(r.bloqueoComercio).padStart(3)
    + ' pregCom=' + String(r.preguntasComercio).padStart(3) + ' pregCli=' + String(r.preguntasCliente).padStart(3) + ' http=' + r.http + (fallos.length ? '  <<< ' + fallos.join(' | ') : ''));
  return r;
}

(async () => {
  tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1509d';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1509d';
  config.WHATSAPP_APP_SECRET = SECRETO;
  C = config.WA_CUSTOMER_DAILY_CAP; D = config.WA_DAILY_TEMPLATE_CAP;
  normalizePhone = require(path.join(dist, 'core/utils/utils.js')).normalizePhone;
  PROF = normalizePhone(tel.telefonoDePrueba(900)); CLI = normalizePhone(tel.telefonoDePrueba(150));
  if (!PROF || !CLI || PROF === CLI) { hablar('GUION MUDO: telefonos de prueba no validos'); process.exit(2); }
  wa = require(path.join(dist, 'integrations/whatsapp.js'));
  notif = require(path.join(dist, 'integrations/whatsappNotifications.js'));
  nuevoCaso({});
  const avisoOriginal = notif.notifyMerchantAlert;
  notif.notifyMerchantAlert = async (p) => { est.avisos += 1; return avisoOriginal(p); };
  if (notif.notifyMerchantAlert === avisoOriginal) { hablar('GUION MUDO: no se pudo contar el aviso'); process.exit(2); }

  const express = requiereDist('express');
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: false }));
  app.use('/webhooks/whatsapp', require(path.join(dist, 'modules/whatsappBot/app/routes/whatsappIncoming.routes.js')).default);
  app.use('/pay', require(path.join(dist, 'modules/billing/app/routes/payBizum.routes.js')).default);
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidor.address().port;
  const { buildQuoteDecision } = require(path.join(dist, 'integrations/whatsappTemplates.js'));
  const plantillaAlCliente = () => wa.sendWhatsAppTemplate({ to: CLI, merchantId: MERCHANT, ...buildQuoteDecision({ customerName: 'Cliente Sonda', businessName: 'Taller Sonda', quoteNumber: 12, amount: 100, currency: 'EUR', decisionToken: 'tokdecision' }), log: { customerId: 50 } });

  hablar('topes leidos en dist: por cliente y dia = ' + C + ' · por comercio y dia = ' + D + (menosUno ? '  [ESPERADO -1: este guion debe salir rojo]' : ''));
  const N = 10;
  const rep = (n) => (menosUno ? n - 1 : n);

  hablar('\n== K · CONTROLES ==');
  nuevoCaso({}); conAlbaran();
  await entrante(texto('hola, una duda del albaran'), { firmaMala: true });
  anotar('K0 CERO: entrante con la firma mala', { avisos: 0, plantillasAlProfesional: 0, otrosAlCliente: 0, http: '401x1' });
  nuevoCaso({});
  await entrante(texto('hola'), { from: normalizePhone(tel.telefonoDePrueba(777)) });
  anotar('K1 CERO: entrante valido de un numero que no es cliente de nadie', { avisos: 0, plantillasAlProfesional: 0, http: '200x1' });
  nuevoCaso({});
  await entrante(texto('hola, una duda'));
  anotar('K2 CERO: cliente SIN albaran reciente escribe', { avisos: 0, plantillasAlProfesional: 0, http: '200x1' });
  nuevoCaso({}); conAlbaran();
  await entrante(texto('hola, una duda del albaran'));
  const k3 = anotar('K3 POSITIVO: cliente CON albaran reciente escribe 1 vez', { avisos: 1, plantillasAlProfesional: 1, otrosAlProfesional: 1, otrosAlCliente: 1, http: '200x1' });
  nuevoCaso({ ventanaDelProfesionalAbierta: true }); conAlbaran();
  await entrante(texto('hola, una duda del albaran'));
  anotar('K4 lo mismo con la ventana del profesional ABIERTA: 0 plantillas', { avisos: 1, plantillasAlProfesional: 0, otrosAlProfesional: 1 });

  hablar('\n== R · REPETIR EL DISPARO desde fuera (' + N + ' veces, mismo cliente, ventana del profesional cerrada) ==');
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < N; i += 1) await entrante(texto('mensaje ' + i + ' sobre el albaran'));
  anotar('R1 :409 · ' + N + ' textos DISTINTOS de un cliente con albaran (flag del bot OFF)', { avisos: rep(N), plantillasAlProfesional: rep(N) });
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < N; i += 1) await entrante(texto('el mismo mensaje'), { wamid: 'wamid.repetido-1509d' });
  anotar('R2 :409 · la MISMA entrega ' + N + ' veces (reintento de Meta)', { avisos: 1, plantillasAlProfesional: 1 });
  nuevoCaso({});
  for (let i = 0; i < N; i += 1) await entrante(texto('BAJA'));
  anotar('R3 :297 · el cliente escribe BAJA ' + N + ' veces', { avisos: rep(N), plantillasAlProfesional: rep(N) });
  nuevoCaso({ bot: true });
  for (let i = 0; i < N; i += 1) await entrante(texto('BAJA'));
  anotar('R4 :297 · BAJA ' + N + ' veces con el flag del bot ON', { avisos: rep(N), plantillasAlProfesional: rep(N) });
  nuevoCaso({ bot: true });
  for (let i = 0; i < N; i += 1) await entrante(texto('necesito hablar de una cosa ' + i));
  anotar('R5 :688 · ' + N + ' textos fuera de menu con el flag del bot ON', { avisos: 1, plantillasAlProfesional: 1 });
  nuevoCaso({ bot: true });
  for (let i = 0; i < N; i += 1) await entrante(lista('bot_human'));
  anotar('R6 :631 · «hablar con una persona» ' + N + ' veces con el flag del bot ON', { avisos: 1, plantillasAlProfesional: 1 });
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < N; i += 1) await entrante(lista('bot_human'));
  anotar('R7 :631 · lo mismo con el flag OFF (por defecto): no llega al bot', { avisos: 0, plantillasAlProfesional: 0 });
  // Bizum: pagina publica
  nuevoCaso({});
  t.charge.push({ id: 31, merchantId: MERCHANT, customerId: 50, status: 'pending', amount: 100, currency: 'EUR', receiptToken: 'tokbizum', concept: 'x' });
  for (let i = 0; i < N; i += 1) { await pedir('/pay/bizum/tokbizum/claimed', ''); await dormir(10); }
  anotar('R8 payBizum:198 · «ya he pagado» ' + N + ' veces sobre el mismo cobro', { avisos: 1, plantillasAlProfesional: 1, http: '303x' + N });
  nuevoCaso({});
  await pedir('/pay/bizum/token-que-no-existe/claimed', '');
  anotar('R9 CERO Bizum: un token que no existe', { avisos: 0, http: '404x1' });

  hablar('\n== C · EL CONTADOR: los avisos al profesional y las plantillas al cliente, cuentan en el mismo sitio? ==');
  // un tercero agota el cupo del comercio escribiendo
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < D + 20; i += 1) await entrante(texto('mensaje ' + i));
  const c1 = anotar('C1 un cliente con albaran escribe ' + (D + 20) + ' textos en el dia', { avisos: D + 20, plantillasAlProfesional: D, bloqueoComercio: 20 });
  { const antes = est.aMeta.length; const nPreg = est.preguntas.length; const r = await plantillaAlCliente(); await dormir(5);
    const preg = est.preguntas.slice(nPreg);
    const ok = !r.ok && r.reason === 'daily_cap' && est.aMeta.length === antes && preg.length === 1 && !preg[0].conCliente && preg[0].respuesta === D;
    if (!ok) noCuadran.push('C2'); filasTabla.push({ nombre: 'C2', r: {}, fallos: ok ? [] : ['x'] });
    hablar((ok ? 'cuadra ' : 'ROJO   ') + 'C2 ...y despues, 1 plantilla a un CLIENTE del mismo comercio'.padEnd(70) + ' ok=' + r.ok + ' motivo=' + r.reason + ' peticiones nuevas=' + (est.aMeta.length - antes)
      + ' · pregunta de comercio: contesta ' + (preg[0] && preg[0].respuesta) + ' · pregunta de cliente: ' + (preg.length > 1 ? 'se hace' : 'no llega a hacerse'));
    hablar('       where de la pregunta de comercio: ' + JSON.stringify(preg[0] && preg[0].where)); }
  // las filas de los avisos NO cuentan en el tope del cliente
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < N; i += 1) await entrante(texto('mensaje ' + i));
  { const nPreg = est.preguntas.length; const r = await plantillaAlCliente(); await dormir(5);
    const preg = est.preguntas.slice(nPreg); const com = preg.find((p) => !p.conCliente); const cli = preg.find((p) => p.conCliente);
    const ok = r.ok && com && com.respuesta === N && cli && cli.respuesta === 0;
    if (!ok) noCuadran.push('C3'); filasTabla.push({ nombre: 'C3', r: {}, fallos: ok ? [] : ['x'] });
    hablar((ok ? 'cuadra ' : 'ROJO   ') + ('C3 tras ' + N + ' avisos, 1 plantilla al cliente').padEnd(70) + ' ok=' + r.ok + ' · comercio contesta ' + (com && com.respuesta) + ' · cliente contesta ' + (cli && cli.respuesta));
    hablar('       where de la pregunta de cliente:  ' + JSON.stringify(cli && cli.where)); }
  // control: los avisos que salen por TEXTO (ventana abierta) no gastan cupo
  nuevoCaso({ ventanaDelProfesionalAbierta: true }); conAlbaran();
  for (let i = 0; i < D + 20; i += 1) await entrante(texto('mensaje ' + i));
  anotar('C4 CERO: los mismos ' + (D + 20) + ' textos con la ventana del profesional ABIERTA', { avisos: D + 20, plantillasAlProfesional: 0, bloqueoComercio: 0 });
  { const nPreg = est.preguntas.length; const r = await plantillaAlCliente(); await dormir(5); const com = est.preguntas.slice(nPreg).find((p) => !p.conCliente);
    const ok = r.ok && com && com.respuesta === 0;
    if (!ok) noCuadran.push('C5'); filasTabla.push({ nombre: 'C5', r: {}, fallos: ok ? [] : ['x'] });
    hablar((ok ? 'cuadra ' : 'ROJO   ') + 'C5 ...y despues, 1 plantilla a un cliente'.padEnd(70) + ' ok=' + r.ok + ' · comercio contesta ' + (com && com.respuesta)); }
  // al reves: el cupo gastado en CLIENTES deja al profesional sin aviso
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < D; i += 1) t.whatsAppMessage.push(filaDeHoy(60 + i));
  await entrante(texto('una duda del albaran'));
  anotar('C6 AL REVES: ' + D + ' plantillas a clientes hoy, y un cliente escribe', { avisos: 1, plantillasAlProfesional: 0, otrosAlProfesional: 1, bloqueoComercio: 1 });

  hablar('\n== lo que la base en memoria contesto SIN modelarlo (valor neutro), toda la corrida ==');
  const nm = Object.entries(noModeladas).sort();
  hablar(nm.length ? nm.map(([k, v]) => '  ' + k + ' x' + v).join('\n') : '  (nada)');
  const totalAvisos = filasTabla.reduce((s, f) => s + (f.r.avisos || 0), 0);
  hablar('\nCASOS: ' + filasTabla.length + ' · cuadran: ' + (filasTabla.length - noCuadran.length) + ' · NO cuadran: ' + noCuadran.length + ' · avisos contados en total: ' + totalAvisos);
  hablar('POSITIVO OBLIGATORIO: K3 conto ' + k3.avisos + ' aviso y ' + k3.plantillasAlProfesional + ' plantilla al profesional; C1 vio ' + c1.bloqueoComercio + ' bloqueos de comercio (los tres tienen que ser > 0).');
  servidor.close();
  if (!(k3.avisos > 0) || !(k3.plantillasAlProfesional > 0) || !(c1.bloqueoComercio > 0)) { hablar('GUION MUDO: el instrumento no ve lo que tiene que ver.'); process.exit(2); }
  process.exit(noCuadran.length ? 1 : 0);
})().catch((e) => { hablar('GUION ROTO: ' + ((e && e.stack) || e)); process.exit(2); });
