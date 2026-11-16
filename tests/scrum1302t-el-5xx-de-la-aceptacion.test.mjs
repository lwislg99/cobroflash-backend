// tests/scrum1302t-el-5xx-de-la-aceptacion.test.mjs — SCRUM-1302t
//
// Medido el 14-oct-2026 (SCRUM-1302 c.19714): cuando ACEPTAR contesta un 5xx, la landing pintaba bajo
// la firma el código crudo (`internal_error`), y el 500 también sale DESPUÉS del commit
// (`congelarCliente` fuera del `try`, `TipoIvaNoEmitibleError` sin recoger): el cliente leía un
// error con la aceptación ya guardada.
//
// Literal firmado por el orquestador por delegación del fundador (SCRUM-1302 c.19719), con una
// CONDICIÓN que este fichero ata: el texto manda a volver a abrir el enlace, así que volver a abrirlo
// TIENE que enseñar el estado decidido. Si no lo enseñara, el texto mandaría a un sitio que no contesta.
//
// Por la PUERTA: la página se pide a su ruta de verdad (`dist`) con la base doblada, y el script del
// botón que sale en ese HTML se EJECUTA con un `fetch` doblado. ⛔ Sin red ni base.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { navegadorDeLaFirma, respuesta, textoDe } from './_navegador-de-la-firma-del-presupuesto.mjs';
import { PRESUPUESTO_FIRMA_JS } from '../dist/modules/system/app/routes/quoteDecisionNavegador.js';

const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const TOKEN = 'f'.repeat(32); // hexadecimal: `parseToken` no deja pasar otra cosa (y entonces sale el 404)
const FIRMADO = 'No hemos podido confirmar tu respuesta. Vuelve a abrir el enlace para ver si se ha guardado.';

// Las mutaciones que este fichero tiene que cazar; las corre `npm run meta:mutaciones` en cada PR.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · sin la rama del 5xx: vuelve el código crudo. (SCRUM-1646c: la rama vive en el guion servido.)
    fichero: 'src/modules/system/app/routes/quoteDecisionNavegador.ts',
    de: '}else if(res.status>=500){',
    a: '}else if(res.status>=600){',
    cae: 'SCRUM-1302t · 🔴 un 5xx al aceptar enseña el literal firmado, nunca el código crudo',
  },
  {
    // M2 · la condición de la firma: el enlace de un aceptado vuelve a pintar el formulario.
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: "} else if (quote.status === 'accepted') {",
    a: "} else if (quote.status === 'accepted' && quote.id < 0) {",
    cae: 'SCRUM-1302t · 🔴 LA CONDICIÓN: volver a abrir el enlace enseña el estado decidido, no el formulario',
  },
];

let FILA = null;
inyectarBase({
  'quote.findUnique': ({ where }) => (where.decisionToken === TOKEN ? JSON.parse(JSON.stringify(FILA)) : null),
  'quote.findFirst': ({ where }) => (where.decisionToken === TOKEN ? JSON.parse(JSON.stringify(FILA)) : null),
  'quote.count': () => 0,
}, [LANDING]);
const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);

function fila(extra = {}) {
  return {
    id: 1302, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1302, revision: 0, seriesYear: 2026,
    decisionToken: TOKEN, validUntil: new Date(Date.now() + 10 * 86400000).toISOString(), paymentTerms: 'FULL_UPFRONT',
    tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), signatureUrl: null,
    merchant: { id: MERCHANT, name: 'Fontanería 1302', legalName: null, taxId: null, country: 'ES', email: null,
      whatsappPhone: null, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid', brandColor: null,
      brandAccentColor: null, logoUrl: null, address: null, clausulasPresupuesto: null },
    customer: { id: CLIENTE, name: 'Cliente 1302' },
    Invoice: [],
    ...extra,
  };
}

async function pagina(extra = {}) {
  FILA = fila(extra);
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route && [].concat(l.route.path).includes('/quote/:token') && l.route.methods.get);
  assert.ok(capa, 'CIEGO: no encuentro GET /quote/:token en la landing del presupuesto');
  let cuerpo = '';
  const res = { status() { return res; }, setHeader() { return res; }, redirect() { return res; }, send(b) { cuerpo = String(b); return res; } };
  await capa.route.stack.at(-1).handle({ params: { token: TOKEN }, query: {}, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  return cuerpo;
}

/**
 * Pulsa «Firmar y aceptar» en la página servida, con la respuesta del servidor que se le pase, y
 * devuelve lo que queda escrito bajo la firma. Ejecuta el guion REAL, no una copia.
 * SCRUM-1646c · el guion ya no va en línea (CSP `script-src 'self'`): es el que sirve
 * `GET /pay/quote/js/firma.js`, y lee sus textos del bloque de datos de ESTA página.
 */
async function pulsarAceptar(html, resp) {
  const nav = navegadorDeLaFirma(html, PRESUPUESTO_FIRMA_JS, async () => {
    if (resp === 'red') throw new TypeError('Failed to fetch');
    return respuesta(resp.status, resp.cuerpo);
  }, { firma: null, sinFirmar: true });
  assert.ok(nav.el('btn-accept')?.oyentes.click?.length, 'CIEGO: el guion no ha enganchado el clic de «Firmar y aceptar»');
  await nav.aceptar();
  assert.equal(nav.peticiones.length, 1, 'CIEGO: el clic no ha llegado a pedir la decisión');
  const aviso = nav.el('sig-error');
  return { aviso: aviso.textContent, avisoVisible: aviso.style.display === 'block', exito: textoDe(nav.card().children[0]), recargas: nav.recargas(), boton: nav.el('btn-accept') };
}

test('SCRUM-1302t · CONTROL POSITIVO: la sonda ve el éxito con un 200 y el código con un 4xx sin texto (SCRUM-264, sin cambio)', async () => {
  const html = await pagina();
  const ok = await pulsarAceptar(html, { status: 200, cuerpo: { ok: true } });
  assert.ok(ok.exito.includes('ya tiene tu confirmación'), '🔴 la sonda no ve el éxito: lo de abajo no probaría nada');
  const cuatro = await pulsarAceptar(html, { status: 400, cuerpo: { error: 'invalid_decision' } });
  assert.equal(cuatro.aviso, 'invalid_decision', 'un 4xx sin `message` sigue como lo dejó SCRUM-264: esto no lo cambia 1302t');
});

test('SCRUM-1302t · 🔴 un 5xx al aceptar enseña el literal firmado, nunca el código crudo', async () => {
  const html = await pagina();
  for (const [caso, resp] of [
    ['500 de la ruta', { status: 500, cuerpo: { error: 'internal_error' } }],
    ['502 del proxy, sin JSON', { status: 502 }],
    ['503 con un texto que no sabe si se guardó', { status: 503, cuerpo: { error: 'x', message: 'Error al procesar.' } }],
  ]) {
    const r = await pulsarAceptar(html, resp);
    assert.equal(r.aviso, FIRMADO, `${caso}: no se lee el literal firmado`);
    assert.equal(r.avisoVisible, true, `${caso}: el aviso no se ve`);
    assert.equal(/internal_error|API \d{3}|Inténtalo/.test(r.aviso), false, `${caso}: código crudo o consejo de repetir`);
    assert.equal(r.boton.disabled, false, `${caso}: el botón se queda en «Enviando…»`);
    assert.equal(r.exito, '', `${caso}: pinta el éxito`);
  }
});

test('SCRUM-1302t · el 409 «ya decidido» sigue recargando y la red caída sigue con su texto (B): no se mezclan', async () => {
  const html = await pagina();
  const { ERROR_PRESUPUESTO_YA_DECIDIDO } = await import('../dist/modules/quotes/domain/decisionDelCliente.js');
  const yaDecidido = await pulsarAceptar(html, { status: 409, cuerpo: { error: ERROR_PRESUPUESTO_YA_DECIDIDO } });
  assert.equal(yaDecidido.recargas, 1);
  const red = await pulsarAceptar(html, 'red');
  assert.equal(red.aviso, 'No hemos podido confirmar que tu firma haya llegado. Comprueba tu conexión y vuelve a intentarlo.');
});

test('SCRUM-1302t · 🔴 LA CONDICIÓN: volver a abrir el enlace enseña el estado decidido, no el formulario', async () => {
  // Control: el mismo enlace sin decidir pinta el formulario (si no, «sin formulario» no probaría nada).
  const sinDecidir = await pagina();
  assert.ok(sinDecidir.includes('id="btn-accept"'), 'CIEGO: la página sin decidir no pinta el formulario');
  // Se guardó: el 5xx llegó después del commit.
  const aceptado = await pagina({ status: 'accepted', acceptedAt: new Date().toISOString() });
  assert.ok(aceptado.includes('Ya aceptaste este presupuesto'), '🔴 el enlace de un aceptado no dice que ya se aceptó');
  assert.equal(aceptado.includes('id="btn-accept"'), false, '🔴 el enlace de un aceptado vuelve a ofrecer aceptar');
  // Y con la validez ya pasada (el 5xx a última hora): `isQuoteExpired` sólo mira `sent`, no lo tapa.
  const aceptadoVencido = await pagina({ status: 'accepted', acceptedAt: new Date().toISOString(), validUntil: '2026-01-01T00:00:00.000Z' });
  assert.ok(aceptadoVencido.includes('Ya aceptaste este presupuesto'), '🔴 un aceptado con la validez pasada sale como caducado');
  // No se guardó: el 5xx llegó antes. El enlace vuelve a dejar aceptar, y eso también contesta.
  assert.ok(sinDecidir.includes('id="btn-accept"'));
});
