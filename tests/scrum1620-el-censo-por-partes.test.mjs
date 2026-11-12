// tests/scrum1620-el-censo-por-partes.test.mjs — SCRUM-1620 · S3
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL META-GUARD YA NO CABÍA EN SU JOB: SE REPARTE, Y ENTRE TODAS LAS PARTES, EL CENSO ENTERO
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Medido el 27-oct-2026 (`docs/master/SCRUM-1620.md`): el rojo de `77ce98573` se cortó con 177 de 884
// mutaciones sin juzgar, y el único verde del día gastó 1667 s de un presupuesto de 1695. El coste es
// una cola larga y el runner lento tarda un 60 % más: abaratar un guard no da margen. Con tres partes
// por turno, la peor queda en 626 s (1002 s en un runner lento) contra los mismos 1695.
//
// Lo que se exige aquí:
//   ① las partes, juntas, son el censo ENTERO, sin repetir ni perder un guard;
//   ② una `META_PARTE` que no se entiende es CIEGO, no «el censo entero»;
//   ③ cada parte dice qué parte es y qué deja a las otras, y su recuento no se lee como un corte;
//   ④ el corte se avisa como lo que es («NO CABE»), no como un rojo más;
//   ⑤ el veredicto de las partes se junta en UNO, con el código peor, y una parte que no dejó
//      resumen NO es una parte verde: es CIEGO;
//   ⑥ el bloque principal USA todo lo de arriba (leído del AST, sin comentarios).
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 La pasada entera NO se corre aquí (movería el árbol bajo los demás tests, como en `scrum935d`).
//    Las piezas son puras; la pasada de verdad por partes, con su salida, está en el registro.
// 🔴 La matriz de `ci.yml` es de S5: este fichero no la exige. Sin ella, el CI corre el censo entero
//    en un solo job, igual que antes de este ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  parteDelEntorno, parteDelCenso, rotuloDeLaParte, rotuloDelResultado, avisoDeNoCabe,
  veredictoDeLasPartes, SALIDA_MUDO, SALIDA_CIEGO,
} from '../scripts/meta-guard-mutaciones.mjs';
import { SALIDA_NO_RESTAURADO } from '../scripts/_marca-de-arbol.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return censo.filter((_, n) => n % parte.k === parte.i - 1);',
    a: '  return censo.filter((_, n) => n % parte.k === parte.i);',
    cae: 'SCRUM-1620 · ① las partes, juntas, son el censo ENTERO, sin repetir ni perder un guard' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (!m || !(k >= 1) || !(i >= 1) || i > k) {',
    a: '  if (!m || !(k >= 1) || !(i >= 1)) {',
    cae: 'SCRUM-1620 · ② una META_PARTE que no se entiende es CIEGO, no «el censo entero»' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (env.GITHUB_ACTIONS !== \'true\' || !sinJuzgar) return null;',
    a: '  return null;',
    cae: 'SCRUM-1620 · ④ el corte se avisa como lo que es: NO CABE' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    if (!r || !Number.isInteger(r.codigo)) {',
    a: '    if (!r) {',
    cae: 'SCRUM-1620 · ⑤ una parte que no dejó resumen NO es una parte verde: es CIEGO' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  bucle: for (const [guardIdx, { guard, mutaciones, incompletas }] of enJuego.entries()) {',
    a: '  bucle: for (const [guardIdx, { guard, mutaciones, incompletas }] of censo.entries()) {',
    cae: 'SCRUM-1620 · ⑥ el bloque principal juzga SU parte y dice cuál es' },
];

/** Un censo de juguete: `n` guards con 1-3 mutaciones, alguno sin ninguna (sólo incompletas). */
function censoDe(n) {
  return Array.from({ length: n }, (_, x) => ({
    guard: `g${String(x).padStart(3, '0')}.test.mjs`,
    mutaciones: x % 7 === 3 ? [] : Array.from({ length: 1 + (x % 3) }, () => ({})),
    incompletas: [],
  }));
}

test('SCRUM-1620 · ① las partes, juntas, son el censo ENTERO, sin repetir ni perder un guard', () => {
  for (const n of [0, 1, 2, 5, 222, 223]) {
    const censo = censoDe(n);
    for (let k = 1; k <= 5; k++) {
      const partes = Array.from({ length: k }, (_, i) => parteDelCenso(censo, { i: i + 1, k }));
      const juntos = partes.flat().map((c) => c.guard).sort();
      assert.deepEqual(juntos, censo.map((c) => c.guard).sort(),
        `🔴 n=${n} K=${k}: las ${k} partes no suman el censo — un guard se juzga dos veces o no se juzga`);
      const tam = partes.map((p) => p.length);
      assert.ok(Math.max(...tam) - Math.min(...tam) <= 1, `🔴 n=${n} K=${k}: partes desiguales ${tam.join('/')}`);
      // En su orden: el coste por guard del log se sigue leyendo igual.
      for (const p of partes) assert.deepEqual(p, censo.filter((c) => p.includes(c)));
    }
  }
  // 🔴 CONTROL POSITIVO: sin parte, el censo ENTERO, el mismo objeto.
  const censo = censoDe(9);
  assert.equal(parteDelCenso(censo, null), censo, '🔴 sin META_PARTE tiene que juzgar el censo entero');
});

test('SCRUM-1620 · ② una META_PARTE que no se entiende es CIEGO, no «el censo entero»', () => {
  assert.deepEqual(parteDelEntorno({}), { parte: null });
  assert.deepEqual(parteDelEntorno({ META_PARTE: '' }), { parte: null });
  assert.deepEqual(parteDelEntorno({ META_PARTE: '2/3' }), { parte: { i: 2, k: 3 } });
  assert.deepEqual(parteDelEntorno({ META_PARTE: ' 3/3 ' }), { parte: { i: 3, k: 3 } });
  for (const malo of ['4/3', '0/3', '2/0', '3', 'a/b', '1/3/5', '-1/3', '1.5/3']) {
    const r = parteDelEntorno({ META_PARTE: malo });
    assert.equal(r.parte, undefined, `🔴 «${malo}» se aceptó como parte`);
    assert.match(r.error, /META_PARTE ilegible/, `🔴 «${malo}» no se dice ilegible`);
  }
});

test('SCRUM-1620 · ③ cada parte dice qué parte es, y su recuento no se lee como un corte', () => {
  const l = rotuloDeLaParte({ parte: { i: 2, k: 3 }, guards: 74, declaraciones: 295, guardsDelCenso: 222, declaracionesDelCenso: 886 });
  assert.match(l, /^parte 2 de 3: 74 de los 222 guards y 295 de las 886 declaraciones del censo/);
  assert.match(l, /el resto lo juzgan las otras 2 partes, cada una en su job$/);
  assert.match(rotuloDeLaParte({ parte: { i: 1, k: 2 }, guards: 1, declaraciones: 1, guardsDelCenso: 2, declaracionesDelCenso: 2 }),
    /el resto lo juzga la otra parte, cada una en su job$/);
  assert.match(rotuloDeLaParte({ parte: null, guardsDelCenso: 222, declaracionesDelCenso: 886 }),
    /^parte ÚNICA: el censo entero, 222 guards y 886 declaraciones$/);
  // El recuento de una parte: «295 de 295» de la PARTE, y el censo entero detrás.
  const base = { vivas: 295, mudas: 0, ciegas: 0, muertos: 0, juzgadas: 295, declaraciones: 295, declarantes: 74, poblacion: 1532 };
  const r = rotuloDelResultado({ ...base, parte: { i: 2, k: 3 }, declaracionesDelCenso: 886 });
  assert.match(r, /sobre 295 juzgadas de 295 declaraciones/);
  assert.match(r, / · PARTE 2 de 3 \(el censo entero: 886 declaraciones\)$/,
    '🔴 sin la parte detrás, «295 de 295» no dice que hay otras 591 en otros jobs');
  // Sin parte, la línea de SCRUM-1387d tal cual (su test lo exige también).
  assert.match(rotuloDelResultado(base), /\(5 %\)$/);
});

test('SCRUM-1620 · ④ el corte se avisa como lo que es: NO CABE', () => {
  const caso = { juzgadas: 707, sinJuzgar: 177, parte: { i: 1, k: 3 }, presupuesto: { limiteS: 1695 } };
  const a = avisoDeNoCabe(caso, { GITHUB_ACTIONS: 'true' });
  assert.match(a, /^::warning title=meta-guard · NO CABE en su presupuesto::/);
  assert.match(a, /la parte 1 de 3: juzgadas 707, SIN JUZGAR 177, en 1695 s/);
  assert.match(a, /No se sube el techo ni se saca una mutación/);
  assert.equal(a.includes('\n'), false, '🔴 una anotación de GitHub es UNA línea');
  // El vigía de main (J6) lee el código de salida de la anotación «Process completed with exit code N»:
  // la mía no puede parecerse, o le cambio la lectura del 2.
  assert.doesNotMatch(a, /Process completed with exit code/);
  assert.match(avisoDeNoCabe({ ...caso, parte: null }, { GITHUB_ACTIONS: 'true' }), /el censo entero: juzgadas 707/);
  assert.equal(avisoDeNoCabe(caso, {}), null, 'fuera de CI no hay anotaciones');
  // 🔴 CONTROL NEGATIVO: sin nada sin juzgar no hay aviso, también en CI.
  assert.equal(avisoDeNoCabe({ ...caso, sinJuzgar: 0 }, { GITHUB_ACTIONS: 'true' }), null);
});

const parte = (i, codigo, juzgadas, declaraciones, extra = {}) => ({
  parte: `${i}/3`, codigo, juzgadas, declaraciones, declaracionesDelCenso: 886, segundos: 600, presupuestoS: 1695, ...extra,
});

test('SCRUM-1620 · ⑤ el veredicto de las partes se junta en UNO, con el código peor', () => {
  const verdes = [parte(1, 0, 296, 296), parte(2, 0, 295, 295), parte(3, 0, 295, 295, { segundos: 640 })];
  const v = veredictoDeLasPartes(verdes, 3);
  assert.equal(v.codigo, 0);
  assert.match(v.lineas.join('\n'), /censo por partes: juzgadas 886 de 886 declaraciones, en 3 partes/);
  assert.match(v.lineas.join('\n'), /margen de la parte más lenta: 1055 s \(parte 3, 640 s de 1695\)/,
    '🔴 el margen se declara con un NÚMERO, leído de la propia salida');
  const con = (i, c) => veredictoDeLasPartes(verdes.map((p, n) => (n === i ? { ...p, codigo: c } : p)), 3).codigo;
  assert.equal(con(1, SALIDA_CIEGO), SALIDA_CIEGO);
  assert.equal(con(1, SALIDA_MUDO), SALIDA_MUDO);
  assert.equal(veredictoDeLasPartes([{ ...verdes[0], codigo: SALIDA_CIEGO }, { ...verdes[1], codigo: SALIDA_MUDO }, verdes[2]], 3).codigo,
    SALIDA_MUDO, '🔴 un MUDO es una acusación: no lo tapa un CIEGO de otra parte');
  assert.equal(veredictoDeLasPartes([{ ...verdes[0], codigo: SALIDA_MUDO }, verdes[1], { ...verdes[2], codigo: SALIDA_NO_RESTAURADO }], 3).codigo,
    SALIDA_NO_RESTAURADO, '🔴 un árbol sin restaurar manda sobre todo');
  // Un código que no es de este instrumento (un `node` que revienta sale con 1 o con 13) no es un veredicto.
  assert.equal(con(0, 13), SALIDA_CIEGO);
});

test('SCRUM-1620 · ⑤ una parte que no dejó resumen NO es una parte verde: es CIEGO', () => {
  const dos = [parte(1, 0, 296, 296), parte(2, 0, 295, 295)];
  const v = veredictoDeLasPartes([...dos, null], 3);
  assert.equal(v.codigo, SALIDA_CIEGO, '🔴 una parte cancelada o sin arrancar se leería como verde');
  assert.match(v.lineas.join('\n'), /parte 3 de 3: NO DEJÓ RESUMEN/);
  // Un resumen sin código (la parte murió antes de escribirlo entero) es lo mismo que ninguno, y se
  // DICE así: no «salió con undefined» sumando NaN juzgadas.
  const sinCodigo = veredictoDeLasPartes([...dos, { parte: '3/3' }], 3);
  assert.equal(sinCodigo.codigo, SALIDA_CIEGO, '🔴 un resumen sin código');
  assert.match(sinCodigo.lineas.join('\n'), /parte 3 de 3: NO DEJÓ RESUMEN/);
  assert.match(sinCodigo.lineas.join('\n'), /juzgadas 591 de 886/, '🔴 lo que no dejó código no suma');
  // Las partes no suman el censo: alguien ha perdido guards por el camino.
  const corto = veredictoDeLasPartes([...dos, parte(3, 0, 200, 200)], 3);
  assert.equal(corto.codigo, SALIDA_CIEGO);
  assert.match(corto.lineas.join('\n'), /las partes suman 791 declaraciones y el censo tiene 886/);
  // Una parte con el corte dentro: juzgó menos de las suyas.
  const cortada = veredictoDeLasPartes([...dos, parte(3, SALIDA_CIEGO, 150, 295)], 3);
  assert.match(cortada.lineas.join('\n'), /censo por partes: juzgadas 741 de 886 declaraciones/);
  // 🔴 CONTROL NEGATIVO: sin partes no hay verde.
  assert.equal(veredictoDeLasPartes([], 3).codigo, SALIDA_CIEGO);
});

/** El bloque principal: sus sentencias de primer nivel y su código SIN comentarios (A23 nº 2). */
function bloquePrincipal() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8');
  const sf = ts.createSourceFile('m.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const si = sf.statements.find((s) => ts.isIfStatement(s) && /ejecutadoDirectamente/.test(s.expression.getText(sf)));
  assert.ok(si && ts.isBlock(si.thenStatement), 'NO PUDE MIRAR: no encuentro el bloque `if (ejecutadoDirectamente(…))`');
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, si.thenStatement, sf);
}

test('SCRUM-1620 · ⑥ el bloque principal juzga SU parte y dice cuál es', () => {
  const codigo = bloquePrincipal();
  const bucle = /bucle: for \(const \[guardIdx, \{ guard, mutaciones, incompletas \}\] of (\w+)\.entries\(\)\)/.exec(codigo);
  assert.ok(bucle, 'NO PUDE MIRAR: no encuentro el bucle de mutaciones');
  assert.equal(bucle[1], 'enJuego', '🔴 el bucle recorre el censo ENTERO: cada parte juzgaría todo y volvería a cortarse');
  assert.match(codigo, /const enJuego = parteDelCenso\(censo, parte\);/);
  assert.match(codigo, /parteDelEntorno\(process\.env\)/);
  assert.match(codigo, /pendientesDesde\(enJuego, /, '🔴 lo pendiente del corte se cuenta sobre OTRO censo que el juzgado');
  // Los suelos del censo, sobre el censo ENTERO y ANTES de repartir.
  const suelo = codigo.indexOf('sueloDelCenso(');
  const reparto = codigo.indexOf('parteDelCenso(censo, parte)');
  assert.ok(suelo > 0 && reparto > suelo, '🔴 el suelo del censo tiene que mirar el censo entero, antes de repartir');
  // La parte ilegible sale CIEGO, antes de tocar el árbol.
  assert.match(codigo, /if \(leida\.error\) \{\s*console\.error\(`🔴 CIEGO · \$\{leida\.error\}`\);\s*process\.exit\(SALIDA_CIEGO\);/);
  assert.ok(codigo.indexOf('leida.error') < codigo.indexOf('await aplicarUna('), '🔴 la parte se valida antes de mutar');
  // El aviso NO CABE sale con el corte, y el resumen para juntar las partes, al salir.
  assert.match(codigo, /avisoDeNoCabe\(/);
  assert.match(codigo, /process\.on\('exit', /);
  assert.match(codigo, /process\.argv\.includes\('--juntar'\)/);
});
