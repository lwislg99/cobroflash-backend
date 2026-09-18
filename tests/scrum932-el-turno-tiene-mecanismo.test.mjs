// tests/scrum932-el-turno-tiene-mecanismo.test.mjs — SCRUM-932
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA
//
// La norma «toma el turno antes de escribir en staging» tenía la prohibición y no tenía el
// mecanismo: `scripts/turno-staging.mjs` moría con «falta DATABASE_URL_TESTS» en las ~95
// worktrees de esta máquina, porque `import 'dotenv/config'` solo mira el `.env` del directorio
// actual y **no hay ningún `.env`** (los cuatro árboles fijos del 6-ago-2026 ya no existen).
//
//     🔒 Una prohibición sin mecanismo es una frase (A10). Y no se cumple: se rodea.
//
// Este fichero vigila las DOS mitades del arreglo, y la segunda es la que importa más:
//
//   ① que el turno ARRANQUE cuando la credencial se puede encontrar (el mecanismo existe);
//   ② que NO arranque cuando no se puede (el mecanismo no se convirtió en una ceremonia).
//
// ⚠️ Y no toca ninguna base de datos. Todos los casos usan una URL con host `localhost`, que la
// allowlist de `_db-guard.mjs` rechaza ANTES de construir el `PrismaClient`. Eso es justo lo que
// los hace medir algo: el mensaje del guard de host demuestra que la clave **se leyó y llegó
// hasta el guard**, que es lo contrario de «falta la clave» y no se puede confundir con él.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO declarado (lo pedía el ticket)
//
// La TOMA de turno de verdad ESCRIBE en staging —el marcador vive dentro de la base—, así que no
// se puede ejercitar aquí sin una credencial real y sin tocar la base compartida. Lo que este
// fichero mide es todo el camino HASTA el cliente de Prisma: resolución del entorno, elección de
// base y guard de host. La toma real se verifica a mano y se deja en el registro del ticket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cargarEnvDelEquipo, candidatosDeEnv, resumenDeEnv,
  CARGADO, NO_EXISTE, NO_SE_PUDO_LEER, NO_SE_PUDO_LOCALIZAR,
} from '../scripts/_cargar-env.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'turno-staging.mjs');

// Una URL que el guard de host RECHAZA a propósito. No es una credencial: `localhost` no está en
// la allowlist de staging, así que nada de esto puede acabar hablando con una base de verdad.
const URL_FALSA_RECHAZADA = 'postgres://u:p@localhost:5432/nada';

/**
 * Corre el CLI con un entorno CONSTRUIDO, no heredado, y fuera del repositorio.
 *
 * Las dos cosas son necesarias y las dos se aprendieron a base de golpes:
 *  · **entorno construido**: si heredásemos el del proceso, en una máquina que SÍ tenga
 *    `DATABASE_URL_TESTS` (el CI la tiene) el caso que exige que falte pasaría en verde sin medir
 *    nada. Aquí las claves de base se ponen una a una y las demás no existen.
 *  · **cwd fuera del árbol**: el cargador mira el `.env` del directorio actual y el del checkout
 *    principal. Desde un temporal que no es un repositorio no hay ninguno de los dos, así que el
 *    resultado no depende de qué ficheros tenga la máquina que lo corre.
 *  · `FORCE_COLOR` y `NODE_TEST_CONTEXT` se BORRAN: el primero mete ANSI en la salida que aquí se
 *    compara, y el segundo cambia el reporter del hijo por uno que no escribe por stdout.
 */
function correrCli(argumentos, clavesExtra = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum932-'));
  const env = { ...process.env, ...clavesExtra };
  delete env.FORCE_COLOR;
  delete env.NODE_TEST_CONTEXT;
  // Las de base, solo las que pida el caso.
  for (const clave of ['DATABASE_URL_TESTS', 'DATABASE_URL_STAGING', 'DATABASE_URL', 'YAQU_ENV_FILE']) {
    if (!(clave in clavesExtra)) delete env[clave];
  }
  try {
    const r = spawnSync(process.execPath, [CLI, ...argumentos], { cwd, env, encoding: 'utf8' });
    return { code: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ① EL MECANISMO EXISTE — y esto es el CONTROL POSITIVO de todo el fichero
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('scrum932: CONTROL POSITIVO — con la clave de la base pedida, el turno llega al guard de host', () => {
  const { code, salida } = correrCli(['estado', '--base', 'staging'], {
    DATABASE_URL_STAGING: URL_FALSA_RECHAZADA,
  });

  // Llegó al guard de host: eso solo puede pasar si la clave se leyó de verdad.
  assert.match(salida, /no es una URL de pruebas segura/,
    'la clave no llegó al guard de host: el CLI no la está leyendo');
  assert.match(salida, /DATABASE_URL_STAGING/, 'el mensaje debe nombrar la clave QUE SE USÓ');
  // 🔴 Y no puede confundirse con el rojo que veníamos a arreglar.
  assert.doesNotMatch(salida, /falta DATABASE_URL/,
    'dice «falta la clave» teniéndola: el camino del entorno sigue roto');
  assert.equal(code, 2, 'una URL fuera de la allowlist se rechaza, y con código 2');
});

test('scrum932: el cargador trae la clave de un fichero FUERA del árbol (YAQU_ENV_FILE)', () => {
  // El caso real de esta máquina: la credencial no vive en ningún `.env`, vive en un fichero
  // aparte. Sin este camino no había forma de cumplir la norma sin copiar la credencial a mano.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum932-env-'));
  const fichero = path.join(dir, 'credenciales.txt');
  fs.writeFileSync(fichero, `# fichero de prueba, URL deliberadamente inservible\nDATABASE_URL_STAGING=${URL_FALSA_RECHAZADA}\n`, 'utf8');
  try {
    const { code, salida } = correrCli(['estado', '--base', 'staging'], { YAQU_ENV_FILE: fichero });
    assert.match(salida, /no es una URL de pruebas segura/,
      'la clave del fichero externo no llegó al guard: el cargador no la puso en el entorno');
    assert.equal(code, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ② EL MECANISMO NO SE DEBILITÓ — el negativo que el ticket puso por escrito
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('scrum932: NEGATIVO — con solo la credencial de STAGING, `--base tests` PARA; no encadena', () => {
  // El atajo tentador era `DATABASE_URL_TESTS || DATABASE_URL_STAGING`: arranca siempre, y en el
  // checkout principal mueve el turno de `yaqu_dev_javier` a `railway` sin decir nada. Tomarías
  // el turno de una base y escribirías en otra — el accidente de SCRUM-383, otra vez.
  const { code, salida } = correrCli(['estado', '--base', 'tests'], {
    DATABASE_URL_STAGING: URL_FALSA_RECHAZADA,
  });

  assert.match(salida, /falta DATABASE_URL_TESTS/, 'debe parar nombrando la clave que falta');
  assert.doesNotMatch(salida, /no es una URL de pruebas segura/,
    '🔴 usó la credencial de OTRA base: el turno se encadenó y dejó de ser un turno');
  // Y le dice al que llama que existe la otra, sin cogerla él: información, no atajo.
  assert.match(salida, /SÍ hay credencial para/);
  assert.match(salida, /--base staging/);
  assert.equal(code, 2, 'sin la clave de su base, el turno no arranca');
});

test('scrum932: sin ninguna credencial, PARA y DECLARA dónde buscó', () => {
  const { code, salida } = correrCli(['estado']);
  assert.equal(code, 2);
  assert.match(salida, /falta DATABASE_URL_TESTS/);
  // A3 · un instrumento declara su POBLACIÓN. «No la encontré» sin «y miré en estos sitios» no se
  // puede accionar, y lo que se hizo sin esa lista fue improvisar la variable a mano.
  assert.match(salida, /fichero\(s\) mirado\(s\)/, 'no declara cuántos sitios miró');
  assert.match(salida, /No hay credencial para NINGUNA/);
  assert.match(salida, /YAQU_ENV_FILE/, 'no dice cómo señalar el fichero de credenciales');
  assert.match(salida, /regla 9/, 'no recuerda que la credencial no va por el chat');
});

test('scrum932: `tests` sigue siendo el defecto — sin --base se pide la clave canónica', () => {
  // POSITIVO del ticket: quien hoy puede tomar el turno lo sigue pudiendo, sin flag y contra la
  // misma base. Si el defecto cambiara, doce ficheros que nombran `DATABASE_URL_TESTS` mentirían.
  const { salida } = correrCli(['estado']);
  assert.match(salida, /falta DATABASE_URL_TESTS/);
  assert.doesNotMatch(salida, /falta DATABASE_URL_STAGING/);
});

test('scrum932: una base inventada se rechaza en vez de caer en una por descarte', () => {
  const { code, salida } = correrCli(['estado', '--base', 'produccion'], {
    DATABASE_URL_STAGING: URL_FALSA_RECHAZADA,
    DATABASE_URL_TESTS: URL_FALSA_RECHAZADA,
  });
  assert.equal(code, 2);
  assert.match(salida, /no es una base conocida/);
  assert.doesNotMatch(salida, /Turno (LIBRE|TOMADO)/, 'un nombre desconocido no puede acabar tomando un turno');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CARGADOR, por dentro: precedencia y SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('scrum932: lo que ya está en el entorno NO se pisa', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum932-prec-'));
  const fichero = path.join(dir, '.env');
  fs.writeFileSync(fichero, 'SCRUM932_TESTIGO=del-fichero\n', 'utf8');
  const env = { YAQU_ENV_FILE: fichero, SCRUM932_TESTIGO: 'del-entorno' };
  try {
    const informe = cargarEnvDelEquipo({ cwd: dir, env });
    assert.equal(env.SCRUM932_TESTIGO, 'del-entorno',
      'una variable puesta a mano tiene que mandar sobre cualquier fichero');
    const fuente = informe.fuentes.find((f) => f.ruta === fichero);
    assert.equal(fuente.estado, CARGADO);
    assert.deepEqual(fuente.clavesPuestas, [], 'no puso nada, y el informe tiene que decirlo');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scrum932: CONTROL POSITIVO del cargador — sí pone una clave que no estaba', () => {
  // Sin este caso, el de arriba lo aprobaría también un cargador que no cargue NADA (A21: una
  // cobaya que no se ejecuta da el mismo resultado que un arreglo perfecto).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum932-pos-'));
  const fichero = path.join(dir, '.env');
  fs.writeFileSync(fichero, 'SCRUM932_TESTIGO=del-fichero\n', 'utf8');
  const env = { YAQU_ENV_FILE: fichero };
  try {
    const informe = cargarEnvDelEquipo({ cwd: dir, env });
    assert.equal(env.SCRUM932_TESTIGO, 'del-fichero');
    assert.ok(informe.clavesPuestas.includes('SCRUM932_TESTIGO'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scrum932: SUELO — «no existe» y «no se pudo leer» no son el mismo veredicto', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum932-suelo-'));
  const comoDirectorio = path.join(dir, 'soy-un-directorio');
  fs.mkdirSync(comoDirectorio);
  try {
    // ① ausente → NO_EXISTE
    const ausente = cargarEnvDelEquipo({
      cwd: dir, env: { YAQU_ENV_FILE: path.join(dir, 'no-estoy.env') },
    });
    assert.equal(ausente.fuentes[0].estado, NO_EXISTE);

    // ② existe pero no se puede leer → NO_SE_PUDO_LEER, jamás NO_EXISTE. Leído como «no existe»
    // manda a crear un fichero que ya está, y el informe diría una falsedad tranquilizadora.
    const ilegible = cargarEnvDelEquipo({ cwd: dir, env: { YAQU_ENV_FILE: comoDirectorio } });
    assert.equal(ilegible.fuentes[0].estado, NO_SE_PUDO_LEER);
    assert.ok(ilegible.fuentes[0].motivo, 'un «no se pudo leer» sin motivo no se puede arreglar');

    // Y los dos se distinguen EN EL TEXTO, que es lo que lee la persona.
    assert.match(resumenDeEnv(ausente), /no existe/);
    assert.match(resumenDeEnv(ilegible), /NO SE PUDO LEER/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scrum932: fuera de un repositorio, el checkout principal es «no localizado», no «vacío»', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum932-nogit-'));
  try {
    const informe = cargarEnvDelEquipo({ cwd: dir, env: {} });
    const principal = informe.fuentes.find((f) => f.porque.includes('checkout principal'));
    assert.ok(principal, 'el candidato del checkout principal tiene que aparecer siempre en el informe');
    assert.equal(principal.estado, NO_SE_PUDO_LOCALIZAR,
      '«no supe mirar» y «ahí no había nada» mandan a arreglar cosas distintas');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scrum932: desde un worktree, el candidato del checkout principal apunta FUERA del worktree', () => {
  // Es la propiedad que hace que UN fichero sirva para las ~95 worktrees efímeras. Si esto se
  // rompiera, cada árbol volvería a necesitar su copia de la credencial.
  const candidatos = candidatosDeEnv(RAIZ, {});
  const principal = candidatos.find((c) => c.porque.includes('checkout principal'));
  if (!principal || !principal.ruta) return; // el árbol principal no tiene «fuera»: nada que medir
  assert.notEqual(path.resolve(principal.ruta), path.join(RAIZ, '.env'),
    'el candidato del principal coincide con el de este árbol: no añade nada');
});

test('scrum932: el informe NO puede llevar valores, solo rutas y nombres', () => {
  // Regla 9 / R7: una credencial se protege impidiendo que salga, no redactando el mensaje
  // después. El informe se imprime en el camino de error, que es el que más se lee.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum932-r7-'));
  const fichero = path.join(dir, '.env');
  const VALOR = 'valor-que-no-puede-salir-12345';
  fs.writeFileSync(fichero, `SCRUM932_SECRETO=${VALOR}\n`, 'utf8');
  try {
    const informe = cargarEnvDelEquipo({ cwd: dir, env: { YAQU_ENV_FILE: fichero } });
    const serializado = JSON.stringify(informe);
    assert.doesNotMatch(serializado, new RegExp(VALOR), 'el informe lleva un VALOR dentro');
    assert.doesNotMatch(resumenDeEnv(informe, { conNombres: true }), new RegExp(VALOR),
      'el resumen imprime un VALOR');
    // CONTROL POSITIVO: el nombre SÍ sale — si no saliera, el caso de arriba sería una
    // tautología sobre un informe vacío.
    assert.match(resumenDeEnv(informe, { conNombres: true }), /SCRUM932_SECRETO/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
