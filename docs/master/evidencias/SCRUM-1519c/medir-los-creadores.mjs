// SCRUM-1519c · Los CREADORES de PRESUPUESTO que estaban LEÍDOS y no ejecutados, POR EFECTO.
//
// QUÉ SE PREGUNTA, para cada creador: ¿puede dejar un PRESUPUESTO apuntando al cliente de OTRO
// comercio? Sesión del comercio 21, recursos del 22. Dos preguntas, las mismas de SCRUM-1519b:
//   P · LA PUERTA: se le pide al creador, por su ruta real, que use lo de B. ¿Queda una fila cruzada?
//   D · LA HERENCIA: el dato del que el creador COPIA ya viene cruzado (SEMBRADO por este fichero).
//       ¿Lo copia tal cual al presupuesto nuevo? Si lo copia, el creador no comprueba: hereda.
//
// LOS TRES: la revisión (quoteAdmin.ts:593), el adicional del albarán (albaranes.routes.ts:1641) y
// el mantenimiento (maintenance.service.ts:413). Y, de paso, el único que MUEVE Quote.customerId sin
// crear: la fusión de clientes (fusionClientes.ts:177).
//
// CÓMO: manejadores y funciones reales de dist/, sin HTTP y sin base. El ALMACÉN, el motor y los
// cortes de red son los de SCRUM-1519b (medir-los-escritores.mjs), COPIADOS tal cual: el bloque va
// entre las dos marcas «COPIADO». EL VEREDICTO SALE DEL ALMACÉN, no de la respuesta: después de cada
// caso se recorren TODAS las filas de Trabajo, de Presupuesto y de Plan de mantenimiento y se compara
// el comercio de la fila con el de aquello a lo que apunta. Cuentan las cruzadas NUEVAS.
//
// VEREDICTOS:  CRUZA            hay una fila cruzada que antes no estaba
//              ESCRIBE-LIMPIO   cambió alguna fila mirada y ninguna quedó cruzada
//              NO-ESCRIBE       no cambió ninguna fila mirada
//
// EL PAR SEMBRADO: cinco creadores de presupuesto de mentira montados en memoria sobre la app (no
// existen en src/ ni en dist/). Tienen las formas que se van a medir: dos cruzan por la PUERTA
// (comprueban que la fila existe, no de quién es), uno cruza por HERENCIA (lee lo suyo y copia el
// cliente sin mirarlo) y dos filtran (uno en la puerta, otro comprobando el cliente antes de copiar).
// Si no salen como deben, sale 1. `--doble-sordo` tiene que salir 1. `--sin-siembra`, 2 (CIEGO).
// Y cada creador real lleva su CONTROL PROPIO: con recursos del 21 TIENE que crear un presupuesto.
//
// `--detector-sordo` (el detector no mira las filas de Presupuesto) también tiene que salir 1: es el
// rojo del eje de la HERENCIA, que el doble sordo no toca (el que hereda no consulta nada de B).
//
// Uso: node medir-los-creadores.mjs <raíz del árbol, con dist/ y src/> [--doble-sordo] [--detector-sordo] [--sin-siembra]
// ───────────────────────────── COPIADO de SCRUM-1519b (líneas 26-197) ─────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';

const raiz = process.argv[2] ? path.resolve(process.argv[2]) : null;
const fin = (n, m) => { if (m) console.log(m); console.log('EXIT=' + n); process.exit(n); };
if (!raiz) fin(2, 'CIEGO: falta la raíz del árbol');
const SORDO = process.argv.includes('--doble-sordo');
const SIN_SIEMBRA = process.argv.includes('--sin-siembra');
const de = (rel) => import(pathToFileURL(path.join(raiz, 'dist', rel)).href);

// ── Nada sale de aquí (lo mismo que en SCRUM-1514c)
const aMeta = []; const fugas = [];
const req0 = createRequire(import.meta.url);
const dns = req0('node:dns'); const https = req0('node:https'); const http = req0('node:http');
const esLocal = (h) => h === '127.0.0.1' || h === 'localhost' || h === '::1';
const lookupReal = dns.lookup;
dns.lookup = function (host, ...resto) {
  if (esLocal(String(host))) return lookupReal.call(dns, host, ...resto);
  fugas.push('dns:' + host); const cb = resto[resto.length - 1];
  const e = new Error('INSTRUMENTO: nombre cortado: ' + host); e.code = 'ENOTFOUND';
  if (typeof cb === 'function') return process.nextTick(() => cb(e)); throw e;
};
const destino = (a) => String(a[0] && (a[0].href || a[0].host || a[0].hostname || a[0]));
for (const m of ['request', 'get']) https[m] = function (...a) { fugas.push('https:' + destino(a)); throw new Error('INSTRUMENTO: https cortado'); };
for (const m of ['request', 'get']) http[m] = function (...a) { fugas.push('http:' + destino(a)); throw new Error('INSTRUMENTO: http cortado'); };
globalThis.fetch = (u) => { let h = '?'; try { h = new URL(String(u && u.url ? u.url : u)).hostname; } catch { /* se apunta igual */ } fugas.push('fetch:' + h); throw new Error('INSTRUMENTO: fetch cortado: ' + h); };
process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:9';
process.env.NODE_ENV = 'development';
process.env.DISABLE_CRONS = 'true';
const reqDist = createRequire(path.join(raiz, 'dist', 'integrations', 'whatsapp.js'));
reqDist('axios').defaults.adapter = async (cfg) => { aMeta.push(String(cfg.url || '')); return { data: { messages: [{ id: 'wamid.laboratorio-1519.' + aMeta.length }] }, status: 200, statusText: '200', headers: {}, config: cfg, request: {} }; };

const { app } = await de('app.js');
const { getAdminMounts } = await de('core/http/adminMounts.js');
const { prisma } = await de('core/db/prisma.js');
const PELIGRO = Object.keys(process.env).filter((k) => process.env[k] && /WHATSAPP|RESEND|GEMINI|ANTHROPIC|OPENAI|STRIPE|MERCADOPAGO|DATABASE_URL|SMTP|MAILER/i.test(k));
if (PELIGRO.length) fin(2, 'CIEGO: el entorno lleva ' + PELIGRO.length + ' variable(s) de integración o de base (' + PELIGRO.join(', ') + ')');

// ── EL ALMACÉN
const A = 21; const B = 22;
const MARCAS_B = ['AJENO-B', '699000022', '712022', 'ajeno-b@example.invalid', 'B22AJENO'];
const MARCA_A = 'PROPIO-A cliente';
const cuando = new Date('2026-10-20T09:00:00Z');
const trabajo = (id, merchantId, customerId, quoteId, operarioId) => ({ id, merchantId, customerId, quoteId, status: 'agendado', scheduledAt: cuando,
  assignedUserId: null, notes: null, titulo: 'Trabajo ' + id, direccion: 'Calle ' + id, totalAceptado: 100, totalCobrado: 0, operarioId,
  tipoOperacion: 'TRABAJO_UNICO', createdAt: cuando, updatedAt: cuando, tipoIntervencion: null });
const presupuesto = (id, merchantId, customerId, jobId, quoteNumber) => ({ id, merchantId, customerId, jobId, quoteNumber, total: 100, currency: 'EUR',
  status: 'accepted', paymentTerms: null, customBillingPlan: null, lines: [], discountGlobalAmount: null, createdAt: cuando, updatedAt: cuando });
const almacenNuevo = () => ({
  merchant: [{ id: A, name: 'Comercio A', country: 'ES', currency: 'EUR', flags: {} }, { id: B, name: 'Comercio AJENO-B', country: 'ES', currency: 'EUR', flags: {} }],
  customer: [
    { id: 601, merchantId: A, name: MARCA_A, phone: '600000021', mobile: null, email: 'propio-a@example.invalid', taxId: 'A21PROPIO', notes: 'nota propia' },
    { id: 702, merchantId: B, name: 'AJENO-B cliente', phone: '699000022', mobile: null, email: 'ajeno-b@example.invalid', taxId: 'B22AJENO', notes: 'nota AJENO-B' },
  ],
  teamMember: [{ id: 621, merchantId: A, name: 'PROPIO-A operario', role: 'tecnico' }, { id: 722, merchantId: B, name: 'AJENO-B operario', role: 'tecnico' }],
  quote: [presupuesto(611, A, 601, 501, 611021), presupuesto(712, B, 702, 102, 712022)],
  job: [
    trabajo(501, A, 601, 611, null),   // el propio, sano: el control de que la ruta LLEGA
    trabajo(102, B, 702, 712, 722),    // el de B
    trabajo(502, A, 702, null, null),  // SEMBRADO: de A, con el cliente de B
    trabajo(503, A, 601, 712, null),   // SEMBRADO: de A, con el presupuesto de B
    trabajo(504, A, 601, null, 722),   // SEMBRADO: de A, con el operario de B
  ],
});
let T = almacenNuevo(); let apuntes = []; let noEvaluado = []; let escritasAjenas = []; let siguiente = 9000;
const minus = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const modelos = Object.keys(prisma).filter((k) => !k.startsWith('$') && !k.startsWith('_') && prisma[k] && typeof prisma[k].findMany === 'function');
const tabla = (m) => T[m] || (T[m] = []);
const esDeB = (m, r) => !!r && (m === 'merchant' ? r.id === B : r.merchantId === B);
const igual = (a, b) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b || (a != null && b != null && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && typeof a !== 'string' && typeof b !== 'string' && Number(a) === Number(b)));
function campo(valor, cond, donde) {
  if (cond === null) return valor == null;
  if (cond instanceof Date || typeof cond !== 'object') return igual(valor, cond);
  for (const [op, x] of Object.entries(cond)) {
    if (x === undefined) continue;
    if (op === 'equals') { if (!igual(valor, x)) return false; }
    else if (op === 'in') { if (!x.some((y) => igual(valor, y))) return false; }
    else if (op === 'notIn') { if (x.some((y) => igual(valor, y))) return false; }
    else if (op === 'not') { if (x === null ? valor == null : campo(valor, x, donde)) return false; }
    else if (op === 'gt') { if (!(valor > x)) return false; } else if (op === 'gte') { if (!(valor >= x)) return false; }
    else if (op === 'lt') { if (!(valor < x)) return false; } else if (op === 'lte') { if (!(valor <= x)) return false; }
    else if (op === 'mode') { /* acompaña a contains */ }
    else if (op === 'contains') { if (!String(valor ?? '').toLowerCase().includes(String(x).toLowerCase())) return false; }
    else noEvaluado.push(donde + '.' + op);
  }
  return true;
}
function casa(m, r, w) {
  if (!w) return true;
  for (const [k, v] of Object.entries(w)) {
    if (v === undefined) continue;
    if (k === 'AND') { if (![].concat(v).every((x) => casa(m, r, x))) return false; continue; }
    if (k === 'OR') { if (!v.some((x) => casa(m, r, x))) return false; continue; }
    if (k === 'NOT') { if ([].concat(v).some((x) => casa(m, r, x))) return false; continue; }
    if (k in r || v === null || typeof v !== 'object' || v instanceof Date) { if (!campo(r[k], v, m + '.' + k)) return false; continue; }
    const fk = k + 'Id';
    if (fk in r && modelos.includes(k)) { const o = tabla(k).find((x) => x.id === r[fk]); if (!o || !casa(k, o, v.is || v)) return false; continue; }
    if (k.includes('_')) { if (!casa(m, r, v)) return false; continue; } // clave compuesta: sus campos
    if (v && ('in' in v || 'equals' in v || 'not' in v)) { if (!campo(r[k], v, m + '.' + k)) return false; continue; }
    noEvaluado.push(m + '.' + k);
  }
  return true;
}
const casan = (m, w) => tabla(m).filter((r) => casa(m, r, w) && (!SORDO || m === 'merchant' ? true : !('merchantId' in r) || r.merchantId === A)
  && (!(SORDO && m === 'merchant') || r.id === A));
function relacion(m, r, k, val) {
  if (k === '_count') return {};
  let mo = minus(k); if (!modelos.includes(mo) && mo.endsWith('s') && modelos.includes(mo.slice(0, -1))) mo = mo.slice(0, -1);
  if (!modelos.includes(mo)) return undefined;
  const sub = val && typeof val === 'object' ? val : {};
  if (mo + 'Id' in r) { const o = tabla(mo).find((x) => x.id === r[mo + 'Id']); return o ? proyecta(mo, o, sub) : null; }
  return tabla(mo).filter((x) => x[m + 'Id'] === r.id && casa(mo, x, sub.where)).map((x) => proyecta(mo, x, sub));
}
function proyecta(m, r, args) {
  if (!r) return r;
  const a = args || {}; let out;
  if (a.select) { out = {}; for (const [k, v] of Object.entries(a.select)) { if (!v) continue; out[k] = k in r ? r[k] : relacion(m, r, k, v); } }
  else { out = { ...r }; for (const [k, v] of Object.entries(a.include || {})) if (v) out[k] = relacion(m, r, k, v); }
  return out;
}
const escalares = (d) => Object.fromEntries(Object.entries(d || {}).filter(([, v]) => v === null || typeof v !== 'object' || v instanceof Date || Array.isArray(v))
  .concat(Object.entries(d || {}).filter(([, v]) => v && typeof v === 'object' && 'increment' in v).map(([k, v]) => [k, v.increment])));
const apunta = (m, op, args, filas) => { const ajenas = filas.filter((r) => esDeB(m, r)); apuntes.push({ modelo: m, op, where: args && args.where, ajenas: ajenas.length }); return filas; };
for (const m of modelos) {
  const d = prisma[m];
  for (const op of ['findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow']) d[op] = async (args) => {
    const f = apunta(m, op, args, casan(m, args && args.where).slice(0, 1));
    if (!f.length && /OrThrow$/.test(op)) { const e = new Error('No encontrado'); e.code = 'P2025'; throw e; }
    return f.length ? proyecta(m, f[0], args) : null;
  };
  d.findMany = async (args) => apunta(m, 'findMany', args, casan(m, args && args.where)).map((r) => proyecta(m, r, args));
  d.count = async (args) => apunta(m, 'count', args, casan(m, args && args.where)).length;
  d.aggregate = async (args) => { apunta(m, 'aggregate', args, casan(m, args && args.where)); return { _sum: {}, _count: { _all: 0 }, _avg: {}, _max: {}, _min: {} }; };
  d.groupBy = async (args) => { apunta(m, 'groupBy', args, casan(m, args && args.where)); return []; };
  d.create = async (args) => { const r = { id: siguiente++, createdAt: new Date(), updatedAt: new Date(), ...escalares(args && args.data) }; tabla(m).push(r); apuntes.push({ modelo: m, op: 'create', where: null, ajenas: 0 }); return proyecta(m, r, args); };
  d.createMany = async (args) => { const l = [].concat((args && args.data) || []); for (const x of l) tabla(m).push({ id: siguiente++, ...escalares(x) }); return { count: l.length }; };
  d.update = async (args) => {
    const f = apunta(m, 'update', args, casan(m, args && args.where).slice(0, 1));
    if (!f.length) { const e = new Error('No encontrado'); e.code = 'P2025'; throw e; }
    if (esDeB(m, f[0])) escritasAjenas.push(m + '.update ' + JSON.stringify(args.where));
    Object.assign(f[0], escalares(args.data)); return proyecta(m, f[0], args);
  };
  d.updateMany = async (args) => { const f = apunta(m, 'updateMany', args, casan(m, args && args.where)); for (const r of f) { if (esDeB(m, r)) escritasAjenas.push(m + '.updateMany'); Object.assign(r, escalares(args.data)); } return { count: f.length }; };
  d.delete = async (args) => { const f = apunta(m, 'delete', args, casan(m, args && args.where).slice(0, 1)); if (!f.length) { const e = new Error('No encontrado'); e.code = 'P2025'; throw e; } if (esDeB(m, f[0])) escritasAjenas.push(m + '.delete'); T[m] = tabla(m).filter((r) => r !== f[0]); return f[0]; };
  d.deleteMany = async (args) => { const f = apunta(m, 'deleteMany', args, casan(m, args && args.where)); for (const r of f) if (esDeB(m, r)) escritasAjenas.push(m + '.deleteMany'); T[m] = tabla(m).filter((r) => !f.includes(r)); return { count: f.length }; };
  d.upsert = async (args) => { const f = casan(m, args && args.where); return f.length ? d.update({ where: args.where, data: args.update }) : d.create({ data: args.create }); };
}
prisma.$transaction = async (x) => (typeof x === 'function' ? x(prisma) : Promise.all(x));
prisma.$queryRaw = async () => []; prisma.$queryRawUnsafe = prisma.$queryRaw;
prisma.$executeRaw = async () => 0; prisma.$executeRawUnsafe = prisma.$executeRaw;

// ── EL ALMACÉN DE ESTA PASADA: el de SCRUM-1519 más lo que los escritores necesitan.
const suelto = (id, merchantId, customerId, status) => ({ ...presupuesto(id, merchantId, customerId, null, id * 1000 + merchantId), status,
  teamMemberId: null, evidence: null, acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null });
const almacenB = () => {
  const t = almacenNuevo();
  for (const c of t.customer) c.tags = null;
  t.customer.push({ id: 602, merchantId: A, name: 'PROPIO-A segundo', phone: '600000121', mobile: null, email: 'propio-a2@example.invalid', taxId: null, notes: null, tags: null });
  t.quote.push(
    suelto(613, A, 601, 'sent'),       // propio, sin aceptar: el control de la aceptación
    suelto(713, B, 702, 'sent'),       // el de B, sin aceptar
    suelto(714, B, 702, 'accepted'),   // el de B, aceptado y sin Trabajo
    suelto(615, A, 702, 'accepted'),   // SEMBRADO: de A, aceptado, con el cliente de B
    suelto(616, A, 702, 'sent'),       // SEMBRADO: de A, sin aceptar, con el cliente de B
  );
  t.job.push(trabajo(505, A, 602, null, null)); // propio, del segundo cliente: el control de la fusión
  return t;
};

// ───────────────────────────── fin del primer bloque COPIADO ─────────────────────────────

// ── EL ALMACÉN DE ESTA PASADA: el de SCRUM-1519b más lo que los creadores necesitan.
const DETECTOR_SORDO = process.argv.includes('--detector-sordo'); // el detector deja de mirar las filas de Presupuesto
let PREP = null; // lo que un caso concreto quita o pone antes de la foto
const LINEA_FIRMADA = { concept: 'Linea firmada', qty: 2, price: 50, tax: 0.21, unit: 'ud' };
const parte = (id, merchantId, jobId) => ({ id, merchantId, jobId, estado: 'firmado', invoiceId: null, numero: 'A-' + id, fecha: cuando, createdAt: cuando, updatedAt: cuando,
  lineas: [{ concepto: 'Linea firmada', unidad: 'ud', cantidad: 1, quoteLineIndex: 0 }, { concepto: 'Trabajo que se sumo en obra', unidad: 'ud', cantidad: 1 }] });
const plan = (id, merchantId, customerId) => ({ id, merchantId, customerId, quoteId: null, title: 'Revision anual ' + id, intervalMonths: 12, active: true,
  nextDueAt: new Date('2026-10-01T09:00:00Z'), lastProposedAt: null, createdAt: cuando, updatedAt: cuando });
const almacen = () => {
  const t = almacenB();
  const mA = t.merchant.find((x) => x.id === A);
  // Las dos puertas de flag se abren en la FILA en memoria del comercio 21: sin ellas el albarán sale
  // 409 (modo recibo) y el mantenimiento se salta el plan antes de mirar nada.
  Object.assign(mA, { flags: { INVOICING_ES_ENABLED: true, MAINTENANCE_ENABLED: true }, whatsappPhone: null, defaultCurrency: 'EUR', nextQuoteNumber: 50,
    quoteSeriesYear: 2026, timezone: 'Europe/Madrid', trade: null, taxId: 'B00000021', email: 'comercio-a@example.invalid', legalName: 'Comercio A SL', address: 'Calle A 1', logoUrl: null });
  const con = (q, extra) => Object.assign(q, extra);
  t.quote.push(
    con(suelto(617, A, 601, 'accepted'), { jobId: 506, lines: [LINEA_FIRMADA] }),  // propio, con líneas: el control del albarán
    con(suelto(618, A, 702, 'accepted'), { jobId: 507, lines: [LINEA_FIRMADA] }),  // SEMBRADO: de A, con el cliente de B y su Trabajo
    suelto(619, A, 602, 'sent'),                                                   // propio, del segundo cliente: el control de la fusión
  );
  for (const q of t.quote) { if (q.revision === undefined) q.revision = 0; if (q.signatureUrl === undefined) q.signatureUrl = null; }
  t.job.push(trabajo(506, A, 601, 617, null));  // propio y sano
  t.job.push(trabajo(507, A, 702, 618, null));  // SEMBRADO: de A, con el cliente de B (lo que fabrica la aceptación de un presupuesto cruzado)
  t.albaran = [parte(801, A, 506), parte(802, A, 507), parte(902, B, 102)];
  t.albaranLineaFacturada = [];
  t.maintenancePlan = [plan(831, A, 601), plan(832, A, 702) /* SEMBRADO: de A, con el cliente de B */, plan(932, B, 702)];
  if (PREP) PREP(t);
  return t;
};

// ── EL DETECTOR: recorre el almacén entero. No mira respuestas ni `where`.
const duenoDe = (m, id) => { const r = tabla(m).find((x) => x.id === id); return r ? r.merchantId : 'NO-EXISTE'; };
const MIRADAS = [['job', 'customer', 'customerId', 'cliente'], ['job', 'quote', 'quoteId', 'presupuesto'], ['quote', 'customer', 'customerId', 'cliente'], ['quote', 'job', 'jobId', 'trabajo'],
  ['maintenancePlan', 'customer', 'customerId', 'cliente'], ['maintenancePlan', 'quote', 'quoteId', 'presupuesto']];
function cruzadas() {
  const out = [];
  for (const [m, destino, fk, nombre] of MIRADAS) for (const r of tabla(m)) {
    if (DETECTOR_SORDO && m === 'quote') continue;
    if (r[fk] != null && duenoDe(destino, r[fk]) !== r.merchantId) out.push(m + ' ' + r.id + ' (comercio ' + r.merchantId + ') → ' + nombre + ' ' + r[fk] + ' (comercio ' + duenoDe(destino, r[fk]) + ')');
  }
  return out;
}
const foto = () => { const o = {}; for (const m of ['job', 'quote', 'maintenancePlan']) for (const r of tabla(m)) o[m + ' ' + r.id] = [r.merchantId, r.customerId, m === 'quote' ? r.jobId : r.quoteId, m === 'maintenancePlan' ? r.active : r.status].join('|'); return o; };
const cambios = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).map((k) => k + ': ' + (a[k] ?? 'no estaba') + ' → ' + (b[k] ?? 'borrada'));

// ── EL PAR SEMBRADO: cinco creadores de presupuesto de mentira.
const S = '/admin/__siembra-1519c';
const nuevo = (req, customerId) => prisma.quote.create({ data: { merchantId: req.merchantId, customerId, quoteNumber: 990000 + siguiente, status: 'draft', total: '0.00', currency: 'EUR', lines: [], revision: 0 } });
if (!SIN_SIEMBRA) {
  // 1 · PUERTA, cruza: una «revisión» que lee el presupuesto por id, sin comercio, y copia su cliente.
  app.post(S + '/revisa/cruza', async (req, res) => {
    const q = await prisma.quote.findUnique({ where: { id: Number(req.params.id || req.body.id) } });
    if (!q) return res.status(404).json({ error: 'not_found' });
    return res.status(201).json(await nuevo(req, q.customerId));
  });
  // 2 · PUERTA, filtra: la misma, atada al comercio.
  app.post(S + '/revisa/filtra', async (req, res) => {
    const q = await prisma.quote.findFirst({ where: { id: Number(req.body.id), merchantId: req.merchantId } });
    if (!q) return res.status(404).json({ error: 'not_found' });
    return res.status(201).json(await nuevo(req, q.customerId));
  });
  // 3 · PUERTA, cruza: un «plan» que comprueba que el cliente EXISTE, no de quién es.
  app.post(S + '/plan/cruza', async (req, res) => {
    const c = await prisma.customer.findUnique({ where: { id: Number(req.body.customerId) } });
    if (!c) return res.status(404).json({ error: 'not_found' });
    return res.status(201).json(await nuevo(req, c.id));
  });
  // 4 · HERENCIA, cruza: lee SU Trabajo (atado al comercio) y copia el cliente sin mirarlo.
  app.post(S + '/hereda/copia', async (req, res) => {
    const j = await prisma.job.findFirst({ where: { id: Number(req.body.jobId), merchantId: req.merchantId } });
    if (!j) return res.status(404).json({ error: 'not_found' });
    return res.status(201).json(await nuevo(req, j.customerId));
  });
  // 5 · HERENCIA, filtra: la misma, pero comprueba de quién es el cliente antes de copiar.
  app.post(S + '/hereda/comprueba', async (req, res) => {
    const j = await prisma.job.findFirst({ where: { id: Number(req.body.jobId), merchantId: req.merchantId } });
    if (!j) return res.status(404).json({ error: 'not_found' });
    const c = await prisma.customer.findFirst({ where: { id: j.customerId, merchantId: req.merchantId } });
    if (!c) return res.status(409).json({ error: 'cliente_ajeno' });
    return res.status(201).json(await nuevo(req, c.id));
  });
}
// ───────────────────────────── COPIADO de SCRUM-1519b (líneas 250-305) ─────────────────────────────
// ── El motor (el de SCRUM-1514c / SCRUM-1519, copiado), más las rutas de un router suelto.
function manosDe(method, ruta, routerSuelto) {
  const m = method.toLowerCase(); const manos = [];
  if (routerSuelto) { for (const layer of routerSuelto.stack) if (layer.route && layer.route.path === ruta && layer.route.methods[m]) manos.push(...layer.route.stack); return manos; }
  for (const layer of app.router.stack) if (layer.route && layer.route.path === ruta && layer.route.methods[m]) manos.push(...layer.route.stack);
  for (const mount of getAdminMounts()) for (const layer of mount.router.stack) {
    if (!layer.route) continue;
    const rel = layer.route.path === '/' ? '' : layer.route.path;
    if (mount.prefix + rel === ruta && layer.route.methods[m]) manos.push(...layer.route.stack);
  }
  return manos;
}
const sesion = () => T.merchant.find((x) => x.id === A);
function peticion(ruta, method, x) {
  return { userRole: 'admin', teamMemberId: null, isOwner: true, merchantId: A, merchant: { ...sesion(), plan: 'pro', status: 'active' },
    params: x.params || {}, query: x.query || {}, body: x.body || {}, headers: { 'user-agent': 'scrum-1519b' }, method, path: ruta, originalUrl: ruta, url: ruta,
    ip: '127.0.0.1', cookies: {}, get() { return undefined; }, header() { return undefined; }, socket: { remoteAddress: '127.0.0.1' }, app };
}
async function pedir(manos, req) {
  let estado = 200; let acabado = false; let cuerpo;
  const res = new PassThrough(); res.on('error', () => {}); res.resume();
  const fina = (x) => { if (!acabado) cuerpo = x; acabado = true; return res; };
  res.status = (n) => { estado = n; return res; }; res.sendStatus = (n) => { estado = n; return fina(); };
  res.json = (x) => fina(x); res.send = (x) => fina(x);
  res.set = () => res; res.setHeader = () => res; res.header = () => res; res.type = () => res;
  res.attachment = () => res; res.cookie = () => res; res.locals = {};
  res.redirect = (a) => { estado = typeof a === 'number' ? a : 302; return fina(); };
  res.sendFile = () => fina(); res.download = () => fina();
  let error = null; const m = req.method.toLowerCase();
  try {
    for (const s of manos) {
      if (s.method && s.method !== m) continue;
      let sigue = false;
      await Promise.race([(async () => { await s.handle(req, res, (e) => { if (e) error = e; else sigue = true; }); })(), new Promise((ok) => setTimeout(ok, 4000))]);
      for (let i = 0; i < 20 && !sigue && !acabado && !error; i++) await new Promise((ok) => setTimeout(ok, 25));
      if (!sigue || error || acabado) break;
    }
  } catch (e) { error = e; }
  return { estado: error && !acabado ? 'EXC' : estado, acabado, error: error ? String(error.message || error).slice(0, 160) : null, cuerpo };
}
const texto = (x) => { try { return typeof x === 'string' ? x : JSON.stringify(x) || ''; } catch { return ''; } };
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Un caso: almacén nuevo, foto, se ejecuta, se ESPERA (ensureJobForQuote va sin await en las rutas), foto.
async function caso(hacer) {
  T = almacen(); apuntes = []; noEvaluado = []; escritasAjenas = []; const f0 = fugas.length; const m0 = aMeta.length;
  const antes = foto(); const cruzadasAntes = cruzadas();
  let out = { estado: '—', error: null, cuerpo: undefined, manos: 1 };
  try { out = { ...out, ...(await hacer()) }; } catch (e) { out.estado = 'EXC'; out.error = String(e && e.message || e).slice(0, 160); }
  await espera(250);
  const nuevas = cruzadas().filter((x) => !cruzadasAntes.includes(x)); const cambiadas = cambios(antes, foto());
  const v = nuevas.length ? 'CRUZA' : cambiadas.length ? 'ESCRIBE-LIMPIO' : 'NO-ESCRIBE';
  return { v, estado: out.estado, error: out.error, cuerpo: out.cuerpo, manos: out.manos, nuevas, cambiadas, sembradas: cruzadasAntes.length,
    escritasAjenas: escritasAjenas.slice(), noEvaluado: [...new Set(noEvaluado)], fugas: fugas.length - f0, envios: aMeta.length - m0 };
}
const porRuta = (method, ruta, x, routerSuelto) => async () => { const manos = manosDe(method, ruta, routerSuelto); const o = await pedir(manos, peticion(ruta, method, x || {})); return { ...o, manos: manos.length }; };
// ───────────────────────────── fin del segundo bloque COPIADO ─────────────────────────────

let mal = 0; let ciegos = 0; let cruzan = 0; const resumen = [];
const linea = (et, r) => '    ' + et.padEnd(74) + ' → ' + String(r.estado).padEnd(4) + ' ' + r.v.padEnd(15)
  + (r.nuevas.length ? ' CRUZADA NUEVA: ' + r.nuevas.join(' ; ') : '') + (r.cambiadas.length ? ' · cambió: ' + r.cambiadas.join(' ; ').slice(0, 260) : '')
  + (r.estado !== 200 && r.estado !== 201 && r.cuerpo ? ' · dijo: ' + texto(r.cuerpo).slice(0, 150) : '') + (r.error ? ' · error: ' + r.error : '')
  + (r.escritasAjenas.length ? ' · ⚠️ ESCRIBIÓ FILA DE B: ' + r.escritasAjenas.join(';') : '') + (r.noEvaluado.length ? ' · where no evaluado: ' + r.noEvaluado.join(',') : '')
  + (r.fugas || r.envios ? ' · ⚠️ fugas ' + r.fugas + ' envíos ' + r.envios : '');

console.log('SCRUM-1519c · los creadores de presupuesto, por efecto · sesión: administrador del comercio ' + A + ' · lo ajeno es del comercio ' + B + (SORDO || DETECTOR_SORDO ? ' · ⚠️ SORDO: esto es el rojo, no una medición' : ''));
{
  T = almacen();
  console.log('POBLACION: almacén: ' + Object.entries(T).map(([k, v]) => k + ' ' + v.length).join(', ') + ' · filas cruzadas SEMBRADAS de partida: ' + cruzadas().length + ' · modelos doblados ' + modelos.length);
  for (const x of cruzadas()) console.log('    sembrada: ' + x);
}

// ── 1 · EL PAR SEMBRADO
const SIEMBRA = [
  ['revisa/cruza', { id: 713 }, 'CRUZA'], ['revisa/cruza', { id: 613 }, 'ESCRIBE-LIMPIO'],
  ['revisa/filtra', { id: 713 }, 'NO-ESCRIBE'], ['revisa/filtra', { id: 613 }, 'ESCRIBE-LIMPIO'],
  ['plan/cruza', { customerId: 702 }, 'CRUZA'], ['plan/cruza', { customerId: 601 }, 'ESCRIBE-LIMPIO'],
  ['hereda/copia', { jobId: 507 }, 'CRUZA'], ['hereda/copia', { jobId: 506 }, 'ESCRIBE-LIMPIO'],
  ['hereda/comprueba', { jobId: 507 }, 'NO-ESCRIBE'], ['hereda/comprueba', { jobId: 506 }, 'ESCRIBE-LIMPIO'],
];
console.log('\n── 1 · EL PAR SEMBRADO (' + (SIN_SIEMBRA ? 'QUITADO' : '5 creadores de mentira, ' + SIEMBRA.length + ' casos') + ')');
if (!SIN_SIEMBRA) for (const [r, body, esperado] of SIEMBRA) {
  const x = await caso(porRuta('POST', S + '/' + r, { body }));
  const ok = x.v === esperado && x.manos > 0; if (!ok) mal += 1;
  console.log(linea((ok ? '✓ ' : '✗ ') + r + ' ' + JSON.stringify(body) + ' espera ' + esperado, x));
}

// ── 2 · LOS CREADORES REALES. clase: control (TIENE que escribir limpio) · puerta · herencia
async function mide(titulo, sitio, casos) {
  console.log('\n── ' + titulo + '  ·  ' + sitio);
  const fila = { creador: titulo, sitio, control: '—', puerta: [], herencia: [] };
  for (const [clase, et, hacer, prep] of casos) {
    PREP = prep || null;
    const r = await caso(hacer);
    PREP = null;
    if (!r.manos) { ciegos += 1; console.log('    ⚠️ CIEGO: la ruta no existe en la app: ' + et); }
    if (clase === 'control') {
      const creo = r.cambiadas.some((c) => /^quote \d+: no estaba/.test(c)) || fila.creador.includes('MUEVE') || fila.creador.includes('AGUAS ARRIBA');
      fila.control = r.v + ' ' + r.estado + (creo ? '' : ' (SIN presupuesto nuevo)');
      if (r.v !== 'ESCRIBE-LIMPIO' || !creo) { ciegos += 1; console.log('    ⚠️ EL CONTROL NO CREA: lo de debajo no dice nada'); }
    } else fila[clase].push(r.v);
    if (clase === 'puerta' && r.v === 'CRUZA') cruzan += 1;
    console.log(linea(clase.toUpperCase().slice(0, 1) + ' · ' + et, r));
  }
  resumen.push(fila);
}
const { crearRevisionDeQuote } = await de('modules/system/quoteAdmin.js');
const { runMaintenanceProposals } = await de('modules/maintenance/domain/maintenance.service.js');
const directa = (f) => async () => { const r = await f(); return { estado: 'fn', manos: 1, cuerpo: r }; };
const REVISAR = '/admin/quotes/:id/revisiones'; const CONVERTIR = '/admin/albaranes/:id/convertir-en-factura';
const PLAN = '/admin/maintenance'; const FUSIONAR = '/admin/customers/:id/fusionar';
const MEDIODIA = new Date('2026-10-13T10:00:00Z'); // 12:00 en Madrid: fuera del horario de silencio del ciclo
const soloElPlan = (id) => (t) => { t.maintenancePlan = t.maintenancePlan.filter((p) => p.id === id); };
const cuerpoPlan = (customerId, quoteId) => ({ customerId, quoteId: quoteId ?? null, title: 'Revision anual', intervalMonths: 12 });

await mide('CREADOR A · la revisión de un presupuesto (crearRevisionDeQuote → quote.create)', 'quoteAdmin.ts:593, llamado desde quotesAdmin.routes.ts:481', [
  ['control', 'POST revisiones del 613 (propio, cliente propio)', porRuta('POST', REVISAR, { params: { id: '613' } })],
  ['puerta', 'POST revisiones del 713 (presupuesto de B)', porRuta('POST', REVISAR, { params: { id: '713' } })],
  ['puerta', 'crearRevisionDeQuote(21, 713) a pelo, sin la ruta', directa(() => crearRevisionDeQuote(A, 713))],
  ['herencia', 'POST revisiones del 616 (de A, SEMBRADO con cliente de B)', porRuta('POST', REVISAR, { params: { id: '616' } })],
  ['herencia', 'crearRevisionDeQuote(21, 615) a pelo (de A, SEMBRADO con cliente de B)', directa(() => crearRevisionDeQuote(A, 615))],
]);
await mide('CREADOR B · el adicional del albarán (convertir-en-factura → quote.create)', 'albaranes.routes.ts:1641', [
  ['control', 'POST convertir el parte 801 (propio, Trabajo 506 sano, 1 línea fuera de presupuesto)', porRuta('POST', CONVERTIR, { params: { id: '801' } })],
  ['puerta', 'POST convertir el parte 902 (de B)', porRuta('POST', CONVERTIR, { params: { id: '902' } })],
  ['herencia', 'POST convertir el parte 802 (propio; su Trabajo 507 SEMBRADO con cliente de B)', porRuta('POST', CONVERTIR, { params: { id: '802' } })],
]);
await mide('CREADOR C · el ciclo de mantenimiento (runMaintenanceProposals → quote.create)', 'maintenance.service.ts:413 (cron; no hay sesión: recorre todos los comercios)', [
  ['control', 'ciclo con sólo el plan 831 (de A, cliente propio)', directa(() => runMaintenanceProposals(MEDIODIA)), soloElPlan(831)],
  ['herencia', 'ciclo con sólo el plan 832 (de A, SEMBRADO con cliente de B)', directa(() => runMaintenanceProposals(MEDIODIA)), soloElPlan(832)],
]);
await mide('  AGUAS ARRIBA del C · crear el plan (¿se puede FABRICAR el 832?)', 'maintenance.routes.ts:60, POST /admin/maintenance', [
  ['control', 'POST plan con cliente propio (601)', porRuta('POST', PLAN, { body: cuerpoPlan(601) })],
  ['puerta', 'POST plan con el cliente de B (702)', porRuta('POST', PLAN, { body: cuerpoPlan(702) })],
  ['puerta', 'POST plan con cliente propio y el presupuesto de B (712)', porRuta('POST', PLAN, { body: cuerpoPlan(601, 712) })],
]);
await mide('MUEVE · fusionar clientes (quote.updateMany; no crea, cambia Quote.customerId)', 'fusionClientes.ts:177', [
  ['control', 'POST fusionar 601 ← 602 (los dos propios; el presupuesto 619 es del 602)', porRuta('POST', FUSIONAR, { params: { id: '601' }, body: { con: 602 } })],
  ['puerta', 'POST fusionar 702 ← 602 (el que QUEDA es de B)', porRuta('POST', FUSIONAR, { params: { id: '702' }, body: { con: 602 } })],
  ['puerta', 'POST fusionar 601 ← 702 (el que DESAPARECE es de B)', porRuta('POST', FUSIONAR, { params: { id: '601' }, body: { con: 702 } })],
]);

console.log('\n── RESUMEN · una fila por creador');
console.log('  creador | sitio | control propio | P por la puerta | D con el dato ya cruzado');
for (const f of resumen) console.log('  ' + [f.creador.trim(), f.sitio, f.control, f.puerta.join(', ') || 'no aplica', f.herencia.join(', ') || 'no aplica'].join(' | '));
const heredan = resumen.filter((f) => f.herencia.includes('CRUZA')).length;
console.log('\n  filas ' + resumen.length + ' (3 creadores, 1 aguas arriba y 1 que mueve) · dejan una fila cruzada pidiéndoselo por la PUERTA ' + cruzan + ' · COPIAN un dato que ya venía cruzado ' + heredan
  + ' · envíos a Meta ' + aMeta.length + ' · intentos de red ' + fugas.length);

if (SIN_SIEMBRA) fin(2, '\nCIEGO: sin el par sembrado esta pasada no distingue «no cruza» de «no veo».');
if (mal) fin(1, '\nROJO: ' + mal + ' caso(s) del par sembrado no salen como deben: lo de arriba NO vale.');
if (ciegos) fin(2, '\nCIEGO: ' + ciegos + ' control(es) propios no crean.');
fin(0, '\nEl par sembrado se separa (' + SIEMBRA.length + ' de ' + SIEMBRA.length + ') y los controles propios crean.');
