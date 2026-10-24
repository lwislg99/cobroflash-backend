// CONTROL de SCRUM-1498c: este test cae A PROPÓSITO. Vive sólo en la rama `control-1498c-cae`,
// en un PR en borrador que se cierra sin mergear. Comprueba que, con la concurrencia por job,
// `build + tests` sigue dando `failure` cuando un test cae. Si esto llega a `main`, es un defecto.
import test from 'node:test';
import assert from 'node:assert/strict';

test('SCRUM-1498c · CONTROL: un test que cae tiene que poner build + tests en rojo', () => {
  assert.fail('caída a propósito (control de SCRUM-1498c)');
});
