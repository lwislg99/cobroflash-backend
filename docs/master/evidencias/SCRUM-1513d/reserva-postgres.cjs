#!/usr/bin/env node
// SCRUM-1513d · La reserva del tope de plantillas, contra un PostgreSQL de verdad y desechable.
//
// Hermano de `../SCRUM-1513/tope-postgres.cjs`. Aquel pide la app entera por HTTP y mide el tope desde
// el webhook; este llama a `sendWhatsAppTemplate` de `dist` directamente, porque lo que mide son los
// desenlaces del proveedor (acepta, rechaza, no contesta), que desde el webhook no se pueden provocar.
//
// NO es un test de la tanda: arranca un servidor de base de datos. Se corre a mano.
// Uso:  node reserva-postgres.cjs <dist> <carpeta con embedded-postgres> <ddl.sql>
// Sale 0 si todo cuadra, 1 si algo no cuadra, 2 si el instrumento no pudo medir.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const dist = path.resolve(process.argv[2] || 'dist');
const carpetaPg = path.resolve(process.argv[3] || '.');
const ficheroDdl = path.resolve(process.argv[4] || 'esquema.sql');
if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('reserva-postgres.cjs no es un test: arranca un servidor. No hace nada bajo node --test.'); process.exit(0);
}
for (const k of ['WHATSAPP_DRY_RUN', 'WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP']) delete process.env[k];
// Ninguna clave de base del entorno llega al cliente: la unica URL es la que se fabrica mas abajo.
for (const k of Object.keys(process.env)) if (/^DATABASE_URL/.test(k) || k === 'LIBRO_PG_URL') delete process.env[k];

const BASE = 'yaqu_reserva_1513_test';
const M1 = 7; const M2 = 8; const CLIENTE = 50;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hablar = console.log.bind(console);
const trazas = [];
let sql; let prismaBase; let servidorPg = null; let carpetaDatos = null;
let modo = 'acepta'; let latencia = 0; let serie = 0; let alLlamar = null;
const salidas = [];
const noCuadran = [];

async function apagar() {
  try { if (prismaBase) await prismaBase.$disconnect(); } catch { /* nada */ }
  try { if (sql) await sql.end(); } catch { /* nada */ }
  try { if (servidorPg) await servidorPg.stop(); } catch { /* nada */ }
  try { if (carpetaDatos) fs.rmSync(carpetaDatos, { recursive: true, force: true }); } catch { /* nada */ }
}
const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const uno = async (texto, valores) => (await sql.query(texto, valores)).rows[0];

async function limpiar() {
  await sql.query('TRUNCATE whatsapp_messages RESTART IDENTITY');
  trazas.length = 0; salidas.length = 0; modo = 'acepta'; latencia = 0; alLlamar = null;
}
// Filas sembradas POR SQL, por la conexion independiente. La hora va en UTC, que es como la escribe Prisma.
async function sembrar(merchant, n, opciones) {
  const o = opciones || {};
  await sql.query("insert into whatsapp_messages (merchant_id, customer_id, type, template_name, wa_message_id, status, cost_estimate, created_at, updated_at) "
    + "select $1, $2, 'template', 'siembra', case when $3 then null else 'siembra-' || $4 || '.' || g end, $5, 0, "
    + "(now() at time zone 'utc') - make_interval(days => $6), now() at time zone 'utc' from generate_series(1, $7) g",
  [merchant, o.cliente || null, !!o.sinIdentificador, String(++serie), o.estado || 'sent', o.diasAtras || 0, n]);
}
// Las resoluciones no se esperan dentro del envio: se espera a que la tabla deje de moverse.
async function asentar() {
  let antes = ''; let quietos = 0;
  for (let i = 0; i < 500 && quietos < 5; i += 1) {
    await dormir(40);
    const f = await uno("select count(*)::int as n, coalesce(max(updated_at)::text, '') as u, count(*) filter (where status = 'queued' and error is null)::int as q from whatsapp_messages");
    const ahora = f.n + '/' + f.u + '/' + f.q + '/' + salidas.length;
    quietos = ahora === antes ? quietos + 1 : 0; antes = ahora;
  }
  if (quietos < 5) throw new Error('INSTRUMENTO: el caso no se asento');
}
async function foto(merchant) {
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  return uno("select count(*) filter (where status = 'sent' and wa_message_id like 'wamid.reserva-1513.%')::int as enviadas, "
    + "count(*) filter (where status = 'queued')::int as en_cola, "
    + "count(*) filter (where status = 'queued' and (related_type is not null or related_id is not null))::int as en_cola_con_documento, "
    + "count(*) filter (where status = 'queued' and error is not null)::int as en_cola_con_motivo, "
    + "count(*) filter (where status = 'failed' and error = 'daily_cap')::int as bloqueo_comercio, "
    + "count(*) filter (where status = 'failed' and error = 'customer_daily_cap')::int as bloqueo_cliente, "
    + "count(*) filter (where status = 'failed' and error not in ('daily_cap', 'customer_daily_cap'))::int as fallidas, "
    + "count(*) filter (where status = 'failed' and error not in ('daily_cap', 'customer_daily_cap') and related_type = 'quote' and related_id = 5)::int as fallidas_con_documento, "
    + "count(*) filter (where status = 'sent' and related_type = 'quote' and related_id = 5)::int as enviadas_con_documento, "
    + "count(*) filter (where created_at >= $2 and (wa_message_id is not null or status = 'queued'))::int as cuentan_hoy "
    + "from whatsapp_messages where merchant_id = $1", [merchant, inicio]);
}
function anotar(nombre, obtenido, esperado) {
  const fallos = [];
  for (const [k, v] of Object.entries(esperado)) {
    if (!(k in obtenido)) fallos.push(k + ': el esperado nombra una clave que no existe');
    else if (obtenido[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + obtenido[k]);
  }
  const errores = trazas.filter((l) => /Error comprobando topes|omitido/.test(l));
  if (errores.length) fallos.push('hubo ' + errores.length + ' trazas de error de base: el caso NO vale (' + errores[0].slice(0, 160) + ')');
  if (fallos.length) noCuadran.push(nombre);
  hablar((fallos.length ? 'ROJO   ' : 'cuadra ') + nombre.padEnd(86) + ' ' + Object.keys(esperado).map((k) => k + '=' + obtenido[k]).join(' ')
    + (fallos.length ? '  <<< ' + fallos.join(' | ') : ''));
}

(async () => {
  { const d = new Date(); const min = d.getHours() * 60 + d.getMinutes(); if (min < 20 || min > 24 * 60 - 20) { hablar('CIEGO: a menos de 20 minutos de la medianoche local el dia del tope cambia a mitad de la corrida.'); process.exit(2); } }

  const requierePg = createRequire(path.join(carpetaPg, 'package.json'));
  const EmbeddedPostgres = (await import(pathToFileURL(requierePg.resolve('embedded-postgres')).href)).default;
  const { Client } = requierePg('pg');
  carpetaDatos = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1513d-pg-'));
  // SCRUM-864c: al salir el proceso la carpeta se borra pase lo que pase, no solo si se llega a `apagar()`.
  process.on('exit', () => { try { fs.rmSync(carpetaDatos, { recursive: true, force: true }); } catch { /* nada */ } });
  const puertoPg = await puertoLibre();
  const usuario = 'u' + crypto.randomBytes(4).toString('hex');
  const clave = crypto.randomBytes(12).toString('hex');
  servidorPg = new EmbeddedPostgres({ databaseDir: carpetaDatos, user: usuario, password: clave, port: puertoPg, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
  await servidorPg.initialise();
  await servidorPg.start();
  await servidorPg.createDatabase(BASE);
  if (!BASE.endsWith('_test')) throw new Error('la base no termina en _test');
  sql = new Client({ host: '127.0.0.1', port: puertoPg, user: usuario, password: clave, database: BASE }); await sql.connect();

  const quien = await uno("select version() as version, current_database() as base, host(inet_server_addr()) as host, inet_server_port() as puerto");
  hablar('== 0 · CON QUIEN HABLO ==');
  hablar('  ' + quien.version + ' · base=' + quien.base + ' · host=' + quien.host + ':' + quien.puerto);
  if (!/^PostgreSQL \d+\./.test(quien.version) || quien.base !== BASE || !['127.0.0.1', '::1'].includes(quien.host) || Number(quien.puerto) !== puertoPg) { hablar('CIEGO: no es el Postgres desechable que acabo de arrancar.'); await apagar(); process.exit(2); }
  await sql.query(fs.readFileSync(ficheroDdl, 'utf8'));
  const tablas = await uno("select count(*)::int as n, count(*) filter (where tablename = 'whatsapp_messages')::int as wa from pg_tables where schemaname = 'public'");
  if (!(tablas.n > 10) || tablas.wa !== 1) { hablar('CIEGO: el esquema no quedo puesto.'); await apagar(); process.exit(2); }

  const requiereDist = createRequire(path.join(dist, 'integrations/whatsapp.js'));
  const { PrismaClient } = requiereDist('@prisma/client');
  prismaBase = new PrismaClient({ datasourceUrl: 'postgresql://' + usuario + ':' + clave + '@127.0.0.1:' + puertoPg + '/' + BASE });
  global.prisma = prismaBase;
  global.fetch = () => { throw new Error('INSTRUMENTO: alguien llamo a fetch'); };

  const axios = requiereDist('axios');
  axios.defaults.adapter = async (cfg) => {
    let cuerpo = {};
    try { cuerpo = JSON.parse(cfg.data); } catch { /* vacio */ }
    salidas.push(String(cuerpo.to || ''));
    const resp = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
    if (alLlamar) await alLlamar();
    if (latencia) await dormir(latencia);
    const m = modo;
    if (m === 'rechaza') throw new axios.AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', cfg, {}, resp(400, { error: { message: 'laboratorio: rechazado', code: 131026 } }));
    if (m === 'quinientos') throw new axios.AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', cfg, {}, resp(500, { error: { message: 'laboratorio: 500' } }));
    if (m === 'corta') throw new axios.AxiosError('socket hang up', 'ECONNRESET', cfg, {});
    return resp(200, { messages: [{ id: 'wamid.reserva-1513.' + (++serie) }] });
  };
  console.error = (...a) => trazas.push(a.map(String).join(' '));
  console.warn = (...a) => trazas.push(a.map(String).join(' '));
  console.log = () => {};

  const tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1513d';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1513d';
  const D = config.WA_DAILY_TEMPLATE_CAP; const C = config.WA_CUSTOMER_DAILY_CAP;
  const { normalizePhone } = require(path.join(dist, 'core/utils/utils.js'));
  const DESTINO = normalizePhone(tel.telefonoDePrueba(150));
  const moduloDb = require(path.join(dist, 'core/db/prisma.js'));
  if (moduloDb.prisma !== global.prisma) { hablar('CIEGO: dist no usa el cliente que apunta al Postgres desechable.'); await apagar(); process.exit(2); }
  const wa = require(path.join(dist, 'integrations/whatsapp.js'));
  const especificadas = Object.keys(require(path.join(dist, 'integrations/whatsappTemplates.js')).WA_TEMPLATE_SPECS || {});
  if (!DESTINO || !especificadas.length || !(D > 2) || !(C > 1)) { hablar('GUION MUDO: falta el telefono de prueba, alguna plantilla con especificacion, o los topes'); await apagar(); process.exit(2); }
  const enviar = (extra) => wa.sendWhatsAppTemplate({ to: DESTINO, templateName: 'laboratorio_1513d', merchantId: M1, log: { relatedType: 'quote', relatedId: 5 }, ...(extra || {}) });
  hablar('  dist = ' + path.relative(process.cwd(), dist) + ' · tope por comercio = ' + D + ' · tope por cliente = ' + C + ' · plantilla invalida de prueba: ' + especificadas[0]);

  hablar('\n== 1 · CONTROLES ==');
  await limpiar();
  let r = await wa.sendWhatsAppTemplate({ to: DESTINO, templateName: 'laboratorio_1513d' });
  await asentar();
  anotar('Z0 CERO: envio sin comercio (no hay tope ni fila que apuntar)', { ok: r.ok, salidas: salidas.length, filas: (await uno('select count(*)::int as n from whatsapp_messages')).n }, { ok: true, salidas: 1, filas: 0 });

  await limpiar();
  let enLaLlamada = null;
  alLlamar = async () => { enLaLlamada = await foto(M1); };
  r = await enviar();
  await asentar();
  let f = await foto(M1);
  anotar('P1 POSITIVO: 1 envio, base limpia · al acabar', { ok: r.ok, ...f }, { ok: true, enviadas: 1, enviadas_con_documento: 1, en_cola: 0, fallidas: 0, cuentan_hoy: 1 });
  anotar('P1b MIENTRAS el proveedor contesta: la fila ya esta, en cola y sin documento', enLaLlamada || {}, { en_cola: 1, en_cola_con_documento: 0, enviadas: 0, cuentan_hoy: 1 });

  await limpiar(); await sembrar(M1, D);
  r = await enviar(); await asentar(); f = await foto(M1);
  anotar('P2 POSITIVO del tope: ' + D + ' sembradas y 1 envio', { ok: r.ok, reason: r.reason, salidas: salidas.length, ...f }, { ok: false, reason: 'daily_cap', salidas: 0, bloqueo_comercio: 1, en_cola: 0 });

  hablar('\n== 2 · LO QUE DECIDIO EL FUNDADOR (c.18988) ==');
  await limpiar(); await sembrar(M1, D - 1);
  modo = 'rechaza'; const a1 = await enviar(); await asentar(); const f1 = await foto(M1);
  modo = 'acepta'; const a2 = await enviar(); await asentar(); f = await foto(M1);
  anotar('D1 el proveedor RECHAZA (400): devuelve el hueco', { ok: a1.ok, desenlace: a1.desenlace, en_cola: f1.en_cola, fallidas: f1.fallidas, fallidas_con_documento: f1.fallidas_con_documento, cuentan_hoy: f1.cuentan_hoy },
    { ok: false, desenlace: 'rechazado', en_cola: 0, fallidas: 1, fallidas_con_documento: 1, cuentan_hoy: D - 1 });
  anotar('D1b y el siguiente SALE', { ok: a2.ok, enviadas: f.enviadas, cuentan_hoy: f.cuentan_hoy, bloqueo_comercio: f.bloqueo_comercio }, { ok: true, enviadas: 1, cuentan_hoy: D, bloqueo_comercio: 0 });

  for (const [nombre, m] of [['D2 el proveedor NO CONTESTA (conexion cortada)', 'corta'], ['D3 el proveedor contesta 500', 'quinientos']]) {
    await limpiar(); await sembrar(M1, D - 1);
    modo = m; const b1 = await enviar(); await asentar(); const g1 = await foto(M1);
    modo = 'acepta'; const b2 = await enviar(); await asentar(); f = await foto(M1);
    anotar(nombre + ': OCUPA el hueco', { ok: b1.ok, desenlace: b1.desenlace, en_cola: g1.en_cola, en_cola_con_motivo: g1.en_cola_con_motivo, en_cola_con_documento: g1.en_cola_con_documento, fallidas: g1.fallidas, cuentan_hoy: g1.cuentan_hoy },
      { ok: false, desenlace: 'sin_respuesta', en_cola: 1, en_cola_con_motivo: 1, en_cola_con_documento: 0, fallidas: 0, cuentan_hoy: D });
    anotar('   y el siguiente NO sale', { ok: b2.ok, reason: b2.reason, enviadas: f.enviadas, bloqueo_comercio: f.bloqueo_comercio, salidas: salidas.length }, { ok: false, reason: 'daily_cap', enviadas: 0, bloqueo_comercio: 1, salidas: 1 });
    // Lo que leeria el paquete de disputa para ese documento (invoicesAdmin.routes.ts: por documento, sin mirar el estado).
    const paquete = await uno("select count(*)::int as filas, count(*) filter (where status = 'queued')::int as en_cola from whatsapp_messages where merchant_id = $1 and related_type = 'quote' and related_id = 5", [M1]);
    anotar('   y el documento no tiene ninguna fila en cola (lo que imprime el paquete de disputa)', paquete, { en_cola: 0 });
  }

  await limpiar(); await sembrar(M1, D - 1); await sembrar(M1, 1, { estado: 'queued', sinIdentificador: true, diasAtras: 1 });
  r = await enviar(); await asentar(); f = await foto(M1);
  anotar('D4 una reserva parada de AYER no cuenta hoy', { ok: r.ok, enviadas: f.enviadas, cuentan_hoy: f.cuentan_hoy }, { ok: true, enviadas: 1, cuentan_hoy: D });
  await limpiar(); await sembrar(M1, D - 1); await sembrar(M1, 1, { estado: 'queued', sinIdentificador: true });
  r = await enviar(); await asentar(); f = await foto(M1);
  anotar('D5 una reserva parada de HOY si cuenta', { ok: r.ok, reason: r.reason, enviadas: f.enviadas, bloqueo_comercio: f.bloqueo_comercio }, { ok: false, reason: 'daily_cap', enviadas: 0, bloqueo_comercio: 1 });

  hablar('\n== 3 · A LA VEZ ==');
  await limpiar(); await sembrar(M1, D - 1);
  let rs = await Promise.all([enviar(), enviar()]); await asentar(); f = await foto(M1);
  anotar('A1 ' + (D - 1) + ' sembradas y 2 envios a la vez: sale 1, NO 2 y NO 0', { salen: rs.filter((x) => x.ok).length, enviadas: f.enviadas, bloqueo_comercio: f.bloqueo_comercio, cuentan_hoy: f.cuentan_hoy }, { salen: 1, enviadas: 1, bloqueo_comercio: 1, cuentan_hoy: D });

  await limpiar(); await sembrar(M1, C - 1, { cliente: CLIENTE });
  rs = await Promise.all([1, 2, 3].map(() => enviar({ log: { customerId: CLIENTE, relatedType: 'quote', relatedId: 5 } }))); await asentar(); f = await foto(M1);
  anotar('A2 tope por CLIENTE: ' + (C - 1) + ' sembradas a ese cliente y 3 envios a la vez', { salen: rs.filter((x) => x.ok).length, enviadas: f.enviadas, bloqueo_cliente: f.bloqueo_cliente, bloqueo_comercio: f.bloqueo_comercio }, { salen: 1, enviadas: 1, bloqueo_cliente: 2, bloqueo_comercio: 0 });

  await limpiar(); await sembrar(M1, D - 1); await sembrar(M2, D - 1);
  rs = await Promise.all([enviar(), enviar(), enviar({ merchantId: M2 }), enviar({ merchantId: M2 })]); await asentar();
  f = await foto(M1); const f2 = await foto(M2);
  anotar('A3 dos comercios al borde, 2 envios a la vez en cada uno: 1 y 1 (el cerrojo no es global)', { m1: f.enviadas, m1_bloq: f.bloqueo_comercio, m2: f2.enviadas, m2_bloq: f2.bloqueo_comercio }, { m1: 1, m1_bloq: 1, m2: 1, m2_bloq: 1 });

  await limpiar(); latencia = 150;
  const t0 = Date.now(); rs = await Promise.all(Array.from({ length: 20 }, () => enviar())); const ms = Date.now() - t0; await asentar(); f = await foto(M1);
  anotar('A4 20 envios a la vez con el proveedor tardando 150 ms: no van de uno en uno (en serie serian 3000 ms)', { salen: rs.filter((x) => x.ok).length, enviadas: f.enviadas, menos_de_1500_ms: ms < 1500 }, { salen: 20, enviadas: 20, menos_de_1500_ms: true });
  hablar('       tardaron ' + ms + ' ms');

  hablar('\n== 4 · EL ORDEN: la plantilla se valida ANTES de reservar ==');
  await limpiar();
  r = await enviar({ templateName: especificadas[0], components: [] }); await asentar(); f = await foto(M1);
  anotar('V1 plantilla invalida: no sale y no ocupa hueco', { ok: r.ok, invalida: /^template_invalid/.test(String(r.error)), salidas: salidas.length, en_cola: f.en_cola, cuentan_hoy: f.cuentan_hoy }, { ok: false, invalida: true, salidas: 0, en_cola: 0, cuentan_hoy: 0 });

  hablar('\nCASOS QUE NO CUADRAN: ' + noCuadran.length + (noCuadran.length ? ' · ' + noCuadran.join(' · ') : ''));
  await apagar();
  hablar('servidor apagado y carpeta de datos borrada: ' + !fs.existsSync(carpetaDatos));
  hablar('EXIT=' + (noCuadran.length ? 1 : 0));
  process.exit(noCuadran.length ? 1 : 0);
})().catch(async (e) => { hablar('INSTRUMENTO ROTO: ' + (e && e.stack ? e.stack : e)); await apagar(); process.exit(2); });
