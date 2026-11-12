// tests/scrum1647c-login-sin-script-en-linea.test.mjs — SCRUM-1647c (CSP paso 2, tramo de J3)
//
// LA PÁGINA DE ACCESO SIN CÓDIGO EN LÍNEA, Y EL ENLACE MÁGICO FUNCIONANDO IGUAL.
//
// Para que la CSP de SCRUM-1637 se pueda APLICAR (`script-src 'self'`, sin `'unsafe-inline'`),
// `login.html` no puede depender de `on*=` ni de `<script>` sin `src`. Medido sobre `origin/main` =
// `9cdf6a24d` (12-nov-2026): 2 `onclick=` (dentro del `innerHTML` de la cuenta atrás, :125) y 1
// `<script>` en línea. El guion pasó a `src/modules/auth/app/routes/loginNavegador.ts`, servido en
// `GET /auth/js/login.js`. `register.html` entra en el recuento de `on*=` porque es del mismo carril
// (J3) y cambió esa semana (SCRUM-1685): hoy tiene 0, y este test lo mantiene en 0.
//
// ⚠️ LO QUE ESTE TEST NO DICE: que `register.html` esté lista para la CSP. Tiene 1 `<script>` en
// línea (medido el mismo día) y SIN manejadores; queda fuera de 1647c y se dice en el registro.
//
// Tres partes:
//  A · el censo: 0 `on*=` (en el HTML Y dentro de las cadenas del guion, que es donde vivían) y 0
//      `<script>` sin `src` en login.html. Con su control SEMBRADO: el mismo contador sobre una página
//      fabricada con lo que cuenta TIENE que dar >0, o el censo está ciego.
//  B · la ruta: `GET /auth/js/login.js` por el router real devuelve EXACTAMENTE la cadena, como JS.
//  C · el comportamiento: el guion corre en un DOM de banco y hace el recorrido del enlace mágico
//      (error por URL → pedir enlace → cuenta atrás → «Reenviar enlace» → «Cambiar email»).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { scriptsDeLaPagina, sinComentarios } from './_scripts-de-la-pagina.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const NAV = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'routes', 'loginNavegador.js');

const PAGINAS = ['public/login.html', 'public/register.html'];

/** Lo que tiene que tumbar cada caso (catálogo de `scripts/meta-guard-mutaciones.mjs`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/login.html',
    de: 'id="btn">Enviar enlace de acceso</button>',
    a: 'id="btn" onclick="sendLink()">Enviar enlace de acceso</button>',
    cae: 'A1 · public/login.html: 0 manejadores',
  },
  {
    fichero: 'public/register.html',
    de: 'id="btn">Crear cuenta y acceder</button>',
    a: 'id="btn" onclick="enviar()">Crear cuenta y acceder</button>',
    cae: 'A1 · public/register.html: 0 manejadores',
  },
  {
    fichero: 'public/login.html',
    de: '<script src="/auth/js/login.js"></script>',
    a: '<script>var x = 1;</script><script src="/auth/js/login.js"></script>',
    cae: 'A2 · login.html: 0 <script> sin src',
  },
  {
    fichero: 'src/modules/auth/app/routes/loginNavegador.ts',
    de: '<a data-accion="reenviar">Reenviar enlace</a>',
    a: '<a onclick="sendLink()">Reenviar enlace</a>',
    cae: 'A3 · el guion no pinta on*=',
  },
  {
    fichero: 'src/modules/auth/app/routes/loginNavegador.ts',
    de: "    if (accion === 'reenviar') sendLink();\n",
    a: "    if (accion === 'reenviar') {}\n",
    cae: 'C2 · el recorrido del enlace mágico',
  },
  {
    fichero: 'public/login.html',
    de: '<div id="resend-row" class="resend-row" hidden></div>',
    a: '<div id="resend-row" class="resend-row" style="display:none"></div>',
    cae: 'A4 · login.html: 0 atributos style=',
  },
  {
    fichero: 'src/modules/auth/app/routes/auth.routes.ts',
    de: 'router.get(RUTA_LOGIN_JS,',
    a: "router.get('/js/otro.js',",
    cae: 'B · GET /auth/js/login.js por el router real',
  },
];

/** Manejadores `on*=` dentro de etiquetas (atributo precedido de espacio, sin comentarios). */
function manejadores(html) {
  const out = [];
  for (const tag of sinComentarios(html).match(/<[a-zA-Z][^>]*>/g) || []) {
    for (const m of tag.matchAll(/\son([a-z]+)\s*=/gi)) out.push(`on${m[1]}= en ${tag.slice(0, 60)}`);
  }
  return out;
}

// ── A · EL CENSO ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-1647c · A0 · CONTROL SEMBRADO: el contador ve un on*= y un <script> en línea fabricados', () => {
  const fabricada = '<p>x</p><a onclick="f()">a</a><img src="x" onerror="g()"/><!-- <b onclick="no"> --><script>var a=1;</script><script src="/a.js"></script>';
  assert.equal(manejadores(fabricada).length, 2, '🔴 CIEGO: el contador de on*= no ve los dos fabricados (o cuenta el comentado)');
  assert.equal(scriptsDeLaPagina(fabricada).inline, 1, '🔴 CIEGO: el extractor de la casa no ve el <script> en línea fabricado');
});

for (const pagina of PAGINAS) {
  test(`SCRUM-1647c · A1 · ${pagina}: 0 manejadores on*=`, () => {
    const html = leer(pagina);
    assert.ok(html.length > 1000, `🔴 CIEGO: ${pagina} pesa ${html.length} B`);
    assert.deepEqual(manejadores(html), [], `🔴 ${pagina} lleva manejadores en línea: con script-src 'self' no corren`);
  });
}

test('SCRUM-1647c · A2 · login.html: 0 <script> sin src, y carga el guion desde /auth/js/login.js', () => {
  const s = scriptsDeLaPagina(leer('public', 'login.html'));
  assert.equal(s.inline, 0, '🔴 login.html lleva <script> en línea: con script-src \'self\' no corre');
  assert.ok(s.clasicos.includes('/auth/js/login.js'), `🔴 login.html no carga /auth/js/login.js (carga: ${JSON.stringify(s.clasicos)})`);
});

test('SCRUM-1647c · A4 · login.html: 0 atributos style= (con style-src \'self\' se ignoran y las dos cajas vacías se verían)', () => {
  // Medido en Chromium con la política de 1637 APLICADA: los dos `style="display:none"` de main
  // daban 2 bloqueos `style-src`. Ahora son `hidden`, que el guion abre con `style.display` (CSSOM,
  // que la CSP no bloquea). Control sembrado: el mismo patrón ve uno fabricado.
  const estilos = (h) => (sinComentarios(h).match(/<[a-zA-Z][^>]*\sstyle\s*=/g) || []);
  assert.equal(estilos('<div id="a" style="display:none"></div>').length, 1, '🔴 CIEGO: no ve un style= fabricado');
  const html = leer('public', 'login.html');
  assert.deepEqual(estilos(html), [], '🔴 login.html lleva style= en línea');
  assert.match(html, /<div id="alert"[^>]*\shidden>/, '🔴 la caja de avisos ya no nace oculta');
  assert.match(html, /<div id="resend-row"[^>]*\shidden>/, '🔴 la fila de reenviar ya no nace oculta');
});

test('SCRUM-1647c · A3 · el guion no pinta on*= en sus cadenas (era donde vivían los dos de :125)', () => {
  const { LOGIN_JS } = require(NAV);
  assert.ok(LOGIN_JS.length > 2000, `🔴 CIEGO: el guion pesa ${LOGIN_JS.length} B`);
  assert.ok(LOGIN_JS.includes('innerHTML'), '🔴 CIEGO: el guion ya no tiene innerHTML, este caso no mira nada');
  const enCadenas = [...LOGIN_JS.matchAll(/'[^'\n]*'/g)].map((m) => m[0]).filter((c) => /\son[a-z]+\s*=/i.test(c));
  assert.deepEqual(enCadenas, [], '🔴 el guion pinta un manejador en línea con innerHTML');
});

// ── B · LA RUTA ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1647c · B · GET /auth/js/login.js por el router real devuelve el guion como JS', async () => {
  const express = require('express');
  const router = require(path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'routes', 'auth.routes.js')).default;
  const { LOGIN_JS } = require(NAV);
  const app = express();
  app.use('/auth', router);
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  // Con `node:http` y `agent:false`, no con `fetch`: `fetch` + `--test-force-exit` en Windows muere
  // al salir con los casos en verde (SCRUM-1332; lo vi aquí mismo antes de cambiarlo).
  const { port } = srv.address();
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
  try {
    const res = await pedir('/auth/js/login.js');
    assert.equal(res.status, 200);
    assert.match(res.tipo, /javascript/);
    assert.equal(res.cache, 'no-cache');
    assert.equal(res.cuerpo, LOGIN_JS, '🔴 la ruta no sirve la cadena del guion');
    const otra = await pedir('/auth/js/no-existe.js');
    assert.equal(otra.status, 404, '🔴 CIEGO: el router contesta 200 a cualquier ruta');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

// ── C · EL COMPORTAMIENTO, EN UN DOM DE BANCO ─────────────────────────────────────────────────

/** Un DOM mínimo con los cinco nodos que toca el guion. */
function banco({ search = '', loginResponde = { ok: true, status: 200, cuerpo: {} } } = {}) {
  const oyentes = new Map();
  const nodo = (id) => {
    const n = {
      id, value: '', disabled: false, textContent: '', className: '', style: { display: '' }, focoPedido: 0,
      _html: '',
      get innerHTML() { return this._html; },
      set innerHTML(v) { this._html = String(v); },
      addEventListener(tipo, fn) { oyentes.set(`${id}:${tipo}`, fn); },
      focus() { this.focoPedido++; },
    };
    return n;
  };
  const nodos = Object.fromEntries(['login-form', 'email', 'btn', 'alert', 'resend-row'].map((id) => [id, nodo(id)]));
  const llamadas = [];
  const intervalos = [];
  const ctx = {
    console,
    URLSearchParams,
    JSON,
    location: { search, href: '/login.html' },
    window: null,
    document: {
      getElementById: (id) => {
        if (id === 'countdown') {
          // `[^>]*>` y no el `>` pegado: lo exige scrum553 (de paso, SCRUM-1647d).
          const m = nodos['resend-row']._html.match(/<strong id="countdown"[^>]*>([^<]*)<\/strong>/);
          return m ? { set textContent(v) { nodos['resend-row']._html = nodos['resend-row']._html.replace(/(<strong id="countdown"[^>]*>)[^<]*/, `$1${v}`); } } : null;
        }
        return nodos[id] || null;
      },
    },
    fetch: async (url, opts) => {
      llamadas.push({ url, opts });
      if (url === '/admin/me') return { ok: false, status: 401, json: async () => ({}) };
      return { ok: loginResponde.ok, status: loginResponde.status, json: async () => loginResponde.cuerpo };
    },
    setInterval: (fn) => { intervalos.push(fn); return intervalos.length; },
    clearInterval: () => {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(require(NAV).LOGIN_JS, ctx, { filename: 'login.js' });
  /** Los enlaces que pinta el innerHTML de la fila, como nodos con `closest` y `getAttribute`. */
  const enlaces = () => [...nodos['resend-row']._html.matchAll(/<a([^>]*)>([^<]*)<\/a>/g)].map((m) => {
    const attrs = Object.fromEntries([...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const el = { texto: m[2], attrs, getAttribute: (k) => attrs[k] ?? null, closest: (sel) => (sel === '[data-accion]' && 'data-accion' in attrs ? el : null) };
    return el;
  });
  const pulsar = (texto) => {
    const el = enlaces().find((e) => e.texto === texto);
    assert.ok(el, `🔴 no está el enlace «${texto}» en la fila: ${nodos['resend-row']._html}`);
    oyentes.get('resend-row:click')({ target: el });
  };
  const enviar = () => oyentes.get('login-form:submit')({ preventDefault() {} });
  const esperar = () => new Promise((r) => setImmediate(r));
  return { nodos, llamadas, intervalos, enlaces, pulsar, enviar, esperar };
}

test('SCRUM-1647c · C1 · un error que llega por la URL se traduce con la tabla, como antes', () => {
  const b = banco({ search: '?error=link_expired' });
  assert.equal(b.nodos.alert.innerHTML, 'El enlace ha caducado o ya fue usado. Solicita uno nuevo.');
  assert.equal(b.nodos.alert.className, 'alert error');
  assert.equal(b.nodos.alert.style.display, 'block');
});

test('SCRUM-1647c · C2 · el recorrido del enlace mágico: pedir → cuenta atrás → reenviar → cambiar email', async () => {
  const b = banco();
  assert.equal(b.llamadas[0]?.url, '/admin/me', '🔴 la página ya no mira si hay sesión al cargar');

  // Pedir el enlace.
  b.nodos.email.value = '  ana@ejemplo.es ';
  b.enviar();
  await b.esperar();
  const pedido = b.llamadas.filter((l) => l.url === '/auth/login');
  assert.equal(pedido.length, 1, '🔴 enviar el formulario no pide el enlace');
  assert.equal(pedido[0].opts.method, 'POST');
  assert.deepEqual(JSON.parse(pedido[0].opts.body), { email: 'ana@ejemplo.es' });
  assert.equal(b.nodos.alert.innerHTML, '✉️ Enlace enviado. Revisa tu bandeja de entrada (y spam).');
  assert.equal(b.nodos.email.disabled, true);
  assert.equal(b.nodos['resend-row'].innerHTML, '¿No llegó? Puedes reenviar en <strong id="countdown">60s</strong>');

  // La cuenta atrás llega a cero.
  const tic = b.intervalos.at(-1);
  for (let i = 0; i < 60; i++) tic();
  assert.equal(b.nodos['resend-row'].innerHTML,
    '¿No llegó? <a data-accion="reenviar">Reenviar enlace</a> · <a data-accion="cambiar">Cambiar email</a>');
  assert.equal(b.nodos.btn.textContent, 'Enviar enlace de acceso');
  assert.equal(b.nodos.email.disabled, false);

  // «Reenviar enlace» vuelve a pedirlo (antes: onclick="sendLink()").
  b.pulsar('Reenviar enlace');
  await b.esperar();
  assert.equal(b.llamadas.filter((l) => l.url === '/auth/login').length, 2, '🔴 «Reenviar enlace» no vuelve a pedir el enlace');

  // Acaba la segunda cuenta atrás y «Cambiar email» limpia el campo (antes: onclick="changeEmail()").
  const tic2 = b.intervalos.at(-1);
  for (let i = 0; i < 60; i++) tic2();
  b.pulsar('Cambiar email');
  assert.equal(b.nodos.email.value, '');
  assert.equal(b.nodos.email.disabled, false);
  assert.equal(b.nodos.email.focoPedido, 1);
  assert.equal(b.nodos.alert.style.display, 'none');
  assert.equal(b.nodos['resend-row'].style.display, 'none');
  assert.equal(b.llamadas.filter((l) => l.url === '/auth/login').length, 2, '🔴 «Cambiar email» ha pedido un enlace');
});

test('SCRUM-1647c · C3 · un rechazo de la API pinta el texto humano y deja reintentar', async () => {
  const b = banco({ loginResponde: { ok: false, status: 400, cuerpo: { error: 'invalid_email' } } });
  b.nodos.email.value = 'mal';
  b.enviar();
  await b.esperar();
  assert.equal(b.nodos.alert.innerHTML, 'Escribe un correo electrónico válido.');
  assert.equal(b.nodos.btn.disabled, false);
  assert.equal(b.nodos.btn.textContent, 'Enviar enlace de acceso');
});
