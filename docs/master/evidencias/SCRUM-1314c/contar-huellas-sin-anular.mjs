// docs/master/evidencias/SCRUM-1314c/contar-huellas-sin-anular.mjs — SCRUM-1314c (P3 de c.20754) · jv-j1bp
//
// Cuenta las facturas con huella de anulación (`vf_anul_hash`) que NO están `annulled`, contra UNA
// base, por su clave de entorno, dentro de una transacción READ ONLY. Calcado de
// `docs/master/evidencias/SCRUM-612/contar-justificantes-612.mjs` (la sonda de la casa).
//
// Uso:   node --env-file=.env docs/master/evidencias/SCRUM-1314c/contar-huellas-sin-anular.mjs <raiz> <CLAVE> [--quitar-sembrado]
//        (CLAVE = DATABASE_URL_STAGING | DATABASE_URL_DEV)
//
// Tres controles antes de creerse el recuento:
//   ① la base CONFIRMA el READ ONLY: `SHOW transaction_read_only` = on, y una escritura sobre
//      `invoices` (con `WHERE false`, dentro de un SAVEPOINT) la RECHAZA Postgres con 25006;
//   ② positivo SEMBRADO: la misma expresión de recuento sobre un VALUES fabricado aquí, con una fila
//      huérfana conocida, tiene que dar 3/2/1. Con `--quitar-sembrado` se quita esa fila y el
//      veredicto tiene que salir CIEGO, no verde;
//   ③ la población: el total de `invoices` sale en la misma fila que el recuento.
//
// 🔴 Se niega a correr contra PRODUCCIÓN por DESTINO (`HOST_PRODUCCION` de `scripts/_clave-vs-destino.mjs`).
// Nunca imprime la URL: sólo `host/base` por `describirBD` (regla 9). No escribe ninguna fila (regla 29).
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] ?? '.');
const CLAVE = process.argv[3];
const QUITAR_SEMBRADO = process.argv.includes('--quitar-sembrado');
const PERMITIDAS = ['DATABASE_URL_STAGING', 'DATABASE_URL_DEV'];
if (!PERMITIDAS.includes(CLAVE)) { console.error(`Clave no permitida: ${CLAVE}. Sólo ${PERMITIDAS.join(' | ')}.`); process.exit(2); }
const url = process.env[CLAVE];
if (!url) { console.error(`${CLAVE} no está en el entorno: NO MEDIDO.`); process.exit(2); }

const { HOST_PRODUCCION } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_clave-vs-destino.mjs')).href);
const { describirBD, parseBDSegura } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_db-guard.mjs')).href);
const destino = parseBDSegura(url);
if (!destino) { console.error('URL ilegible: NO MEDIDO.'); process.exit(2); }
if (!HOST_PRODUCCION || destino.host === HOST_PRODUCCION) {
  console.error(`🔴 ${CLAVE} apunta a PRODUCCIÓN (${destino.host}) o no se sabe cuál es producción. No se corre.`);
  process.exit(3);
}
console.log(`clave ${CLAVE} → ${describirBD(url)}  (host de producción declarado: distinto: sí)`);

// La MISMA expresión para la base y para el sembrado: si el positivo pasa, pasa por este texto.
const RECUENTO = `count(*) AS total,
       count(*) FILTER (WHERE vf_anul_hash IS NOT NULL) AS con_huella,
       count(*) FILTER (WHERE vf_anul_hash IS NOT NULL AND status <> 'annulled') AS huella_sin_anular`;
const SEMBRADO = [
  "(NULL::text, 'paid')",      // sin huella: cuenta en total
  "('h1', 'annulled')",       // huella y anulada: con_huella, no huérfana
  "('h2', 'paid')",           // EL HUÉRFANO fabricado: huella sobre una cobrada
].filter((_f, i) => !(QUITAR_SEMBRADO && i === 2));

const req = createRequire(path.join(RAIZ, 'package.json'));
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: url });
const n = (x) => Number(x);
let exit = 0;
try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');

    // ① la base confirma el READ ONLY (lo dice, y además lo hace cumplir)
    const [{ transaction_read_only: ro }] = await tx.$queryRawUnsafe('SHOW transaction_read_only');
    await tx.$executeRawUnsafe('SAVEPOINT sonda_ro');
    let rechazo = null;
    try { await tx.$executeRawUnsafe("UPDATE invoices SET status = status WHERE false"); }
    catch (e) { rechazo = String(e?.meta?.code ?? e?.code ?? '') + ' ' + String(e?.message ?? '').match(/read-only transaction/)?.[0]; }
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sonda_ro');
    const roOk = ro === 'on' && /read-only transaction/.test(rechazo ?? '');
    console.log(`① READ ONLY · SHOW=${ro} · escritura con WHERE false → ${rechazo ? 'RECHAZADA (' + rechazo.trim() + ')' : 'ACEPTADA 🔴'} · ${roOk ? 'OK' : 'FALLA'}`);
    if (!roOk) throw new Error('la base no confirma el READ ONLY: no se mide nada');

    // ② positivo sembrado
    const [p] = await tx.$queryRawUnsafe(`SELECT ${RECUENTO} FROM (VALUES ${SEMBRADO.join(', ')}) AS t(vf_anul_hash, status)`);
    const pos = [n(p.total), n(p.con_huella), n(p.huella_sin_anular)];
    const posOk = pos.join('/') === '3/2/1';
    console.log(`② positivo sembrado (${SEMBRADO.length} filas) → ${pos.join('/')} · esperado 3/2/1 · ${posOk ? 'OK' : 'CIEGO'}`);

    // ③ el recuento real, con su población
    const [r] = await tx.$queryRawUnsafe(`SELECT ${RECUENTO} FROM invoices`);
    const real = { total: n(r.total), con_huella: n(r.con_huella), huella_sin_anular: n(r.huella_sin_anular) };
    console.log(`③ invoices → ${JSON.stringify(real)}`);

    if (real.huella_sin_anular > 0) {
      const filas = await tx.$queryRawUnsafe(`
        SELECT i.id, i.number, i."merchantId" AS merchant_id, i.status, i."createdAt" AS creada,
               i.vf_anul_timestamp AS sellada, m.name AS merchant_nombre, m.email AS merchant_email
        FROM invoices i JOIN merchants m ON m.id = i."merchantId"
        WHERE i.vf_anul_hash IS NOT NULL AND i.status <> 'annulled'
        ORDER BY i.id`);
      for (const f of filas) console.log('   ' + JSON.stringify(f));
    }
    if (!posOk) { exit = 2; console.log('VEREDICTO: CIEGO — el positivo sembrado no se ve; el recuento real no vale'); }
    else console.log(`VEREDICTO: ${real.huella_sin_anular === 0 ? 'VERDE' : 'ROJO'} — huella_sin_anular=${real.huella_sin_anular} sobre ${real.total} facturas`);
  }, { timeout: 60_000 });
} catch (e) {
  exit = 1;
  console.error('ERROR (sin URL):', String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, '<url>').slice(0, 400));
} finally {
  await prisma.$disconnect();
}
console.log(`EXIT=${exit}`);
process.exitCode = exit;
