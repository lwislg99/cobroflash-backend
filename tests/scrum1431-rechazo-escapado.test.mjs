// tests/scrum1431-rechazo-escapado.test.mjs — SCRUM-1431
//
// 🔴 EL ERROR DEL RECHAZO, EN LA PÁGINA PÚBLICA, SALE ESCAPADO.
//
// `POST /pay/quote/:token/reject` pintaba `json.message || json.error` dentro del HTML tal cual.
// Hoy todo lo que la API contesta ahí son literales nuestros; pero el mensaje del 409 lleva el
// nombre del negocio, y lo único que impedía que llegara sin escapar era una redirección.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El handler REAL de `dist/`, con la base doblada y `node-fetch` doblado: hace de la API de
// decisión y contesta lo que el caso declara. No sale nada a la red.
// ⚠️ El mensaje con marcado NO lo produce hoy la API: se fabrica aquí. Lo que se mide es la página.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';

const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const requiere = createRequire(import.meta.url);

async function rechazar(respuestaDeLaApi) {
  const fFetch = requiere.resolve('node-fetch');
  const pedidas = [];
  requiere.cache[fFetch] = {
    id: fFetch, filename: fFetch, loaded: true,
    exports: async (url) => { pedidas.push(String(url)); return respuestaDeLaApi; },
  };
  inyectarBase({ 'quote.findUnique': () => ({ id: 9, quoteNumber: 1, merchant: { country: 'ES' } }) }, [LANDING]);
  const router = moduloDeDist(LANDING).quoteDecisionLandingRouter;
  const capa = router.stack.find((l) => l.route && l.route.path === '/quote/:token/reject' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no encuentro POST /quote/:token/reject');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, html: '', redirigido: null };
  const res = {
    status(s) { r.status = s; return res; },
    setHeader() { return res; },
    send(b) { r.html = String(b); return res; },
    redirect(_c, a) { r.redirigido = a; return res; },
  };
  await h({ params: { token: 'a'.repeat(32) }, body: { reason: 'price' }, headers: {} }, res);
  assert.equal(pedidas.length, 1, '🔴 CIEGO: el handler no ha llamado a la API de decisión');
  return r;
}

const fallo = (cuerpo, status = 400) => ({ ok: false, status, json: async () => cuerpo });

test('SCRUM-1431 · SUELO: un mensaje de texto llano se pinta tal cual, bajo el titular', async () => {
  const r = await rechazar(fallo({ error: 'quote_expired', message: 'Este presupuesto caducó.' }, 410));
  assert.equal(r.status, 400);
  assert.ok(r.html.includes('No se pudo registrar el rechazo.'), '🔴 CIEGO: no es la página de error del rechazo');
  assert.ok(r.html.includes('Este presupuesto caducó.'));
});

test('SCRUM-1431 · 🔴 un `message` con marcado sale ESCAPADO', async () => {
  const r = await rechazar(fallo({ error: 'x', message: 'Reformas <b>Pérez</b> & Hijos' }));
  assert.ok(r.html.includes('Reformas &lt;b&gt;Pérez&lt;/b&gt; &amp; Hijos'), '🔴 el mensaje no sale escapado');
  // Con hueco para atributos (SCRUM-553): una etiqueta con el `>` pegado no vería `<b class="x">`.
  assert.ok(!/<b[^>]*>Pérez/.test(r.html), '🔴 el marcado del mensaje ha entrado en la página');
});

test('SCRUM-1431 · 🔴 sin `message`, el `error` también sale ESCAPADO', async () => {
  const r = await rechazar(fallo({ error: 'a<i>b</i>' }));
  assert.ok(r.html.includes('a&lt;i&gt;b&lt;/i&gt;'));
  assert.ok(!/<i[^>]*>b/.test(r.html));
});

test('SCRUM-1431 · una respuesta que no es JSON no rompe la página: titular solo', async () => {
  const r = await rechazar({ ok: false, status: 502, json: async () => { throw new Error('no es JSON'); } });
  assert.equal(r.status, 400);
  assert.ok(r.html.includes('No se pudo registrar el rechazo.'));
});
