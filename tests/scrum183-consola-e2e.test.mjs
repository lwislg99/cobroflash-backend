import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esErrorRelevante, resumirErroresConsola, CONSOLA_ALLOWLIST } from '../scripts/_console-guard.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const e2e = fs.readFileSync(path.join(raiz, 'scripts', 'e2e-critico.mjs'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/**
 * SCRUM-183 — que un error de JS en la PÁGINA rompa el E2E.
 *
 * La decisión (qué cuenta como fallo) vive en `_console-guard.mjs` y se prueba aquí SIN navegador
 * ni BD; el cableado en el E2E se comprueba leyéndolo. Es la única forma de tener este guard
 * probado en rojo sin depender de Edge + staging.
 */

test('SCRUM-183: un ReferenceError de la página cuenta como fallo', () => {
  // El caso real: SCRUM-139 F6 lanzaba esto y el E2E ni se enteraba.
  assert.equal(esErrorRelevante({ tipo: 'error', texto: "ReferenceError: Cannot access 'plantillasRotulo' before initialization" }), true);
});

test('SCRUM-183: los warnings NO rompen el E2E', () => {
  // Convertir los avisos en fallo entrena a ignorar el guard entero, que es como mueren.
  assert.equal(esErrorRelevante({ tipo: 'warning', texto: 'algo deprecado' }), false);
  assert.equal(esErrorRelevante({ tipo: 'log', texto: 'ReferenceError en un log' }), false);
});

test('SCRUM-183: la allowlist es VISIBLE y cada excepción lleva su motivo', () => {
  // Regla de la casa: excepciones declaradas, nunca silenciosas.
  assert.ok(Array.isArray(CONSOLA_ALLOWLIST));
  for (const e of CONSOLA_ALLOWLIST) {
    assert.ok(e.patron instanceof RegExp, 'cada entrada de la allowlist necesita su patrón');
    assert.ok(typeof e.porque === 'string' && e.porque.length > 10, `la excepción ${e.patron} no explica por qué se tolera`);
  }
  assert.equal(esErrorRelevante({ tipo: 'error', texto: 'GET /favicon.ico 404' }), false, 'el ruido declarado no rompe el E2E');
});

test('SCRUM-183: el informe dice QUÉ se rompió y DÓNDE', () => {
  const r = resumirErroresConsola([
    { tipo: 'error', texto: 'ReferenceError: x', donde: 'http://127.0.0.1:3457/dashboard' },
    { tipo: 'error', texto: 'GET /favicon.ico 404' },
    { tipo: 'warning', texto: 'ruido' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.relevantes.length, 1, 'solo el error real, sin el ruido declarado ni los warnings');
  assert.match(r.informe, /ReferenceError: x/);
  assert.match(r.informe, /dashboard/, 'el informe debe decir en qué pantalla pasó');
});

test('SCRUM-183: sin errores, el E2E sigue verde', () => {
  const r = resumirErroresConsola([{ tipo: 'warning', texto: 'x' }, { tipo: 'error', texto: 'favicon.ico' }]);
  assert.equal(r.ok, true);
  assert.equal(r.informe, '');
});

test('SCRUM-183: entradas basura no rompen el guard', () => {
  for (const basura of [null, undefined, 'texto', 42, {}, { tipo: 'error' }, { tipo: 'error', texto: '   ' }]) {
    assert.equal(esErrorRelevante(basura), false, `entrada ${JSON.stringify(basura)} no debe contar como fallo`);
  }
  assert.equal(resumirErroresConsola(null).ok, true);
});

test('SCRUM-183: el E2E ESCUCHA la consola y comprueba al final', () => {
  // Sin esto, el guard existe y no está enchufado — que es exactamente el fallo que arregla.
  assert.match(e2e, /page\.on\('pageerror'/, 'el E2E deja de escuchar los errores no capturados de la página');
  assert.match(e2e, /page\.on\('console'/, 'el E2E deja de escuchar console.error');
  assert.match(e2e, /resumirErroresConsola\(erroresConsola\)/, 'el E2E recoge los errores pero ya no los comprueba');
  assert.match(e2e, /if \(!consola\.ok\) fail\(/, 'el E2E ve los errores y NO falla: peor que no mirarlos');
});
