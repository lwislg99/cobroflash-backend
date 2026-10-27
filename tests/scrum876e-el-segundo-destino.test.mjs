// tests/scrum876e-el-segundo-destino.test.mjs — SCRUM-876e
// `tests/_banco-libro.mjs` es código de seguridad: quien lo importa crea y borra merchants, y lo
// único que decide CONTRA QUÉ BASE es ese módulo. Aquí se fijan sus propiedades, sin base:
//   · sólo acepta loopback y una base terminada en `_test`, y si no, LANZA (no salta);
//   · con cualquier gate de staging puesto es inerte: el primer destino no se afloja;
//   · sin variable no toca nada;
//   · y quien lo importa lo hace ANTES de cargar nada de `dist/`.
//
// El módulo decide al cargarse, así que cada caso lo carga de nuevo con un sufijo distinto en la
// ruta (ESM cachea por URL) y con el entorno que toca, y lo deja como estaba al salir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VARIABLES = ['LIBRO_PG_URL', 'DATABASE_URL', 'QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST'];

// 🔴 MUTACIONES_QUE_ME_TUMBAN · cada una le quita al módulo UNA de sus barreras, y dice qué caso
// tiene que caer. Se ejecutan con `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/_banco-libro.mjs',
    de: "!['127.0.0.1', 'localhost', '::1'].includes(p.host)",
    a: 'false',
    cae: 'un host que NO es loopback',
  },
  {
    fichero: 'tests/_banco-libro.mjs',
    de: "!p.base.endsWith('_test')",
    a: 'false',
    cae: 'una base que NO termina en _test',
  },
  {
    fichero: 'tests/_banco-libro.mjs',
    de: "const mandaStaging = GATES_DE_STAGING.some((g) => process.env[g] === '1');",
    a: 'const mandaStaging = false;',
    cae: 'con un gate de STAGING puesto',
  },
  {
    fichero: 'tests/_banco-libro.mjs',
    de: '  process.env.DATABASE_URL = URL_BANCO;',
    a: '  void URL_BANCO;',
    cae: 'un banco desechable de verdad',
  },
];

// La URL se COMPONE: en este repositorio no se escribe ninguna cadena de conexión, ni de ejemplo.
const urlDe = (host, base) => ['postgresql', '://', 'postgres', '@', host, ':', '5432', '/', base].join('');
const BUENA = urlDe('127.0.0.1', 'yaqu_libro_test');

let vez = 0;
/** Carga el módulo de nuevo con `entorno` puesto, y devuelve lo que pasó y lo que dejó. */
async function cargarCon(entorno) {
  const guardado = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
  for (const v of VARIABLES) delete process.env[v];
  Object.assign(process.env, entorno);
  const dbAntes = process.env.DATABASE_URL;
  try {
    vez += 1;
    const mod = await import(`./_banco-libro.mjs?caso=${vez}`);
    return { url: mod.URL_BANCO, error: null, dbAntes, dbDespues: process.env.DATABASE_URL };
  } catch (error) {
    return { url: null, error, dbAntes, dbDespues: process.env.DATABASE_URL };
  } finally {
    for (const v of VARIABLES) {
      if (guardado[v] === undefined) delete process.env[v];
      else process.env[v] = guardado[v];
    }
  }
}

test('SCRUM-876e · un banco desechable de verdad (loopback y base *_test) se acepta y pasa a ser el destino', async () => {
  for (const host of ['127.0.0.1', 'localhost']) {
    const url = urlDe(host, 'yaqu_libro_test');
    const r = await cargarCon({ LIBRO_PG_URL: url });
    assert.equal(r.error, null, `con ${host} no tenía que lanzar`);
    assert.equal(r.url, url);
    assert.equal(r.dbDespues, url, 'DATABASE_URL tiene que quedar apuntando al banco ANTES de que se cargue dist/');
  }
});

test('SCRUM-876e · un host que NO es loopback hace FALLAR el fichero, y no se asigna nada', async () => {
  const r = await cargarCon({ LIBRO_PG_URL: urlDe('db.interno.invalid', 'yaqu_libro_test'), DATABASE_URL: 'la-de-antes' });
  assert.ok(r.error, '🔴 aceptó una base que no está en esta máquina');
  assert.match(r.error.message, /no es un banco desechable/);
  assert.equal(r.dbDespues, 'la-de-antes', '🔴 DATABASE_URL cambió aunque la URL se rechazó');
});

test('SCRUM-876e · una base que NO termina en _test hace FALLAR el fichero, aunque sea loopback', async () => {
  for (const base of ['yaqu_dev', 'railway', 'yaqu_libro_test_copia']) {
    const r = await cargarCon({ LIBRO_PG_URL: urlDe('127.0.0.1', base), DATABASE_URL: 'la-de-antes' });
    assert.ok(r.error, `🔴 aceptó la base «${base}»`);
    assert.equal(r.dbDespues, 'la-de-antes');
  }
});

test('SCRUM-876e · una URL que no se puede leer también FALLA (no se trata como «sin banco»)', async () => {
  const r = await cargarCon({ LIBRO_PG_URL: 'esto no es una url' });
  assert.ok(r.error, '🔴 una variable ilegible se leyó como «no hay banco» y el test se saltaría en silencio');
});

test('SCRUM-876e · el rechazo NO imprime la URL (SCRUM-226)', async () => {
  const r = await cargarCon({ LIBRO_PG_URL: urlDe('db.interno.invalid', 'produccion') });
  assert.ok(r.error);
  for (const trozo of ['db.interno.invalid', 'produccion', 'postgres@']) {
    assert.ok(!r.error.message.includes(trozo), `🔴 el mensaje enseña «${trozo}»`);
  }
});

test('SCRUM-876e · sin la variable no hay segundo destino y no se toca DATABASE_URL', async () => {
  const r = await cargarCon({ DATABASE_URL: 'la-de-antes' });
  assert.equal(r.error, null);
  assert.equal(r.url, '');
  assert.equal(r.dbDespues, 'la-de-antes');
});

test('SCRUM-876e · con un gate de STAGING puesto el módulo es inerte: manda `_staging-db.mjs`', async () => {
  for (const gate of ['QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST']) {
    const r = await cargarCon({ [gate]: '1', LIBRO_PG_URL: BUENA, DATABASE_URL: 'la-de-staging' });
    assert.equal(r.error, null);
    assert.equal(r.url, '', `🔴 con ${gate}=1 el banco le quitó el sitio a staging`);
    assert.equal(r.dbDespues, 'la-de-staging', `🔴 con ${gate}=1 se pisó la DATABASE_URL que puso el guard de staging`);
  }
});

// ── QUIEN LO IMPORTA, LO IMPORTA A TIEMPO ───────────────────────────────────────────────────
// Si el import cae DESPUÉS de uno estático de `dist/`, el cliente de Prisma nace antes de que
// `DATABASE_URL` apunte al banco: el test correría contra lo que hubiera en el entorno.
test('SCRUM-876e · quien importa el segundo destino lo hace justo detrás de `_staging-db.mjs` y antes de dist/', () => {
  const ficheros = fs.readdirSync(AQUI).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(ficheros.length > 100, `🔴 CIEGO: sólo ${ficheros.length} ficheros de test listados`);
  const usuarios = [];
  for (const f of ficheros) {
    if (f === path.basename(fileURLToPath(import.meta.url))) continue;
    const imports = fs.readFileSync(path.join(AQUI, f), 'utf8').split(/\r?\n/)
      .filter((l) => /^import\s/.test(l))
      .map((l) => (l.match(/from\s+'([^']+)'|^import\s+'([^']+)'/) || []).slice(1).find(Boolean) || '');
    const i = imports.indexOf('./_banco-libro.mjs');
    if (i < 0) continue;
    usuarios.push(f);
    assert.equal(imports[i - 1], './_staging-db.mjs', `🔴 ${f}: el segundo destino no va justo detrás del guard de staging`);
    const primerDist = imports.findIndex((m) => m.startsWith('../dist/'));
    assert.ok(primerDist < 0 || primerDist > i, `🔴 ${f}: carga dist/ ANTES de fijar el destino`);
  }
  assert.ok(usuarios.length >= 2, `🔴 CIEGO: sólo ${usuarios.length} fichero(s) importan el módulo; al escribir esto eran scrum72 y albaran`);
});
