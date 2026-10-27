// SCRUM-1519b · Los ESCRITORES de `Job.customerId` y `Job.quoteId`, POR EFECTO.
//
// QUÉ SE PREGUNTA, para cada escritor: ¿puede dejar una fila de Trabajo apuntando al cliente o al
// presupuesto de OTRO comercio? Sesión del comercio 21, recurso del 22. Son dos preguntas:
//   P · LA PUERTA: se le pide al escritor, por su ruta real, que use lo de B. ¿Queda una fila cruzada?
//   D · LA HERENCIA: el dato del que el escritor COPIA ya viene cruzado (SEMBRADO por este fichero).
//       ¿Lo copia tal cual al Trabajo? Si lo copia, el escritor no comprueba: hereda.
//
// CÓMO: manejadores y funciones reales de dist/, sin HTTP y sin base. Prisma doblado por el ALMACÉN
// en memoria de SCRUM-1519 (medir-los-llamadores.mjs, copiado tal cual: aplica el `where` ENTERO).
// EL VEREDICTO NO SALE DE LA RESPUESTA: sale del ALMACÉN. Después de cada caso se recorren TODAS las
// filas de Trabajo y de Presupuesto y se compara el comercio de la fila con el comercio de aquello a
// lo que apunta. Lo que cuenta son las filas cruzadas NUEVAS respecto de las sembradas.
//
// VEREDICTOS:  CRUZA            hay una fila cruzada que antes no estaba
//              ESCRIBE-LIMPIO   cambió alguna fila de Trabajo o de Presupuesto y ninguna quedó cruzada
//              NO-ESCRIBE       no cambió ninguna fila de Trabajo ni de Presupuesto
//
// EL PAR SEMBRADO: cinco escritores de mentira montados en memoria sobre la app (no existen en src/
// ni en dist/). Tres cruzan (por cliente, por presupuesto y moviendo en lote) y dos filtran. Si no
// salen como deben, sale 1. `--doble-sordo` (el almacén ata TODA consulta al comercio de la sesión)
// tiene que salir 1. `--sin-siembra`, 2 (CIEGO). Y cada escritor real lleva su CONTROL PROPIO: con
// recursos del 21 TIENE que escribir; si no escribe, el «no cruza» de las otras filas no dice nada.
//
// Uso: node medir-los-escritores.mjs <raíz del árbol, con dist/ y src/> [--doble-sordo] [--sin-siembra]
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
const almacen = () => {
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

// ── EL DETECTOR: recorre el almacén entero. No mira respuestas ni `where`.
const duenoDe = (m, id) => { const r = tabla(m).find((x) => x.id === id); return r ? r.merchantId : 'NO-EXISTE'; };
function cruzadas() {
  const out = [];
  for (const j of tabla('job')) {
    if (j.customerId != null && duenoDe('customer', j.customerId) !== j.merchantId) out.push('job ' + j.id + ' (comercio ' + j.merchantId + ') → cliente ' + j.customerId + ' (comercio ' + duenoDe('customer', j.customerId) + ')');
    if (j.quoteId != null && duenoDe('quote', j.quoteId) !== j.merchantId) out.push('job ' + j.id + ' (comercio ' + j.merchantId + ') → presupuesto ' + j.quoteId + ' (comercio ' + duenoDe('quote', j.quoteId) + ')');
  }
  for (const q of tabla('quote')) {
    if (q.customerId != null && duenoDe('customer', q.customerId) !== q.merchantId) out.push('quote ' + q.id + ' (comercio ' + q.merchantId + ') → cliente ' + q.customerId + ' (comercio ' + duenoDe('customer', q.customerId) + ')');
    if (q.jobId != null && duenoDe('job', q.jobId) !== q.merchantId) out.push('quote ' + q.id + ' (comercio ' + q.merchantId + ') → trabajo ' + q.jobId + ' (comercio ' + duenoDe('job', q.jobId) + ')');
  }
  return out;
}
const foto = () => { const o = {}; for (const m of ['job', 'quote']) for (const r of tabla(m)) o[m + ' ' + r.id] = [r.merchantId, r.customerId, m === 'job' ? r.quoteId : r.jobId, r.status].join('|'); return o; };
const cambios = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).map((k) => k + ': ' + (a[k] ?? 'no estaba') + ' → ' + (b[k] ?? 'borrada'));

// ── EL PAR SEMBRADO: cinco escritores de mentira.
const S = '/admin/__siembra-1519b';
if (!SIN_SIEMBRA) {
  // 1 · tiene la forma de la fuga: comprueba que el cliente EXISTE, no de quién es.
  app.post(S + '/crea/cruza', async (req, res) => {
    const c = await prisma.customer.findUnique({ where: { id: Number(req.body.customerId) } });
    if (!c) return res.status(404).json({ error: 'not_found' });
    return res.status(201).json(await prisma.job.create({ data: { merchantId: req.merchantId, customerId: c.id, quoteId: null, status: 'agendado' } }));
  });
  // 2 · lo mismo, atado al comercio.
  app.post(S + '/crea/filtra', async (req, res) => {
    const c = await prisma.customer.findFirst({ where: { id: Number(req.body.customerId), merchantId: req.merchantId } });
    if (!c) return res.status(404).json({ error: 'not_found' });
    return res.status(201).json(await prisma.job.create({ data: { merchantId: req.merchantId, customerId: c.id, quoteId: null, status: 'agendado' } }));
  });
  // 3 · cruza SÓLO por el presupuesto: el cliente es propio. Si el detector no mirase quoteId, callaría.
  app.post(S + '/crea/cruza-por-presupuesto', async (req, res) => {
    const q = await prisma.quote.findUnique({ where: { id: Number(req.body.quoteId) } });
    if (!q) return res.status(404).json({ error: 'not_found' });
    return res.status(201).json(await prisma.job.create({ data: { merchantId: req.merchantId, customerId: 601, quoteId: q.id, status: 'agendado' } }));
  });
  // 4 · una fusión de mentira que comprueba que los dos clientes EXISTEN, no de quién son.
  app.post(S + '/mueve/cruza', async (req, res) => {
    const [a, b] = [await prisma.customer.findUnique({ where: { id: Number(req.body.a) } }), await prisma.customer.findUnique({ where: { id: Number(req.body.de) } })];
    if (!a || !b) return res.status(409).json({ error: 'cliente_no_encontrado' });
    return res.json(await prisma.job.updateMany({ where: { merchantId: req.merchantId, customerId: b.id }, data: { customerId: a.id } }));
  });
  // 5 · la misma, atada.
  app.post(S + '/mueve/filtra', async (req, res) => {
    const [a, b] = [await prisma.customer.findFirst({ where: { id: Number(req.body.a), merchantId: req.merchantId } }), await prisma.customer.findFirst({ where: { id: Number(req.body.de), merchantId: req.merchantId } })];
    if (!a || !b) return res.status(409).json({ error: 'cliente_no_encontrado' });
    return res.json(await prisma.job.updateMany({ where: { merchantId: req.merchantId, customerId: b.id }, data: { customerId: a.id } }));
  });
}

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

let mal = 0; let ciegos = 0; let cruzan = 0; const resumen = [];
const linea = (et, r) => '    ' + et.padEnd(66) + ' → ' + String(r.estado).padEnd(4) + ' ' + r.v.padEnd(15)
  + (r.nuevas.length ? ' CRUZADA NUEVA: ' + r.nuevas.join(' ; ') : '') + (r.cambiadas.length ? ' · cambió: ' + r.cambiadas.join(' ; ').slice(0, 230) : '')
  + (r.estado !== 200 && r.estado !== 201 && r.cuerpo ? ' · dijo: ' + texto(r.cuerpo).slice(0, 90) : '') + (r.error ? ' · error: ' + r.error : '')
  + (r.escritasAjenas.length ? ' · ⚠️ ESCRIBIÓ FILA DE B: ' + r.escritasAjenas.join(';') : '') + (r.noEvaluado.length ? ' · where no evaluado: ' + r.noEvaluado.join(',') : '')
  + (r.fugas || r.envios ? ' · ⚠️ fugas ' + r.fugas + ' envíos ' + r.envios : '');

console.log('SCRUM-1519b · los escritores de Job.customerId y Job.quoteId, por efecto · sesión: administrador del comercio ' + A + ' · lo ajeno es del comercio ' + B + (SORDO ? ' · ⚠️ DOBLE SORDO: esto es el rojo, no una medición' : ''));
{
  const t = almacen(); T = t;
  console.log('POBLACION: almacén: ' + Object.entries(t).map(([k, v]) => k + ' ' + v.length).join(', ') + ' · filas cruzadas SEMBRADAS de partida: ' + cruzadas().length + ' · modelos doblados ' + modelos.length);
  for (const x of cruzadas()) console.log('    sembrada: ' + x);
}

// ── 0 · EL CENSO DE ESCRITORES, por texto (NO es AST): toda llamada que escribe en `job` o en `quote`.
console.log('\n── 0 · QUIÉN ESCRIBE (censo por TEXTO sobre src/, comentarios fuera; no es AST)');
const RE = /\.(job|quote)\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|upsert)\s*\(/g;
function censa(fuente) {
  const out = []; const lineas = fuente.split('\n');
  lineas.forEach((l, i) => { const t = l.trim(); if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return; RE.lastIndex = 0; let m; while ((m = RE.exec(l))) {
    // el argumento: desde el paréntesis hasta que se equilibra
    let prof = 0; let fin = -1; const resto = lineas.slice(i).join('\n'); const ini = resto.indexOf(m[0]) + m[0].length - 1;
    for (let k = ini; k < resto.length && k < ini + 6000; k++) { if (resto[k] === '(') prof++; else if (resto[k] === ')') { prof--; if (!prof) { fin = k; break; } } }
    const arg = fin > 0 ? resto.slice(ini, fin + 1) : '';
    const dato = /data:\s*\{/.test(arg) ? (/\b(customerId|quoteId)\b\s*[:,}]/.test(arg.slice(arg.search(/data:\s*\{/))) ? 'NOMBRA customerId/quoteId' : 'no los nombra') : 'data EN VARIABLE o función';
    out.push({ linea: i + 1, modelo: m[1], op: m[2], dato });
  } });
  return out;
}
{
  const FALSA = ['// tx.job.update({ data: { customerId: 1 } }) en un comentario', 'await tx.job.upsert({ where: { id }, create: {}, update: {}, data: { customerId: x } });', 'await db.quote.update({ where: { id }, data: { status: s } });', 'await db.job.create({ data });'].join('\n');
  const c = censa(FALSA); const okCenso = !SIN_SIEMBRA && c.length === 3 && c[0].dato.startsWith('NOMBRA') && c[1].dato === 'no los nombra' && c[2].dato.startsWith('data EN');
  console.log('    control sembrado del censo (fuente de mentira: 1 comentario + 3 llamadas): ' + (SIN_SIEMBRA ? 'QUITADO' : c.length + ' de 3 · ' + c.map((x) => x.dato).join(' | ') + (okCenso ? ' ✓' : ' ✗')));
  if (!SIN_SIEMBRA && !okCenso) mal += 1;
  const fich = []; const anda = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) anda(p); else if (e.name.endsWith('.ts')) fich.push(p); } };
  anda(path.join(raiz, 'src'));
  let n = 0; const porModelo = { job: [], quote: [] };
  for (const f of fich) for (const x of censa(fs.readFileSync(f, 'utf8'))) { n += 1; porModelo[x.modelo].push(path.relative(raiz, f).replace(/\\/g, '/') + ':' + x.linea + ' ' + x.op + ' · ' + x.dato); }
  console.log('    población: ' + fich.length + ' ficheros .ts · llamadas que escriben: ' + n + ' (job ' + porModelo.job.length + ', quote ' + porModelo.quote.length + ')');
  if (fich.length < 100 || !porModelo.job.length) { ciegos += 1; console.log('    ⚠️ CIEGO: el censo no ve src/'); }
  for (const m of ['job', 'quote']) { console.log('    ' + m + ':'); for (const x of porModelo[m]) if (m === 'job' || !x.endsWith('no los nombra')) console.log('      ' + x); }
  console.log('    (de quote sólo se listan las que nombran customerId o llevan data en variable; las demás, ' + porModelo.quote.filter((x) => x.endsWith('no los nombra')).length + ', no los nombran)');
}

// ── 1 · EL PAR SEMBRADO
const SIEMBRA = [
  ['crea/cruza', { customerId: 702 }, 'CRUZA'], ['crea/cruza', { customerId: 601 }, 'ESCRIBE-LIMPIO'],
  ['crea/filtra', { customerId: 702 }, 'NO-ESCRIBE'], ['crea/filtra', { customerId: 601 }, 'ESCRIBE-LIMPIO'],
  ['crea/cruza-por-presupuesto', { quoteId: 712 }, 'CRUZA'], ['crea/cruza-por-presupuesto', { quoteId: 613 }, 'ESCRIBE-LIMPIO'],
  ['mueve/cruza', { a: 702, de: 602 }, 'CRUZA'], ['mueve/cruza', { a: 601, de: 602 }, 'ESCRIBE-LIMPIO'],
  ['mueve/filtra', { a: 702, de: 602 }, 'NO-ESCRIBE'], ['mueve/filtra', { a: 601, de: 602 }, 'ESCRIBE-LIMPIO'],
];
console.log('\n── 1 · EL PAR SEMBRADO (' + (SIN_SIEMBRA ? 'QUITADO' : '5 escritores de mentira, ' + SIEMBRA.length + ' casos') + ')');
if (!SIN_SIEMBRA) for (const [r, body, esperado] of SIEMBRA) {
  const x = await caso(porRuta('POST', S + '/' + r, { body }));
  const ok = x.v === esperado && x.manos > 0; if (!ok) mal += 1;
  console.log(linea((ok ? '✓ ' : '✗ ') + r + ' ' + JSON.stringify(body) + ' espera ' + esperado, x));
}

// ── 2 · LOS ESCRITORES REALES. clase: control (TIENE que escribir limpio) · puerta · herencia
async function mide(titulo, sitio, casos) {
  console.log('\n── ' + titulo + '  ·  ' + sitio);
  const fila = { escritor: titulo, sitio, control: '—', puerta: [], herencia: [] };
  for (const [clase, et, hacer] of casos) {
    const r = await caso(hacer);
    if (!r.manos) { ciegos += 1; console.log('    ⚠️ CIEGO: la ruta no existe en la app: ' + et); }
    if (clase === 'control') { fila.control = r.v + ' ' + r.estado; if (r.v !== 'ESCRIBE-LIMPIO') { ciegos += 1; console.log('    ⚠️ EL CONTROL NO ESCRIBE: lo de debajo no dice nada'); } }
    else fila[clase].push(r.v);
    if (clase === 'puerta' && r.v === 'CRUZA') cruzan += 1;
    console.log(linea(clase.toUpperCase().slice(0, 1) + ' · ' + et, r));
  }
  resumen.push(fila);
}
const { ensureJobForQuote } = await de('modules/jobs/domain/job.service.js');
const { fusionarClientes } = await de('modules/system/domain/fusionClientes.js');
const routerQuotes = (await de('modules/quotes/app/routes/quotes.routes.js')).default;
const rq = routerQuotes && routerQuotes.default ? routerQuotes.default : routerQuotes;
const directa = (f) => async () => { await f(); return { estado: 'fn', manos: 1 }; };
const fusion = (a, de2) => async () => { try { const r = await fusionarClientes(A, a, de2); return { estado: 'fn', manos: 1, cuerpo: r }; } catch (e) { return { estado: 'fn', manos: 1, cuerpo: { lanza: String(e.message) } }; } };
const ACEPTAR = '/admin/quotes/:id/accept'; const FUSIONAR = '/admin/customers/:id/fusionar';
const cuerpoQuote = (customer_id) => ({ merchant_id: A, customer_id, currency: 'EUR', lines: [{ concept: 'Trabajo de prueba', qty: 1, price: 100, tax: 0.21 }] });

await mide('ESCRITOR 2 · aceptar un presupuesto (ensureJobForQuote → job.create)', 'job.service.ts:101, llamado desde quotesAdmin.routes.ts:151', [
  ['control', 'POST accept del 613 (propio, cliente propio)', porRuta('POST', ACEPTAR, { params: { id: '613' } })],
  ['puerta', 'POST accept del 713 (presupuesto de B)', porRuta('POST', ACEPTAR, { params: { id: '713' } })],
  ['puerta', 'ensureJobForQuote(714) a pelo (de B, aceptado, sin Trabajo)', directa(() => ensureJobForQuote(714))],
  ['herencia', 'ensureJobForQuote(615) a pelo (de A, SEMBRADO con cliente de B)', directa(() => ensureJobForQuote(615))],
  ['herencia', 'POST accept del 616 (de A, SEMBRADO con cliente de B)', porRuta('POST', ACEPTAR, { params: { id: '616' } })],
]);
await mide('  AGUAS ARRIBA del 2 · crear el presupuesto (¿se puede FABRICAR el 615?)', 'quotes.routes.ts:192, POST /quote/create', [
  ['control', 'POST /quote/create con cliente propio (601)', porRuta('POST', '/create', { body: cuerpoQuote(601) }, rq)],
  ['puerta', 'POST /quote/create con el cliente de B (702)', porRuta('POST', '/create', { body: cuerpoQuote(702) }, rq)],
  ['puerta', 'POST /quote/create con merchant_id de B y cliente de B', porRuta('POST', '/create', { body: { ...cuerpoQuote(702), merchant_id: B } }, rq)],
]);
await mide('ESCRITOR 3 · fusionar clientes (job.updateMany)', 'fusionClientes.ts:178, llamado desde customersAdmin.routes.ts:661', [
  ['control', 'POST fusionar 601 ← 602 (los dos propios; el Trabajo 505 es del 602)', porRuta('POST', FUSIONAR, { params: { id: '601' }, body: { con: 602 } })],
  ['puerta', 'POST fusionar 702 ← 602 (el que QUEDA es de B)', porRuta('POST', FUSIONAR, { params: { id: '702' }, body: { con: 602 } })],
  ['puerta', 'POST fusionar 601 ← 702 (el que DESAPARECE es de B)', porRuta('POST', FUSIONAR, { params: { id: '601' }, body: { con: 702 } })],
  ['puerta', 'fusionarClientes(21, 702, 602) a pelo, sin la ruta', fusion(702, 602)],
  ['puerta', 'fusionarClientes(21, 601, 702) a pelo, sin la ruta', fusion(601, 702)],
]);

console.log('\n── RESUMEN · una fila por escritor');
console.log('  escritor | sitio | control propio | P por la puerta | D con el dato ya cruzado');
for (const f of resumen) console.log('  ' + [f.escritor.trim(), f.sitio, f.control, f.puerta.join(', ') || '—', f.herencia.join(', ') || 'no aplica'].join(' | '));
const heredan = resumen.filter((f) => f.herencia.includes('CRUZA')).length;
console.log('\n  filas ' + resumen.length + ' (2 escritores y 1 aguas arriba) · dejan una fila cruzada pidiéndoselo por la PUERTA ' + cruzan + ' · COPIAN un dato que ya venía cruzado ' + heredan
  + ' · envíos a Meta ' + aMeta.length + ' · intentos de red ' + fugas.length);

if (SIN_SIEMBRA) fin(2, '\nCIEGO: sin el par sembrado esta pasada no distingue «no cruza» de «no veo».');
if (mal) fin(1, '\nROJO: ' + mal + ' caso(s) del par sembrado no salen como deben: lo de arriba NO vale.');
if (ciegos) fin(2, '\nCIEGO: ' + ciegos + ' control(es) propios no escriben.');
fin(0, '\nEl par sembrado se separa (' + SIEMBRA.length + ' de ' + SIEMBRA.length + ', más el del censo) y los controles propios escriben.');
