// SCRUM-1509e - QUIEN puede llamar a POST /admin/invoices/:id/send-reminder y CUANTAS veces.
//
// Lo que 1509d dejo SIN MEDIR: alli el rol y el comercio los ponia el guion y la ruta se montaba
// sola en un express propio. Aqui se carga la APP ENTERA de `dist/app.js`, con su cadena de
// montaje tal cual, y se le pide por HTTP. Se doblan dos cosas, y solo esas:
//   - LA BASE: un `prisma` en memoria con estado (sesiones, facturas, registro de mensajes).
//   - EL TRANSPORTE de axios: no sale un byte; cada peticion a Meta se ANOTA y se contesta aqui.
// No se usa WHATSAPP_DRY_RUN. No se toca ningun fichero de `src/`.
//
// Uso:  node medir.cjs <dist> [--comercio-esperado N]
//   --comercio-esperado N  NO cambia el producto: cambia el tope de comercio con que ESTE guion
//                          calcula lo que espera. Sirve para verlo en rojo.
// Sale 0 si todo cuadra, 1 si algun caso no cuadra, 2 si el guion se rompe o sale mudo.
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const dist = path.resolve(process.argv[2] || 'dist');
const iCom = process.argv.indexOf('--comercio-esperado');
const comercioForzado = iCom > 0 ? Number(process.argv[iCom + 1]) : null;

if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('CIEGO: proceso de test; el freno de SCRUM-180 lanzaria antes de salir.'); process.exit(2);
}
for (const k of ['WHATSAPP_DRY_RUN', 'WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP', 'E2E_TEST_LOGIN_ENABLED', 'E2E_TEST_LOGIN_SECRET', 'INTERNAL_API_SECRET']) delete process.env[k];

// -- reloj: mediodia, para que ninguna tanda cruce la medianoche ----------------------------
const RealDate = Date;
let desfaseMs = 0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfaseMs); else super(...a); }
  static now() { return RealDate.now() + desfaseMs; }
}
global.Date = FakeDate;
{ const d = new RealDate(); d.setHours(12, 0, 0, 0); desfaseMs = d.getTime() - RealDate.now(); }

// -- base en memoria, con estado -------------------------------------------------------------
const M_PROPIO = 7; const M_AJENO = 8; const M_PRUEBA_VENCIDA = 9;
let t = {};
let est = {};
const noModeladas = {};

function casa(fila, where) {
  for (const [k, v] of Object.entries(where || {})) {
    if (v === undefined) continue;
    const x = fila[k];
    if (v !== null && typeof v === 'object' && !(v instanceof RealDate)) {
      for (const [op, val] of Object.entries(v)) {
        if (op === 'gte') { if (!(x >= val)) return false; }
        else if (op === 'not') { if (val === null) { if (x == null) return false; } else if (x === val) return false; }
        else throw new Error('INSTRUMENTO: operador no modelado en el where: ' + op);
      }
    } else if (v === null) { if (x != null) return false; }
    else if (x !== v) return false;
  }
  return true;
}
const neutro = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }),
  upsert: async () => ({ id: 1 }), aggregate: async () => ({}), groupBy: async () => [] };
const modelos = {
  authSession: {
    // lo que lee `getSession`: la fila por su token, con el comercio y el miembro del equipo
    findUnique: async ({ where }) => { est.lecturasSesion += 1; return t.authSession.find((s) => s.token === where.token) || null; },
  },
  customer: { findMany: async () => [] }, // la lectura de la BAJA: nadie esta de baja
  whatsAppMessage: {
    create: async ({ data }) => { t.whatsAppMessage.push({ ...data, createdAt: new FakeDate() }); return { id: t.whatsAppMessage.length }; },
    count: async ({ where }) => {
      const n = t.whatsAppMessage.filter((f) => casa(f, where)).length;
      est.preguntas.push({ conCliente: 'customerId' in where, respuesta: n });
      return n;
    },
    findFirst: async () => null, // la ventana de 24 h: cerrada
  },
  invoice: {
    findFirst: async ({ where }) => {
      const f = t.invoice.find((x) => casa(x, where)) || null;
      return f ? { ...f, customer: t.customer.find((c) => c.id === f.customerId) || null, merchant: { id: f.merchantId, name: 'Taller Sonda ' + f.merchantId, logoUrl: null } } : null;
    },
    update: async ({ where, data }) => { const f = t.invoice.find((x) => x.id === where.id); Object.assign(f, data); est.marcasFactura += 1; return f; },
  },
  charge: {
    findUnique: async ({ where }) => t.charge.find((f) => f.id === where.id) || null,
    update: async ({ where, data }) => { const f = t.charge.find((x) => x.id === where.id); Object.assign(f, data); return f; },
  },
};
global.prisma = new Proxy({}, { get: (_, m) => {
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => {
    if (modelos[m] && modelos[m][met]) return modelos[m][met];
    if (typeof met !== 'string' || !neutro[met]) return undefined;
    return async (...a) => { noModeladas[m + '.' + met] = (noModeladas[m + '.' + met] || 0) + 1; return neutro[met](...a); };
  } });
} });
global.fetch = () => { throw new Error('INSTRUMENTO: alguien llamo a fetch; aqui no sale nada'); };

// -- transporte: el destino ------------------------------------------------------------------
const requiereDist = createRequire(path.join(dist, 'integrations/whatsapp.js'));
const axios = requiereDist('axios');
axios.defaults.adapter = async (cfg) => {
  let cuerpo = {};
  try { cuerpo = JSON.parse(cfg.data); } catch { /* se queda vacio */ }
  est.aMeta.push({ host: new URL(String(cfg.url)).host, tipo: String(cuerpo.type || 'ilegible'), to: String(cuerpo.to || '') });
  return { data: { messages: [{ id: 'wamid.laboratorio-1509e.' + est.aMeta.length }] }, status: 200, statusText: '200', headers: {}, config: cfg, request: {} };
};

const trazas = [];
console.error = (...a) => trazas.push(a.map(String).join(' '));
console.warn = (...a) => trazas.push(a.map(String).join(' '));
const hablar = console.log;
console.log = () => {};

let puerto; let tel;
const noCuadran = [];
let casos = 0; let plantillasTotales = 0;

const RUTA = '/admin/invoices/21/send-reminder';
const manana = () => new FakeDate(FakeDate.now() + 24 * 3600 * 1000);
const ayer = () => new FakeDate(FakeDate.now() - 24 * 3600 * 1000);
const comercio = (id, extra) => ({ id, name: 'Taller Sonda ' + id, email: 'sonda' + id + '@example.invalid', plan: 'pro', planExpiresAt: null, onboardingCompleted: true, isPlatformOwner: false, ...(extra || {}) });

function nuevoCaso() {
  trazas.length = 0;
  est = { preguntas: [], aMeta: [], lecturasSesion: 0, marcasFactura: 0, llamadas: 0, conCliente: 0, resultados: [] };
  const c = { id: 50, merchantId: M_PROPIO, name: 'Cliente Sonda', phone: null, mobile: tel.telefonoDePrueba(150), waOptOut: false };
  const c9 = { id: 59, merchantId: M_PRUEBA_VENCIDA, name: 'Cliente Sonda 9', phone: null, mobile: tel.telefonoDePrueba(159), waOptOut: false };
  const fila = (id, merchantId, customerId, chargeId) => ({ id, merchantId, customerId, status: 'pending', number: 'F-' + id, total: 100, currency: 'EUR', chargeId, reminder7SentAt: null, reminder14SentAt: null });
  t = {
    customer: [c, c9], whatsAppMessage: [],
    charge: [{ id: 31, receiptToken: 'tokpago31' }, { id: 39, receiptToken: 'tokpago39' }],
    invoice: [fila(21, M_PROPIO, 50, 31), fila(29, M_PRUEBA_VENCIDA, 59, 39)],
    authSession: [
      { id: 1, token: 'tok-dueno', type: 'session', merchantId: M_PROPIO, teamMemberId: null, expiresAt: manana(), merchant: comercio(M_PROPIO), teamMember: null },
      { id: 2, token: 'tok-admin-equipo', type: 'session', merchantId: M_PROPIO, teamMemberId: 70, expiresAt: manana(), merchant: comercio(M_PROPIO), teamMember: { id: 70, name: 'Ana', role: 'admin', status: 'active' } },
      { id: 3, token: 'tok-tecnico', type: 'session', merchantId: M_PROPIO, teamMemberId: 71, expiresAt: manana(), merchant: comercio(M_PROPIO), teamMember: { id: 71, name: 'Tec', role: 'tecnico', status: 'active' } },
      { id: 4, token: 'tok-suspendido', type: 'session', merchantId: M_PROPIO, teamMemberId: 72, expiresAt: manana(), merchant: comercio(M_PROPIO), teamMember: { id: 72, name: 'Sus', role: 'admin', status: 'suspended' } },
      { id: 5, token: 'tok-caducada', type: 'session', merchantId: M_PROPIO, teamMemberId: null, expiresAt: ayer(), merchant: comercio(M_PROPIO), teamMember: null },
      { id: 6, token: 'tok-enlace-sin-canjear', type: 'magic_link', merchantId: M_PROPIO, teamMemberId: null, expiresAt: manana(), merchant: comercio(M_PROPIO), teamMember: null },
      { id: 7, token: 'tok-otro-comercio', type: 'session', merchantId: M_AJENO, teamMemberId: null, expiresAt: manana(), merchant: comercio(M_AJENO), teamMember: null },
      { id: 8, token: 'tok-prueba-vencida', type: 'session', merchantId: M_PRUEBA_VENCIDA, teamMemberId: null, expiresAt: manana(), merchant: comercio(M_PRUEBA_VENCIDA, { plan: 'trial', planExpiresAt: ayer() }), teamMember: null },
    ],
  };
}

function pedir(ruta, o) {
  const op = o || {};
  const headers = { ...(op.headers || {}) };
  if (op.cookie) headers.cookie = 'pf_session=' + op.cookie;
  const cuerpo = op.cuerpo === undefined ? '' : op.cuerpo;
  if (cuerpo && !headers['content-type']) headers['content-type'] = 'application/json';
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: op.metodo || 'POST', headers }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch { /* no es json */ } resolve({ status: res.statusCode, body: j }); });
    });
    req.on('error', reject); req.end(cuerpo);
  });
}
const etiqueta = (r) => 'http' + r.status + (r.body.sent === true ? '+enviado' : r.body.sent === false ? '+no:' + (r.body.reason || r.body.error || '?') : r.body.error ? ':' + r.body.error : '');

function resumen() {
  const por = {};
  for (const r of est.resultados) por[r] = (por[r] || 0) + 1;
  return {
    plantillas: est.aMeta.filter((p) => p.tipo === 'template').length,
    otroTipo: est.aMeta.filter((p) => p.tipo !== 'template').length,
    hostAjeno: est.aMeta.filter((p) => p.host !== 'graph.facebook.com').length,
    llamadas: est.llamadas, conCliente: est.conCliente,
    lecturasSesion: est.lecturasSesion,
    preguntasCliente: est.preguntas.filter((p) => p.conCliente).length,
    preguntasComercio: est.preguntas.filter((p) => !p.conCliente).length,
    http429: est.resultados.filter((r) => r.startsWith('http429')).length,
    resultados: Object.entries(por).map(([k, v]) => k + '=' + v).join(' ') || '-',
  };
}
function anotar(nombre, esperado) {
  const r = resumen();
  const fallos = [];
  for (const [k, v] of Object.entries(esperado || {})) {
    if (!(k in r)) fallos.push(k + ': el esperado nombra una clave que el resumen no tiene');
    else if (r[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + r[k]);
  }
  if (r.hostAjeno) fallos.push('peticiones a un host que no es Meta: ' + r.hostAjeno);
  if (fallos.length) noCuadran.push(nombre);
  casos += 1; plantillasTotales += r.plantillas;
  hablar((fallos.length ? 'ROJO   ' : 'cuadra ') + nombre.padEnd(74) + ' plantillas=' + String(r.plantillas).padStart(3) + ' llamadas=' + String(r.llamadas).padStart(3)
    + ' sesion=' + String(r.lecturasSesion).padStart(3) + ' pregCom=' + String(r.preguntasComercio).padStart(3) + ' pregCli=' + String(r.preguntasCliente).padStart(3)
    + ' 429=' + String(r.http429).padStart(2) + ' [' + r.resultados + ']' + (fallos.length ? '  <<< ' + fallos.join(' | ') : ''));
  return r;
}
async function uno(nombre, ruta, o, esperado) {
  nuevoCaso();
  est.resultados.push(etiqueta(await pedir(ruta, o)));
  return anotar(nombre, esperado);
}

// -- la cadena, leida de la pila de la app cargada (no del texto de app.ts) -------------------
function nombreDe(capa) {
  const h = capa.handle;
  if (h && h.__requiredRole) return 'requireRole(' + h.__requiredRole + ')';
  return (h && h.name) || capa.name || '<anonima>';
}
function cadena(app, metodo, ruta) {
  const fuera = [];
  app.router.stack.forEach((capa, i) => {
    let casaCapa = false;
    try { casaCapa = capa.match(ruta); } catch { casaCapa = false; }
    if (!casaCapa) return;
    if (capa.route) { if (capa.route.methods[metodo] || capa.route.methods._all) fuera.push({ i, que: 'ruta ' + metodo.toUpperCase() + ' ' + capa.route.path }); return; }
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

(async () => {
  tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1509e';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1509e';
  const C = config.WA_CUSTOMER_DAILY_CAP; const D_REAL = config.WA_DAILY_TEMPLATE_CAP;
  const D = comercioForzado === null ? D_REAL : comercioForzado;
  const wa = require(path.join(dist, 'integrations/whatsapp.js'));
  const original = wa.sendWhatsAppTemplate;
  nuevoCaso();
  wa.sendWhatsAppTemplate = async (p) => { est.llamadas += 1; if (p.log && p.log.customerId) est.conCliente += 1; return original(p); };
  if (wa.sendWhatsAppTemplate === original) { hablar('GUION MUDO: la envoltura no se pudo poner sobre el export.'); process.exit(2); }

  const { app } = require(path.join(dist, 'app.js'));
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidor.address().port;

  hablar('app cargada de ' + path.relative(process.cwd(), path.join(dist, 'app.js')) + ' · NODE_ENV=' + config.NODE_ENV + ' · capas en la pila de la app: ' + app.router.stack.length);
  hablar('topes leidos en dist: por cliente y dia = ' + C + ' · por comercio y dia = ' + D_REAL + (comercioForzado !== null ? '  [ESPERADO FORZADO A ' + comercioForzado + ': este guion debe salir rojo]' : ''));

  // ---------------------------------------------------------------------------------------
  hablar('\n== 1 · LA CADENA que tiene delante POST ' + RUTA + ' (pila de la app cargada) ==');
  const laMia = cadena(app, 'post', RUTA);
  const deNadie = cadena(app, 'post', '/zzz-no-existe-1509e/x');
  const idsDeNadie = new Set(deNadie.map((c) => c.i));
  for (const c of laMia) {
    hablar('  [' + String(c.i).padStart(3) + '] ' + (idsDeNadie.has(c.i) ? '(toda peticion) ' : '(SOLO esta zona) ') + c.que + (c.prefijo ? '  montada en ' + c.prefijo : ''));
    for (const d of (c.dentro || [])) hablar('         dentro [' + d.j + '] ' + d.que + (d.manos.length ? '  ->  ' + d.manos.join(' , ') : ''));
  }
  const propias = laMia.filter((c) => !idsDeNadie.has(c.i));
  hablar('  capas que casan: ' + laMia.length + ' · de ellas, ' + propias.length + ' no las ve una ruta inventada (control: la inventada casa ' + deNadie.length + ')');
  const nombresPropias = propias.map((c) => c.que);
  const routerFacturas = propias.find((c) => c.prefijo === '/admin/invoices' && c.dentro);
  const rutaDentro = routerFacturas && routerFacturas.dentro.find((d) => d.que.startsWith('ruta '));
  const noRutaDentro = routerFacturas ? routerFacturas.dentro.filter((d) => !d.que.startsWith('ruta ')) : [];
  if (!nombresPropias.includes('requireAuth') || !rutaDentro) { hablar('GUION MUDO: la lectura de la pila no encuentra requireAuth o la ruta (positivo obligatorio).'); process.exit(2); }
  hablar('  manos de la ruta, en orden: ' + rutaDentro.manos.join(' , ') + ' · capas del router de facturas que no son ruta y casan: ' + noRutaDentro.length);

  // ---------------------------------------------------------------------------------------
  hablar('\n== 2 · CONTROLES ==');
  const p0 = await uno('K+ POSITIVO: el titular, su factura', RUTA, { cookie: 'tok-dueno' }, { plantillas: 1, llamadas: 1, lecturasSesion: 1, resultados: 'http200+enviado=1' });
  await uno('K0 CERO: el titular, una factura que no existe', '/admin/invoices/999/send-reminder', { cookie: 'tok-dueno' }, { plantillas: 0, llamadas: 0, lecturasSesion: 1, resultados: 'http404:not_found=1' });
  if (p0.plantillas !== 1) { hablar('GUION MUDO: el positivo no manda nada; ningun cero de abajo significa nada.'); process.exit(2); }

  // ---------------------------------------------------------------------------------------
  hablar('\n== 3 · QUIEN PASA ==');
  const nada = { plantillas: 0, llamadas: 0 };
  await uno('A1 sin credencial ninguna', RUTA, {}, { ...nada, lecturasSesion: 0, resultados: 'http401:not_authenticated=1' });
  await uno('A2 la credencial del titular por OTRA via (Bearer, cabecera, query, cuerpo)', RUTA + '?token=tok-dueno&pf_session=tok-dueno',
    { headers: { authorization: 'Bearer tok-dueno', 'x-internal-secret': 'tok-dueno', 'x-api-key': 'tok-dueno' }, cuerpo: JSON.stringify({ token: 'tok-dueno', pf_session: 'tok-dueno' }) },
    { ...nada, lecturasSesion: 0, resultados: 'http401:not_authenticated=1' });
  await uno('A3 una cookie que no es de nadie', RUTA, { cookie: 'tok-inventado' }, { ...nada, lecturasSesion: 1, resultados: 'http401:session_expired=1' });
  await uno('A4 una sesion caducada', RUTA, { cookie: 'tok-caducada' }, { ...nada, lecturasSesion: 1, resultados: 'http401:session_expired=1' });
  await uno('A5 un enlace de acceso sin canjear (no es de tipo sesion)', RUTA, { cookie: 'tok-enlace-sin-canjear' }, { ...nada, lecturasSesion: 1, resultados: 'http401:session_expired=1' });
  await uno('A6 un miembro del equipo suspendido (era admin)', RUTA, { cookie: 'tok-suspendido' }, { ...nada, lecturasSesion: 1, resultados: 'http401:session_expired=1' });
  await uno('A7 un miembro del equipo con rol tecnico', RUTA, { cookie: 'tok-tecnico' }, { ...nada, lecturasSesion: 1, resultados: 'http403:forbidden=1' });
  await uno('A8 el titular de OTRO comercio, sobre esta factura', RUTA, { cookie: 'tok-otro-comercio' }, { ...nada, lecturasSesion: 1, resultados: 'http404:not_found=1' });
  await uno('A9 un miembro del equipo con rol admin', RUTA, { cookie: 'tok-admin-equipo' }, { plantillas: 1, llamadas: 1, resultados: 'http200+enviado=1' });
  await uno('A10 el titular con la prueba VENCIDA, su factura', '/admin/invoices/29/send-reminder', { cookie: 'tok-prueba-vencida' }, { plantillas: 1, llamadas: 1, resultados: 'http200+enviado=1' });
  await uno('A11 el titular, peticion que dice venir de otro sitio (Origin y Referer ajenos)', RUTA,
    { cookie: 'tok-dueno', headers: { origin: 'https://otro-sitio.example', referer: 'https://otro-sitio.example/pagina' } }, { plantillas: 1, llamadas: 1, resultados: 'http200+enviado=1' });
  await uno('A12 el titular, como la manda un formulario (urlencoded, sin JSON)', RUTA,
    { cookie: 'tok-dueno', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://otro-sitio.example' }, cuerpo: 'a=1' }, { plantillas: 1, llamadas: 1, resultados: 'http200+enviado=1' });
  await uno('A13 el titular por GET (la ruta es POST)', RUTA, { cookie: 'tok-dueno', metodo: 'GET' }, { ...nada, resultados: 'http404:not_found=1' });

  // ---------------------------------------------------------------------------------------
  hablar('\n== 4 · CUANTAS VECES ==');
  const N = D + 20;
  nuevoCaso();
  for (let i = 0; i < N; i += 1) est.resultados.push(etiqueta(await pedir(RUTA, { cookie: 'tok-dueno' })));
  const r4 = anotar('R1 el titular, ' + N + ' seguidas, misma factura, mismo cliente', { plantillas: Math.min(N, D), llamadas: N, conCliente: 0, preguntasCliente: 0, preguntasComercio: N, http429: 0,
    resultados: 'http200+enviado=' + Math.min(N, D) + (N > D ? ' http200+no:daily_cap=' + (N - D) : '') });
  hablar('       marcas de fecha escritas en la factura: ' + est.marcasFactura + ' · filas en el registro de mensajes: ' + t.whatsAppMessage.length);

  nuevoCaso();
  for (let i = 0; i < 7; i += 1) est.resultados.push(etiqueta(await pedir('/auth/login', { cuerpo: JSON.stringify({ email: 'mismo@example.invalid' }) })));
  const rl = anotar('R+ POSITIVO del contador de 429: /auth/login, 7 seguidas, mismo correo', { plantillas: 0, http429: 2 });
  nuevoCaso();
  for (let i = 0; i < 7; i += 1) est.resultados.push(etiqueta(await pedir('/auth/login', { cuerpo: JSON.stringify({ email: 'distinto' + i + '@example.invalid' }) })));
  anotar('R0 CERO del contador de 429: /auth/login, 7 seguidas, 7 correos', { plantillas: 0, http429: 0 });
  if (rl.http429 === 0) { hablar('GUION MUDO: el contador de 429 no ve el limite donde SI lo hay; el 0 de R1 no significa nada.'); process.exit(2); }

  // ---------------------------------------------------------------------------------------
  hablar('\n== RESUMEN ==');
  hablar('casos: ' + casos + ' · cuadran: ' + (casos - noCuadran.length) + ' · en rojo: ' + noCuadran.length + ' · plantillas en toda la corrida: ' + plantillasTotales);
  hablar('R1: de ' + N + ' peticiones seguidas del titular salen ' + r4.plantillas + ' plantillas al MISMO cliente; con el tope por cliente (' + C + ') saldrian ' + Math.min(N, C) + '. Respuestas 429: ' + r4.http429 + '.');
  const nm = Object.entries(noModeladas).map(([k, v]) => k + ' x' + v).join(', ');
  hablar('la base en memoria contesto sin modelarlo a: ' + (nm || 'nada'));
  servidor.close();
  if (plantillasTotales === 0) { hablar('GUION MUDO: 0 plantillas en toda la corrida.'); process.exit(2); }
  process.exit(noCuadran.length ? 1 : 0);
})().catch((e) => { hablar('GUION ROTO: ' + (e && e.stack || e)); process.exit(2); });
