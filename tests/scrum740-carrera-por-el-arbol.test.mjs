// tests/scrum740-carrera-por-el-arbol.test.mjs — SCRUM-740
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// DOS TESTS SE PISAN, Y NINGUNO DE LOS DOS TIENE UN DEFECTO.
//
// `scrum206b` crea y borra `tests/__tmp-emite-sin-sellar.ts` mientras `scrum226` barre el árbol.
// Entre el `readdirSync` que lo lista y el `readFileSync` que lo lee hay un hueco, y en ese hueco
// el fichero se esfuma: ENOENT. El rojo sale INTERMITENTE — la peor forma de salir, porque con
// nueve worktrees vivos se lee como «el rojo ajeno de siempre» y nadie lo mira. Es el mismo
// mecanismo que SCRUM-730 un escalón al lado: un rojo tolerado esconde algo.
//
// NO ES DEFECTO DE NINGUNO DE LOS DOS: es ACOPLAMIENTO por un recurso global, el árbol.
//
// ── POR QUÉ EL ARREGLO NO PUEDE SER PARA ESTE PAR ───────────────────────────────────────────
// Medido: 4 tests escriben DENTRO de `tests/` y 6 barren ese árbol leyéndolo. **24 pares.** Es
// una clase de fallo, no un choque.
//
// ── POR QUÉ SE ARREGLA EL BARRIDO Y NO LOS ESCRITORES ───────────────────────────────────────
// Porque los cuatro escritores NO PUEDEN dejar de escribir ahí: son AUTOPRUEBAS. Fabrican un
// fichero sintético con el defecto que su propio guard busca, para verlo salir en rojo. El
// fichero TIENE que estar dentro del árbol que el guard barre — moverlo a `tmpdir` no arregla la
// carrera, DESACTIVA el control positivo. `scrum206b:178` lo dice en su comentario: «un guard que
// nunca se ha visto en rojo es decoración».
//
// ⛔ Y NO se marca flaky ni se reintenta: un reintento sobre una carrera la esconde, y la próxima
// vez que muerda lo hará en un sitio donde el reintento no esté.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url'; // SCRUM-730
import ts from 'typescript';
import { leerSiSigueAhi, exigirCorpusLeido, informeDelBarrido, reiniciarBarrido } from './_barrido-estable.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_TESTS = path.join(RAIZ, 'tests');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL HELPER · lo que perdona y lo que NO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-740 · `leerSiSigueAhi` lee lo que existe y devuelve null si desapareció', () => {
  reiniciarBarrido();
  const tmp = path.join(os.tmpdir(), `scrum740-${process.pid}.txt`);
  fs.writeFileSync(tmp, 'hola');
  assert.equal(leerSiSigueAhi(tmp), 'hola', '🔴 no lee un fichero que sí está');
  fs.rmSync(tmp, { force: true });
  assert.equal(leerSiSigueAhi(tmp), null, '🔴 no tolera la desaparición: la carrera seguiría viva');

  const info = informeDelBarrido();
  assert.equal(info.leidos, 1, '🔴 no cuenta los leídos, y el suelo se apoya en ese número');
  assert.equal(info.desaparecidos.length, 1, '🔴 no deja constancia de lo que se esfumó');
});

test('SCRUM-740 · 🔴 SÓLO perdona ENOENT: cualquier otro error SIGUE siendo un fallo', () => {
  reiniciarBarrido();
  // Un directorio no es un fichero: `readFileSync` da EISDIR en Linux y EPERM/EISDIR en Windows.
  // Sea cual sea, NO es ENOENT y tiene que relanzarse — «no está» y «no supe leerlo» son cosas
  // distintas. Un `catch` pelado (el que había en `scrum393:107`) se las come las dos.
  assert.throws(() => leerSiSigueAhi(DIR_TESTS), (e) => e && e.code !== 'ENOENT',
    '🔴 se está tragando un error que NO es una desaparición. Eso convierte «no supe mirar» en '
    + 'verde, que es exactamente lo que este helper existe para impedir.');
  assert.equal(informeDelBarrido().desaparecidos.length, 0,
    '🔴 ha contado como «desaparecido» algo que no lo era.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL SUELO · tolerar un fichero que se va NO puede ser tolerar un árbol vacío
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-740 · 🔴 EL SUELO: un corpus vacío FALLA, y el mensaje dice por qué', () => {
  assert.throws(
    () => exigirCorpusLeido(0, 50, 'prueba'),
    /CORPUS VACÍO O CASI/,
    '🔴 sin este suelo, tolerar el ENOENT es una puerta abierta: si el barrido apuntara a un '
    + 'directorio equivocado, TODAS las lecturas darían null y el guard pasaría en verde.');
  assert.throws(() => exigirCorpusLeido(49, 50, 'prueba'), /se leyeron 49/);
});

test('SCRUM-740 · CONTROL NEGATIVO: con corpus suficiente, el suelo NO estorba', () => {
  // Si saltara con un barrido sano sería ruido, y el ruido se aprende a ignorar justo antes de
  // que el aviso importe.
  assert.doesNotThrow(() => exigirCorpusLeido(50, 50, 'prueba'));
  assert.doesNotThrow(() => exigirCorpusLeido(5000, 50, 'prueba'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CENSO · escritores × barredores, que es el número que dice si esto es un par o una clase
// ═════════════════════════════════════════════════════════════════════════════════════════

const ESCRIBE = new Set(['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'copyFileSync', 'cpSync']);

/**
 * ¿Este fichero escribe DENTRO del árbol de `tests/`? **Por lo que hace, no por su nombre.**
 *
 * 🔴 Y no basta con mirar el argumento de la escritura: el destino casi nunca es un literal, es
 * una VARIABLE (`fs.writeFileSync(malo, …)` con `const malo = path.join(RAIZ, 'tests', …)` diez
 * líneas antes). Contar por el argumento devuelve CERO y el cero se leería como «no hay
 * escritores» — el falso verde de siempre. Así que se sigue la variable: primero se recogen los
 * nombres que apuntan a algo dentro de `tests/`, y luego se mira si alguna escritura los usa.
 */
function escribeEnTests(src) {
  const sf = ts.createSourceFile('x.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const apuntanATests = new Set();

  // Paso 1: nombres cuyo inicializador construye una ruta bajo `tests/`.
  const recoger = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer) {
      const t = n.initializer.getText(sf);
      if (/path\.join\([^)]*['"]tests['"]/.test(t) || /['"]tests[/\\]/.test(t)) {
        apuntanATests.add(n.name.text);
      }
    }
    ts.forEachChild(n, recoger);
  };
  recoger(sf);

  // Paso 2: ¿alguna escritura tiene como destino uno de esos nombres (o un literal con `tests`)?
  let si = false;
  const v = (n) => {
    if (!si && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ESCRIBE.has(n.expression.name.text)) {
      const arg = n.arguments[0];
      if (arg) {
        if (ts.isIdentifier(arg) && apuntanATests.has(arg.text)) si = true;
        else if (/['"]tests['"]/.test(arg.getText(sf))) si = true;
      }
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return si;
}

/** ¿Este fichero BARRE leyendo, y su barrido alcanza `tests/` o la raíz? */
function barreElArbol(src) {
  if (!/readdirSync/.test(src)) return false;
  return /readdirSync\([^)]*['"]tests['"]/.test(src)
    || /ARBOLES\s*=\s*\[[^\]]*['"]tests['"]/.test(src)
    || /walk\(\s*RAIZ/.test(src) || /ficheros\(\s*RAIZ\s*\)/.test(src)
    || /readdirSync\(\s*RAIZ/.test(src);
}

/**
 * CENSO MEDIDO el 4-sep-2026 sobre `origin/main` = 0cc1376eb2a1f5fb12001bf9d596eab85786d981.
 *
 * 4 escritores × 6 barredores = **24 colisiones posibles**. La cota bruta (cualquier escritor
 * contra cualquier barredor del repo) era 25 × 112 = 2.800; lo que la baja a 24 es exigir que el
 * escritor escriba DENTRO de un árbol que el barredor recorre.
 *
 * Los números son suelos, no igualdades: si mañana entra otro escritor o otro barredor, el
 * trinquete de abajo exige que use el helper — no que el censo no crezca.
 */
const ESCRITORES_MEDIDOS = 4;
const BARREDORES_MEDIDOS = 6;

/** Los que barren el árbol y por tanto TIENEN que leer con el helper. */
const BARREDORES = Object.freeze([
  'scrum226-url-bd-sin-parseo-a-mano.test.mjs',
  'scrum226-url-credencial-en-argv.test.mjs',
  'scrum233-prosa-sin-url-insegura.test.mjs',
  'scrum268-espera-automatica.test.mjs',
  'scrum393-marcadores-de-conflicto.test.mjs',
  'scrum419-ci-declara-lo-que-no-corre.test.mjs',
]);

test('SCRUM-740 · SUELO: el censo ve el corpus y encuentra el par que originó el ticket', () => {
  const todos = fs.readdirSync(DIR_TESTS).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(todos.length >= 300, `🔴 CIEGO: sólo ${todos.length} ficheros de test.`);

  // Control positivo del detector, con los dos casos concretos del ticket.
  const escritor = fs.readFileSync(path.join(DIR_TESTS, 'scrum206b-quien-emite-sella.test.mjs'), 'utf8');
  assert.ok(escribeEnTests(escritor), '🔴 el detector no ve al escritor que originó el ticket.');
  const barredor = fs.readFileSync(path.join(DIR_TESTS, 'scrum226-url-credencial-en-argv.test.mjs'), 'utf8');
  assert.ok(barreElArbol(barredor), '🔴 el detector no ve al barredor que originó el ticket.');

  // Y control negativo: un fichero que ni escribe ni barre no puede salir en ninguna lista.
  assert.equal(escribeEnTests('const a = 1;'), false);
  assert.equal(barreElArbol('const a = 1;'), false);
});

test('SCRUM-740 · 🔴 el censo: escritores × barredores, y no ha bajado', () => {
  const todos = fs.readdirSync(DIR_TESTS).filter((f) => f.endsWith('.test.mjs'));
  const escritores = [];
  const barredores = [];
  for (const f of todos) {
    const src = fs.readFileSync(path.join(DIR_TESTS, f), 'utf8');
    if (f !== 'scrum740-carrera-por-el-arbol.test.mjs' && escribeEnTests(src)) escritores.push(f);
    if (barreElArbol(src)) barredores.push(f);
  }
  assert.ok(escritores.length >= ESCRITORES_MEDIDOS,
    `🔴 el detector de escritores ve ${escritores.length} y se midieron ${ESCRITORES_MEDIDOS}: `
    + 'se ha quedado ciego, y su número dejaría de significar nada.');
  assert.ok(barredores.length >= BARREDORES_MEDIDOS,
    `🔴 el detector de barredores ve ${barredores.length} y se midieron ${BARREDORES_MEDIDOS}.`);
});

/**
 * 🔴 CUÁNTAS VECES SE **LLAMA** A `nombre` EN ESTE FICHERO. Por AST, no por subcadena.
 *
 * Escrito así porque la primera versión de este trinquete era MUDA y me cazó al probar el rojo:
 * miraba `src.includes('leerSiSigueAhi')`, y el `import` más el comentario que explica la regla
 * mantienen la palabra viva aunque la llamada desaparezca. O sea que quitar la llamada NO ponía
 * el guard en rojo. Mencionar no es hacer, y un guard que cuenta menciones vigila la prosa.
 */
function llamadasA(src, nombre) {
  const sf = ts.createSourceFile('x.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let n = 0;
  const v = (nodo) => {
    if (ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === nombre) n += 1;
    ts.forEachChild(nodo, v);
  };
  v(sf);
  return n;
}

test('SCRUM-740 · SUELO: el contador de llamadas distingue una LLAMADA de una MENCIÓN', () => {
  // Si esto no se cumpliera, los dos trinquetes de abajo pasarían sobre un import huérfano.
  assert.equal(llamadasA("import { leerSiSigueAhi } from './x.mjs';", 'leerSiSigueAhi'), 0,
    '🔴 cuenta el import como si fuera una llamada.');
  assert.equal(llamadasA('// usa leerSiSigueAhi aquí', 'leerSiSigueAhi'), 0,
    '🔴 cuenta un comentario como si fuera una llamada.');
  assert.equal(llamadasA('const a = leerSiSigueAhi(p);', 'leerSiSigueAhi'), 1,
    '🔴 NO ve una llamada de verdad: el trinquete sería ciego, no mudo.');
});

test('SCRUM-740 · 🔴 TRINQUETE: todo el que barre el árbol lee con el helper', () => {
  const sinHelper = [];
  for (const f of BARREDORES) {
    const p = path.join(DIR_TESTS, f);
    assert.ok(fs.existsSync(p), `🔴 el barredor \`${f}\` ya no existe: actualiza esta lista.`);
    const src = fs.readFileSync(p, 'utf8');
    if (llamadasA(src, 'leerSiSigueAhi') === 0) sinHelper.push(f);
  }
  assert.deepEqual(sinHelper, [],
    '🔴 UN BARREDOR DEL ÁRBOL VOLVIÓ A LEER A PELO:\n'
    + sinHelper.map((f) => '   · ' + f).join('\n')
    + '\n\n  Entre el `readdirSync` y el `readFileSync` otro test puede borrar el fichero, y el\n'
    + '  barrido muere con un ENOENT intermitente que se lee como «el rojo ajeno de siempre».\n'
    + '  Usa `leerSiSigueAhi` de `_barrido-estable.mjs`, que perdona SÓLO la desaparición, y\n'
    + '  cierra con `exigirCorpusLeido` para que perdonarla no acabe en barrer un árbol vacío.');
});

test('SCRUM-740 · 🔴 y cada barredor CIERRA con su suelo', () => {
  // Tolerar sin suelo es la mitad mala del arreglo: es lo que había en `scrum393` con su `catch`
  // pelado. Si alguien añade la tolerancia y se olvida del suelo, esto cae.
  const sinSuelo = BARREDORES.filter((f) => {
    const src = fs.readFileSync(path.join(DIR_TESTS, f), 'utf8');
    // Por LLAMADAS, igual que el trinquete de arriba y por el mismo motivo: el import y el
    // comentario dejan la palabra en el fichero aunque el suelo se haya quitado.
    return llamadasA(src, 'leerSiSigueAhi') > 0 && llamadasA(src, 'exigirCorpusLeido') === 0;
  });
  assert.deepEqual(sinSuelo, [],
    '🔴 TOLERA EL ENOENT PERO NO EXIGE CORPUS:\n'
    + sinSuelo.map((f) => '   · ' + f).join('\n')
    + '\n\n  Tragar un fichero que desaparece no puede convertirse en tragar un árbol vacío.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-745 · LAS MUTACIONES QUE TIENEN QUE TUMBAR A ESTE GUARD, DECLARADAS
//
// Los dos trinquetes de arriba nacieron MUDOS y sólo lo destapó inyectar el defecto a mano. Eso
// dependía de que a alguien se le ocurriera. Aquí quedan escritas las dos inyecciones exactas,
// junto al guard que deben tumbar, para que `npm run meta:mutaciones` las ejecute sin que nadie
// se acuerde. Viven aquí y no en un registro central: lo que no está al lado no se actualiza.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/scrum393-marcadores-de-conflicto.test.mjs',
    de: '    const txt = leerSiSigueAhi(f);\n    if (txt === null) continue;',
    a: "    const txt = fs.readFileSync(f, 'utf8');",
    cae: 'TRINQUETE: todo el que barre el árbol lee con el helper',
  },
  {
    fichero: 'tests/scrum393-marcadores-de-conflicto.test.mjs',
    de: "  exigirCorpusLeido(leidos, 50, 'SCRUM-393 · marcadores de conflicto');\n",
    a: '',
    cae: 'y cada barredor CIERRA con su suelo',
  },
];
