// tests/scrum1647d-alta-sin-script-en-linea.test.mjs — SCRUM-1647d (CSP paso 2, tramo de J3: el alta)
//
// LA PÁGINA DE ALTA SIN CÓDIGO EN LÍNEA.
//
// Para que la CSP de SCRUM-1637 se pueda APLICAR (`script-src 'self'`, `style-src 'self'`),
// `register.html` no puede depender de un `<script>` sin `src` ni de `style=`. Medido sobre
// `origin/main` = `31858144e` (12-nov-2026): 1 `<script>` en línea y 2 `style="display:none"`. El
// guion pasó a `src/modules/auth/app/routes/altaNavegador.ts`, servido en `GET /auth/js/alta.js`.
// Los `on*=` de esta página ya los cuenta `scrum1647c` (A1), que la incluye.
//
// El COMPORTAMIENTO del alta (país → provincia y domicilio, envío, rechazo) lo mide
// `tests/scrum1685-formulario-de-alta.test.mjs`, que ejecuta ESTE guion en su banco.
//
//  A · el censo: 0 `<script>` sin `src`, carga /auth/js/alta.js, 0 `style=` y las dos cajas nacen
//      `hidden`. Con control SEMBRADO: el mismo contador sobre una página fabricada da >0.
//  B · la ruta: `GET /auth/js/alta.js` por el router real devuelve EXACTAMENTE la cadena, como JS,
//      y está declarada en el fail-closed de SCRUM-98.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { scriptsDeLaPagina, sinComentarios } from './_scripts-de-la-pagina.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const NAV = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'routes', 'altaNavegador.js');

/** Lo que tiene que tumbar cada caso (catálogo de `scripts/meta-guard-mutaciones.mjs`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/register.html',
    de: '<script src="/auth/js/alta.js"></script>',
    a: '<script>var x = 1;</script><script src="/auth/js/alta.js"></script>',
    cae: 'A1 · register.html: 0 <script> sin src',
  },
  {
    fichero: 'public/register.html',
    de: '<div id="ref-badge" class="trial-badge" hidden>',
    a: '<div id="ref-badge" class="trial-badge" style="display:none">',
    cae: 'A2 · register.html: 0 atributos style=',
  },
  {
    fichero: 'public/register.html',
    de: '<div id="alert" class="alert" role="alert" aria-live="assertive" hidden></div>',
    a: '<div id="alert" class="alert" role="alert" aria-live="assertive"></div>',
    cae: 'A2 · register.html: 0 atributos style=',
  },
  {
    fichero: 'src/modules/auth/app/routes/auth.routes.ts',
    de: 'router.get(RUTA_ALTA_JS,',
    a: "router.get('/js/otro.js',",
    cae: 'B1 · GET /auth/js/alta.js por el router real',
  },
  {
    fichero: 'src/core/http/publicAccessDeclarations.ts',
    de: "path: '/auth/js/alta.js'",
    a: "path: '/auth/js/otra.js'",
    cae: 'B2 · /auth/js/alta.js declarada',
  },
];

const estilos = (h) => (sinComentarios(h).match(/<[a-zA-Z][^>]*\sstyle\s*=/g) || []);

test('SCRUM-1647d · A0 · CONTROL SEMBRADO: los contadores ven un <script> en línea y un style= fabricados', () => {
  const fabricada = '<p>x</p><!-- <script>no</script> --><script>var a=1;</script><script src="/a.js"></script><div style="display:none"></div>';
  assert.equal(scriptsDeLaPagina(fabricada).inline, 1, '🔴 CIEGO: el extractor de la casa no ve el <script> en línea fabricado');
  assert.equal(estilos(fabricada).length, 1, '🔴 CIEGO: no ve un style= fabricado');
});

test('SCRUM-1647d · A1 · register.html: 0 <script> sin src, y carga el guion desde /auth/js/alta.js', () => {
  const html = leer('public', 'register.html');
  assert.ok(html.length > 3000, `🔴 CIEGO: register.html pesa ${html.length} B`);
  const s = scriptsDeLaPagina(html);
  assert.equal(s.inline, 0, '🔴 register.html lleva <script> en línea: con script-src \'self\' no corre y el alta no se envía');
  assert.ok(s.clasicos.includes('/auth/js/alta.js'), `🔴 register.html no carga /auth/js/alta.js (carga: ${JSON.stringify(s.clasicos)})`);
});

test('SCRUM-1647d · A2 · register.html: 0 atributos style= (con style-src \'self\' se ignoran: la insignia del amigo se vería a todos)', () => {
  const html = leer('public', 'register.html');
  assert.deepEqual(estilos(html), [], '🔴 register.html lleva style= en línea');
  assert.match(html, /<div id="ref-badge"[^>]*\shidden>/, '🔴 la insignia «Te ha invitado un amigo» ya no nace oculta');
  assert.match(html, /<div id="alert"[^>]*\shidden>/, '🔴 la caja de avisos ya no nace oculta');
});

test('SCRUM-1647d · A3 · el guion lleva el alta con invitación (SCRUM-1685) y la atribución', () => {
  const { ALTA_JS } = require(NAV);
  assert.ok(ALTA_JS.length > 3000, `🔴 CIEGO: el guion pesa ${ALTA_JS.length} B`);
  for (const pieza of ['function pintarCamposEs()', "fetch('/auth/register'", 'ref: refCode', 'source: acquisitionSource']) {
    assert.ok(ALTA_JS.includes(pieza), `🔴 al guion le falta «${pieza}»`);
  }
});

async function conRouter(fn) {
  const express = require('express');
  const router = require(path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'routes', 'auth.routes.js')).default;
  const app = express();
  app.use('/auth', router);
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  // `node:http` con `agent:false`, no `fetch` (SCRUM-1332).
  const pedir = (ruta) => new Promise((resolver, rechazar) => {
    const p = http.request({ host: '127.0.0.1', port, path: ruta, method: 'GET', agent: false }, (res) => {
      let cuerpo = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { cuerpo += c; });
      res.on('end', () => resolver({ status: res.statusCode, tipo: res.headers['content-type'] || '', cache: res.headers['cache-control'] || '', cuerpo }));
    });
    p.on('error', rechazar);
    p.end();
  });
  try { await fn(pedir); } finally { await new Promise((r) => srv.close(r)); }
}

test('SCRUM-1647d · B1 · GET /auth/js/alta.js por el router real devuelve el guion como JS', async () => {
  const { ALTA_JS } = require(NAV);
  await conRouter(async (pedir) => {
    const res = await pedir('/auth/js/alta.js');
    assert.equal(res.status, 200);
    assert.match(res.tipo, /javascript/);
    assert.equal(res.cache, 'no-cache');
    assert.equal(res.cuerpo, ALTA_JS, '🔴 la ruta no sirve la cadena del guion');
    const otra = await pedir('/auth/js/no-existe.js');
    assert.equal(otra.status, 404, '🔴 CIEGO: el router contesta 200 a cualquier ruta');
  });
});

test('SCRUM-1647d · B2 · /auth/js/alta.js declarada como no-sensitive-resource (fail-closed de SCRUM-98)', () => {
  const fuente = leer('src', 'core', 'http', 'publicAccessDeclarations.ts');
  const linea = fuente.split('\n').find((l) => l.includes("path: '/auth/js/alta.js'"));
  assert.ok(linea, '🔴 GET /auth/js/alta.js no está declarada');
  assert.match(linea, /method: 'GET'.*kind: 'no-sensitive-resource'/, `🔴 la declaración no es GET no-sensitive-resource: ${linea}`);
});
