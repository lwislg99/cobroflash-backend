// SCRUM-1509f - QUE LIMITE DE PETICIONES hay delante del webhook de entrantes de WhatsApp, y cuantos
// avisos al profesional produce UN cliente escribiendo: los dos llamadores de `notifyMerchantAlert`
// que c.18914 dejo sin freno (`whatsappIncoming.routes.ts:409`, texto de un cliente con albaran, y
// `:297`, la BAJA).
//
// Se carga la APP ENTERA de `dist/app.js` (con su pila real: lectores de cuerpo, la verificacion de
// firma, el montaje del webhook) y se le pide por HTTP. Se doblan la base (en memoria, con estado; lo
// no modelado se contesta neutro y SE APUNTA) y el transporte de axios (no sale un byte).
// El andamio de la base y del transporte es el de `SCRUM-1509d/avisos.cjs` (PR #2301); lo nuevo es
// la app entera, la lectura de la pila, el contador de 429 con su positivo, el lote y la BAJA repetida.
//
// Uso:  node limite.cjs <dist> [--esperado-menos-uno]
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
for (const k of ['WHATSAPP_DRY_RUN', 'WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP', 'BOT_INBOUND_ENABLED', 'E2E_TEST_LOGIN_ENABLED', 'E2E_TEST_LOGIN_SECRET', 'INTERNAL_API_SECRET']) delete process.env[k];

const RealDate = Date;
let desfaseMs = 0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfaseMs); else super(...a); }
  static now() { return RealDate.now() + desfaseMs; }
}
global.Date = FakeDate;
{ const d = new RealDate(); d.setHours(12, 0, 0, 0); desfaseMs = d.getTime() - RealDate.now(); }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const MERCHANT = 7; const MERCHANT2 = 8;
const SECRETO = 'laboratorio-1509f';
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
const tabla = (nombre) => ({
  findMany: async ({ where, take } = {}) => t[nombre].filter((f) => casa(f, where)).slice(0, take || undefined),
  findFirst: async ({ where } = {}) => { const v = t[nombre].filter((f) => casa(f, where)); return v[v.length - 1] || null; },
  findUnique: async ({ where }) => t[nombre].find((f) => casa(f, where)) || null,
  count: async ({ where } = {}) => t[nombre].filter((f) => casa(f, where)).length,
  create: async ({ data }) => { const f = { id: t[nombre].length + 1, createdAt: new FakeDate(), ...data }; t[nombre].push(f); return f; },
  createMany: async ({ data }) => { for (const d of [].concat(data)) t[nombre].push({ id: t[nombre].length + 1, createdAt: new FakeDate(), ...d }); return { count: [].concat(data).length }; },
  update: async ({ where, data }) => { const f = t[nombre].find((x) => casa(x, where)); if (!f) { const e = new Error('no casa'); e.code = 'P2025'; throw e; } Object.assign(f, data); return f; },
  updateMany: async ({ where, data }) => { const v = t[nombre].filter((x) => casa(x, where)); v.forEach((f) => Object.assign(f, data)); if (nombre === 'customer') est.escriturasDeBaja.push(v.length); return { count: v.length }; },
});
const NOMBRES = ['customer', 'merchant', 'quote', 'whatsAppMessage', 'botSession', 'charge', 'event'];
const modelos = {};
for (const n of NOMBRES) modelos[n] = tabla(n);
modelos.whatsAppMessage.count = async ({ where }) => {
  const n = t.whatsAppMessage.filter((f) => casa(f, where)).length;
  est.preguntas.push({ conCliente: 'customerId' in where, respuesta: n });
  return n;
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
// El host del proveedor NO se escribe aqui: se lee del modulo compilado que habla con el.
const HOST_DEL_TRANSPORTE = (() => { const m = /https:\/\/([a-z0-9.-]+)\/v\d+/.exec(require('fs').readFileSync(path.join(dist, 'integrations/whatsapp.js'), 'utf8')); if (!m) { console.log('GUION MUDO: no se pudo leer el host del transporte'); process.exit(2); } return m[1]; })();
const axios = requiereDist('axios');
let serieSalida = 0;
let PROF; let PROF2; let CLI;
axios.defaults.adapter = async (cfg) => {
  let cuerpo = {};
  try { cuerpo = JSON.parse(cfg.data); } catch { /* vacio */ }
  const tipo = String(cuerpo.type || (cuerpo.status ? 'leido' : 'ilegible'));
  est.salidas.push({ host: new URL(String(cfg.url)).host, tipo, to: String(cuerpo.to || '') });
  const resp = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
  // texto al PROFESIONAL con su ventana cerrada: el proveedor lo rechaza y el aviso cae a la plantilla
  if (tipo !== 'template' && (cuerpo.to === PROF || cuerpo.to === PROF2) && !modo.ventanaDelProfesionalAbierta) {
    throw new axios.AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', cfg, {}, resp(400, { error: { message: 'laboratorio: fuera de ventana', code: 131047 } }));
  }
  return resp(200, { messages: [{ id: 'wamid.salida-1509f.' + (++serieSalida) }] });
};

const trazas = [];
console.error = (...a) => trazas.push(a.map(String).join(' '));
console.warn = (...a) => trazas.push(a.map(String).join(' '));
const hablar = console.log;
console.log = () => {};

let puerto; let tel; let normalizePhone;
let serieEntrada = 0;
const noCuadran = []; const filas = [];

function nuevoCaso(m) {
  modo = { ...m };
  trazas.length = 0;
  t = {}; for (const n of NOMBRES) t[n] = [];
  est = { salidas: [], preguntas: [], avisos: 0, http: {}, escriturasDeBaja: [] };
  t.merchant.push({ id: MERCHANT, name: 'Taller Sonda', legalName: 'Taller Sonda', whatsappPhone: PROF, flags: null, country: 'ES', publicSlug: null });
  t.customer.push({ id: 50, merchantId: MERCHANT, name: 'Cliente Sonda', phone: CLI, mobile: null, waOptOut: !!m.yaDeBaja });
  if (m.dosComercios) {
    t.merchant.push({ id: MERCHANT2, name: 'Otro Taller', legalName: 'Otro Taller', whatsappPhone: PROF2, flags: null, country: 'ES', publicSlug: null });
    t.customer.push({ id: 51, merchantId: MERCHANT2, name: 'Cliente Sonda', phone: CLI, mobile: null, waOptOut: !!m.yaDeBaja });
  }
  delete process.env.BOT_INBOUND_ENABLED;
}
const conAlbaran = () => t.whatsAppMessage.push({ id: 9000, merchantId: MERCHANT, customerId: 50, type: 'template', relatedType: 'albaran', relatedId: 1, waMessageId: 'wamid.albaran', status: 'sent',
  createdAt: new FakeDate(FakeDate.now() - 3 * 24 * 3600 * 1000) });

function pedir(ruta, cuerpo, cabeceras) {
  return new Promise((resolve, reject) => {
    const datos = Buffer.from(cuerpo || '');
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': datos.length, ...(cabeceras || {}) } }, (res) => {
      res.resume(); res.on('end', () => { est.http[res.statusCode] = (est.http[res.statusCode] || 0) + 1; resolve(res.statusCode); });
    });
    req.on('error', reject); req.end(datos);
  });
}
// el webhook contesta 200 y SIGUE trabajando por detras: se espera a que deje de moverse
async function asentar() {
  let antes = -1; let quietos = 0;
  for (let i = 0; i < 400 && quietos < 3; i += 1) {
    await dormir(15);
    const ahora = est.salidas.length + est.avisos + trazas.length + t.whatsAppMessage.length;
    quietos = ahora === antes ? quietos + 1 : 0; antes = ahora;
  }
}
// UNA peticion con `mensajes` dentro (el proveedor puede agrupar varias entregas en un POST)
async function entrega(mensajes, opciones) {
  const o = opciones || {};
  const msgs = mensajes.map((m) => ({ from: o.from || CLI, id: 'wamid.entrada-1509f.' + (++serieEntrada), ...m }));
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: msgs } }] }] });
  const firma = o.firmaMala ? 'sha256=' + '0'.repeat(64) : 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex');
  await pedir('/webhooks/whatsapp', cuerpo, { 'x-hub-signature-256': firma });
  await asentar();
}
const texto = (body) => ({ type: 'text', text: { body } });

function resumen() {
  const alProf = est.salidas.filter((p) => p.to === PROF || p.to === PROF2);
  return {
    avisos: est.avisos,
    plantillasAlProfesional: alProf.filter((p) => p.tipo === 'template').length,
    plantillasAlCliente: est.salidas.filter((p) => p.to === CLI && p.tipo === 'template').length,
    textosAlCliente: est.salidas.filter((p) => p.to === CLI && p.tipo !== 'template' && p.tipo !== 'leido').length,
    hostAjeno: est.salidas.filter((p) => p.host !== HOST_DEL_TRANSPORTE).length,
    erroresDeManejador: trazas.filter((l) => /handler error|button error|Parse error|photo error/.test(l)).length,
    bloqueoComercio: trazas.filter((l) => /alcanz. el tope diario de plantillas/.test(l)).length,
    http429: est.http[429] || 0,
    http: Object.entries(est.http).map(([k, v]) => k + 'x' + v).join(' ') || '-',
    filasDePlantillaHoy: t.whatsAppMessage.filter((f) => f.type === 'template' && f.id !== 9000 && f.waMessageId).length,
  };
}
function anotar(nombre, esperado) {
  const r = resumen();
  const fallos = [];
  for (const [k, v] of Object.entries(esperado || {})) {
    if (!(k in r)) fallos.push(k + ': el esperado nombra una clave que el resumen no tiene');
    else if (r[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + r[k]);
  }
  if (r.hostAjeno) fallos.push('peticiones a un host que no es el del transporte: ' + r.hostAjeno);
  if (r.erroresDeManejador) fallos.push('el manejador revento ' + r.erroresDeManejador + ' veces: el caso NO vale (' + trazas.filter((l) => /handler error/.test(l))[0] + ')');
  if (fallos.length) noCuadran.push(nombre);
  filas.push({ nombre, r, fallos });
  hablar((fallos.length ? 'ROJO   ' : 'cuadra ') + nombre.padEnd(78) + ' avisos=' + String(r.avisos).padStart(3) + ' plantProf=' + String(r.plantillasAlProfesional).padStart(3)
    + ' textosCli=' + String(r.textosAlCliente).padStart(3) + ' bloqCom=' + String(r.bloqueoComercio).padStart(3) + ' 429=' + String(r.http429).padStart(2) + ' http=' + r.http
    + (fallos.length ? '  <<< ' + fallos.join(' | ') : ''));
  return r;
}

// -- la cadena, leida de la pila de la app cargada (no del texto de app.ts) -------------------
const nombreDe = (capa) => (capa.handle && capa.handle.name) || capa.name || '<anonima>';
function cadena(app, metodo, ruta) {
  const fuera = [];
  app.router.stack.forEach((capa, i) => {
    let casaCapa = false;
    try { casaCapa = capa.match(ruta); } catch { casaCapa = false; }
    if (!casaCapa) return;
    if (capa.route) { if (capa.route.methods[metodo] || capa.route.methods._all) fuera.push({ i, que: 'ruta ' + metodo.toUpperCase() + ' ' + capa.route.path, dentro: [] }); return; }
    const montada = capa.handle && Array.isArray(capa.handle.stack);
    const item = { i, que: (montada ? 'ROUTER ' : '') + nombreDe(capa), prefijo: capa.path || '', dentro: [] };
    if (montada) {
      const resto = ruta.slice((capa.path || '').length) || '/';
      capa.handle.stack.forEach((c2, j) => {
        let casa2 = false;
        try { casa2 = c2.match(resto); } catch { casa2 = false; }
        if (!casa2) return;
        if (c2.route) {
          if (!(c2.route.methods[metodo] || c2.route.methods._all)) return;
          item.dentro.push({ j, que: 'ruta ' + metodo.toUpperCase() + ' ' + c2.route.path, manos: c2.route.stack.map(nombreDe) });
        } else item.dentro.push({ j, que: nombreDe(c2), manos: [] });
      });
    }
    fuera.push(item);
  });
  return fuera;
}
function pintarCadena(titulo, laMia, idsDeNadie) {
  hablar('  ' + titulo);
  for (const c of laMia) {
    hablar('    [' + String(c.i).padStart(3) + '] ' + (idsDeNadie.has(c.i) ? '(toda peticion)  ' : '(SOLO esta zona) ') + c.que + (c.prefijo ? '  montada en ' + c.prefijo : ''));
    for (const d of (c.dentro || [])) hablar('           dentro [' + d.j + '] ' + d.que + (d.manos.length ? '  ->  manos: ' + d.manos.length + ' (' + d.manos.join(' , ') + ')' : ''));
  }
}

(async () => {
  tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1509f';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1509f';
  config.WHATSAPP_APP_SECRET = SECRETO;
  const C = config.WA_CUSTOMER_DAILY_CAP; const D = config.WA_DAILY_TEMPLATE_CAP;
  normalizePhone = require(path.join(dist, 'core/utils/utils.js')).normalizePhone;
  PROF = normalizePhone(tel.telefonoDePrueba(900)); PROF2 = normalizePhone(tel.telefonoDePrueba(901)); CLI = normalizePhone(tel.telefonoDePrueba(150));
  if (!PROF || !PROF2 || !CLI || new Set([PROF, PROF2, CLI]).size !== 3) { hablar('GUION MUDO: telefonos de prueba no validos'); process.exit(2); }
  const notif = require(path.join(dist, 'integrations/whatsappNotifications.js'));
  nuevoCaso({});
  const avisoOriginal = notif.notifyMerchantAlert;
  notif.notifyMerchantAlert = async (p) => { est.avisos += 1; return avisoOriginal(p); };
  if (notif.notifyMerchantAlert === avisoOriginal) { hablar('GUION MUDO: no se pudo contar el aviso'); process.exit(2); }

  const { app } = require(path.join(dist, 'app.js'));
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidor.address().port;
  hablar('app cargada de ' + path.relative(process.cwd(), path.join(dist, 'app.js')) + ' · NODE_ENV=' + config.NODE_ENV + ' · capas en la pila de la app: ' + app.router.stack.length);
  hablar('topes leidos en dist: por cliente y dia = ' + C + ' · por comercio y dia = ' + D + (menosUno ? '  [ESPERADO -1: este guion debe salir rojo]' : ''));
  const rep = (n) => (menosUno ? n - 1 : n);
  const N = 10; const M = D + 20;

  // ---------------------------------------------------------------------------------------
  hablar('\n== 1 · LA CADENA delante de POST /webhooks/whatsapp (pila de la app cargada) ==');
  const deNadie = cadena(app, 'post', '/zzz-no-existe-1509f/x');
  const idsDeNadie = new Set(deNadie.map((c) => c.i));
  const laMia = cadena(app, 'post', '/webhooks/whatsapp');
  const laDeLogin = cadena(app, 'post', '/auth/login');
  pintarCadena('POST /webhooks/whatsapp', laMia, idsDeNadie);
  pintarCadena('POSITIVO · POST /auth/login (una ruta que SI lleva limitador)', laDeLogin.filter((c) => !idsDeNadie.has(c.i)), idsDeNadie);
  const propias = laMia.filter((c) => !idsDeNadie.has(c.i));
  const routerWa = propias.find((c) => c.prefijo === '/webhooks/whatsapp');
  const rutaWa = routerWa && routerWa.dentro.find((d) => d.que.startsWith('ruta '));
  const noRutaWa = routerWa ? routerWa.dentro.filter((d) => !d.que.startsWith('ruta ')) : [];
  const routerLogin = laDeLogin.find((c) => c.prefijo === '/auth');
  const rutaLogin = routerLogin && routerLogin.dentro.find((d) => d.que.startsWith('ruta '));
  if (!rutaWa || !rutaLogin) { hablar('GUION MUDO: la lectura de la pila no encuentra la ruta del webhook o la de login.'); process.exit(2); }
  hablar('  capas que casan con el webhook: ' + laMia.length + ' · propias de esta zona: ' + propias.length + ' · una ruta inventada casa ' + deNadie.length + ' (control)');
  hablar('  manos de la ruta del webhook: ' + rutaWa.manos.length + ' · capas de su router que no son ruta y casan: ' + noRutaWa.length);
  hablar('  manos de la ruta de login (positivo): ' + rutaLogin.manos.length + '  <- la mano de mas es su limitador');
  { const ok = propias.length === 1 && rutaWa.manos.length === 1 && noRutaWa.length === 0 && rutaLogin.manos.length === 2;
    if (!ok) noCuadran.push('CADENA'); filas.push({ nombre: 'CADENA', r: {}, fallos: ok ? [] : ['x'] });
    hablar((ok ? 'cuadra ' : 'ROJO   ') + 'CADENA: delante del manejador del webhook no hay ninguna mano propia (1 capa propia, 1 mano); login tiene 2'); }

  // ---------------------------------------------------------------------------------------
  hablar('\n== 2 · CONTROLES ==');
  nuevoCaso({});
  for (let i = 0; i < 7; i += 1) await pedir('/auth/login', JSON.stringify({ email: 'mismo@example.invalid' }));
  const kp = anotar('K+ POSITIVO del contador de 429: /auth/login, 7 seguidas, mismo correo', { http429: 2, avisos: 0 });
  nuevoCaso({});
  for (let i = 0; i < 7; i += 1) await pedir('/auth/login', JSON.stringify({ email: 'distinto' + i + '@example.invalid' }));
  anotar('K0 CERO del contador de 429: /auth/login, 7 seguidas, 7 correos', { http429: 0, avisos: 0 });
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < M; i += 1) await entrega([texto('hola ' + i)], { firmaMala: true });
  anotar('K1 CERO: ' + M + ' entrantes con la firma MALA', { avisos: 0, plantillasAlProfesional: 0, textosAlCliente: 0, http429: 0, http: '401x' + M });
  nuevoCaso({});
  await entrega([texto('hola')], { from: normalizePhone(tel.telefonoDePrueba(777)) });
  anotar('K2 CERO: entrante valido de un numero que no es cliente de nadie', { avisos: 0, plantillasAlProfesional: 0, http: '200x1' });
  nuevoCaso({});
  await entrega([texto('BAJA')], { from: normalizePhone(tel.telefonoDePrueba(777)) });
  anotar('K3 CERO: BAJA de un numero que no es cliente de nadie', { avisos: 0, plantillasAlProfesional: 0, http: '200x1' });
  nuevoCaso({}); conAlbaran();
  await entrega([texto('una duda del albaran')]);
  const k4 = anotar('K4 POSITIVO: cliente con albaran escribe 1 vez', { avisos: 1, plantillasAlProfesional: 1, textosAlCliente: 1, http: '200x1' });
  nuevoCaso({ ventanaDelProfesionalAbierta: true }); conAlbaran();
  for (let i = 0; i < M; i += 1) await entrega([texto('mensaje ' + i)]);
  anotar('K5 CERO de plantillas: ' + M + ' textos con la ventana del profesional ABIERTA', { avisos: M, plantillasAlProfesional: 0, bloqueoComercio: 0, http429: 0 });

  // ---------------------------------------------------------------------------------------
  hablar('\n== 3 · :409 · UN cliente con albaran escribe ' + M + ' textos, ventana del profesional CERRADA ==');
  nuevoCaso({}); conAlbaran();
  for (let i = 0; i < M; i += 1) await entrega([texto('mensaje ' + i)]);
  const l1 = anotar('L1 ' + M + ' peticiones, 1 mensaje cada una, seguidas', { avisos: rep(M), plantillasAlProfesional: D, bloqueoComercio: M - D, http429: 0, http: '200x' + M });
  nuevoCaso({}); conAlbaran();
  await entrega(Array.from({ length: M }, (_, i) => texto('mensaje ' + i)));
  const l2 = anotar('L2 UNA sola peticion con ' + M + ' mensajes dentro (lote)', { avisos: rep(M), http429: 0, http: '200x1' });
  hablar('       OBSERVADO en L2, sin esperado (los ' + M + ' corren a la vez sobre una base EN MEMORIA): plantillas al profesional = ' + l2.plantillasAlProfesional
    + ' · bloqueadas por el tope de comercio = ' + l2.bloqueoComercio + ' · filas de plantilla escritas hoy = ' + l2.filasDePlantillaHoy + ' · tope = ' + D);
  nuevoCaso({}); conAlbaran();
  await Promise.all(Array.from({ length: M }, (_, i) => {
    const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: CLI, id: 'wamid.entrada-1509f.' + (++serieEntrada), ...texto('mensaje ' + i) }] } }] }] });
    return pedir('/webhooks/whatsapp', cuerpo, { 'x-hub-signature-256': 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex') });
  }));
  await asentar();
  const l3 = anotar('L3 ' + M + ' peticiones de 1 mensaje, lanzadas A LA VEZ', { avisos: rep(M), http429: 0, http: '200x' + M });
  hablar('       OBSERVADO en L3, sin esperado (misma salvedad): plantillas al profesional = ' + l3.plantillasAlProfesional + ' · bloqueadas = ' + l3.bloqueoComercio + ' · tope = ' + D);

  // ---------------------------------------------------------------------------------------
  hablar('\n== 4 · :297 · BAJA repetida ==');
  nuevoCaso({});
  await entrega([texto('BAJA')]);
  const b1 = anotar('B1 primera BAJA de un cliente que NO estaba de baja', { avisos: 1, plantillasAlProfesional: 1, textosAlCliente: 1 });
  hablar('       tras B1 el cliente queda con waOptOut=' + t.customer[0].waOptOut + ' · filas tocadas por la escritura de baja: ' + est.escriturasDeBaja.join(','));
  if (t.customer[0].waOptOut !== true) { noCuadran.push('B1-estado'); hablar('ROJO   B1: la baja no quedo escrita'); }
  nuevoCaso({ yaDeBaja: true });
  for (let i = 0; i < N; i += 1) await entrega([texto('BAJA')]);
  anotar('B2 un cliente que YA esta de baja escribe BAJA ' + N + ' veces', { avisos: rep(N), plantillasAlProfesional: rep(N), textosAlCliente: N, http429: 0 });
  nuevoCaso({ yaDeBaja: true });
  for (let i = 0; i < N; i += 1) await entrega([texto(['stop', 'Baja.', 'STOP!', 'baja'][i % 4])]);
  anotar('B3 lo mismo con las grafias que la ruta acepta (stop, Baja., STOP!, baja)', { avisos: rep(N), plantillasAlProfesional: rep(N) });
  nuevoCaso({ yaDeBaja: true });
  for (let i = 0; i < N; i += 1) await entrega([texto('quiero la baja')]);
  anotar('B4 CERO: ' + N + ' textos que NO son la orden de baja (cliente sin albaran)', { avisos: 0, plantillasAlProfesional: 0 });
  nuevoCaso({ yaDeBaja: true });
  for (let i = 0; i < M; i += 1) await entrega([texto('BAJA')]);
  const b5 = anotar('B5 un cliente YA de baja escribe BAJA ' + M + ' veces', { avisos: rep(M), plantillasAlProfesional: D, bloqueoComercio: M - D, textosAlCliente: M, http429: 0 });
  nuevoCaso({ yaDeBaja: true, dosComercios: true });
  for (let i = 0; i < N; i += 1) await entrega([texto('BAJA')]);
  anotar('B6 el mismo numero es cliente de DOS comercios y escribe BAJA ' + N + ' veces', { avisos: rep(2 * N), plantillasAlProfesional: rep(2 * N), textosAlCliente: N });
  nuevoCaso({ yaDeBaja: true, ventanaDelProfesionalAbierta: true });
  for (let i = 0; i < N; i += 1) await entrega([texto('BAJA')]);
  anotar('B7 CERO de plantillas: BAJA ' + N + ' veces con la ventana del profesional ABIERTA', { avisos: N, plantillasAlProfesional: 0 });

  // ---------------------------------------------------------------------------------------
  hablar('\n== lo que la base en memoria contesto SIN modelarlo (valor neutro), toda la corrida ==');
  const nm = Object.entries(noModeladas).sort();
  hablar(nm.length ? nm.map(([k, v]) => '  ' + k + ' x' + v).join('\n') : '  (nada)');
  const totalAvisos = filas.reduce((s, f) => s + (f.r.avisos || 0), 0);
  const total429 = filas.reduce((s, f) => s + (f.r.http429 || 0), 0);
  hablar('\nCASOS: ' + filas.length + ' · cuadran: ' + (filas.length - noCuadran.length) + ' · NO cuadran: ' + noCuadran.length + ' · avisos contados en total: ' + totalAvisos + ' · respuestas 429 en total: ' + total429 + ' (todas de /auth/login)');
  hablar('POSITIVOS OBLIGATORIOS: K+ vio ' + kp.http429 + ' respuestas 429 · K4 conto ' + k4.avisos + ' aviso · L1 vio ' + l1.bloqueoComercio + ' bloqueos de comercio · B1 conto ' + b1.avisos + ' aviso · B5 vio ' + b5.bloqueoComercio + ' bloqueos (los cinco > 0).');
  servidor.close();
  if (!(kp.http429 > 0) || !(k4.avisos > 0) || !(l1.bloqueoComercio > 0) || !(b1.avisos > 0) || !(b5.bloqueoComercio > 0)) { hablar('GUION MUDO: el instrumento no ve lo que tiene que ver.'); process.exit(2); }
  process.exit(noCuadran.length ? 1 : 0);
})().catch((e) => { hablar('GUION ROTO: ' + ((e && e.stack) || e)); process.exit(2); });
