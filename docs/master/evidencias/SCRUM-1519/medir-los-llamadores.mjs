// SCRUM-1519 · Los llamadores de `serializeJob`, uno a uno, POR EFECTO.
//
// QUÉ SE PREGUNTA, y son DOS preguntas distintas por llamador:
//   P · LA PUERTA: la sesión del comercio A pide lo de B por esa ruta. ¿Sale algo de B?
//   D · LA DEPENDENCIA: el Trabajo es de A, pero su fila apunta a algo de B (cliente, presupuesto,
//       operario). Ese estado NO lo puede fabricar hoy ninguna ruta medida: lo SIEMBRA este fichero
//       en su almacén. ¿La ruta entrega lo de B? Si lo entrega, la ruta no comprueba: CONFÍA en que
//       quien escribió la fila comprobó. Eso es lo que el ticket llama «la forma».
//
// CÓMO: manejadores reales de dist/, sin HTTP y sin base. Prisma doblado por un ALMACÉN en memoria
// con dos comercios y filas de verdad, que aplica el `where` ENTERO (id, comercio, in, AND/OR/NOT,
// relaciones a un salto). No mira si el where «lleva comercio»: devuelve la fila que casa, como una
// base. El veredicto sale de lo que VUELVE: todo lo de B lleva una marca y se busca en la respuesta.
//
// VEREDICTOS:  ENTREGA-AJENO            la respuesta lleva una marca de B
//              ESCRIBE-AJENO            cambió una fila de B
//              LEE-AJENO-Y-NO-ENTREGA   alguna consulta devolvió una fila de B, y no salió
//              NADA-AJENO               ninguna consulta devolvió nada de B
//
// EL PAR SEMBRADO: cuatro rutas de mentira montadas en memoria sobre la app (no existen en src/ ni
// en dist/), que pasan por el mismo motor. Si no salen como deben, sale 1. `--doble-sordo` (el
// almacén ata TODA consulta al comercio de la sesión) tiene que salir 1. `--sin-siembra`, 2 (CIEGO).
//
// Uso: node medir-los-llamadores.mjs <raíz del árbol, con dist/> [--doble-sordo] [--sin-siembra]
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

// ── EL PAR SEMBRADO: cuatro rutas de mentira. La 2 tiene EXACTAMENTE la forma de serializeJob.
const S = '/admin/__siembra-1519/trabajo/:id';
const idDe = (req) => Number(req.params.id);
if (!SIN_SIEMBRA) {
  app.get(S + '/cruza', async (req, res) => {
    const j = await prisma.job.findUnique({ where: { id: idDe(req) } });
    if (!j) return res.status(404).json({ error: 'not_found' });
    return res.json({ id: j.id, customer: await prisma.customer.findUnique({ where: { id: j.customerId }, select: { name: true, phone: true } }) });
  });
  app.get(S + '/filtra-y-confia', async (req, res) => {
    const j = await prisma.job.findFirst({ where: { id: idDe(req), merchantId: req.merchantId } });
    if (!j) return res.status(404).json({ error: 'not_found' });
    return res.json({ id: j.id, customer: await prisma.customer.findUnique({ where: { id: j.customerId }, select: { name: true, phone: true } }) });
  });
  app.get(S + '/filtra-todo', async (req, res) => {
    const j = await prisma.job.findFirst({ where: { id: idDe(req), merchantId: req.merchantId } });
    if (!j) return res.status(404).json({ error: 'not_found' });
    return res.json({ id: j.id, customer: await prisma.customer.findFirst({ where: { id: j.customerId, merchantId: req.merchantId }, select: { name: true, phone: true } }) });
  });
  app.get(S + '/lee-y-calla', async (req, res) => {
    const j = await prisma.job.findFirst({ where: { id: idDe(req), merchantId: req.merchantId } });
    if (!j) return res.status(404).json({ error: 'not_found' });
    await prisma.customer.findUnique({ where: { id: j.customerId } });
    return res.json({ id: j.id });
  });
}

// ── El motor (el del censo de SCRUM-1514, copiado de medir-las-25.mjs)
function manosDe(method, ruta) {
  const m = method.toLowerCase(); const manos = [];
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
    params: x.params || {}, query: x.query || {}, body: x.body || {}, headers: { 'user-agent': 'scrum-1519' }, method, path: ruta, originalUrl: ruta, url: ruta,
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
const marcasEn = (x) => { const s = texto(x); return MARCAS_B.filter((k) => s.includes(k)); };

async function corre(method, ruta, x) {
  T = almacenNuevo(); apuntes = []; noEvaluado = []; escritasAjenas = []; const f0 = fugas.length; const m0 = aMeta.length;
  const manos = manosDe(method, ruta);
  const out = await pedir(manos, peticion(ruta, method, x || {}));
  const marcas = marcasEn(out.cuerpo); const leidas = apuntes.filter((a) => a.ajenas > 0);
  const v = marcas.length ? 'ENTREGA-AJENO' : escritasAjenas.length ? 'ESCRIBE-AJENO' : leidas.length ? 'LEE-AJENO-Y-NO-ENTREGA' : 'NADA-AJENO';
  return { v, manos: manos.length, estado: out.estado, error: out.error, cuerpo: out.cuerpo, marcas, llega: texto(out.cuerpo).includes(MARCA_A),
    consultas: apuntes.length, leidas: leidas.map((a) => a.modelo + '.' + a.op + ' ' + texto(a.where)), escritas: escritasAjenas.slice(),
    noEvaluado: [...new Set(noEvaluado)], fugas: fugas.length - f0, envios: aMeta.length - m0 };
}

// ── LOS LLAMADORES. Sitios de llamada LEÍDOS de src/ (línea de la llamada) y su ruta.
const CASOS = [
  ['C · propio y sano (501)', '501', 'control'],
  ['P · el Trabajo de B (102)', '102', 'puerta'],
  ['D · de A con el CLIENTE de B (502)', '502', 'dependencia'],
  ['D · de A con el PRESUPUESTO de B (503)', '503', 'dependencia'],
  ['D · de A con el OPERARIO de B (504)', '504', 'dependencia'],
];
const POR_ID = [
  { sitio: 'jobs.routes.ts:923 (vía serializeJobDetail :569)', method: 'GET', ruta: '/admin/jobs/:id', body: null },
  { sitio: 'jobs.routes.ts:1136', method: 'PATCH', ruta: '/admin/jobs/:id', body: { notes: 'nota de la sesión' } },
  { sitio: 'jobs.routes.ts:1152', method: 'GET', ruta: '/admin/jobs/:id/ics', body: null },
];
const SIEMBRA = [
  { ruta: S + '/cruza', espera: { '102': 'ENTREGA-AJENO', '502': 'ENTREGA-AJENO', '501': 'NADA-AJENO' } },
  { ruta: S + '/filtra-y-confia', espera: { '102': 'NADA-AJENO', '502': 'ENTREGA-AJENO', '501': 'NADA-AJENO' } },
  { ruta: S + '/filtra-todo', espera: { '102': 'NADA-AJENO', '502': 'NADA-AJENO', '501': 'NADA-AJENO' } },
  { ruta: S + '/lee-y-calla', espera: { '102': 'NADA-AJENO', '502': 'LEE-AJENO-Y-NO-ENTREGA', '501': 'NADA-AJENO' } },
];

console.log('SCRUM-1519 · los llamadores de serializeJob, por efecto · sesión: administrador del comercio ' + A + ' · lo ajeno es del comercio ' + B + (SORDO ? ' · ⚠️ DOBLE SORDO: esto es el rojo, no una medición' : ''));
console.log('POBLACION: 5 sitios de llamada en 5 rutas (4 llaman a serializeJob, 1 a través de serializeJobDetail) · casos por ruta con :id ' + CASOS.length
  + ' · almacén: ' + Object.entries(almacenNuevo()).map(([k, v]) => k + ' ' + v.length).join(', ') + ' · marcas de B: ' + MARCAS_B.length + ' · modelos doblados ' + modelos.length);

let mal = 0; let ciegos = 0; const resumen = [];
const linea = (et, r) => `    ${et.padEnd(40)} → ${String(r.estado).padEnd(4)} ${r.v.padEnd(23)}` + (r.marcas.length ? ' marcas: ' + r.marcas.join(',') : '')
  + (r.leidas.length ? ' · leyó de B: ' + r.leidas.join(' ; ').slice(0, 150) : '') + (r.escritas.length ? ' · ESCRIBIÓ: ' + r.escritas.join(';') : '')
  + (r.error ? ' · error: ' + r.error : '') + (r.noEvaluado.length ? ' · where no evaluado: ' + r.noEvaluado.join(',') : '') + (r.fugas || r.envios ? ' · ⚠️ fugas ' + r.fugas + ' envíos ' + r.envios : '');

console.log('\n── EL PAR SEMBRADO (' + (SIN_SIEMBRA ? 'QUITADO' : SIEMBRA.length + ' rutas de mentira × 3 casos') + ')');
if (!SIN_SIEMBRA) for (const s of SIEMBRA) {
  console.log('  ' + s.ruta.replace(S, '…'));
  for (const [id, espera] of Object.entries(s.espera)) {
    const r = await corre('GET', s.ruta, { params: { id } });
    const ok = r.v === espera && r.manos > 0; if (!ok) mal += 1;
    console.log(linea((ok ? '✓ ' : '✗ ') + id + ' espera ' + espera, r));
  }
}

console.log('\n── LOS LLAMADORES CON :id');
for (const l of POR_ID) {
  console.log('  ' + l.method + ' ' + l.ruta + '  ·  ' + l.sitio);
  const fila = { ruta: l.method + ' ' + l.ruta, sitio: l.sitio };
  for (const [et, id, clase] of CASOS) {
    const r = await corre(l.method, l.ruta, { params: { id }, body: l.body ? { ...l.body } : {} });
    if (!r.manos) ciegos += 1;
    // El control: el caso propio TIENE que llegar hasta el serializador. Si no, las otras filas no dicen nada.
    if (clase === 'control' && !(r.estado === 200 && (r.llega || l.ruta.endsWith('/ics') && texto(r.cuerpo).includes(MARCA_A)))) { ciegos += 1; console.log('    ⚠️ EL CONTROL NO LLEGA: ' + texto(r.cuerpo).slice(0, 200)); }
    fila[id] = r.v + ' ' + r.estado + (r.marcas.length ? ' [' + r.marcas.join(',') + ']' : '');
    console.log(linea(et, r));
  }
  resumen.push(fila);
}

// ¿Puede la propia ruta que edita FABRICAR el estado sembrado? Se le pide, y se mira la fila después.
console.log('\n── ¿SE PUEDE FABRICAR EL ESTADO SEMBRADO POR LA RUTA QUE EDITA? PATCH /admin/jobs/501 con el cliente y el presupuesto de B en el cuerpo');
{
  const r = await corre('PATCH', '/admin/jobs/:id', { params: { id: '501' }, body: { notes: 'nota', customerId: 702, customer_id: 702, quoteId: 712, quote_id: 712, operarioId: 722 } });
  const j = T.job.find((x) => x.id === 501);
  console.log(linea('P · reapuntar el 501 a lo de B', r));
  console.log('    la fila 501 después: customerId ' + j.customerId + ' · quoteId ' + j.quoteId + ' · operarioId ' + j.operarioId + ' · notes ' + JSON.stringify(j.notes)
    + ' → ' + (j.customerId === 601 && j.quoteId === 611 && j.operarioId === null && j.notes === 'nota' ? 'NO se reapunta (y la nota SÍ se escribió: la petición llegó)' : '⚠️ CAMBIÓ'));
  if (j.notes !== 'nota') ciegos += 1;
}

console.log('\n── GET /admin/jobs (la lista)  ·  jobs.routes.ts:854, con lote (loadJobRefs)');
{
  const r = await corre('GET', '/admin/jobs', {});
  const l = Array.isArray(r.cuerpo) ? r.cuerpo : [];
  if (!r.manos || !l.length || !l.some((x) => x.id === 501 && texto(x).includes(MARCA_A))) { ciegos += 1; console.log('    ⚠️ EL CONTROL NO LLEGA: ' + r.estado + ' ' + texto(r.cuerpo).slice(0, 200) + (r.error || '')); }
  console.log('    estado ' + r.estado + ' · filas devueltas: ' + l.map((x) => x.id).join(', ') + ' · consultas ' + r.consultas + ' · leyó de B: ' + (r.leidas.join(' ; ').slice(0, 260) || '—') + (r.noEvaluado.length ? ' · where no evaluado: ' + r.noEvaluado.join(',') : ''));
  const fila = { ruta: 'GET /admin/jobs', sitio: 'jobs.routes.ts:854' };
  for (const [et, id] of CASOS) {
    const x = l.find((y) => String(y.id) === id); const m = x ? marcasEn(x) : [];
    const v = !x ? 'NO-ESTÁ-EN-LA-LISTA' : m.length ? 'ENTREGA-AJENO' : 'NADA-AJENO';
    fila[id] = v + (m.length ? ' [' + m.join(',') + ']' : '');
    console.log('    ' + et.padEnd(40) + ' → ' + v + (m.length ? ' marcas: ' + m.join(',') : ''));
  }
  resumen.push(fila);
}

console.log('\n── POST /admin/jobs  ·  jobs.routes.ts:904 (crea la fila: no hay estado sembrado que leer, sólo puerta)');
{
  const base = { titulo: 'Trabajo nuevo', direccion: 'Calle nueva 1' };
  const c = await corre('POST', '/admin/jobs', { body: { ...base, customerId: 601 } });
  if (!c.manos || c.estado !== 201 || !c.llega) { ciegos += 1; console.log('    ⚠️ EL CONTROL NO LLEGA: ' + c.estado + ' ' + texto(c.cuerpo).slice(0, 200) + (c.error || '')); }
  console.log(linea('C · con su propio cliente (601)', c));
  const p = await corre('POST', '/admin/jobs', { body: { ...base, customerId: 702 } });
  console.log(linea('P · con el cliente de B (702)', p));
  resumen.push({ ruta: 'POST /admin/jobs', sitio: 'jobs.routes.ts:904', 501: c.v + ' ' + c.estado, 102: p.v + ' ' + p.estado + (p.marcas.length ? ' [' + p.marcas.join(',') + ']' : ''), 502: 'no aplica', 503: 'no aplica', 504: 'no aplica' });
}

console.log('\n── RESUMEN · una fila por llamador');
console.log('  ruta | sitio | C propio | P pide lo de B | D cliente de B | D presupuesto de B | D operario de B');
for (const f of resumen) console.log('  ' + [f.ruta, f.sitio, f['501'], f['102'], f['502'], f['503'], f['504']].join(' | '));
const cruzanPuerta = resumen.filter((f) => /ENTREGA-AJENO|ESCRIBE-AJENO/.test(f['102'])).length;
const confian = resumen.filter((f) => ['502', '503', '504'].some((k) => /ENTREGA-AJENO/.test(f[k]))).length;
console.log('\n  llamadores ' + resumen.length + ' · cruzan por la PUERTA ' + cruzanPuerta + ' · entregan lo de B si la fila ya apunta fuera (CONFÍAN) ' + confian
  + ' · envíos a Meta ' + aMeta.length + ' · intentos de red ' + fugas.length);

if (SIN_SIEMBRA) fin(2, '\nCIEGO: sin el par sembrado esta pasada no distingue «no cruza» de «no veo».');
if (mal) fin(1, '\nROJO: ' + mal + ' caso(s) del par sembrado no salen como deben: lo de arriba NO vale.');
if (ciegos) fin(2, '\nCIEGO: ' + ciegos + ' control(es) propios no llegan al serializador.');
fin(0, '\nEl par sembrado se separa (' + SIEMBRA.length * 3 + ' de ' + SIEMBRA.length * 3 + ') y los controles propios llegan.');
