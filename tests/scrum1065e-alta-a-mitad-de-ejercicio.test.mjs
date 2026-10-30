// tests/scrum1065e-alta-a-mitad-de-ejercicio.test.mjs — SCRUM-1065e
//
// Decisión del fundador, SCRUM-1065 c.20869 (responde a c.20868, 1065d): cuando `Merchant.createdAt`
// es posterior al 1 de enero del ejercicio, el borrador del 130 lleva en `motivosParaNoFiarse` un
// motivo interno, como CÓDIGO y sin texto en pantalla: la 01 sólo ve lo facturado por YaQu desde el
// alta. La fecha se LEE de la fila del merchant; no hay esquema nuevo. El 1 de enero, a cualquier
// hora, no avisa. Fechas LOCALES, como `rangoAcumulado`.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirBorrador130 } = await import('../dist/modules/fiscal/modelo130/modelo130.js');
const { leerBorrador130 } = await import('../dist/modules/fiscal/modelo130/modelo130.repo.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: 'params.altaDelMerchant >= new Date(params.año, 0, 2, 0, 0, 0, 0)', a: 'params.altaDelMerchant >= new Date(params.año, 0, 1, 0, 0, 0, 0)',
    cae: 'SCRUM-1065e · 🔴 CONTROL NEGATIVO: alta el 1 de enero o antes' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: 'params.altaDelMerchant >= new Date(params.año, 0, 2, 0, 0, 0, 0)', a: 'params.altaDelMerchant > new Date(params.año, 0, 2, 0, 0, 0, 0)',
    cae: 'SCRUM-1065e · el borde: el 2 de enero a las 00:00' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: "motivosParaNoFiarse.push('alta_a_mitad_de_ejercicio');", a: 'void 0;',
    cae: 'SCRUM-1065e · alta en julio' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.repo.ts', de: 'trimestre: params.trimestre, altaDelMerchant });', a: 'trimestre: params.trimestre });',
    cae: 'SCRUM-1065e · el lector LEE el alta' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.repo.ts', de: 'where: { id: params.merchantId }, select:', a: 'where: { id: params.merchantId + 1 }, select:',
    cae: 'SCRUM-1065e · el lector LEE el alta' },
];

const M = 7;
const MOTIVO = 'alta_a_mitad_de_ejercicio';

const factura = (number, createdAt, base) => ({
  merchantId: M, number, createdAt, type: 'F1', total: String((base * 1.21).toFixed(2)), currency: 'EUR',
  status: 'pending', customerId: 3, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Mano de obra', qty: 1, price: base, tax: 0.21 }],
});

const FACTURAS = [factura('2026-001', new Date(2026, 6, 10, 12), 1000)];

const b130 = (altaDelMerchant, trimestre = 3) => construirBorrador130({
  libro: construirLibroRegistro({ facturas: FACTURAS, merchantId: M }),
  libroRecibidas: construirLibroRecibidas({ gastos: [], merchantId: M }),
  año: 2026, trimestre, altaDelMerchant,
});

/** Una base falsa: libros con lo de arriba y la fila del merchant `M` con su alta. */
function baseFalsa(alta) {
  const llamadas = [];
  const dentro = (d, r) => (!r?.gte || d >= r.gte) && (!r?.lte || d <= r.lte);
  const db = new Proxy({}, {
    get: (_, modelo) => new Proxy({}, {
      get: (_, op) => async (args) => {
        llamadas.push({ op: `${String(modelo)}.${String(op)}`, where: args?.where, select: args?.select });
        if (modelo === 'merchant' && op === 'findUnique') return args?.where?.id === M ? { createdAt: alta } : null;
        if (modelo === 'invoice') return FACTURAS.filter((f) => dentro(f.createdAt, args.where.createdAt));
        return [];
      },
    }),
  });
  return { db, llamadas };
}

test('SCRUM-1065e · alta en julio: el borrador lleva el motivo, como código', () => {
  for (const t of [1, 2, 3, 4]) {
    const r = b130(new Date(2026, 6, 10, 9), t);
    assert.ok(r.motivosParaNoFiarse.includes(MOTIVO), `T${t}: la 01 sólo ve lo de YaQu desde el alta, y no se avisa`);
  }
  // Es un código, no un texto: ni espacios ni mayúsculas, y nada que se parezca a una frase.
  assert.match(MOTIVO, /^[a-z_]+$/);
  // Lo demás del borrador no cambia: la 01 sigue siendo lo facturado.
  assert.equal(b130(new Date(2026, 6, 10, 9)).seccionI.ingresos.valor, 1000);
});

test('SCRUM-1065e · el borde: el 2 de enero a las 00:00 ya es posterior al 1 de enero', () => {
  assert.ok(b130(new Date(2026, 0, 2, 0, 0, 0, 0)).motivosParaNoFiarse.includes(MOTIVO));
});

test('SCRUM-1065e · 🔴 CONTROL NEGATIVO: alta el 1 de enero o antes, sin motivo', () => {
  for (const alta of [
    new Date(2026, 0, 1, 0, 0, 0, 0),
    new Date(2026, 0, 1, 23, 59, 59, 999),
    new Date(2025, 10, 3, 12),
    new Date(2020, 5, 1),
  ]) {
    assert.ok(!b130(alta).motivosParaNoFiarse.includes(MOTIVO), `alta ${alta.toISOString()}: no es a mitad del ejercicio 2026`);
  }
  // El ejercicio es el del BORRADOR, no el del alta: un alta de julio de 2025 no avisa en el 130 de 2026.
  assert.ok(!b130(new Date(2025, 6, 10)).motivosParaNoFiarse.includes(MOTIVO));
});

test('SCRUM-1065e · sin alta leída no se avisa de nada', () => {
  assert.ok(!b130(null).motivosParaNoFiarse.includes(MOTIVO));
  assert.ok(!b130(undefined).motivosParaNoFiarse.includes(MOTIVO));
});

test('SCRUM-1065e · el lector LEE el alta de la fila del merchant, filtrada por su id, y sólo esa columna', async () => {
  const { db, llamadas } = baseFalsa(new Date(2026, 6, 10, 9));
  const r = await leerBorrador130(db, { merchantId: M, año: 2026, trimestre: 3 });
  assert.ok(r.motivosParaNoFiarse.includes(MOTIVO), '🔴 el lector no le pasa el alta al borrador');
  const fila = llamadas.filter((l) => l.op.startsWith('merchant.'));
  assert.deepEqual(fila.map((l) => [l.op, l.where, l.select]), [['merchant.findUnique', { id: M }, { createdAt: true }]]);
  // CONTROL POSITIVO del mismo lector: con un alta anterior al ejercicio, el motivo NO sale.
  const antes = await leerBorrador130(baseFalsa(new Date(2025, 3, 1)).db, { merchantId: M, año: 2026, trimestre: 3 });
  assert.deepEqual(antes.motivosParaNoFiarse, []);
});
