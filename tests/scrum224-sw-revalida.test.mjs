// tests/scrum224-sw-revalida.test.mjs — SCRUM-224
//
// El camino NETWORK-FIRST del service worker NO puede volver a servir desde la caché HTTP del
// navegador sin revalidar. Con las cabeceras de prod (`max-age=14400`, que son SCRUM-231 y NO
// tocamos aquí), un `fetch(req)` a secas sirve el estático RANCIO hasta 4 h — el fix es
// `fetch(req, { cache: 'no-cache' })`, que revalida con If-None-Match (304 si no cambió).
//
// Test de COMPORTAMIENTO (no de fuente): ejecuta public/sw.js en un `vm` con self/caches/fetch
// mockeados, invoca el handler de fetch, y comprueba (1) que el estático se pide con
// { cache: 'no-cache' }, (2) que si la red FALLA cae a caches.match (offline intacto), y (3) que el
// handler de `message` devuelve el CACHE_NAME (instrumentación de SCRUM-224). SIN GATE: sin BD ni red.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW_SRC = fs.readFileSync(path.join(RAIZ, 'public', 'sw.js'), 'utf8');

// Ejecuta sw.js en un vm con los globals del navegador mockeados. `fetchImpl` decide qué hace la red;
// `cached` es lo que devuelve caches.match cuando la red falla. Devuelve los handlers y las llamadas a fetch.
function montarSW({ fetchImpl, cached } = {}) {
  const fetchCalls = [];
  const handlers = {};
  const self = {
    addEventListener: (t, f) => { handlers[t] = f; },
    location: { origin: 'https://yaqu.app' },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const caches = {
    open: async () => ({ addAll: async () => {}, put: async () => {} }),
    match: async () => cached,
    keys: async () => [],
    delete: async () => {},
  };
  const fetch = (req, opts) => { fetchCalls.push({ url: String(req.url), opts }); return fetchImpl(req, opts); };
  const ctx = { self, caches, fetch, URL, Response, Promise, console };
  vm.createContext(ctx);
  vm.runInContext(SW_SRC, ctx);
  return { handlers, fetchCalls };
}

// Invoca el handler de fetch con una petición y devuelve lo que RESUELVE respondWith.
async function pedir(handlers, url, method = 'GET') {
  let devuelto;
  handlers.fetch({ request: { url, method }, respondWith: (p) => { devuelto = p; } });
  return devuelto ? await devuelto : undefined;
}

test('SCRUM-224 · un estático se pide a la red REVALIDANDO ({ cache: "no-cache" })', async () => {
  const red = new Response('js NUEVO', { status: 200 });
  const { handlers, fetchCalls } = montarSW({ fetchImpl: async () => red });
  const resp = await pedir(handlers, 'https://yaqu.app/dashboard/js/invoicesView.js');
  assert.equal(resp, red, 'network-first devuelve la respuesta de RED cuando hay red');
  const est = fetchCalls.find((c) => c.url.endsWith('/dashboard/js/invoicesView.js'));
  assert.ok(est, 'se llamó a fetch para el estático');
  // Comparo el primitivo, no el objeto: `est.opts` nace en el realm del vm y deepStrictEqual
  // (node:assert/strict) choca por prototipo aunque el valor sea el mismo.
  assert.equal(est.opts && est.opts.cache, 'no-cache',
    '🔴 el fetch network-first tiene que REVALIDAR: sin { cache: "no-cache" } sirve la caché HTTP rancia hasta max-age');
});

test('SCRUM-224 · si la red FALLA, cae a caches.match (modo offline INTACTO)', async () => {
  const offline = new Response('js CACHEADO', { status: 200 });
  const { handlers } = montarSW({ fetchImpl: async () => { throw new Error('offline'); }, cached: offline });
  const resp = await pedir(handlers, 'https://yaqu.app/dashboard/js/invoicesView.js');
  assert.equal(resp, offline, '🔴 con la red caída tiene que servir lo cacheado — el offline no se toca');
});

test('SCRUM-224 · el handler `message` devuelve el CACHE_NAME (instrumentación de rancio)', async () => {
  const { handlers } = montarSW({ fetchImpl: async () => new Response('') });
  assert.ok(handlers.message, 'el SW registra un handler de `message`');
  let respondido;
  handlers.message({ data: { type: 'GET_CACHE_NAME' }, ports: [{ postMessage: (m) => { respondido = m; } }] });
  assert.equal(respondido && respondido.cacheName, 'yaqu-v4', 'responde el CACHE_NAME por el port del mensaje');
});
