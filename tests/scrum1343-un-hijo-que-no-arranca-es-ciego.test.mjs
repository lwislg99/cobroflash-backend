// tests/scrum1343-un-hijo-que-no-arranca-es-ciego.test.mjs — SCRUM-1343
//
// Sin gate: ni BD, ni red, ni navegador. Funciones puras de la puerta, su fuente por AST, y DOS
// `spawnSync` de verdad (un binario que no existe y un hijo que revienta en su primera línea).
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN PROCESO QUE NO ARRANCÓ NO HA ENCONTRADO NADA
//
// El 1-oct-2026 el sistema se quedó sin memoria con `guards:visuales` por el guard 30 de 37. Los
// siete que faltaban salieron `rojo(3221225794)` · 0,0 s · «(sin salida)» —0xC0000142: el proceso
// no llegó a iniciarse— y la puerta cerró con «DEFECTOS (salida 1) · 7 guard(s) midieron y
// encontraron algo» y «0 CIEGOS · 7 rojos». Siete defectos que no existían, afirmados.
// (La salida literal: docs/evidencias/scrum1317/guards-visuales-cortado-por-memoria.txt.)
//
// Lo que este fichero fija:
//   ① el caso que se vio: un final que puso el SISTEMA, sin una letra, es CIEGO y tiene nombre;
//   ② el positivo, que es el que protege lo ganado: lo que un guard SÍ dijo sigue siendo rojo —
//      también el que sale con 1 sin imprimir nada y el que revienta en su primera línea;
//   ③ la línea «N guards midieron · K no arrancaron» sale siempre, y sus partes suman el total;
//   ④ la puerta decide con esa función y con `veredictoDe`, no con una escalera propia.
//
// ⚠️ LÍMITE: aquí no se provoca un 0xC0000142 de verdad (haría falta dejar la máquina sin memoria).
// Se le da a la función lo que `spawnSync` devolvió aquel día. La puerta entera, corriendo sobre
// hijos de verdad, está en `docs/master/evidencias/scrum1343/banco.mjs`, que no corre en `npm test`.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import {
  desenlaceDelHijo, esCodigoDelSistema, SUELO_DEL_CODIGO_DEL_SISTEMA,
  veredicto, recuento, filaDeFicheroAusente, llegoAMedir,
} from '../scripts/guards-visuales.mjs';
import { veredictoDe, SALIDA_HALLAZGO, SALIDA_NO_SUPE_MEDIR } from '../scripts/_hallazgos-y-ciegos.mjs';
import { SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA } from '../scripts/_navegador.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTA = path.join(RAIZ, 'scripts', 'guards-visuales.mjs');

/** El número que dio Windows el 1-oct: 0xC0000142. Escrito como salió, no derivado. */
const EL_DEL_1_DE_OCTUBRE = 3221225794;

/** La fila tal como la monta la puerta: el desenlace del hijo más su nombre. */
const filaDe = (g, r, salida = '') => ({ g, salida, ...desenlaceDelHijo(r, salida) });
const VERDE = (i) => filaDe('guard:verde-' + i, { status: 0, signal: null }, 'todo bien\n');
const repetir = (n, f) => Array.from({ length: n }, (_, i) => f(i));

// ── ① EL CASO QUE SE VIO ───────────────────────────────────────────────────────────────────────

test('SCRUM-1343 · el caso del 1-oct: 30 verdes y 7 procesos que no arrancaron NO son 7 hallazgos', () => {
  const filas = [
    ...repetir(30, VERDE),
    ...repetir(7, (i) => filaDe('guard:no-arranco-' + i, { status: EL_DEL_1_DE_OCTUBRE, signal: null }, '')),
  ];
  const c = recuento(filas);
  const v = veredicto(filas);

  assert.equal(c.linea, '30 verdes · 7 CIEGOS (7 PROCESO NO ARRANCÓ (0xC0000142)) · 0 rojos', 'antes decía «30 verdes · 0 CIEGOS · 7 rojos»');
  assert.equal(c.lineaDeArranque, '30 guards midieron · 7 no arrancaron · 0 arrancaron y no llegaron a medir');
  assert.equal(v.codigo, SALIDA_NO_SUPE_MEDIR, 'la tanda sigue cayendo, pero por la puerta del ciego');
  assert.equal(v.defectos, 0);
  assert.equal(v.ciegos, 7);
  assert.doesNotMatch(v.titulo, /midieron y encontraron algo/, 'ésta era la frase falsa');
  assert.match(v.titulo, /^NO MEDIDO \(salida 2\) · CIEGO en 7 guard\(s\)$/);
  assert.match(v.detalle, /guard:no-arranco-0: PROCESO NO ARRANCÓ \(0xC0000142\)/, 'el ciego va NOMBRADO, con el código del sistema');
  // Con 30 verdes delante, «NINGUN guard llegó a medir» habría sido otra frase falsa.
  assert.match(v.detalle, /^De los 7 no verdes, NINGUNO llegó a medir: /);
});

test('SCRUM-1343 · un binario que NO EXISTE: el `spawn` de verdad falla y la fila dice que no arrancó', () => {
  const inexistente = path.join(os.tmpdir(), 'scrum1343-este-binario-no-existe-' + process.pid);
  assert.equal(fs.existsSync(inexistente), false, 'suelo: si existiera, el caso no probaría nada');
  const r = spawnSync(inexistente, ['guard.mjs'], { encoding: 'utf8', timeout: 20000 });
  // El testigo de que el hijo NO llegó a existir (A21): sin código, sin señal, con el error del sistema.
  assert.equal(r.status, null);
  assert.equal(r.error && r.error.code, 'ENOENT');

  const f = filaDe('guard:sin-binario', r, (r.stdout || '') + (r.stderr || ''));
  assert.equal(f.estado, 'PROCESO NO ARRANCÓ (spawn ENOENT)', 'antes se pintaba «rojo(null)»: la palabra «rojo» sobre algo que no corrió');
  assert.equal(f.arranco, false);
  assert.equal(llegoAMedir(f.codigo), false);
  assert.equal(recuento([VERDE(0), f]).lineaDeArranque, '1 guard midió · 1 no arrancó · 0 arrancaron y no llegaron a medir');
});

test('SCRUM-1343 · el sistema lo acabó sin una letra: CIEGO, sea por código nativo o por señal', () => {
  for (const [r, estado] of [
    [{ status: EL_DEL_1_DE_OCTUBRE, signal: null }, 'PROCESO NO ARRANCÓ (0xC0000142)'],
    [{ status: 0xC0000005, signal: null }, 'PROCESO NO ARRANCÓ (0xC0000005)'],
    [{ status: null, signal: 'SIGKILL' }, 'PROCESO NO ARRANCÓ (señal SIGKILL)'],
    [{ status: null, signal: null, error: { code: 'EAGAIN' } }, 'PROCESO NO ARRANCÓ (spawn EAGAIN)'],
  ]) {
    // Espacios y saltos no son salida: un proceso que no arrancó no deja ni eso, pero un
    // `stderr` con un salto de línea suelto tampoco es un guard hablando.
    for (const salida of ['', '\n', '  \r\n']) {
      const d = desenlaceDelHijo(r, salida);
      assert.deepEqual(d, { estado, codigo: null, arranco: false }, JSON.stringify(r) + ' con salida ' + JSON.stringify(salida));
    }
  }
});

test('SCRUM-1343 · el sistema lo cortó A MEDIAS: no hay veredicto, y no se cuenta como «no arrancó»', () => {
  const d = desenlaceDelHijo({ status: 0xC0000005, signal: null }, 'midiendo 390 px…\n');
  assert.deepEqual(d, { estado: 'CORTADO POR EL SISTEMA (0xC0000005)', codigo: null, arranco: true });
  // Dijo sus cuentas y no eran de hallazgo: tampoco hay rojo que afirmar.
  const soloCiegos = veredictoDe({ hallazgos: 0, ciegos: 1 }).linea;
  assert.equal(desenlaceDelHijo({ status: null, signal: 'SIGKILL' }, soloCiegos + '\n').estado, 'CORTADO POR EL SISTEMA (señal SIGKILL)');

  const c = recuento([VERDE(0), { g: 'guard:cortado', ...d }]);
  assert.equal(c.lineaDeArranque, '1 guard midió · 0 no arrancaron · 1 arrancó y no llegó a medir');
  assert.equal(c.linea, '1 verde · 1 CIEGO (1 CORTADO POR EL SISTEMA (0xC0000005)) · 0 rojos');
});

test('SCRUM-1343 · el tope sigue siendo el tope', () => {
  // Con ETIMEDOUT `spawnSync` también deja `status: null` y una señal: sin esta rama se leería
  // como un proceso que no arrancó, y un guard que tardó 240 s sí arrancó.
  const d = desenlaceDelHijo({ status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' } }, '');
  assert.deepEqual(d, { estado: 'TOPE', codigo: null, arranco: true });
});

// ── ② EL POSITIVO ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-1343 · 🔴 POSITIVO: lo que un guard SÍ dijo sigue siendo rojo, y uno limpio sigue saliendo 0', () => {
  const conHallazgo = veredictoDe({ hallazgos: ['390 px: la nota no cabe'], ciegos: [] });
  const casos = [
    // [lo que devuelve spawnSync, lo que imprimió, estado esperado, código esperado]
    [{ status: 1, signal: null }, '🔴 HALLAZGOS 1\n' + conHallazgo.linea + '\n', 'rojo(1)', 1],
    [{ status: 1, signal: null }, 'Error: reventé en la primera línea\n', 'rojo(1)', 1],
    // El límite del ticket: sale con 1 y sin una letra. Ese 1 es SUYO: sigue siendo rojo.
    [{ status: 1, signal: null }, '', 'rojo(1)', 1],
    // Un código que la puerta no conoce sigue contando como defecto (SCRUM-639): fail-closed.
    [{ status: 77, signal: null }, '', 'rojo(77)', 77],
    [{ status: 13, signal: null }, 'algo\n', 'rojo(13)', 13],
  ];
  for (const [r, salida, estado, codigo] of casos) {
    const d = desenlaceDelHijo(r, salida);
    assert.deepEqual(d, { estado, codigo, arranco: true }, JSON.stringify(r) + ' con salida ' + JSON.stringify(salida));
    assert.equal(llegoAMedir(d.codigo), true);
    const v = veredicto([VERDE(0), { g: 'guard:x', ...d }]);
    assert.equal(v.codigo, SALIDA_HALLAZGO, 'un defecto real no puede pasar a «no medido»');
    assert.match(v.titulo, /1 guard\(s\) midieron y encontraron algo/);
  }
  // Y el limpio.
  assert.deepEqual(desenlaceDelHijo({ status: 0, signal: null }, 'todo bien\n'), { estado: 'verde', codigo: 0, arranco: true });
  assert.equal(veredicto([VERDE(0), VERDE(1)]).codigo, 0);
  // Las cegueras que el guard elige decir siguen con su nombre de siempre.
  assert.equal(desenlaceDelHijo({ status: SALIDA_NO_ENCONTRADO, signal: null }, 'x').estado, 'CIEGO');
  assert.equal(desenlaceDelHijo({ status: SALIDA_NO_ARRANCA, signal: null }, 'x').estado, 'NO ARRANCA');
});

test('SCRUM-1343 · 🔴 POSITIVO: si lo mató el sistema DESPUÉS de decir sus hallazgos, es rojo', () => {
  // El arreglo no puede convertir un hallazgo dicho en un ciego: lo que el guard imprimió manda.
  const dicho = veredictoDe({ hallazgos: 2, ciegos: 1 }).linea + '\n';
  for (const r of [{ status: EL_DEL_1_DE_OCTUBRE, signal: null }, { status: null, signal: 'SIGKILL' }]) {
    const d = desenlaceDelHijo(r, '🔴 HALLAZGOS 2\n' + dicho);
    assert.equal(d.codigo, SALIDA_HALLAZGO, JSON.stringify(r));
    assert.match(d.estado, /^rojo\(/);
    assert.equal(d.arranco, true);
    assert.equal(veredicto([{ g: 'guard:x', ...d }]).codigo, SALIDA_HALLAZGO);
  }
  // El control de que eso no pasa por cualquier marca: con 0 hallazgos dichos no hay rojo.
  const sinHallazgos = veredictoDe({ hallazgos: 0, ciegos: 0 }).linea + '\n';
  assert.equal(desenlaceDelHijo({ status: EL_DEL_1_DE_OCTUBRE, signal: null }, sinHallazgos).codigo, null);
});

test('SCRUM-1343 · 🔴 POSITIVO, con un hijo de verdad: reventar en la primera línea es rojo, no «no arrancó»', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1343-'));
  try {
    const guard = path.join(dir, 'revienta.mjs');
    fs.writeFileSync(guard, "throw new Error('reventé en la primera línea');\n");
    // El entorno del hijo se construye a mano: sin el contexto de `node --test` ni el color del chat.
    const env = {};
    for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP']) if (process.env[k] !== undefined) env[k] = process.env[k];
    const r = spawnSync(process.execPath, [guard], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
    const salida = (r.stdout || '') + (r.stderr || '');
    // Testigo: el hijo existió y fue él quien habló.
    assert.match(salida, /reventé en la primera línea/);
    assert.equal(r.status, 1);
    assert.deepEqual(desenlaceDelHijo(r, salida), { estado: 'rojo(1)', codigo: 1, arranco: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1343 · el borde sale de la constante: justo por debajo NO es del sistema', () => {
  assert.equal(SUELO_DEL_CODIGO_DEL_SISTEMA, 0xC0000000);
  assert.equal(esCodigoDelSistema(SUELO_DEL_CODIGO_DEL_SISTEMA), true);
  assert.equal(esCodigoDelSistema(SUELO_DEL_CODIGO_DEL_SISTEMA - 1), false);
  assert.equal(esCodigoDelSistema(EL_DEL_1_DE_OCTUBRE), true);
  for (const noLoEs of [0, 1, 2, 77, 143, 255, null, undefined, '3221225794']) assert.equal(esCodigoDelSistema(noLoEs), false, String(noLoEs));
  // Y el borde, en la función que decide: un código justo por debajo, sin salida, sigue siendo rojo.
  const debajo = desenlaceDelHijo({ status: SUELO_DEL_CODIGO_DEL_SISTEMA - 1, signal: null }, '');
  assert.equal(debajo.codigo, SUELO_DEL_CODIGO_DEL_SISTEMA - 1);
  assert.equal(llegoAMedir(debajo.codigo), true);
  assert.equal(desenlaceDelHijo({ status: SUELO_DEL_CODIGO_DEL_SISTEMA, signal: null }, '').codigo, null);
});

// ── ③ LA LÍNEA QUE SALE SIEMPRE ────────────────────────────────────────────────────────────────

test('SCRUM-1343 · «N guards midieron · K no arrancaron» se dice también con ceros, y suma el total', () => {
  const todoVerde = recuento([VERDE(0), VERDE(1)]);
  assert.equal(todoVerde.lineaDeArranque, '2 guards midieron · 0 no arrancaron · 0 arrancaron y no llegaron a medir');

  const noArranco = filaDe('guard:n', { status: EL_DEL_1_DE_OCTUBRE, signal: null }, '');
  const rojo = filaDe('guard:r', { status: 1, signal: null }, 'hallazgo\n');
  const sinNavegador = filaDe('guard:c', { status: SALIDA_NO_ARRANCA, signal: null }, 'el navegador no levanta\n');
  const tope = filaDe('guard:t', { status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' } }, '');
  const mezclas = [
    [],
    [VERDE(0)],
    [noArranco],
    [VERDE(0), rojo, noArranco],
    [VERDE(0), rojo, noArranco, sinNavegador, tope, filaDeFicheroAusente('guard:fantasma')],
  ];
  for (const filas of mezclas) {
    const c = recuento(filas);
    assert.equal(c.midieron + c.noArrancaron + c.sinMedir, filas.length, 'las tres partes suman la población: ' + c.lineaDeArranque);
    assert.match(c.lineaDeArranque, /^\d+ guards? midi(ó|eron) · \d+ no arranc(ó|aron) · \d+ arranc(ó|aron) y no lleg(ó|aron) a medir$/);
  }
  const grande = recuento(mezclas[4]);
  // Un rojo MIDIÓ: cuenta con los que midieron. El guard sin fichero no tuvo proceso: no arrancó.
  assert.deepEqual([grande.midieron, grande.noArrancaron, grande.sinMedir], [2, 2, 2]);
});

test('SCRUM-1343 · un hallazgo real y un proceso que no arrancó en la misma fila: salida 1, y se dice que falta uno', () => {
  const filas = [VERDE(0), filaDe('guard:r', { status: 1, signal: null }, 'hallazgo\n'), filaDe('guard:n', { status: EL_DEL_1_DE_OCTUBRE, signal: null }, '')];
  const v = veredicto(filas);
  assert.equal(v.codigo, SALIDA_HALLAZGO);
  assert.equal(v.defectos, 1, 'antes contaba 2: el que no arrancó entraba como hallazgo');
  assert.match(v.detalle, /^Han medido y hay hallazgos: guard:r\. /);
  assert.match(v.detalle, /1 guard\(s\) NO llegaron a medir \(guard:n: PROCESO NO ARRANCÓ \(0xC0000142\)\)/);
  assert.equal(recuento(filas).linea, '1 verde · 1 CIEGO (1 PROCESO NO ARRANCÓ (0xC0000142)) · 1 rojo');
});

// ── ④ LA PUERTA USA ESTO ───────────────────────────────────────────────────────────────────────

const sf = ts.createSourceFile('guards-visuales.mjs', fs.readFileSync(PUERTA, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function funcion(nombre) {
  let hallada = null;
  const ver = (nodo) => {
    if (ts.isFunctionDeclaration(nodo) && nodo.name && nodo.name.text === nombre) hallada = nodo;
    ts.forEachChild(nodo, ver);
  };
  ver(sf);
  assert.ok(hallada, 'CIEGO: no encuentro la función `' + nombre + '` en la puerta');
  return hallada;
}

function llamadasA(raiz, nombre) {
  const halladas = [];
  const ver = (nodo) => {
    if (ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === nombre) halladas.push(nodo);
    ts.forEachChild(nodo, ver);
  };
  ver(raiz);
  return halladas;
}

test('SCRUM-1343 · la puerta clasifica a sus hijos con `desenlaceDelHijo`, y no monta un «rojo(» por su cuenta', () => {
  const puerta = funcion('puerta');
  assert.equal(llamadasA(puerta, 'spawnSync').length, 1, 'suelo: la puerta lanza a sus hijos en un solo sitio');
  assert.equal(llamadasA(puerta, 'desenlaceDelHijo').length, 1);
  // Por AST: los comentarios de la puerta nombran «rojo(» al explicarse.
  const literales = [];
  const ver = (nodo) => {
    if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) literales.push(nodo.text);
    ts.forEachChild(nodo, ver);
  };
  ver(puerta);
  assert.ok(literales.length > 20, 'suelo: he leído ' + literales.length + ' literales de `puerta`');
  assert.deepEqual(literales.filter((t) => t.includes('rojo(')), [], 'la escalera de estados vive en `desenlaceDelHijo`');
  // Control: la misma búsqueda SÍ ve el literal donde tiene que estar.
  const enDesenlace = [];
  const verD = (nodo) => {
    if (ts.isStringLiteral(nodo)) enDesenlace.push(nodo.text);
    ts.forEachChild(nodo, verD);
  };
  verD(funcion('desenlaceDelHijo'));
  assert.ok(enDesenlace.filter((t) => t.includes('rojo(')).length >= 2);
});

test('SCRUM-1343 · la línea de arranque se imprime SIN condición: cuelga del cuerpo de `puerta`, no de un `if`', () => {
  const puerta = funcion('puerta');
  const usos = [];
  const ver = (nodo) => {
    if (ts.isPropertyAccessExpression(nodo) && nodo.name.text === 'lineaDeArranque') usos.push(nodo);
    ts.forEachChild(nodo, ver);
  };
  ver(puerta);
  assert.equal(usos.length, 1, 'la puerta la imprime en un solo sitio');
  let sentencia = usos[0];
  while (sentencia && !ts.isExpressionStatement(sentencia)) sentencia = sentencia.parent;
  assert.ok(sentencia, 'el uso es una sentencia');
  assert.match(sentencia.getText(sf), /^console\.log\(/);
  assert.equal(sentencia.parent, puerta.body, 'si colgara de un `if` o de un bucle, dejaría de salir con ceros');
});

test('SCRUM-1343 · el veredicto de la tanda pasa por `veredictoDe`: no hay una tercera forma de decidir', () => {
  assert.equal(llamadasA(funcion('veredicto'), 'veredictoDe').length, 1);
  assert.equal(llamadasA(funcion('desenlaceDelHijo'), 'veredictoDe').length, 1);
  // Y decide lo mismo que la regla de la casa en las tres formas.
  const rojo = filaDe('guard:r', { status: 1, signal: null }, 'x');
  const ciego = filaDe('guard:n', { status: EL_DEL_1_DE_OCTUBRE, signal: null }, '');
  for (const filas of [[VERDE(0)], [rojo], [ciego], [rojo, ciego], [VERDE(0), ciego]]) {
    const casa = veredictoDe({
      hallazgos: filas.filter((f) => f.estado !== 'verde' && llegoAMedir(f.codigo)),
      ciegos: filas.filter((f) => f.estado !== 'verde' && !llegoAMedir(f.codigo)),
    });
    assert.equal(veredicto(filas).codigo, casa.codigo, filas.map((f) => f.estado).join(' + '));
  }
});
