#!/usr/bin/env node
// SCRUM-1513f · Cuanto tarda la reserva del tope, y con que rafaga se agota la espera de su transaccion.
//
// Hermano de `../SCRUM-1513d/reserva-postgres.cjs`. Aquel mide QUE decide la reserva; este mide CUANTO
// tarda, que es lo que `tests/scrum728-seccion-critica-de-la-serie.test.mjs` pide antes de dejar que una
// transaccion fije `maxWait` o `timeout`. Llama a `reservarPlantilla` de `dist`, la de verdad, con un
// cliente propio contra un PostgreSQL desechable en loopback. No pasa por el proveedor: la llamada al
// proveedor ocurre FUERA de la transaccion y no consume su espera.
//
// NO es un test de la tanda: arranca un servidor de base de datos. Se corre a mano.
// Uso:  node reserva-duracion.cjs <dist> <carpeta con embedded-postgres> <ddl.sql> [--pool N] [--rafagas 120,500]
// Sale 0 si el instrumento midio y sus controles cuadran, 2 si no pudo medir.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('reserva-duracion.cjs no es un test: arranca un servidor. No hace nada bajo node --test.'); process.exit(0);
}
const args = process.argv.slice(2);
const opcion = (nombre) => { const i = args.indexOf(nombre); return i === -1 ? null : args.splice(i, 2)[1]; };
const pool = opcion('--pool');
const rafagas = (opcion('--rafagas') || '120,500,1000,2000,4000').split(',').map(Number);
const dist = path.resolve(args[0] || 'dist');
const carpetaPg = path.resolve(args[1] || '.');
const ficheroDdl = path.resolve(args[2] || 'esquema.sql');
// Ninguna clave de base del entorno llega al cliente: la unica URL es la que se fabrica mas abajo.
for (const k of Object.keys(process.env)) if (/^DATABASE_URL/.test(k) || k === 'LIBRO_PG_URL') delete process.env[k];

const BASE = 'yaqu_duracion_1513_test';
const COMERCIO = 7;
const TOPE = 100;
const hablar = console.log.bind(console);
let sql; let db; let servidorPg = null; let carpetaDatos = null;

async function apagar() {
  try { if (db) await db.$disconnect(); } catch { /* nada */ }
  try { if (sql) await sql.end(); } catch { /* nada */ }
  try { if (servidorPg) await servidorPg.stop(); } catch { /* nada */ }
  try { if (carpetaDatos) fs.rmSync(carpetaDatos, { recursive: true, force: true }); } catch { /* nada */ }
}
const puertoLibre = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const uno = async (texto, valores) => (await sql.query(texto, valores)).rows[0];
const ms = (n) => Math.round(n) + ' ms';
const percentil = (orden, p) => orden[Math.min(orden.length - 1, Math.floor(orden.length * p))];

async function unaReserva(log, tope) {
  const t0 = performance.now();
  try {
    const r = await log.reservarPlantilla(db, { merchantId: COMERCIO, templateName: 'duracion', topeComercio: tope, topeCliente: 3 });
    return { que: r.ok ? 'reservada' : 'bloqueada', tarda: performance.now() - t0 };
  } catch (e) {
    const texto = String((e && e.message) || e).split('\n').map((l) => l.trim()).filter(Boolean).pop() || '';
    return { que: 'lanza', codigo: (e && e.code) || 'sin codigo', texto, tarda: performance.now() - t0 };
  }
}

async function rafaga(log, n, tope, rotulo) {
  await sql.query('TRUNCATE whatsapp_messages RESTART IDENTITY');
  const t0 = performance.now();
  const r = await Promise.all(Array.from({ length: n }, () => unaReserva(log, tope)));
  const pared = performance.now() - t0;
  const de = (que) => r.filter((x) => x.que === que);
  const lanzan = de('lanza');
  const filas = (await uno("select count(*)::int as n, count(*) filter (where status = 'queued')::int as q from whatsapp_messages"));
  const tardan = r.map((x) => x.tarda).sort((a, b) => a - b);
  const porCodigo = {};
  for (const x of lanzan) porCodigo[x.codigo] = (porCodigo[x.codigo] || 0) + 1;
  hablar('  ' + rotulo + ' · ' + n + ' a la vez → reservadas ' + de('reservada').length + ' · bloqueadas ' + de('bloqueada').length
    + ' · LANZAN ' + lanzan.length + (lanzan.length ? ' ' + JSON.stringify(porCodigo) : '')
    + ' · filas ' + filas.n + ' · mediana ' + ms(percentil(tardan, 0.5)) + ' · la mas lenta ' + ms(tardan[tardan.length - 1]) + ' · total ' + ms(pared));
  if (lanzan.length) {
    const lentas = lanzan.map((x) => x.tarda).sort((a, b) => a - b);
    hablar('      las que lanzan tardan de ' + ms(lentas[0]) + ' a ' + ms(lentas[lentas.length - 1]) + ' · un texto: ' + lanzan[0].texto.slice(0, 200));
  }
  const cuadra = de('reservada').length + de('bloqueada').length + lanzan.length === n && filas.n === de('reservada').length && filas.q === filas.n
    && de('reservada').length <= tope;
  if (!cuadra) { hablar('      CIEGO: los recuentos no cuadran con las filas.'); return false; }
  return true;
}

(async () => {
  const requierePg = createRequire(path.join(carpetaPg, 'package.json'));
  const EmbeddedPostgres = (await import(pathToFileURL(requierePg.resolve('embedded-postgres')).href)).default;
  const { Client } = requierePg('pg');
  carpetaDatos = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1513f-pg-'));
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

  const quien = await uno('select version() as version, current_database() as base, host(inet_server_addr()) as host, inet_server_port() as puerto');
  hablar('== 0 · CON QUIEN HABLO, Y QUE MIDO ==');
  hablar('  ' + quien.version + ' · base=' + quien.base + ' · host=' + quien.host + ':' + quien.puerto);
  if (!/^PostgreSQL \d+\./.test(quien.version) || quien.base !== BASE || !['127.0.0.1', '::1'].includes(quien.host) || Number(quien.puerto) !== puertoPg) { hablar('CIEGO: no es el Postgres desechable que acabo de arrancar.'); await apagar(); process.exit(2); }
  await sql.query(fs.readFileSync(ficheroDdl, 'utf8'));
  const tablas = await uno("select count(*)::int as n, count(*) filter (where tablename = 'whatsapp_messages')::int as wa from pg_tables where schemaname = 'public'");
  if (!(tablas.n > 10) || tablas.wa !== 1) { hablar('CIEGO: el esquema no quedo puesto.'); await apagar(); process.exit(2); }

  // Que variante del codigo se mide: se LEE del fichero de dist que se va a ejecutar, no se supone.
  const rutaLog = path.join(dist, 'modules/messaging/domain/whatsappLog.service.js');
  const fuente = fs.readFileSync(rutaLog, 'utf8');
  const cuerpo = fuente.slice(fuente.indexOf('async function reservarPlantilla'), fuente.indexOf('async function resolverReservaDePlantilla'));
  if (!cuerpo.includes('pg_advisory_xact_lock')) { hablar('CIEGO: no encuentro la reserva en dist.'); await apagar(); process.exit(2); }
  const opciones = /maxWait:\s*([\d_]+)[\s\S]*?timeout:\s*([\d_]+)/.exec(cuerpo);
  hablar('  opciones de la transaccion en dist: ' + (opciones ? 'maxWait ' + opciones[1] + ' · timeout ' + opciones[2] : 'NINGUNA (las de Prisma por defecto: maxWait 2000 · timeout 5000)'));

  const requiereDist = createRequire(rutaLog);
  const { PrismaClient } = requiereDist('@prisma/client');
  const url = 'postgresql://' + usuario + ':' + clave + '@127.0.0.1:' + puertoPg + '/' + BASE + (pool ? '?connection_limit=' + pool : '');
  db = new PrismaClient({ datasourceUrl: url });
  hablar('  conexiones del cliente: ' + (pool || 'las de Prisma por defecto, ' + (os.cpus().length * 2 + 1) + ' (nucleos x 2 + 1)') + ' · tope del comercio ' + TOPE);
  const log = require(rutaLog);
  if (typeof log.reservarPlantilla !== 'function') { hablar('CIEGO: dist no exporta reservarPlantilla.'); await apagar(); process.exit(2); }

  let bien = true;
  hablar('== 1 · UNA RESERVA, SOLA (200 seguidas, sin nadie mas; las 5 primeras se descartan) ==');
  for (let i = 0; i < 5; i += 1) await unaReserva(log, 1e9);
  const solas = [];
  for (let i = 0; i < 200; i += 1) solas.push(await unaReserva(log, 1e9));
  const noReservan = solas.filter((x) => x.que !== 'reservada').length;
  const t = solas.map((x) => x.tarda).sort((a, b) => a - b);
  hablar('  reservadas ' + (200 - noReservan) + ' de 200 · minima ' + t[0].toFixed(1) + ' ms · mediana ' + percentil(t, 0.5).toFixed(1) + ' ms · p95 ' + percentil(t, 0.95).toFixed(1) + ' ms · maxima ' + t[199].toFixed(1) + ' ms');
  if (noReservan) { hablar('      CIEGO: una reserva sola no reservo.'); bien = false; }

  hablar('== 2 · RAFAGA CON EL TOPE EN ' + TOPE + ' (lo que pasa en produccion: a partir de la 100 solo se pregunta) ==');
  for (const n of rafagas) bien = (await rafaga(log, n, TOPE, 'tope ' + TOPE)) && bien;
  hablar('== 3 · RAFAGA SIN TOPE (el peor caso: todas escriben su fila) ==');
  for (const n of rafagas) bien = (await rafaga(log, n, 1e9, 'sin tope')) && bien;

  await apagar();
  hablar(bien ? 'INSTRUMENTO: midio y sus recuentos cuadran.' : 'INSTRUMENTO: CIEGO en algun caso, ver arriba.');
  process.exit(bien ? 0 : 2);
})().catch(async (e) => { console.error('INSTRUMENTO:', e && e.stack || e); await apagar(); process.exit(2); });
