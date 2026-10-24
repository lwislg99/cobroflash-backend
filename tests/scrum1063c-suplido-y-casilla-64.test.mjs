// tests/scrum1063c-suplido-y-casilla-64.test.mjs — SCRUM-1063c
//
// Decisión del fundador (SCRUM-1063 c.20717):
//   1. Una línea de suplido deja de salir en el 303 con el motivo `tipo_cero` (exenta / no sujeta /
//      ISP), que no es el suyo. Sigue sin casilla, y el 303 NO la saca de la base: el borrador
//      sigue cuadrando con el libro (E4) y con lo sellado.
//   2. La 64 = 46, y las del «Resultado» de la 65 a la 71 vacías, con su motivo como dato.
// Las cifras están escritas A MANO: recalcularlas con las mismas funciones no probaría nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

const M = 7;

const factura = (lines, o = {}) => ({
  merchantId: M, number: '2026-CF-001', createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '1068.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines, ...o,
});

const MANO = { concept: 'Mano de obra', qty: 1, price: 800, tax: 0.21 };
const TASA = { concept: 'Tasa municipal', qty: 1, price: 50, tax: 0, suplido: true };
const EXENTA = { concept: 'Formación', qty: 1, price: 30, tax: 0 };

const gasto = (o = {}) => ({
  merchantId: M, date: new Date(2026, 4, 2, 9), concept: 'Cable', amount: '363.00', currency: 'EUR',
  providerId: 3, baseAmount: '300.00', vatRate: 21, vatAmount: '63.00', vatDeducible: true,
  providerInvoiceNumber: 'P-1', providerInvoiceDate: new Date(2026, 4, 1), category: 'materiales', ...o,
});

const libroDe = (facturas) => construirLibroRegistro({ facturas, merchantId: M });
const m303 = (facturas, gastos = []) => construirModelo303({
  libro: libroDe(facturas),
  libroRecibidas: construirLibroRecibidas({ gastos, merchantId: M }),
  año: 2026, trimestre: 2,
});
const motivos = (r) => r.sinClasificar.map((o) => [o.motivo, o.base, o.cuota]);

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL LIBRO NO CAMBIA (condición del orquestador): porTipo, base, cuota y total, con y sin suplido
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1063c · el libro CON suplido: porTipo, base, cuota y total son los de siempre (a mano)', () => {
  const [a] = libroDe([factura([MANO, TASA])]).asientos;
  assert.deepEqual(a.porTipo, [{ tipo: 21, base: 800, cuota: 168 }, { tipo: 0, base: 50, cuota: 0 }],
    '🔴 el porTipo del libro ha cambiado: el suplido sigue en la base sellada (c.20717)');
  assert.equal(a.base, 850);
  assert.equal(a.cuota, 168);
  assert.equal(a.total, 1068);
});

test('SCRUM-1063c · el libro SIN suplido: idéntico, y `suplidosPorTipo` vacío (no null)', () => {
  const [a] = libroDe([factura([MANO], { total: '968.00' })]).asientos;
  assert.deepEqual(a.porTipo, [{ tipo: 21, base: 800, cuota: 168 }]);
  assert.equal(a.base, 800);
  assert.equal(a.cuota, 168);
  assert.equal(a.total, 968);
  assert.deepEqual(a.suplidosPorTipo, [], '«no hay suplidos» es [], no null');
});

test('SCRUM-1063c · el libro dice QUÉ parte de su porTipo son suplidos', () => {
  const [a] = libroDe([factura([MANO, TASA])]).asientos;
  assert.deepEqual(a.suplidosPorTipo, [{ tipo: 0, base: 50, cuota: 0 }]);
});

test('SCRUM-1063c · marca de suplido ILEGIBLE: `suplidosPorTipo` es null («no se sabe»)', () => {
  const [a] = libroDe([factura([MANO, { ...TASA, suplido: 'sí' }])]).asientos;
  assert.equal(a.suplidosPorTipo, null);
  assert.deepEqual(a.porTipo, [{ tipo: 21, base: 800, cuota: 168 }, { tipo: 0, base: 50, cuota: 0 }]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL 303: el suplido sale con SU motivo, y el invariante con el libro sigue al céntimo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1063c · 🔴 un suplido NO sale como `tipo_cero`: sale como `suplido`, sin casilla', () => {
  const r = m303([factura([MANO, TASA])]);
  assert.deepEqual(motivos(r), [['suplido', 50, 0]],
    '🔴 el suplido ha salido con el motivo de una exenta (o ha desaparecido)');
  assert.deepEqual(r.casillas.find((c) => c.tipo === 21), {
    tipo: 21, casillaBase: 7, casillaTipo: 8, casillaCuota: 9, base: 800, cuota: 168,
  });
  assert.equal(r.casillaTotalCuota.valor, 168);
  // SCRUM-1063d · desde la firma c.20731 el suplido tiene SU aviso; el de la exenta sigue sin salir.
  assert.deepEqual(r.motivosParaNoFiarse,
    ['1 suplido(s) no entran en ninguna casilla: son gastos pagados por cuenta del cliente.'],
    '🔴 el aviso de «exenta / no sujeta / ISP» cuenta un suplido, que no es nada de eso');
});

test('SCRUM-1063c · el 303 NO saca el suplido de la base: libro = casillas + sin clasificar (850 = 800 + 50)', () => {
  const r = m303([factura([MANO, TASA])]);
  const fuera = r.sinClasificar.reduce((s, o) => s + o.base, 0);
  assert.equal(r.totalBase + fuera, 850);
  assert.equal(r.totalBase, 800);
});

test('SCRUM-1063c · suplido y exenta en la misma factura: cada una con SU motivo (50 + 30)', () => {
  const r = m303([factura([MANO, TASA, EXENTA], { total: '1098.00' })]);
  assert.deepEqual(motivos(r), [['suplido', 50, 0], ['tipo_cero', 30, 0]]);
  assert.equal(r.totalBase + 50 + 30, 880, 'el libro lleva 880 de base: 800 + 50 + 30');
  assert.deepEqual(r.motivosParaNoFiarse,
    ['1 operación(es) sin calificación fiscal (exenta / no sujeta / ISP) no entran en ninguna casilla',
      '1 suplido(s) no entran en ninguna casilla: son gastos pagados por cuenta del cliente.'], // SCRUM-1063d
    'la exenta se sigue avisando; el suplido no se cuenta en ese texto');
});

test('SCRUM-1063c · CONTROL: una exenta sola sigue saliendo `tipo_cero`, como antes', () => {
  const r = m303([factura([MANO, EXENTA], { total: '998.00' })]);
  assert.deepEqual(motivos(r), [['tipo_cero', 30, 0]]);
  assert.equal(r.motivosParaNoFiarse.length, 1);
});

test('SCRUM-1063c · marca ilegible: no se aparta nada, sigue `tipo_cero` (no se adivina)', () => {
  const r = m303([factura([MANO, { ...TASA, suplido: 'sí' }])]);
  assert.deepEqual(motivos(r), [['tipo_cero', 50, 0]]);
});

test('SCRUM-1063c · rectificativa (importes en negativo): el suplido −50 sale como `suplido`', () => {
  const r = m303([factura([{ ...MANO, qty: -1 }, { ...TASA, qty: -1 }], { type: 'R1', total: '-1068.00' })]);
  assert.deepEqual(motivos(r), [['suplido', -50, 0]]);
  assert.equal(r.totalBase, -800);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA 64 = 46, Y DE LA 65 A LA 71 VACÍAS CON SU MOTIVO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1063c · 🔴 la 64 = 46: emitida 1.000 + 210 y gasto 300 + 63 → 46 = 147 y 64 = 147', () => {
  const r = m303([factura([{ concept: 'Obra', qty: 1, price: 1000, tax: 0.21 }], { total: '1210.00' })], [gasto()]);
  assert.equal(r.casillaTotalCuota.valor, 210);
  assert.equal(r.ivaDeducible.casillaTotalADeducir.valor, 63);
  assert.deepEqual(r.resultadoRegimenGeneral, { casilla: 46, valor: 147 });
  assert.deepEqual(r.resultadoFinal.sumaDeResultados, { casilla: 64, valor: 147 },
    '🔴 la 64 no es la 46 (decisión c.20717)');
});

test('SCRUM-1063c · la 64 negativa (a compensar) sigue siendo la 46: emitida 100 + 21, gasto 300 + 63 → −42', () => {
  const r = m303([factura([{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }], { total: '121.00' })], [gasto()]);
  assert.deepEqual(r.resultadoFinal.sumaDeResultados, { casilla: 64, valor: -42 });
});

test('SCRUM-1063c · de la 65 a la 71 VACÍAS, cada una con su motivo, y SIN la 67 (no existe en el impreso)', () => {
  const r = m303([factura([MANO])]);
  assert.deepEqual(r.resultadoFinal.vacias.map((v) => [v.casilla, v.motivo]), [
    [65, 'porcentaje_atribuible_no_consta'],
    [66, 'depende_de_la_65'],
    [68, 'regularizacion_anual_foral_no_consta'],
    [69, 'depende_de_la_66'],
    [70, 'autoliquidacion_anterior_no_consta'],
    [71, 'depende_de_la_69'],
  ]);
  for (const v of r.resultadoFinal.vacias) {
    assert.ok(!('valor' in v), `🔴 la ${v.casilla} lleva un valor: estaría rellena, y es cosa del asesor`);
  }
});

test('SCRUM-1063c · las vacías NO se vuelven aviso: un trimestre normal sale sin motivos para no fiarse', () => {
  assert.deepEqual(m303([factura([MANO], { total: '968.00' })]).motivosParaNoFiarse, []);
});
