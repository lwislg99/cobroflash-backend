// SCRUM-1380 · EL SUELO DISTINGUE «CORRIÓ Y NO REPORTÓ» DE «NO TIENE TESTS»
//
// Hijo de SCRUM-1366. El 1-oct-2026 `tests/scrum237-negacion-respaldada.test.mjs` perdió su informe en
// tres de seis corridas del CI: el fichero corre entero y el runner no registra sus 8 tests. El suelo
// acertaba (rojo) y mandaba a mirar un `import` roto en una rama que no tenía nada que ver.
//
// Lo que se fija aquí: el veredicto NO se afloja (sigue rojo, misma salida), y el mensaje cambia según
// el `duration_ms` de la entrada de fichero, que es el único dato del TAP que separa los dos casos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  veredictoDelSuelo, duracionesDeLosMudos, ficherosMudosDelTap, MS_DE_HABER_CORRIDO, SALIDA_POR_DEBAJO,
} from '../scripts/_suelo-de-la-tanda.mjs';

// El tramo REAL del TAP de #2090 (run 36863578275, intento 1), líneas 14846-14853, tal cual salió.
const REAL = [
  '# Subtest: tests/scrum237-negacion-respaldada.test.mjs',
  'ok 352 - tests/scrum237-negacion-respaldada.test.mjs',
  '  ---',
  '  duration_ms: 2242.928986',
  "  type: 'test'",
  '  ...',
  '# Subtest: SCRUM-238: package.json DECLARA el postinstall',
  'ok 2375 - SCRUM-238: package.json DECLARA el postinstall',
  '  ---',
  '  duration_ms: 0.5',
  "  type: 'test'",
  '  ...',
].join('\n');

const tap = (cuerpo, total = 9763) => `TAP version 13\n${cuerpo}\n1..${total}\n# tests ${total}\n# pass ${total}\n# fail 0\n`;
const entrada = (fichero, yaml) => [`# Subtest: ${fichero}`, `ok 7 - ${fichero}`, ...yaml].join('\n');
const VACIO = entrada('tests/vacio.test.mjs', ['  ---', '  duration_ms: 56.2629', "  type: 'test'", '  ...']);

test('SCRUM-1380 · SUELO: el lector saca la duración de la entrada de FICHERO, no la del test de al lado', () => {
  assert.deepEqual(duracionesDeLosMudos(REAL), [{ fichero: 'tests/scrum237-negacion-respaldada.test.mjs', ms: 2242.928986 }]);
  // Misma población que el detector que ya había: si uno ve un mudo y el otro no, el mensaje miente.
  assert.deepEqual(duracionesDeLosMudos(REAL).map((d) => d.fichero), ficherosMudosDelTap(REAL));
});

test('SCRUM-1380 · 🔴 el caso real de #2090: sigue ROJO, y dice que CORRIÓ 2,2 s y no reportó, y que no es la rama', () => {
  const v = veredictoDelSuelo(tap(REAL), 1, null);
  assert.equal(v.ok, false);
  assert.equal(v.salida, SALIDA_POR_DEBAJO, '🔴 el veredicto se ha aflojado: distinguir el mensaje no es dejar pasar');
  assert.match(v.titulo, /1 FICHERO\(S\) DE TEST NO REGISTRARON NI UN TEST: tests\/scrum237-negacion-respaldada\.test\.mjs\./);
  assert.match(v.titulo, /1 de ellos CORRIÓ Y NO REPORTÓ \(no es la rama: SCRUM-1366\)/);
  assert.match(v.detalle, /tests\/scrum237-negacion-respaldada\.test\.mjs corrió 2,2 s y el runner no registró ninguno de sus tests/);
  assert.match(v.detalle, /NO es tu rama/);
  assert.match(v.detalle, /causa SIN diagnosticar/, 'el mensaje no puede dar por sabido por qué se pierde el informe');
});

test('SCRUM-1380 · NEGATIVO: un fichero que carga en milésimas y no registra nada conserva el mensaje de siempre', () => {
  const v = veredictoDelSuelo(tap(VACIO), 1, null);
  assert.equal(v.salida, SALIDA_POR_DEBAJO);
  assert.doesNotMatch(`${v.titulo}\n${v.detalle}`, /CORRIÓ|SCRUM-1366|NO es tu rama/, '🔴 se absuelve a una rama que SÍ ha dejado un fichero sin tests');
  assert.match(v.detalle, /un `import \* as X` cuya propiedad ya no existe/);
});

test(`SCRUM-1380 · el corte es ${MS_DE_HABER_CORRIDO} ms: justo por debajo no se llama «corrió», y en el corte sí`, () => {
  const con = (ms) => veredictoDelSuelo(tap(entrada('tests/x.test.mjs', ['  ---', `  duration_ms: ${ms}`, '  ...'])), 1, null);
  assert.doesNotMatch(con(MS_DE_HABER_CORRIDO - 1).titulo, /CORRIÓ/);
  assert.match(con(MS_DE_HABER_CORRIDO).titulo, /CORRIÓ/);
});

test('SCRUM-1380 · 🔴 sin `duration_ms` NO se clasifica: se dice que no se supo, y no se absuelve a la rama', () => {
  for (const yaml of [[], ['  ---', "  type: 'test'", '  ...'], ['  ---', '  duration_ms: muchos', '  ...']]) {
    const t = tap(entrada('tests/x.test.mjs', yaml));
    assert.deepEqual(duracionesDeLosMudos(t), [{ fichero: 'tests/x.test.mjs', ms: null }]);
    const v = veredictoDelSuelo(t, 1, null);
    assert.equal(v.salida, SALIDA_POR_DEBAJO);
    assert.match(v.detalle, /NO SUPE cuánto corrió tests\/x\.test\.mjs/);
    assert.doesNotMatch(`${v.titulo}\n${v.detalle}`, /NO es tu rama/);
  }
});

test('SCRUM-1380 · dos mudos de distinta clase: se nombra SÓLO al que corrió, y el otro sigue con su aviso', () => {
  const v = veredictoDelSuelo(tap(`${REAL}\n${VACIO}`), 1, null);
  assert.match(v.titulo, /2 FICHERO\(S\) DE TEST NO REGISTRARON NI UN TEST/);
  assert.match(v.detalle, /EN 1 DE 2, ESTO NO ES UN FICHERO SIN TESTS/);
  assert.match(v.detalle, /scrum237-negacion-respaldada\.test\.mjs corrió 2,2 s/);
  assert.doesNotMatch(v.detalle, /vacio\.test\.mjs corrió/);
  assert.match(v.detalle, /un fichero vaciado a medias/, 'el aviso de siempre tiene que seguir: uno de los dos SÍ puede ser la rama');
});
