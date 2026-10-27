// tests/scrum1065b-borrador-130.test.mjs — SCRUM-1065b
//
// El borrador del 130 (estimación directa, sección I) SOBRE los dos libros, acumulado del 1 de enero
// al fin del trimestre (RIRPF art. 110.1.a). Lo que YaQu no sabe sale `null` con su motivo, nunca a
// cero: la 02 (no hay lista de deducibles confirmada; decisión del fundador, SCRUM-1065 c.20721), la 06
// (`Invoice` no guarda la retención; y el art. 110.3.a sólo la deja restar a profesionales) y la 05
// fuera del T1. El 20 % se da aparte, como HIPÓTESIS, no como casilla. Casillas: `modelo130.ts`.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirBorrador130, rangoAcumulado } = await import('../dist/modules/fiscal/modelo130/modelo130.js');
const { leerBorrador130 } = await import('../dist/modules/fiscal/modelo130/modelo130.repo.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: '    ingresos += a.base;', a: '    ingresos += a.total ?? 0;',
    cae: 'SCRUM-1065b · cifras a mano: un año con tres trimestres' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: '    desde: new Date(año, 0, 1, 0, 0, 0, 0),', a: '    desde: new Date(año, (t - 1) * 3, 1, 0, 0, 0, 0),',
    cae: 'SCRUM-1065b · cifras a mano: un año con tres trimestres' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: '    hasta: new Date(año, t * 3, 0, 23, 59, 59, 999),', a: '    hasta: new Date(año, t * 3, 0, 0, 0, 0, 0),',
    cae: 'SCRUM-1065b · cambio de año' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: "      gastos: casilla(c.gastos, null, 'gastos_deducibles_sin_confirmar'),", a: '      gastos: casilla(c.gastos, r2(gastosAnotados)),',
    cae: 'SCRUM-1065b · 🔴 lo que no se sabe no sale a cero' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: "      retenciones: casilla(c.retenciones, null, 'retenciones_soportadas_sin_dato'),", a: '      retenciones: casilla(c.retenciones, 0),',
    cae: 'SCRUM-1065b · 🔴 lo que no se sabe no sale a cero' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: 'const c05 = trimestre === 1 ?', a: 'const c05 = trimestre === 0 ?',
    cae: 'SCRUM-1065b · 🔴 CONTROL NEGATIVO' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: 'const veinte = (rn: number) => (rn > 0 ?', a: 'const veinte = (rn: number) => (rn !== 0 ?',
    cae: 'SCRUM-1065b · trimestre con pérdidas' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: 'const PORCENTAJE_PAGO_FRACCIONADO = 20;', a: 'const PORCENTAJE_PAGO_FRACCIONADO = 21;',
    cae: 'SCRUM-1065b · cifras a mano: un año con tres trimestres' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: "if (ingresosSinComputar.length > 0) motivosParaNoFiarse.push('ingresos_sin_computar');", a: 'void 0;',
    cae: 'SCRUM-1065b · lo que no se puede leer se declara' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: "casilla: '06', cita:", a: "casilla: '6', cita:",
    cae: 'SCRUM-1065b · las casillas son las del impreso' },
];

const M = 7;

/** Una factura emitida: `base` de mano de obra al 21 %. */
const factura = (number, createdAt, base, o = {}) => ({
  merchantId: M, number, createdAt, type: 'F1', total: String((base * 1.21).toFixed(2)), currency: 'EUR',
  status: 'pending', customerId: 3, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Mano de obra', qty: 1, price: base, tax: 0.21 }], ...o,
});

/** Un gasto anotado con su base. */
const gasto = (date, base, o = {}) => ({
  merchantId: M, date, concept: 'Material', amount: String((base * 1.21).toFixed(2)), currency: 'EUR',
  providerId: 3, baseAmount: base === null ? null : String(base.toFixed(2)), vatRate: 21,
  vatAmount: base === null ? null : String((base * 0.21).toFixed(2)), vatDeducible: true,
  providerInvoiceNumber: 'P-1', providerInvoiceDate: date, category: 'materiales', ...o,
});

const b130 = (facturas, gastos, trimestre) => construirBorrador130({
  libro: construirLibroRegistro({ facturas, merchantId: M }),
  libroRecibidas: construirLibroRecibidas({ gastos, merchantId: M }),
  año: 2026, trimestre,
});

/** Una base falsa que RESPETA el `where` de fechas, para que el lector haga de verdad el acumulado. */
function baseFalsa(facturas, gastos) {
  const llamadas = [];
  const dentro = (d, r) => (!r?.gte || d >= r.gte) && (!r?.lte || d <= r.lte);
  const db = new Proxy({}, {
    get: (_, modelo) => new Proxy({}, {
      get: (_, op) => async (args) => {
        llamadas.push({ op: `${String(modelo)}.${String(op)}`, where: args?.where });
        if (modelo === 'invoice') return facturas.filter((f) => dentro(f.createdAt, args.where.createdAt));
        if (modelo === 'expense') return gastos.filter((g) => dentro(g.date, args.where.date));
        return [];
      },
    }),
  });
  return { db, llamadas };
}

// El año de las cifras a mano. Cada trimestre trae su factura y su gasto, y nada se repite.
//   T1: factura 1.000 (15-feb) · gasto 300 (10-mar)
//   T2: factura 2.000 (20-may) · gasto 500 (5-jun)
//   T3: factura 1.500 (10-ago) · gasto 200 (30-sep, 23:59 — el último minuto del T3)
const AÑO_FACTURAS = [
  factura('2026-001', new Date(2026, 1, 15, 12), 1000),
  factura('2026-002', new Date(2026, 4, 20, 12), 2000),
  factura('2026-003', new Date(2026, 7, 10, 12), 1500),
];
const AÑO_GASTOS = [
  gasto(new Date(2026, 2, 10, 9), 300),
  gasto(new Date(2026, 5, 5, 9), 500),
  gasto(new Date(2026, 8, 30, 23, 59), 200, { providerInvoiceNumber: 'P-3' }),
];

test('SCRUM-1065b · las casillas son las del impreso LEÍDO (sección I, 01-07), cada una con su cita', () => {
  const s = b130([], [], 2).seccionI;
  assert.deepEqual(Object.values(s).map((x) => x.casilla), ['01', '02', '03', '04', '05', '06', '07']);
  for (const x of Object.values(s)) {
    assert.match(x.cita, /HAP\/258\/2015.*01656_4793\.png/, `🔴 la ${x.casilla} no cita el anexo vigente`);
  }
  assert.match(s.ingresos.cita, /«Ingresos computables correspondientes al conjunto de las actividades ejercidas»/);
  assert.match(s.veintePorCiento.cita, /RIRPF art\. 110\.1\.a: «el 20 por ciento del rendimiento neto»/);
  assert.match(s.retenciones.cita, /110\.3\.a\.1\.º: «Actividades profesionales/);
  assert.match(s.pagoFraccionadoPrevio.cita, /\( 04 – 05 – 06 \)/);
});

test('SCRUM-1065b · 🔴 CONTROL NEGATIVO: T1 sin facturas ni gastos → 01 a 0, 05 a 0 por definición, nada que declarar', () => {
  const r = b130([], [], 1);
  assert.deepEqual(r.miradas, { facturas: 0, gastos: 0 });
  assert.equal(r.seccionI.ingresos.valor, 0);
  assert.equal(r.seccionI.ingresos.vacioPorque, undefined);
  assert.equal(r.seccionI.trimestresAnteriores.valor, 0, 'en el T1 no hay trimestres anteriores en el año: la suma vacía es 0');
  assert.equal(r.seccionI.trimestresAnteriores.vacioPorque, undefined);
  assert.deepEqual(r.motivosParaNoFiarse, []);
  assert.deepEqual(r.ingresosSinComputar, []);
  assert.deepEqual(r.hipotesisTodosLosGastosAnotados, { gastosAnotados: 0, rendimientoNeto: 0, veintePorCiento: 0 });
  assert.equal(r.avisoObligatorio, 'Borrador para tu asesor', 'firmado: SCRUM-1065 c.20813');
});

test('SCRUM-1065b · 🔴 lo que no se sabe no sale a cero: 02, 03, 04, 06 y 07 van a null con su motivo', () => {
  const r = b130([AÑO_FACTURAS[0]], [AÑO_GASTOS[0]], 1);
  const s = r.seccionI;
  assert.deepEqual([s.gastos.valor, s.gastos.vacioPorque], [null, 'gastos_deducibles_sin_confirmar']);
  assert.deepEqual([s.retenciones.valor, s.retenciones.vacioPorque], [null, 'retenciones_soportadas_sin_dato']);
  for (const x of [s.rendimientoNeto, s.veintePorCiento, s.pagoFraccionadoPrevio]) {
    assert.deepEqual([x.casilla, x.valor, x.vacioPorque], [x.casilla, null, 'depende_de_una_casilla_sin_dato']);
  }
  // POSITIVO del mismo test: la 01 SÍ tiene dato y sale con él.
  assert.equal(s.ingresos.valor, 1000);
});

test('SCRUM-1065b · cifras a mano: un año con tres trimestres, ACUMULADO y sin doble conteo', async () => {
  const esperado = {
    1: { c01: 1000, gastos: 300, rn: 700, veinte: 140 },
    2: { c01: 3000, gastos: 800, rn: 2200, veinte: 440 },
    3: { c01: 4500, gastos: 1000, rn: 3500, veinte: 700 },
  };
  for (const t of [1, 2, 3]) {
    const { db } = baseFalsa(AÑO_FACTURAS, AÑO_GASTOS);
    const r = await leerBorrador130(db, { merchantId: M, año: 2026, trimestre: t });
    const e = esperado[t];
    assert.equal(r.seccionI.ingresos.valor, e.c01, `T${t}: la 01 es el ACUMULADO desde el 1 de enero`);
    assert.deepEqual(r.hipotesisTodosLosGastosAnotados,
      { gastosAnotados: e.gastos, rendimientoNeto: e.rn, veintePorCiento: e.veinte }, `T${t}`);
    assert.equal(r.asientos.facturas, t, `T${t}: cada factura una vez`);
    assert.equal(r.asientos.gastos, t, `T${t}: cada gasto una vez`);
    if (t === 1) assert.equal(r.seccionI.trimestresAnteriores.valor, 0);
    else assert.deepEqual([r.seccionI.trimestresAnteriores.valor, r.seccionI.trimestresAnteriores.vacioPorque],
      [null, 'pagos_anteriores_sin_dato'], `T${t}: la 05 sale de las 07 anteriores, que no se saben`);
  }
});

test('SCRUM-1065b · trimestre con pérdidas: el rendimiento de la hipótesis sale negativo y el 20 % a 0', () => {
  const r = b130([factura('2026-001', new Date(2026, 1, 15), 400)], [gasto(new Date(2026, 1, 20), 1000)], 1);
  assert.deepEqual(r.hipotesisTodosLosGastosAnotados, { gastosAnotados: 1000, rendimientoNeto: -600, veintePorCiento: 0 },
    '🔴 impreso: «Si la casilla 03 fuese negativa, consigne el número cero»');
});

test('SCRUM-1065b · cambio de año: el 31-dic del año anterior y el 1-ene del siguiente no entran; el último minuto del T3 sí', async () => {
  const facturas = [
    factura('2025-099', new Date(2025, 11, 31, 23, 30), 9000),
    ...AÑO_FACTURAS,
    factura('2026-099', new Date(2026, 9, 1, 0, 0, 1), 7000),
  ];
  const { db, llamadas } = baseFalsa(facturas, AÑO_GASTOS);
  const r = await leerBorrador130(db, { merchantId: M, año: 2026, trimestre: 3 });
  assert.equal(r.seccionI.ingresos.valor, 4500, '🔴 se ha colado una factura de otro año o del T4');
  assert.equal(r.hipotesisTodosLosGastosAnotados.gastosAnotados, 1000, '🔴 el gasto del 30-sep a las 23:59 es del T3');
  const { desde, hasta } = rangoAcumulado(2026, 3);
  assert.equal(desde.getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(hasta.getTime(), new Date(2026, 8, 30, 23, 59, 59, 999).getTime());
  const inv = llamadas.find((l) => l.op === 'invoice.findMany');
  assert.equal(inv.where.createdAt.gte.getTime(), desde.getTime());
});

test('SCRUM-1065b · lo que no se puede leer se declara, con su dinero, y no entra', () => {
  const libro = construirLibroRegistro({
    facturas: [factura('2026-001', new Date(2026, 1, 15), 1000), factura(null, new Date(2026, 1, 16), 50)],
    merchantId: M,
  });
  const base = libro.asientos[0];
  libro.asientos.push({ ...base, numero: '2026-002', base: null, cuota: null, total: null, importeIlegible: true });
  const libroRecibidas = construirLibroRecibidas({ gastos: [gasto(new Date(2026, 1, 20), 100), gasto(new Date(2026, 1, 21), null, { amount: '80.00' })], merchantId: M });
  const r = construirBorrador130({ libro, libroRecibidas, año: 2026, trimestre: 1 });
  assert.equal(r.seccionI.ingresos.valor, 1000);
  assert.deepEqual(r.ingresosSinComputar, [{ numero: '2026-002', motivo: 'importe_ilegible' }]);
  assert.equal(r.facturasSinNumero.cuantas, 1);
  assert.deepEqual(r.gastosSinBase, { cuantos: 1, importe: 80 });
  assert.equal(r.hipotesisTodosLosGastosAnotados.gastosAnotados, 100);
  assert.deepEqual(r.motivosParaNoFiarse, ['ingresos_sin_computar', 'facturas_sin_numero', 'gastos_sin_base']);
});

test('SCRUM-1065b · 🔴 regla 2 y solo lectura: el lector filtra por merchant, sólo hace findMany, y lo ajeno no suma', async () => {
  const ajena = factura('X-1', new Date(2026, 1, 15), 5000, { merchantId: M + 1 });
  const { db, llamadas } = baseFalsa([AÑO_FACTURAS[0], ajena], [AÑO_GASTOS[0]]);
  const r = await leerBorrador130(db, { merchantId: M, año: 2026, trimestre: 1 });
  assert.equal(r.seccionI.ingresos.valor, 1000, '🔴 una factura de otro merchant ha entrado en la 01');
  assert.ok(llamadas.length > 0);
  // SCRUM-1065e: el lector lee también el alta de la fila del merchant, y esa fila se filtra por su `id`.
  // Es la ÚNICA lectura que no es un `findMany`; cualquier otra operación sigue tumbando el caso.
  const delAlta = (l) => l.op === 'merchant.findUnique';
  assert.deepEqual(llamadas.filter((l) => !l.op.endsWith('.findMany') && !delAlta(l)), [], '🔴 el borrador escribe');
  for (const l of llamadas) {
    if (delAlta(l)) assert.deepEqual(l.where, { id: M }, `🔴 ${l.op} lee la fila de otro merchant`);
    else assert.equal(l.where?.merchantId, M, `🔴 ${l.op} sin filtro de merchant`);
  }
});

test('SCRUM-1065b · fuera de la población se declara (secciones II y III, art. 110.2 y 110.4)', () => {
  assert.deepEqual(b130([], [], 4).fueraDePoblacion, [
    'seccion_II_actividades_agricolas_08_a_11',
    'seccion_III_total_liquidacion_12_a_19',
    'reduccion_60_por_ciento_art_110_2',
    'porcentaje_voluntario_mayor_art_110_4',
  ]);
});
