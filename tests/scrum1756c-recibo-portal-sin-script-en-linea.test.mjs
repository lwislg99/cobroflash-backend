// SCRUM-1756c (CSP paso 2 · restos, filas de J2) · EL RECIBO Y EL PORTAL DEL CLIENTE SIN `<script>` EN LÍNEA.
//
// Con `script-src 'self'` aplicada (SCRUM-1637) el navegador no ejecuta un `<script>` en línea. Las tres
// filas que j2d1 declaró en SCRUM-1756 c.22010 (medidas en `origin/main` 65b2e3b2a):
//   · `receipt.routes.ts` · las estrellas de la valoración privada (solo con el cobro pagado);
//   · `customerPortal.routes.ts` · desplegar las líneas y el formulario de «Solicitar nuevo presupuesto»
//     (el pie de TODA página del portal, también el 404);
//   · `customerPortal.routes.ts` · `<script>window.PF_REQUEST_URL = "…"</script>`, que INTERPOLABA la URL.
// Receta de SCRUM-1647 (c.21631): el guion pasa a `pagoNavegador.ts` y se sirve por la ruta que ya existe
// y ya está declarada (`GET /pay/js/pago.js?v=<huella>`); qué página es lo dice `data-pagina` en la
// etiqueta. La URL del formulario viaja en un `data-url` del propio formulario, escapada: NUNCA dentro
// del código, que es una cadena constante.
//
// QUÉ MIRA, POR LA RUTA DE VERDAD (la `app` de `dist/app.js`; sólo prisma es un doble):
//   ① el HTML SERVIDO del recibo pagado con valoración, del portal y del 404 del portal: 0 `<script>` en
//      línea, y el guion de `'self'` enlazado con SU página;
//   ② el formulario del portal lleva la URL en `data-url` y ya no hay `PF_REQUEST_URL` en ningún sitio;
//   ③ el guion servido es una cadena constante (sin `${`) que conoce las dos páginas nuevas, y sigue
//      sirviéndose como antes: JS, `immutable` con la huella, `no-cache` sin ella.
// CONTROL POSITIVO SEMBRADO: el contador ve un `<script>` en línea fabricado y NO cuenta uno con `src`;
// y sobre los tres fragmentos de ANTES (copiados de 65b2e3b2a) cuenta los tres.
//
// ⚠️ NO mide que los botones funcionen: eso lo mide el recorrido en Edge con la CSP aplicada (registro).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Las estrellas vuelven a su `<script>` en línea.
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: "${etiquetaGuionDePago('recibo')}",
    a: '<script>void 0</script>',
    cae: 'SCRUM-1756c · /recibo pagado con valoración: 0 <script> en línea y el guion de su página enlazado',
  },
  {
    // El pie del portal vuelve a llevar su guion en línea.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: "${etiquetaGuionDePago('portal')}",
    a: '<script>void 0</script>',
    cae: 'SCRUM-1756c · /cliente con un enlace que no vale (404): 0 <script> en línea y el guion enlazado',
  },
  {
    // La URL vuelve a viajar en una variable global escrita por el servidor.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: 'id="pf-req-form" data-url="${esc(requestUrl)}"',
    a: 'id="pf-req-form"><script>window.PF_REQUEST_URL = "${esc(requestUrl)}";</script><div',
    cae: 'SCRUM-1756c · /cliente: la URL de la solicitud va en data-url, no en código',
  },
  {
    // El guion deja de conocer el portal: desplegar y solicitar no harían nada.
    fichero: 'src/modules/billing/app/routes/pagoNavegador.ts',
    de: "if(pagina==='portal')",
    a: "if(pagina==='portal-x')",
    cae: 'SCRUM-1756c · el guion servido es constante, conoce recibo y portal, y se sirve como antes',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const comercio = () => ({
  id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
  country: 'ES', logoUrl: null, timezone: null, iban: 'ES9121000418450200051332', clabe: null,
  bizumPhone: '600111222', whatsappPhone: '600111222', connectStatus: 'none', stripeAccountId: null,
  flags: { BIZUM_MANUAL_ENABLED: true }, deletedAt: null, googleReviewUrl: null, llevaLibrosPorSii: true,
});
const clienteFila = () => ({ id: 3, merchantId: 42, name: 'Ana', email: null, phone: null, portalToken: 'portal1756c' });

let cobro = null;
let clientePortal = null;
const tablas = {
  charge: { findUnique: async () => cobro, findFirst: async () => cobro, update: async () => cobro },
  customer: { findUnique: async () => clientePortal, findFirst: async () => clientePortal },
  invoice: { findFirst: async () => null, findUnique: async () => null, findMany: async () => [] },
  quote: {
    findFirst: async () => null,
    findUnique: async () => ({ decisionToken: 'dec1756c' }),
    findMany: async () => [{
      id: 100, quoteNumber: 100, status: 'sent', currency: 'EUR', total: 121, createdAt: new Date('2026-11-10T10:00:00Z'),
      decisionToken: 'dec1756c-0', discount: null, lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 21 }],
    }],
  },
  event: { findFirst: async () => null, create: async () => ({ id: 1 }) },
  job: { findFirst: async () => null },
  teamMember: { findFirst: async () => null },
};
const prismaDoble = new Proxy(tablas, { get: (t, k) => t[k] ?? new Proxy({}, { get: () => async () => null }) });
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma: prismaDoble } };

const { app } = require_('./dist/app.js');
const nav = require_('./dist/modules/billing/app/routes/pagoNavegador.js');
const { BASE_URL } = require_('./dist/core/config/env.js');

let servidor;
let puerto;
test.before(async () => {
  servidor = http.createServer(app);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  puerto = servidor.address().port;
});
test.after(async () => { await new Promise((r) => servidor.close(r)); });

function pedir(ruta) {
  return new Promise((ok, mal) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: 'GET', agent: false }, (r) => {
      let d = ''; r.setEncoding('utf8');
      r.on('data', (t) => { d += t; });
      r.on('end', () => ok({ status: r.statusCode, cabeceras: r.headers, cuerpo: d }));
    });
    req.on('error', mal);
    req.end();
  });
}

function ponerCobroPagado() {
  cobro = {
    id: 7, receiptToken: 'tok1756c', status: 'paid', amount: 250, currency: 'EUR', concept: 'Reparación de bajante',
    reference: 'REF-1756C', method: 'bizum', payMethods: null, intentId: null,
    createdAt: new Date('2026-11-10T10:00:00Z'), paidAt: new Date('2026-11-10T11:00:00Z'),
    merchantId: 42, merchant: comercio(), customer: clienteFila(), events: [], reconciliations: [],
  };
}

// ── El contador: ETIQUETAS `<script>` de apertura SIN atributo `src` ───────────────────────────
function guionesEnLinea(html) {
  return (html.match(/<script\b[^<>]*>/gi) || []).filter((t) => !/\ssrc\s*=/i.test(t));
}

// Los tres fragmentos de ANTES, copiados de `origin/main` 65b2e3b2a (abreviado el cuerpo, no la etiqueta).
const ANTES = [
  '<form id="fb-form"></form>\n         <script>\n           (function(){ var btns = document.querySelectorAll(\'.fb-stars button\'); })();\n         </script>',
  '<p class="pf-footer">Hecho con</p>\n<script>\n  // Expandir líneas de factura\n</script>',
  '<script>window.PF_REQUEST_URL = "https://yaqu.app/cliente/x/quote-request";</script>',
];

test('SCRUM-1756c · control positivo sembrado: el contador ve un <script> en línea y no cuenta uno con src', () => {
  assert.equal(guionesEnLinea('<script>alert(1)</script><script src="/pay/js/pago.js" data-pagina="portal"></script>').length, 1,
    'el contador no ve el sembrado o cuenta el enlazado: está CIEGO');
  assert.deepEqual(ANTES.map((h) => guionesEnLinea(h).length), [1, 1, 1], 'sobre el HTML de antes tiene que contar los tres');
  // Positivo del token que los casos de abajo niegan: en el HTML de antes, la variable global SÍ estaba.
  assert.ok(ANTES[2].includes('PF_REQUEST_URL'), 'el fragmento de antes no lleva la variable global: la negación de abajo no se distingue de un vacío');
});

function sinGuionEnLinea(cuerpo, pagina, suelo) {
  assert.ok(cuerpo.includes(suelo), `suelo: la página no pintó «${suelo}»`);
  assert.deepEqual(guionesEnLinea(cuerpo), []);
  assert.ok(cuerpo.includes(nav.etiquetaGuionDePago(pagina)), `el guion de «${pagina}» no está enlazado`);
}

test('SCRUM-1756c · /recibo pagado con valoración: 0 <script> en línea y el guion de su página enlazado', async () => {
  ponerCobroPagado();
  const r = await pedir('/recibo/tok1756c');
  assert.equal(r.status, 200, `contestó ${r.status}: no hay HTML que contar`);
  sinGuionEnLinea(r.cuerpo, 'recibo', 'id="fb-form"');
  // El guion va DESPUÉS del formulario: cuando corre, las estrellas ya existen.
  assert.ok(r.cuerpo.indexOf('id="fb-form"') < r.cuerpo.indexOf(nav.etiquetaGuionDePago('recibo')));
  assert.ok(r.cuerpo.includes('id="fb-stars-input"') && r.cuerpo.includes('data-star="5"'), 'suelo: faltan las estrellas que el guion maneja');
});

test('SCRUM-1756c · /cliente: 0 <script> en línea y el guion enlazado al final', async () => {
  clientePortal = { ...clienteFila(), merchant: comercio() };
  const r = await pedir('/cliente/portal1756c');
  assert.equal(r.status, 200, `contestó ${r.status}: no hay HTML que contar`);
  sinGuionEnLinea(r.cuerpo, 'portal', 'pf-lines-toggle');
  assert.ok(r.cuerpo.indexOf('id="pf-req-btn"') < r.cuerpo.indexOf(nav.etiquetaGuionDePago('portal')), 'el guion corre antes de que exista el botón');
});

test('SCRUM-1756c · /cliente: la URL de la solicitud va en data-url, no en código', async () => {
  clientePortal = { ...clienteFila(), merchant: comercio() };
  const r = await pedir('/cliente/portal1756c');
  assert.equal(r.status, 200, `contestó ${r.status}`);
  assert.ok(!r.cuerpo.includes('PF_REQUEST_URL'), 'sigue habiendo una variable global escrita por el servidor');
  const m = r.cuerpo.match(/id="pf-req-form" data-url="([^"]*)"/);
  assert.ok(m, 'el formulario no lleva su data-url');
  assert.equal(m[1], `${BASE_URL}/cliente/portal1756c/quote-request`);
});

test('SCRUM-1756c · /cliente con un enlace que no vale (404): 0 <script> en línea y el guion enlazado', async () => {
  clientePortal = null;
  const r = await pedir('/cliente/no-existe-1756c');
  assert.equal(r.status, 404, `contestó ${r.status}: no es la página de enlace no válido`);
  sinGuionEnLinea(r.cuerpo, 'portal', 'Hecho con');
});

test('SCRUM-1756c · el guion servido es constante, conoce recibo y portal, y se sirve como antes', async () => {
  const js = nav.PAGO_JS;
  assert.ok(!js.includes('${'), 'el guion lleva una interpolación: un dato podría viajar dentro del código');
  assert.ok(!js.includes('PF_REQUEST_URL'), 'el guion sigue leyendo la variable global');
  for (const p of ["if(pagina==='recibo')", "if(pagina==='portal')"]) assert.ok(js.includes(p), `el guion no tiene la rama ${p}`);
  assert.ok(js.includes("getAttribute('data-url')"), 'el portal no lee la URL de su data-url');
  const con = await pedir(nav.SRC_PAGO_JS);
  assert.equal(con.status, 200);
  assert.match(String(con.cabeceras['content-type']), /javascript/);
  assert.match(String(con.cabeceras['cache-control']), /immutable/);
  assert.equal(con.cuerpo, js);
  const sin = await pedir('/pay/js/pago.js');
  assert.equal(sin.cabeceras['cache-control'], 'no-cache');
});
