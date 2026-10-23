// SCRUM-1390c · Las rutas que el censo del ROL (SCRUM-1390 Ⓓ) dejó en NO-LLEGO: medirlas por efecto.
//
// POBLACIÓN: NO está escrita aquí. Se LEE de la salida del censo del rol
// (docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt, sin `--eje`): su sección
// «== NO-LLEGO · N». Si las filas leídas no son N, este fichero se declara CIEGO.
//
// MÉTODO: el del censo del rol. Manejadores reales de dist/, una petición de rol `admin` y otra de
// rol `tecnico` (id 11), en dos pasadas: A «vacío» y B «ajeno» (el documento es del COMPAÑERO, id 12:
// autor, operario y asignado). Prisma doblado: NO aplica el `where`, lo APUNTA.
// Lo que cambia respecto al censo, DECLARADO:
//   · una RECETA por ruta para pasar la validación que la paraba. Ocho son las de SCRUM-1514c
//     (se IMPORTAN de su recetas.mjs, no se copian); siete son de este fichero (RECETAS_1390C);
//   · en la pasada B el doble devuelve el ajeno también en `findMany` (el censo devolvía []), y una
//     receta puede PARCHEAR la fila que devuelve (`filas`: el adjunto lleva bytes, el comercio un flag);
//   · se guarda el CUERPO de la respuesta y se mira si al técnico, en B, le llega la MARCA del ajeno.
//   · red cortada y Meta doblado en el transporte (lo de SCRUM-1514c): ejecuta rutas que envían.
//
// CONTROLES: un PAR SEMBRADO con validación delante (rutas de mentira montadas en memoria): sin su
// cuerpo salen NO-LLEGO, con él una sale NO-DISTINGUE (y entrega el ajeno) y otra RECORTA.
// `--sin-sembrar` NO es medición: no las monta, y el fichero tiene que decir CIEGO (sale 2).
//
// Uso: node medir-las-15.mjs <raíz del árbol, con dist/> <salida del censo del rol> [--sin-sembrar]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';

const raiz = process.argv[2]; const ficheroCenso = process.argv[3];
const ciego = (m) => { console.log('CIEGO: ' + m); console.log('EXIT=2'); process.exit(2); };
if (!raiz || !ficheroCenso) ciego('faltan la raíz del árbol y la salida del censo del rol');
const SIN_SEMBRAR = process.argv.includes('--sin-sembrar');
// SCRUM-1390d: un reventón del propio instrumento salía con código 1, el mismo que «un control falso».
for (const ev of ['uncaughtException', 'unhandledRejection']) process.on(ev, (e) => ciego('el instrumento reventó (' + ev + '): ' + String((e && e.stack) || e).split('\n').slice(0, 2).join(' · ')));
const de = (rel) => import(pathToFileURL(path.join(raiz, 'dist', rel)).href);

// ── La población, leída
const lineas = fs.readFileSync(ficheroCenso, 'utf8').split(/\r?\n/);
const iCab = lineas.findIndex((l) => /^== NO-LLEGO · \d+/.test(l));
if (iCab < 0) ciego('la salida del censo no trae la sección NO-LLEGO');
const declaradas = Number(/^== NO-LLEGO · (\d+)/.exec(lineas[iCab])[1]);
const poblacion = [];
for (let i = iCab + 1; i < lineas.length && !lineas[i].startsWith('=='); i++) {
  const m = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/.exec(lineas[i]);
  if (m) poblacion.push({ method: m[1], path: m[2] });
}
if (poblacion.length !== declaradas || !declaradas) ciego('la sección dice ' + declaradas + ' y he leído ' + poblacion.length);

// ── Nada sale de aquí (lo de SCRUM-1514c)
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
// SCRUM-1390d: la IA, DOBLADA en el transporte. Sin esto las cuatro rutas de IA salían 502 con la red
// cortada y no se veía si el documento ajeno VIAJA al modelo. El doble apunta el cuerpo que le llega y
// contesta con ese mismo cuerpo como texto: mide que viaja; lo que un modelo real devolvería, NO.
const aIA = [];
globalThis.fetch = async (u, init) => { let h = '?'; try { h = new URL(String(u && u.url ? u.url : u)).hostname; } catch { /* se apunta igual */ }
  if (h === 'generativelanguage.googleapis.com') { const cuerpo = String((init && init.body) || ''); aIA.push(cuerpo);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ECO-IA-1390D ' + cuerpo }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } }); }
  fugas.push('fetch:' + h); throw new Error('INSTRUMENTO: fetch cortado: ' + h); };
process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:9';
process.env.NODE_ENV = 'development';
process.env.DISABLE_CRONS = 'true';
const reqDist = createRequire(path.join(raiz, 'dist', 'integrations', 'whatsapp.js'));
reqDist('axios').defaults.adapter = async (cfg) => {
  let cuerpo = {}; try { cuerpo = JSON.parse(cfg.data); } catch { /* vacío */ }
  aMeta.push({ tipo: String(cuerpo.type || 'ilegible'), to: String(cuerpo.to || '') });
  return { data: { messages: [{ id: 'wamid.laboratorio-1390c.' + aMeta.length }] }, status: 200, statusText: '200', headers: {}, config: cfg, request: {} };
};
const { config } = reqDist(path.join(raiz, 'dist', 'core', 'config', 'env.js'));
config.WHATSAPP_PHONE_NUMBER_ID = 'ID-DE-LABORATORIO-1390C'; // dos textos en memoria, no credenciales
config.WHATSAPP_ACCESS_TOKEN = 'texto-de-laboratorio-1390c';
config.PUBLIC_BASE_URL = 'http://127.0.0.1:9';

const { app } = await de('app.js');
const { getAdminMounts } = await de('core/http/adminMounts.js');
const { prisma } = await de('core/db/prisma.js');
// SCRUM-1390d: `export default router` compilado a CJS llega aquí como { default: router }.
const portalMod = (await de('modules/system/app/routes/customerPortal.routes.js')).default;
const portal = portalMod && portalMod.stack ? portalMod : portalMod && portalMod.default;
if (!portal || !portal.stack) ciego('no encuentro el router del portal del cliente en dist/');

const PELIGRO = Object.keys(process.env).filter((k) => process.env[k]
  && /WHATSAPP|RESEND|GEMINI|ANTHROPIC|OPENAI|STRIPE|MERCADOPAGO|DATABASE_URL|SMTP|MAILER/i.test(k));
if (PELIGRO.length) ciego('el entorno lleva ' + PELIGRO.length + ' variable(s) de integración o de base (' + PELIGRO.join(', ') + ')');

// ── El doble (eje del rol). Las MARCAS son lo que no puede salir de ningún otro sitio.
const MARCA = { cliente: 'CLIENTE-AJENO-1390C', concepto: 'CONCEPTO-AJENO-1390C', foto: 'FOTO-AJENA-1390C' };
const DOCUMENTO = ['quote', 'invoice', 'albaran', 'parteTrabajo', 'job'];
const LECTURAS_UNA = ['findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow'];
const ESCRITURAS = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'createMany'];
const modelos = Object.keys(prisma).filter((k) => !k.startsWith('$') && !k.startsWith('_') && prisma[k] && typeof prisma[k].findMany === 'function');
if (DOCUMENTO.some((m) => !modelos.includes(m))) ciego('el cliente no tiene todos los modelos de documento');
const ahora = new Date();
const trabajoAjeno = { id: 77, merchantId: 1, operarioId: 12, assignedUserId: 12, assignees: [{ teamMemberId: 12 }],
  status: 'en_curso', titulo: 'T', direccion: 'D', tipoOperacion: 'TRABAJO_UNICO', quoteId: 102, customerId: 5,
  createdAt: ahora, updatedAt: ahora, albaranes: [], quotes: [], invoices: [], totalAceptado: 900, totalCobrado: 0 };
const AJENO = {
  id: 102, merchantId: 1, teamMemberId: 12, operarioId: 12, assignedUserId: 12, assignees: [{ teamMemberId: 12 }],
  asignados: [], status: 'accepted', estado: 'emitido', total: 900, subtotal: 743.8, tax: 156.2, currency: 'EUR',
  quoteNumber: 2, number: 'A-2', numero: 'ALB-2026-002', type: 'F1', lines: [{ concept: MARCA.concepto, qty: 1, price: 900 }], lineas: [], invoices: [], albaranes: [],
  createdAt: ahora, updatedAt: ahora, fecha: ahora, paidAt: null, jobId: 77, quoteId: 102, customerId: 5,
  modoValoracion: 'SIN_VALORAR', pdfPath: null, pdfUrl: null, publicToken: 'tok', token: 'tok', portalToken: 'tok-portal-1390c',
  name: MARCA.cliente, phone: '600000000', email: null,
  customer: { id: 5, merchantId: 1, name: MARCA.cliente, phone: '600000000', email: null },
  merchant: { id: 1, name: 'Negocio', legalName: 'Negocio SL', flags: {}, country: 'ES', currency: 'EUR', defaultCurrency: 'EUR' },
  job: trabajoAjeno, quote: { id: 102, merchantId: 1, teamMemberId: 12, quoteNumber: 2, total: 900, jobId: 77, job: trabajoAjeno },
  charge: null, tags: [], internalNotes: null,
};
let pasada = 'A'; let apuntes = []; let parche = {};
// SCRUM-1390d: hasta aquí TODO modelo devolvía la fila AJENA, con sus marcas, y también en `create`:
// un alta de cliente o de gasto «entregaba» el ajeno porque el doble lo ponía en la respuesta. Ahora
// las marcas sólo viven en los modelos de DOCUMENTO (o en lo que una receta parchee a propósito).
const NEUTRO = { ...AJENO, name: 'NEUTRO-1390D', teamMember: { id: 12, merchantId: 1, name: 'NEUTRO-1390D' }, lines: [], customer: { ...AJENO.customer, name: 'NEUTRO-1390D' }, job: { ...trabajoAjeno }, quote: { ...AJENO.quote, job: { ...trabajoAjeno } } };
const base = (m) => (m === 'job' ? trabajoAjeno : m === 'merchant' ? { ...AJENO.merchant } : DOCUMENTO.includes(m) ? AJENO : NEUTRO);
const fila = (m) => ({ ...base(m), ...(parche[m] || {}) });
// Lo recién creado no nace enlazado a ningún documento: con `quoteId: 102` heredado, `serializeJob` iba a
// leer el presupuesto ajeno y el alta de un Trabajo salía NO-DISTINGUE por obra del doble.
const CREADA = { id: 501, merchantId: 1, createdAt: ahora, updatedAt: ahora, name: 'NEUTRO-1390D', status: 'pendiente', estado: 'borrador',
  customerId: 5, customer: { ...NEUTRO.customer }, assignees: [], asignados: [], albaranes: [], quotes: [], invoices: [], quoteId: null, jobId: null, operarioId: null, assignedUserId: null };
const filaCreada = (m) => ({ ...(m === 'merchant' ? AJENO.merchant : CREADA), ...(parche[m] || {}) });
for (const m of modelos) {
  const d = prisma[m];
  const apunta = (op, args) => { apuntes.push({ modelo: m, op, where: args && args.where !== undefined ? args.where : null }); };
  const hay = () => pasada === 'B' || !!parche[m];
  for (const op of LECTURAS_UNA) d[op] = async (args) => { apunta(op, args); return hay() ? fila(m) : null; };
  d.findMany = async (args) => { apunta('findMany', args); return hay() ? [fila(m)] : []; };
  d.count = async (args) => { apunta('count', args); return hay() ? 1 : 0; };
  d.aggregate = async (args) => { apunta('aggregate', args); return { _sum: {}, _count: { _all: 0 }, _avg: {}, _max: {}, _min: {} }; };
  d.groupBy = async (args) => { apunta('groupBy', args); return []; };
  for (const op of ESCRITURAS) d[op] = async (args) => { apunta(op, args); if (/Many$/.test(op)) return { count: 1 };
    const dados = op === 'create' && args && args.data && typeof args.data === 'object' ? Object.fromEntries(Object.entries(args.data).filter(([, v]) => v === null || typeof v !== 'object' || v instanceof Date)) : {};
    return { ...(op === 'create' || op === 'upsert' ? filaCreada(m) : fila(m)), ...dados }; };
}
prisma.$transaction = async (x) => (typeof x === 'function' ? x(prisma) : Promise.all(x));
prisma.$queryRaw = async () => { apuntes.push({ modelo: '$raw', op: '$queryRaw', where: null }); return []; };
prisma.$queryRawUnsafe = prisma.$queryRaw;
prisma.$executeRaw = async () => 0;
prisma.$executeRawUnsafe = prisma.$executeRaw;

// ── EL PAR SEMBRADO, con validación delante: sin `sembrada` en el cuerpo contestan 400 sin consultar.
const S = '/admin/__siembra-1390c';
const SEMBRADAS = { noDistingue: { method: 'POST', path: S + '/no-distingue' }, recorta: { method: 'POST', path: S + '/recorta' } };
if (!SIN_SEMBRAR) {
  app.post(SEMBRADAS.noDistingue.path, async (req, res) => {
    if (!req.body || !req.body.sembrada) return res.status(400).json({ error: 'falta_sembrada' });
    const q = await prisma.quote.findFirst({ where: { id: Number(req.body.sembrada), merchantId: req.merchantId } });
    if (!q) return res.status(404).json({ error: 'not_found' });
    // SCRUM-1390d: el positivo del eje de la IA. Manda el documento leído al modelo, por el mismo transporte.
    await fetch('https://generativelanguage.googleapis.com/v1beta/models/sembrada:generateContent', { method: 'POST', body: JSON.stringify({ texto: q.customer.name }) });
    return res.json({ cliente: q.customer.name });
  });
  app.post(SEMBRADAS.recorta.path, async (req, res) => {
    if (!req.body || !req.body.sembrada) return res.status(400).json({ error: 'falta_sembrada' });
    const q = await prisma.quote.findFirst({ where: { id: Number(req.body.sembrada), merchantId: req.merchantId } });
    if (!q) return res.status(404).json({ error: 'not_found' });
    if (req.userRole === 'tecnico' && q.teamMemberId !== req.teamMemberId) return res.status(404).json({ error: 'not_found' });
    return res.json({ cliente: q.customer.name });
  });
}

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
function peticion(rol, ruta, method, extra) {
  const params = {};
  for (const seg of ruta.split('/')) if (seg.startsWith(':')) params[seg.slice(1)] = '102';
  const x = extra || {};
  const r = rol === 'admin' ? { userRole: 'admin', teamMemberId: null, isOwner: true } : { userRole: 'tecnico', teamMemberId: 11, isOwner: false };
  return { ...r, merchantId: 1, merchant: { ...AJENO.merchant, plan: 'pro', status: 'active' },
    params: { ...params, ...(x.params || {}) }, query: { q: 'obra', customerId: '5', mes: '2026-09', ...(x.query || {}) }, body: x.body ? JSON.parse(JSON.stringify(x.body)) : {},
    ...(x.req || {}),
    headers: { 'user-agent': 'medir-1390c', ...(x.headers || {}) }, method, path: ruta, originalUrl: ruta, url: ruta, ip: '127.0.0.1', cookies: x.cookies || {},
    get() { return undefined; }, header() { return undefined; }, socket: { remoteAddress: '127.0.0.1' }, app };
}
async function pedir(manos, req) {
  let estado = 200; let acabado = false; let cuerpo;
  const res = new PassThrough();
  res.on('error', () => {}); res.resume();
  const fin = (x) => { if (!acabado) cuerpo = x; acabado = true; return res; };
  res.status = (n) => { estado = n; return res; };
  res.sendStatus = (n) => { estado = n; return fin(); };
  res.json = (x) => fin(x); res.send = (x) => fin(x); res.end = (x) => fin(x);
  res.set = () => res; res.setHeader = () => res; res.header = () => res; res.type = () => res;
  res.attachment = () => res; res.cookie = () => res; res.locals = {};
  res.redirect = (a) => { estado = typeof a === 'number' ? a : 302; return fin(); };
  res.sendFile = () => fin(); res.download = () => fin();
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
  return { estado: error && !acabado ? 'EXC' : estado, error: error ? String(error.message || error).slice(0, 160) : null, cuerpo };
}
const canon = (x) => JSON.stringify(x, function (k, v) { return this[k] instanceof Date ? 'FECHA' : v; });
const texto = (c) => (c === undefined ? '' : Buffer.isBuffer(c) || c instanceof Uint8Array ? Buffer.from(c).toString('utf8') : typeof c === 'string' ? c : (() => { try { return canon(c); } catch { return '[no serializable]'; } })());
const corto = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s) || '—';
const marcasEn = (c) => Object.entries(MARCA).filter(([, v]) => texto(c).includes(v)).map(([k]) => k);
const soloDoc = (ap) => ap.filter((a) => DOCUMENTO.includes(a.modelo));
const firma = (ap, m) => soloDoc(ap).filter((a) => !m || a.modelo === m).map((a) => a.modelo + '.' + a.op + ' ' + canon(a.where)).join(' | ');
const esNo = (e) => e === 'EXC' || (typeof e === 'number' && e >= 400);

async function corre(d, extra) {
  const x = extra || {}; const guardada = {};
  for (const [k, v] of Object.entries(x.config || {})) { guardada[k] = config[k]; config[k] = v; }
  parche = x.filas || {};
  const manos = manosDe(d.method, d.path); const r = {};
  try {
    for (const p of ['A', 'B']) for (const rol of ['admin', 'tecnico']) {
      pasada = p; apuntes = []; const m0 = aMeta.length; const i0 = aIA.length;
      const out = await pedir(manos, peticion(rol, d.path, d.method, x));
      r[p + rol] = { ...out, apuntes, envios: aMeta.length - m0, ia: aIA.slice(i0) };
    }
  } finally { parche = {}; for (const [k, v] of Object.entries(guardada)) config[k] = v; }
  const C = ['Aadmin', 'Atecnico', 'Badmin', 'Btecnico'];
  const modelosDoc = [...new Set(C.flatMap((k) => soloDoc(r[k].apuntes).map((a) => a.modelo)))];
  const niegaB = [403, 404].includes(r.Btecnico.estado) && ![403, 404].includes(r.Badmin.estado);
  const porModelo = {};
  for (const m of modelosDoc) porModelo[m] = (niegaB || firma(r.Aadmin.apuntes, m) !== firma(r.Atecnico.apuntes, m) || firma(r.Badmin.apuntes, m) !== firma(r.Btecnico.apuntes, m)) ? 'RECORTA' : 'NO-DISTINGUE';
  let v;
  if (!modelosDoc.length && C.every((k) => esNo(r[k].estado))) v = 'NO-LLEGO';
  else if (!modelosDoc.length) v = 'SIN-DOCUMENTO';
  else if (Object.values(porModelo).includes('NO-DISTINGUE')) v = 'NO-DISTINGUE';
  else v = 'RECORTA';
  return { v, porModelo, niegaB, manos: manos.length, r,
    estados: `A adm ${r.Aadmin.estado} tec ${r.Atecnico.estado} · B adm ${r.Badmin.estado} tec ${r.Btecnico.estado}`,
    marcasTecB: marcasEn(r.Btecnico.cuerpo), marcasAdmB: marcasEn(r.Badmin.cuerpo),
    iaTecB: { llamadas: r.Btecnico.ia.length, marcas: marcasEn(r.Btecnico.ia.join('\n')) },
    whereTec: firma(r.Btecnico.apuntes) || firma(r.Atecnico.apuntes),
    otros: [...new Set(C.flatMap((k) => r[k].apuntes.filter((a) => !DOCUMENTO.includes(a.modelo)).map((a) => a.modelo + '.' + a.op)))],
    envios: C.reduce((n, k) => n + r[k].envios, 0) };
}

// ── LAS RECETAS: ocho de SCRUM-1514c (importadas) y siete de aquí. Cada una dice qué leyó.
// SCRUM-1390d: era `new URL(import.meta.url).pathname`, que deja `%20` en una ruta con espacios y
// reventaba aquí con código 1 y salida vacía, antes de medir nada. `fileURLToPath` la decodifica.
const { RECETAS: RECETAS_1514C } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'SCRUM-1514c', 'recetas.mjs')).href);
const IA = { GEMINI_API_KEY: 'texto-de-laboratorio-1390c' }; // un texto en memoria, no una clave: la red está cortada
const RECETAS_1390C = {
  'POST /admin/customers': { leido: 'customersAdmin.routes.ts:161 (customerCreateSchema, schemas.ts:547: name)',
    variantes: [{ nombre: 'alta de un cliente', body: { name: 'Cliente de laboratorio' } }] },
  'GET /admin/customers/:id/portal-url': { leido: 'customersAdmin.routes.ts:218 → ensurePortalToken (customerAdmin.ts:343)',
    variantes: [{ nombre: 'el enlace del portal de un cliente del negocio', filas: {} }] },
  'POST /admin/customers/:id/sites': { leido: 'customersAdmin.routes.ts:450 (customerSiteCreateSchema, schemas.ts:695: name)',
    variantes: [{ nombre: 'un sitio nuevo en un cliente del negocio', body: { name: 'Obra de laboratorio' } }] },
  'DELETE /admin/customers/:id/sites/:siteId': { leido: 'customersAdmin.routes.ts:489 (borrarSitio)',
    variantes: [{ nombre: 'borrar un sitio de un cliente del negocio', filas: {} }] },
  'GET /admin/attachments/:id': { leido: 'attachments.routes.ts:11 (busca por id y comercio; 404 si no hay bytes)',
    variantes: [{ nombre: 'la foto de un albarán del Trabajo del compañero', filas: { attachment: { data: Buffer.from(MARCA.foto), mime: 'image/jpeg', entityType: 'albaran', entityId: 102 } } }] },
  'POST /admin/ai/suggest-albaran-lines': { leido: 'ai.routes.ts:99 (flag VOICE_ALBARAN_ENABLED, IA, albaranId y description; albarán en borrador)',
    variantes: [{ nombre: 'sugerir líneas para el albarán del compañero', config: IA, body: { albaranId: 102, description: 'Cambiar el grifo de la cocina' },
      filas: { merchant: { flags: { VOICE_ALBARAN_ENABLED: true } }, albaran: { estado: 'borrador' } } }] },
  'POST /admin/expenses': { leido: 'expenses.routes.ts:179 (concept y amount; quoteId opcional)',
    variantes: [{ nombre: 'un gasto imputado al presupuesto del compañero', body: { concept: 'Material', amount: 10, quoteId: 102 } },
      { nombre: 'un gasto sin presupuesto', body: { concept: 'Material', amount: 10 } }] },
  [SEMBRADAS.noDistingue.method + ' ' + SEMBRADAS.noDistingue.path]: { leido: 'sembrada', variantes: [{ nombre: 'con su cuerpo', body: { sembrada: 102 } }] },
  [SEMBRADAS.recorta.method + ' ' + SEMBRADAS.recorta.path]: { leido: 'sembrada', variantes: [{ nombre: 'con su cuerpo', body: { sembrada: 102 } }] },
};
const RECETAS = { ...RECETAS_1514C, ...RECETAS_1390C };
const deDonde = (k) => (RECETAS_1390C[k] ? '1390c' : RECETAS_1514C[k] ? '1514c' : '—');

const sinMontar = Object.values(SEMBRADAS).filter((s) => !manosDe(s.method, s.path).length);
if (sinMontar.length) ciego(sinMontar.length + ' de 2 rutas sembradas no están montadas' + (SIN_SEMBRAR ? ' (--sin-sembrar)' : '') + ': sin ellas no puedo demostrar que distingo');

const ORDEN = ['NO-DISTINGUE', 'NO-LLEGO', 'SIN-DOCUMENTO', 'RECORTA'];
const filas = [];
for (const d of [...poblacion, ...Object.values(SEMBRADAS)]) {
  const clave = d.method + ' ' + d.path;
  const g = await corre(d, null);
  const rec = RECETAS[clave];
  const vs = [];
  if (rec) for (const va of rec.variantes) vs.push({ nombre: va.nombre, ...(await corre(d, va)) });
  const peor = vs.length ? ORDEN.find((o) => vs.some((x) => x.v === o)) : 'SIN-RECETA';
  filas.push({ ...d, clave, g, vs, v: peor, origen: deDonde(clave), leido: rec && rec.leido, entrega: vs.some((x) => x.marcasTecB.length), aLaIA: vs.some((x) => x.iaTecB.marcas.length) });
}
const sembradas = filas.filter((f) => f.path.startsWith(S + '/'));
const medidas = filas.filter((f) => !f.path.startsWith(S + '/'));

console.log('SCRUM-1390c · las NO-LLEGO del censo del ROL, con receta · admin vs técnico (id 11) · el ajeno es del compañero (id 12)');
console.log('POBLACION: ' + medidas.length + ' rutas leídas de la sección NO-LLEGO del censo (que declara ' + declaradas + ') · con receta ' + medidas.filter((f) => f.vs.length).length
  + ' (de 1514c ' + medidas.filter((f) => f.origen === '1514c').length + ', de 1390c ' + medidas.filter((f) => f.origen === '1390c').length + ') · modelos de documento: ' + DOCUMENTO.join(', '));
for (const o of [...ORDEN, 'SIN-RECETA']) {
  const l = medidas.filter((f) => f.v === o);
  console.log('\n== ' + o + ' · ' + l.length);
  for (const f of l) {
    console.log(`${f.method.padEnd(6)} ${f.path}  [receta de ${f.origen}]  · sin receta: ${f.g.v} (${f.g.estados})`);
    for (const x of f.vs) {
      const pm = Object.entries(x.porModelo).map(([m, y]) => m + '=' + y).join(' · ');
      console.log(`         · ${x.nombre} → ${x.v}${pm ? ' [' + pm + ']' : ''} · ${x.estados}` + (x.niegaB ? ' (al técnico le NIEGA el ajeno)' : '') + (x.envios ? ' · envíos a Meta (doblado): ' + x.envios : ''));
      console.log(`           al técnico, en B, le llega: ${x.marcasTecB.length ? '🔴 ' + x.marcasTecB.join(', ') : 'ninguna marca del ajeno'} · contesta: ${corto(texto(x.r.Btecnico.cuerpo), 160)}` + (x.r.Btecnico.error ? ' · error: ' + x.r.Btecnico.error : ''));
      if (x.iaTecB.llamadas) console.log(`           a la IA (doblada), desde el técnico en B: ${x.iaTecB.llamadas} llamada(s) · ${x.iaTecB.marcas.length ? '🔴 viaja ' + x.iaTecB.marcas.join(', ') : 'ninguna marca del ajeno'}`);
      if (x.whereTec) console.log('           consulta del técnico: ' + corto(x.whereTec, 300));
      if (x.otros.length) console.log('           otros modelos: ' + corto(x.otros.join(', '), 300));
    }
  }
}

// ── La cadena del portal: el enlace que pide el técnico, abierto
console.log('\n── LA CADENA DEL PORTAL (customers/:id/portal-url → GET /cliente/:token), pasada B, técnico');
const pu = await corre({ method: 'GET', path: '/admin/customers/:id/portal-url' }, RECETAS_1390C['GET /admin/customers/:id/portal-url'].variantes[0]);
const tokenTec = pu.r.Btecnico.cuerpo && pu.r.Btecnico.cuerpo.token;
console.log('  1 · el técnico pide el enlace → ' + pu.r.Btecnico.estado + ' · token ' + (tokenTec ? 'recibido' : 'NO recibido') + ' · consulta: ' + pu.otros.join(', '));
const capaPortal = portal.stack.find((l) => l.route && l.route.path === '/:token' && l.route.methods.get);
let cadena = null;
if (tokenTec && capaPortal) {
  pasada = 'B'; apuntes = []; parche = { customer: { portalToken: tokenTec } };
  const out = await pedir(capaPortal.route.stack, { ...peticion('tecnico', '/:token', 'GET'), params: { token: tokenTec }, userRole: undefined, teamMemberId: undefined, merchantId: undefined });
  parche = {};
  const html = texto(out.cuerpo);
  cadena = { estado: out.estado, marcas: marcasEn(out.cuerpo), docs: soloDoc(apuntes).map((a) => a.modelo + '.' + a.op + ' ' + canon(a.where)), bytes: html.length };
  console.log('  2 · se abre el portal con ese token → ' + out.estado + ' · ' + cadena.bytes + ' B de HTML · marcas del ajeno en la página: ' + (cadena.marcas.length ? '🔴 ' + cadena.marcas.join(', ') : 'ninguna'));
  console.log('      consultas de documento: ' + corto(cadena.docs.join(' | '), 400));
  const i = html.indexOf(MARCA.concepto); if (i >= 0) console.log('      alrededor del concepto: ' + JSON.stringify(html.slice(Math.max(0, i - 120), i + 60)));
} else console.log('  2 · NO SE PUDO ABRIR: ' + (!tokenTec ? 'sin token' : 'no encuentro GET /:token en el router del portal'));

// ── CONTROLES
console.log('\n── CONTROLES (sembradas: no existen en el producto ni cuentan en los totales)');
const sv = (p) => sembradas.find((f) => f.path === p);
const nd = sv(SEMBRADAS.noDistingue.path); const rc = sv(SEMBRADAS.recorta.path);
const c1 = nd.g.v === 'NO-LLEGO' && rc.g.v === 'NO-LLEGO';
const c2 = nd.v === 'NO-DISTINGUE' && nd.entrega === true;
const c3 = rc.v === 'RECORTA' && rc.entrega === false;
const c4 = medidas.length === declaradas;
const c5 = fugas.length === 0;
const c6 = nd.aLaIA === true && rc.aLaIA === false;
console.log('  sin su cuerpo, las dos sembradas salen NO-LLEGO (lo que el censo veía)  ' + c1 + '  (' + nd.g.v + ', ' + rc.g.v + ')');
console.log('  con su cuerpo, la que no distingue sale NO-DISTINGUE y entrega el ajeno  ' + c2 + '  (' + nd.v + ', entrega ' + nd.entrega + ')');
console.log('  con su cuerpo, la que recorta sale RECORTA y no entrega nada            ' + c3 + '  (' + rc.v + ', entrega ' + rc.entrega + ')');
console.log('  la que no distingue manda el ajeno a la IA doblada; la que recorta, no     ' + c6 + '  (' + nd.aLaIA + ', ' + rc.aLaIA + ')');
console.log('  filas del producto ' + medidas.length + ' de ' + declaradas + '  ' + c4);
console.log('  intentos de salir de la máquina cortados: ' + fugas.length + (fugas.length ? ' → ' + [...new Set(fugas)].join(', ') : '') + ' · envíos a Meta doblados: ' + aMeta.length);
const ok = c1 && c2 && c3 && c4 && c6;
console.log('TOTALES (el peor veredicto de cada ruta): ' + [...ORDEN, 'SIN-RECETA'].map((o) => o + ' ' + medidas.filter((f) => f.v === o).length).join(' · ') + ' · suma ' + medidas.length
  + ' · al técnico le llega una marca del ajeno en ' + medidas.filter((f) => f.entrega).length
  + ' · el ajeno viaja a la IA desde el técnico en ' + medidas.filter((f) => f.aLaIA).length);
console.log('EXIT=' + (ok ? 0 : 1));
process.exit(ok ? 0 : 1);
