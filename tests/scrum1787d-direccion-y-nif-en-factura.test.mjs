// tests/scrum1787d-direccion-y-nif-en-factura.test.mjs — SCRUM-1787d
//
// Decisiones: c.22303 (GO, rótulos `NIF` y `Dirección`), c.22305 (guardar la dirección al emitir),
// c.22311 (ALTER aplicado; el albarán NO cambia). Vía J1 pura del orquestador J: la dirección la
// congela `crearFacturaEmitida` dentro de su transacción (direccionCongelada.ts).
//
// ① emitir → la fila lleva los cinco `customerBilling*` de la ficha
// ② cambiar después la ficha no cambia lo congelado (la factura no se vuelve a leer)
// ③ R1 hereda la de la original, no la ficha de hoy
// ④ el PDF pinta `NIF:` y `Dirección:` con sus valores (texto EXTRAÍDO del PDF)
// ⑤ factura vieja (dirección NULL) con ficha que SÍ tiene dirección: el lector no cae a la ficha
// ⑥ control CIEGO: sin NIF ni dirección el PDF no pinta ninguno de los dos rótulos
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineasDePdf } from './_texto-del-pdf.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    nombre: 'no congela la dirección',
    fichero: 'src/modules/invoicing/domain/crearFacturaEmitida.ts',
    de: '...emisor, ...direccion }',
    a: '...emisor }',
    cae: 'SCRUM-1787d ① emitir congela los cinco de la ficha del cliente',
  },
  {
    nombre: 'el PDF no pinta el NIF',
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'if (params.customer.taxId) {',
    a: 'if (false && params.customer.taxId) {',
    cae: 'SCRUM-1787d ④ el PDF de factura pinta NIF y Dirección del cliente',
  },
];

const D = '../dist/modules/invoicing/domain/';
const { crearFacturaEmitida } = await import(D + 'crearFacturaEmitida.js');
const { direccionDeLaFactura, direccionEnUnaLinea } = await import(D + 'direccionCongelada.js');
// Los cinco nombres salen del ÚNICO lector, no de una lista exportada sólo para el test (scrum1185).
const CAMPOS_DIRECCION_CONGELADOS = Object.keys(direccionDeLaFactura({}));

const CLIENTE = { customerName: 'Cliente QA', customerLegalName: null, customerTaxId: 'B00000001', customerEmail: null, customerPhone: null };
const EMISOR = {};

/** Transacción FABRICADA: una ficha de cliente y unas facturas en memoria, filtradas por merchant. */
function txDeEjemplo(ficha, facturas = []) {
  const creadas = [];
  return {
    creadas,
    customer: { findFirst: async ({ where }) => (where.id === ficha.id && where.merchantId === ficha.merchantId ? { ...ficha } : null) },
    invoice: {
      findFirst: async ({ where }) => facturas.find((f) => f.id === where.id && f.merchantId === where.merchantId) ?? null,
      create: async ({ data }) => { creadas.push(data); return { id: 99, ...data }; },
    },
  };
}
const FICHA = { id: 5, merchantId: 71, billingAddress: 'Calle Falsa 1', billingCity: 'Ciudad QA', billingPostalCode: '00001', billingProvince: 'Provincia QA', billingCountry: 'ES' };

test('SCRUM-1787d ① emitir congela los cinco de la ficha del cliente', async () => {
  const tx = txDeEjemplo(FICHA);
  const f = await crearFacturaEmitida(tx, CLIENTE, EMISOR, { merchantId: 71, customerId: 5, number: 'F1', total: '1', type: 'F1' });
  assert.equal(CAMPOS_DIRECCION_CONGELADOS.length, 5);
  assert.equal(f.customerBillingAddress, 'Calle Falsa 1');
  assert.equal(f.customerBillingCity, 'Ciudad QA');
  assert.equal(f.customerBillingPostalCode, '00001');
  assert.equal(f.customerBillingProvince, 'Provincia QA');
  assert.equal(f.customerBillingCountry, 'ES');
});

test('SCRUM-1787d ① regla 2: un cliente de OTRO merchant no se congela (cinco NULL)', async () => {
  const tx = txDeEjemplo({ ...FICHA, merchantId: 2 });
  const f = await crearFacturaEmitida(tx, CLIENTE, EMISOR, { merchantId: 71, customerId: 5, number: 'F1', total: '1', type: 'F1' });
  for (const c of CAMPOS_DIRECCION_CONGELADOS) assert.equal(f[c], null, c);
});

test('SCRUM-1787d ② cambiar la ficha después no cambia la factura', async () => {
  const ficha = { ...FICHA };
  const tx = txDeEjemplo(ficha);
  const f = await crearFacturaEmitida(tx, CLIENTE, EMISOR, { merchantId: 71, customerId: 5, number: 'F1', total: '1', type: 'F1' });
  ficha.billingAddress = 'Calle Nueva 2';
  assert.equal(direccionDeLaFactura(f).customerBillingAddress, 'Calle Falsa 1');
});

test('SCRUM-1787d ③ la R1 hereda la dirección de la original, no la ficha de hoy', async () => {
  const original = { id: 7, merchantId: 71, customerBillingAddress: 'Calle Vieja 9', customerBillingCity: 'Villa Vieja',
    customerBillingPostalCode: '00009', customerBillingProvince: null, customerBillingCountry: 'ES' };
  const tx = txDeEjemplo({ ...FICHA, billingAddress: 'Calle De Hoy 3' }, [original]);
  const r = await crearFacturaEmitida(tx, CLIENTE, EMISOR, { merchantId: 71, customerId: 5, number: 'R1', total: '-1', type: 'R1', rectifiesId: 7 });
  assert.equal(r.customerBillingAddress, 'Calle Vieja 9');
  assert.equal(r.customerBillingProvince, null);
  // original anterior a 1787d (todo NULL) → la R1 también NULL, no la ficha
  const tx2 = txDeEjemplo(FICHA, [{ id: 8, merchantId: 71 }]);
  const r2 = await crearFacturaEmitida(tx2, CLIENTE, EMISOR, { merchantId: 71, customerId: 5, number: 'R2', total: '-1', type: 'R1', rectifiesId: 8 });
  assert.equal(r2.customerBillingAddress, null);
});

async function textoDelPdf(sufijo, customer) {
  const { address, ...cliente } = customer; // la dirección viaja en `customerAddress`, hermano de `customer` (scrum577)
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1787D${sufijo}`, merchant: { name: 'Emisor QA', taxId: 'B00000000' }, customer: cliente, customerAddress: address,
    currency: 'EUR', total: 12.1, qrData: '', type: 'F1',
    lines: [{ concept: 'Mano de obra', qty: 1, unitPrice: 10, vatRate: 21 }],
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
    assert.ok(r.lineas.some((l) => l.texto.includes('CLIENTE')), '🔴 CIEGO: el PDF leído no trae el bloque CLIENTE');
    return r.lineas.map((l) => l.texto).join('\n');
  } finally { fs.rmSync(outPath, { force: true }); }
}

test('SCRUM-1787d ④ el PDF de factura pinta NIF y Dirección del cliente (texto extraído)', async () => {
  const address = direccionEnUnaLinea(direccionDeLaFactura({ customerBillingAddress: 'Calle Falsa 1', customerBillingPostalCode: '00001', customerBillingCity: 'Ciudad QA' }));
  assert.equal(address, 'Calle Falsa 1, 00001 Ciudad QA');
  const t = await textoDelPdf('a', { name: 'Cliente QA', taxId: 'B00000001', address });
  assert.match(t, /NIF: B00000001/);
  assert.match(t, /Dirección: Calle Falsa 1, 00001 Ciudad QA/);
});

test('SCRUM-1787d ⑤ factura anterior (dirección NULL): el lector NO cae a la ficha viva', () => {
  const vieja = { customerName: 'Cliente QA', customer: { billingAddress: 'Calle De La Ficha 5' } };
  assert.equal(direccionEnUnaLinea(direccionDeLaFactura(vieja)), '');
});

test('SCRUM-1787d ⑥ CIEGO: sin NIF ni dirección no se pinta ningún rótulo', async () => {
  const t = await textoDelPdf('b', { name: 'Cliente QA', address: null });
  assert.doesNotMatch(t, /NIF: B0/);
  assert.doesNotMatch(t, /Dirección:/);
  assert.match(t, /Cliente QA/, '🔴 control positivo: el nombre sí tiene que salir');
});
