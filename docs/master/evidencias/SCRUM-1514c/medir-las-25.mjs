// SCRUM-1514c · Las 25 rutas que el censo del eje de comercio dejó en NO-LLEGO: medirlas.
//
// POBLACIÓN: NO está escrita aquí. Se LEE de la salida del censo (`--eje=comercio` de
// docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt): su sección «== NO-LLEGO · N». Si las
// filas leídas no son N, este fichero se declara CIEGO.
//
// MÉTODO: el mismo del censo, copiado (no importado: el censo es un guion que se ejecuta entero al
// cargarlo, y ese fichero lo está tocando otra sesión en SCRUM-1516). Sesión de administrador del
// comercio 21 que pide el recurso 102, del comercio 22. Prisma doblado: el doble aplica UNA cosa
// del `where`, el comercio. Manejadores reales de dist/. Ninguna base, ninguna red, Meta doblado.
//
// LO QUE AÑADE:
//   · guarda el CUERPO de la respuesta (el censo lo tiraba): de ahí sale POR QUÉ no llegó cada una;
//   · una RECETA por ruta (cuerpo, query, fichero o configuración de laboratorio) para pasar la
//     validación que la paraba. Las recetas salen de leer la validación de cada ruta, y se declaran;
//   · un PAR SEMBRADO propio: rutas de mentira montadas en memoria sobre la app, unas que cruzan y
//     otras que filtran. Si esta pasada no las separa, nada de lo demás vale y sale 1.
//
// DOS PASADAS por ruta:
//   G · genérica: la petición del censo tal cual (con su 2ª pasada de relleno). Tiene que repetir el
//       estado que el censo imprimió: es el control de que este motor es el mismo.
//   R · con receta.
//
// VEREDICTOS (los del censo, más uno que el censo no separaba):
//   CRUZA · LEE-Y-NIEGA · LEE-Y-NO-ACABA · FILTRA · SIN-CONSULTA · NO-LLEGO
//   NIEGA-SIN-CONSULTAR · contestó 403/404 sin consultar nada (en la pasada del censo eso era NO-LLEGO:
//                       POR QUÉ niega sólo lo dice la lectura, y va en la receta)
//   FILTRA-Y-NIEGA    · todas sus consultas iban atadas y contestó 403/404 (lo que el censo llama FILTRA 404)
//   FILTRA-Y-NO-ACABA · todas sus consultas iban atadas, pero contestó otro 4xx/5xx: lo que la ruta
//                       hubiera consultado DESPUÉS no se ha visto.
//
// Uso: node medir-las-25.mjs <raíz del árbol, con dist/> <salida del censo> [--doble-sordo]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';

const raiz = process.argv[2]; const ficheroCenso = process.argv[3];
const ciego = (m) => { console.log('CIEGO: ' + m); console.log('EXIT=2'); process.exit(2); };
if (!raiz || !ficheroCenso) ciego('faltan la raíz del árbol y la salida del censo');
const SORDO = process.argv.includes('--doble-sordo');
const de = (rel) => import(pathToFileURL(path.join(raiz, 'dist', rel)).href);

// ── La población, leída
const lineasCenso = fs.readFileSync(ficheroCenso, 'utf8').split(/\r?\n/);
const iCab = lineasCenso.findIndex((l) => /^== NO-LLEGO · \d+/.test(l));
if (iCab < 0) ciego('la salida del censo no trae la sección NO-LLEGO');
const declaradas = Number(/^== NO-LLEGO · (\d+)/.exec(lineasCenso[iCab])[1]);
const poblacion = [];
for (let i = iCab + 1; i < lineasCenso.length && lineasCenso[i].trim() !== ''; i++) {
  const m = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s+→\s+(\S+)/.exec(lineasCenso[i]);
  if (m) poblacion.push({ method: m[1], path: m[2], estadoCenso: m[3] });
}
if (poblacion.length !== declaradas || !declaradas) ciego('la sección dice ' + declaradas + ' y he leído ' + poblacion.length);

// ── Nada sale de aquí (igual que el censo)
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
reqDist('axios').defaults.adapter = async (cfg) => {
  let cuerpo = {}; try { cuerpo = JSON.parse(cfg.data); } catch { /* vacío */ }
  aMeta.push({ tipo: String(cuerpo.type || 'ilegible'), to: String(cuerpo.to || ''), url: String(cfg.url || '') });
  return { data: { messages: [{ id: 'wamid.laboratorio-1514c.' + aMeta.length }] }, status: 200, statusText: '200', headers: {}, config: cfg, request: {} };
};
const { config } = reqDist(path.join(raiz, 'dist', 'core', 'config', 'env.js'));
config.WHATSAPP_PHONE_NUMBER_ID = 'ID-DE-LABORATORIO-1514'; // dos textos en memoria, no credenciales
config.WHATSAPP_ACCESS_TOKEN = 'texto-de-laboratorio-1514';

const { app } = await de('app.js');
const { getAdminMounts } = await de('core/http/adminMounts.js');
const { prisma } = await de('core/db/prisma.js');

const PELIGRO = Object.keys(process.env).filter((k) => process.env[k]
  && /WHATSAPP|RESEND|GEMINI|ANTHROPIC|OPENAI|STRIPE|MERCADOPAGO|DATABASE_URL|SMTP|MAILER/i.test(k));
if (PELIGRO.length) ciego('el entorno lleva ' + PELIGRO.length + ' variable(s) de integración o de base (' + PELIGRO.join(', ') + ')');

// ── El doble (el del censo, eje de comercio)
const LECTURAS_UNA = ['findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow'];
const ESCRITURAS = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'createMany'];
const LEE = [...LECTURAS_UNA, 'findMany', 'count', 'aggregate', 'groupBy'];
const modelos = Object.keys(prisma).filter((k) => !k.startsWith('$') && !k.startsWith('_') && prisma[k] && typeof prisma[k].findMany === 'function');
const ahora = new Date();
const trabajoAjeno = { id: 77, merchantId: 1, operarioId: 12, assignedUserId: 12, assignees: [{ teamMemberId: 12 }],
  status: 'en_curso', titulo: 'T', direccion: 'D', tipoOperacion: 'TRABAJO_UNICO', quoteId: 102, customerId: 5,
  createdAt: ahora, updatedAt: ahora, albaranes: [], quotes: [], invoices: [], totalAceptado: 900, totalCobrado: 0 };
const AJENO = {
  id: 102, merchantId: 1, teamMemberId: 12, operarioId: 12, assignedUserId: 12, assignees: [{ teamMemberId: 12 }],
  asignados: [], status: 'accepted', estado: 'emitido', total: 900, subtotal: 743.8, tax: 156.2, currency: 'EUR',
  quoteNumber: 2, number: 'A-2', numero: 'ALB-2026-002', type: 'F1', lines: [], lineas: [], invoices: [], albaranes: [],
  createdAt: ahora, updatedAt: ahora, fecha: ahora, paidAt: null, jobId: 77, quoteId: 102, customerId: 5,
  modoValoracion: 'SIN_VALORAR', pdfPath: null, pdfUrl: null, publicToken: 'tok', token: 'tok',
  customer: { id: 5, merchantId: 1, name: 'Cliente', phone: '600000000', email: null },
  merchant: { id: 1, name: 'Negocio', legalName: 'Negocio SL', flags: {}, country: 'ES', currency: 'EUR' },
  job: trabajoAjeno, quote: { id: 102, merchantId: 1, teamMemberId: 12, quoteNumber: 2, total: 900, jobId: 77, job: trabajoAjeno },
  charge: null, tags: [], internalNotes: null,
};
const SESION = 21; const OTRO = 22; const ID_PROPIO = 501;
let Prisma = null;
try { ({ Prisma } = createRequire(path.join(raiz, 'dist', 'core', 'db', 'prisma.js'))('@prisma/client')); } catch { /* ciego abajo */ }
const dm = Prisma && Prisma.dmmf && Prisma.dmmf.datamodel ? Prisma.dmmf.datamodel.models : null;
if (!dm) ciego('no puedo leer el modelo de datos del cliente (dmmf)');
const minus = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const CON_COMERCIO = new Set(dm.filter((x) => x.fields.some((f) => f.name === 'merchantId')).map((x) => minus(x.name)));
if (!CON_COMERCIO.has('invoice') || !CON_COMERCIO.has('quote') || !CON_COMERCIO.has('customer') || CON_COMERCIO.has('merchant')) ciego('la lista de modelos con comercio no es la que debería');
const SIN_COLUMNA = dm.map((x) => minus(x.name)).filter((m) => !CON_COMERCIO.has(m) && m !== 'merchant');

const recoge = (w, clave, out) => { if (w && typeof w === 'object') for (const [k, v] of Object.entries(w)) { if (k === clave) out.push(v && typeof v === 'object' && 'equals' in v ? v.equals : v); recoge(v, clave, out); } return out; };
const lleva = (w, valor) => { if (w === valor || w === String(valor)) return true; if (w && typeof w === 'object') return Object.values(w).some((v) => lleva(v, valor)); return false; };
const de22 = (m) => (m === 'job' ? { ...trabajoAjeno, merchantId: OTRO } : m === 'merchant' ? { ...AJENO.merchant, id: OTRO, merchantId: undefined, plan: 'pro', status: 'active', email: 'otro@example.invalid' }
  : { ...AJENO, merchantId: OTRO, chargeId: 900, merchant: { ...AJENO.merchant, id: OTRO }, customer: { ...AJENO.customer, merchantId: OTRO } });
const de21 = (m) => (m === 'merchant' ? { ...AJENO.merchant, id: SESION, plan: 'pro', status: 'active', email: 'sesion@example.invalid' }
  : { ...AJENO, id: ID_PROPIO, merchantId: SESION, chargeId: null, jobId: null, quoteId: null, job: null, quote: null, merchant: { ...AJENO.merchant, id: SESION }, customer: { ...AJENO.customer, id: ID_PROPIO, merchantId: SESION } });
const atada = (m, w) => {
  if (SORDO) return true;
  if (m === 'merchant') return recoge(w, 'id', []).includes(SESION) || lleva(w, 'sesion@example.invalid');
  return recoge(w, 'merchantId', []).includes(SESION) || lleva(w, ID_PROPIO);
};
let apuntes = []; let sueltas = []; let crudas = 0;
// Lo que una receta necesita que lleve la fila que devuelve el doble (propia o ajena) para pasar
// una puerta que no es la del comercio: `type: 'session'` en la sesion, `status: 'pending'`...
let parche = {};
const fila = (m, base) => (base && parche[m] ? { ...base, ...parche[m] } : base);
for (const m of modelos) {
  const d = prisma[m];
  const juzga = (op, args) => {
    const w = args && args.where !== undefined ? args.where : null;
    const ok = op === 'create' || op === 'createMany' ? true : atada(m, w);
    apuntes.push({ modelo: m, op, where: w, atada: ok });
    if (!ok && (CON_COMERCIO.has(m) || m === 'merchant')) sueltas.push({ modelo: m, op, where: w, escribe: !LEE.includes(op) });
    return { ok, w };
  };
  for (const op of LECTURAS_UNA) d[op] = async (args) => { const { ok, w } = juzga(op, args); return fila(m, ok ? (lleva(w, 102) ? null : de21(m)) : de22(m)); };
  d.findMany = async (args) => { const { ok } = juzga('findMany', args); return ok ? [] : [fila(m, de22(m))]; };
  d.count = async (args) => { const { ok } = juzga('count', args); return ok ? 0 : 1; };
  d.aggregate = async (args) => { juzga('aggregate', args); return { _sum: {}, _count: { _all: 0 }, _avg: {}, _max: {}, _min: {} }; };
  d.groupBy = async (args) => { juzga('groupBy', args); return []; };
  for (const op of ESCRITURAS) d[op] = async (args) => { const { ok } = juzga(op, args); if (/Many$/.test(op)) return { count: ok ? 0 : 1 };
    // Un `create` devuelve lo que se le pidió crear, no una fila cualquiera: sin esto, lo que la ruta
    // lea DESPUÉS a partir de la fila creada (su cliente, por ejemplo) pregunta por un id que nadie pidió.
    const dados = op === 'create' && args && args.data && typeof args.data === 'object' ? Object.fromEntries(Object.entries(args.data).filter(([, v]) => v === null || typeof v !== 'object' || v instanceof Date)) : {};
    return fila(m, { ...(ok ? de21(m) : de22(m)), ...dados }); };
}
prisma.$transaction = async (x) => (typeof x === 'function' ? x(prisma) : Promise.all(x));
prisma.$queryRaw = async () => { crudas += 1; return []; };
prisma.$queryRawUnsafe = prisma.$queryRaw;
prisma.$executeRaw = async () => { crudas += 1; return 0; };
prisma.$executeRawUnsafe = prisma.$executeRaw;

// ── EL PAR SEMBRADO. Rutas de mentira, montadas en memoria sobre la app ya cargada: no existen en
// src/ ni en dist/. Pasan por el MISMO camino que las de verdad (manosDe las encuentra en la pila
// de la app, `pedir` las ejecuta, el veredicto lo pone la misma función).
const S = '/admin/__siembra-1514c';
const lista = (b) => (b && Array.isArray(b.sembradas) ? b.sembradas.map(Number) : null);
app.post(S + '/por-ruta/:id/cruza', async (req, res) => {
  const f = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) } });
  if (!f) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, telefono: f.customer.phone });
});
app.post(S + '/por-ruta/:id/filtra', async (req, res) => {
  const f = await prisma.invoice.findFirst({ where: { id: Number(req.params.id), merchantId: req.merchantId } });
  if (!f) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, telefono: f.customer.phone });
});
app.post(S + '/por-ruta/:id/niega-antes', async (req, res) => {
  if (Number(req.params.id) !== req.merchantId) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, m: await prisma.merchant.findUnique({ where: { id: Number(req.params.id) } }) });
});
// Con validación delante, como las 25: sin `sembradas` en el cuerpo contestan 400 sin consultar.
// (`sembradas` no está en el relleno del censo: en la pasada genérica TIENEN que salir NO-LLEGO.)
app.post(S + '/por-cuerpo/lee-cruza', async (req, res) => {
  const ids = lista(req.body); if (!ids) return res.status(400).json({ ok: false, error: 'falta_sembradas' });
  const l = await prisma.customer.findMany({ where: { id: { in: ids } } });
  if (!l.length) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, n: l.length });
});
app.post(S + '/por-cuerpo/lee-filtra', async (req, res) => {
  const ids = lista(req.body); if (!ids) return res.status(400).json({ ok: false, error: 'falta_sembradas' });
  const l = await prisma.customer.findMany({ where: { id: { in: ids }, merchantId: req.merchantId } });
  if (!l.length) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, n: l.length });
});
app.post(S + '/por-cuerpo/escribe-cruza', async (req, res) => {
  const ids = lista(req.body); if (!ids) return res.status(400).json({ ok: false, error: 'falta_sembradas' });
  const r = await prisma.customer.updateMany({ where: { id: { in: ids } }, data: { tags: ['x'] } });
  return res.json({ ok: true, n: r.count });
});
app.post(S + '/por-cuerpo/escribe-filtra', async (req, res) => {
  const ids = lista(req.body); if (!ids) return res.status(400).json({ ok: false, error: 'falta_sembradas' });
  const r = await prisma.customer.updateMany({ where: { merchantId: req.merchantId, id: { in: ids } }, data: { tags: ['x'] } });
  return res.json({ ok: true, n: r.count });
});

// ── El motor (el del censo)
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
function peticion(ruta, method, extra) {
  const params = {};
  for (const seg of ruta.split('/')) if (seg.startsWith(':')) params[seg.slice(1)] = '102';
  const x = extra || {};
  return { userRole: 'admin', teamMemberId: null, isOwner: true, merchantId: SESION, merchant: de21('merchant'),
    params: { ...params, ...(x.params || {}) }, query: { q: 'obra', customerId: '5', mes: '2026-09', ...(x.query || {}) }, body: x.body || {},
    ...(x.req || {}),
    headers: { 'user-agent': 'censo', ...(x.headers || {}) }, method, path: ruta, originalUrl: ruta, url: ruta, ip: '127.0.0.1', cookies: x.cookies || {},
    get() { return undefined; }, header() { return undefined; }, socket: { remoteAddress: '127.0.0.1' }, app };
}
async function pedir(manos, req) {
  let estado = 200; let acabado = false; let cuerpo;
  const res = new PassThrough();
  res.on('error', () => {}); res.resume();
  const fin = (x) => { if (!acabado) cuerpo = x; acabado = true; return res; };
  res.status = (n) => { estado = n; return res; };
  res.sendStatus = (n) => { estado = n; return fin(); };
  res.json = (x) => fin(x); res.send = (x) => fin(x);
  res.set = () => res; res.setHeader = () => res; res.header = () => res; res.type = () => res;
  res.attachment = () => res; res.cookie = () => res; res.locals = {};
  res.redirect = (a) => { estado = typeof a === 'number' ? a : 302; return fin(); };
  res.sendFile = () => fin(); res.download = () => fin();
  res.once('finish', () => { acabado = true; });
  let error = null; const m = req.method.toLowerCase();
  try {
    for (const s of manos) {
      if (s.method && s.method !== m) continue;
      let sigue = false;
      await Promise.race([
        (async () => { await s.handle(req, res, (e) => { if (e) error = e; else sigue = true; }); })(),
        new Promise((ok) => setTimeout(ok, 4000)),
      ]);
      for (let i = 0; i < 20 && !sigue && !acabado && !error; i++) await new Promise((ok) => setTimeout(ok, 25));
      if (!sigue || error || acabado) break;
    }
  } catch (e) { error = e; }
  return { estado: error && !acabado ? 'EXC' : estado, acabado, error: error ? String(error.message || error).slice(0, 160) : null, cuerpo };
}
const canon = (x) => JSON.stringify(x, (k, v) => (v instanceof Date ? 'FECHA' : v));
const corto = (x, n) => { let s; try { s = typeof x === 'string' ? x : canon(x); } catch { s = '[no serializable]'; } return s === undefined ? '—' : s.length > n ? s.slice(0, n) + '…' : s; };
const RELLENO = { name: 'Relleno', nombre: 'Relleno', tags: ['a'], status: 'paid', estado: 'paid', reason: 'motivo de prueba', motivo: 'motivo de prueba',
  type: 'otro', tipo: 'otro', amount: 10, importe: 10, total: 10, concept: 'c', concepto: 'c', price: 10, description: 'd', date: '2026-10-01', fecha: '2026-10-01',
  address: 'd', direccion: 'd', label: 'l', phone: '600000000', notes: 'n', ids: [102], targetId: 102, sourceId: 102, keepId: 102, mergeId: 102, otherId: 102,
  lines: [{ concept: 'c', qty: 1, price: 10, tax: 0.21 }], stages: [], plan: [], confirm: true, category: 'otros', paidAt: '2026-10-01', method: 'transfer' };

async function corre(method, ruta, extra) {
  apuntes = []; sueltas = []; crudas = 0; const m0 = aMeta.length; const f0 = fugas.length;
  const x = extra || {}; const guardada = {}; const envAntes = {}; const modAntes = [];
  for (const [k, v] of Object.entries(x.config || {})) { guardada[k] = config[k]; config[k] = v; }
  for (const [k, v] of Object.entries(x.env || {})) { envAntes[k] = process.env[k]; process.env[k] = v; }
  for (const mo of (x.modulos || [])) { const mod = reqDist(path.join(raiz, 'dist', mo.rel)); modAntes.push([mod, mo.clave, mod[mo.clave]]); mod[mo.clave] = mo.valor; if (mod[mo.clave] !== mo.valor) throw new Error('INSTRUMENTO: no pude doblar ' + mo.rel + ':' + mo.clave); }
  parche = x.filas || {};
  let out;
  try { out = await pedir(manosDe(method, ruta), peticion(ruta, method, extra)); }
  finally {
    parche = {};
    for (const [k, v] of Object.entries(guardada)) config[k] = v;
    for (const [k, v] of Object.entries(envAntes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    for (const [mod, clave, v] of modAntes) mod[clave] = v;
  }
  const deComercio = apuntes.filter((a) => CON_COMERCIO.has(a.modelo) || a.modelo === 'merchant');
  const e = out.estado; const pasa = typeof e === 'number' && e < 400; const niega = e === 403 || e === 404;
  let v;
  if (sueltas.length) v = pasa ? 'CRUZA' : niega ? 'LEE-Y-NIEGA' : 'LEE-Y-NO-ACABA';
  else if (deComercio.length) v = pasa ? 'FILTRA' : niega ? 'FILTRA-Y-NIEGA' : 'FILTRA-Y-NO-ACABA';
  else v = pasa ? 'SIN-CONSULTA' : niega ? 'NIEGA-SIN-CONSULTAR' : 'NO-LLEGO';
  return { v, estado: e, error: out.error, cuerpo: out.cuerpo, envios: aMeta.length - m0, fugas: fugas.slice(f0), crudas,
    atadas: deComercio.filter((a) => a.atada).map((a) => a.modelo + '.' + a.op),
    sueltas: sueltas.map((a) => a.modelo + '.' + a.op + (a.escribe ? '(ESCRIBE)' : '') + ' ' + canon(a.where)),
    sinColumna: apuntes.filter((a) => SIN_COLUMNA.includes(a.modelo)).map((a) => a.modelo + '.' + a.op + ' ' + corto(a.where, 80)) };
}
// La pasada genérica ES la del censo: petición pelada y, si muere en 400 sin consultar, relleno.
async function generica(method, ruta) {
  let r = await corre(method, ruta, null); let relleno = false;
  if (r.estado === 400 && !r.atadas.length && !r.sueltas.length) { relleno = true; r = await corre(method, ruta, { body: JSON.parse(JSON.stringify(RELLENO)) }); }
  // el censo llama FILTRA a lo que aquí se separa en dos: para comparar con él, se junta
  return { ...r, relleno, vCenso: r.v === 'FILTRA-Y-NO-ACABA' || r.v === 'FILTRA-Y-NIEGA' ? 'FILTRA' : r.v === 'NIEGA-SIN-CONSULTAR' ? 'NO-LLEGO' : r.v };
}

// ── LAS RECETAS. Cada una sale de LEER la validación de su ruta (fichero y línea en el registro).
const { RECETAS } = await import(new URL('./recetas.mjs', import.meta.url).href);

console.log('SCRUM-1514c · las NO-LLEGO del eje de comercio · sesión: administrador del comercio ' + SESION + ' · el recurso 102 es del comercio ' + OTRO + (SORDO ? ' · ⚠️ DOBLE SORDO (no es una medición: es el rojo)' : ''));
console.log('POBLACION: ' + poblacion.length + ' rutas leídas de la sección NO-LLEGO del censo (que declara ' + declaradas + ') · con :parámetro ' + poblacion.filter((p) => p.path.includes('/:')).length
  + ' · con receta ' + poblacion.filter((p) => RECETAS[p.method + ' ' + p.path]).length + ' · recetas que no son de la población ' + Object.keys(RECETAS).filter((k) => !poblacion.some((p) => p.method + ' ' + p.path === k)).length
  + ' · modelos con columna de comercio ' + CON_COMERCIO.size + ' de ' + dm.length + ' · sin ella: ' + SIN_COLUMNA.join(', '));

const filas = []; let noRepite = 0;
for (const p of poblacion) {
  const clave = p.method + ' ' + p.path;
  const manos = manosDe(p.method, p.path).length;
  const g = await generica(p.method, p.path);
  const repite = String(g.estado) === p.estadoCenso && g.vCenso === 'NO-LLEGO';
  if (!repite) noRepite += 1;
  const rec = RECETAS[clave] || null;
  const variantes = [];
  if (rec) for (const va of (rec.variantes || [rec])) variantes.push({ nombre: va.nombre || 'receta', r: await corre(p.method, p.path, va) });
  filas.push({ ...p, clave, manos, g, repite, rec, variantes });
}

const ORDEN = ['CRUZA', 'LEE-Y-NO-ACABA', 'LEE-Y-NIEGA', 'NO-LLEGO', 'FILTRA-Y-NO-ACABA', 'NIEGA-SIN-CONSULTAR', 'FILTRA-Y-NIEGA', 'SIN-CONSULTA', 'FILTRA'];
// El veredicto de una ruta con varias variantes es el PEOR (el primero de ORDEN que aparezca).
const peor = (f) => (f.variantes.length ? ORDEN.find((v) => f.variantes.some((x) => x.r.v === v)) : 'SIN-RECETA');
for (const f of filas) f.v = peor(f);

console.log('\n── POR QUÉ NO LLEGÓ CADA UNA (pasada genérica: la del censo, ahora con el cuerpo de la respuesta)');
for (const f of filas) {
  console.log(`${f.method.padEnd(6)} ${f.path}  → ${f.g.estado}` + (f.g.relleno ? ' (tras relleno)' : '') + ' · manos ' + f.manos + ' · ' + (f.repite ? 'repite al censo' : '⚠️ NO repite al censo (' + f.estadoCenso + ' → ' + f.g.estado + ' ' + f.g.vCenso + ')'));
  console.log('         contesta: ' + corto(f.g.cuerpo, 200) + (f.g.error ? ' · error: ' + f.g.error : ''));
}

console.log('\n── CON RECETA');
for (const v of [...ORDEN, 'SIN-RECETA']) {
  const l = filas.filter((f) => f.v === v);
  console.log('\n== ' + v + ' · ' + l.length + ' (con :parámetro ' + l.filter((f) => f.path.includes('/:')).length + ')');
  for (const f of l) {
    console.log(`${f.method.padEnd(6)} ${f.path}` + (f.rec && f.rec.causa ? '  [causa: ' + f.rec.causa + ']' : ''));
    for (const x of f.variantes) {
      const r = x.r;
      console.log(`         · ${x.nombre} → ${r.v} ${r.estado}` + (r.envios ? ' · ENVÍOS A META (doblado): ' + r.envios : '') + (r.crudas ? ' · SQL crudo (no juzgado): ' + r.crudas : '') + (r.fugas.length ? ' · salidas cortadas: ' + [...new Set(r.fugas)].join(', ') : ''));
      console.log('           contesta: ' + corto(r.cuerpo, 160) + (r.error ? ' · error: ' + r.error : ''));
      console.log('           atadas (' + r.atadas.length + '): ' + (corto([...new Set(r.atadas)].join(', '), 300) || '—'));
      if (r.sueltas.length) console.log('           🔴 SIN COMERCIO (' + r.sueltas.length + '): ' + corto(r.sueltas.join(' | '), 600));
      if (r.sinColumna.length) console.log('           a modelos sin columna de comercio (no juzgadas): ' + corto(r.sinColumna.join(' | '), 300));
    }
  }
}

// ── CONTROLES
console.log('\n── CONTROLES');
const SEMBRADAS = [
  ['POST', S + '/por-ruta/:id/cruza', null, 'CRUZA', 200],
  ['POST', S + '/por-ruta/:id/filtra', null, 'FILTRA-Y-NIEGA', 404],
  ['POST', S + '/por-ruta/:id/niega-antes', null, 'NIEGA-SIN-CONSULTAR', 404],
  ['POST', S + '/por-cuerpo/lee-cruza', { body: { sembradas: [102] } }, 'CRUZA', 200],
  ['POST', S + '/por-cuerpo/lee-filtra', { body: { sembradas: [102] } }, 'FILTRA-Y-NIEGA', 404],
  ['POST', S + '/por-cuerpo/escribe-cruza', { body: { sembradas: [102] } }, 'CRUZA', 200],
  ['POST', S + '/por-cuerpo/escribe-filtra', { body: { sembradas: [102] } }, 'FILTRA', 200],
];
let ok = true;
console.log('  SEMBRADAS, con lo que cada una necesita:');
for (const [m, p, extra, quiero, estado] of SEMBRADAS) {
  const r = await corre(m, p, extra); const bien = r.v === quiero && r.estado === estado; if (!bien) ok = false;
  console.log(`    ${bien ? 'ok ' : 'MAL'} ${m} ${p} → ${r.v} ${r.estado} (se espera ${quiero} ${estado})` + (r.sueltas.length ? ' · ' + r.sueltas[0] : ''));
}
console.log('  SEMBRADAS con validación, SIN darles su cuerpo (la pasada del censo): tienen que salir NO-LLEGO las cuatro, la que cruza también');
for (const [m, p] of SEMBRADAS.filter((s) => s[2])) {
  const g = await generica(m, p); const bien = g.vCenso === 'NO-LLEGO' && g.estado === 400; if (!bien) ok = false;
  console.log(`    ${bien ? 'ok ' : 'MAL'} ${m} ${p} → ${g.vCenso} ${g.estado}`);
}
const neg = await corre('POST', '/admin/invoices/:id/send-reminder', null);
const negBien = neg.v === 'FILTRA-Y-NIEGA' && neg.estado === 404 && neg.envios === 0; if (!negBien) ok = false;
console.log(`  NEGATIVO del árbol (filtra, medido por HTTP en SCRUM-1512): ${negBien ? 'ok ' : 'MAL'} POST /admin/invoices/:id/send-reminder → ${neg.v} ${neg.estado} envíos ${neg.envios}`);
const arr = await corre('POST', '/admin/invoices/:id/resend-whatsapp', null);
const arrBien = arr.v === 'FILTRA-Y-NIEGA' && arr.estado === 404 && arr.envios === 0; if (!arrBien) ok = false;
console.log(`  LA ARREGLADA en SCRUM-1514b (ya no cruza): ${arrBien ? 'ok ' : 'MAL'} POST /admin/invoices/:id/resend-whatsapp → ${arr.v} ${arr.estado} envíos ${arr.envios}`);
const lyn = await corre('POST', '/admin/quotes/:id/send-whatsapp', null);
const lynBien = lyn.v === 'LEE-Y-NIEGA' && lyn.estado === 404 && lyn.envios === 0; if (!lynBien) ok = false;
console.log(`  POSITIVO del árbol (lee sin comercio y niega después; SCRUM-1514 ③): ${lynBien ? 'ok ' : 'MAL'} POST /admin/quotes/:id/send-whatsapp → ${lyn.v} ${lyn.estado}` + (lyn.sueltas.length ? ' · ' + lyn.sueltas[0] : ''));
const ceroManos = manosDe('POST', S + '/por-ruta/:id/no-la-he-montado').length;
if (ceroManos !== 0) ok = false;
console.log('  CERO (una sembrada que NO he montado): manos ' + ceroManos);
if (noRepite) ok = false;
console.log('  MOTOR: la pasada genérica repite el estado y el NO-LLEGO del censo en ' + (filas.length - noRepite) + ' de ' + filas.length);
console.log('¿esta pasada distingue la que cruza de la que filtra, y repite al censo?  ' + ok);

const cuenta = ORDEN.concat('SIN-RECETA').map((v) => v + ' ' + filas.filter((f) => f.v === v).length).join(' · ');
console.log('\nTOTALES (el peor veredicto de cada ruta): ' + cuenta + ' · suma ' + filas.length);
console.log('envíos a Meta doblados en toda la corrida: ' + aMeta.length + ' · intentos de salir de la máquina cortados: ' + fugas.length + (fugas.length ? ' → ' + [...new Set(fugas)].join(', ') : ''));
console.log('EXIT=' + (ok ? 0 : 1));
process.exit(ok ? 0 : 1);
