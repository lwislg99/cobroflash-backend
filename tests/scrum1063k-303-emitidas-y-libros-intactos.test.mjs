// tests/scrum1063k-303-emitidas-y-libros-intactos.test.mjs — SCRUM-1063k
//
// La aceptación 7 de SCRUM-1063 dice «Documentos emitidos y libros intactos (regla 29)», y sus
// «Tests esperados» piden «emitidas y libros intactos». Medido el 12-nov-2026 con `grep` sobre los
// siete `tests/scrum1063*`, `scrum295-modelo-303*` y `scrum1077-borrador-390`: ninguno lo fijaba.
// Todos miden QUÉ CIFRA sale; ninguno mira qué le hace el 303 a lo que lee. SOLO TEST: `src/` no se
// toca.
//
// Dos preguntas distintas, y se contestan por separado:
//   1. ¿El lector del 303 (`leerModelo303`, lo que monta `GET /admin/modelo-303`) ESCRIBE algo en
//      la base? Se le pasa una base que apunta cada método que se le pide, de cualquier modelo y de
//      la raíz (`$executeRaw`, `$transaction`…). Una escritura se APUNTA, no se lanza: si se
//      lanzara, un `try/catch` del código la podría tragar y el test saldría verde.
//   2. ¿Las filas que lee y los libros que le pasan salen como entraron? Se comparan con una copia
//      profunda tomada antes. Un objeto congelado no serviría: `dist/` es CommonJS sin
//      `'use strict'` en todos los ficheros, y ahí asignar a un objeto congelado no falla: se calla.
//
// Cada pregunta lleva su CONTROL SEMBRADO (cicatriz ② del encargo): una escritura fabricada que el
// registrador TIENE que ver y una mutación fabricada que la comparación TIENE que ver. Sin ellos, un
// registrador que no apunta nada y una comparación de un objeto consigo mismo dan el mismo verde.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { leerModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.repo.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

// Mutaciones del catálogo de la casa (`scripts/meta-guard-mutaciones.mjs`): cada una tiene que
// tumbar el caso cuyo nombre contiene su `cae`. Una por cada forma de romper la regla 29 desde el
// 303: escribir en la base, tocar el libro que recibe y reordenar las filas que lee.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo303/modelo303.repo.ts',
    de: '  exigirLibroRecibidasLegible(libroRecibidas);',
    a: '  exigirLibroRecibidasLegible(libroRecibidas); await (db as never as { invoice: { updateMany(a: object): Promise<unknown> } }).invoice.updateMany({ where: { merchantId: params.merchantId }, data: {} });',
    cae: 'SCRUM-1063k · el lector del 303 sólo LEE' },
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: '      acumulado.set(e.tipo, acc);',
    a: '      acumulado.set(e.tipo, acc); Object.assign(e, { leido: true });',
    cae: 'SCRUM-1063k · construirModelo303 deja el libro' },
  { fichero: 'src/modules/invoicing/domain/libroRecibidas.repo.ts',
    de: '  return construirLibroRecibidas({ gastos, merchantId: rango.merchantId });',
    a: '  gastos.reverse(); return construirLibroRecibidas({ gastos, merchantId: rango.merchantId });',
    cae: 'SCRUM-1063k · las filas que lee el 303' },
];

const M = 7;

/** Una factura emitida el 15-abr-2026 (2T). */
const factura = (o = {}) => ({
  merchantId: M, number: '2026-CF-001', createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '1210.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines: [{ concept: 'Obra', qty: 1, price: 1000, tax: 0.21 }], ...o,
});

/** Un gasto deducible y corriente de 300 + 63, apuntado el 2-may-2026 (2T). */
const gasto = (o = {}) => ({
  id: 1, merchantId: M, date: new Date(2026, 4, 2, 9), concept: 'Cable', amount: '363.00', currency: 'EUR',
  providerId: 3, baseAmount: '300.00', vatRate: 21, vatAmount: '63.00', vatDeducible: true,
  providerInvoiceNumber: 'P-1', providerInvoiceDate: new Date(2026, 4, 1), category: 'materiales', ...o,
});

// Un trimestre que pasa por las ramas del cálculo: una entrega al 21 %, una R1, una S2 (casilla
// 122), un suplido, un gasto corriente, una herramienta grande (apartada) y uno sin datos de IVA.
const FACTURAS = () => [
  factura(),
  factura({ number: '2026-R-001', type: 'R1', createdAt: new Date(2026, 4, 20, 10), total: '-242.00',
    lines: [{ concept: 'Obra', qty: -1, price: 200, tax: 0.21 }] }),
  factura({ number: '2026-CF-002', createdAt: new Date(2026, 4, 3, 10), total: '1050.00',
    lines: [{ concept: 'Obra para empresa (ISP)', qty: 1, price: 1000, tax: 0, causa: 'S2' },
      { concept: 'Tasa municipal', qty: 1, price: 50, tax: 0, suplido: true }] }),
];
const GASTOS = () => [
  gasto(),
  gasto({ id: 2, date: new Date(2026, 4, 10, 9), concept: 'Furgoneta', amount: '24200.00',
    baseAmount: '20000.00', vatAmount: '4200.00', providerInvoiceNumber: 'P-2', category: 'herramientas' }),
  gasto({ id: 3, date: new Date(2026, 5, 1, 9), concept: 'Tique', amount: '60.00', baseAmount: null,
    vatRate: null, vatAmount: null, vatDeducible: null, providerInvoiceNumber: null }),
];

const LECTURAS = new Set(['findMany', 'findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow',
  'count', 'aggregate', 'groupBy']);

/**
 * Una base que APUNTA cada método que se le pide. Las lecturas que el 303 hace devuelven `filas`;
 * cualquier otro método (de un modelo o de la raíz) se apunta y devuelve una promesa vacía, para que
 * el código siga y no pueda tragarse un error.
 */
function baseQueApunta(filas) {
  const pedidos = [];
  const respuesta = {
    'invoice.findMany': () => filas.facturas,
    'quote.findMany': () => [],
    'albaran.findMany': () => [],
    'merchant.findUnique': () => ({ id: M }),
    'merchant.findFirst': () => ({ id: M }),
    'expense.findMany': () => filas.gastos,
  };
  const metodo = (nombre) => async (...args) => {
    pedidos.push(nombre);
    const r = respuesta[nombre];
    return r ? r(...args) : (nombre.endsWith('Many') ? { count: 0 } : null);
  };
  const db = new Proxy({}, {
    get(_, modelo) {
      if (typeof modelo !== 'string' || modelo === 'then') return undefined;
      if (modelo.startsWith('$')) return metodo(modelo);
      return new Proxy({}, {
        get(__, m) {
          if (typeof m !== 'string' || m === 'then') return undefined;
          return metodo(`${modelo}.${m}`);
        },
      });
    },
  });
  const escrituras = () => pedidos.filter((p) => p.startsWith('$') || !LECTURAS.has(p.split('.')[1]));
  return { db, pedidos, escrituras };
}

test('SCRUM-1063k · el lector del 303 sólo LEE la base: ninguna escritura, de ningún modelo', async () => {
  const filas = { facturas: FACTURAS(), gastos: GASTOS() };
  const { db, pedidos, escrituras } = baseQueApunta(filas);
  const r = await leerModelo303(db, { merchantId: M, año: 2026, trimestre: 2 });
  // Control positivo: el registrador VIO las lecturas que el 303 tiene que hacer. Si no apuntara
  // nada, «cero escrituras» sería un cero de no mirar.
  assert.ok(pedidos.includes('invoice.findMany'), `🔴 el registrador no vio la lectura de facturas: ${pedidos}`);
  assert.ok(pedidos.includes('expense.findMany'), `🔴 el registrador no vio la lectura de gastos: ${pedidos}`);
  assert.deepEqual(escrituras(), [], '🔴 el 303 ha pedido a la base algo que no es leer (regla 29)');
  // Y el cálculo corrió de verdad sobre esas filas: 07 = 1.000 − 200.
  assert.equal(r.casillas.find((c) => c.casillaBase === 7).base, 800);
});

test('SCRUM-1063k · 🔴 CONTROL SEMBRADO: el registrador ve una escritura de modelo y una de la raíz', async () => {
  const { db, escrituras } = baseQueApunta({ facturas: [], gastos: [] });
  await db.invoice.findMany({});
  assert.deepEqual(escrituras(), [], 'una lectura no es una escritura');
  // Dentro de un try/catch, como podría venir en el código: tiene que verse igual.
  try { await db.invoice.update({ where: { id: 1 }, data: { total: '0' } }); } catch { /* tragado */ }
  await db.$executeRaw`UPDATE invoices SET total = 0`;
  assert.deepEqual(escrituras(), ['invoice.update', '$executeRaw']);
});

test('SCRUM-1063k · las filas que lee el 303 salen intactas (facturas emitidas y gastos)', async () => {
  const filas = { facturas: FACTURAS(), gastos: GASTOS() };
  const antes = structuredClone(filas);
  const { db } = baseQueApunta(filas);
  await leerModelo303(db, { merchantId: M, año: 2026, trimestre: 2 });
  assert.deepEqual(filas.facturas, antes.facturas, '🔴 el 303 ha tocado las facturas emitidas que leyó (regla 29)');
  assert.deepEqual(filas.gastos, antes.gastos, '🔴 el 303 ha tocado los gastos que leyó');
});

test('SCRUM-1063k · construirModelo303 deja el libro y el libro de recibidas como entraron', () => {
  const libro = construirLibroRegistro({ facturas: FACTURAS(), merchantId: M });
  const libroRecibidas = construirLibroRecibidas({ gastos: GASTOS(), merchantId: M });
  const antes = structuredClone({ libro, libroRecibidas });
  // Control positivo: el libro trae lo que este caso dice mirar (si viniera vacío, no habría nada
  // que tocar y el verde sería del vacío).
  assert.equal(libro.asientos.length, 3);
  assert.ok(libro.asientos.some((a) => a.porTipo.some((e) => e.causa === 'S2')), 'la S2 está en el libro');
  assert.equal(libroRecibidas.miradas, 3, 'el libro de recibidas miró los tres gastos');
  const r = construirModelo303({ libro, libroRecibidas, año: 2026, trimestre: 2 });
  assert.equal(r.informacionAdicional.inversionSujetoPasivo.base, 1000, 'la S2 llegó a la 122');
  assert.deepEqual(libro, antes.libro, '🔴 el 303 ha tocado el libro de emitidas que recibió');
  assert.deepEqual(libroRecibidas, antes.libroRecibidas, '🔴 el 303 ha tocado el libro de recibidas');
});

test('SCRUM-1063k · 🔴 CONTROL SEMBRADO: la comparación ve un campo añadido y un orden cambiado', () => {
  const libro = construirLibroRegistro({ facturas: FACTURAS(), merchantId: M });
  const antes = structuredClone(libro);
  Object.assign(libro.asientos[0].porTipo[0], { leido: true });
  assert.throws(() => assert.deepEqual(libro, antes), 'un campo añadido tiene que verse');
  const gastos = GASTOS();
  const copia = structuredClone(gastos);
  gastos.reverse();
  assert.throws(() => assert.deepEqual(gastos, copia), 'un orden cambiado tiene que verse');
});
