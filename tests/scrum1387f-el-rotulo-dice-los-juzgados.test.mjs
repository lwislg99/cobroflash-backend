// tests/scrum1387f-el-rotulo-dice-los-juzgados.test.mjs — SCRUM-1387 (tramo 1387f) · S3
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 «en 238 ficheros DECLARANTES de 1565 (15 %)» SE LEÍA COMO LO QUE EL CI REPITE, Y ERAN 192
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Medido el 29-oct-2026 (1387e) en el último meta-guard de `main` que terminó (run 40872477063, job
// 123442782267, sobre `eafca9fe1`): «sobre 735 juzgadas de 940 declaraciones, en 238 ficheros
// DECLARANTES de 1565 ficheros de test (15 %)». Todo cierto, pero el corte por tiempo (SCRUM-1620)
// dejó 46 guards sin NINGUNA mutación juzgada: los ficheros que el CI repite de verdad son 192, el
// 12 %. El corte se veía en la lista de ciegas del log; en la línea que se copia, no.
//
// Lo que se exige aquí:
//   ① la línea del recuento dice también cuántos ficheros tienen ALGUNA juzgada, de cuántos
//      declarantes y sobre la población entera, en la MISMA línea;
//   ② el bloque principal los cuenta en el bucle, en el sitio donde se juzga, y se los pasa;
//   ③ sin ese dato, la línea es la de 1387d byte a byte (no cambia nada que ya se lea así);
//   ④ no decide nada: imprime (los veredictos y los códigos de salida no se tocan).
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 La pasada entera NO se corre aquí, por lo mismo que en `scrum1387d` y `scrum935d`: movería el
//    árbol bajo los demás tests. La pieza es pura y se prueba aquí; que el bloque principal la
//    alimenta se lee del AST, sin comentarios; y la pasada de verdad está en el registro.
// 🔴 Lo que junta `--juntar` (las K partes de 1620) no pasa por esta línea: su recuento lo hace
//    `veredictoDeLasPartes`, y los juzgados no viajan en el resumen de la parte. Va en el registro
//    como resto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { rotuloDelResultado } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    + (ficherosJuzgados === null ? \'\' : ` · ${ficherosJuzgados} juzgados de ${declarantes} declarantes `',
    a: '    + (ficherosJuzgados === null ? \'\' : ` · ${declarantes} juzgados de ${declarantes} declarantes `',
    cae: 'SCRUM-1387f · ① la línea dice cuántos ficheros tienen alguna juzgada, de cuántos y sobre cuántos' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '      guardsJuzgados.add(guard);',
    a: '      void guard; // no se cuenta, a proposito',
    cae: 'SCRUM-1387f · ② el bloque principal cuenta los juzgados donde se juzga, y se los pasa' },
];

// Las cifras del log del 29-oct, tal cual: es el caso que este tramo arregla.
const DEL_29_OCT = {
  vivas: 735, mudas: 0, ciegas: 1, muertos: 0, juzgadas: 735, declaraciones: 940,
  declarantes: 238, poblacion: 1565,
};

test('SCRUM-1387f · ① la línea dice cuántos ficheros tienen alguna juzgada, de cuántos y sobre cuántos', () => {
  const l = rotuloDelResultado({ ...DEL_29_OCT, ficherosJuzgados: 192 });
  assert.equal(l.includes('\n'), false, '🔴 va en la MISMA línea: una línea se copia sola');
  assert.match(l, / · 192 juzgados de 238 declarantes \(12 % de los 1565 ficheros de test\)$/,
    '🔴 sin los juzgados, «238 DECLARANTES (15 %)» se lee como lo que el CI repite, y son 192 (12 %)');
  // Lo de 1387d sigue ahí, igual: quien lo buscaba lo sigue encontrando.
  assert.match(l, /^vivas 735 · mudas 0 · ciegas 1 · ficheros muertos 0 · sobre 735 juzgadas de 940 declaraciones, en 238 ficheros DECLARANTES de 1565 ficheros de test \(15 %\) · /);
  // Con el 100 % también se dice: una población que sólo sale cuando es mala se lee, por su ausencia, como buena.
  assert.match(rotuloDelResultado({ ...DEL_29_OCT, declarantes: 4, poblacion: 4, ficherosJuzgados: 4 }),
    / · 4 juzgados de 4 declarantes \(100 % de los 4 ficheros de test\)$/);
  // Y cero juzgados (un corte antes de la primera) se dice como cero, no se calla.
  assert.match(rotuloDelResultado({ ...DEL_29_OCT, ficherosJuzgados: 0 }), / · 0 juzgados de 238 declarantes \(0 % de los 1565/);
  assert.match(rotuloDelResultado({ ...DEL_29_OCT, poblacion: 0, declarantes: 0, ficherosJuzgados: 0 }), /\(0 % de los 0 ficheros de test\)$/);
});

test('SCRUM-1387f · ③ sin el dato, la línea es la de 1387d byte a byte; con parte, los juzgados van antes', () => {
  assert.equal(rotuloDelResultado(DEL_29_OCT),
    'vivas 735 · mudas 0 · ciegas 1 · ficheros muertos 0 · sobre 735 juzgadas de 940 declaraciones, '
    + 'en 238 ficheros DECLARANTES de 1565 ficheros de test (15 %)');
  const p = rotuloDelResultado({ ...DEL_29_OCT, ficherosJuzgados: 60, parte: { i: 2, k: 3 }, declaracionesDelCenso: 2800 });
  assert.match(p, / · 60 juzgados de 238 declarantes \(4 % de los 1565 ficheros de test\) · PARTE 2 de 3 \(el censo entero: 2800 declaraciones\)$/);
});

/** El bloque principal: su código SIN comentarios (A23 nº 2). */
function bloquePrincipal() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8');
  const sf = ts.createSourceFile('m.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const si = sf.statements.find((s) => ts.isIfStatement(s) && /ejecutadoDirectamente/.test(s.expression.getText(sf)));
  assert.ok(si && ts.isBlock(si.thenStatement), 'NO PUDE MIRAR: no encuentro el bloque `if (ejecutadoDirectamente(…))`');
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, si.thenStatement, sf);
}

test('SCRUM-1387f · ② el bloque principal cuenta los juzgados donde se juzga, y se los pasa', () => {
  const codigo = bloquePrincipal();
  const juzga = codigo.indexOf('juzgadas += 1;');
  const aplica = codigo.indexOf('await aplicarUna(mut, guard, limpia)');
  assert.ok(juzga > 0 && aplica > juzga, 'NO PUDE MIRAR: no encuentro `juzgadas += 1;` antes de `aplicarUna`');
  // Se cuenta en el MISMO sitio que la juzgada: entre `juzgadas += 1` y la mutación. Contarlo en otro
  // sitio (al empezar el guard, por ejemplo) contaría como juzgado un guard que el corte dejó a cero.
  const anade = codigo.indexOf('guardsJuzgados.add(guard);', juzga);
  assert.ok(anade > juzga && anade < aplica,
    '🔴 los juzgados ya no se cuentan donde se juzga: el rótulo diría ficheros que el corte dejó sin ninguna');
  const llamada = /rotuloDelResultado\(\{[^}]*\bficherosJuzgados: guardsJuzgados\.size\b[^}]*\}\)/.exec(codigo);
  assert.ok(llamada, '🔴 el recuento final ya no recibe los juzgados: vuelve a leerse 15 % donde el CI repite 12 %');
});
