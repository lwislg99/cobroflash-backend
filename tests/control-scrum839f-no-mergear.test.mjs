// CONTROL SCRUM-839f · NO MERGEAR. Este test falla SIEMPRE, a propósito: mantiene en rojo el check
// obligatorio del PR de control para que el auto-merge no pueda llevarlo nunca a `main`.
import test from 'node:test';
import assert from 'node:assert/strict';

test('CONTROL SCRUM-839f · este PR no se mergea nunca', () => {
  assert.fail('control SCRUM-839f: rojo a propósito; el PR se cierra sin mergear');
});
