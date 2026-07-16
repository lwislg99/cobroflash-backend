// SCRUM-45 — BUILD_ID del build corriendo (GET /version + /health unificado).
// El poll del dashboard compara este id para avisar "hay versión nueva" tras un deploy.
import test from 'node:test';
import assert from 'node:assert/strict';

// La config es un singleton que lee el entorno AL IMPORTAR: fijamos la var antes.
// (node --test aísla cada archivo en su propio proceso — no contamina otros tests.)
process.env.RAILWAY_GIT_COMMIT_SHA = 'abc1234deadbeef';
const { config } = await import('../dist/core/config/env.js');

test('BUILD_ID toma RAILWAY_GIT_COMMIT_SHA cuando Railway la inyecta', () => {
  assert.equal(config.BUILD_ID, 'abc1234deadbeef');
});

test('BUILD_ID nunca es vacío (fallback dev = timestamp de arranque)', () => {
  assert.ok(typeof config.BUILD_ID === 'string' && config.BUILD_ID.length > 0);
});
