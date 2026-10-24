// tests/scrum1063d-aviso-suplidos.test.mjs — SCRUM-1063d
//
// Firma del fundador (SCRUM-1063 c.20731, regla 39), literal:
//   «{n} suplido(s) no entran en ninguna casilla: son gastos pagados por cuenta del cliente.»
// Va en `motivosParaNoFiarse` del 303 para las líneas con motivo `suplido`. «suplido(s)» es UN
// texto para el singular y el plural: aquí se fija tal cual, con n = 1 y con n = 2.
// El literal está escrito A MANO: construirlo con la misma plantilla que el código no probaría nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

const M = 7;

const factura = (numero, lines, o = {}) => ({
  merchantId: M, number: numero, createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '1068.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines, ...o,
});

const MANO = { concept: 'Mano de obra', qty: 1, price: 800, tax: 0.21 };
const TASA = { concept: 'Tasa municipal', qty: 1, price: 50, tax: 0, suplido: true };
const EXENTA = { concept: 'Formación', qty: 1, price: 30, tax: 0 };

const m303 = (facturas) => construirModelo303({
  libro: construirLibroRegistro({ facturas, merchantId: M }),
  libroRecibidas: construirLibroRecibidas({ gastos: [], merchantId: M }),
  año: 2026, trimestre: 2,
});

const UNO = '1 suplido(s) no entran en ninguna casilla: son gastos pagados por cuenta del cliente.';
const DOS = '2 suplido(s) no entran en ninguna casilla: son gastos pagados por cuenta del cliente.';

test('SCRUM-1063d · 🔴 un suplido: el aviso firmado, literal y solo', () => {
  assert.deepEqual(m303([factura('F-1', [MANO, TASA])]).motivosParaNoFiarse, [UNO],
    '🔴 el aviso del suplido no es el literal firmado en c.20731 (o falta, o sobra otro)');
});

test('SCRUM-1063d · dos suplidos: el MISMO texto con n = 2 (no hay un plural aparte)', () => {
  const r = m303([factura('F-1', [MANO, TASA]), factura('F-2', [MANO, TASA])]);
  assert.deepEqual(r.motivosParaNoFiarse, [DOS]);
});

test('SCRUM-1063d · suplido y exenta: cada aviso con SU texto, y el de la exenta no cuenta el suplido', () => {
  const r = m303([factura('F-1', [MANO, TASA, EXENTA], { total: '1098.00' })]);
  assert.deepEqual(r.motivosParaNoFiarse, [
    '1 operación(es) sin calificación fiscal (exenta / no sujeta / ISP) no entran en ninguna casilla',
    UNO,
  ]);
});

test('SCRUM-1063d · CONTROL: sin suplido, ningún aviso habla de suplidos (y con él, sí)', () => {
  const sin = m303([factura('F-1', [MANO, EXENTA], { total: '998.00' })]).motivosParaNoFiarse;
  assert.equal(sin.filter((t) => t.includes('suplido(s)')).length, 0);
  const con = m303([factura('F-1', [MANO, TASA])]).motivosParaNoFiarse;
  assert.equal(con.filter((t) => t.includes('suplido(s)')).length, 1, 'positivo con el MISMO token');
});

test('SCRUM-1063d · marca ilegible: no se aparta, así que tampoco se avisa como suplido', () => {
  const r = m303([factura('F-1', [MANO, { ...TASA, suplido: 'sí' }])]);
  assert.equal(r.motivosParaNoFiarse.filter((t) => t.includes('suplido(s)')).length, 0);
  assert.equal(r.motivosParaNoFiarse.length, 1, 'sigue el aviso de «sin calificación»');
});
