// tests/scrum1575c-censo-ve-el-singleton.test.mjs — SCRUM-1575c
//
// El censo de 1575b (`scripts/_censo-conexiones-a-base.mjs`) sólo contaba como conexión un
// `new PrismaClient`, el SQL crudo y los procesos hijo. No veía a quien consulta el singleton de la
// aplicación (`dist/core/db/prisma.js`) ni a quien consulta un cliente que le abre otro módulo
// (`tests/banco-scrum911/limpiar.mjs` hace `deleteMany` contra staging y no salía). Aquí se le pone
// delante un árbol FABRICADO con cada forma de ese hueco, y se comprueba sobre el árbol real que lo
// que dejó de ver ya sale.
//
// ⛔ NINGÚN CASO CONECTA CON UNA BASE NI LANZA UN SCRIPT: todo es AST sobre texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarConexion, censarConexiones, SIEMBRA_SINGLETON, veSusSiembras } from '../scripts/_censo-conexiones-a-base.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arbolFabricado(ficheros) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1575c-'));
  for (const [rel, texto] of Object.entries(ficheros)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), texto);
  }
  return dir;
}

const SINGLETON = "import { prisma } from '../dist/core/db/prisma.js';\n";

test('SCRUM-1575c · siembra · el instrumento VE el singleton: abre, escribe y no llama a ningún guard', () => {
  const a = analizarConexion(SIEMBRA_SINGLETON.rel, SIEMBRA_SINGLETON.fuente);
  assert.deepEqual([a.abre, a.escribe.length > 0, a.guardas.length], [true, true, 0],
    '🔴 el censo no ve un test que borra con el singleton: es el hueco de 1575b, otra vez abierto.');
  assert.ok(a.conecta.includes('singleton core/db/prisma'), `🔴 conecta=${a.conecta.join(',')}`);
  assert.equal(veSusSiembras(), true, '🔴 el CLI saldría CIEGO: no ve alguna de sus dos siembras.');
});

test('SCRUM-1575c · siembra · importar el singleton sin consultarlo NO es una conexión (control de cero)', () => {
  const a = analizarConexion('tests/solo-importa.test.mjs', SINGLETON + 'console.log(typeof prisma);\n');
  assert.deepEqual(a.conecta, [], '🔴 el censo cuenta como conexión un import que no consulta nada.');
});

test('SCRUM-1575c · siembra · un árbol fabricado con cada forma del hueco sale clasificado como se sabe que es', () => {
  const dir = arbolFabricado({
    'scripts/_db-guard.mjs': 'export function assertSafeStagingUrl() { return { safe: true }; }\n',
    // El guardián que corre al importarlo, como `tests/_staging-db.mjs`.
    'tests/_staging-db.mjs': "import { assertSafeStagingUrl } from '../scripts/_db-guard.mjs';\nassertSafeStagingUrl(process.env.X);\n",
    'tests/singleton-a-pelo.test.mjs': SINGLETON + 'await prisma.quote.deleteMany({ where: { id: 1 } });\n',
    'tests/singleton-con-gate.test.mjs': "import './_staging-db.mjs';\n" + SINGLETON + 'await prisma.quote.update({ where: { id: 1 }, data: {} });\n',
    // Por asignación y en una transacción: `tx` es el mismo cliente.
    'tests/por-asignacion.test.mjs': "let prisma;\n({ prisma } = await import('../dist/core/db/prisma.js'));\n" +
      'await prisma.$transaction(async (tx) => { await tx.job.create({ data: {} }); });\n',
    'tests/alias.test.mjs': SINGLETON + 'const db = prisma;\nawait db.job.findMany({ where: {} });\n',
    // Por un envoltorio que importa desde la raíz, como `tests/banco-scrum911/paso3-botones.mjs`.
    'tests/envoltorio.mjs': "import { imp } from './banco/_entorno.mjs';\nconst { prisma } = await imp('dist/core/db/prisma.js');\n" +
      'await prisma.quote.update({ where: { id: 1 }, data: {} });\n',
    // Un módulo local que ABRE y comprueba el host a mano, y quien lo llama y borra.
    'tests/banco/_entorno.mjs': "import { PrismaClient } from '@prisma/client';\n" +
      'export async function abrir(p) { if (p.host !== STAGING_HOST) throw new Error("no"); const db = new PrismaClient(); await db.$queryRaw`select 1`; return db; }\n',
    'tests/banco/limpiar.mjs': "import { abrir } from './_entorno.mjs';\nconst db = await abrir(x);\nawait db.quote.deleteMany({ where: {} });\n",
    // Comprobación de destino por lista, como `tests/scrum728-…` y `tests/scrum814-…`.
    'tests/loopback.test.mjs': SINGLETON + "assert.ok(['127.0.0.1', 'localhost'].includes(p.host));\nawait prisma.quote.create({ data: {} });\n",
    // Lo que NO es una conexión: un doble, el SDK de Stripe, un Map.
    'tests/doble.test.mjs': 'const prisma = { quote: { create: async () => 1 } };\nawait prisma.quote.create({ data: {} });\n',
    'scripts/stripe.mjs': 'await stripe.prices.create({ unit_amount: 1 });\n',
    'scripts/mapa.mjs': 'this.pendientes.delete(id);\nobj.cache.update(k);\n',
  });
  try {
    const { filas } = censarConexiones(dir);
    const clase = Object.fromEntries(filas.map((f) => [f.rel, f.clase]));
    assert.deepEqual(clase, {
      'tests/alias.test.mjs': 'sin_guard_lee',
      'tests/banco/_entorno.mjs': 'guard_propio',
      'tests/banco/limpiar.mjs': 'guard_propio',
      'tests/doble.test.mjs': 'usa_cliente_ajeno',
      'tests/envoltorio.mjs': 'sin_guard_escribe',
      'tests/loopback.test.mjs': 'guard_propio',
      'tests/por-asignacion.test.mjs': 'sin_guard_escribe',
      'tests/singleton-a-pelo.test.mjs': 'sin_guard_escribe',
      'tests/singleton-con-gate.test.mjs': 'protegido',
    }, '🔴 el censo clasifica mal un árbol cuya respuesta se conoce. Stripe y el Map no conectan.');
    assert.equal(filas.find((f) => f.rel === 'tests/banco/limpiar.mjs').abiertoPor, 'tests/banco/_entorno.mjs');
    assert.ok(filas.find((f) => f.rel === 'tests/envoltorio.mjs').conecta.includes('singleton core/db/prisma'),
      '🔴 el censo no sigue `await imp(\'dist/core/db/prisma.js\')` hasta el singleton.');
    assert.deepEqual(filas.find((f) => f.rel === 'tests/singleton-con-gate.test.mjs').guardasIndirectas, ['_staging-db.mjs:(import)']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1575c · la conexión está en la PRIMERA CONSULTA, no en el `new`: un guard entre los dos va ANTES', () => {
  const guard = "import { exigirDestinoCorrecto } from './_clave-vs-destino.mjs';\n";
  const antes = analizarConexion('scripts/a.mjs', guard +
    'const p = new PrismaClient();\nexigirDestinoCorrecto("DATABASE_URL_DEV", u, "x");\nawait p.quote.create({ data: {} });\n');
  const despues = analizarConexion('scripts/b.mjs', guard +
    'const p = new PrismaClient();\nawait p.quote.create({ data: {} });\nexigirDestinoCorrecto("DATABASE_URL_DEV", u, "x");\n');
  const hijo = analizarConexion('scripts/c.mjs', guard + "import { spawnSync } from 'node:child_process';\n" +
    'exigirDestinoCorrecto("DATABASE_URL_DEV", u, "x");\nspawnSync("npx", ["prisma", "db", "execute"]);\n');
  assert.deepEqual([antes.guardaAntes, despues.guardaAntes, hijo.guardaAntes], [true, false, true],
    '🔴 el censo vuelve a decir «DESPUÉS» de un guard que corre antes de conectar (o «antes» de uno que corre después).');
});

test('SCRUM-1575c · árbol real · lo que 1575b no veía ya sale, y ninguno de los dos scripts guardados dice DESPUÉS', () => {
  const { filas } = censarConexiones(RAIZ);
  const fila = (rel) => filas.find((f) => f.rel === rel);
  // Positivos con nombre: si alguno se borra o se arregla, este caso lo dice en vez de quedarse mudo.
  for (const rel of ['tests/banco-scrum911/limpiar.mjs', 'tests/banco-scrum911/paso3-botones.mjs']) {
    assert.ok(fila(rel), `🔴 ${rel} ya no sale en el censo. Si se ha borrado, cambia el positivo; si no, el censo vuelve a estar ciego.`);
  }
  assert.equal(fila('tests/banco-scrum911/limpiar.mjs').abiertoPor, 'tests/banco-scrum911/_entorno.mjs');
  const porSingleton = filas.filter((f) => f.conecta.includes('singleton core/db/prisma'));
  assert.ok(porSingleton.length >= 50, `🔴 sólo ${porSingleton.length} ficheros entran por el singleton; el 23-oct eran 80.`);
  for (const rel of ['scripts/aplicar-sql-dev.mjs', 'scripts/seed-video.mjs']) {
    assert.equal(fila(rel)?.clase, 'protegido', `🔴 ${rel}: ${JSON.stringify(fila(rel))}`);
    assert.equal(fila(rel).guardaAntes, true, `🔴 ${rel} vuelve a salir con el guard DESPUÉS de la conexión.`);
  }
});
