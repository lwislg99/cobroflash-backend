// SCRUM-1513 (parte 2) - EL TOPE DE PLANTILLAS POR COMERCIO, CONTRA UN POSTGRES DE VERDAD.
//
// SCRUM-1509f (c.18923) midio, sobre una base EN MEMORIA, que UNA peticion del webhook con 120 mensajes
// dentro saco 120 plantillas teniendo el tope en 100. Este guion repite esa medicion contra un servidor
// PostgreSQL real, desechable, en loopback: lo arranca, le pone el esquema, mide y lo apaga.
//
// Lo que es REAL aqui: el servidor (proceso postgres, varias conexiones), el cliente de Prisma del
// proyecto, la app entera de `dist/app.js` pedida por HTTP con su firma.
// Lo que sigue DOBLADO: el transporte de axios (no sale un byte; contesta 200, o 400 al texto que va
// al profesional con su ventana cerrada). Opcionalmente tarda `--latencia` ms en contestar.
//
// PREDICCION del lote, escrita ANTES de correrlo (por lectura de `whatsapp.ts`: el tope es un `count`,
// despues va la peticion al proveedor, y la fila que cuenta se escribe al final y sin esperarla; no hay
// transaccion ni cerrojo): L2 = M plantillas y 0 bloqueos. Si sale otra cosa, ESO es el resultado.
// Para L3 (M peticiones a la vez) no hay prediccion de cifra.
//
// Uso:  node tope-postgres.cjs <dist> <carpeta con embedded-postgres> <ddl.sql> [--pool N] [--latencia MS] [--esperado-menos-uno]
// Sale 0 si los controles cuadran, 1 si alguno no cuadra, 2 si el guion se rompe, sale mudo o no habla
// con Postgres.
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const dist = path.resolve(process.argv[2] || 'dist');
const carpetaPg = path.resolve(process.argv[3] || '.');
const ficheroDdl = path.resolve(process.argv[4] || 'esquema.sql');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const POOL = arg('--pool') ? Number(arg('--pool')) : null;
const LATENCIA = arg('--latencia') ? Number(arg('--latencia')) : 0;
const menosUno = process.argv.includes('--esperado-menos-uno');
if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('CIEGO: proceso de test.'); process.exit(2);
}
for (const k of ['WHATSAPP_DRY_RUN', 'WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP', 'BOT_INBOUND_ENABLED', 'E2E_TEST_LOGIN_ENABLED', 'E2E_TEST_LOGIN_SECRET', 'INTERNAL_API_SECRET', 'QA_QUERY_LOG']) delete process.env[k];
// Ninguna clave de base del entorno llega al cliente: la unica URL es la que se fabrica mas abajo.
for (const k of Object.keys(process.env)) if (/^DATABASE_URL/.test(k) || k === 'LIBRO_PG_URL') delete process.env[k];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hablar = console.log.bind(console);
const MERCHANT = 7; const MERCHANT2 = 8;
const SECRETO = 'laboratorio-1513';
const BASE = 'yaqu_tope_1513_test';

const trazas = [];
let est = {};
let PROF; let PROF2; let CLI; let NADIE;
let puerto; let sql; let prismaBase; let serieEntrada = 0; let serieSalida = 0; let serieCaso = 0;
let enVuelo = 0; let httpPendientes = 0;
const operaciones = {};
const noCuadran = []; const filas = [];

function exigirDesechable(host, base) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('el destino no es loopback: ' + host);
  if (!base.endsWith('_test')) throw new Error('la base no termina en _test: ' + base);
}
const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const uno = async (texto, valores) => (await sql.query(texto, valores)).rows[0];

function pedir(ruta, cuerpo, cabeceras) {
  return new Promise((resolve, reject) => {
    const datos = Buffer.from(cuerpo || '');
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': datos.length, ...(cabeceras || {}) } }, (res) => {
      res.resume(); res.on('end', () => { est.http[res.statusCode] = (est.http[res.statusCode] || 0) + 1; resolve(res.statusCode); });
    });
    req.on('error', reject); req.end(datos);
  });
}
// El webhook contesta 200 y SIGUE trabajando por detras. Se espera a que no quede ninguna consulta de
// Prisma en vuelo, ninguna peticion al transporte pendiente, y a que nada se mueva durante 10 sondeos.
async function asentar() {
  let antes = ''; let quietos = 0;
  for (let i = 0; i < 3000 && quietos < 10; i += 1) {
    await dormir(40);
    const ahora = [est.salidas.length, est.avisos, trazas.length, est.preguntas.length, est.creadas].join('/');
    quietos = (enVuelo === 0 && httpPendientes === 0 && ahora === antes) ? quietos + 1 : 0; antes = ahora;
  }
  if (quietos < 10) throw new Error('INSTRUMENTO: el caso no se asento');
}
const firmar = (cuerpo) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex');
function cuerpoDe(mensajes, from) {
  const msgs = mensajes.map((m) => ({ from: from || CLI, id: 'wamid.entrada-1513.' + (++serieEntrada), ...m }));
  return JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: msgs } }] }] });
}
async function entrega(mensajes, opciones) {
  const o = opciones || {};
  const cuerpo = cuerpoDe(mensajes, o.from);
  await pedir('/webhooks/whatsapp', cuerpo, { 'x-hub-signature-256': o.firmaMala ? 'sha256=' + '0'.repeat(64) : firmar(cuerpo) });
  await asentar();
}
const texto = (body) => ({ type: 'text', text: { body } });

async function nuevoCaso(m) {
  const o = m || {};
  serieCaso += 1;
  trazas.length = 0;
  est = { salidas: [], preguntas: [], avisos: 0, http: {}, creadas: 0, primeraFila: null, lecturasDeCliente: [], escriturasDeBaja: [] };
  const tablas = (await sql.query("select tablename from pg_tables where schemaname = 'public'")).rows.map((r) => '"' + r.tablename + '"');
  if (tablas.length < 10) throw new Error('INSTRUMENTO: la base tiene ' + tablas.length + ' tablas; el esquema no esta puesto');
  await sql.query('TRUNCATE ' + tablas.join(', ') + ' RESTART IDENTITY CASCADE');
  await prismaBase.merchant.create({ data: { id: MERCHANT, name: 'Taller Sonda', email: 'sonda-1513@qa.invalid', whatsappPhone: PROF, country: 'ES', onboardingCompleted: true } });
  await prismaBase.customer.create({ data: { id: 50, merchantId: MERCHANT, name: 'Cliente Sonda', phone: CLI } });
  if (o.dosComercios) {
    await prismaBase.merchant.create({ data: { id: MERCHANT2, name: 'Otro Taller', email: 'sonda-1513-b@qa.invalid', whatsappPhone: PROF2, country: 'ES', onboardingCompleted: true } });
    await prismaBase.customer.create({ data: { id: 51, merchantId: MERCHANT2, name: 'Cliente Sonda', phone: CLI } });
  }
  if (o.yaDeBaja) await prismaBase.customer.updateMany({ where: { id: { in: o.yaDeBaja } }, data: { waOptOut: true } });
  if (!o.sinAlbaran) {
    await prismaBase.whatsAppMessage.create({ data: { merchantId: MERCHANT, customerId: 50, type: 'template', relatedType: 'albaran', relatedId: 1, waMessageId: 'wamid.albaran-' + serieCaso, status: 'sent', createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) } });
  }
  // Filas sembradas POR SQL, por la conexion independiente (no por Prisma): si el tope las cuenta, es
  // que lee de este Postgres. La hora va en UTC, que es como la escribe Prisma.
  if (o.sembradas) {
    await sql.query("insert into whatsapp_messages (merchant_id, type, template_name, wa_message_id, status, cost_estimate, created_at, updated_at) "
      + "select $1, 'template', 'siembra', 'siembra-' || $2 || '.' || g, 'sent', 0, now() at time zone 'utc', now() at time zone 'utc' from generate_series(1, $3) g", [MERCHANT, String(serieCaso), o.sembradas]);
  }
  est.preguntas.length = 0; est.creadas = 0; est.primeraFila = null; est.lecturasDeCliente.length = 0; est.escriturasDeBaja.length = 0;
}

async function resumen() {
  const alProf = est.salidas.filter((p) => p.to === PROF || p.to === PROF2);
  const delTope = est.preguntas.filter((p) => !p.conCliente);
  const f = await uno("select count(*) filter (where type = 'template' and wa_message_id like 'wamid.salida-1513.%')::int as plantillas, "
    + "count(*) filter (where type = 'template' and wa_message_id is not null and created_at >= $2)::int as cuentan_hoy, "
    + "count(*) filter (where status = 'failed' and error = 'daily_cap')::int as bloqueos, count(*)::int as todas from whatsapp_messages where merchant_id = any($1)", [[MERCHANT, MERCHANT2], est.inicioDelDia]);
  return {
    avisos: est.avisos,
    plantillasAlProfesional: alProf.filter((p) => p.tipo === 'template').length,
    textosAlCliente: est.salidas.filter((p) => p.to === CLI && p.tipo !== 'template' && p.tipo !== 'leido').length,
    filasDePlantillaEnPostgres: f.plantillas,
    filasQueCuentanHoyEnPostgres: f.cuentan_hoy,
    filasDeBloqueoEnPostgres: f.bloqueos,
    bloqueoComercio: trazas.filter((l) => /alcanz. el tope diario de plantillas/.test(l)).length,
    preguntasDelTope: delTope.length,
    respuestaMinima: delTope.length ? Math.min(...delTope.map((p) => p.respuesta)) : -1,
    respuestaMaxima: delTope.length ? Math.max(...delTope.map((p) => p.respuesta)) : -1,
    preguntasAntesDeLaPrimeraFila: est.primeraFila === null ? delTope.length : delTope.filter((p) => p.orden < est.primeraFila).length,
    hostAjeno: est.salidas.filter((p) => p.host !== est.hostDelTransporte).length,
    erroresDeManejador: trazas.filter((l) => /handler error|button error|Parse error|photo error|Error comprobando topes|recordWaMessage omitido/.test(l)).length,
    http: Object.entries(est.http).map(([k, v]) => k + 'x' + v).join(' ') || '-',
  };
}
async function anotar(nombre, esperado, observacion) {
  const r = await resumen();
  const fallos = [];
  for (const [k, v] of Object.entries(esperado || {})) {
    if (!(k in r)) fallos.push(k + ': el esperado nombra una clave que el resumen no tiene');
    else if (r[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + r[k]);
  }
  if (r.hostAjeno) fallos.push('peticiones a un host que no es el del transporte: ' + r.hostAjeno);
  if (r.erroresDeManejador) fallos.push('hubo ' + r.erroresDeManejador + ' trazas de error: el caso NO vale (' + trazas.filter((l) => /error|omitido/i.test(l))[0] + ')');
  if (r.plantillasAlProfesional !== r.filasDePlantillaEnPostgres) fallos.push('plantillas pedidas al transporte (' + r.plantillasAlProfesional + ') y filas en Postgres (' + r.filasDePlantillaEnPostgres + ') no coinciden');
  if (fallos.length) noCuadran.push(nombre);
  filas.push({ nombre, r, fallos });
  hablar((fallos.length ? 'ROJO   ' : (observacion ? 'OBSERV ' : 'cuadra ')) + nombre.padEnd(74) + ' avisos=' + String(r.avisos).padStart(3) + ' plantHTTP=' + String(r.plantillasAlProfesional).padStart(3)
    + ' filasPG=' + String(r.filasDePlantillaEnPostgres).padStart(3) + ' cuentanHoy=' + String(r.filasQueCuentanHoyEnPostgres).padStart(3) + ' bloq=' + String(r.bloqueoComercio).padStart(3) + '/' + String(r.filasDeBloqueoEnPostgres).padStart(3)
    + ' preguntas=' + String(r.preguntasDelTope).padStart(3) + ' resp=' + r.respuestaMinima + '..' + r.respuestaMaxima + ' antes1aFila=' + String(r.preguntasAntesDeLaPrimeraFila).padStart(3) + ' http=' + r.http
    + (fallos.length ? '  <<< ' + fallos.join(' | ') : ''));
  return r;
}

let servidorPg = null; let servidorHttp = null; let carpetaDatos = null;
async function apagar() {
  try { if (servidorHttp) servidorHttp.close(); } catch { /* nada */ }
  try { if (prismaBase) await prismaBase.$disconnect(); } catch { /* nada */ }
  try { if (sql) await sql.end(); } catch { /* nada */ }
  try { if (servidorPg) await servidorPg.stop(); } catch { /* nada */ }
  try { if (carpetaDatos) fs.rmSync(carpetaDatos, { recursive: true, force: true }); } catch { /* nada */ }
}

(async () => {
  { const d = new Date(); const min = d.getHours() * 60 + d.getMinutes(); if (min < 20 || min > 24 * 60 - 20) { hablar('CIEGO: a menos de 20 minutos de la medianoche local el dia del tope cambia a mitad de la corrida.'); process.exit(2); } }

  // -- 1 · el servidor --------------------------------------------------------------------------
  const requierePg = createRequire(path.join(carpetaPg, 'package.json'));
  const EmbeddedPostgres = (await import(pathToFileURL(requierePg.resolve('embedded-postgres')).href)).default;
  const { Client } = requierePg('pg');
  carpetaDatos = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1513-pg-'));
  // Garantía de borrado pase lo que pase (también process.exit): SCRUM-864c ③.
  process.on('exit', () => { try { fs.rmSync(carpetaDatos, { recursive: true, force: true }); } catch { /* nada */ } });
  const puertoPg = await puertoLibre();
  const usuario = 'u' + crypto.randomBytes(4).toString('hex');
  const clave = crypto.randomBytes(12).toString('hex');
  const registroPg = [];
  servidorPg = new EmbeddedPostgres({ databaseDir: carpetaDatos, user: usuario, password: clave, port: puertoPg, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: (l) => registroPg.push(String(l)), onError: (l) => registroPg.push(String(l)) });
  await servidorPg.initialise();
  await servidorPg.start();
  await servidorPg.createDatabase(BASE);
  exigirDesechable('127.0.0.1', BASE);
  const destino = { host: '127.0.0.1', port: puertoPg, user: usuario, password: clave, database: BASE };
  sql = new Client(destino); await sql.connect();

  // -- 2 · CON QUIEN ESTOY HABLANDO (el control que separa esta medicion de la de SCRUM-1509f) ----
  const quien = await uno("select version() as version, current_database() as base, host(inet_server_addr()) as host, inet_server_port() as puerto, pg_backend_pid() as pid, "
    + "current_setting('default_transaction_isolation') as aislamiento, current_setting('max_connections')::int as max_conexiones, current_setting('listen_addresses') as escucha");
  hablar('== 0 · CON QUIEN HABLO ==');
  hablar('  ' + quien.version);
  hablar('  base=' + quien.base + ' · host=' + quien.host + ':' + quien.puerto + ' · escucha en: ' + quien.escucha + ' · pid del servidor para esta conexion=' + quien.pid
    + ' · aislamiento por defecto=' + quien.aislamiento + ' · max_connections=' + quien.max_conexiones);
  if (!/^PostgreSQL \d+\./.test(quien.version) || quien.base !== BASE || !['127.0.0.1', '::1'].includes(quien.host) || Number(quien.puerto) !== puertoPg) { hablar('CIEGO: no es el Postgres desechable que acabo de arrancar.'); await apagar(); process.exit(2); }

  const ddl = fs.readFileSync(ficheroDdl, 'utf8');
  await sql.query(ddl);
  const tablas = await uno("select count(*)::int as n, count(*) filter (where tablename = 'whatsapp_messages')::int as wa, count(*) filter (where tablename = 'tabla_que_no_existe_1513')::int as cero from pg_tables where schemaname = 'public'");
  hablar('  esquema: ' + path.basename(ficheroDdl) + ' · ' + ddl.length + ' caracteres · sha256 ' + crypto.createHash('sha256').update(ddl).digest('hex').slice(0, 16)
    + ' · tablas creadas: ' + tablas.n + ' · whatsapp_messages: ' + tablas.wa + ' · una tabla inventada: ' + tablas.cero + ' (control)');
  if (!(tablas.n > 10) || tablas.wa !== 1 || tablas.cero !== 0) { hablar('CIEGO: el esquema no quedo puesto.'); await apagar(); process.exit(2); }

  // -- 3 · el cliente de Prisma del proyecto, apuntando SOLO aqui --------------------------------
  const requiereDist = createRequire(path.join(dist, 'integrations/whatsapp.js'));
  const { PrismaClient } = requiereDist('@prisma/client');
  const url = 'postgresql://' + usuario + ':' + clave + '@127.0.0.1:' + puertoPg + '/' + BASE + (POOL ? '?connection_limit=' + POOL : '');
  prismaBase = new PrismaClient({ datasourceUrl: url });
  // Se OBSERVA cada operacion (pasa tal cual a la base): cuantas hay en vuelo, y que contesto el `count`.
  let orden = 0;
  global.prisma = prismaBase.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    enVuelo += 1; operaciones[model + '.' + operation] = (operaciones[model + '.' + operation] || 0) + 1;
    try {
      const r = await query(args);
      if (model === 'WhatsAppMessage' && operation === 'count' && args && args.where && args.where.type === 'template') est.preguntas.push({ conCliente: 'customerId' in args.where, respuesta: r, orden: ++orden });
      if (model === 'Customer' && operation === 'findMany' && args && args.select && args.select.name) est.lecturasDeCliente.push({ filas: r.length, pideLaBaja: 'waOptOut' in args.select });
      if (model === 'Customer' && operation === 'updateMany' && args && args.data && 'waOptOut' in args.data) est.escriturasDeBaja.push(r.count);
      if (model === 'WhatsAppMessage' && operation === 'create' && args.data && args.data.type === 'template' && args.data.waMessageId) { est.creadas += 1; if (est.primeraFila === null) est.primeraFila = ++orden; }
      return r;
    } finally { enVuelo -= 1; }
  } } } });
  global.fetch = () => { throw new Error('INSTRUMENTO: alguien llamo a fetch'); };

  // El host del proveedor NO se escribe aqui: se lee del modulo compilado que habla con el.
  const hostDelTransporte = (() => { const m = /https:\/\/([a-z0-9.-]+)\/v\d+/.exec(fs.readFileSync(path.join(dist, 'integrations/whatsapp.js'), 'utf8')); return m ? m[1] : null; })();
  if (!hostDelTransporte) { hablar('GUION MUDO: no se pudo leer el host del transporte'); await apagar(); process.exit(2); }
  const axios = requiereDist('axios');
  axios.defaults.adapter = async (cfg) => {
    let cuerpo = {};
    try { cuerpo = JSON.parse(cfg.data); } catch { /* vacio */ }
    const tipo = String(cuerpo.type || (cuerpo.status ? 'leido' : 'ilegible'));
    est.salidas.push({ host: new URL(String(cfg.url)).host, tipo, to: String(cuerpo.to || '') });
    const resp = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
    httpPendientes += 1;
    try {
      if (LATENCIA) await dormir(LATENCIA);
      // texto al PROFESIONAL con su ventana cerrada: el proveedor lo rechaza y el aviso cae a la plantilla
      if (tipo !== 'template' && (cuerpo.to === PROF || cuerpo.to === PROF2)) {
        throw new axios.AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', cfg, {}, resp(400, { error: { message: 'laboratorio: fuera de ventana', code: 131047 } }));
      }
      return resp(200, { messages: [{ id: 'wamid.salida-1513.' + (++serieSalida) }] });
    } finally { httpPendientes -= 1; }
  };
  console.error = (...a) => trazas.push(a.map(String).join(' '));
  console.warn = (...a) => trazas.push(a.map(String).join(' '));
  console.log = () => {};

  const tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1513';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1513';
  config.WHATSAPP_APP_SECRET = SECRETO;
  const D = config.WA_DAILY_TEMPLATE_CAP;
  const { normalizePhone } = require(path.join(dist, 'core/utils/utils.js'));
  PROF = normalizePhone(tel.telefonoDePrueba(900)); PROF2 = normalizePhone(tel.telefonoDePrueba(901)); CLI = normalizePhone(tel.telefonoDePrueba(150)); NADIE = normalizePhone(tel.telefonoDePrueba(777));
  if (!PROF || !PROF2 || !CLI || !NADIE || new Set([PROF, PROF2, CLI, NADIE]).size !== 4) { hablar('GUION MUDO: telefonos de prueba no validos'); await apagar(); process.exit(2); }
  const notif = require(path.join(dist, 'integrations/whatsappNotifications.js'));
  const avisoOriginal = notif.notifyMerchantAlert;
  notif.notifyMerchantAlert = async (p) => { est.avisos += 1; return avisoOriginal(p); };
  const { app } = require(path.join(dist, 'app.js'));
  const moduloDb = require(path.join(dist, 'core/db/prisma.js'));
  if (moduloDb.prisma !== global.prisma) { hablar('CIEGO: la app no usa el cliente que apunta al Postgres desechable.'); await apagar(); process.exit(2); }
  servidorHttp = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidorHttp.address().port;
  const inicioDelDia = new Date(); inicioDelDia.setHours(0, 0, 0, 0);
  const sello = (c) => { c.hostDelTransporte = hostDelTransporte; c.inicioDelDia = inicioDelDia; };
  const caso = async (m) => { await nuevoCaso(m); sello(est); };
  const rep = (n) => (menosUno ? n - 1 : n);
  const M = D + 20;
  hablar('  app cargada de ' + path.relative(process.cwd(), path.join(dist, 'app.js')) + ' · NODE_ENV=' + config.NODE_ENV + ' · tope por comercio y dia leido en dist = ' + D
    + ' · pool de Prisma = ' + (POOL || 'por defecto') + ' · latencia del transporte doblado = ' + LATENCIA + ' ms' + (menosUno ? '  [ESPERADO -1: este guion debe salir rojo]' : ''));

  // ---------------------------------------------------------------------------------------------
  hablar('\n== 1 · CONTROLES ==');
  await caso({});
  for (let i = 0; i < 5; i += 1) await entrega([texto('hola ' + i)], { firmaMala: true });
  await anotar('Z0 CERO: 5 entrantes con la firma MALA', { avisos: 0, plantillasAlProfesional: 0, filasDePlantillaEnPostgres: 0, preguntasDelTope: 0, http: '401x5' });
  await caso({});
  await entrega([texto('hola')], { from: NADIE });
  await anotar('Z1 CERO: entrante valido de un numero que no es cliente de nadie', { avisos: 0, plantillasAlProfesional: 0, filasDePlantillaEnPostgres: 0, preguntasDelTope: 0, http: '200x1' });
  await caso({ sinAlbaran: true });
  await entrega([texto('una duda')]);
  await anotar('Z2 CERO: cliente SIN albaran reciente escribe 1 vez', { avisos: 0, plantillasAlProfesional: 0, filasDePlantillaEnPostgres: 0, textosAlCliente: 1, http: '200x1' });
  await caso({});
  await entrega([texto('una duda del albaran')]);
  const p1 = await anotar('P1 POSITIVO: cliente con albaran escribe 1 vez', { avisos: rep(1), plantillasAlProfesional: 1, filasDePlantillaEnPostgres: 1, filasQueCuentanHoyEnPostgres: 1, preguntasDelTope: 1, respuestaMaxima: 0, bloqueoComercio: 0, textosAlCliente: 1, http: '200x1' });
  // Cuantas conexiones tiene abiertas el servidor a esta base: con un banco en memoria no hay ninguna.
  const con = await uno('select numbackends::int as n from pg_stat_database where datname = current_database()');
  const otras = await uno("select count(*)::int as n from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()");
  hablar('       conexiones abiertas a la base en el servidor: ' + con.n + ' (la mia y ' + otras.n + ' del cliente de Prisma)');
  await caso({ sembradas: D });
  await entrega([texto('una duda del albaran')]);
  const p2 = await anotar('P2 POSITIVO del tope: ' + D + ' filas sembradas POR SQL y 1 mensaje', { avisos: 1, plantillasAlProfesional: 0, filasDePlantillaEnPostgres: 0, preguntasDelTope: 1, respuestaMaxima: D, bloqueoComercio: 1, filasDeBloqueoEnPostgres: 1 });
  await caso({ sembradas: D - 1 });
  await entrega([texto('una duda del albaran')]);
  await anotar('P3 BORDE del tope: ' + (D - 1) + ' filas sembradas POR SQL y 1 mensaje', { avisos: 1, plantillasAlProfesional: 1, filasDePlantillaEnPostgres: 1, filasQueCuentanHoyEnPostgres: D, preguntasDelTope: 1, respuestaMaxima: D - 1, bloqueoComercio: 0 });

  // ---------------------------------------------------------------------------------------------
  hablar('\n== 2 · EL TOPE (' + D + ') CON ' + M + ' MENSAJES DE UN CLIENTE CON ALBARAN, ventana del profesional CERRADA ==');
  await caso({});
  for (let i = 0; i < M; i += 1) await entrega([texto('mensaje ' + i)]);
  const l1 = await anotar('L1 ' + M + ' peticiones de 1 mensaje, SEGUIDAS (cada una espera a la anterior)', { avisos: rep(M), plantillasAlProfesional: D, filasDePlantillaEnPostgres: D, bloqueoComercio: M - D, filasDeBloqueoEnPostgres: M - D, http: '200x' + M });

  await caso({});
  await entrega(Array.from({ length: M }, (_, i) => texto('mensaje ' + i)));
  const l2 = await anotar('L2 UNA sola peticion con ' + M + ' mensajes dentro (lote)', { avisos: M, http: '200x1' }, true);
  hablar('       PREDICCION escrita antes: ' + M + ' plantillas y 0 bloqueos · SALIO: ' + l2.plantillasAlProfesional + ' plantillas y ' + l2.bloqueoComercio + ' bloqueos · '
    + (l2.plantillasAlProfesional > D ? 'EL TOPE NO AGUANTA en Postgres (sobran ' + (l2.plantillasAlProfesional - D) + ')' : 'EL TOPE AGUANTA en Postgres') + ' · la prediccion ' + (l2.plantillasAlProfesional === M && l2.bloqueoComercio === 0 ? 'se cumple' : 'NO se cumple'));
  await entrega([texto('uno mas, despues del lote')]);
  const l2b = await resumen();
  hablar('       despues del lote, 1 mensaje mas: plantillas en total = ' + l2b.plantillasAlProfesional + ' · bloqueos = ' + l2b.bloqueoComercio + ' · la ultima pregunta del tope contesto ' + est.preguntas.filter((p) => !p.conCliente).slice(-1)[0].respuesta);

  await caso({});
  await Promise.all(Array.from({ length: M }, (_, i) => { const cuerpo = cuerpoDe([texto('mensaje ' + i)]); return pedir('/webhooks/whatsapp', cuerpo, { 'x-hub-signature-256': firmar(cuerpo) }); }));
  await asentar();
  const l3 = await anotar('L3 ' + M + ' peticiones de 1 mensaje, lanzadas A LA VEZ', { avisos: M, http: '200x' + M }, true);
  const otrasL3 = await uno("select count(*)::int as n from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()");
  hablar('       conexiones del cliente de Prisma abiertas en el servidor tras L3: ' + otrasL3.n);
  hablar('       sin prediccion de cifra · SALIO: ' + l3.plantillasAlProfesional + ' plantillas y ' + l3.bloqueoComercio + ' bloqueos · ' + (l3.plantillasAlProfesional > D ? 'EL TOPE NO AGUANTA (sobran ' + (l3.plantillasAlProfesional - D) + ')' : 'el tope aguanta en esta pasada'));

  hablar('\n== 3 · EL CASO MAS PEQUENO: al borde del tope, un lote corto ==');
  await caso({ sembradas: D - 1 });
  await entrega([texto('uno'), texto('dos')]);
  const l4 = await anotar('L4 ' + (D - 1) + ' ya enviadas hoy y UNA peticion con 2 mensajes', { avisos: 2, http: '200x1' }, true);
  hablar('       cabia 1 · SALIERON ' + l4.plantillasAlProfesional + ' · filas que cuentan hoy = ' + l4.filasQueCuentanHoyEnPostgres + ' (tope ' + D + ')');
  await caso({ sembradas: D - 1 });
  await entrega([texto('uno'), texto('dos'), texto('tres'), texto('cuatro'), texto('cinco')]);
  const l5 = await anotar('L5 ' + (D - 1) + ' ya enviadas hoy y UNA peticion con 5 mensajes', { avisos: 5, http: '200x1' }, true);
  hablar('       cabia 1 · SALIERON ' + l5.plantillasAlProfesional + ' · filas que cuentan hoy = ' + l5.filasQueCuentanHoyEnPostgres + ' (tope ' + D + ')');

  // ---------------------------------------------------------------------------------------------
  // Parte 1 del ticket, SOLO MEDIDA: que lee hoy la ruta de la BAJA antes de avisar, y cuantas filas
  // tendria que mirar para saber si el cliente ya estaba de baja. No se propone codigo.
  hablar('\n== 4 · LA BAJA (whatsappIncoming.routes.ts, handleOptOutRequest) contra Postgres ==');
  const deBaja = async () => (await uno('select count(*) filter (where wa_opt_out)::int as si, count(*)::int as todos from customers')).si;
  const lecturas = () => 'lecturas de cliente con nombre: ' + est.lecturasDeCliente.length + ' · filas devueltas en cada una: ' + [...new Set(est.lecturasDeCliente.map((l) => l.filas))].join(',')
    + ' · piden la columna de la baja: ' + est.lecturasDeCliente.filter((l) => l.pideLaBaja).length + ' · escrituras de la baja: ' + est.escriturasDeBaja.length + ' (filas tocadas: ' + [...new Set(est.escriturasDeBaja)].join(',') + ')';
  await caso({ sinAlbaran: true });
  await entrega([texto('quiero la baja')]);
  await anotar('B0 CERO: un texto que NO es la orden de baja', { avisos: 0, plantillasAlProfesional: 0 });
  hablar('       clientes de baja en Postgres despues: ' + (await deBaja()) + ' · ' + lecturas());
  await caso({ sinAlbaran: true });
  await entrega([texto('BAJA')]);
  const b1 = await anotar('B1 POSITIVO: primera BAJA de un cliente que NO estaba de baja', { avisos: rep(1), plantillasAlProfesional: 1, textosAlCliente: 1 });
  const b1DeBaja = await deBaja();
  hablar('       clientes de baja en Postgres despues: ' + b1DeBaja + ' · ' + lecturas());
  await caso({ sinAlbaran: true, yaDeBaja: [50] });
  const antesB2 = await deBaja();
  for (let i = 0; i < 10; i += 1) await entrega([texto('BAJA')]);
  await anotar('B2 un cliente que YA esta de baja (' + antesB2 + ' fila) escribe BAJA 10 veces', { avisos: 10, plantillasAlProfesional: 10, textosAlCliente: 10 });
  hablar('       ' + lecturas());
  await caso({ sinAlbaran: true, dosComercios: true, yaDeBaja: [50] });
  await entrega([texto('BAJA')]);
  await anotar('B3 cliente de DOS comercios, de baja SOLO en el primero, escribe BAJA 1 vez', { avisos: 2, plantillasAlProfesional: 2, textosAlCliente: 1 });
  hablar('       avisos por destino: al comercio donde YA estaba de baja = ' + est.salidas.filter((p) => p.to === PROF && p.tipo === 'template').length + ' · al comercio donde es baja NUEVA = ' + est.salidas.filter((p) => p.to === PROF2 && p.tipo === 'template').length
    + ' · clientes de baja despues: ' + (await deBaja()) + ' · ' + lecturas());
  if (b1DeBaja !== 1) { noCuadran.push('B1-estado'); hablar('ROJO   B1: la baja no quedo escrita en Postgres'); }

  hablar('\n== operaciones de Prisma que llegaron a Postgres en toda la corrida (por la app) ==');
  hablar(Object.entries(operaciones).sort().map(([k, v]) => '  ' + k + ' x' + v).join('\n') || '  (ninguna)');
  const totalOps = Object.values(operaciones).reduce((s, v) => s + v, 0);
  const controles = filas.filter((f) => /^(Z|P|L1|B)/.test(f.nombre));
  hablar('\nCASOS: ' + filas.length + ' · controles con esperado: ' + controles.length + ' · NO cuadran: ' + noCuadran.length + ' · operaciones de Prisma observadas: ' + totalOps);
  hablar('POSITIVOS OBLIGATORIOS: P1 conto ' + p1.avisos + ' aviso y ' + p1.filasDePlantillaEnPostgres + ' fila en Postgres · P2 vio ' + p2.bloqueoComercio + ' bloqueo con el tope contestando ' + p2.respuestaMaxima
    + ' · L1 vio ' + l1.bloqueoComercio + ' bloqueos · conexiones de Prisma en el servidor: ' + otras.n + ' (los cuatro > 0).');
  const mudo = !(p1.avisos > 0) || !(p1.filasDePlantillaEnPostgres > 0) || !(p2.bloqueoComercio > 0) || !(l1.bloqueoComercio > 0) || !(otras.n > 0) || !(totalOps > 0);
  await apagar();
  hablar('servidor apagado y carpeta de datos borrada: ' + (!fs.existsSync(carpetaDatos)));
  if (mudo) { hablar('GUION MUDO: el instrumento no ve lo que tiene que ver.'); process.exit(2); }
  hablar('EXIT=' + (noCuadran.length ? 1 : 0));
  process.exit(noCuadran.length ? 1 : 0);
})().catch(async (e) => { hablar('GUION ROTO: ' + ((e && e.stack) || e)); await apagar(); process.exit(2); });
