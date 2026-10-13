// SCRUM-1515 · Para correr `tests/scrum1515-nuestra-puerta-de-alta.test.mjs` en una máquina SIN
// Postgres: levanta uno desechable (PGlite, en memoria, en este proceso), le pone el esquema y
// lanza el test con `LIBRO_PG_URL` apuntándole. En CI no hace falta: el job obligatorio ya trae
// su banco desechable y el test corre con él.
//
// Uso (PGlite NO es dependencia del repo: se instala en una carpeta de fuera):
//   node docs/master/evidencias/SCRUM-1515/banco-local.mjs <carpeta node_modules con @electric-sql> <esquema.sql> [fichero de test]
// El esquema sale de `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
// Sale con el código del test; 2 si el banco no llega a montarse.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const carpetaPg = path.resolve(process.argv[2] || '');
const ficheroSql = path.resolve(process.argv[3] || '');
const ficheroTest = process.argv[4] || 'tests/scrum1515-nuestra-puerta-de-alta.test.mjs';

const sql = fs.existsSync(ficheroSql) ? fs.readFileSync(ficheroSql, 'utf8') : '';
const tablas = (sql.match(/^CREATE TABLE /gm) || []).length;
if (sql.length < 10000 || tablas < 20) {
  console.log(`CIEGO: el esquema tiene ${sql.length} caracteres y ${tablas} tablas.`);
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(carpetaPg, '@electric-sql/pglite/dist/index.js')).href);
const { PGLiteSocketServer } = await import(pathToFileURL(path.join(carpetaPg, '@electric-sql/pglite-socket/dist/index.js')).href);
const db = new PGlite();
await db.exec(sql);
const puerto = await new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const servidor = new PGLiteSocketServer({ db, port: puerto, host: '127.0.0.1' });
await servidor.start();
console.log(`BANCO: PGlite en 127.0.0.1:${puerto} · ${tablas} tablas · test: ${ficheroTest}`);

// El entorno del test, a mano: nada del arnés (ni color, ni contexto de runner, ni gates).
const env = { LIBRO_PG_URL: `postgresql://postgres:postgres@127.0.0.1:${puerto}/yaqu_1515_test?sslmode=disable&connection_limit=1&pgbouncer=true` };
for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (process.env[k]) env[k] = process.env[k];
const hijo = spawn(process.execPath, ['--test', '--test-reporter=spec', ficheroTest], { cwd: RAIZ, env, stdio: 'inherit' });
hijo.on('close', async (codigo) => {
  process.exitCode = codigo ?? 2;
  const quedan = await db.query('SELECT count(*)::int AS n FROM "merchants"');
  console.log(`BANCO: merchants que quedan al terminar: ${quedan.rows[0].n} · EXIT=${codigo}`);
  // Un hijo cortado a media consulta puede dejar el banco sin poder cerrarse: el código de salida
  // es el del test, se cierre o no.
  setTimeout(() => process.exit(codigo ?? 2), 3000).unref();
  await servidor.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(codigo ?? 2);
});
