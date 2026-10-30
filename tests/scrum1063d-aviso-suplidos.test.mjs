// tests/scrum1063d-aviso-suplidos.test.mjs — SCRUM-1063d
//
// Firma del fundador (SCRUM-1063 c.20797, regla 39; sustituye a c.20731), literales:
//   singular: «1 suplido no entra en ninguna casilla: es un gasto pagado por cuenta del cliente.»
//   plural:   «{n} suplidos no entran en ninguna casilla: son gastos pagados por cuenta del cliente.»
// Va en `motivosParaNoFiarse` del 303 para las líneas con motivo `suplido`. Son DOS textos, sin el
// «(s)» que scrum377 no admite en pantalla: aquí se fija cada uno, con n = 1, n = 2 y n = 3.
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

const UNO = '1 suplido no entra en ninguna casilla: es un gasto pagado por cuenta del cliente.';
const DOS = '2 suplidos no entran en ninguna casilla: son gastos pagados por cuenta del cliente.';
const TRES = '3 suplidos no entran en ninguna casilla: son gastos pagados por cuenta del cliente.';
// El token de los controles casa con las DOS formas, y con ninguna otra frase del 303.
const HABLA_DE_SUPLIDOS = /\bsuplidos? no entran? en ninguna casilla/;

test('SCRUM-1063d · 🔴 un suplido: el aviso firmado, literal y solo', () => {
  assert.deepEqual(m303([factura('F-1', [MANO, TASA])]).motivosParaNoFiarse, [UNO],
    '🔴 el aviso del suplido no es el literal firmado en c.20797 (o falta, o sobra otro)');
});

test('SCRUM-1063d · dos y tres suplidos: el PLURAL firmado, con su n', () => {
  const r = m303([factura('F-1', [MANO, TASA]), factura('F-2', [MANO, TASA])]);
  assert.deepEqual(r.motivosParaNoFiarse, [DOS]);
  const r3 = m303([factura('F-1', [MANO, TASA]), factura('F-2', [MANO, TASA]), factura('F-3', [MANO, TASA])]);
  assert.deepEqual(r3.motivosParaNoFiarse, [TRES]);
});

test('SCRUM-1063d · ningún aviso de suplidos lleva el «(s)» de programador (scrum377)', () => {
  for (const n of [1, 2]) {
    const facturas = Array.from({ length: n }, (_, i) => factura(`F-${i + 1}`, [MANO, TASA]));
    const avisos = m303(facturas).motivosParaNoFiarse.filter((t) => HABLA_DE_SUPLIDOS.test(t));
    assert.equal(avisos.length, 1, `positivo: con ${n} suplido(s) hay UN aviso que lo dice`);
    assert.ok(!avisos[0].includes('(s)'), `🔴 el aviso con n = ${n} lleva «(s)»: ${avisos[0]}`);
  }
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
  assert.equal(sin.filter((t) => HABLA_DE_SUPLIDOS.test(t)).length, 0);
  const con = m303([factura('F-1', [MANO, TASA])]).motivosParaNoFiarse;
  assert.equal(con.filter((t) => HABLA_DE_SUPLIDOS.test(t)).length, 1, 'positivo con el MISMO token');
});

test('SCRUM-1063d · marca ilegible: no se aparta, así que tampoco se avisa como suplido', () => {
  const r = m303([factura('F-1', [MANO, { ...TASA, suplido: 'sí' }])]);
  assert.equal(r.motivosParaNoFiarse.filter((t) => HABLA_DE_SUPLIDOS.test(t)).length, 0);
  assert.equal(r.motivosParaNoFiarse.length, 1, 'sigue el aviso de «sin calificación»');
});
