// tests/scrum1732d-libro-por-tramos.test.mjs — SCRUM-1732 PR-2 (U′, c.22012 + ✅ c.22014; Q3–Q6 de c.22007)
//
// Sin gate: ni BD, ni red. EJECUTA `leerLibroRegistro` y `leerModelo303` de `dist/` contra una base en
// memoria que responde al `where` como Postgres, con `invoice_payments` (PR-1, #3203).
//
// Lo que fija el diseño firmado:
//   · el LIBRO de expedidas (también con caja) lleva cada factura en el periodo de su EXPEDICIÓN,
//     entera (RIVA 63.3 y 69.5), con `cobros[]` completado desde `invoice_payments` (RIVA 61 decies.1);
//   · el 303 con caja devenga por los TRAMOS cobrados en el periodo, y lo no cobrado en el tope del
//     31-dic X+1 (LIVA 163 terdecies.Uno); redondeo en el último tramo (c.21926);
//   · tramo sin medio → `cobrosSinMedio` (Q3) · anuladas y anulaciones no cuentan (Q4) · lo cobrado de
//     más → `cobradoDeMas`, sin lanzar (Q5) · garantía retenida sin liberar → la regla literal (Q6).
//   · factura `paid` sin filas → como hoy: un cobro del 100 % en `paidAt` (c.21926 §①).
//   · la zona del comercio, no UTC (SCRUM-1445e/f).
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerLibroRegistro } from '../dist/modules/invoicing/domain/libroRegistro.repo.js';
import { leerModelo303 } from '../dist/modules/fiscal/modelo303/modelo303.repo.js';
import { rangoTrimestre } from '../dist/modules/fiscal/modelo303/modelo303.js';

/**
 * 🔴 Q6 (c.22007): lo retenido sin liberar devenga en el tope del 31-dic X+1 —la regla literal—, y una
 * liberación posterior al tope no vuelve a devengar. Es la pregunta 49 del asesor (SCRUM-1264 c.21995),
 * SIN RESPUESTA: esto no es conformidad, es el defecto conocido de una decisión pendiente. Si el asesor
 * contesta otra cosa, el cambio retira esta entrada en el mismo PR.
 */
export const DEFECTO_CONOCIDO = {
  garantiaRetenidaAlTope: { declarado: true, tickets: ['SCRUM-1732', 'SCRUM-1264'],
    que: 'la garantía retenida sin liberar devenga en el tope del 31-dic X+1 y su liberación posterior no devenga: pregunta 49 del asesor sin respuesta' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El 303 deja de pedir el devengo: vuelve a sumar el libro de expedidas (factura entera en T1).
    fichero: 'src/modules/fiscal/modelo303/modelo303.repo.ts',
    de: '...criterio, devengo: true });',
    a: '...criterio });',
    cae: 'SCRUM-1732d · ① emitida en T1 y cobrada en dos tramos: el libro la lleva entera en T1 con sus dos cobros, y el 303 devenga cada tramo en su trimestre',
  },
  {
    // El libro vuelve a traer la factura al periodo del cobro (leerPorCaja también para el libro).
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: "  const porDevengo = campo !== CAMPO_EMISION && rango.devengo === true && Object.keys(fecha).length > 0;",
    a: "  const porDevengo = campo !== CAMPO_EMISION && Object.keys(fecha).length > 0;",
    cae: 'SCRUM-1732d · ① emitida en T1 y cobrada en dos tramos: el libro la lleva entera en T1 con sus dos cobros, y el 303 devenga cada tramo en su trimestre',
  },
  {
    // Redondeo de cada fracción en vez de cerrar con el último tramo: los céntimos no cuadran.
    fichero: 'src/modules/invoicing/domain/devengoPorCaja.ts',
    de: '    const p = i === tramos.length - 1 ? abs - hecho : Math.round((abs * tramos[i].centimos) / totalCentimos);',
    a: '    const p = Math.round((abs * tramos[i].centimos) / totalCentimos);',
    cae: 'SCRUM-1732d · ⑨ tres tramos de 33,33/33,33/33,34: las tres cuotas suman la de la factura al céntimo',
  },
  {
    // Las anulaciones dejan de restar: la fila anulada vuelve a devengar.
    fichero: 'src/modules/invoicing/domain/devengoPorCaja.ts',
    de: "  return filas.filter((f) => f.tipo !== 'anulacion' && !anuladas.has(f.id))",
    a: "  return filas.filter((f) => f.tipo !== 'anulacion')",
    cae: 'SCRUM-1732d · ⑤ una fila anulada y su anulación no cuentan: el tramo anulado se va al tope',
  },
  {
    // Sin tope de lo cobrado: dos cobros completos devengarían dos veces la factura.
    fichero: 'src/modules/invoicing/domain/devengoPorCaja.ts',
    de: '    const d = Math.min(c, totalCentimos - acumulado);',
    a: '    const d = c;',
    cae: 'SCRUM-1732d · ⑥ filas vivas que suman más que el total: se devenga el total y lo de más va a cobradoDeMas',
  },
];

const M = 17;
const ZONA = 'Europe/Madrid';
const cumple = (v, f) => !f || ((!f.gte || (v && v >= f.gte)) && (!f.lte || (v && v <= f.lte)));

/** La base: facturas + filas de `invoice_payments`. Responde a los `where` que usan el libro y el 303. */
export function base(facturas, filas = [], { criterioCaja = true } = {}) {
  return {
    merchant: { async findUnique() { return { id: M, criterioCaja, timezone: ZONA }; } },
    invoice: { async findMany({ where: w = {} }) {
      return facturas.filter((f) => f.merchantId === w.merchantId && cumple(f.createdAt, w.createdAt) && cumple(f.paidAt, w.paidAt)
        && (!w.id?.in || w.id.in.includes(f.id)));
    } },
    invoicePayment: { async findMany({ where: w = {} }) {
      return filas.filter((p) => p.merchantId === w.merchantId && cumple(p.fechaCobro, w.fechaCobro)
        && (!w.invoiceId?.in || w.invoiceId.in.includes(p.invoiceId)));
    } },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
    expense: { async findMany() { return []; } },
  };
}

/** Un instante en hora de Madrid (CET en invierno, CEST en verano), sin depender de la zona del proceso. */
const madrid = (iso, verano = false) => new Date(`${iso}${verano ? '+02:00' : '+01:00'}`);

const factura = (id, number, createdAt, paidAt, { total = '1210.00', lines = [{ qty: 1, price: 1000, tax: 0.21 }] } = {}) => ({
  id, merchantId: M, number, createdAt, paidAt, type: 'F1', total, currency: 'EUR', status: paidAt ? 'paid' : 'pending',
  customerId: 3, quoteId: null, chargeId: null, albaranRefs: null, lines,
});
let sig = 100;
const fila = (invoiceId, importe, fechaCobro, extra = {}) => ({
  id: sig++, merchantId: M, invoiceId, chargeId: null, importe: String(importe), fechaCobro, fechaOrigen: 'declarada',
  metodo: 'transferencia', tipo: 'cobro', anulaId: null, ...extra,
});

const libro = (db, año, t, extra = {}) => leerLibroRegistro(db, { merchantId: M, ...rangoTrimestre(año, t, ZONA), zona: ZONA, criterioCaja: true, soloFacturas: true, ...extra });
const c21 = async (db, año, t) => {
  const m = await leerModelo303(db, { merchantId: M, año, trimestre: t });
  const c = m.casillas.find((x) => x.tipo === 21);
  return { base: c.base, cuota: c.cuota };
};

// ① El caso del encargo.
const FA = factura(1, 'F-A', madrid('2026-02-10T12:00:00'), madrid('2026-03-20T12:00:00'));
const FILAS_A = [fila(1, '605.00', madrid('2026-03-20T12:00:00'), { metodo: 'bizum' }), fila(1, '605.00', madrid('2026-05-15T12:00:00', true))];

test('SCRUM-1732d · ① emitida en T1 y cobrada en dos tramos: el libro la lleva entera en T1 con sus dos cobros, y el 303 devenga cada tramo en su trimestre', async () => {
  const db = base([FA], FILAS_A);
  const t1 = await libro(db, 2026, 1);
  const a = t1.asientos.find((x) => x.numero === 'F-A');
  assert.ok(a, 'el libro de T1 tiene que llevar la factura (periodo de expedición)');
  assert.deepEqual([a.base, a.cuota, a.total], [1000, 210, 1210], 'el asiento es la operación ENTERA (RIVA 63.3)');
  assert.deepEqual(a.cobros.map((c) => [c.importe, c.metodo, c.origen]), [[605, 'bizum', 'declarada'], [605, 'transferencia', 'declarada']]);
  assert.equal(a.cobros[1].fecha, madrid('2026-05-15T12:00:00', true).toISOString());
  assert.equal((await libro(db, 2026, 2)).asientos.some((x) => x.numero === 'F-A'), false, 'el asiento NO se repite en el periodo del cobro');
  assert.deepEqual(await c21(db, 2026, 1), { base: 500, cuota: 105 });
  assert.deepEqual(await c21(db, 2026, 2), { base: 500, cuota: 105 });
});

test('SCRUM-1732d · ② factura paid sin filas: como hoy, un cobro del 100 % en su paidAt', async () => {
  const f = factura(2, 'F-B', madrid('2026-02-10T12:00:00'), madrid('2026-05-20T12:00:00', true));
  const db = base([f]);
  assert.deepEqual((await libro(db, 2026, 1)).asientos.find((x) => x.numero === 'F-B').cobros, []);
  assert.deepEqual(await c21(db, 2026, 1), { base: 0, cuota: 0 });
  assert.deepEqual(await c21(db, 2026, 2), { base: 1000, cuota: 210 });
});

test('SCRUM-1732d · ③ criterio general: sin cambio, por emisión y sin cobros', async () => {
  const db = base([FA], FILAS_A, { criterioCaja: false });
  const t1 = await libro(db, 2026, 1, { criterioCaja: false });
  assert.deepEqual(t1.asientos.find((x) => x.numero === 'F-A').cobros, []);
  assert.equal('cobradoDeMas' in t1, false, 'sin caja el libro no declara nada de cobros');
  assert.deepEqual(await c21(db, 2026, 1), { base: 1000, cuota: 210 });
  assert.deepEqual(await c21(db, 2026, 2), { base: 0, cuota: 0 });
});

test('SCRUM-1732d · ④ un tramo sin medio se lleva con metodo null y se cuenta aparte, y devenga igual', async () => {
  const db = base([FA], [FILAS_A[0], { ...FILAS_A[1], metodo: null }]);
  const t1 = await libro(db, 2026, 1);
  assert.equal(t1.asientos.find((x) => x.numero === 'F-A').cobros[1].metodo, null);
  assert.deepEqual(t1.cobrosSinMedio, ['F-A']);
  assert.deepEqual(await c21(db, 2026, 2), { base: 500, cuota: 105 });
});

test('SCRUM-1732d · ⑤ una fila anulada y su anulación no cuentan: el tramo anulado se va al tope', async () => {
  const anulada = FILAS_A[1];
  const db = base([FA], [...FILAS_A, fila(1, '605.00', madrid('2026-06-01T12:00:00', true), { tipo: 'anulacion', anulaId: anulada.id, chargeId: null })]);
  assert.equal((await libro(db, 2026, 1)).asientos.find((x) => x.numero === 'F-A').cobros.length, 1);
  assert.deepEqual(await c21(db, 2026, 2), { base: 0, cuota: 0 });
  assert.deepEqual(await c21(db, 2027, 4), { base: 500, cuota: 105 }, 'lo no cobrado devenga el 31-dic del año siguiente');
});

test('SCRUM-1732d · ⑥ filas vivas que suman más que el total: se devenga el total y lo de más va a cobradoDeMas', async () => {
  // El segundo cobro, en OTRO trimestre: si devengara, el T2 tendría la factura (con el resto del
  // último tramo a 0 en el T1, la mutación «sin tope» salía MUDA con los dos cobros en el T1).
  const db = base([FA], [fila(1, '1210.00', madrid('2026-03-01T12:00:00')), fila(1, '1210.00', madrid('2026-05-02T12:00:00', true))]);
  assert.deepEqual(await c21(db, 2026, 1), { base: 1000, cuota: 210 });
  assert.equal((await libro(db, 2026, 2, { devengo: true })).asientos.length, 0, 'lo cobrado de más no devenga en el trimestre en que entra');
  assert.deepEqual((await libro(db, 2026, 1)).cobradoDeMas, [{ numero: 'F-A', importe: 1210 }]);
});

test('SCRUM-1732d · ⑦ garantía retenida sin liberar: lo retenido devenga en el tope (Q6, defecto conocido de la pregunta 49)', async () => {
  assert.equal(DEFECTO_CONOCIDO.garantiaRetenidaAlTope.declarado, true, 'retirar la declaración es parte del cambio que la responda');
  const db = base([FA], [fila(1, '1149.50', madrid('2026-03-20T12:00:00')), fila(1, '60.50', madrid('2028-02-01T12:00:00'), { tipo: 'liberacion_garantia' })]);
  assert.deepEqual(await c21(db, 2026, 1), { base: 950, cuota: 199.5 });
  assert.deepEqual(await c21(db, 2027, 4), { base: 50, cuota: 10.5 });
  assert.deepEqual(await c21(db, 2028, 1), { base: 0, cuota: 0 }, 'la liberación después del tope no vuelve a devengar');
});

test('SCRUM-1732d · ⑧ el trimestre del tramo es el de la zona del comercio, no el de UTC', async () => {
  // 1-abr-2026 a las 00:30 en Madrid = 31-mar a las 22:30Z: es T2 en Madrid y T1 en UTC.
  const db = base([FA], [fila(1, '605.00', madrid('2026-03-20T12:00:00')), fila(1, '605.00', new Date('2026-03-31T22:30:00Z'))]);
  assert.deepEqual(await c21(db, 2026, 1), { base: 500, cuota: 105 });
  assert.deepEqual(await c21(db, 2026, 2), { base: 500, cuota: 105 });
});

test('SCRUM-1732d · ⑨ tres tramos de 33,33/33,33/33,34: las tres cuotas suman la de la factura al céntimo', async () => {
  const f = factura(9, 'F-R', madrid('2026-01-10T12:00:00'), madrid('2026-02-10T12:00:00'), { total: '100.00', lines: [{ qty: 1, price: 82.64, tax: 0.21 }] });
  const db = base([f], [fila(9, '33.33', madrid('2026-02-10T12:00:00')), fila(9, '33.33', madrid('2026-05-10T12:00:00', true)), fila(9, '33.34', madrid('2026-08-10T12:00:00', true))]);
  const q = [await c21(db, 2026, 1), await c21(db, 2026, 2), await c21(db, 2026, 3)];
  const cent = (k) => q.reduce((s, x) => s + Math.round(x[k] * 100), 0);
  // La factura: base 82,64 y cuota 17,35 (calcVatBreakdown). Medida con la caja apagada, no escrita a mano.
  const entera = await c21(base([f], [], { criterioCaja: false }), 2026, 1);
  assert.deepEqual([cent('base'), cent('cuota')], [Math.round(entera.base * 100), Math.round(entera.cuota * 100)]);
  assert.ok(q.every((x) => x.base > 0), `los tres trimestres devengan: ${JSON.stringify(q)}`);
});

test('SCRUM-1732d · control: con caja y sin poder leer invoice_payments, el libro LANZA (no lee «sin cobros»)', async () => {
  const db = base([FA], FILAS_A);
  delete db.invoicePayment;
  await assert.rejects(libro(db, 2026, 1), /invoice_payments/);
});
