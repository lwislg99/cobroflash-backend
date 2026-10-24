// tests/scrum1063f-s2-casilla-122.test.mjs — SCRUM-1063f
//
// Decisión del fundador (SCRUM-1063 c.20768): la base de la S2 del EMISOR va a la casilla 122,
// «Operaciones sujetas con inversión del sujeto pasivo» (Información adicional, sin cuota; Orden
// HAC/27/2026, Anexo III, y las instrucciones de la AEAT para 2026, leídas).
// Firma (c.20797, regla 39; sustituye a la de c.20768), SOLO para la S2 que queda fuera de la 122:
//   singular: «1 operación con inversión del sujeto pasivo no entra en ninguna casilla.»
//   plural:   «{n} operaciones con inversión del sujeto pasivo no entran en ninguna casilla.»
// Los literales están escritos A MANO: construirlos con la plantilla del código no probaría nada.
// Facturas fabricadas, pasadas por `construirLibroRegistro` y `construirModelo303` reales.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const casillas = await import('../dist/modules/fiscal/modelo303/casillas.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');
const { construirModelo390 } = await import('../dist/modules/fiscal/modelo390/modelo390.js');
const { construirPaqueteEvidencias, FICHEROS } = await import('../dist/modules/fiscal/evidencias/paquete.js');

const M = 7;

const factura = (numero, lines, o = {}) => ({
  merchantId: M, number: numero, createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '1000.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines, ...o,
});

const MANO = { concept: 'Mano de obra', qty: 1, price: 800, tax: 0.21 };
const EXENTA = { concept: 'Formación', qty: 1, price: 30, tax: 0 };
const S2 = { concept: 'Obra para empresa (ISP)', qty: 1, price: 1000, tax: 0, causa: 'S2' };
const S2_CON_21 = { ...S2, tax: 0.21 };

const libro = (facturas) => construirLibroRegistro({ facturas, merchantId: M });
const sobre = (l, trimestre = 2) => construirModelo303({
  libro: l,
  libroRecibidas: construirLibroRecibidas({ gastos: [], merchantId: M }),
  año: 2026, trimestre,
});
const m303 = (facturas) => sobre(libro(facturas));
const c122 = (r) => r.informacionAdicional.inversionSujetoPasivo;

/**
 * Un libro REAL en el que la entrada S2 trae cuota. Hoy `calcVatBreakdown` no la produce (una S2 con
 * `tax: 0.21` sale con cuota 0), así que es el ÚNICO camino que deja una S2 fuera de la 122: se
 * fabrica tocando la entrada del libro real, no el código.
 */
function libroConS2ConCuota(facturas, cuota = 10) {
  const l = libro(facturas);
  return {
    ...l,
    asientos: l.asientos.map((a) => ({
      ...a,
      cuota: a.cuota + (a.porTipo.some((e) => e.causa === 'S2') ? cuota : 0),
      porTipo: a.porTipo.map((e) => (e.causa === 'S2' ? { ...e, cuota } : e)),
    })),
  };
}

const UNA_FUERA = '1 operación con inversión del sujeto pasivo no entra en ninguna casilla.';
const DOS_FUERA = '2 operaciones con inversión del sujeto pasivo no entran en ninguna casilla.';
const HABLA_DE_ISP = /inversión del sujeto pasivo no entran? en ninguna casilla/;

// ── 1 · la casilla ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1063f · la casilla es la 122 del impreso LEÍDO', () => {
  assert.equal(casillas.CASILLA_INVERSION_SUJETO_PASIVO, 122);
});

test('SCRUM-1063f · 🔴 la base de la S2 va a la 122, una operación por entrada, y NO a sin clasificar', () => {
  const r = m303([factura('F-1', [MANO, S2], { total: '1968.00' }), factura('F-2', [S2_CON_21])]);
  assert.deepEqual(c122(r), {
    casilla: 122, base: 2000,
    operaciones: [{ numero: 'F-1', tipo: 0, base: 1000 }, { numero: 'F-2', tipo: 21, base: 1000 }],
  });
  assert.deepEqual(r.sinClasificar, []);
  assert.deepEqual(r.motivosParaNoFiarse, [], '🔴 una S2 que SÍ entra en la 122 no lleva aviso (c.20768)');
});

test('SCRUM-1063f · la 122 es información adicional: no cambia la 27, la 46 ni la 64', () => {
  const sin = m303([factura('F-1', [MANO])]);
  const con = m303([factura('F-1', [MANO, S2], { total: '1968.00' })]);
  assert.equal(c122(con).base, 1000, 'positivo: la S2 sí está en la 122');
  assert.equal(con.casillaTotalCuota.valor, sin.casillaTotalCuota.valor);
  assert.equal(con.totalBase, sin.totalBase);
  assert.equal(con.resultadoRegimenGeneral.valor, sin.resultadoRegimenGeneral.valor);
  assert.equal(con.resultadoFinal.sumaDeResultados.valor, sin.resultadoFinal.sumaDeResultados.valor);
});

test('SCRUM-1063f · cuadre al céntimo: casillas + sin clasificar + 122 = base del libro; 27 + sin clasificar = cuota', () => {
  const facturas = [factura('F-1', [MANO, S2, EXENTA], { total: '1998.00' }), factura('F-2', [S2_CON_21])];
  const l = libro(facturas);
  const r = sobre(l);
  const base = r.casillas.reduce((s, c) => s + c.base, 0) + r.sinClasificar.reduce((s, o) => s + o.base, 0) + c122(r).base;
  assert.equal(Math.round(base * 100), Math.round(l.asientos.reduce((s, a) => s + a.base, 0) * 100));
  const cuota = r.casillaTotalCuota.valor + r.sinClasificar.reduce((s, o) => s + o.cuota, 0);
  assert.equal(Math.round(cuota * 100), Math.round(l.asientos.reduce((s, a) => s + a.cuota, 0) * 100));
});

test('SCRUM-1063f · un trimestre con SOLO S2 no grita «TODAS las casillas a cero sin nada declarado aparte»', () => {
  const r = m303([factura('F-1', [S2])]);
  assert.equal(c122(r).base, 1000);
  assert.deepEqual(r.motivosParaNoFiarse, []);
});

// ── 2 · la S2 que queda FUERA de la 122, y su aviso firmado ──────────────────────────────────────

test('SCRUM-1063f · 🔴 una S2 con cuota no cabe en la 122: sale declarada, y con el aviso firmado en singular', () => {
  const r = sobre(libroConS2ConCuota([factura('F-1', [S2])]));
  assert.deepEqual(c122(r), { casilla: 122, base: 0, operaciones: [] });
  assert.deepEqual(r.sinClasificar, [{ numero: 'F-1', tipo: 0, base: 1000, cuota: 10, motivo: 'inversion_sujeto_pasivo' }]);
  assert.deepEqual(r.motivosParaNoFiarse, [UNA_FUERA]);
});

test('SCRUM-1063f · dos S2 fuera: el PLURAL firmado, con su n', () => {
  const r = sobre(libroConS2ConCuota([factura('F-1', [S2]), factura('F-2', [S2])]));
  assert.deepEqual(r.motivosParaNoFiarse, [DOS_FUERA]);
});

test('SCRUM-1063f · la S2 fuera no se cuenta en el aviso de «sin calificación»: cada uno con SU texto', () => {
  const r = sobre(libroConS2ConCuota([factura('F-1', [S2, EXENTA], { total: '1030.00' })]));
  assert.deepEqual(r.motivosParaNoFiarse, [
    '1 operación(es) sin calificación fiscal (exenta / no sujeta / ISP) no entran en ninguna casilla',
    UNA_FUERA,
  ]);
});

test('SCRUM-1063f · CONTROL: sin S2 fuera ningún aviso habla de la ISP (y con ella, sí), y ninguno lleva «(s)»', () => {
  const dentro = m303([factura('F-1', [MANO, S2], { total: '1968.00' })]).motivosParaNoFiarse;
  assert.equal(dentro.filter((t) => HABLA_DE_ISP.test(t)).length, 0);
  for (const n of [1, 2]) {
    const facturas = Array.from({ length: n }, (_, i) => factura(`F-${i + 1}`, [S2]));
    const avisos = sobre(libroConS2ConCuota(facturas)).motivosParaNoFiarse.filter((t) => HABLA_DE_ISP.test(t));
    assert.equal(avisos.length, 1, `positivo con el MISMO token, n = ${n}`);
    assert.ok(!/\((s|es)\)/.test(avisos[0]), `🔴 el aviso con n = ${n} lleva un plural de programador: ${avisos[0]}`);
  }
});

// ── 3 · quien lee el 303 no la pierde ────────────────────────────────────────────────────────────

// SCRUM-1077c · el 390 ya no la declara sin clasificar: la pone en su 125 (SCRUM-1077 c.20833).
// El detalle de la 125 vive en `tests/scrum1077c-s2-casilla-125.test.mjs`; aquí sólo que la 122 del
// 303 llega al anual con su trimestre y no se pierde.
test('SCRUM-1063f · el 390 no pierde la S2 de la 122: llega a su 125, con su trimestre', () => {
  const vacio = (t) => sobre(libro([]), t);
  const t2 = m303([factura('F-1', [MANO, S2], { total: '1968.00' })]);
  const r = construirModelo390({ año: 2026, trimestres: [vacio(1), t2, vacio(3), vacio(4)], ahora: new Date(2027, 2, 1) });
  assert.deepEqual(r.volumenDeOperaciones.inversionSujetoPasivo,
    { casilla: '125', base: 1000, operaciones: [{ numero: 'F-1', tipo: 0, base: 1000, trimestre: 2 }] });
  assert.deepEqual(r.sinClasificar, []);
});

test('SCRUM-1063f · el CSV del 303 en el paquete de evidencias lleva la 122 con su factura', () => {
  const facturas = [factura('F-1', [MANO, S2], { total: '1968.00' })];
  const l = libro(facturas);
  const p = construirPaqueteEvidencias({
    libro: l, modelo303: sobre(l), albaranes: [],
    informeVerificacion: { examinados: 0, cuadran: 0, censoPorVersion: {}, hallazgos: [], versionesNoSoportadas: [], conclusion: 'todo_cuadra' },
    merchantId: M, periodo: { desde: '', hasta: '', año: 2026, trimestre: 2 },
  });
  const csv = p.ficheros.find((f) => f.nombre === FICHEROS.modelo303).contenido;
  const filas = csv.split(/\r?\n/).filter((x) => x.includes('INVERSION_SUJETO_PASIVO'));
  assert.equal(filas.length, 1, `🔴 la S2 de la 122 no está en el CSV:\n${csv}`);
  assert.equal(filas[0], '122;;;INVERSION_SUJETO_PASIVO F-1;1000,00;');
  assert.equal(csv.split(/\r?\n/).filter((x) => x.includes('SIN_CLASIFICAR')).length, 0, 'y no sale también como sin clasificar');
});
