// SCRUM-1512 - Del alta publica a la primera plantilla: cuantos pasos hay entre un correo
// cualquiera y un WhatsApp saliendo del numero de la casa.
//
// Se carga la APP ENTERA de `dist/app.js` y se le pide por HTTP, como lo haria alguien de fuera.
// Lo que NO es la casa, y se dice:
//   - LA BASE: un Postgres desechable (PGlite, en memoria, en este proceso) nacido de
//     `prisma/schema.prisma` con `migrate diff --from-empty`. Ninguna base de la casa.
//   - EL TRANSPORTE de axios: no sale un byte; cada peticion a Meta se ANOTA y se contesta aqui.
//   - EL BUZON: sin RESEND_API_KEY ni SMTP_URL el correo no sale y la app escribe el enlace en
//     su log (`logMagicLink`). Leer esa linea hace aqui de «abrir el correo».
//   - Las credenciales de WhatsApp son dos textos de laboratorio puestos en memoria.
// No se usa WHATSAPP_DRY_RUN. No se toca ningun fichero de `src/`.
//
// Uso:  node medir.cjs <dist> <carpeta node_modules con @electric-sql> <esquema.sql> [--forzar-rojo]
//   --forzar-rojo  NO cambia el producto: cambia UN esperado de este guion (que la cuenta
//                  espanola recien creada SI pueda emitir). Sirve para verlo en rojo.
// Sale 0 si todo cuadra, 1 si algun caso no cuadra, 2 si el guion se rompe o sale mudo.
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const dist = path.resolve(process.argv[2] || 'dist');
const carpetaPg = path.resolve(process.argv[3] || '');
const ficheroSql = path.resolve(process.argv[4] || '');
const forzarRojo = process.argv.includes('--forzar-rojo');

if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('CIEGO: proceso de test; el freno de SCRUM-180 lanzaria antes de salir.'); process.exit(2);
}
// Nada del entorno de quien lance esto entra en la medicion: se BORRA todo lo que la app lee.
for (const k of Object.keys(process.env)) {
  if (/^(WHATSAPP_|WA_|DATABASE_URL|RESEND_|SMTP_|STRIPE_|MP_|E2E_|INTERNAL_API_SECRET|OWNER_EMAILS|DEMO_SAFE_NUMBERS|LOG_MAGIC_LINKS|PUBLIC_BASE_URL|PORT$|GEMINI_|ANTHROPIC_|QA_|RAILWAY_)/.test(k)) delete process.env[k];
}
process.env.NODE_ENV = 'development';
process.env.DISABLE_CRONS = 'true';

// -- cable trampa de red: nada sale de esta maquina -------------------------------------------
const fugas = [];
const esLocal = (h) => h === '127.0.0.1' || h === 'localhost' || h === '::1';
const lookupReal = dns.lookup;
dns.lookup = function (host, ...resto) {
  if (!esLocal(String(host))) { fugas.push('dns:' + host); const cb = resto[resto.length - 1]; const e = new Error('INSTRUMENTO: resolucion de nombre cortada: ' + host); e.code = 'ENOTFOUND'; if (typeof cb === 'function') return process.nextTick(() => cb(e)); throw e; }
  return lookupReal.call(dns, host, ...resto);
};
for (const m of ['request', 'get']) {
  https[m] = function (...a) { fugas.push('https:' + String(a[0] && (a[0].href || a[0].host || a[0].hostname || a[0]))); throw new Error('INSTRUMENTO: https cortado'); };
}
const fetchReal = global.fetch;
global.fetch = (u, ...r) => { const h = new URL(String(u && u.url ? u.url : u)).hostname; if (!esLocal(h)) { fugas.push('fetch:' + h); throw new Error('INSTRUMENTO: fetch cortado: ' + h); } return fetchReal(u, ...r); };

const hablar = console.log.bind(console);
const trazas = [];
const buzon = []; // lo que la app habria mandado por correo: aqui, su linea de log
const anotarTraza = (a) => {
  const s = a.map((x) => (x && x.stack) || String(x)).join(' ');
  const m = s.match(/^\[magic-link\] to=(\S+) link=(\S+)/);
  if (m) buzon.push({ para: m[1], enlace: m[2] });
  trazas.push(s);
};
console.log = (...a) => anotarTraza(a);
console.error = (...a) => anotarTraza(a);
console.warn = (...a) => anotarTraza(a);
console.info = (...a) => anotarTraza(a);

const aMeta = []; // cada peticion que la app le hace a Meta
let puerto; let prisma;
const noCuadran = []; let casos = 0;

function pedir(ruta, o) {
  const op = o || {};
  const headers = { ...(op.headers || {}) };
  if (op.cookie) headers.cookie = op.cookie;
  const cuerpo = op.cuerpo === undefined ? '' : JSON.stringify(op.cuerpo);
  if (cuerpo) headers['content-type'] = 'application/json';
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: op.metodo || 'POST', headers }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch { /* no es json */ } resolve({ status: res.statusCode, body: j, headers: res.headers, bytes: b.length }); });
    });
    req.on('error', reject); req.end(cuerpo);
  });
}
const corto = (r) => 'http' + r.status + (r.body && r.body.error ? ':' + r.body.error : '') + (r.body && r.body.sent === true ? '+enviado' : r.body && r.body.sent === false ? '+no:' + (r.body.reason || r.body.error || '?') : '');
const plantillas = (desde) => aMeta.slice(desde).filter((p) => p.tipo === 'template').length;
const deOtroTipo = (desde) => aMeta.slice(desde).filter((p) => p.tipo !== 'template').length;

function caso(nombre, visto, esperado) {
  const fallos = [];
  for (const [k, v] of Object.entries(esperado)) {
    if (!(k in visto)) fallos.push(k + ': el esperado nombra una clave que lo visto no tiene');
    else if (visto[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + visto[k]);
  }
  casos += 1; if (fallos.length) noCuadran.push(nombre);
  hablar((fallos.length ? 'ROJO   ' : 'cuadra ') + nombre.padEnd(66) + ' ' + Object.entries(visto).map(([k, v]) => k + '=' + v).join(' ') + (fallos.length ? '   <<< ' + fallos.join(' | ') : ''));
  return visto;
}

// -- UNA CUENTA, de punta a punta: lo que hace alguien que solo tiene un correo --------------
async function alta(etiqueta, correo, cuerpoExtra) {
  const pasos = [];
  const paso = (que, r, extra) => { pasos.push({ que, r: corto(r) + (extra ? ' ' + extra : '') }); hablar('    paso ' + String(pasos.length).padStart(2) + ' [' + etiqueta + '] ' + que.padEnd(58) + ' -> ' + corto(r) + (extra ? '  ' + extra : '')); };
  const antesBuzon = buzon.length;
  const r1 = await pedir('/auth/register', { cuerpo: { name: 'Sonda ' + etiqueta, email: correo, ...(cuerpoExtra || {}) } });
  paso('POST /auth/register (sin sesion, sin nada)', r1, 'cookie-en-la-respuesta=' + (r1.headers['set-cookie'] ? 'SI' : 'no'));
  const cartas = buzon.slice(antesBuzon).filter((c) => c.para === correo);
  hablar('             el buzon de ' + correo + ': ' + cartas.length + ' enlace(s) de acceso');
  if (r1.status !== 200 || cartas.length === 0) return { pasos, cookie: null };
  const u = new URL(cartas[cartas.length - 1].enlace);
  const r2 = await pedir(u.pathname + u.search, { metodo: 'GET' });
  const galleta = (r2.headers['set-cookie'] || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pf_session=')) || null;
  paso('GET  /auth/verify?token=<el del correo>', r2, 'va-a=' + r2.headers.location + ' sesion=' + (galleta ? 'SI' : 'no'));
  if (!galleta) return { pasos, cookie: null };
  const r3 = await pedir('/admin/me', { metodo: 'GET', cookie: galleta });
  const yo = r3.body;
  const fila = await prisma.merchant.findUnique({ where: { email: correo }, select: { id: true, country: true, plan: true, status: true } });
  hablar('             (lectura, no es paso) GET /admin/me -> ' + corto(r3) + ' cuenta=' + yo.merchantId + ' rol=' + yo.role + ' alta-guiada-hecha=' + yo.onboardingCompleted + ' · en la base: pais=' + fila.country + ' plan=' + fila.plan + ' estado=' + fila.status);
  if (yo.merchantId !== fila.id) { hablar('GUION MUDO: la sesion no es de la cuenta recien creada.'); process.exit(2); }
  return { pasos, paso, cookie: galleta, id: fila.id, pais: fila.country };
}

(async () => {
  if (!fs.existsSync(path.join(dist, 'app.js'))) { hablar('CIEGO: no hay ' + path.join(dist, 'app.js') + ' (tsc --noCheck primero).'); process.exit(2); }
  const sql = fs.readFileSync(ficheroSql, 'utf8');
  const tablasDelSql = (sql.match(/^CREATE TABLE /gm) || []).length;
  if (sql.length < 10000 || tablasDelSql < 20) { hablar('CIEGO: el esquema desechable tiene ' + sql.length + ' caracteres y ' + tablasDelSql + ' tablas.'); process.exit(2); }

  // -- la base desechable ------------------------------------------------------------------
  const { PGlite } = await import(pathToFileURL(path.join(carpetaPg, '@electric-sql/pglite/dist/index.js')).href);
  const { PGLiteSocketServer } = await import(pathToFileURL(path.join(carpetaPg, '@electric-sql/pglite-socket/dist/index.js')).href);
  const db = new PGlite();
  await db.exec(sql);
  const libre = () => new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  const puertoPg = await libre();
  const servidorPg = new PGLiteSocketServer({ db, port: puertoPg, host: '127.0.0.1' });
  await servidorPg.start();
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:' + puertoPg + '/yaqu_1512_test?sslmode=disable&connection_limit=1';
  puerto = await libre();
  process.env.PORT = String(puerto);
  process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:' + puerto;

  // -- el destino: Meta, doblado -------------------------------------------------------------
  const requiereDist = createRequire(path.join(dist, 'integrations/whatsapp.js'));
  const axios = requiereDist('axios');
  axios.defaults.adapter = async (cfg) => {
    let cuerpo = {};
    try { cuerpo = JSON.parse(cfg.data); } catch { /* se queda vacio */ }
    const u = new URL(String(cfg.url));
    aMeta.push({ host: u.host, ruta: u.pathname, tipo: String(cuerpo.type || 'ilegible'), to: String(cuerpo.to || ''), plantilla: String((cuerpo.template && cuerpo.template.name) || '') });
    return { data: { messages: [{ id: 'wamid.laboratorio-1512.' + aMeta.length }] }, status: 200, statusText: '200', headers: {}, config: cfg, request: {} };
  };

  const tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  const ID_LAB = 'ID-DE-LABORATORIO-1512';
  config.WHATSAPP_PHONE_NUMBER_ID = ID_LAB;
  config.WHATSAPP_ACCESS_TOKEN = 'texto-de-laboratorio-1512';
  ({ prisma } = require(path.join(dist, 'core/db/prisma.js')));
  const { app } = require(path.join(dist, 'app.js'));
  const servidor = await new Promise((r) => { const s = app.listen(puerto, '127.0.0.1', () => r(s)); });

  // La cuenta demo es el id 1 en toda base de la casa (regla 8). Se siembra para que las cuentas
  // nuevas nazcan con id >= 2, como naceran en cualquier base real, y no hereden sus reglas.
  const demo = await prisma.merchant.create({ data: { name: 'Demo', email: 'demo@yaqu.app', country: 'ES' } });
  const nTablas = Number((await prisma.$queryRawUnsafe("select count(*)::int as n from information_schema.tables where table_schema='public'"))[0].n);
  hablar('app cargada de ' + path.relative(process.cwd(), path.join(dist, 'app.js')) + ' · NODE_ENV=' + config.NODE_ENV + ' · base desechable: ' + nTablas + ' tablas (el SQL traia ' + tablasDelSql + ') · cuenta demo sembrada con id=' + demo.id);
  if (demo.id !== 1 || nTablas !== tablasDelSql) { hablar('GUION MUDO: la base desechable no es la que deberia.'); process.exit(2); }
  hablar('topes leidos en dist: por comercio y dia = ' + config.WA_DAILY_TEMPLATE_CAP + ' · por cliente y dia = ' + config.WA_CUSTOMER_DAILY_CAP);

  const cuentas = () => prisma.merchant.count();
  const linea = [{ concept: 'Sonda 1512', qty: 1, price: 10, tax: 0.21 }];

  // =========================================================================================
  hablar('\n== 0 · CONTROLES DE CERO: lo que NO debe abrir nada ==');
  {
    const n0 = await cuentas(); const m0 = aMeta.length;
    const r = await pedir('/auth/register', { cuerpo: { name: 'Nadie', email: 'sin-arroba' } });
    caso('K0a alta con un correo que no lo es', { http: r.status, cuentasNuevas: (await cuentas()) - n0, aMeta: aMeta.length - m0 }, { http: 400, cuentasNuevas: 0, aMeta: 0 });
    const r2 = await pedir('/auth/verify?token=inventado-1512', { metodo: 'GET' });
    caso('K0b canjear un enlace inventado', { http: r2.status, sesion: r2.headers['set-cookie'] ? 'SI' : 'no' }, { http: 302, sesion: 'no' });
    const r3 = await pedir('/admin/customers', { cuerpo: { name: 'X', mobile: tel.telefonoDePrueba(1) } });
    const r4 = await pedir('/admin/invoices/1/send-reminder', {});
    caso('K0c crear cliente y pedir recordatorio SIN sesion', { cliente: r3.status, recordatorio: r4.status, aMeta: aMeta.length - m0 }, { cliente: 401, recordatorio: 401, aMeta: 0 });
  }

  // =========================================================================================
  hablar('\n== A · UN CORREO CUALQUIERA, sin decir pais (la app pone ES) ==');
  const A = await alta('A', 'a-1512@example.invalid');
  let aCliente = null; let aPresupuesto = null;
  if (A.cookie) {
    const m0 = aMeta.length;
    const rc = await pedir('/admin/customers', { cookie: A.cookie, cuerpo: { name: 'Cliente A', mobile: tel.telefonoDePrueba(11) } });
    aCliente = rc.body.id; A.paso('POST /admin/customers (nombre + movil que el escribe)', rc, 'id=' + aCliente);
    const rf = await pedir('/admin/invoices', { cookie: A.cookie, cuerpo: { customerId: aCliente, lines: linea } });
    hablar('             (rama que NO llega) POST /admin/invoices -> ' + corto(rf));
    caso('A1 cuenta ES recien creada: emitir la factura suelta', { http: rf.status, error: String(rf.body.error || '-'), facturas: await prisma.invoice.count({ where: { merchantId: A.id } }) },
      forzarRojo ? { http: 201, facturas: 1 } : { http: 409, error: 'factura_suelta_no_disponible', facturas: 0 });
    // y por el otro documento: el presupuesto
    const rq = await pedir('/quote/create', { cookie: A.cookie, cuerpo: { merchant_id: A.id, customer_id: aCliente, currency: 'EUR', lines: linea } });
    aPresupuesto = rq.body.id || (rq.body.quote && rq.body.quote.id) || rq.body.quote_id || null;
    A.paso('POST /quote/create (una linea)', rq, 'id=' + aPresupuesto + (rq.status >= 400 ? ' ' + JSON.stringify(rq.body).slice(0, 600) : ' claves=' + Object.keys(rq.body).join(',')));
    if (aPresupuesto) {
      const rs = await pedir('/admin/quotes/' + aPresupuesto + '/send-whatsapp', { cookie: A.cookie, cuerpo: {} });
      A.paso('POST /admin/quotes/:id/send-whatsapp', rs, 'plantillas=' + plantillas(m0) + ' otroTipo=' + deOtroTipo(m0) + (rs.status >= 400 ? ' ' + JSON.stringify(rs.body).slice(0, 300) : ''));
    }
    const ult = aMeta[aMeta.length - 1] || {};
    caso('A2 cuenta ES recien creada: presupuesto por WhatsApp', { plantillas: plantillas(m0), otroTipo: deOtroTipo(m0), pasos: A.pasos.length, plantilla: ult.plantilla || '-', alTelefonoQueEscribio: ult.to === tel.telefonoDePrueba(11) ? 'SI' : 'no' },
      { plantillas: 1, otroTipo: 0, pasos: 5, alTelefonoQueEscribio: 'SI' });
  }

  // =========================================================================================
  hablar('\n== B · EL MISMO CORREO CUALQUIERA, diciendo en el cuerpo del alta que el pais es PT ==');
  const B = await alta('B', 'b-1512@example.invalid', { country: 'PT' });
  let bFactura = null; let bCliente = null;
  if (B.cookie) {
    const m0 = aMeta.length;
    const rc = await pedir('/admin/customers', { cookie: B.cookie, cuerpo: { name: 'Cliente B', mobile: tel.telefonoDePrueba(12) } });
    bCliente = rc.body.id; B.paso('POST /admin/customers (nombre + movil que el escribe)', rc, 'id=' + bCliente);
    const rf = await pedir('/admin/invoices', { cookie: B.cookie, cuerpo: { customerId: bCliente, lines: linea } });
    bFactura = rf.body.factura && rf.body.factura.id; B.paso('POST /admin/invoices (factura suelta, una linea)', rf, 'id=' + bFactura + ' numero=' + (rf.body.factura && rf.body.factura.number) + (rf.status >= 400 ? ' ' + JSON.stringify(rf.body).slice(0, 300) : ''));
    caso('B1 cuenta que DICE ser de fuera: emitir la factura suelta', { http: rf.status, facturas: await prisma.invoice.count({ where: { merchantId: B.id } }) }, { http: 201, facturas: 1 });
    if (bFactura) {
      // la ruta de SCRUM-1509e, tal cual esta la factura recien nacida (sin cobro)
      const mR = aMeta.length;
      const rr = await pedir('/admin/invoices/' + bFactura + '/send-reminder', { cookie: B.cookie, cuerpo: {} });
      hablar('             (rama) send-reminder con la factura SIN cobro -> ' + corto(rr) + ' plantillas=' + plantillas(mR) + ' otroTipo=' + deOtroTipo(mR) + ' tipo=' + ((aMeta[mR] || {}).tipo || '-'));
      caso('B2 send-reminder sobre factura SIN cobro: sale texto libre, no plantilla', { http: rr.status, plantillas: plantillas(mR), otroTipo: deOtroTipo(mR) }, { http: 200, plantillas: 0, otroTipo: 1 });
      const mW = aMeta.length;
      const rw = await pedir('/admin/invoices/' + bFactura + '/resend-whatsapp', { cookie: B.cookie, cuerpo: {} });
      B.paso('POST /admin/invoices/:id/resend-whatsapp (crea el cobro y envia)', rw, 'plantillas=' + plantillas(mW) + ' otroTipo=' + deOtroTipo(mW) + (rw.status >= 400 ? ' ' + JSON.stringify(rw.body).slice(0, 300) : ''));
      const conCobro = await prisma.invoice.findUnique({ where: { id: bFactura }, select: { chargeId: true } });
      const m7 = aMeta.length;
      const r7 = await pedir('/admin/invoices/' + bFactura + '/send-reminder', { cookie: B.cookie, cuerpo: {} });
      B.paso('POST /admin/invoices/:id/send-reminder (la de :766)', r7, 'plantillas=' + plantillas(m7) + ' otroTipo=' + deOtroTipo(m7));
      const ult = aMeta[aMeta.length - 1] || {};
      caso('B3 cuenta que dice ser de fuera: llega a la plantilla de :766', { cobroEnLaFactura: conCobro && conCobro.chargeId ? 'SI' : 'no', plantillasDeReenviar: plantillas(mW) - plantillas(m7), plantillasDe766: plantillas(m7), pasos: B.pasos.length, plantilla: ult.plantilla || '-', alTelefonoQueEscribio: ult.to === tel.telefonoDePrueba(12) ? 'SI' : 'no' },
        { cobroEnLaFactura: 'SI', plantillasDeReenviar: 1, plantillasDe766: 1, pasos: 6, plantilla: 'payment_request_es', alTelefonoQueEscribio: 'SI' });
    }
    void m0;
  }

  // =========================================================================================
  hablar('\n== 3 · DE QUE NUMERO SALE: la ruta que la app le pide a Meta, por cuenta ==');
  {
    const rutas = [...new Set(aMeta.map((p) => p.host + p.ruta))];
    for (const r of rutas) hablar('    ' + r + '   x' + aMeta.filter((p) => p.host + p.ruta === r).length);
    const conId = aMeta.filter((p) => p.ruta.split('/').includes(ID_LAB)).length;
    caso('N1 las dos cuentas piden por la MISMA ruta de numero', { peticiones: aMeta.length, rutasDistintas: rutas.length, conElIdDelEntorno: conId, hostAjeno: aMeta.filter((p) => p.host !== 'graph.facebook.com').length },
      { rutasDistintas: 1, conElIdDelEntorno: aMeta.length, hostAjeno: 0 });
    if (aMeta.length === 0) { hablar('GUION MUDO: ninguna peticion a Meta; N1 no significa nada.'); process.exit(2); }
  }

  // =========================================================================================
  hablar('\n== X · HALLADO DE PASO: una cuenta sobre la factura de OTRA ==');
  if (A.cookie && bFactura) {
    const mX = aMeta.length;
    const rx = await pedir('/admin/invoices/' + bFactura + '/resend-whatsapp', { cookie: A.cookie, cuerpo: {} });
    const ry = await pedir('/admin/invoices/' + bFactura + '/send-reminder', { cookie: A.cookie, cuerpo: {} });
    const ult = aMeta[aMeta.length - 1] || {};
    hablar('    lo que le contesta la app a la cuenta A: claves=' + Object.keys(rx.body).join(',') + ' · trae el telefono del cliente de B: ' + (rx.body.to === tel.telefonoDePrueba(12) ? 'SI' : 'no') + ' · trae la ficha de pago: ' + (rx.body.pay_token ? 'SI' : 'no'));
    caso('X1 la cuenta A pide reenviar la factura de la cuenta B', { reenviar: rx.status, recordatorio: ry.status, plantillas: plantillas(mX), alClienteDeB: plantillas(mX) && ult.to === tel.telefonoDePrueba(12) ? 'SI' : 'no', devuelveSuTelefono: rx.body.to === tel.telefonoDePrueba(12) ? 'SI' : 'no' },
      { reenviar: 200, recordatorio: 404, plantillas: 1, alClienteDeB: 'SI', devuelveSuTelefono: 'SI' });
    const filasX = await prisma.whatsAppMessage.findMany({ orderBy: { id: 'desc' }, take: 1, select: { merchantId: true } });
    hablar('    en el registro de mensajes, esa plantilla queda a nombre de la cuenta ' + (filasX[0] && filasX[0].merchantId) + ' (A es ' + A.id + ', B es ' + B.id + ')');
  }

  // =========================================================================================
  hablar('\n== R · CUANTAS CUENTAS desde la misma direccion ==');
  {
    const n0 = await cuentas(); const res = [];
    for (let i = 0; i < 12; i += 1) res.push((await pedir('/auth/register', { cuerpo: { name: 'Serie ' + i, email: 'serie' + i + '-1512@example.invalid' } })).status);
    caso('R1 12 altas seguidas, 12 correos, misma IP', { de200: res.filter((s) => s === 200).length, de429: res.filter((s) => s === 429).length, cuentasNuevas: (await cuentas()) - n0 }, { de200: 12, de429: 0, cuentasNuevas: 12 });
    const n1 = await cuentas(); const res2 = [];
    for (let i = 0; i < 7; i += 1) res2.push((await pedir('/auth/register', { cuerpo: { name: 'Mismo', email: 'mismo-1512@example.invalid' } })).status);
    const rp = caso('R+ POSITIVO del contador de 429: 7 altas, el MISMO correo', { de200: res2.filter((s) => s === 200).length, de429: res2.filter((s) => s === 429).length, cuentasNuevas: (await cuentas()) - n1 }, { de200: 5, de429: 2, cuentasNuevas: 1 });
    if (rp.de429 === 0) { hablar('GUION MUDO: el contador de 429 no ve el limite donde SI lo hay; el 0 de R1 no significa nada.'); process.exit(2); }
  }

  // =========================================================================================
  hablar('\n== RESUMEN ==');
  const totalPlantillas = aMeta.filter((p) => p.tipo === 'template').length;
  hablar('casos: ' + casos + ' · cuadran: ' + (casos - noCuadran.length) + ' · en rojo: ' + noCuadran.length + (forzarRojo ? '  [ESPERADO FORZADO: este guion debe salir rojo]' : ''));
  hablar('peticiones a Meta en toda la corrida: ' + aMeta.length + ' (plantillas ' + totalPlantillas + ', otro tipo ' + (aMeta.length - totalPlantillas) + ') · enlaces en el buzon: ' + buzon.length + ' · cuentas en la base: ' + (await cuentas()));
  hablar('filas en el registro de mensajes de WhatsApp: ' + (await prisma.whatsAppMessage.count()) + ' · intentos de salir de la maquina cortados: ' + fugas.length + (fugas.length ? ' -> ' + [...new Set(fugas)].join(', ') : ''));
  const errores = trazas.filter((s) => /error|Error/.test(s) && !/\[magic-link\]/.test(s));
  hablar('lineas del log de la app con la palabra error: ' + errores.length);
  for (const e of [...new Set(errores.map((s) => s.split('\n')[0].slice(0, 220)))].slice(0, 12)) hablar('    · ' + e);
  servidor.close(); await prisma.$disconnect().catch(() => {}); await servidorPg.stop().catch(() => {});
  if (totalPlantillas === 0) { hablar('GUION MUDO: 0 plantillas en toda la corrida.'); process.exit(2); }
  process.exit(noCuadran.length ? 1 : 0);
})().catch((e) => { hablar('GUION ROTO: ' + (e && e.stack || e)); process.exit(2); });
