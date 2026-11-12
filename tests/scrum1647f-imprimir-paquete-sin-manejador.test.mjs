// tests/scrum1647f-imprimir-paquete-sin-manejador.test.mjs — SCRUM-1647f (CSP paso 2, tramo J1)
//
// El paquete de disputa (`GET /admin/invoices/:id/dispute-package`) llevaba el botón
// «Imprimir / PDF» con `onclick="window.print()"`. Con `script-src 'self'` aplicada (SCRUM-1637,
// paso 3) ese manejador no corre y el botón deja de imprimir. Ahora el botón lleva
// `data-accion="imprimir"` y el guion constante `IMPRIMIR_JS` se sirve desde el MISMO router, en
// `GET /admin/invoices/js/imprimir.js`, con el mismo `requireRole('admin')` que la página.
//
// Lo que fija, por la ruta y no sólo por el handler (A10, SCRUM-1344):
//   A · el HTML servido: 0 `on*=`, 0 `<script>` sin `src`, el guion enlazado y el botón con su acción.
//   B · la ruta del guion: existe, nadie la pisa antes en el router, lleva el gate de admin (un
//       técnico recibe 403) y sirve JS sin caché compartida.
//   C · el comportamiento: un clic en el botón llama a `window.print`; uno fuera, no.
// Con un control POSITIVO sembrado: los contadores ven un manejador y un script en línea fabricados.
//
// Sin BD: router REAL del `dist` y `prisma` sustituido en el objeto exportado (patrón de SCRUM-342).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reqDeSesion } from './_arnes-de-router.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '<button class="print" data-accion="imprimir">',
    a: '<button class="print" data-accion="imprimir" onclick="window.print()">',
    cae: 'A · el paquete de disputa sale con 0 on*=',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '<script src="/admin/invoices${RUTA_IMPRIMIR_JS}"></script></head>',
    a: '<script>1</script></head>',
    cae: 'A · el paquete de disputa sale con 0 on*=',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: "router.get(RUTA_IMPRIMIR_JS, requireRole('admin'), (_req, res) => {",
    a: 'router.get(RUTA_IMPRIMIR_JS, (_req, res) => {',
    cae: 'B · el guion de imprimir: ruta propia con el gate de admin',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: "  if(b)window.print();\n",
    a: "  if(b){}\n",
    cae: 'C · un clic en el botón imprime',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: `closest('[data-accion="imprimir"]')`,
    a: `closest('button')`,
    cae: 'C · un clic fuera del botón no imprime',
  },
];

const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const mod = await import(DIST + 'modules/system/app/routes/invoicesAdmin.routes.js');
const router = mod.default?.default ?? mod.default;
const { IMPRIMIR_JS, RUTA_IMPRIMIR_JS } = mod.default?.IMPRIMIR_JS ? mod.default : mod;

const manejadoresEnLinea = (html) => (html.match(/<[^>]*\son[a-z]+\s*=/gi) || []).length;
const scriptsEnLinea = (html) => (html.match(/<script(?![^>]*\ssrc=)[^>]*>/gi) || []).length;

/** Ejecuta en orden TODOS los handlers de la capa (gate incluido), como Express. */
async function porLaCapa(capa, req) {
  let salida = null;
  const cabeceras = {};
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b, cabeceras }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b, cabeceras }; return this; },
    setHeader(k, v) { cabeceras[k.toLowerCase()] = v; return this; },
    set(k, v) { cabeceras[k.toLowerCase()] = v; return this; },
    type() { return this; },
  };
  for (const h of capa.route.stack) {
    let siguió = false;
    await h.handle(req, res, () => { siguió = true; });
    if (!siguió) break;
  }
  return salida;
}
const capaDe = (ruta) => router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.get);

const ORIG = {};
function sustituirPrisma() {
  for (const k of ['invoice', 'whatsAppMessage']) ORIG[k] = moduloPrisma.prisma[k];
  moduloPrisma.prisma.invoice = { findFirst: async () => ({
    id: 11, merchantId: 7, number: '2026-CF-0007', currency: 'EUR', status: 'paid',
    createdAt: new Date('2026-07-02T09:00:00Z'), paidAt: null, total: '250.00', quoteId: null, chargeId: null,
    merchant: { name: 'QA', legalName: 'QA SL', taxId: 'B1234', address: 'Calle X 1' },
    customer: { id: 2, name: 'Cliente', phone: null, email: null }, charge: null, quote: null,
  }) };
  moduloPrisma.prisma.whatsAppMessage = { findMany: async () => [] };
}
function restaurarPrisma() { for (const k of Object.keys(ORIG)) moduloPrisma.prisma[k] = ORIG[k]; }

test('control positivo sembrado: los contadores ven un manejador y un script en línea fabricados', () => {
  const sembrado = '<button class="x" onclick="window.print()">a</button><script>1</script><script src="/a.js"></script>';
  assert.equal(manejadoresEnLinea(sembrado), 1);
  assert.equal(scriptsEnLinea(sembrado), 1);
});

test('A · el paquete de disputa sale con 0 on*=, 0 <script> en línea y el guion enlazado', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma();
  const capa = capaDe('/:id/dispute-package');
  assert.ok(capa, 'SUELO: no existe GET /:id/dispute-package en el router');
  const r = await porLaCapa(capa, reqDeSesion({ rol: 'admin', merchantId: 7, params: { id: '11' } }));
  assert.equal(r?.code, 200, `esperaba 200: ${JSON.stringify(r?.body).slice(0, 200)}`);
  const html = String(r.body);
  assert.ok(html.includes('Paquete de evidencia de disputa'), 'SUELO: no es la página del paquete');
  assert.equal(manejadoresEnLinea(html), 0, 'el HTML servido no lleva ningún on*=');
  assert.equal(scriptsEnLinea(html), 0, 'el HTML servido no lleva <script> sin src');
  assert.match(html, /<script\b[^>]*\ssrc="\/admin\/invoices\/js\/imprimir\.js"[^>]*>\s*<\/script>/,
    'el guion de imprimir va enlazado');
  assert.match(html, /<button\b(?=[^>]*\sclass="print")(?=[^>]*\sdata-accion="imprimir")[^>]*>🖨 Imprimir \/ PDF<\/button>/,
    'el botón conserva clase y rótulo, y lleva su acción');
});

test('B · el guion de imprimir: ruta propia con el gate de admin, JS y sin caché compartida', async () => {
  assert.equal(RUTA_IMPRIMIR_JS, '/js/imprimir.js');
  const primera = router.stack.find((l) => l.route?.methods?.get && l.match(RUTA_IMPRIMIR_JS));
  assert.equal(primera?.route?.path, RUTA_IMPRIMIR_JS, 'ninguna ruta anterior del router se la queda');
  const capa = capaDe(RUTA_IMPRIMIR_JS);
  const tecnico = await porLaCapa(capa, reqDeSesion({ rol: 'tecnico', merchantId: 7 }));
  assert.equal(tecnico?.code, 403, 'un técnico no pasa: el mismo gate que la página');
  const admin = await porLaCapa(capa, reqDeSesion({ rol: 'admin', merchantId: 7 }));
  assert.equal(admin?.code, 200);
  assert.equal(admin.body, IMPRIMIR_JS);
  assert.match(admin.cabeceras['content-type'], /^application\/javascript/);
  assert.equal(admin.cabeceras['cache-control'], 'private, no-cache');
  assert.ok(!IMPRIMIR_JS.includes('${'), 'el guion es constante: ningún dato dentro');
});

function ejecutarGuion() {
  let oyente = null;
  let impresiones = 0;
  const ctx = {
    document: { addEventListener: (tipo, f) => { if (tipo === 'click') oyente = f; } },
    window: { print: () => { impresiones += 1; } },
  };
  vm.runInNewContext(IMPRIMIR_JS, ctx);
  assert.equal(typeof oyente, 'function', 'SUELO: el guion no registró ningún oyente de clic');
  // Un botón con acción (el de imprimir) y otro botón cualquiera de la página, sin ella.
  const elemento = (accion) => ({
    closest(s) {
      if (s === 'button') return this;
      if (s === '[data-accion="imprimir"]') return accion === 'imprimir' ? this : null;
      throw new Error(`selector no previsto por el doble: ${s}`);
    },
  });
  return {
    clic: (dentro) => oyente({ target: elemento(dentro ? 'imprimir' : null) }),
    impresiones: () => impresiones,
  };
}

test('C · un clic en el botón imprime', () => {
  const g = ejecutarGuion();
  g.clic(true);
  assert.equal(g.impresiones(), 1);
});

test('C · un clic fuera del botón no imprime', () => {
  const g = ejecutarGuion();
  g.clic(false);
  assert.equal(g.impresiones(), 0);
});
