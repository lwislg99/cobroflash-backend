// docs/master/evidencias/SCRUM-612/contar-justificantes-612.mjs — SCRUM-612 (E-4) · jv-j1
//
// Corre `contar-justificantes-612.sql` contra UNA base, por su clave de entorno, dentro de una
// transacción `READ ONLY`: Postgres rechaza cualquier escritura, aunque el SQL la trajera.
//
// Uso:   node --env-file=<fichero .env> docs/master/evidencias/SCRUM-612/contar-justificantes-612.mjs <raiz> <CLAVE>
//        (CLAVE = DATABASE_URL_STAGING | DATABASE_URL_DEV)
//
// 🔴 SE NIEGA A CORRER CONTRA PRODUCCIÓN, por destino y no por nombre de clave: compara el host con
// `HOST_PRODUCCION` de `scripts/_clave-vs-destino.mjs` (SCRUM-418). Nunca imprime la URL: sólo
// `host/base` por `describirBD` (regla 9).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const RAIZ = path.resolve(process.argv[2] ?? '.');
const CLAVE = process.argv[3];
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
console.log(`clave ${CLAVE} → ${describirBD(url)}  (host de producción declarado: ${HOST_PRODUCCION} · distinto: sí)`);

const req = createRequire(path.join(RAIZ, 'package.json'));
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: url });
// `fileURLToPath` y no `new URL(...).pathname`: con un espacio en la ruta («Javier Pereira») el
// segundo deja `%20` y el fichero «no existe». Me pasó en la primera pasada.
const sql = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'contar-justificantes-612.sql'), 'utf8');
const sentencias = sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n').trim()).filter(Boolean);
console.log(`sentencias: ${sentencias.length}\n`);
const limpio = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x)));
let exit = 0;
try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    for (const [i, s] of sentencias.entries()) {
      const filas = await tx.$queryRawUnsafe(s);
      console.log(`── ${i + 1} · ${s.split('\n')[0].slice(0, 90)}`);
      console.log(filas.length ? filas.map((f) => '   ' + JSON.stringify(limpio(f))).join('\n') : '   (0 filas)');
    }
  }, { timeout: 60_000 });
} catch (e) {
  exit = 1;
  console.error('ERROR (sin URL):', String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, '<url>').slice(0, 400));
} finally {
  await prisma.$disconnect();
}
console.log(`\nEXIT=${exit}`);
process.exitCode = exit;
