// tests/scrum1063j-casos-limite-303.test.mjs — SCRUM-1063j
//
// Dos casos límite del enunciado de SCRUM-1063 que ningún test fijaba (medido el 27-oct-2026 con
// `grep` sobre `tests/*303*`, `tests/scrum1063*` y `tests/scrum1077*`): «rectificativas» y «gasto
// de otro periodo». SOLO TEST: `src/` no se toca en este tramo.
//
// Lo que fija cada caso es lo que el código HACE HOY. Donde ni el registro ni el asesor han dicho
// qué debería hacer, el caso lo declara en su nombre: «comportamiento actual, sin criterio del
// asesor (SCRUM-1264)». Si el asesor decide otra cosa, cae el caso y se cambia el código con su
// decisión delante; el test no la adelanta.
//
// Las cifras están escritas A MANO: recalcularlas con las mismas funciones no probaría nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { leerModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.repo.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

// Mutaciones del catálogo de la casa (`scripts/meta-guard-mutaciones.mjs`): cada una tiene que
// tumbar el caso cuyo nombre contiene su `cae`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts', de: 'acc.base += e.base;',
    a: 'acc.base += Math.abs(e.base);', cae: 'SCRUM-1063j · R1 dentro del trimestre' },
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts', de: 'acc.cuota += e.cuota;',
    a: 'acc.cuota += Math.abs(e.cuota);', cae: 'SCRUM-1063j · R1 de una factura de otro trimestre' },
  { fichero: 'src/modules/invoicing/domain/libroRecibidas.repo.ts', de: '      date: fecha,',
    a: '      providerInvoiceDate: fecha,', cae: 'SCRUM-1063j · gasto con fecha de otro periodo' },
];

const M = 7;

/** Una factura emitida de 1.000 + 210 el 15-abr-2026 (2T). */
const factura = (o = {}) => ({
  merchantId: M, number: '2026-CF-001', createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '1210.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines: [{ concept: 'Obra', qty: 1, price: 1000, tax: 0.21 }], ...o,
});

/** Una R1 el 20-may-2026 (2T) que rectifica `base` € de la obra al 21 %, en negativo. */
const rectificativa = (base) => factura({
  number: '2026-R-001', type: 'R1', createdAt: new Date(2026, 4, 20, 10),
  total: (-base * 1.21).toFixed(2), lines: [{ concept: 'Obra', qty: -1, price: base, tax: 0.21 }],
});

/** Un gasto deducible y corriente de 300 + 63, apuntado el 2-may-2026 (2T). */
const gasto = (o = {}) => ({
  id: 1, merchantId: M, date: new Date(2026, 4, 2, 9), concept: 'Cable', amount: '363.00', currency: 'EUR',
  providerId: 3, baseAmount: '300.00', vatRate: 21, vatAmount: '63.00', vatDeducible: true,
  providerInvoiceNumber: 'P-1', providerInvoiceDate: new Date(2026, 4, 1), category: 'materiales', ...o,
});

const m303 = (facturas, gastos = [gasto()]) => construirModelo303({
  libro: construirLibroRegistro({ facturas, merchantId: M }),
  libroRecibidas: construirLibroRecibidas({ gastos, merchantId: M }),
  año: 2026, trimestre: 2,
});
const c07 = (r) => r.casillas.find((c) => c.casillaBase === 7);

// ═════════════════════════════════════════════════════════════════════════════════════════
// RECTIFICATIVAS · el libro no distingue una R1 de otra factura (`docs/master/SCRUM-1063.md:386`,
// `docs/master/SCRUM-1077.md:70`): la R1 va a la fila de SU TIPO con su signo. En el 390 eso sale
// con el aviso `rectificativas_sin_casilla_propia` («no a la 29/30 de "Modificación de bases y
// cuotas". Cómo entra lo dice el asesor», `modelo390.ts:57-59`). El 303 NO lleva ese aviso, y su
// casilla de modificación de bases y cuotas no se ha leído en el impreso ni la ha decidido nadie.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1063j · R1 dentro del trimestre: resta en la fila de su tipo (07/09) — comportamiento actual, sin criterio del asesor (SCRUM-1264)', () => {
  // A mano: 1.000 − 200 = 800 de base; 210 − 42 = 168 de cuota. 27 = 168; 29 = 63; 46 = 168 − 63 = 105.
  const r = m303([factura(), rectificativa(200)]);
  assert.equal(c07(r).base, 800, '🔴 la R1 no resta su base en la casilla 07');
  assert.equal(c07(r).cuota, 168, '🔴 la R1 no resta su cuota en la casilla 09');
  assert.equal(r.casillaTotalCuota.valor, 168);
  assert.equal(r.totalBase, 800);
  assert.equal(r.ivaDeducible.casillaTotalADeducir.valor, 63);
  assert.equal(r.resultadoRegimenGeneral.valor, 105);
  assert.equal(r.resultadoFinal.sumaDeResultados.valor, 105, 'la 64 = 46 (c.20717)');
  assert.deepEqual(r.sinClasificar, [], 'la R1 al 21 % no se aparta: entra en su fila');
  assert.equal(r.asientos, 2, 'la R1 es un asiento más');
  assert.deepEqual(r.motivosParaNoFiarse, [],
    'HOY el 303 no avisa de la R1 (el 390 sí). Si se añade un aviso, su texto pide firma (regla 39).');
});

test('SCRUM-1063j · R1 de una factura de otro trimestre: el 2T sólo ve la R1, y la 46 sale negativa — comportamiento actual, sin criterio del asesor (SCRUM-1264)', () => {
  // La original (1T) no está en el libro del 2T: lo acota el lector por fecha. A mano: 07 = −200,
  // 09 = −42, 27 = −42; 29 = 63; 46 = −42 − 63 = −105.
  const r = m303([rectificativa(200)]);
  assert.equal(c07(r).base, -200);
  assert.equal(c07(r).cuota, -42, '🔴 la cuota de la R1 entra en positivo');
  assert.equal(r.casillaTotalCuota.valor, -42);
  assert.equal(r.resultadoRegimenGeneral.valor, -105);
  assert.equal(r.resultadoFinal.sumaDeResultados.valor, -105);
  assert.deepEqual(r.motivosParaNoFiarse, [], 'una 27 negativa no dispara hoy ningún aviso');
});

test('SCRUM-1063j · R1 que anula la factura entera: todo a cero y salta el aviso de «todas a cero» — comportamiento actual, sin criterio del asesor (SCRUM-1264)', () => {
  // A mano: 1.000 − 1.000 = 0 y 210 − 210 = 0. Sin gastos.
  const r = m303([factura(), rectificativa(1000)], []);
  assert.equal(c07(r).base, 0);
  assert.equal(c07(r).cuota, 0);
  assert.equal(r.casillaTotalCuota.valor, 0);
  assert.equal(r.asientos, 2);
  // El aviso nació para «cero con asientos = mecanismo roto» (cabecera de `modelo303.ts`). Con una
  // anulación completa el cero es real, y el aviso salta igual: se fija para que nadie lo cambie a
  // ciegas. El literal es el que ya existía; este test no escribe ningún texto.
  assert.deepEqual(r.motivosParaNoFiarse, ['hay 2 asientos y TODAS las casillas salen a cero sin nada declarado aparte']);
});

test('SCRUM-1063j · R1: cada euro del libro sigue en una casilla (el invariante de `modelo303.ts`, al céntimo)', () => {
  const facturas = [factura(), rectificativa(200)];
  const libro = construirLibroRegistro({ facturas, merchantId: M });
  const r = m303(facturas);
  const baseLibro = libro.asientos.reduce((s, a) => s + a.base, 0);
  const cuotaLibro = libro.asientos.reduce((s, a) => s + a.cuota, 0);
  assert.equal(Math.round(baseLibro * 100), 80000, 'control: el libro suma 800 de base');
  assert.equal(Math.round(r.totalBase * 100), Math.round(baseLibro * 100));
  assert.equal(Math.round(r.casillaTotalCuota.valor * 100), Math.round(cuotaLibro * 100));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// GASTO CON FECHA DE OTRO PERIODO · el soportado sale del libro de recibidas del MISMO rango
// (`docs/master/SCRUM-1063.md:111-112`), y ese rango se filtra por `date` —la fecha del APUNTE—,
// no por `providerInvoiceDate` (`libroRecibidas.repo.ts:57-64`: «es una decisión, no un
// descuido», porque `providerInvoiceDate` es nullable). Qué fecha manda para el periodo de la
// deducción no lo ha dicho el asesor: el propio comentario lo deja como pregunta abierta.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Base falsa que filtra como Prisma: igualdad, o rango `{ gte, lte }` sobre CUALQUIER columna. */
function baseFalsa(gastos) {
  const visto = [];
  const casa = (fila, where) => Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (v && typeof v === 'object' && ('gte' in v || 'lte' in v)) {
      return fila[k] != null && (!v.gte || fila[k] >= v.gte) && (!v.lte || fila[k] <= v.lte);
    }
    return fila[k] === v;
  });
  return {
    visto,
    invoice: { async findMany() { return []; } },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
    merchant: { async findUnique() { return { id: M }; } },
    expense: { async findMany(args) { visto.push(args.where); return gastos.filter((g) => casa(g, args.where)); } },
  };
}

// A: apuntado el 2-may (2T), factura del proveedor del 20-mar (1T): 300 + 63.
// B: apuntado el 28-mar (1T), factura del proveedor del 2-abr (2T): 100 + 21.
// C: apuntado el 10-jul (3T): no es de ninguno de los dos. Hace de control de la base falsa.
const GASTOS = [
  gasto({ id: 1, providerInvoiceDate: new Date(2026, 2, 20) }),
  gasto({ id: 2, date: new Date(2026, 2, 28, 9), providerInvoiceDate: new Date(2026, 3, 2),
    baseAmount: '100.00', vatAmount: '21.00', amount: '121.00', providerInvoiceNumber: 'P-2' }),
  gasto({ id: 3, date: new Date(2026, 6, 10, 9), providerInvoiceDate: new Date(2026, 6, 9),
    baseAmount: '1000.00', vatAmount: '210.00', amount: '1210.00', providerInvoiceNumber: 'P-3' }),
];

test('SCRUM-1063j · gasto con fecha de otro periodo: manda la fecha del APUNTE, no la de la factura del proveedor — comportamiento actual, sin criterio del asesor (SCRUM-1264)', async () => {
  // A mano. 2T: sólo A → 28 = 300, 29 = 63, sin emitidas 46 = 0 − 63 = −63.
  //         1T: sólo B → 28 = 100, 29 = 21, 46 = −21.
  const t2 = await leerModelo303(baseFalsa(GASTOS), { merchantId: M, año: 2026, trimestre: 2 });
  assert.deepEqual([t2.ivaDeducible.corrientes.base, t2.ivaDeducible.corrientes.cuota], [300, 63],
    '🔴 el 2T no deduce el gasto APUNTADO en mayo (o mete el apuntado en marzo)');
  assert.equal(t2.ivaDeducible.asientos, 1);
  assert.equal(t2.resultadoRegimenGeneral.valor, -63);

  const t1 = await leerModelo303(baseFalsa(GASTOS), { merchantId: M, año: 2026, trimestre: 1 });
  assert.deepEqual([t1.ivaDeducible.corrientes.base, t1.ivaDeducible.corrientes.cuota], [100, 21],
    '🔴 el 1T no deduce el gasto APUNTADO en marzo');
  assert.equal(t1.ivaDeducible.asientos, 1);
  assert.equal(t1.resultadoRegimenGeneral.valor, -21);
});

test('SCRUM-1063j · gasto de otro periodo: no se deduce dos veces ni se pierde entre trimestres', async () => {
  const cuotas = [];
  for (const trimestre of [1, 2, 3, 4]) {
    const r = await leerModelo303(baseFalsa(GASTOS), { merchantId: M, año: 2026, trimestre });
    cuotas.push(r.ivaDeducible.corrientes.cuota);
  }
  // A mano: 21 (B) + 63 (A) + 210 (C) + 0 = 294 = la cuota de los tres gastos.
  assert.deepEqual(cuotas, [21, 63, 210, 0]);
});

test('SCRUM-1063j · CONTROL de la base falsa: filtra de verdad, y el lector pide `date` y no `providerInvoiceDate`', async () => {
  // Sin este control, una base falsa que devolviese TODO haría pasar los casos de arriba por motivos
  // equivocados. C (3T) tiene que quedarse fuera del 2T.
  const db = baseFalsa(GASTOS);
  const t2 = await leerModelo303(db, { merchantId: M, año: 2026, trimestre: 2 });
  assert.equal(t2.ivaDeducible.miradas, 1, 'control: de los 3 gastos, la base falsa sólo da A al 2T (C es del 3T)');
  assert.equal(db.visto.length, 1);
  assert.ok(db.visto[0].date, '🔴 el lector no filtra por `date`');
  assert.equal(db.visto[0].providerInvoiceDate, undefined, '🔴 el lector filtra por la fecha de la factura del proveedor');
  // Y la base falsa sabe filtrar por otra columna: si el lector cambiase a `providerInvoiceDate`,
  // A saldría del 2T y B entraría (es lo que tumba la tercera mutación).
  const otra = (await baseFalsa(GASTOS).expense.findMany({
    where: { merchantId: M, providerInvoiceDate: { gte: new Date(2026, 3, 1), lte: new Date(2026, 5, 30, 23, 59, 59, 999) } },
  })).map((g) => g.id);
  assert.deepEqual(otra, [2], 'control positivo: filtrando por la fecha del proveedor, el 2T sería B');
});
