// tests/scrum1063b-303-soportado-resultado.test.mjs — SCRUM-1063b
//
// El 303 pasa de «solo repercutido» a repercutido + IVA deducible (28/29, 45) + resultado (46).
// Decisión A del orquestador (25-sep-2026): lo deducible y corriente va a la 28/29; «herramientas»
// (corriente o bien de inversión: `Expense` no lo guarda) y lo nunca decidido quedan SIN CLASIFICAR
// y declarados; 30/31 vacías con su porqué. Procedencia de las casillas: `casillas.ts`.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303, construirIvaDeducible } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const casillas = await import('../dist/modules/fiscal/modelo303/casillas.js');
const { leerModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.repo.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

const M = 7;

/** Una factura emitida de 100 + 21 en el 2T-2026. */
const factura = (o = {}) => ({
  merchantId: M, number: '2026-CF-001', createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '121.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }], ...o,
});

/** Un gasto clasificado, deducible y corriente: 40 + 8,40. */
const gasto = (o = {}) => ({
  merchantId: M, date: new Date(2026, 4, 2, 9), concept: 'Cable', amount: '48.40', currency: 'EUR',
  providerId: 3, baseAmount: '40.00', vatRate: 21, vatAmount: '8.40', vatDeducible: true,
  providerInvoiceNumber: 'P-1', providerInvoiceDate: new Date(2026, 4, 1), category: 'materiales', ...o,
});

function m303(gastos, facturas = [factura()]) {
  const libro = construirLibroRegistro({ facturas, merchantId: M });
  const libroRecibidas = construirLibroRecibidas({ gastos, merchantId: M });
  return construirModelo303({ libro, libroRecibidas, año: 2026, trimestre: 2 });
}

test('SCRUM-1063b · las casillas son las del formulario leído (28/29, 30/31, 45, 46)', () => {
  assert.deepEqual(casillas.CASILLAS_DEDUCIBLE_CORRIENTES, { base: 28, cuota: 29 });
  assert.deepEqual(casillas.CASILLAS_DEDUCIBLE_BIENES_INVERSION, { base: 30, cuota: 31 });
  assert.equal(casillas.CASILLA_TOTAL_A_DEDUCIR, 45);
  assert.equal(casillas.CASILLA_RESULTADO_REGIMEN_GENERAL, 46);
});

test('SCRUM-1063b · 🔴 CONTROL NEGATIVO: sin gastos, 45 = 0 y 46 = 27, sin motivos nuevos', () => {
  const r = m303([]);
  assert.equal(r.casillaTotalCuota.valor, 21);
  assert.equal(r.ivaDeducible.casillaTotalADeducir.valor, 0);
  assert.deepEqual(r.resultadoRegimenGeneral, { casilla: 46, valor: 21 });
  assert.equal(r.ivaDeducible.miradas, 0, 'cero gastos examinados: el cero es «no compró», y se ve');
  assert.deepEqual(r.motivosParaNoFiarse, [], '🔴 un trimestre sin compras no puede salir «no fiable»');
});

test('SCRUM-1063b · un gasto deducible y corriente va a la 28/29, y la 46 es 27 − 45', () => {
  const r = m303([gasto()]);
  assert.deepEqual(
    { ...r.ivaDeducible.corrientes },
    { casillaBase: 28, casillaCuota: 29, base: 40, cuota: 8.4 },
  );
  assert.deepEqual(r.ivaDeducible.casillaTotalADeducir, { casilla: 45, valor: 8.4 });
  assert.deepEqual(r.resultadoRegimenGeneral, { casilla: 46, valor: 12.6 });
  assert.deepEqual(r.motivosParaNoFiarse, []);
});

test('SCRUM-1063b · 🔴 «herramientas» NO se reparte: sin clasificar y declarado', () => {
  const r = m303([gasto(), gasto({ category: 'herramientas', providerInvoiceNumber: 'P-2' })]);
  assert.equal(r.ivaDeducible.corrientes.cuota, 8.4, '🔴 una herramienta ha entrado en la 29: eso es adivinar');
  assert.deepEqual(r.ivaDeducible.sinClasificar.map((g) => [g.numeroProveedor, g.motivo]),
    [['P-2', 'posible_bien_de_inversion']]);
  assert.equal(r.motivosParaNoFiarse.length, 1, '🔴 hay un gasto fuera de la 45 y el 303 no lo dice');
});

test('SCRUM-1063b · 30/31 siempre vacías, y dicen POR QUÉ', () => {
  const b = m303([gasto({ category: 'herramientas' })]).ivaDeducible.bienesDeInversion;
  assert.deepEqual({ ...b }, {
    casillaBase: 30, casillaCuota: 31, base: 0, cuota: 0, vaciaPorque: 'sin_dato_de_bien_de_inversion',
  });
});

test('SCRUM-1063b · cada gasto que no puede colocarse sale con SU motivo', () => {
  const d = construirIvaDeducible(construirLibroRecibidas({
    merchantId: M,
    gastos: [
      gasto({ providerInvoiceNumber: 'nulo', vatDeducible: null }),
      gasto({ providerInvoiceNumber: 'no', vatDeducible: false }),
      gasto({ providerInvoiceNumber: 'sincat', category: null }),
      gasto({ providerInvoiceNumber: 'nueva', category: 'vehiculos' }),
      gasto({ providerInvoiceNumber: 'cero', vatRate: 0, vatAmount: '0.00' }),
      gasto({ providerInvoiceNumber: 'sincuota', vatAmount: null }),
    ],
  }));
  assert.deepEqual(d.sinClasificar.map((g) => [g.numeroProveedor, g.motivo]), [
    ['nulo', 'deducibilidad_sin_decidir'],
    ['sincat', 'categoria_desconocida'],
    ['nueva', 'categoria_desconocida'],
    ['cero', 'tipo_cero'],
    ['sincuota', 'sin_cuota'],
  ]);
  assert.equal(d.noDeducibles, 1, '«se decidió que no» se cuenta aparte: no es un fallo');
  assert.equal(d.casillaTotalADeducir.valor, 0);
});

test('SCRUM-1063b · 🔴 INVARIANTE: todo asiento está en la 29, sin clasificar o en no deducibles', () => {
  const gastos = [
    gasto(), gasto({ category: 'otros', baseAmount: '10.00', vatRate: 10, vatAmount: '1.00' }),
    gasto({ category: 'herramientas' }), gasto({ vatDeducible: null }), gasto({ vatDeducible: false }),
  ];
  const recibidas = construirLibroRecibidas({ gastos, merchantId: M });
  const d = construirIvaDeducible(recibidas);
  const cuotaSin = d.sinClasificar.reduce((s, g) => s + (g.cuota ?? 0), 0);
  const cuotaNo = recibidas.asientos.filter((a) => a.deducible === false).reduce((s, a) => s + a.cuota, 0);
  const cuotaLibro = recibidas.asientos.reduce((s, a) => s + a.cuota, 0);
  assert.equal(Math.round((d.corrientes.cuota + cuotaSin + cuotaNo) * 100), Math.round(cuotaLibro * 100),
    '🔴 un euro de cuota soportada se ha evaporado entre el libro y el 303');
  assert.equal(d.corrientes.cuota, 9.4);
});

test('SCRUM-1063b · los gastos sin datos de IVA se declaran con su dinero', () => {
  const r = m303([gasto(), gasto({ baseAmount: null, vatRate: null, vatAmount: null, vatDeducible: null, amount: '60.00' })]);
  assert.equal(r.ivaDeducible.gastosSinDatosDeIva, 1);
  assert.equal(r.ivaDeducible.gastosSinDatosDeIvaImporte, 60);
  assert.equal(r.motivosParaNoFiarse.length, 1);
});

test('SCRUM-1063b · el lector pide los gastos del merchant, del MISMO trimestre y con categoría', async () => {
  const visto = [];
  const db = {
    invoice: { async findMany() { return [factura()]; } },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
    merchant: { async findUnique() { return { id: M }; } },
    expense: { async findMany(args) { visto.push(args); return [gasto(), gasto({ merchantId: 99 })]; } },
  };
  const r = await leerModelo303(db, { merchantId: M, año: 2026, trimestre: 2 });
  assert.equal(visto.length, 1, '🔴 el 303 no ha leído el libro de recibidas');
  assert.equal(visto[0].where.merchantId, M, '🔴 la consulta de gastos no está acotada al merchant (regla 2)');
  assert.deepEqual(visto[0].where.date, { gte: new Date(2026, 3, 1), lte: new Date(2026, 5, 30, 23, 59, 59, 999) });
  assert.equal(visto[0].select.category, true, '🔴 sin categoría, todo acabaría como categoria_desconocida');
  assert.equal(r.ivaDeducible.corrientes.cuota, 8.4, 'el gasto del otro merchant no entra');
  assert.equal(r.resultadoRegimenGeneral.valor, 12.6);
});
