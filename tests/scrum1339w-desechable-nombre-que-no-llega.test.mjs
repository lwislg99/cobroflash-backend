// tests/scrum1339w-desechable-nombre-que-no-llega.test.mjs — SCRUM-1339w · DESECHABLE, NO SE MERGEA
//
// Propuesta de S5 en SCRUM-1339 c.20506: ver por EFECTO que «build + tests» cae cuando un nombre
// declarado no llega al TAP. Este fichero declara un test con nombre literal que no se ejecuta
// nunca: la señal de nombres tiene que contarlo ausente y salir 1. Va en una rama sin prefijo
// `scrum-` y en un PR borrador que se cierra sin mergear.
import test from 'node:test';
import assert from 'node:assert/strict';

if (process.env.SCRUM_1339W_NUNCA === 'si') {
  test('SCRUM-1339w desechable: este nombre no llega nunca al TAP', () => { assert.ok(true); });
}
