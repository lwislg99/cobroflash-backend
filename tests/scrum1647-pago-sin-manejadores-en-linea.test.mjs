// SCRUM-1647 (CSP paso 2, mitad J2) · LAS TRES PÁGINAS DE PAGO SIN CÓDIGO EN LÍNEA.
//
// Con `script-src 'self'` aplicada (SCRUM-1637, paso 3) no corre ni un `on*=` ni un `<script>` sin
// `src`. Medido el 12-nov-2026 sobre `origin/main` = `9cdf6a24d`: `/pay/bank` llevaba 3
// `onclick="copyText(…)"` y un `<script>`; `/pay/bizum`, un `onerror` en el logo y un `<script>`;
// `/pay/invoice`, un `onerror` en el logo. El guion pasa a `pagoNavegador.ts`, servido en
// `GET /pay/js/pago.js?v=<huella>`, y los datos a `data-copy` escapados.
//
// QUÉ MIRA, POR LA RUTA DE VERDAD (la `app` de `dist/app.js`, con sus montajes y su orden; sólo
// prisma es un doble, instalado en `require.cache`: ni BD, ni red, ni una firma de `src/` tocada):
//   ① el HTML SERVIDO de las tres páginas: 0 `on*=` y 0 `<script>` sin `src`, y el guion enlazado;
//   ② el guion se sirve desde `/pay` con su huella (y `no-cache` sin ella);
//   ③ COMPORTAMIENTO: el guion, ejecutado contra un DOM doble, copia lo mismo que copiaba antes
//      (el valor del `data-copy` del HTML servido, descodificado) y oculta el logo que no carga.
// Cada contador lleva su CONTROL POSITIVO sembrado (no prestado del árbol): un HTML fabricado con
// un `onerror` y un `<script>` en línea TIENE que dar 1 y 1; si da 0, el contador está ciego.
//
// ⚠️ ③ NO es un navegador: es un DOM doble con lo que el guion usa (`addEventListener`, `closest`,
// `dataset`, `classList`, portapapeles). Lo que no mide: que Edge/Chrome ejecuten el guion con la CSP
// puesta. Eso lo dice el recorrido en yaqu.app de la aceptación del ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo
// a como estaba, o rompe el guion, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El botón del IBAN vuelve a llevar su `onclick`.
    fichero: 'src/modules/billing/app/routes/payBank.routes.ts',
    de: 'data-copy="${esc(iban)}"',
    a: 'onclick="copyText(\'${esc(iban)}\', this)"',
    cae: 'SCRUM-1647 · /pay/bank (IBAN): 0 on*=, 0 script en línea, guion enlazado, y copia el IBAN y la referencia',
  },
  {
    // El logo de Bizum vuelve a llevar su `onerror`.
    fichero: 'src/modules/billing/app/routes/payBizum.routes.ts',
    de: 'alt="${business}"/>`',
    a: 'alt="${business}" onerror="this.style.display=\'none\'"/>`',
    cae: 'SCRUM-1647 · /pay/bizum: 0 on*=, 0 script en línea, guion enlazado y logo sin onerror',
  },
  {
    // El logo del selector vuelve a llevar su `onerror`.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: 'alt="${business}"/>`',
    a: 'alt="${business}" onerror="this.style.display=\'none\'"/>`',
    cae: 'SCRUM-1647 · /pay/invoice: 0 on*=, 0 script en línea, guion enlazado y logo sin onerror',
  },
  {
    // El guion se sirve siempre sin caché: la huella deja de decidir.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: 'cacheDelGuionDePago(req.query?.v)',
    a: "'no-cache'",
    cae: 'SCRUM-1647 · GET /pay/js/pago.js se sirve desde la app: JS, immutable con la huella y no-cache sin ella',
  },
  {
    // El error de la imagen se escucha en burbuja: no llega nunca.
    fichero: 'src/modules/billing/app/routes/pagoNavegador.ts',
    de: "t.style.display='none';\n},true);",
    a: "t.style.display='none';\n},false);",
    cae: 'SCRUM-1647 · comportamiento: el logo que no carga se oculta (escucha en captura), y una imagen ajena no',
  },
  {
    // La página de transferencia deja de copiar.
    fichero: 'src/modules/billing/app/routes/pagoNavegador.ts',
    de: "if(pagina==='banco')copiarBanco",
    a: "if(pagina==='transferencia')copiarBanco",
    cae: 'SCRUM-1647 · comportamiento /pay/bank: copiar escribe el data-copy, pinta ¡Copiado! con la clase y vuelve a los 2000 ms',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const IBAN = 'ES9121000418450200051332';
const CLABE = '032180000118359719';
const REFERENCIA = `REF-7&"<'x`; // con los cinco caracteres que escapa `esc`: el `data-copy` tiene que devolverlos tal cual
const LOGO = 'https://logo.ejemplo.test/roto.png';

function merchant(extra = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
    country: 'ES', logoUrl: LOGO, iban: IBAN, clabe: null, bizumPhone: '600111222', whatsappPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: { BIZUM_MANUAL_ENABLED: true }, deletedAt: null,
    ...extra,
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
const { PAGO_JS, HUELLA_PAGO_JS, SRC_PAGO_JS, etiquetaGuionDePago } = require_('./dist/modules/billing/app/routes/pagoNavegador.js');

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
    id: 7, receiptToken: 'tok1647', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', reference: REFERENCIA, payMethods: null, createdAt: new Date(),
    merchant: m, customer: { id: 3, name: 'Ana', email: null },
  };
  const r = await pedir(ruta);
  assert.equal(r.status, 200, `${ruta} no contestó 200 (contestó ${r.status}): no hay HTML que contar`);
  return r;
}

// ── Los contadores: sobre las ETIQUETAS del HTML, no sobre el texto ────────────────────────────
// Un `on…=` sólo es manejador DENTRO de una etiqueta; fuera (en un texto) no ejecuta nada.
const ETIQUETA = /<[a-zA-Z][^<>]*>/g;
const MANEJADOR = /\son[a-z]+\s*=/i;
function manejadoresEnLinea(html) {
  return (html.match(ETIQUETA) || []).filter((t) => MANEJADOR.test(t));
}
function scriptsEnLinea(html) {
  return (html.match(/<script\b[^>]*>/gi) || []).filter((t) => !/\ssrc\s*=/i.test(t));
}
function descodificar(v) {
  return v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function datosCopy(html) {
  return [...html.matchAll(/data-copy="([^"]*)"/g)].map((x) => descodificar(x[1]));
}

test('SCRUM-1647 · control positivo sembrado: los contadores ven un manejador y un script en línea fabricados', () => {
  const sembrado = `<div><img class="logo-img" src="x" onerror="this.style.display='none'"/><script>var a=1</script><script src="/ok.js"></script><p>onclick= en un texto no cuenta</p></div>`;
  assert.equal(manejadoresEnLinea(sembrado).length, 1, 'el contador de on*= no ve el manejador sembrado: está CIEGO');
  assert.equal(scriptsEnLinea(sembrado).length, 1, 'el contador de <script> en línea no ve el sembrado: está CIEGO');
});

test('SCRUM-1647 · /pay/bank (IBAN): 0 on*=, 0 script en línea, guion enlazado, y copia el IBAN y la referencia', async () => {
  const { cuerpo, cabeceras } = await pagina('/pay/bank/tok1647', merchant());
  assert.ok(cuerpo.includes('Copiar IBAN') && cuerpo.includes('Copiar referencia'), 'suelo: la página no pintó sus botones');
  assert.ok(cabeceras['content-security-policy-report-only'], 'la cabecera del paso 1 no está en la respuesta');
  assert.deepEqual(manejadoresEnLinea(cuerpo), []);
  assert.deepEqual(scriptsEnLinea(cuerpo), []);
  assert.ok(cuerpo.includes(etiquetaGuionDePago('banco')) && etiquetaGuionDePago('banco').includes(SRC_PAGO_JS), 'el guion de pago no está enlazado');
  assert.deepEqual(datosCopy(cuerpo), [IBAN, REFERENCIA]);
});

test('SCRUM-1647 · /pay/bank (CLABE, México): 0 on*= y copia la CLABE', async () => {
  const { cuerpo } = await pagina('/pay/bank/tok1647', merchant({ country: 'MX', iban: null, clabe: CLABE }));
  assert.ok(cuerpo.includes('Copiar CLABE'), 'suelo: la página no pintó el botón de la CLABE');
  assert.deepEqual(manejadoresEnLinea(cuerpo), []);
  assert.deepEqual(scriptsEnLinea(cuerpo), []);
  assert.deepEqual(datosCopy(cuerpo), [CLABE, REFERENCIA]);
});

test('SCRUM-1647 · /pay/bizum: 0 on*=, 0 script en línea, guion enlazado y logo sin onerror', async () => {
  const { cuerpo } = await pagina('/pay/bizum/tok1647', merchant());
  assert.ok(cuerpo.includes('Copiar móvil') && cuerpo.includes('class="logo-img"'), 'suelo: la página no pintó el botón o el logo');
  assert.deepEqual(manejadoresEnLinea(cuerpo), []);
  assert.deepEqual(scriptsEnLinea(cuerpo), []);
  assert.ok(cuerpo.includes(etiquetaGuionDePago('bizum')) && etiquetaGuionDePago('bizum').includes(SRC_PAGO_JS), 'el guion de pago no está enlazado');
});

test('SCRUM-1647 · /pay/invoice: 0 on*=, 0 script en línea, guion enlazado y logo sin onerror', async () => {
  const { cuerpo } = await pagina('/pay/invoice/tok1647', merchant());
  assert.ok(cuerpo.includes('class="logo-img"'), 'suelo: la página no pintó el logo');
  assert.deepEqual(manejadoresEnLinea(cuerpo), []);
  assert.deepEqual(scriptsEnLinea(cuerpo), []);
  assert.ok(cuerpo.includes(etiquetaGuionDePago('factura')) && etiquetaGuionDePago('factura').includes(SRC_PAGO_JS), 'el guion de pago no está enlazado');
});

test('SCRUM-1647 · GET /pay/js/pago.js se sirve desde la app: JS, immutable con la huella y no-cache sin ella', async () => {
  const con = await pedir(SRC_PAGO_JS);
  assert.equal(con.status, 200);
  assert.match(String(con.cabeceras['content-type']), /javascript/);
  assert.match(String(con.cabeceras['cache-control']), /immutable/);
  assert.equal(con.cuerpo, PAGO_JS);
  const sin = await pedir('/pay/js/pago.js?v=otra');
  assert.equal(sin.status, 200);
  assert.equal(sin.cabeceras['cache-control'], 'no-cache');
  assert.equal(HUELLA_PAGO_JS.length, 10);
  assert.ok(!PAGO_JS.includes('${'), 'el guion lleva una interpolación: un dato podría viajar dentro del código');
});

// ── ③ El guion, ejecutado ──────────────────────────────────────────────────────────────────────
function banco(pagina) {
  const escuchas = [];
  const copiado = [];
  const relojes = [];
  const documento = {
    currentScript: { getAttribute: (n) => (n === 'data-pagina' ? pagina : null) },
    addEventListener: (tipo, fn, captura) => escuchas.push({ tipo, fn, captura: !!captura }),
  };
  const contexto = {
    document: documento,
    navigator: { clipboard: { writeText: (t) => { copiado.push(t); return Promise.resolve(); } } },
    setTimeout: (fn, ms) => { relojes.push({ fn, ms }); return relojes.length; },
  };
  vm.runInNewContext(PAGO_JS, contexto);
  const disparar = (tipo, objetivo) => { for (const e of escuchas) if (e.tipo === tipo) e.fn({ target: objetivo }); };
  return { escuchas, copiado, relojes, disparar };
}
function boton(copy, label) {
  const clases = new Set();
  const b = {
    textContent: label,
    dataset: { label },
    getAttribute: (n) => (n === 'data-copy' ? copy : n === 'data-label' ? label : null),
    classList: { add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c) },
    closest: (sel) => (sel === '.copy-btn[data-copy]' ? b : null),
    clases,
  };
  return b;
}
const tic = () => new Promise((r) => setImmediate(r));

test('SCRUM-1647 · comportamiento /pay/bank: copiar escribe el data-copy, pinta ¡Copiado! con la clase y vuelve a los 2000 ms', async () => {
  const b = banco('banco');
  const btn = boton(IBAN, 'Copiar IBAN');
  b.disparar('click', btn);
  await tic();
  assert.deepEqual(b.copiado, [IBAN]);
  assert.equal(btn.textContent, '¡Copiado!');
  assert.ok(btn.clases.has('copied'));
  assert.deepEqual(b.relojes.map((r) => r.ms), [2000]);
  b.relojes[0].fn();
  assert.equal(btn.textContent, 'Copiar IBAN');
  assert.ok(!btn.clases.has('copied'));
});

test('SCRUM-1647 · comportamiento /pay/bizum: copiar escribe el data-copy, pinta ¡Copiado! sin clase y vuelve a los 1600 ms', async () => {
  const b = banco('bizum');
  const btn = boton('600111222', 'Copiar móvil');
  b.disparar('click', btn);
  await tic();
  assert.deepEqual(b.copiado, ['600111222']);
  assert.equal(btn.textContent, '¡Copiado!');
  assert.ok(!btn.clases.has('copied'));
  assert.deepEqual(b.relojes.map((r) => r.ms), [1600]);
  b.relojes[0].fn();
  assert.equal(btn.textContent, 'Copiar móvil');
});

test('SCRUM-1647 · comportamiento: el logo que no carga se oculta (escucha en captura), y una imagen ajena no', () => {
  const b = banco('factura');
  assert.ok(b.escuchas.some((e) => e.tipo === 'error' && e.captura), 'el error de imagen no burbujea: sin captura no llega');
  const logo = { tagName: 'IMG', classList: { contains: (c) => c === 'logo-img' }, style: {} };
  const otra = { tagName: 'IMG', classList: { contains: () => false }, style: {} };
  b.disparar('error', logo);
  b.disparar('error', otra);
  assert.equal(logo.style.display, 'none');
  assert.equal(otra.style.display, undefined);
  // En la página de factura no hay botones de copiar: un clic no copia nada.
  b.disparar('click', boton('x', 'y'));
  assert.deepEqual(b.copiado, []);
});
