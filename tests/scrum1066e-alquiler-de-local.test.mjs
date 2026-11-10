// tests/scrum1066e-alquiler-de-local.test.mjs — SCRUM-1066e
//
// La categoría «alquiler» (rótulo firmado «Alquiler de local», SCRUM-1066 c.20497) en los dos
// borradores que la leen. Sin esquema: `Expense.category` es texto libre (c.20485).
//   · 115: el gasto de categoría «alquiler» con retención anotada entra en las casillas 1-5. Lo que
//     lo separa del 111 es la CATEGORÍA, no el 19 %: un 19 % sin la categoría sigue sin clasificar.
//   · 303: «alquiler» es gasto corriente (Javier: «Sí, como gasto corriente») → 28/29, no
//     `categoria_desconocida`.
// La categoría todavía no se puede apuntar desde la pantalla: `EXPENSE_CATEGORIES` es de S1 y la
// píldora de S2 (equipo de Luis). Estos tests miden los borradores, no la pantalla.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirBorradorRetenciones, CATEGORIA_ALQUILER } = await import('../dist/modules/fiscal/retenciones/retencionesPracticadas.js');
const { leerBorradorRetenciones } = await import('../dist/modules/fiscal/retenciones/retencionesPracticadas.repo.js');
const { construirIvaDeducible } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts',
    de: "export const CATEGORIA_ALQUILER = 'alquiler';", a: "export const CATEGORIA_ALQUILER = 'alquileres';",
    cae: 'SCRUM-1066e · la clave interna es «alquiler»' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts',
    de: 'const a115 = g.category === CATEGORIA_ALQUILER;', a: 'const a115 = false;',
    cae: 'SCRUM-1066e · 115: cifras a mano' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts',
    de: 'const a111 = !a115 && TIPOS_111_ACTIVIDADES.has(tipo);', a: 'const a111 = TIPOS_111_ACTIVIDADES.has(tipo);',
    cae: 'SCRUM-1066e · un alquiler al 15 %' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts',
    de: 'perceptores115.add(g.providerId);', a: 'perceptores115.add(g.id);',
    cae: 'SCRUM-1066e · 115: cifras a mano' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts',
    de: 'if (g.category === CATEGORIA_ALQUILER) hayAlquiler = true;', a: 'void 0;',
    cae: 'SCRUM-1066e · un alquiler SIN retención' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts',
    de: '  category: true,\n', a: '',
    cae: 'SCRUM-1066e · el lector pide la categoría' },
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: "'subcontrata', 'otros', 'alquiler'", a: "'subcontrata', 'otros'",
    cae: 'SCRUM-1066e · 303: el alquiler es gasto corriente' },
];

const M = 7;
let siguiente = 1;

/** La gestoría: 200 de base, 15 % → 30 retenidos. Proveedor 3. */
const gasto = (o = {}) => ({
  id: siguiente++, merchantId: M, date: new Date(2026, 4, 2, 9), providerId: 3, currency: 'EUR',
  category: 'otros', baseAmount: '200.00', retencionPracticadaTipo: 15, retencionPracticadaCuota: '30.00',
  retencionPracticadaDeclarada: null, ...o,
});

/** El local: 600 de base, 19 % → 114 retenidos. Arrendador = proveedor 9. */
const alquiler = (o = {}) => gasto({
  category: 'alquiler', providerId: 9, baseAmount: '600.00', retencionPracticadaTipo: 19, retencionPracticadaCuota: '114.00', ...o,
});

const borrador = (gastos) => construirBorradorRetenciones({ gastos, merchantId: M, año: 2026, trimestre: 2 });

function cuadra(r, gastos) {
  const anotada = gastos.reduce((a, g) => a + (Number(g.retencionPracticadaCuota) || 0), 0);
  const repartida = r.modelo111.actividadesEconomicasDinerarias.retenciones.valor
    + r.modelo115.retenciones.valor
    + r.sinClasificar.reduce((a, s) => a + (s.cuota ?? 0), 0);
  assert.equal(Math.round(anotada * 100), Math.round(repartida * 100), '🔴 un euro retenido se ha evaporado');
}

test('SCRUM-1066e · la clave interna es «alquiler» (c.20485: el profesional no la ve)', () => {
  assert.equal(CATEGORIA_ALQUILER, 'alquiler');
});

test('SCRUM-1066e · 115: cifras a mano — dos meses del local y un trastero de otro arrendador', () => {
  const gastos = [
    alquiler(),                                                                              // P9: 600 → 114
    alquiler({ date: new Date(2026, 5, 2, 9) }),                                             // P9: 600 → 114
    alquiler({ providerId: 11, baseAmount: '100.00', retencionPracticadaCuota: '19.00' }),   // P11: 100 → 19
    gasto(),                                                                                 // 111: 200 → 30
  ];
  const r = borrador(gastos);
  assert.deepEqual(r.modelo115.perceptores, { casilla: '1', valor: 2 }, 'dos arrendadores, no tres recibos');
  assert.deepEqual(r.modelo115.base, { casilla: '2', valor: 1300 });
  assert.deepEqual(r.modelo115.retenciones, { casilla: '3', valor: 247 });
  assert.deepEqual(r.modelo115.aDeducir, { casilla: '4', valor: 0 });
  assert.deepEqual(r.modelo115.resultado, { casilla: '5', valor: 247 });
  assert.equal(r.modelo115.vacioPorque, null);
  assert.equal(r.modelo111.actividadesEconomicasDinerarias.retenciones.valor, 30, '🔴 el alquiler se ha colado en el 111');
  assert.deepEqual(r.sinClasificar, []);
  assert.deepEqual(r.motivosParaNoFiarse, []);
  cuadra(r, gastos);
});

test('SCRUM-1066e · 🔴 un 19 % SIN la categoría sigue sin clasificar: separa la categoría, no el tipo', () => {
  const gastos = [alquiler({ category: 'otros' })];
  const r = borrador(gastos);
  assert.equal(r.modelo115.retenciones.valor, 0);
  assert.equal(r.modelo115.vacioPorque, 'sin_dato_de_arrendamiento');
  assert.deepEqual(r.sinClasificar.map((s) => [s.tipo, s.cuota, s.motivo]), [[19, 114, 'tipo_sin_modelo']]);
  cuadra(r, gastos);
});

test('SCRUM-1066e · un alquiler al 15 % va al 115 y no al 111: lo dice la categoría', () => {
  const gastos = [alquiler({ retencionPracticadaTipo: 15, retencionPracticadaCuota: '90.00' })];
  const r = borrador(gastos);
  assert.equal(r.modelo115.retenciones.valor, 90);
  assert.equal(r.modelo111.sumaRetenciones.valor, 0, '🔴 el alquiler ha caído en el 111 por su tipo');
  cuadra(r, gastos);
});

test('SCRUM-1066e · un alquiler SIN retención (≤ 900 €/año, SCRUM-1106) deja el 115 a cero sin «sin dato»', () => {
  const r = borrador([alquiler({ retencionPracticadaTipo: 0, retencionPracticadaCuota: null })]);
  assert.equal(r.modelo115.retenciones.valor, 0);
  assert.equal(r.sinRetencion, 1);
  assert.equal(r.modelo115.vacioPorque, null,
    '🔴 hay un alquiler en el trimestre: el cero lo explica «sin retención», no la falta del dato');
});

test('SCRUM-1066e · un alquiler sin arrendador ni base se declara, como el resto', () => {
  const r = borrador([alquiler({ providerId: null }), alquiler({ baseAmount: null })]);
  assert.deepEqual(r.sinClasificar.map((s) => s.motivo), ['sin_perceptor', 'sin_base']);
  assert.equal(r.modelo115.retenciones.valor, 0);
});

test('SCRUM-1066e · el lector pide la categoría, y sigue filtrando sólo por merchant y trimestre', async () => {
  let args = null;
  const db = { expense: { findMany: async (a) => { args = a; return [alquiler()]; } } };
  const r = await leerBorradorRetenciones(db, { merchantId: M, año: 2026, trimestre: 2 });
  assert.equal(args.select.category, true, '🔴 sin la categoría, el 115 vuelve a salir siempre a cero');
  assert.deepEqual(Object.keys(args.where).sort(), ['date', 'merchantId']);
  assert.equal(r.modelo115.retenciones.valor, 114);
});

test('SCRUM-1066e · 303: el alquiler es gasto corriente → 28/29, no categoria_desconocida', () => {
  const d = construirIvaDeducible(construirLibroRecibidas({
    merchantId: M,
    gastos: [{
      merchantId: M, date: new Date(2026, 4, 2, 9), concept: 'Local', amount: '726.00', currency: 'EUR',
      providerId: 9, baseAmount: '600.00', vatRate: 21, vatAmount: '126.00', vatDeducible: true,
      providerInvoiceNumber: 'A-5', providerInvoiceDate: new Date(2026, 4, 1), category: 'alquiler',
    }],
  }));
  assert.deepEqual(d.sinClasificar, [], '🔴 el IVA del alquiler ha caído aparte');
  assert.deepEqual({ ...d.corrientes }, { casillaBase: 28, casillaCuota: 29, base: 600, cuota: 126 });
});
