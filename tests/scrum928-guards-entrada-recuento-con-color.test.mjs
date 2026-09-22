// tests/scrum928-guards-entrada-recuento-con-color.test.mjs — SCRUM-928, punto 2
//
// EL SUELO Nº2 DE `guards:entrada` SE CAE SOLO CON QUE EL ENTORNO TRAIGA COLOR.
//
// El punto 1 del ticket —el mismo defecto en `scripts/tanda-con-veredicto.mjs`, que convierte una
// tanda VERDE en exit 4 y deja `npm test` en rojo con el árbol sano— es de la Sesión 3, y aquí NO
// se toca ese fichero.
//
// ── EL DEFECTO, MEDIDO ──────────────────────────────────────────────────────────────────────
// `scripts/guards-entrada.mjs` comprueba que los guards no solo existan, sino que HAYAN CORRIDO:
// lee el recuento que imprime el runner de node («ℹ tests 26») y para si es menor que el mínimo.
// Ese recuento se leía con una expresión anclada al final de línea. Con color, el runner escribe
//
//     \x1b[34mℹ tests 26\x1b[39m
//
// y el `\x1b[39m` del final impide que el ancla case. Sin coincidencia, el recuento se toma como
// 0 y el comando sale 1 con «solo se ejecutaron 0 tests» **aunque los 26 hayan pasado**.
//
// Medido el 17-sep-2026 sobre el mismo árbol, cambiando solo la variable de entorno:
//
//     FORCE_COLOR=0 → ✓ 4 guards de entrada en verde (26 tests)   EXIT 0
//     FORCE_COLOR=3 → 🔴 solo se ejecutaron 0 tests entre 4 ficheros   EXIT 1
//
// ── POR QUÉ ESTO IMPORTA MÁS DE LO QUE PARECE ───────────────────────────────────────────────
// Es un rojo MENTIROSO, que es la peor clase: no dice «tengo color», dice «tus tests no han
// corrido». Quien lo ve se pone a buscar el guard roto que no existe. Le pasó a tres sesiones el
// mismo día.
//
// Y no se esquiva lanzando bien: se midió que una sesión lanzada con `FORCE_COLOR=0` delante
// SIGUE trayendo `FORCE_COLOR=3` en su entorno. El prefijo en la orden de lanzamiento no limpia
// el entorno del proceso. Por eso el arreglo va en el LECTOR, no en quien llama.
//
// ── CÓMO SE VIGILA ──────────────────────────────────────────────────────────────────────────
// Dos capas, y la segunda es la que importa:
//
//   ① la unitaria fija la conducta: con color o sin él, el recuento es el mismo número;
//   ② la de integración NO da por buena la cadena de arriba: ejecuta el runner de node DE VERDAD
//      con el color forzado y le pasa su salida REAL al lector. Si una versión de node cambia
//      cómo colorea esa línea, ① seguiría en verde sobre una cadena histórica y ② se pondría
//      roja. Un test que solo comprueba mi transcripción del ANSI mide mi memoria, no el runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { recuentoDeTests } from '../scripts/guards-entrada.mjs';

const ESC = '\u001B';

test('① el recuento se lee igual con color que sin él', () => {
  const sinColor = 'ℹ tests 26';
  const conColor = `${ESC}[34mℹ tests 26${ESC}[39m`;

  assert.equal(recuentoDeTests(sinColor), 26, 'sin color ya funcionaba: no se ha roto');
  assert.equal(
    recuentoDeTests(conColor),
    26,
    'con color se leía 0 y el comando salía 1 con «0 tests» aunque todo pasara',
  );
});

test('① el recuento sale de la línea del runner, no de cualquier línea que diga «tests»', () => {
  // SUELO. El arreglo es quitar los códigos ANSI, NO aflojar la expresión hasta que case con
  // todo: un lector que acepte cualquier mención de «tests» leería el número de un nombre de
  // test o de una ruta, y volveríamos a tener un verde que no significa nada.
  assert.equal(recuentoDeTests(''), 0, 'sin salida no hay recuento');
  assert.equal(recuentoDeTests('ℹ pass 26\nℹ fail 0'), 0, 'esas líneas no son el recuento');

  // ⚠️ ESTE CASO ES EL QUE VALE, y se aprendió probándolo: la primera versión del suelo usaba
  // líneas donde «tests» NO iba seguido de un número, así que una expresión aflojada a
  // `/\btests\s+(\d+)/` —sin ancla— las pasaba igual y el mutante sobrevivía. Un nombre de test
  // con un número detrás es lo que distingue las dos versiones.
  assert.equal(
    recuentoDeTests('✔ repite los tests 3 veces seguidas (1.2ms)\nℹ tests 26'),
    26,
    'el recuento sale de SU línea, no del primer «tests <n>» que aparezca por ahí',
  );
  assert.equal(
    recuentoDeTests('✔ repite los tests 3 veces seguidas (1.2ms)'),
    0,
    'sin línea de recuento no hay recuento, aunque haya un «tests 3» dentro de un nombre',
  );
  assert.equal(
    recuentoDeTests(`${ESC}[34mℹ tests 26${ESC}[39m\n${ESC}[34mℹ suites 4${ESC}[39m`),
    26,
    'con varias líneas de color se sigue cogiendo la del recuento',
  );
});

test('② el runner de node de HOY, con el color forzado, se lee bien', () => {
  // Esto es lo que ① no puede probar: que la cadena de arriba sigue siendo la que node imprime.
  const banco = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum928-color-'));
  try {
    const sonda = path.join(banco, 'sonda.test.mjs');
    fs.writeFileSync(
      sonda,
      ["import test from 'node:test';", "test('a', () => {});", "test('b', () => {});", ''].join('\n'),
    );

    // ⚠️ `NODE_TEST_CONTEXT` SE HEREDA y cambia el reporter del hijo a uno serializado, que no
    // escribe nada por stdout. Heredándolo, este test medía una salida VACÍA y el `recuentoDeTests`
    // de abajo daba 0 tanto roto como arreglado. Lo cazó el control positivo de más abajo, no el
    // resultado. Por eso está: un test que no puede distinguir las dos versiones no es un test.
    const env = { ...process.env, FORCE_COLOR: '3' };
    delete env.NODE_TEST_CONTEXT;

    const r = spawnSync(process.execPath, ['--test', sonda], {
      cwd: banco,
      encoding: 'utf8',
      env,
    });

    assert.match(
      r.stdout || '',
      new RegExp(`${ESC}\\[`, 'u'),
      'este test no mide nada si el runner no ha coloreado: revisa FORCE_COLOR',
    );
    assert.equal(
      recuentoDeTests(r.stdout || ''),
      2,
      'la salida COLOREADA de node debe dar el número real de tests, no 0',
    );
  } finally {
    fs.rmSync(banco, { recursive: true, force: true });
  }
});

test('② importar el script no lo ejecuta', () => {
  // Si `guards-entrada.mjs` corriera al importarse, este fichero habría lanzado los 4 guards
  // —23 s— solo por pedirle una función, y un `process.exit(1)` suyo mataría la suite entera.
  assert.equal(typeof recuentoDeTests, 'function');
});
