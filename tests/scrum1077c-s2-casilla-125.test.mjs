// tests/scrum1077c-s2-casilla-125.test.mjs — SCRUM-1077c
//
// Decisión del fundador (SCRUM-1077 c.20833, «Sí, a la 125»): en el borrador del 390, la base de la
// S2 del EMISOR va a la casilla 125 «Operaciones sujetas con inversión del sujeto pasivo» (Orden
// HAC/27/2026, Anexo IV, pág. 6, apartado «10. Volumen de operaciones»), como suma de las cuatro 122
// del 303. Deja de ir sin clasificar. La liquidación (33/34, 47, 64 y 65) no cambia. La 99 y la 108
// NO se abren.
// Los 303 se fabrican con el 303 DE VERDAD (`construirModelo303` sobre libros construidos). Cifras a
// mano: el número esperado se escribe, no se calcula con el código que se prueba.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo390 } = await import('../dist/modules/fiscal/modelo390/modelo390.js');
const casillas = await import('../dist/modules/fiscal/modelo390/casillas.js');
const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo390/casillas.ts', de: "export const CASILLA_INVERSION_SUJETO_PASIVO_390 = '125';",
    a: "export const CASILLA_INVERSION_SUJETO_PASIVO_390 = '122';",
    cae: 'SCRUM-1077c · la 125 es la del impreso LEÍDO' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'base125 += t.informacionAdicional.inversionSujetoPasivo.base;', a: 'void 0;',
    cae: 'SCRUM-1077c · cifras a mano: la 125 es la suma de las cuatro 122' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'for (const o of t.informacionAdicional.inversionSujetoPasivo.operaciones) operaciones125.push({ ...o, trimestre: t.trimestre });',
    a: 'void 0;',
    cae: 'SCRUM-1077c · cifras a mano: la 125 es la suma de las cuatro 122' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'for (const s of t.sinClasificar) sinClasificar.push({ ...s, trimestre: t.trimestre });',
    a: 'for (const s of t.sinClasificar) sinClasificar.push({ ...s, trimestre: t.trimestre }); for (const o of t.informacionAdicional.inversionSujetoPasivo.operaciones) sinClasificar.push({ ...o, cuota: 0, motivo: "inversion_sujeto_pasivo", trimestre: t.trimestre });',
    cae: 'SCRUM-1077c · la S2 de la 125 deja de ir sin clasificar' },
];

const M = 7;
const AÑO = 2026;
/** 1-mar-2027 a mediodía: 2026 ya está cerrado. */
const AÑO_CERRADO = new Date(Date.UTC(2027, 2, 1, 12));
let n = 0;

const MANO = (base) => ({ concept: 'Mano de obra', qty: 1, price: base, tax: 0.21 });
const S2 = (base) => ({ concept: 'Obra para empresa (ISP)', qty: 1, price: base, tax: 0, causa: 'S2' });

/** Una factura emitida en el trimestre `t`. */
const factura = (t, lines) => ({
  merchantId: M, number: `2026-CF-${String(++n).padStart(3, '0')}`, createdAt: new Date(AÑO, (t - 1) * 3 + 1, 10, 12),
  type: 'F1', total: lines.reduce((s, l) => s + l.price * (1 + l.tax), 0).toFixed(2), currency: 'EUR', status: 'pending', customerId: 3,
  quoteId: null, chargeId: null, albaranRefs: null, lines,
});

/** Un gasto deducible y corriente del trimestre `t`: `base` al 21 %. */
const gasto = (t, base) => ({
  merchantId: M, date: new Date(AÑO, (t - 1) * 3 + 1, 5, 9), concept: 'Cable', amount: (base * 1.21).toFixed(2), currency: 'EUR',
  providerId: 3, baseAmount: base.toFixed(2), vatRate: 21, vatAmount: (base * 0.21).toFixed(2), vatDeducible: true,
  providerInvoiceNumber: `P-${++n}`, providerInvoiceDate: new Date(AÑO, (t - 1) * 3 + 1, 4), category: 'materiales',
});

const libroDe = (facturas) => construirLibroRegistro({ facturas, merchantId: M });
const m303 = (t, libro, gastos = []) => construirModelo303({
  libro, libroRecibidas: construirLibroRecibidas({ gastos, merchantId: M }), año: AÑO, trimestre: t,
});

/**
 * El año de la prueba, con S2 en tres trimestres (`conS2 = true`) o sin ella:
 *   T1 · mano de obra 800 al 21 % + S2 1.000 · gasto 100 al 21 %
 *   T2 · nada
 *   T3 · S2 500
 *   T4 · mano de obra 200 al 21 % + S2 250
 * A mano: 125 = 1.000 + 500 + 250 = 1.750 · 05/06 = 1.000/210 · 33/34 = 1.000/210 · 47 = 210 ·
 * 64 = 21 · 65 = 189.
 */
function elAño(conS2 = true) {
  const s2 = (b) => (conS2 ? [S2(b)] : []);
  return [
    m303(1, libroDe([factura(1, [MANO(800), ...s2(1000)])]), [gasto(1, 100)]),
    m303(2, libroDe([])),
    m303(3, libroDe(conS2 ? [factura(3, s2(500))] : [])),
    m303(4, libroDe([factura(4, [MANO(200), ...s2(250)])])),
  ];
}
const de = (trimestres) => construirModelo390({ año: AÑO, trimestres, ahora: AÑO_CERRADO });

/** La liquidación del 390: lo que esta decisión NO puede mover. */
const liquidacion = (r) => ({
  '33': r.devengado.totalBase.valor, '34': r.devengado.totalCuota.valor,
  '47': r.devengado.totalCuotasYRecargo.valor, '64': r.deducible.sumaDeducciones.valor,
  '65': r.resultadoRegimenGeneral.valor,
});

test('SCRUM-1077c · la 125 es la del impreso LEÍDO, y la fuente cita su página', () => {
  assert.equal(casillas.CASILLA_INVERSION_SUJETO_PASIVO_390, '125');
  assert.ok(casillas.FUENTE_390.includes('1761_16563944_19.png'), `🔴 la fuente no cita la pág. 6 del impreso:\n${casillas.FUENTE_390}`);
});

test('SCRUM-1077c · cifras a mano: la 125 es la suma de las cuatro 122', () => {
  const trimestres = elAño();
  // Control: el 303 real pone la S2 en su 122 (si no, la 125 sumaría ceros y el test no mediría nada).
  assert.deepEqual(trimestres.map((t) => t.informacionAdicional.inversionSujetoPasivo.base), [1000, 0, 500, 250]);
  const r = de(trimestres);
  const c125 = r.volumenDeOperaciones.inversionSujetoPasivo;
  assert.equal(c125.casilla, '125');
  assert.equal(c125.base, 1750);
  assert.deepEqual(c125.operaciones.map((o) => [o.trimestre, o.base]), [[1, 1000], [3, 500], [4, 250]]);
  assert.equal(c125.operaciones.every((o) => /^2026-CF-\d{3}$/.test(o.numero)), true, 'cada euro lleva su factura');
});

test('SCRUM-1077c · la S2 de la 125 deja de ir sin clasificar', () => {
  const r = de(elAño());
  assert.deepEqual(r.sinClasificar.filter((s) => s.motivo === 'inversion_sujeto_pasivo'), []);
  assert.deepEqual(r.sinClasificar, [], 'en este año no hay nada más sin clasificar');
});

test('SCRUM-1077c · la liquidación (33/34, 47, 64 y 65) no cambia con la S2', () => {
  const con = liquidacion(de(elAño(true)));
  const sin = liquidacion(de(elAño(false)));
  assert.deepEqual(con, { '33': 1000, '34': 210, '47': 210, '64': 21, '65': 189 }, 'cifras a mano');
  assert.deepEqual(con, sin, '🔴 meter la S2 en la 125 ha movido la liquidación');
});

test('SCRUM-1077c · la 99 y la 108 no se abren, y la 125 no está en «sin rellenar»', () => {
  const r = de(elAño());
  const usadas = [];
  JSON.stringify(r, (k, v) => { if (k === 'casilla') usadas.push(v); return v; });
  assert.ok(usadas.includes('125'), 'control positivo: el barrido sí ve la 125');
  assert.deepEqual(usadas.filter((c) => c === '99' || c === '108'), []);
  assert.ok(!r.sinRellenar.casillas.includes('125'));
  assert.deepEqual(Object.keys(r.volumenDeOperaciones), ['inversionSujetoPasivo'], 'del apartado 10 sólo sale la 125');
});

test('SCRUM-1077c · un año sin S2 deja la 125 a cero, sin operaciones', () => {
  const c125 = de(elAño(false)).volumenDeOperaciones.inversionSujetoPasivo;
  assert.deepEqual(c125, { casilla: '125', base: 0, operaciones: [] });
});

test('SCRUM-1077c · la S2 que el 303 deja FUERA de la 122 (trae cuota) sigue fuera de la 125, declarada', () => {
  // El único camino: una entrada S2 con cuota en un libro REAL (como en scrum1063f). La 122 no tiene
  // cuota, así que el 303 la deja en su «sin clasificar»; el 390 la hereda con su trimestre.
  const l = libroDe([factura(3, [S2(500)])]);
  const conCuota = {
    ...l,
    asientos: l.asientos.map((a) => ({
      ...a, cuota: a.cuota + 10, porTipo: a.porTipo.map((e) => (e.causa === 'S2' ? { ...e, cuota: 10 } : e)),
    })),
  };
  const año = elAño(false);
  año[2] = m303(3, conCuota);
  const r = de(año);
  assert.equal(r.volumenDeOperaciones.inversionSujetoPasivo.base, 0);
  assert.deepEqual(r.sinClasificar.map((s) => [s.motivo, s.base, s.cuota, s.trimestre]), [['inversion_sujeto_pasivo', 500, 10, 3]]);
});
