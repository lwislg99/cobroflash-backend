// tests/scrum1063e-causa-s2.test.mjs — SCRUM-1063e
//
// Decisión del fundador (SCRUM-1063 c.20746): «Sí: guardar la causa y apartar la S2».
//   1. El libro conserva `causa` en `porTipo` SOLO cuando existe, con la convención de
//      `calcVatBreakdown`. Sin S2 no cambia nada: aquí se fija BYTE A BYTE.
//   2. El 303 saca de la casilla 07 la entrada con `causa: 'S2'` y la manda a `sinClasificar` con
//      un motivo propio (dato). Los suplidos se apartan SOLO de las entradas sin causa.
// Los dos casos medidos en c.20739 (la S2 antes del suplido, y la S2 con tax 0.21) son casos aquí.
// Facturas fabricadas, pasadas por `construirLibroRegistro` y `construirModelo303` reales.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

const M = 7;

const factura = (numero, lines, o = {}) => ({
  merchantId: M, number: numero, createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '1000.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines, ...o,
});

const MANO = { concept: 'Mano de obra', qty: 1, price: 800, tax: 0.21 };
const PIEZA = { concept: 'Pieza', qty: 2, price: 100, tax: 0.10 };
const EXENTA = { concept: 'Formación', qty: 1, price: 30, tax: 0 };
const TASA = { concept: 'Tasa municipal', qty: 1, price: 50, tax: 0, suplido: true };
const S2 = { concept: 'Obra para empresa (ISP)', qty: 1, price: 1000, tax: 0, causa: 'S2' };
const S2_CON_21 = { ...S2, tax: 0.21 };

const libro = (facturas) => construirLibroRegistro({ facturas, merchantId: M });
const m303 = (facturas) => construirModelo303({
  libro: libro(facturas),
  libroRecibidas: construirLibroRecibidas({ gastos: [], merchantId: M }),
  año: 2026, trimestre: 2,
});
const casilla = (r, tipo) => r.casillas.find((c) => c.tipo === tipo);
const MOTIVO_S2 = 'inversion_sujeto_pasivo';

// ── 1 · el libro ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1063e · SIN S2 el `porTipo` del libro es el de antes, BYTE A BYTE (y ninguna entrada lleva la clave `causa`)', () => {
  const [a] = libro([factura('F-1', [MANO, PIEZA, EXENTA, TASA])]).asientos;
  // Escrito A MANO: es lo que daba el libro antes de 1063e para esta factura.
  assert.equal(JSON.stringify(a.porTipo),
    '[{"tipo":21,"base":800,"cuota":168},{"tipo":10,"base":200,"cuota":20},{"tipo":0,"base":80,"cuota":0}]');
  // JSON.stringify se come un `causa: undefined`; esto no.
  for (const e of a.porTipo) assert.deepEqual(Object.keys(e), ['tipo', 'base', 'cuota']);
});

test('SCRUM-1063e · 🔴 CON S2 la entrada lleva `causa: "S2"` (al final, como en `calcVatBreakdown`) y la otra no', () => {
  const [a] = libro([factura('F-1', [S2, TASA])]).asientos;
  assert.equal(JSON.stringify(a.porTipo),
    '[{"tipo":0,"base":1000,"cuota":0,"causa":"S2"},{"tipo":0,"base":50,"cuota":0}]');
});

test('SCRUM-1063e · la causa no cambia base, cuota ni total del asiento', () => {
  const [a] = libro([factura('F-1', [MANO, S2])]).asientos;
  assert.equal(a.base, 1800);
  assert.equal(a.cuota, 168);
});

// ── 2 · el 303 ──────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1063e · 🔴 c.20739, caso 2: una S2 con tax 0.21 NO entra en la casilla 07', () => {
  const r = m303([factura('F-1', [MANO, S2_CON_21])]);
  assert.equal(casilla(r, 21).base, 800, '🔴 la base de la S2 se ha sumado a la casilla 07');
  assert.equal(casilla(r, 21).cuota, 168);
  assert.deepEqual(r.sinClasificar, [{ numero: 'F-1', tipo: 21, base: 1000, cuota: 0, motivo: MOTIVO_S2 }]);
});

test('SCRUM-1063e · 🔴 una S2 al 0 % va a `sinClasificar` con SU motivo, no con `tipo_cero`', () => {
  const r = m303([factura('F-1', [S2])]);
  assert.deepEqual(r.sinClasificar, [{ numero: 'F-1', tipo: 0, base: 1000, cuota: 0, motivo: MOTIVO_S2 }]);
});

test('SCRUM-1063e · 🔴 c.20739, caso 1: la S2 ANTES del suplido — el suplido no se aparta de la S2', () => {
  const r = m303([factura('F-1', [S2, TASA], { total: '1050.00' })]);
  assert.deepEqual(r.sinClasificar, [
    { numero: 'F-1', tipo: 0, base: 1000, cuota: 0, motivo: MOTIVO_S2 },
    { numero: 'F-1', tipo: 0, base: 50, cuota: 0, motivo: 'suplido' },
  ]);
});

test('SCRUM-1063e · el mismo par con el suplido PRIMERO da lo mismo (el orden de las líneas no decide)', () => {
  const r = m303([factura('F-1', [TASA, S2], { total: '1050.00' })]);
  const orden = (xs) => [...xs].sort((x, y) => x.motivo.localeCompare(y.motivo));
  assert.deepEqual(orden(r.sinClasificar), orden([
    { numero: 'F-1', tipo: 0, base: 1000, cuota: 0, motivo: MOTIVO_S2 },
    { numero: 'F-1', tipo: 0, base: 50, cuota: 0, motivo: 'suplido' },
  ]));
});

test('SCRUM-1063e · el libro sigue cuadrando: casillas + sin clasificar = base del libro, al céntimo', () => {
  const facturas = [
    factura('F-1', [MANO, S2_CON_21]),
    factura('F-2', [S2, TASA, EXENTA], { total: '1080.00' }),
    factura('F-3', [MANO, PIEZA]),
  ];
  const l = libro(facturas);
  const r = m303(facturas);
  const delLibro = l.asientos.reduce((s, a) => s + a.base, 0);
  const declarada = r.casillas.reduce((s, c) => s + c.base, 0) + r.sinClasificar.reduce((s, o) => s + o.base, 0);
  assert.equal(Math.round(declarada * 100), Math.round(delLibro * 100));
});

test('SCRUM-1063e · CONTROL: sin S2 nada sale con el motivo de la S2 (y con ella, sí)', () => {
  const sin = m303([factura('F-1', [MANO, EXENTA, TASA])]);
  assert.equal(sin.sinClasificar.filter((o) => o.motivo === MOTIVO_S2).length, 0);
  assert.equal(casilla(sin, 21).base, 800);
  const con = m303([factura('F-1', [MANO, S2])]);
  assert.equal(con.sinClasificar.filter((o) => o.motivo === MOTIVO_S2).length, 1, 'positivo con el MISMO token');
});

test('SCRUM-1063e · aviso: la S2 sigue contada en el aviso que ya existía (sin texto nuevo: regla 39)', () => {
  // Hasta que se firme un literal propio (propuesto en SCRUM-1063), la S2 no se queda callada: el
  // único aviso que ya nombra la ISP la cuenta. Un 303 con una base fuera de casilla y ningún aviso
  // se leería como completo.
  const r = m303([factura('F-1', [MANO, S2])]);
  assert.deepEqual(r.motivosParaNoFiarse, [
    '1 operación(es) sin calificación fiscal (exenta / no sujeta / ISP) no entran en ninguna casilla',
  ]);
});
