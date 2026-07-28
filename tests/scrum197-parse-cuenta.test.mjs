// tests/scrum197-parse-cuenta.test.mjs — SCRUM-197
//
// `parseCuenta` es la función de la que cuelga TODA la distinción crash-vs-rojo del recibo: de sus
// contadores por hijo sale el `fail` PROPIO que separa un crash (fail=0) de un rojo (fail>0). Si
// mañana alguien la toca y deja de devolver ceros con salida truncada, un CRASH pasaría a leerse como
// ROJO y nadie se enteraría — el mismo defecto que este ticket cierra, un escalón más abajo: un dato
// del que depende una decisión, sin registrar. Aquí se fijan los casos que se probaron a mano.
//
// SIN GATE: función pura, no toca BD ni red ni disco.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, parseCuenta } from '../scripts/_parse-cuenta.mjs';

const suma = (c) => c.pass + c.fail + c.cancelled + c.skipped + c.todo; // la que compara REGLA B
const CEROS = Object.fromEntries(CATS.map((k) => [k, 0]));

test('SCRUM-197 · parseCuenta: sin resumen (vacía/null/undefined/solo-output) → ceros, suma cuadra, sin throw', () => {
  for (const salida of ['', null, undefined, 'not ok 1 - boom\nError: DLL init failed\n']) {
    let c;
    assert.doesNotThrow(() => { c = parseCuenta(salida); }, `parseCuenta no debe lanzar con ${JSON.stringify(salida)}`);
    assert.deepEqual(c, CEROS, `${JSON.stringify(salida)} → todo ceros`);
    assert.equal(suma(c), c.tests, 'ceros: la suma cuadra con tests (0 = 0), así REGLA B no aborta un crash limpio');
  }
});

test('SCRUM-197 · parseCuenta: crash sin llegar al resumen → fail=0 (se lee como CRASH, no como rojo)', () => {
  // El caso que sostiene el ticket: un hijo que crashea deja fail=0, así el validador lo clasifica
  // como CRASH (tanda incompleta) y no como rojo. Si esto dejara de dar 0, el crash se enmascararía.
  const c = parseCuenta('ok 1 - un test corrió\nok 2 - otro\n<el proceso muere aquí, sin resumen>');
  assert.equal(c.tests, 0, 'sin línea de resumen no hay `tests`');
  assert.equal(c.fail, 0, 'y sin `fail` → el validador lo lee como crash (exit≠0 + fail=0)');
});

test('SCRUM-197 · parseCuenta: resumen CORTADO → parcial con suma ≠ tests (dispara REGLA B)', () => {
  // La PRECONDICIÓN de la segunda capa: un resumen a medias no llega al recibo porque el runner
  // aborta (REGLA B) cuando la suma de categorías no cuadra con `tests`. Aquí se ancla ese disparo:
  // si parseCuenta devolviera algo que cuadrara, un desglose inconsistente llegaría al recibo.
  const c = parseCuenta('ℹ tests 64\r\nℹ pass 60\r\nℹ fai'); // cortado justo antes de `fail`
  assert.equal(c.tests, 64, 'las líneas completas sí se cuentan');
  assert.equal(c.pass, 60);
  assert.notEqual(suma(c), c.tests, '🔴 un resumen cortado tiene que dar suma≠tests — eso es lo que REGLA B caza');
});

test('SCRUM-197 · parseCuenta: resumen completo → cuenta exacta y suma cuadra', () => {
  const c = parseCuenta('ℹ tests 64\r\nℹ pass 63\r\nℹ fail 1\r\nℹ cancelled 0\r\nℹ skipped 0\r\nℹ todo 0\r\n');
  assert.deepEqual(c, { tests: 64, pass: 63, fail: 1, cancelled: 0, skipped: 0, todo: 0 });
  assert.equal(suma(c), c.tests, 'un resumen completo cuadra (pass+fail+… = tests)');
});
