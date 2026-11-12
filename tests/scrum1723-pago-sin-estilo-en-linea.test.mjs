// SCRUM-1723 (CSP paso 3, parte J2) · LAS TRES PÁGINAS DE PAGO SIN CSS EN LÍNEA.
//
// Con `style-src 'self'` aplicada (SCRUM-1637) el navegador no pinta un `<style>` en línea ni un
// `style=`: jv-j2bu midió en Edge que transferencia, Bizum y factura salían desnudas, también en
// main (SCRUM-1647 c.21665). Medido el 12-nov-2026 sobre `origin/main` = `ff2af3368`, en el fuente:
// `/pay/bank` 1 `<style>` y 3 `style=`; `/pay/bizum` 1 y 1; `/pay/invoice` 1 y 1. Cada `<style>` pasa
// TAL CUAL a `pagoEstilo.ts`, servido en `GET /pay/css/pago.css?p=<página>&v=<huella>`, y los `style=`
// a clases con las mismas declaraciones.
//
// QUÉ MIRA, POR LA RUTA DE VERDAD (la `app` de `dist/app.js`; sólo prisma es un doble, en
// `require.cache`: ni BD, ni red, ni una firma de `src/` tocada):
//   ① el HTML SERVIDO de las tres páginas (y de la transferencia sin cuenta): 0 `<style>` y 0 `style=`,
//      y la hoja de SU página enlazada; cada clase nueva del marcado tiene su regla en esa hoja;
//   ② la hoja se sirve desde `/pay`: CSS, `immutable` con la huella, `no-cache` sin ella, y 404 para
//      una página que no es del conjunto (también `toString` y `__proto__`).
// Cada contador lleva su CONTROL POSITIVO sembrado: un HTML fabricado con un `<style>` y un `style=`
// TIENE que dar 1 y 1; si da 0, el contador está ciego.
//
// ⚠️ NO mide el aspecto: eso lo midió el recorrido en Edge con la CSP aplicada (registro de SCRUM-1723).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo
// a como estaba, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El «★ obligatorio» de la transferencia vuelve a su `style=`.
    fichero: 'src/modules/billing/app/routes/payBank.routes.ts',
    de: '<span class="pago-obligatorio">',
    a: '<span style="color:#ef4444">',
    cae: 'SCRUM-1723 · /pay/bank: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // El concepto de Bizum vuelve a su `style=`.
    fichero: 'src/modules/billing/app/routes/payBizum.routes.ts',
    de: 'class="row-value row-value-concepto"',
    a: 'class="row-value" style="font-size:.85rem"',
    cae: 'SCRUM-1723 · /pay/bizum: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // La factura vuelve a llevar un `<style>` en línea.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: "${etiquetaEstiloDePago('factura')}",
    a: '<style>body{margin:0}</style>',
    cae: 'SCRUM-1723 · /pay/invoice: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // La hoja se sirve siempre sin caché: la huella deja de decidir.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: 'cacheDelEstiloDePago(pagina, req.query?.v)',
    a: "'no-cache'",
    cae: 'SCRUM-1723 · GET /pay/css/pago.css: CSS de su página, immutable con la huella y no-cache sin ella',
  },
  {
    // El conjunto deja de ser cerrado: `toString` pasa por página.
    fichero: 'src/modules/billing/app/routes/pagoEstilo.ts',
    de: 'Object.prototype.hasOwnProperty.call(PAGO_CSS, pedida)',
    a: 'pedida in PAGO_CSS',
    cae: 'SCRUM-1723 · GET /pay/css/pago.css: una página fuera del conjunto es 404',
  },
  // SCRUM-1723c · tarjeta y Mercado Pago.
  {
    // El título del 409 de tarjeta vuelve a su `style=` (ancla única: el 503 lleva otro texto).
    fichero: 'src/modules/billing/app/routes/payCard.routes.ts',
    de: '<h1 class="pago-tarjeta-titulo">El pago con tarjeta no está disponible',
    a: '<h1 style="font-size:20px">El pago con tarjeta no está disponible',
    cae: 'SCRUM-1723c · /pay/card sin Connect (409): 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // El concepto del resultado de Mercado Pago vuelve a su `style=`.
    fichero: 'src/modules/billing/app/routes/payMp.routes.ts',
    de: '<span class="pago-mp-concepto">',
    a: '<span style="font-size:.85rem">',
    cae: 'SCRUM-1723c · /pay/mp/:token/result: cada estado enlaza la hoja de SU color',
  },
  {
    // Todos los estados enlazan la hoja del aprobado: el color deja de seguir al estado.
    fichero: 'src/modules/billing/app/routes/payMp.routes.ts',
    de: 'etiquetaEstiloDePago(estiloDeResultadoMp(status))',
    a: "etiquetaEstiloDePago('mp-approved')",
    cae: 'SCRUM-1723c · /pay/mp/:token/result: cada estado enlaza la hoja de SU color',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

function merchant(extra = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
    country: 'ES', logoUrl: null, iban: 'ES9121000418450200051332', clabe: null, bizumPhone: '600111222',
    whatsappPhone: null, connectStatus: 'none', stripeAccountId: null, flags: { BIZUM_MANUAL_ENABLED: true },
    deletedAt: null, ...extra,
  };
}

let cobroActual = null;
const prismaDoble = {
  charge: { findUnique: async () => cobroActual, update: async () => cobroActual },
  invoice: { findFirst: async () => null, findUnique: async () => null },
  quote: { findFirst: async () => null },
  event: { findFirst: async () => null, create: async () => ({ id: 1 }) },
};
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma: prismaDoble } };

const { app } = require_('./dist/app.js');
const { PAGO_CSS, hrefEstiloDePago, etiquetaEstiloDePago } = require_('./dist/modules/billing/app/routes/pagoEstilo.js');

let servidor;
let puerto;
test.before(async () => {
  servidor = http.createServer(app);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  puerto = servidor.address().port;
});
test.after(async () => { await new Promise((r) => servidor.close(r)); });

// `node:http` sin agente y no `fetch` (SCRUM-1204 / SCRUM-1568).
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

async function pagina(ruta, m) {
  cobroActual = {
    id: 7, receiptToken: 'tok1723', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', reference: 'REF-1723', payMethods: null, createdAt: new Date(),
    merchant: m, customer: { id: 3, name: 'Ana', email: null },
  };
  const r = await pedir(ruta);
  assert.equal(r.status, 200, `${ruta} no contestó 200 (contestó ${r.status}): no hay HTML que contar`);
  return r.cuerpo;
}

// ── Los contadores: sobre las ETIQUETAS del HTML, no sobre el texto ────────────────────────────
const ETIQUETA = /<[a-zA-Z][^<>]*>/g;
function estilosEnLinea(html) {
  return (html.match(/<style\b[^<>]*>/gi) || []);
}
function atributosStyle(html) {
  return (html.match(ETIQUETA) || []).filter((t) => /\sstyle\s*=/i.test(t));
}
// Las clases `pago-*` y `row-value-*` que el arreglo puso en el marcado: cada una tiene que tener regla.
function clasesNuevas(html) {
  return [...html.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(/\s+/)).filter((c) => /^(pago-|row-value-)/.test(c));
}

test('SCRUM-1723 · control positivo sembrado: los contadores ven un <style> y un style= fabricados', () => {
  const sembrado = '<div><style>p{color:red}</style><span style="color:#ef4444">x</span><p>style= en un texto no cuenta</p></div>';
  assert.equal(estilosEnLinea(sembrado).length, 1, 'el contador de <style> no ve el sembrado: está CIEGO');
  assert.equal(atributosStyle(sembrado).length, 1, 'el contador de style= no ve el sembrado: está CIEGO');
  assert.deepEqual(clasesNuevas('<span class="a pago-x row-value row-value-y">'), ['pago-x', 'row-value-y'], 'el extractor de clases está CIEGO');
});

async function sinEstiloEnLinea(ruta, clave, m, suelo) {
  const cuerpo = await pagina(ruta, m);
  assert.ok(cuerpo.includes(suelo), `suelo: la página no pintó «${suelo}»`);
  assert.deepEqual(estilosEnLinea(cuerpo), []);
  assert.deepEqual(atributosStyle(cuerpo), []);
  assert.ok(cuerpo.includes(etiquetaEstiloDePago(clave)), 'la hoja de esta página no está enlazada');
  for (const c of clasesNuevas(cuerpo)) {
    assert.ok(PAGO_CSS[clave].includes(`.${c}{`) || PAGO_CSS[clave].includes(`.row-value.${c}{`),
      `la clase ${c} del marcado no tiene regla en la hoja de «${clave}»`);
  }
}

test('SCRUM-1723 · /pay/bank: 0 <style>, 0 style= y su hoja enlazada', async () => {
  await sinEstiloEnLinea('/pay/bank/tok1723', 'banco', merchant(), 'Copiar IBAN');
});

test('SCRUM-1723 · /pay/bank sin cuenta: 0 <style>, 0 style= y su hoja enlazada', async () => {
  await sinEstiloEnLinea('/pay/bank/tok1723', 'banco', merchant({ iban: null }), 'pago-sin-cuenta');
});

test('SCRUM-1723 · /pay/bizum: 0 <style>, 0 style= y su hoja enlazada', async () => {
  await sinEstiloEnLinea('/pay/bizum/tok1723', 'bizum', merchant(), 'Copiar móvil');
});

test('SCRUM-1723 · /pay/invoice: 0 <style>, 0 style= y su hoja enlazada', async () => {
  await sinEstiloEnLinea('/pay/invoice/tok1723', 'factura', merchant(), 'Elige cómo pagar');
});

test('SCRUM-1723 · GET /pay/css/pago.css: CSS de su página, immutable con la huella y no-cache sin ella', async () => {
  for (const clave of Object.keys(PAGO_CSS)) {
    const con = await pedir(hrefEstiloDePago(clave));
    assert.equal(con.status, 200);
    assert.match(String(con.cabeceras['content-type']), /text\/css/);
    assert.match(String(con.cabeceras['cache-control']), /immutable/);
    assert.equal(con.cuerpo, PAGO_CSS[clave]);
    const sin = await pedir(`/pay/css/pago.css?p=${clave}`);
    assert.equal(sin.status, 200);
    assert.equal(sin.cabeceras['cache-control'], 'no-cache');
  }
  // 3 de SCRUM-1723 + 6 de SCRUM-1723c (tarjeta, el aviso de MP y los cuatro estados del resultado de MP).
  assert.equal(Object.keys(PAGO_CSS).length, 9, 'suelo: la hoja tiene que servir las nueve páginas');
});

test('SCRUM-1723 · GET /pay/css/pago.css: una página fuera del conjunto es 404', async () => {
  for (const p of ['', 'otra', 'toString', '__proto__', 'constructor']) {
    const r = await pedir(`/pay/css/pago.css?p=${p}`);
    assert.equal(r.status, 404, `?p=${p} contestó ${r.status}`);
  }
  const control = await pedir('/pay/css/pago.css?p=banco');
  assert.equal(control.status, 200, 'control positivo: una página del conjunto SÍ se sirve');
});

// ── SCRUM-1723c · tarjeta y Mercado Pago ────────────────────────────────────────────────────────
// Tarjeta: las dos páginas de error de `/pay/card/:token`. Para llegar a ellas hace falta un Stripe
// presente: se pone un doble en el `stripe` exportado de `dist/integrations/stripe.js` (la ruta lo lee
// en cada petición). Su `create` LANZA: el camino de dinero no se ejecuta, sólo su página de error.
const stripeMod = require_('./dist/integrations/stripe.js');
const stripeDoble = { checkout: { sessions: { create: async () => { throw new Error('doble de SCRUM-1723c'); } } } };

async function respuesta(ruta, m, extra = {}) {
  cobroActual = {
    id: 7, receiptToken: 'tok1723', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', reference: 'REF-1723', payMethods: null, createdAt: new Date(), intentId: null,
    merchant: m, customer: { id: 3, name: 'Ana', email: null }, ...extra,
  };
  return pedir(ruta);
}

function sinEstiloEnLineaEn(cuerpo, clave, suelo) {
  assert.ok(cuerpo.includes(suelo), `suelo: la página no pintó «${suelo}»`);
  assert.deepEqual(estilosEnLinea(cuerpo), []);
  assert.deepEqual(atributosStyle(cuerpo), []);
  assert.ok(cuerpo.includes(etiquetaEstiloDePago(clave)), `la hoja «${clave}» no está enlazada`);
  for (const c of clasesNuevas(cuerpo)) {
    assert.ok(PAGO_CSS[clave].includes(`.${c}{`), `la clase ${c} del marcado no tiene regla en la hoja de «${clave}»`);
  }
}

test('SCRUM-1723c · /pay/card sin Connect (409): 0 <style>, 0 style= y su hoja enlazada', async () => {
  const antes = stripeMod.stripe;
  stripeMod.stripe = stripeDoble;
  try {
    const r = await respuesta('/pay/card/tok1723', merchant());
    assert.equal(r.status, 409, `contestó ${r.status}: no es la página de «no disponible»`);
    sinEstiloEnLineaEn(r.cuerpo, 'tarjeta', 'pago-tarjeta-enlace');
  } finally { stripeMod.stripe = antes; }
});

test('SCRUM-1723c · /pay/card con Stripe que falla (503): 0 <style>, 0 style= y su hoja enlazada', async () => {
  const antes = stripeMod.stripe;
  stripeMod.stripe = stripeDoble;
  try {
    // El comercio demo (id 1) cobra en plataforma: llega al `create` del doble, que lanza.
    const r = await respuesta('/pay/card/tok1723', merchant({ id: 1 }));
    assert.equal(r.status, 503, `contestó ${r.status}: no es la página de «no se pudo iniciar»`);
    sinEstiloEnLineaEn(r.cuerpo, 'tarjeta', 'pago-tarjeta-enlace');
  } finally { stripeMod.stripe = antes; }
});

test('SCRUM-1723c · /pay/mp sin credenciales (503): 0 <style>, 0 style= y su hoja enlazada', async () => {
  const r = await respuesta('/pay/mp/tok1723', merchant({ mpAccessToken: null }));
  assert.equal(r.status, 503, `contestó ${r.status}: no es el aviso de Mercado Pago`);
  sinEstiloEnLineaEn(r.cuerpo, 'mp-aviso', 'class="emoji"');
});

test('SCRUM-1723c · /pay/mp/:token/result: cada estado enlaza la hoja de SU color', async () => {
  // estado del cobro → estado del resultado → el color de su `statusMap`
  const casos = [['paid', 'approved', '#16a34a'], ['failed', 'rejected', '#dc2626'], ['pending', 'pending', '#d97706'], ['expired', 'expired', '#6b756f']];
  for (const [cobro, estado, color] of casos) {
    const r = await respuesta('/pay/mp/tok1723/result', merchant(), { status: cobro });
    assert.equal(r.status, 200, `${cobro}: contestó ${r.status}`);
    assert.ok(r.cuerpo.includes(`>${estado.toUpperCase()}</span>`), `${cobro}: la página no pintó el estado ${estado}`);
    sinEstiloEnLineaEn(r.cuerpo, `mp-${estado}`, 'pago-mp-concepto');
    assert.ok(PAGO_CSS[`mp-${estado}`].includes(`color:${color};text-wrap`), `la hoja mp-${estado} no lleva el color ${color} en el h1`);
  }
  // Control: las cuatro hojas son distintas entre sí (si no, el color no sigue al estado).
  assert.equal(new Set(casos.map(([, e]) => PAGO_CSS[`mp-${e}`])).size, 4);
});
