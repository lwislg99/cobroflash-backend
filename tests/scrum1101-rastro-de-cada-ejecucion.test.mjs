// tests/scrum1101-rastro-de-cada-ejecucion.test.mjs
//
// SCRUM-1101 · `scripts/guard-acreditacion-invoicing-es.mjs` deja RASTRO ESCRITO de cada
// ejecución (fecha, host sin credencial, consulta, recuento) y exige la CONFIRMACIÓN EXPLÍCITA
// del host antes de conectar (patrón `FLAG_CONFIRM` de `scripts/cambiar-flag-fiscal.mjs`).
//
// Sin ninguna base real: los destinos son URL fabricadas a `127.0.0.1:1` (puerto en el que no
// escucha nadie) y el «banco» es una carpeta temporal FUERA del árbol, una por test, que se borra
// al acabar. La credencial de las URL es un literal fabricado para comprobar que NO llega al
// fichero; no abre nada en ningún sitio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ejecutar,
  CONSULTA_TEXTO,
  CLAVE_CONFIRMACION,
  CLAVE_DIR_REGISTRO,
} from '../scripts/guard-acreditacion-invoicing-es.mjs';

const RUTA_GUARD = fileURLToPath(new URL('../scripts/guard-acreditacion-invoicing-es.mjs', import.meta.url));

// Fabricados: ni el usuario ni la contraseña existen en ninguna base.
const USUARIO = 'lector_fabricado_1101';
const SECRETO = 'clave_fabricada_1101_no_existe';
const URL_FABRICADA = `postgresql://${USUARIO}:${SECRETO}@127.0.0.1:1/banco_desechable_1101_test`;
const HOSTS_LOCALES = Object.freeze({ staging: '127.0.0.1', prod: '127.0.0.1' });

function banco(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1101-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Los ficheros de rastro del banco, con sus líneas ya parseadas. */
function rastros(dir) {
  return fs.readdirSync(dir).sort().map((nombre) => {
    const texto = fs.readFileSync(path.join(dir, nombre), 'utf8');
    return { nombre, texto, lineas: texto.trim().split('\n').map((l) => JSON.parse(l)) };
  });
}

const merchant = (over) => ({ id: 2, flags: null, Invoice: [], ...over });

/** Un doble de Prisma que apunta si se le llamó. `filas` puede ser función (para mirar el disco EN el momento). */
function doble(filas) {
  const llamadas = { creado: 0, findMany: 0, desconectado: 0 };
  const crearPrisma = () => {
    llamadas.creado++;
    return {
      merchant: { findMany: async () => { llamadas.findMany++; return typeof filas === 'function' ? filas() : filas; } },
      $disconnect: async () => { llamadas.desconectado++; },
    };
  };
  return { crearPrisma, llamadas };
}

const envConfirmado = (dir, extra = {}) => ({
  DATABASE_URL_PROD_RO: URL_FABRICADA,
  [CLAVE_CONFIRMACION]: '127.0.0.1',
  [CLAVE_DIR_REGISTRO]: dir,
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1101 · limpio: deja UN fichero con fecha, host sin credencial, consulta y recuento 0', async (t) => {
  const dir = banco(t);
  const { crearPrisma } = doble([merchant({ id: 2 }), merchant({ id: 3 })]);
  const codigo = await ejecutar({ argv: ['--prod-ro'], env: envConfirmado(dir), crearPrisma, hosts: HOSTS_LOCALES });
  assert.equal(codigo, 0);

  const r = rastros(dir);
  assert.equal(r.length, 1, 'una ejecución, un fichero');
  const final = r[0].lineas.at(-1);
  assert.equal(final.fase, 'final');
  assert.equal(final.veredicto, 'LIMPIO');
  assert.equal(final.exit, 0);
  assert.equal(final.recuento, 0);
  assert.equal(final.suelo, 2);
  assert.equal(final.host, '127.0.0.1/banco_desechable_1101_test');
  assert.equal(final.consulta, CONSULTA_TEXTO);
  assert.equal(final.destino, 'DATABASE_URL_PROD_RO');
  assert.ok(!Number.isNaN(Date.parse(final.fecha)) && final.fecha.endsWith('Z'), `fecha ISO UTC: ${final.fecha}`);
});

test('SCRUM-1101 · hallazgo: el rastro dice recuento 1, los ids y exit 1', async (t) => {
  const dir = banco(t);
  const { crearPrisma } = doble([merchant({ id: 2 }), merchant({ id: 5, flags: { INVOICING_ES_ENABLED: true } })]);
  const codigo = await ejecutar({ argv: ['--prod-ro'], env: envConfirmado(dir), crearPrisma, hosts: HOSTS_LOCALES });
  assert.equal(codigo, 1);
  const final = rastros(dir)[0].lineas.at(-1);
  assert.equal(final.veredicto, 'HALLAZGO');
  assert.equal(final.recuento, 1);
  assert.deepEqual(final.acreditados, [5]);
});

test('SCRUM-1101 · el rastro se escribe ANTES de conectar: al consultar, la línea «conectando» ya está en disco', async (t) => {
  const dir = banco(t);
  let visto = null;
  const { crearPrisma } = doble(() => {
    visto = rastros(dir)[0].lineas.map((l) => l.fase);
    return [merchant({ id: 2 })];
  });
  await ejecutar({ argv: ['--prod-ro'], env: envConfirmado(dir), crearPrisma, hosts: HOSTS_LOCALES });
  assert.deepEqual(visto, ['inicio', 'conectando'],
    'si el proceso muere durante la consulta, el fichero ya dice contra qué host lo intentaba');
});

test('SCRUM-1101 · CONTROL POSITIVO sembrado: la credencial fabricada SÍ está en la URL que se le dio', () => {
  // Sin esto, «el fichero no la contiene» pasaría también si la URL no la llevara.
  assert.ok(URL_FABRICADA.includes(SECRETO) && URL_FABRICADA.includes(USUARIO));
});

test('SCRUM-1101 · CIEGO de verdad: PrismaClient REAL contra 127.0.0.1:1 → exit 2, rastro CIEGO y sin credencial', async (t) => {
  const dir = banco(t);
  const codigo = await ejecutar({ argv: ['--prod-ro'], env: envConfirmado(dir), hosts: HOSTS_LOCALES });
  assert.equal(codigo, 2);
  const [r] = rastros(dir);
  assert.deepEqual(r.lineas.map((l) => l.fase), ['inicio', 'conectando', 'final']);
  const final = r.lineas.at(-1);
  assert.equal(final.veredicto, 'CIEGO');
  assert.equal(final.recuento, null, 'no medido no es cero');
  assert.ok(!r.texto.includes(SECRETO), 'la contraseña NO llega al fichero');
  assert.ok(!r.texto.includes(USUARIO), 'el usuario NO llega al fichero');
});

test('SCRUM-1101 · sin confirmación del host NO se conecta, y el rastro dice ABORTADO', async (t) => {
  const dir = banco(t);
  const { crearPrisma, llamadas } = doble([merchant({ id: 2 })]);
  const env = envConfirmado(dir);
  delete env[CLAVE_CONFIRMACION];
  const codigo = await ejecutar({ argv: ['--prod-ro'], env, crearPrisma, hosts: HOSTS_LOCALES });
  assert.equal(codigo, 2);
  assert.equal(llamadas.creado, 0, 'ni siquiera se construye el cliente');
  const final = rastros(dir)[0].lineas.at(-1);
  assert.equal(final.veredicto, 'ABORTADO');
  assert.match(final.motivo, /confirmaci/i);
});

test('SCRUM-1101 · confirmar OTRO host tampoco vale: hay que nombrar el que es', async (t) => {
  const dir = banco(t);
  const { crearPrisma, llamadas } = doble([merchant({ id: 2 })]);
  const codigo = await ejecutar({
    argv: ['--prod-ro'], env: envConfirmado(dir, { [CLAVE_CONFIRMACION]: 'otro.host.example' }), crearPrisma, hosts: HOSTS_LOCALES,
  });
  assert.equal(codigo, 2);
  assert.equal(llamadas.creado, 0);
  assert.equal(rastros(dir)[0].lineas.at(-1).veredicto, 'ABORTADO');
});

test('SCRUM-1101 · sin bandera también queda rastro (una ejecución es una ejecución)', async (t) => {
  const dir = banco(t);
  const { crearPrisma, llamadas } = doble([]);
  const codigo = await ejecutar({ argv: [], env: { [CLAVE_DIR_REGISTRO]: dir }, crearPrisma, hosts: HOSTS_LOCALES });
  assert.equal(codigo, 2);
  assert.equal(llamadas.creado, 0);
  const final = rastros(dir)[0].lineas.at(-1);
  assert.equal(final.veredicto, 'ABORTADO');
  assert.equal(final.host, null);
});

test('SCRUM-1101 · si el rastro NO se puede escribir, no se mide: CIEGO antes de conectar', async (t) => {
  const dir = banco(t);
  const noEsCarpeta = path.join(dir, 'soy-un-fichero');
  fs.writeFileSync(noEsCarpeta, 'x');
  const { crearPrisma, llamadas } = doble([merchant({ id: 2 })]);
  const codigo = await ejecutar({
    argv: ['--prod-ro'], env: envConfirmado(noEsCarpeta), crearPrisma, hosts: HOSTS_LOCALES,
  });
  assert.equal(codigo, 2);
  assert.equal(llamadas.creado, 0, 'sin rastro no hay pasada');
});

test('SCRUM-1101 · dos ejecuciones, dos ficheros: ninguna pisa a la anterior', async (t) => {
  const dir = banco(t);
  for (let i = 0; i < 2; i++) {
    const { crearPrisma } = doble([merchant({ id: 2 })]);
    await ejecutar({ argv: ['--prod-ro'], env: envConfirmado(dir), crearPrisma, hosts: HOSTS_LOCALES });
  }
  assert.equal(rastros(dir).length, 2);
});

test('SCRUM-1101 · por la CLI, con los hosts REALES: un 127.0.0.1 no pasa por producción, y el rastro lo dice', (t) => {
  // Sin inyectar nada: es `principal()` el que corre. El host fabricado no es el de producción,
  // así que aborta antes de conectar — y aun así tiene que dejar su fichero.
  const dir = banco(t);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL_PROD_RO: URL_FABRICADA, [CLAVE_DIR_REGISTRO]: dir };
  const r = spawnSync(process.execPath, [RUTA_GUARD, '--prod-ro'], { env, encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.status, 2, `salida: ${r.stdout}\n${r.stderr}`);
  const [f] = rastros(dir);
  assert.ok(f, 'la CLI dejó su fichero');
  const final = f.lineas.at(-1);
  assert.equal(final.veredicto, 'ABORTADO');
  assert.equal(final.host, '127.0.0.1/banco_desechable_1101_test');
  assert.ok(!f.lineas.some((l) => l.fase === 'conectando'), 'no llegó a conectar');
  assert.ok(!f.texto.includes(SECRETO) && !(r.stdout + r.stderr).includes(SECRETO));
  assert.match(r.stdout, new RegExp(dir.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')), 'la consola dice dónde quedó el rastro');
});
