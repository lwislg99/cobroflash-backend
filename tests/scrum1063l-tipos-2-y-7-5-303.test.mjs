// tests/scrum1063l-tipos-2-y-7-5-303.test.mjs — SCRUM-1063l
//
// El caso límite «tipos 2 % y 7,5 % (Q-C7)» del enunciado de SCRUM-1063, por los DOS lados del 303.
// Medido el 12-nov-2026 por contenido sobre `tests/scrum1063*`, `scrum295-modelo-303*`, `scrum1064*`
// y `scrum1077*`: `scrum1064d` fija el 5 % y el 7,5 % del DEVENGADO; nadie fijaba el 2 % devengado
// ni ningún tipo raro del SOPORTADO. SOLO TEST: `src/` no se toca en este tramo.
//
// Lo que se sabe de esos tipos (sin revisión profesional): Q-C7 de `docs/legal/PREGUNTAS_ASESOR.md`,
// respuesta de IA (SCRUM-1261 c.17638): son los tipos temporales de alimentos de 2024 y «a un oficio
// no le aplican nunca; en el código pueden quedar como valores admitidos pero NO OFRECIDOS».
// Las filas del 303 de 2026 las da la tabla de las instrucciones de la AEAT que leyó SCRUM-1064d el
// 24-oct-2026 (literal en la cabecera de `tests/scrum1064d-tipos-y-rotulos-del-303.test.mjs`):
// «Cero 150, 151, 152 4% 01, 02., 03 10% 04, 05, 06 21% 07, 08, 09». El 2 % no tiene fila en 2026.
// Las de 2024 NO las he leído: el 303 de un periodo de 2024 queda fuera de este test.
//
// Lo que fija cada caso es lo que el código HACE HOY; los que nadie ha decidido lo dicen en su
// nombre. Las cifras están escritas A MANO.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

// Mutaciones del catálogo de la casa (`scripts/meta-guard-mutaciones.mjs`): cada una tiene que
// tumbar el caso cuyo nombre contiene su `cae`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Alguien le da fila al 2 % en un periodo de 2026: la 27 dejaría de ser la de la AEAT.
    fichero: 'src/modules/fiscal/modelo303/casillas.ts',
    de: 'Object.freeze({ tipo: 4,  base: 1,',
    a: 'Object.freeze({ tipo: 2,  base: 1,',
    cae: 'SCRUM-1063l · devengado al 2 %',
  },
  {
    // El soportado deja de ser indiferente al tipo: un gasto al 2 % se aparta de la 28/29.
    fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: "if (a.tipoIva === null || a.tipoIva === 0) return aparte('tipo_cero');",
    a: "if (a.tipoIva === null || a.tipoIva < 4) return aparte('tipo_cero');",
    cae: 'SCRUM-1063l · soportado al 2 %',
  },
  {
    // El libro de recibidas deja pasar un tipo no entero: el 7,5 % entraría en la 29.
    fichero: 'src/modules/invoicing/domain/libroRecibidas.ts',
    de: 'if (n === null || !Number.isInteger(n) || n < 0 || n > 100) return null;',
    a: 'if (n === null || n < 0 || n > 100) return null;',
    cae: 'SCRUM-1063l · soportado al 7,5 %',
  },
];

const M = 7;

/** Una factura emitida el 15-abr-2026 (2T) de 1.000 € de base a `tax` (fracción). */
const factura = (number, tax) => ({
  merchantId: M, number, createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: (1000 * (1 + tax)).toFixed(2), currency: 'EUR', status: 'pending', customerId: 3, quoteId: null,
  chargeId: null, albaranRefs: null, lines: [{ concept: 'Obra', qty: 1, price: 1000, tax }],
});

/** Un gasto deducible y corriente, apuntado el 2-may-2026 (2T). Por defecto 300 + 63 al 21 %. */
const gasto = (o = {}) => ({
  id: 1, merchantId: M, date: new Date(2026, 4, 2, 9), concept: 'Cable', amount: '363.00', currency: 'EUR',
  providerId: 3, baseAmount: '300.00', vatRate: 21, vatAmount: '63.00', vatDeducible: true,
  providerInvoiceNumber: 'P-1', providerInvoiceDate: new Date(2026, 4, 1), category: 'materiales', ...o,
});

const m303 = (facturas, gastos) => construirModelo303({
  libro: construirLibroRegistro({ facturas, merchantId: M }),
  libroRecibidas: construirLibroRecibidas({ gastos, merchantId: M }),
  año: 2026, trimestre: 2,
});

// ══════════════════════════════════════════════════════════════════════════
// DEVENGADO · el 2 % no tiene fila en 2026: se aparta con `tipo_sin_casilla`, como el 5 % y el
// 7,5 % de 1064d, y no se pierde ni se fuerza a la fila vecina (`modelo303.ts`, rama `!tripleta`).
// ══════════════════════════════════════════════════════════════════════════

test('SCRUM-1063l · devengado al 2 % en un periodo de 2026: fuera de la 27, apartado con su motivo y sin perderse', () => {
  // A mano: la del 21 % da 1.000 + 210 en 07/09; la del 2 % (1.000 + 20) no tiene fila. 27 = 210.
  // Sin gastos: 45 = 0 y 46 = 210.
  const r = m303([factura('2026-CF-001', 0.21), factura('2026-CF-002', 0.02)], []);

  const c07 = r.casillas.find((c) => c.casillaBase === 7);
  assert.deepEqual([c07?.base, c07?.cuota], [1000, 210], 'control positivo: la del 21 % sí cae en su fila');
  assert.equal(r.casillas.find((c) => c.tipo === 2), undefined, '🔴 el 2 % tiene fila en el 303 de 2026');
  assert.equal(r.casillaTotalCuota.valor, 210, '🔴 la 27 no es sólo la cuota del 21 %: el 2 % ha entrado');
  assert.equal(r.resultadoRegimenGeneral.valor, 210);

  const aparte = r.sinClasificar.map((o) => `${o.tipo}:${o.motivo}:${o.base}/${o.cuota}`);
  assert.deepEqual(aparte, ['2:tipo_sin_casilla:1000/20'], '🔴 el 2 % no se aparta con su motivo, o se aparta otra cosa');

  // Invariante: lo que está en casillas más lo apartado es el libro entero (2.000 de base).
  const apartado = r.sinClasificar.reduce((s, o) => s + o.base, 0);
  assert.equal(Math.round((r.totalBase + apartado) * 100), 200000, '🔴 se ha perdido o duplicado base del libro');
});

// ══════════════════════════════════════════════════════════════════════════
// SOPORTADO · la 28/29 es UNA casilla para todos los tipos («Por cuotas soportadas en operaciones
// interiores corrientes», `casillas.ts`, del impreso de la Orden HAC/27/2026): el tipo del gasto no
// decide a dónde va; sólo lo aparta el 0 o la falta de tipo. Hoy el 2 % entra en la 28/29.
// ══════════════════════════════════════════════════════════════════════════

test('SCRUM-1063l · soportado al 2 %: entra en la 28/29 con su cuota, como cualquier tipo distinto de 0 — comportamiento actual, sin criterio del asesor (SCRUM-1264)', () => {
  // A mano: 28 = 300 + 100 = 400; 29 = 63 + 2 = 65; 45 = 65; 27 = 210 (una F1 de 1.000 al 21 %);
  // 46 = 210 − 65 = 145.
  const gastos = [
    gasto(),
    gasto({ id: 2, concept: 'Género', amount: '102.00', baseAmount: '100.00', vatRate: 2, vatAmount: '2.00', providerInvoiceNumber: 'P-2' }),
  ];
  const r = m303([factura('2026-CF-001', 0.21)], gastos);

  assert.equal(r.ivaDeducible.corrientes.base, 400, '🔴 la base del gasto al 2 % no está en la 28');
  assert.equal(r.ivaDeducible.corrientes.cuota, 65, '🔴 la cuota del gasto al 2 % no está en la 29');
  assert.equal(r.ivaDeducible.casillaTotalADeducir.valor, 65);
  assert.deepEqual(r.ivaDeducible.sinClasificar, [], '🔴 el gasto al 2 % se ha apartado');
  assert.equal(r.resultadoRegimenGeneral.valor, 145);
});

// ══════════════════════════════════════════════════════════════════════════
// SOPORTADO AL 7,5 % · hoy no se puede guardar: `vat_rate` es un entero en `model Expense`. Y si
// llegara, el libro de recibidas lo deja sin tipo (`tipo()` de `libroRecibidas.ts` sólo admite
// enteros) y el 303 lo aparta con el motivo que tiene para «sin tipo»: no deduce lo que no sabe.
// ══════════════════════════════════════════════════════════════════════════

test('SCRUM-1063l · soportado al 7,5 %: no entra en la 29 y no se pierde — comportamiento actual, inalcanzable hoy', () => {
  // A mano: el del 21 % da 29 = 63; el de 7,5 % (100 + 7,50) se aparta entero. 46 = 210 − 63 = 147.
  const raro = gasto({ id: 2, concept: 'Género', amount: '107.50', baseAmount: '100.00', vatRate: 7.5, vatAmount: '7.50', providerInvoiceNumber: 'P-2' });
  const libro = construirLibroRecibidas({ gastos: [gasto(), raro], merchantId: M });
  assert.deepEqual(libro.asientos.map((a) => a.tipoIva), [21, null], 'el libro de recibidas sólo admite tipos enteros');

  const r = m303([factura('2026-CF-001', 0.21)], [gasto(), raro]);
  assert.equal(r.ivaDeducible.corrientes.cuota, 63, '🔴 la cuota al 7,5 % ha entrado en la 29');
  assert.equal(r.resultadoRegimenGeneral.valor, 147);
  assert.deepEqual(r.ivaDeducible.sinClasificar.map((o) => `${o.motivo}:${o.base}/${o.cuota}`), ['tipo_cero:100/7.5'],
    'se aparta con el motivo de «sin tipo» que ya existe; este test no escribe ningún texto');
});

test('SCRUM-1063l · el 7,5 % es inalcanzable en un gasto porque `vat_rate` es entero en `model Expense`', () => {
  // Lectura del esquema (regla 40: se LEE). Sin comentarios, partido por líneas (A23, casillas 2 y 3).
  const esquema = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const lineas = esquema.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '').trim());
  const desde = lineas.indexOf('model Expense {');
  assert.ok(desde >= 0, '🔴 CIEGO: no encuentro `model Expense` en el esquema');
  const hasta = lineas.indexOf('}', desde);
  const campos = lineas.slice(desde + 1, hasta).filter((l) => l !== '');
  assert.ok(campos.length >= 10, `🔴 CIEGO: el bloque de Expense sólo tiene ${campos.length} líneas con campo`);
  const vat = campos.filter((l) => /^vatRate\s/.test(l));
  assert.equal(vat.length, 1, '🔴 CIEGO: `vatRate` no aparece una vez en `model Expense`');
  assert.match(vat[0], /^vatRate\s+Int\?\s/,
    '`vatRate` ha dejado de ser entero: el 7,5 % ya se puede guardar y el caso anterior deja de ser inalcanzable. Antes de seguir, que el asesor y el fundador digan a dónde va (Q-C7).');
});
