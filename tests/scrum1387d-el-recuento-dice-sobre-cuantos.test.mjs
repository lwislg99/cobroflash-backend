// tests/scrum1387d-el-recuento-dice-sobre-cuantos.test.mjs — SCRUM-1387 (tramo 1387d, la mitad ①) · S3
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 «vivas 707 · mudas 0 · ciegas 1» NO DECÍA SOBRE CUÁNTAS
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Medido el 27-oct-2026 en `main` (`77ce98573`, run 40518576319, job 122241583529): la pasada de
// `npm run meta:mutaciones` acabó en «vivas 707 · mudas 0 · ciegas 1 · ficheros muertos 0». Esa
// «ciegas 1» era un corte por tiempo con 177 de 884 mutaciones SIN JUZGAR en 44 ficheros, y el
// rótulo con la población (`rotuloDelCenso`, SCRUM-812) sólo salía con `--solo-censo`, que el CI no
// pasa. Un recuento sin población no distingue «no hay más» de «no miré ahí».
//
// Lo que se exige aquí (los tres controles del ticket):
//   ① la línea del recuento lleva su población PEGADA, en la misma línea;
//   ② no cambia cómo decide: imprime (los veredictos y los códigos de salida no se tocan, y eso lo
//      siguen vigilando sus propios tests: `scrum765`, `scrum935d`, `scrum812`);
//   ③ sale SIEMPRE, también con el 100 %.
// Y de paso (defecto medido en el mismo log): el corte salía DOS veces.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 La pasada entera NO se corre aquí, por lo mismo que en `scrum935d`: movería el árbol bajo los
//    demás tests. Las piezas son puras y se prueban aquí; que el bloque principal las USA se lee del
//    AST, sin comentarios; y la pasada de verdad, con el corte provocado (`META_PRESUPUESTO_S`), está
//    en el registro con su salida.
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
    de: '    + `· sobre ${juzgadas} juzgadas de ${declaraciones} declaraciones, en ${declarantes} ficheros `',
    a: '    + `· ${juzgadas} juzgadas `',
    cae: 'SCRUM-1387d · ① la línea del recuento lleva su población PEGADA' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  })) console.log(linea);',
    a: '  })) void linea; // el rotulo del censo no se imprime, a proposito',
    cae: 'SCRUM-1387d · 🔴 el rótulo del censo sale en la pasada del CI, antes del bucle' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  console.log(`\\n${rotuloDelResultado({',
    a: '  void (`\\n${rotuloDelResultado({',
    cae: 'SCRUM-1387d · 🔴 el recuento final sale por `rotuloDelResultado`, y por ningún otro sitio' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: "  if (ciegos.length) console.error('🔴 CIEGO:\\n  · ' + ciegos.join('\\n  · '));",
    a: '  void 0; // las ciegas no se imprimen, a proposito',
    cae: 'SCRUM-1387d · el corte sale UNA vez, y antes del suelo de ejecución' },
];

// Las cifras del log del 27-oct, tal cual: es el caso que este tramo arregla.
const DEL_27_OCT = {
  vivas: 707, mudas: 0, ciegas: 1, muertos: 0, juzgadas: 707, declaraciones: 884,
  declarantes: 181, poblacion: 1532,
};

test('SCRUM-1387d · ① la línea del recuento lleva su población PEGADA', () => {
  const l = rotuloDelResultado(DEL_27_OCT);
  assert.equal(l.includes('\n'), false, '🔴 la población va en la MISMA línea: una línea se copia sola');
  // El principio no cambia: quien buscaba «vivas N · mudas N» lo sigue encontrando igual.
  assert.match(l, /^vivas 707 · mudas 0 · ciegas 1 · ficheros muertos 0 · /);
  assert.match(l, /sobre 707 juzgadas de 884 declaraciones/,
    '🔴 sin «de N declaraciones» un corte por tiempo se lee como «no hay más»');
  assert.match(l, /en 181 ficheros DECLARANTES de 1532 ficheros de test \(12 %\)$/,
    '🔴 sin los ficheros de test detrás, «vivas 707» suena a cobertura de todo el árbol');
});

test('SCRUM-1387d · ③ sale SIEMPRE, también con el 100 %', () => {
  const todo = rotuloDelResultado({
    vivas: 10, mudas: 0, ciegas: 0, muertos: 0, juzgadas: 10, declaraciones: 10,
    declarantes: 4, poblacion: 4,
  });
  assert.match(todo, /sobre 10 juzgadas de 10 declaraciones, en 4 ficheros DECLARANTES de 4 ficheros de test \(100 %\)$/);
  // Población cero: la línea se dice igual, sin dividir por cero (ese caso lo para antes SCRUM-812).
  assert.match(rotuloDelResultado({ ...DEL_27_OCT, declarantes: 0, poblacion: 0 }), /de 0 ficheros de test \(0 %\)$/);
});

/** El bloque principal: sus sentencias de primer nivel y su código SIN comentarios (A23 nº 2). */
function bloquePrincipal() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8');
  const sf = ts.createSourceFile('m.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const si = sf.statements.find((s) => ts.isIfStatement(s) && /ejecutadoDirectamente/.test(s.expression.getText(sf)));
  assert.ok(si && ts.isBlock(si.thenStatement), 'NO PUDE MIRAR: no encuentro el bloque `if (ejecutadoDirectamente(…))`');
  const imprimir = (n) => ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, n, sf);
  return { sentencias: si.thenStatement.statements, codigo: imprimir(si.thenStatement), imprimir };
}

test('SCRUM-1387d · 🔴 el rótulo del censo sale en la pasada del CI, antes del bucle', () => {
  const { sentencias, imprimir } = bloquePrincipal();
  const textos = sentencias.map(imprimir);
  // De PRIMER nivel: dentro del `if (soloCenso)` es justo donde estaba y el CI no lo veía.
  const rotulo = textos.findIndex((t) => /^for \(const linea of rotuloDelCenso\(/.test(t)
    && /\)\)\s*console\.log\(linea\);$/.test(t));
  const soloCenso = textos.findIndex((t) => /^if \(soloCenso\)/.test(t));
  const bucle = textos.findIndex((t) => /^bucle: for /.test(t));
  assert.ok(soloCenso > 0 && bucle > 0, 'NO PUDE MIRAR: no encuentro el `if (soloCenso)` o el bucle de mutaciones');
  assert.ok(rotulo >= 0, '🔴 el bloque principal ya no IMPRIME `rotuloDelCenso` fuera del `if (soloCenso)`: '
    + 'la pasada del CI vuelve a acabar sin decir su población');
  assert.ok(rotulo < soloCenso && rotulo < bucle, '🔴 el rótulo tiene que salir antes del modo censo y del bucle');
});

test('SCRUM-1387d · 🔴 el recuento final sale por `rotuloDelResultado`, y por ningún otro sitio', () => {
  const { codigo } = bloquePrincipal();
  const bucle = codigo.indexOf('await aplicarUna(mut, guard, limpia)');
  const suelo = codigo.indexOf('sueloDeEjecucion(');
  assert.ok(bucle > 0 && suelo > 0, 'NO PUDE MIRAR: no encuentro el bucle o el suelo de ejecución');
  const impreso = /console\.log\(`\\n\$\{rotuloDelResultado\(\{/.exec(codigo);
  assert.ok(impreso, '🔴 el bloque principal ya no imprime el recuento con `rotuloDelResultado`');
  assert.ok(impreso.index > bucle && impreso.index < suelo, '🔴 el recuento va tras el bucle y antes del veredicto');
  // Una segunda forma de escribir el recuento, a mano y sin población, es el defecto otra vez.
  assert.equal(/`[^`]*vivas \$\{/.test(codigo), false,
    '🔴 el bloque principal vuelve a escribir «vivas ${…}» a mano: ese recuento no lleva población');
});

test('SCRUM-1387d · el corte sale UNA vez, y antes del suelo de ejecución', () => {
  const { codigo } = bloquePrincipal();
  const msg = codigo.indexOf('mensajeDeCorte(');
  assert.ok(msg > 0, 'NO PUDE MIRAR: no encuentro `mensajeDeCorte(` en el bloque principal');
  // Medido el 27-oct: `console.log(msg)` + la lista de ciegas = el corte DOS veces en el log.
  assert.equal(/console\.(log|error)\([^)]*\bmsg\b/.test(codigo), false, '🔴 el corte se vuelve a imprimir suelto');
  const ciegas = codigo.indexOf("console.error('🔴 CIEGO:\\n  · ' + ciegos.join(");
  const suelo = codigo.indexOf('sueloDeEjecucion(');
  assert.ok(ciegas > msg, '🔴 las ciegas (y con ellas el corte) ya no se imprimen');
  // Un corte antes de la primera mutación sale por el suelo de ejecución: si la lista va detrás, no sale.
  assert.ok(ciegas < suelo, '🔴 las ciegas se imprimen después del suelo de ejecución: un corte temprano no diría qué dejó');
});
