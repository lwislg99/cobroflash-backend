// SCRUM-1713 · El cinturón de J1 (decisión del fundador en SCRUM-1713 c.21583, punto 2, dentro del
// GO de SCRUM-1585 c.20531): con `INVOICING_ES_ENABLED` puesto y el SII en «Sí» o «No consta», las
// dos rutas de J1 que piden una factura contestan el CÓDIGO del motivo (`sii_declarado` /
// `sii_no_consta`, los de `motivoSiiSinEmision`) y no el genérico. Sin texto nuevo.
//
//   · POST /admin/invoices (factura suelta): antes, 409 `factura_suelta_no_disponible`.
//   · POST /admin/invoices/:id/rectify: antes NO tenía puerta de modo; el embudo
//     (`allocateInvoiceNumber`) lanzaba `sii_*` y el `catch` lo convertía en 500 `internal_error`.
//
// Se prueba por la RUTA montada en express, con `requireRole` delante y por HTTP, no sacando el
// handler de su pila (A10: «Un test que saca el handler de su ruta prueba el handler, no la ruta»).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'error: motivoSiiSinEmision(merchant) ?? ERROR_MODO_SIN_FACTURA,',
    a: 'error: ERROR_MODO_SIN_FACTURA,', cae: 'factura suelta con el flag puesto' },
  { fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'if (motivoSii) {',
    a: 'if (false) {', cae: 'rectificar con el flag puesto' },
  { fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'const motivoSii = motivoSiiSinEmision(original.merchant);',
    a: "const motivoSii = 'sii_declarado';", cae: 'la rectificativa PASA la puerta del SII' },
];

const require = createRequire(import.meta.url);
const express = require('express');

/** El merchant que devuelve la base. Se cambia por caso: flag y respuesta del SII. */
let merchant = null;
function merchantCon({ flag, sii }) {
  return {
    id: MERCHANT, email: 'pro@fontaneria-1713.es', country: 'ES',
    flags: flag ? { INVOICING_ES_ENABLED: true } : {},
    llevaLibrosPorSii: sii,
    defaultCurrency: 'EUR', name: 'Fontanería 1713', legalName: null, taxId: null, address: null,
    logoUrl: null, whatsappPhone: null, timezone: 'Europe/Madrid', invoiceSeriesPrefix: null,
    nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026,
    invoiceStartSeq: null, invoiceStartYear: null,
  };
}
const ORIGINAL = () => ({
  id: 10, merchantId: MERCHANT, customerId: 5, quoteId: null, number: 'F260001',
  total: 100, currency: 'EUR', type: 'F1', status: 'pending',
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  merchant,
});

inyectarBase({
  'merchant.findUnique': () => merchant,
  'invoice.findFirst': (args) => (args?.where?.rectifiesId ? null : ORIGINAL()),
  'customer.findFirst': () => ({ id: 5, name: 'Cliente QA', legalName: null, taxId: null, email: null, phone: null }),
  $executeRaw: () => 0,
});

const facturas = moduloDeDist('../dist/modules/system/app/routes/invoicesAdmin.routes.js').default;

const app = express();
app.use(express.json());
app.use('/admin/invoices', (req, _res, next) => {
  Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MERCHANT }));
  next();
}, facturas);
const servidor = http.createServer(app);
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const PUERTO = servidor.address().port;
test.after(() => servidor.close());

async function pedir(ruta, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, mal) => {
      const req = http.request({
        host: '127.0.0.1', port: PUERTO, path: ruta, method: 'POST', agent: false,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(texto) },
      }, (res) => {
        let t = '';
        res.on('data', (c) => { t += c; });
        res.on('end', () => ok({ code: res.statusCode, body: JSON.parse(t || '{}') }));
      });
      req.on('error', mal);
      req.end(texto);
    });
  } finally { console.error = callar; }
}

const SUELTA = '/admin/invoices';
const RECTIFICAR = '/admin/invoices/10/rectify';

// Los nombres van LITERALES (SCRUM-1415: un nombre construido no lo puede echar en falta la señal
// por nombres). Cada caso lleva su dato escrito al lado de su nombre.
async function sueltaDiceElMotivo(sii, codigo) {
  merchant = merchantCon({ flag: true, sii });
  const r = await pedir(SUELTA, {});
  assert.equal(r.code, 409);
  assert.equal(r.body.error, codigo, `🔴 la ruta no dice el motivo: contestó «${r.body.error}»`);
}
async function rectificarDiceElMotivo(sii, codigo) {
  merchant = merchantCon({ flag: true, sii });
  const r = await pedir(RECTIFICAR, {});
  assert.notEqual(r.code, 500, '🔴 el motivo del SII sale como un 500 mudo');
  assert.equal(r.code, 409);
  assert.equal(r.body.error, codigo);
}

test('SCRUM-1713 · factura suelta con el flag puesto y el SII en true → 409 «sii_declarado»',
  () => sueltaDiceElMotivo(true, 'sii_declarado'));
test('SCRUM-1713 · rectificar con el flag puesto y el SII en true → 409 «sii_declarado», no 500',
  () => rectificarDiceElMotivo(true, 'sii_declarado'));
test('SCRUM-1713 · factura suelta con el flag puesto y el SII en null → 409 «sii_no_consta»',
  () => sueltaDiceElMotivo(null, 'sii_no_consta'));
test('SCRUM-1713 · rectificar con el flag puesto y el SII en null → 409 «sii_no_consta», no 500',
  () => rectificarDiceElMotivo(null, 'sii_no_consta'));

test('SCRUM-1713 · CONTROL: con el flag APAGADO la factura suelta sigue con su código de siempre', async () => {
  // El motivo es del SII sólo con el flag puesto: con OFF, `motivoSiiSinEmision` da null y el
  // código no puede cambiar (lo leen la pantalla y el bot).
  merchant = merchantCon({ flag: false, sii: true });
  const r = await pedir(SUELTA, {});
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'factura_suelta_no_disponible');
});

test('SCRUM-1713 · CONTROL POSITIVO: con el SII en «No» la factura suelta PASA la puerta', async () => {
  // Sin este caso, una puerta que lo cerrara todo dejaría verdes los cuatro de arriba. Sin cuerpo,
  // lo siguiente que la para es la validación: 400, no 409.
  merchant = merchantCon({ flag: true, sii: false });
  const r = await pedir(SUELTA, {});
  assert.equal(r.code, 400, `🔴 con el SII en «No» la puerta no deja pasar: ${r.code} ${JSON.stringify(r.body)}`);
});

test('SCRUM-1713 · CONTROL POSITIVO: con el SII en «No» la rectificativa PASA la puerta del SII', async () => {
  merchant = merchantCon({ flag: true, sii: false });
  const r = await pedir(RECTIFICAR, {});
  assert.ok(!['sii_declarado', 'sii_no_consta'].includes(r.body.error),
    `🔴 con el SII en «No» la rectificativa sale con un motivo del SII: ${JSON.stringify(r.body)}`);
});
