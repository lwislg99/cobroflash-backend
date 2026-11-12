// tests/scrum1646c-presupuesto-sin-script-en-linea.test.mjs — SCRUM-1646c (CSP paso 2)
//
// LA PÁGINA DONDE EL CLIENTE FIRMA EL PRESUPUESTO, SIN UN SOLO `<script>` EN LÍNEA NI `on*=`.
//
// Con `script-src 'self'` (SCRUM-1637) el navegador no ejecuta ni un `<script>` sin `src` ni un
// atributo `onclick`, y esta página tenía tres y uno por opción: el cliente no podría elegir ni
// firmar. Aquí se mira, por la PUERTA (la ruta real de `dist`, base doblada):
//
//   1 · el HTML que sale: ningún script ejecutable en línea, ningún `on*=`, UN guion desde 'self'
//       con su huella, y UN bloque de datos (`application/json`, que la CSP no ejecuta);
//   2 · el guion: constante (sin `${`), sin token, sin `innerHTML` ni código nacido de cadena;
//   3 · la caché: `immutable` sólo con la huella buena;
//   4 · la CONDUCTA, ejecutando el guion servido sobre la página: elegir opción, aceptar, el éxito
//       con sus textos, el 409 que recarga. Lo demás de la conducta ya lo miran 1302t, 1302d y 264.
//
// ⛔ Sin red ni base. Control positivo en cada sonda: ven lo que buscan cuando está.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { navegadorDeLaFirma, respuesta, textoDe, datosDeLaFirma } from './_navegador-de-la-firma-del-presupuesto.mjs';
import {
  PRESUPUESTO_FIRMA_JS, HUELLA_PRESUPUESTO_FIRMA_JS, SRC_PRESUPUESTO_FIRMA_JS,
} from '../dist/modules/system/app/routes/quoteDecisionNavegador.js';

const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const { PRESUPUESTO_FIRMA_CSS } = await import('../dist/modules/system/app/routes/quoteDecisionEstilo.js');
const TOKEN = 'c'.repeat(32);

let FILA = null;
inyectarBase({
  'quote.findUnique': ({ where }) => (where.decisionToken === TOKEN ? JSON.parse(JSON.stringify(FILA)) : null),
  'quote.findFirst': ({ where }) => (where.decisionToken === TOKEN ? JSON.parse(JSON.stringify(FILA)) : null),
  'quote.count': () => 0,
}, [LANDING]);
const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);

const opcion = (id, label, precio, recommended) => ({
  id, label, description: '', recommended, total: (precio * 1.21).toFixed(2),
  lines: [{ concept: `Trabajo ${label}`, qty: 1, price: precio, tax: 0.21 }],
});
const TRES = [opcion('basica', 'Básica', 100, false), opcion('completa', 'Completa', 200, true), opcion('total', 'Total', 300, false)];

function fila(extra = {}, merchant = {}) {
  return {
    id: 1646, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1646, revision: 0, seriesYear: 2026,
    decisionToken: TOKEN, validUntil: new Date(Date.now() + 10 * 86400000).toISOString(), paymentTerms: 'FULL_UPFRONT',
    tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), signatureUrl: null,
    merchant: { id: MERCHANT, name: 'Fontanería 1646', legalName: null, taxId: null, country: 'ES', email: null,
      whatsappPhone: null, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid', brandColor: null,
      brandAccentColor: null, logoUrl: null, address: null, clausulasPresupuesto: null, ...merchant },
    customer: { id: CLIENTE, name: 'Cliente 1646' },
    Invoice: [],
    ...extra,
  };
}

const capaDe = (ruta) => quoteDecisionLandingRouter.stack.find((l) => l.route && [].concat(l.route.path).includes(ruta) && l.route.methods.get);

async function pagina(extra = {}, merchant = {}) {
  FILA = fila(extra, merchant);
  const capa = capaDe('/quote/:token');
  assert.ok(capa, 'CIEGO: no encuentro GET /quote/:token en la landing del presupuesto');
  let cuerpo = '';
  const res = { status() { return res; }, setHeader() { return res; }, redirect() { return res; }, send(b) { cuerpo = String(b); return res; } };
  await capa.route.stack.at(-1).handle({ params: { token: TOKEN }, query: {}, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  assert.ok(cuerpo.includes('id="btn-accept"'), 'CIEGO: no es la página de firma del presupuesto');
  return cuerpo;
}

async function guion(v) {
  const capa = capaDe('/quote/js/firma.js');
  assert.ok(capa, '🔴 no hay ruta que sirva el guion de la firma del presupuesto');
  const cab = {};
  let cuerpo = '';
  const res = { setHeader(k, val) { cab[k.toLowerCase()] = val; return res; }, status() { return res; }, send(b) { cuerpo = String(b); return res; } };
  await capa.route.stack.at(-1).handle({ query: v === undefined ? {} : { v } }, res);
  return { cab, cuerpo };
}

// ── Las sondas, puras sobre el HTML ─────────────────────────────────────────────────────────────
/** Etiquetas `<script>` con sus atributos y su texto. */
const scriptsDe = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({
  attrs: Object.fromEntries([...m[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1], a[2]])),
  texto: m[2],
}));
/** Un `<script>` lo ejecuta el navegador salvo que su `type` sea de datos. */
const ejecutable = (s) => !s.attrs.type || /^(?:text|application)\/(?:javascript|ecmascript)$|^module$/i.test(s.attrs.type);
const enLinea = (html) => scriptsDe(html).filter((s) => ejecutable(s) && !s.attrs.src);
const manejadores = (html) => [...html.matchAll(/<[a-zA-Z][^>]*?\s(on[a-z]+)\s*=/g)].map((m) => m[1]);
const servidos = (html) => scriptsDe(html).filter((s) => s.attrs.src).map((s) => s.attrs.src);

test('SCRUM-1646c · control · las sondas ven un script en línea, un onclick y un guion servido', () => {
  const viejo = `<button class="btn-tier" onclick="selectTier('a','b')">x</button><script>let a=1;</script>
    <script type="application/json" id="d">{}</script><script src="/pay/quote/js/firma.js?v=1"></script>`;
  assert.equal(enLinea(viejo).length, 1);
  assert.deepEqual(manejadores(viejo), ['onclick']);
  assert.deepEqual(servidos(viejo), ['/pay/quote/js/firma.js?v=1']);
});

test('🔴 SCRUM-1646c · la página de firma (un precio y tres opciones) sin script en línea ni on*=, con su guion desde \'self\'', async () => {
  for (const [caso, extra] of [['un precio', {}], ['tres opciones', { tiers: TRES }]]) {
    const html = await pagina(extra);
    if (extra.tiers) assert.equal((html.match(/class="btn-tier/g) || []).length, 3, `CIEGO (${caso}): no se han pintado las tres opciones`);
    assert.deepEqual(enLinea(html).map((s) => s.texto.slice(0, 60)), [], `🔴 ${caso}: queda un <script> en línea que la CSP bloquearía`);
    assert.deepEqual(manejadores(html), [], `🔴 ${caso}: queda un atributo on*= que la CSP bloquearía`);
    assert.deepEqual(servidos(html), [SRC_PRESUPUESTO_FIRMA_JS], `${caso}: un solo guion, el de la firma, con su huella`);
    assert.ok(SRC_PRESUPUESTO_FIRMA_JS.startsWith('/'), "el guion se pide al propio servidor ('self')");
    const { datos } = datosDeLaFirma(html);
    assert.equal(datos.decisionUrl, `/quote/${TOKEN}/decision`, `${caso}: la ruta del POST viaja en los datos`);
    // El bloque de datos va ANTES del guion: el guion lo lee al cargar.
    assert.ok(html.indexOf('id="presupuesto-firma-datos"') < html.indexOf(SRC_PRESUPUESTO_FIRMA_JS), `${caso}: los datos van antes del guion`);
  }
});

test('🔴 SCRUM-1646c · el guion es CONSTANTE: sin sustituciones, sin token, sin innerHTML ni código de cadena', () => {
  assert.ok(PRESUPUESTO_FIRMA_JS.includes("getElementById('btn-accept')"), 'CIEGO: no es el guion de la firma');
  assert.equal(PRESUPUESTO_FIRMA_JS.includes('${'), false, '🔴 el guion lleva una sustitución: un dato dentro del código');
  assert.equal(PRESUPUESTO_FIRMA_JS.includes(TOKEN), false);
  for (const prohibido of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function']) {
    assert.equal(PRESUPUESTO_FIRMA_JS.includes(prohibido), false, `🔴 el guion usa ${prohibido}`);
  }
  assert.equal(HUELLA_PRESUPUESTO_FIRMA_JS, crypto.createHash('sha1').update(PRESUPUESTO_FIRMA_JS).digest('hex').slice(0, 10), 'la huella es la del contenido');
  assert.equal(SRC_PRESUPUESTO_FIRMA_JS, `/pay/quote/js/firma.js?v=${HUELLA_PRESUPUESTO_FIRMA_JS}`);
});

test('🔴 SCRUM-1646c · la ruta sirve el guion, y promete immutable SÓLO con la huella buena', async () => {
  const bueno = await guion(HUELLA_PRESUPUESTO_FIRMA_JS);
  assert.equal(bueno.cuerpo, PRESUPUESTO_FIRMA_JS);
  assert.match(bueno.cab['content-type'], /^application\/javascript/);
  assert.match(bueno.cab['cache-control'], /immutable/);
  for (const v of [undefined, '0000000000', '']) {
    const r = await guion(v);
    assert.equal(r.cab['cache-control'], 'no-cache', `huella ${JSON.stringify(v)}: no se promete inmutable`);
  }
});

test('🔴 SCRUM-1646c · los datos no abren HTML: un «</script>» en el nombre del negocio no cierra el bloque', async () => {
  const html = await pagina({}, { name: 'Taller </script><script>alert(1)</script>' });
  assert.deepEqual(enLinea(html), [], '🔴 el nombre del negocio ha cerrado el bloque de datos y abierto un script');
  assert.equal(datosDeLaFirma(html).datos.textos.confirmacion, 'Taller </script><script>alert(1)</script> ya tiene tu confirmación.');
});

// ARREGLO DE CONDUCTA (docs/BUGS.md P1-1646c): en main, con un `'` en el nombre del negocio, el tercer
// `<script>` en línea era `SyntaxError: Unexpected identifier` (el enlace de compartir iba con
// `encodeURIComponent`, que no escapa `'`, dentro de un literal JS de comilla simple) y «Firmar y
// aceptar» no hacía nada. Prueba compilada en docs/master/evidencias/SCRUM-1646c/capturas.salida.txt.
// Aquí se fija que con el nombre en JSON la firma sale, el POST va y el éxito lleva el nombre tal cual.
test('🔴 SCRUM-1646c · ARREGLO · un nombre de negocio con «\'», «&», «<>» y «"» firma, envía y pinta el éxito', async () => {
  const nombre = 'Fontanería & Hijos <Sur> \'Pepe\' "el Rápido"';
  const html = await pagina({}, { name: nombre });
  assert.deepEqual(enLinea(html), [], 'el nombre no abre script en línea');
  let enviado = null;
  const nav = navegadorDeLaFirma(html, PRESUPUESTO_FIRMA_JS, async (url, init) => { enviado = { url, cuerpo: JSON.parse(init.body) }; return respuesta(200, { ok: true }); },
    { firma: 'data:image/png;base64,AAAA' });
  await nav.aceptar();
  assert.ok(enviado, '🔴 con un apóstrofo en el nombre el botón no ha enviado nada (el defecto de main)');
  assert.equal(enviado.cuerpo.decision, 'accept');
  const caja = nav.card().children[0];
  assert.ok(caja, '🔴 el éxito no se ha pintado');
  assert.equal(textoDe(caja.children[2]), `${nombre} ya tiene tu confirmación.`);
  const a = caja.children.find((c) => c.className === 'btn-share');
  assert.equal(a.href, `https://wa.me/?text=${encodeURIComponent(`✅ He aceptado mi presupuesto con ${nombre}. ¡Gracias!`)}`);
});

test('🔴 SCRUM-1646c · CONDUCTA · elegir una opción hace lo que hacía el onclick, y la aceptación lleva esa opción', async () => {
  const html = await pagina({ tiers: TRES });
  let enviado = null;
  const nav = navegadorDeLaFirma(html, PRESUPUESTO_FIRMA_JS, async (url, init) => { enviado = { url, cuerpo: JSON.parse(init.body) }; return respuesta(200, { ok: true }); },
    { firma: 'data:image/png;base64,AAAA' });
  // SCRUM-1646d: la firma nace oculta por la CLASE y la hoja servida desde 'self', no por un `style=` que
  // la CSP (style-src 'self') bloquearía. Se exigen las dos mitades: la clase en el HTML y la regla en la hoja.
  assert.equal(nav.el('btn-accept-wrapper').attrs.style, undefined, 'el bloque de firma no lleva style= en el HTML');
  assert.ok(nav.el('btn-accept-wrapper').classList.contains('oculto-hasta-elegir'), 'CONTROL: con opciones la firma nace oculta (clase)');
  assert.match(PRESUPUESTO_FIRMA_CSS, /#btn-accept-wrapper\.oculto-hasta-elegir\s*\{\s*display:\s*none\s*\}/, 'CONTROL: la hoja servida oculta esa clase');
  await nav.elegir('completa');
  const tarjeta = nav.opciones.find((o) => o.getAttribute('data-tier-id') === 'completa');
  assert.ok(tarjeta.classList.contains('selected'), 'la opción elegida queda marcada');
  assert.equal(nav.opciones.filter((o) => o.classList.contains('selected')).length, 1);
  assert.equal(nav.el('btn-accept-wrapper').style.display, 'block', 'se muestra el bloque de firma');
  assert.equal(nav.el('tier-confirm').style.display, 'block');
  assert.match(nav.el('chosen-tier-label').textContent, /^Completa · 242,00\s€$/); // \s: el dinero lleva espacio duro
  assert.match(nav.el('btn-accept').textContent, /^Firmar y aceptar — Completa \(242,00\s€\)$/);
  assert.equal(nav.porClase('amount-hero-label').textContent, 'Total · Completa · IVA incluido', 'el héroe dice la opción, y el IVA sólo porque hay cuota');
  assert.match(nav.porClase('amount-hero-value').textContent, /^242,00\s€$/);
  await nav.aceptar();
  assert.equal(enviado.url, `/quote/${TOKEN}/decision`);
  assert.deepEqual([enviado.cuerpo.decision, enviado.cuerpo.tierId, enviado.cuerpo.comment], ['accept', 'completa', 'Aceptado con firma digital']);
});

test('🔴 SCRUM-1646c · CONDUCTA · el éxito: mismos textos y mismo enlace de compartir; sin pago lo dice', async () => {
  const html = await pagina();
  const nav = navegadorDeLaFirma(html, PRESUPUESTO_FIRMA_JS, async () => respuesta(200, { ok: true }), { firma: 'data:image/png;base64,AAAA' });
  await nav.aceptar();
  const caja = nav.card().children[0];
  assert.ok(caja, '🔴 el éxito no se ha pintado en la tarjeta');
  assert.deepEqual(caja.children.map((c) => c.tagName), ['DIV', 'H1', 'P', 'P', 'A'], 'el mismo árbol que el innerHTML de antes (ES real sin cobro: con la línea de sin pago)');
  assert.equal(textoDe(caja.children[1]), '¡Presupuesto aceptado y firmado!');
  assert.equal(textoDe(caja.children[2]), 'Fontanería 1646 ya tiene tu confirmación.');
  assert.equal(caja.children[3].className, 'sin-pago');
  const a = caja.children[4];
  assert.equal(a.className, 'btn-share');
  assert.equal(a.href, `https://wa.me/?text=${encodeURIComponent('✅ He aceptado mi presupuesto con Fontanería 1646. ¡Gracias!')}`);
  assert.equal(textoDe(a), 'Compartir por WhatsApp');
  // Sin firma: «aceptado» a secas.
  const sin = navegadorDeLaFirma(html, PRESUPUESTO_FIRMA_JS, async () => respuesta(200, { ok: true }), { firma: null, sinFirmar: true });
  await sin.aceptar();
  assert.equal(textoDe(sin.card().children[0].children[1]), '¡Presupuesto aceptado!');
});

test('SCRUM-1646c · CONDUCTA · sin firma ni casilla no se envía nada, y el 409 de «ya decidido» recarga', async () => {
  const html = await pagina();
  const nada = navegadorDeLaFirma(html, PRESUPUESTO_FIRMA_JS, async () => respuesta(200, {}), { firma: null, sinFirmar: false });
  await nada.aceptar();
  assert.equal(nada.peticiones.length, 0);
  assert.equal(nada.el('sig-error').style.display, 'block');
  const { ERROR_PRESUPUESTO_YA_DECIDIDO } = await import('../dist/modules/quotes/domain/decisionDelCliente.js');
  const r = navegadorDeLaFirma(html, PRESUPUESTO_FIRMA_JS, async () => respuesta(409, { error: ERROR_PRESUPUESTO_YA_DECIDIDO }), { firma: 'data:x' });
  await r.aceptar();
  assert.equal(r.recargas(), 1);
});
