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
    // Una función hace de red que falla: lanza en vez de contestar.
    exports: async (url) => {
      pedidas.push(String(url));
      return typeof respuestaDeLaApi === 'function' ? respuestaDeLaApi() : respuestaDeLaApi;
    },
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

// ── EL CÓDIGO CRUDO · DOS FECHAS ──────────────────────────────────────────────────────────
//   · 2-oct-2026 (SCRUM-1431, #2168): este caso afirmaba «sin `message`, el `error` también sale
//     ESCAPADO». El código se pintaba; sólo se le quitó el marcado.
//   · 6-oct-2026 (SCRUM-1431, decisión del orquestador: c.18286 + la opción 2 del c.18291): el
//     código NO SE PINTA. Lo lee el cliente final y no sabe qué es `quote_not_found`.
// Lo que sustituye a lo de arriba es más fuerte, no más flojo: lo que no se pinta no puede traer
// marcado. Por eso el caso sigue mandando un `error` con marcado y exige que no quede NI escapado.
test('SCRUM-1431 · 🔴 sin `message`, el `error` NO se pinta (ni escapado)', async () => {
  const r = await rechazar(fallo({ error: 'a<i>b</i>' }));
  assert.ok(r.html.includes('No se pudo registrar el rechazo.'), '🔴 CIEGO: no es la página de error del rechazo');
  assert.ok(!r.html.includes('a&lt;i&gt;b&lt;/i&gt;'), '🔴 el código sigue en la página, escapado');
  assert.ok(!/<i[^>]*>b/.test(r.html), '🔴 el marcado del código ha entrado en la página');
});

/** Lo que la página pinta DEBAJO del titular: lo único que estos casos miden. */
function bajoElTitular(html) {
  // Con hueco para atributos (SCRUM-553), como los casos de arriba.
  const m = html.match(/No se pudo registrar el rechazo\.<\/strong><br[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(m, '🔴 CIEGO: no encuentro el titular del rechazo y lo que lleva debajo');
  return m[1];
}

const REINTENTAR = 'Inténtalo más tarde.';

test('SCRUM-1431 · 🔴 404 de la API: el titular SOLO — ni `quote_not_found` ni consejo de reintentar', async () => {
  // Las respuestas son las que `POST /quote/:token/decision` da HOY a un rechazo
  // (`quotes.routes.ts`, leídas): 404 y 500 sin `message`; 410 y 429 con él.
  const r = await rechazar(fallo({ error: 'quote_not_found' }, 404));
  assert.equal(bajoElTitular(r.html), '',
    '🔴 bajo el titular hay algo: o el código crudo, o un consejo de reintentar un presupuesto que no existe');
});

test('SCRUM-1431 · 🔴 500 de la API: el consejo que la página ya da cuando la API no contesta, y no `internal_error`', async () => {
  const r = await rechazar(fallo({ error: 'internal_error' }, 500));
  assert.equal(bajoElTitular(r.html), REINTENTAR);
  assert.ok(!r.html.includes('internal_error'), '🔴 el cliente lee el código crudo');
});

test('SCRUM-1431 · el consejo del 500 y el del fallo de red son EL MISMO texto, no dos parecidos', async () => {
  const sinRed = await rechazar(() => { throw new Error('la API no contesta'); }).then((r) => r, (e) => ({ lanzo: e }));
  assert.ok(!sinRed.lanzo, '🔴 CIEGO: el handler ha lanzado en vez de pintar su página de error');
  assert.equal(sinRed.status, 500, '🔴 CIEGO: no es el `catch` del handler');
  assert.ok(sinRed.html.includes(`Error inesperado.</strong> ${REINTENTAR}`),
    '🔴 la página del fallo de red ya no dice lo que decía');
});

test('SCRUM-1431 · con `message`, el mensaje GANA y el consejo no se le pega detrás (también en un 5xx)', async () => {
  const caducado = await rechazar(fallo({ error: 'quote_expired', message: 'Este presupuesto caducó.' }, 410));
  assert.equal(bajoElTitular(caducado.html), 'Este presupuesto caducó.');
  const cincoXxConTexto = await rechazar(fallo({ error: 'x', message: 'Un texto para la persona.' }, 503));
  assert.equal(bajoElTitular(cincoXxConTexto.html), 'Un texto para la persona.');
});

// Hasta el 6-oct-2026 este caso se llamaba «…: titular solo» y sólo comprobaba el titular. Un 502
// sin JSON es un fallo NUESTRO, así que desde la opción 2 lleva el consejo: lo que afirmaba (la
// página no se rompe, sale el titular) sigue igual y se le añade lo que ahora lleva debajo.
test('SCRUM-1431 · una respuesta que no es JSON no rompe la página: titular y, por ser un 5xx, el consejo', async () => {
  const r = await rechazar({ ok: false, status: 502, json: async () => { throw new Error('no es JSON'); } });
  assert.equal(r.status, 400);
  assert.ok(r.html.includes('No se pudo registrar el rechazo.'));
  assert.equal(bajoElTitular(r.html), REINTENTAR);
});
