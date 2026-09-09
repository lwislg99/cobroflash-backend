// CONTROL END-TO-END de SCRUM-834 — ESTE TEST FALLA A PROPÓSITO.
//
// No es un defecto ni un descuido: es el rojo provocado que exige el encargo para comprobar
// que el avisador despierta de verdad. «Un aparato cuya única prueba es que sus piezas
// funcionan no está probado: está montado.»
//
// Se comprueban DOS cosas por separado, porque son dos fallos distintos con arreglos
// opuestos: (a) que aparece el comentario del bot en el PR, y (b) que `claude.yml` ARRANCA a
// partir de ese comentario. Si (a) sí y (b) no, el problema es `allowed_bots`. Si (a) no, el
// problema está en el workflow del avisador.
//
// 🔴 ESTA RAMA Y ESTE FICHERO SE BORRAN al terminar el control. Si te lo encuentras en `main`,
// algo salió mal: bórralo.
import test from 'node:test';
import assert from 'node:assert/strict';

test('SCRUM-834 · rojo PROVOCADO para el control end-to-end del avisador', () => {
  assert.equal(
    'rojo-a-proposito',
    'verde',
    'Falla a propósito: control end-to-end de SCRUM-834. Esta rama se borra al acabar.',
  );
});
