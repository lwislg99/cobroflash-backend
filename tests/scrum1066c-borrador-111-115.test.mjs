// tests/scrum1066c-borrador-111-115.test.mjs — SCRUM-1066c
//
// El borrador del 111 y del 115 sobre la retención PRACTICADA de los gastos (SCRUM-1103). Cifras
// hechas a mano por perceptor. Decisión A del orquestador (22-oct-2026): 15 % y 7 % → 111
// (actividades económicas, dinerarios); el 19 % y cualquier otro tipo, SIN CLASIFICAR; el 115 sale
// a cero con su motivo porque ningún dato dice «alquiler». Procedencia de las casillas: `casillas.ts`.
// SCRUM-1066e: ese dato ya existe (la categoría `alquiler`); estos gastos no la llevan, así que lo
// de aquí sigue valiendo para ellos. Lo que la lleva: `tests/scrum1066e-alquiler-de-local.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirBorradorRetenciones } = await import('../dist/modules/fiscal/retenciones/retencionesPracticadas.js');
const casillas = await import('../dist/modules/fiscal/retenciones/casillas.js');
const { leerBorradorRetenciones } = await import('../dist/modules/fiscal/retenciones/retencionesPracticadas.repo.js');


/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  // SCRUM-1066e: `TIPOS_115` se fue (el 115 lo decide la categoría); la mutación es la misma idea
  // —clasificar por el 19 %— sobre la línea que decide ahora.
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: 'const a115 = g.category === CATEGORIA_ALQUILER;',
    a: 'const a115 = tipo === 19 || g.category === CATEGORIA_ALQUILER;',
    cae: 'SCRUM-1066c · el alquiler del local (19 %) NO entra en el 115' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: '    if (g.merchantId !== params.merchantId) {', a: '    if (false) {',
    cae: 'SCRUM-1066c · 🔴 regla 2' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: 'perceptores111.add(g.providerId);', a: 'perceptores111.add(g.id);',
    cae: 'SCRUM-1066c · cifras a mano por perceptor' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: "motivos.push('ninguna_retencion_anotada');", a: 'void 0;',
    cae: 'SCRUM-1066c · «no lleva retención» y «nadie lo dijo»' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: 'if (tipo === 0 || g.retencionPracticadaDeclarada === false)', a: 'if (g.retencionPracticadaDeclarada === false)',
    cae: 'SCRUM-1066c · «no lleva retención» y «nadie lo dijo»' },
  { fichero: 'src/modules/fiscal/retenciones/casillas.ts', de: "retenciones: '09'", a: "retenciones: '9'",
    cae: 'SCRUM-1066c · las casillas son las de los impresos' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts',
    de: '      merchantId: params.merchantId,\n      date: {', a: '      date: {',
    cae: 'SCRUM-1066c · el lector filtra por merchant' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: "? 'sin_dato_de_arrendamiento' : null", a: '? null : null',
    cae: 'SCRUM-1066c · 🔴 CONTROL NEGATIVO: trimestre sin gastos' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: 'cuota111 += cuota;', a: 'cuota111 += base * tipo / 100;',
    cae: 'SCRUM-1066c · la cuota es la GUARDADA' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts', de: 'if (g.providerId === null || g.providerId === undefined) {', a: 'if (false) {',
    cae: 'SCRUM-1066c · lo que no se puede colocar se declara' },
];

const M = 7;
let siguiente = 1;

/** La factura de la gestoría: 200 de base, 15 % → 30 retenidos. Proveedor 3. */
const gasto = (o = {}) => ({
  id: siguiente++, merchantId: M, date: new Date(2026, 4, 2, 9), providerId: 3, currency: 'EUR',
  baseAmount: '200.00', retencionPracticadaTipo: 15, retencionPracticadaCuota: '30.00',
  retencionPracticadaDeclarada: null, ...o,
});

const borrador = (gastos) => construirBorradorRetenciones({ gastos, merchantId: M, año: 2026, trimestre: 2 });

/** Σ cuota anotada = 09 + 3 + sin clasificar. Cada euro retenido está en una casilla o declarado. */
function cuadra(r, gastos) {
  const anotada = gastos.reduce((a, g) => a + (Number(g.retencionPracticadaCuota) || 0), 0);
  const repartida = r.modelo111.actividadesEconomicasDinerarias.retenciones.valor
    + r.modelo115.retenciones.valor
    + r.sinClasificar.reduce((a, s) => a + (s.cuota ?? 0), 0);
  assert.equal(Math.round(anotada * 100), Math.round(repartida * 100), '🔴 un euro retenido se ha evaporado');
}

test('SCRUM-1066c · las casillas son las de los impresos LEÍDOS (111: 07/08/09, 28-30 · 115: 1-5)', () => {
  assert.deepEqual({ ...casillas.CASILLAS_111_ACTIVIDADES_DINERARIAS }, { perceptores: '07', importe: '08', retenciones: '09' });
  assert.equal(casillas.CASILLA_111_SUMA_RETENCIONES, '28');
  assert.equal(casillas.CASILLA_111_A_DEDUCIR, '29');
  assert.equal(casillas.CASILLA_111_RESULTADO, '30');
  assert.deepEqual({ ...casillas.CASILLAS_115 }, { perceptores: '1', base: '2', retenciones: '3', aDeducir: '4', resultado: '5' });
  assert.match(casillas.FUENTE_111, /EHA\/586\/2011.*04948_001\.png/);
  assert.match(casillas.FUENTE_115, /20-nov-2000.*21430_005\.png/);
});

test('SCRUM-1066c · 🔴 CONTROL NEGATIVO: trimestre sin gastos → todo a cero, miradas 0 y ningún motivo', () => {
  const r = borrador([]);
  assert.equal(r.miradas, 0);
  assert.deepEqual(r.modelo111.actividadesEconomicasDinerarias.perceptores, { casilla: '07', valor: 0 });
  assert.deepEqual(r.modelo111.sumaRetenciones, { casilla: '28', valor: 0 });
  assert.deepEqual(r.modelo115.retenciones, { casilla: '3', valor: 0 });
  assert.equal(r.modelo115.vacioPorque, 'sin_dato_de_arrendamiento', '🔴 un 115 a cero sin motivo se lee «no pagó alquiler»');
  assert.deepEqual(r.motivosParaNoFiarse, []);
  assert.deepEqual(r.sinClasificar, []);
});

test('SCRUM-1066c · cifras a mano por perceptor: dos facturas de la gestoría (15 %) y una del arquitecto (7 %)', () => {
  const gastos = [
    gasto(),                                                                                    // P3: 200 → 30
    gasto({ baseAmount: '100.00', retencionPracticadaCuota: '15.00' }),                         // P3: 100 → 15
    gasto({ providerId: 4, baseAmount: '50.00', retencionPracticadaTipo: 7, retencionPracticadaCuota: '3.50' }), // P4: 50 → 3,50
  ];
  const r = borrador(gastos);
  const a = r.modelo111.actividadesEconomicasDinerarias;
  assert.deepEqual(a.perceptores, { casilla: '07', valor: 2 }, 'dos perceptores distintos, no tres facturas');
  assert.deepEqual(a.importe, { casilla: '08', valor: 350 });
  assert.deepEqual(a.retenciones, { casilla: '09', valor: 48.5 });
  assert.deepEqual(r.modelo111.sumaRetenciones, { casilla: '28', valor: 48.5 });
  assert.deepEqual(r.modelo111.aDeducir, { casilla: '29', valor: 0 });
  assert.deepEqual(r.modelo111.resultado, { casilla: '30', valor: 48.5 });
  assert.deepEqual(r.sinClasificar, []);
  assert.deepEqual(r.motivosParaNoFiarse, []);
  cuadra(r, gastos);
});

test('SCRUM-1066c · la cuota es la GUARDADA, no base × tipo: un céntimo de redondeo del proveedor se respeta', () => {
  const r = borrador([gasto({ baseAmount: '33.33', retencionPracticadaCuota: '5.01' })]); // 33,33 × 15 % = 4,9995
  assert.equal(r.modelo111.actividadesEconomicasDinerarias.retenciones.valor, 5.01,
    '🔴 la retención se ha recalculado: la de la factura recibida es la que se practicó');
});

test('SCRUM-1066c · un Decimal de Prisma (objeto con toString) se lee igual que una cadena', () => {
  const dec = (s) => ({ toString: () => s });
  const r = borrador([gasto({ baseAmount: dec('200.00'), retencionPracticadaCuota: dec('30.00') })]);
  assert.equal(r.modelo111.actividadesEconomicasDinerarias.importe.valor, 200);
  assert.equal(r.modelo111.actividadesEconomicasDinerarias.retenciones.valor, 30);
});

test('SCRUM-1066c · el alquiler del local (19 %) NO entra en el 115 ni en el 111: se declara con su dinero', () => {
  const gastos = [gasto(), gasto({ providerId: 9, baseAmount: '600.00', retencionPracticadaTipo: 19, retencionPracticadaCuota: '114.00' })];
  const r = borrador(gastos);
  assert.equal(r.modelo111.actividadesEconomicasDinerarias.retenciones.valor, 30, '🔴 el 19 % se ha colado en el 111');
  assert.equal(r.modelo115.retenciones.valor, 0, '🔴 el 19 % se ha colocado en el 115 por el tipo, sin dato que diga «alquiler»');
  assert.equal(r.modelo115.vacioPorque, 'sin_dato_de_arrendamiento');
  assert.deepEqual(r.sinClasificar.map((s) => [s.tipo, s.cuota, s.motivo]), [[19, 114, 'tipo_sin_modelo']]);
  assert.deepEqual(r.motivosParaNoFiarse, ['gastos_sin_clasificar']);
  cuadra(r, gastos);
});

test('SCRUM-1066c · lo que no se puede colocar se declara, cada cosa con su motivo', () => {
  const gastos = [
    gasto({ retencionPracticadaTipo: null }),                      // cuota sin tipo
    gasto({ retencionPracticadaCuota: null }),                     // tipo sin cuota: no se recalcula
    gasto({ baseAmount: null }),                                   // sin base no hay 08
    gasto({ providerId: null }),                                   // sin proveedor no hay 07
    gasto({ retencionPracticadaCuota: 'treinta' }),                // ilegible
    gasto({ retencionPracticadaTipo: 1, retencionPracticadaCuota: '2.00' }), // 1 %: tipo sin cita aquí
  ];
  const r = borrador(gastos);
  assert.deepEqual(r.sinClasificar.map((s) => s.motivo),
    ['sin_tipo', 'sin_cuota', 'sin_base', 'sin_perceptor', 'importe_ilegible', 'tipo_sin_modelo']);
  assert.equal(r.modelo111.sumaRetenciones.valor, 0);
  assert.deepEqual(r.motivosParaNoFiarse, ['gastos_sin_clasificar']);
});

test('SCRUM-1066c · «no lleva retención» y «nadie lo dijo» se cuentan aparte, y el segundo avisa', () => {
  const sinDato = gasto({ retencionPracticadaTipo: null, retencionPracticadaCuota: null });
  const r = borrador([sinDato, { ...sinDato, id: siguiente++ }]);
  assert.equal(r.sinDatoDeRetencion, 2);
  assert.equal(r.sinRetencion, 0);
  assert.deepEqual(r.motivosParaNoFiarse, ['ninguna_retencion_anotada'],
    '🔴 dos gastos y ninguno dice si retuvo: un 111 a cero no informa de nada, y tiene que decirlo');

  const decididos = borrador([
    gasto({ retencionPracticadaTipo: 0, retencionPracticadaCuota: null }),
    gasto({ retencionPracticadaTipo: null, retencionPracticadaCuota: null, retencionPracticadaDeclarada: false }),
  ]);
  assert.equal(decididos.sinRetencion, 2, 'tipo 0 y `declarada === false` son decisiones, no huecos');
  assert.deepEqual(decididos.motivosParaNoFiarse, []);

  // POSITIVO del mismo aviso: con UNA retención anotada, el cero del resto ya no es «no he mirado».
  const conUna = borrador([sinDato, gasto()]);
  assert.deepEqual(conUna.motivosParaNoFiarse, []);
});

test('SCRUM-1066c · 🔴 regla 2: un gasto de otro merchant rompe, no se suma ni se descarta en silencio', () => {
  assert.throws(() => borrador([gasto(), gasto({ merchantId: M + 1 })]), /regla 2/);
});

test('SCRUM-1066c · el lector filtra por merchant y por el trimestre, y no escribe', async () => {
  let args = null;
  const llamadas = [];
  const db = new Proxy({}, {
    get: (_, modelo) => new Proxy({}, {
      get: (_, op) => async (a) => {
        llamadas.push(`${String(modelo)}.${String(op)}`);
        args = a;
        return [gasto()];
      },
    }),
  });
  const r = await leerBorradorRetenciones(db, { merchantId: M, año: 2026, trimestre: 2 });
  assert.deepEqual(llamadas, ['expense.findMany'], '🔴 el borrador sólo lee: una llamada, un findMany');
  assert.equal(args.where.merchantId, M);
  assert.equal(args.where.date.gte.getTime(), new Date(2026, 3, 1).getTime());
  assert.equal(args.where.date.lte.getTime(), new Date(2026, 6, 0, 23, 59, 59, 999).getTime());
  assert.deepEqual(Object.keys(args.where).sort(), ['date', 'merchantId']);
  assert.equal(r.modelo111.sumaRetenciones.valor, 30);
});
