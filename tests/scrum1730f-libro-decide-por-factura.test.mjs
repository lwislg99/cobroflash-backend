// SCRUM-1730f · el Libro registro decide FACTURA POR FACTURA con el criterio CONGELADO al sellar
// (`merchantCriterioCaja`), no con el del comercio de hoy (GO del fundador SCRUM-1730 c.21789 ③: NULL =
// por emisión, sin caer al vivo). Y la R1 hereda el de su F1 por `rectifiesId` (decisión c.22620:
// «El criterio es de la operación, no del papel»).
//
// Lee `leerLibroRegistro` con una base de mentira que filtra como Postgres lo que el lector le pide.
// Antes del arreglo, el libro decidía con el vivo (`rango.criterioCaja`) para todas: este test cae.
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerLibroRegistro } from '../dist/modules/invoicing/domain/libroRegistro.repo.js';
import { rangoTrimestre } from '../dist/modules/fiscal/modelo303/modelo303.js';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La R1 deja de heredar el criterio de su F1: cae a emisión.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: "    const heredado = typeof f.rectifiesId === 'number' ? (congeladoDe.get(f.rectifiesId) ?? null) : null;",
    a: "    const heredado = typeof f.rectifiesId === 'number' ? null : null;",
    cae: 'SCRUM-1730f · R1 hereda',
  },
];

const M = 7;
const Q1 = new Date(2026, 1, 15, 12);   // 15-feb-2026 → Q1
const Q2 = new Date(2026, 4, 20, 12);   // 20-may-2026 → Q2
const factura = (id, congelado, extra = {}) => ({
  id, merchantId: M, number: `F-2026-00${id}`, createdAt: Q1, paidAt: Q2,
  type: 'F1', total: '121.00', currency: 'EUR', status: 'paid',
  customerId: 3, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ qty: 1, price: 100, tax: 0.21 }],
  merchantCriterioCaja: congelado, rectifiesId: null, ...extra,
});
const r1 = (id, rectifiesId) => factura(id, null, {
  type: 'R1', rectifiesId, total: '-121.00', lines: [{ qty: 1, price: -100, tax: 0.21 }],
  createdAt: new Date(2026, 2, 10, 12), paidAt: new Date(2026, 4, 25, 12),   // emitida en Q1, cobrada en Q2
});
const cobro = (invoiceId, importe, fechaCobro) => ({
  id: invoiceId * 10, merchantId: M, invoiceId, chargeId: null, importe: String(importe), fechaCobro,
  fechaOrigen: 'declarada', metodo: 'transferencia', tipo: 'cobro', anulaId: null,
});

const TODAS = [
  factura(1, true),            // sellada POR CAJA
  factura(2, false),           // sellada SIN caja
  factura(3, null),            // sin congelado
  r1(4, 1),                    // R1 de la F1 por caja
  r1(5, null),                 // R1 sin rectifiesId
  r1(6, 999),                  // R1 cuya original no está
];
const COBROS = [cobro(1, '121.00', Q2), cobro(4, '-121.00', new Date(2026, 4, 25, 12))];

function baseCon(facturas, cobros) {
  const cumple = (v, f) => !f || ((!f.gte || (v && v >= f.gte)) && (!f.lte || (v && v <= f.lte)));
  const enLista = (v, f) => !f || !f.in || f.in.includes(v);
  return {
    invoice: {
      async findMany({ where: w = {} }) {
        return facturas.filter((f) => f.merchantId === w.merchantId && cumple(f.createdAt, w.createdAt)
          && cumple(f.paidAt, w.paidAt) && enLista(f.id, w.id)
          && (w.merchantCriterioCaja === undefined || f.merchantCriterioCaja === w.merchantCriterioCaja));
      },
    },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
    invoicePayment: {
      async findMany({ where: w = {} }) {
        return cobros.filter((p) => p.merchantId === w.merchantId && cumple(p.fechaCobro, w.fechaCobro)
          && enLista(p.invoiceId, w.invoiceId));
      },
    },
  };
}

const libro = (trimestre, rango, facturas = TODAS) =>
  leerLibroRegistro(baseCon(facturas, COBROS), { merchantId: M, ...rangoTrimestre(2026, trimestre), devengo: true, ...rango });
const ids = (l) => l.asientos.map((a) => a.numero);

/** Control positivo: la F1 sellada por caja, cobrada en Q2, tiene que MOVERSE de Q1 a Q2 con el vivo en false. */
async function seMueve() {
  const [q1, q2] = [await libro(1, { criterioCaja: false }), await libro(2, { criterioCaja: false })];
  return !ids(q1).includes('F-2026-001') && ids(q2).includes('F-2026-001');
}
const CIEGO = '🔴 CIEGO: la F1 sellada por caja no se ha movido al trimestre del cobro; ningún otro caso de este test mide nada.';

test('SCRUM-1730f · CONTROL POSITIVO: F1 sellada por caja en un comercio hoy SIN caja devenga al cobro, con sus cobros', async () => {
  assert.ok(await seMueve(), CIEGO);
  const q2 = await libro(2, { criterioCaja: false });
  const a = q2.asientos.find((x) => x.numero === 'F-2026-001');
  assert.equal(a.cobros.length, 1, '🔴 la factura por caja ha llegado al 303 sin sus cobros.');
});

test('SCRUM-1730f · F1 sellada SIN caja en un comercio hoy CON caja → por emisión', async () => {
  assert.ok(await seMueve(), CIEGO);
  assert.ok(ids(await libro(1, { criterioCaja: true })).includes('F-2026-002'));
  assert.ok(!ids(await libro(2, { criterioCaja: true })).includes('F-2026-002'),
    '🔴 una factura sellada sin caja se ha ido al trimestre del cobro porque el comercio está HOY en caja.');
});

test('SCRUM-1730f · F1 sin congelado (NULL) → por emisión, sin caer al vivo', async () => {
  assert.ok(await seMueve(), CIEGO);
  assert.ok(ids(await libro(1, { criterioCaja: true })).includes('F-2026-003'));
  assert.ok(!ids(await libro(2, { criterioCaja: true })).includes('F-2026-003'), '🔴 NULL ha caído al vivo.');
});

test('SCRUM-1730f · R1 hereda el criterio de su F1 por caja, cobrada en OTRO trimestre que su emisión', async () => {
  assert.ok(await seMueve(), CIEGO);
  for (const vivo of [false, true]) {
    assert.ok(!ids(await libro(1, { criterioCaja: vivo })).includes('F-2026-004'), `🔴 (vivo ${vivo}) la R1 de una F1 por caja se ha quedado en el trimestre de su emisión.`);
    assert.ok(ids(await libro(2, { criterioCaja: vivo })).includes('F-2026-004'), `🔴 (vivo ${vivo}) la R1 de una F1 por caja no está en el trimestre de su cobro.`);
  }
});

test('SCRUM-1730f · R1 sin rectifiesId u original ausente → por emisión', async () => {
  assert.ok(await seMueve(), CIEGO);
  const [q1, q2] = [ids(await libro(1, { criterioCaja: true })), ids(await libro(2, { criterioCaja: true }))];
  for (const n of ['F-2026-005', 'F-2026-006']) {
    assert.ok(q1.includes(n) && !q2.includes(n), `🔴 ${n} no ha ido por emisión.`);
  }
});

test('SCRUM-1730f · sin la clave criterioCaja, TODAS por emisión, como hoy', async () => {
  assert.ok(await seMueve(), CIEGO);
  const q1 = ids(await libro(1, {}));
  assert.deepEqual([...q1].sort(), TODAS.map((f) => f.number).sort(), '🔴 sin preguntar por el criterio, alguna ha salido de su emisión.');
});

test('SCRUM-1730f · ninguna sellada por caja: el libro es IDÉNTICO al de un comercio sin caja', async () => {
  assert.ok(await seMueve(), CIEGO);
  const sinCaja = [factura(2, false), factura(3, null)];
  const vivoSi = await libro(1, { criterioCaja: true }, sinCaja);
  const vivoNo = await libro(1, { criterioCaja: false }, sinCaja);
  assert.ok(vivoSi.asientos.length === 2, '🔴 CIEGO: el libro sin caja no trae las dos facturas.');
  assert.deepEqual(vivoSi, vivoNo, '🔴 con ninguna factura por caja, el vivo en true ha cambiado el libro.');
});
