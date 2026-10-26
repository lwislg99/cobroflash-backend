// tests/scrum1065d-inicio-de-actividad.test.mjs — SCRUM-1065d
//
// El caso límite «autónomo en inicio de actividad» del borrador del 130 (`modelo130.ts`, SCRUM-1065b).
// Leído en el consolidado del RIRPF (BOE-A-2007-6820, art. 110 en su versión vigente desde el
// 23-dic-2018, y art. 109): en ESTIMACIÓN DIRECTA no hay regla propia de inicio. El 110.1.a acumula
// «desde el primer día del año hasta el último día del trimestre», y «inicio de actividades» sólo
// aparece en el 110.1.b y el 110.3.a.2.º (estimación OBJETIVA, fuera de la población) y en el 109.5
// (la exención del 70 % retenido, que es de profesionales, agrícolas y forestales; un oficio es
// empresarial, Q-C8).
//
// Así que un merchant que empieza en julio NO necesita otro periodo: acumular desde el 1 de enero
// suma lo mismo que acumular desde el alta, porque antes no hay nada. Lo que SÍ se fija aquí es lo
// contrario de lo tentador: que la 05 NO salga a cero porque los libros estén vacíos antes del alta.
// El 110.1.a resta los pagos que «habría correspondido ingresar», y que fueran cero depende de la
// fecha de inicio de actividad que el merchant declaró a Hacienda, que YaQu no guarda (no hay campo
// en `schema.prisma`). Unos libros vacíos dicen «no se facturó por YaQu», no «no había actividad».
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirBorrador130 } = await import('../dist/modules/fiscal/modelo130/modelo130.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: 'const c05 = trimestre === 1 ?', a: 'const c05 = true ?',
    cae: 'SCRUM-1065d · 🔴 los trimestres anteriores al alta no se deducen de unos libros vacíos' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: '    desde: new Date(año, 0, 1, 0, 0, 0, 0),', a: '    desde: new Date(año, 6, 1, 0, 0, 0, 0),',
    cae: 'SCRUM-1065d · alta en julio: el acumulado sigue empezando el 1 de enero' },
  { fichero: 'src/modules/fiscal/modelo130/modelo130.ts', de: 'const PORCENTAJE_PAGO_FRACCIONADO = 20;', a: 'const PORCENTAJE_PAGO_FRACCIONADO = 21;',
    cae: 'SCRUM-1065d · alta en julio: el acumulado sigue empezando el 1 de enero' },
];

const M = 7;

const factura = (number, createdAt, base) => ({
  merchantId: M, number, createdAt, type: 'F1', total: String((base * 1.21).toFixed(2)), currency: 'EUR',
  status: 'pending', customerId: 3, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Mano de obra', qty: 1, price: base, tax: 0.21 }],
});

const gasto = (date, base) => ({
  merchantId: M, date, concept: 'Material', amount: String((base * 1.21).toFixed(2)), currency: 'EUR',
  providerId: 3, baseAmount: String(base.toFixed(2)), vatRate: 21, vatAmount: String((base * 0.21).toFixed(2)),
  vatDeducible: true, providerInvoiceNumber: 'P-1', providerInvoiceDate: date, category: 'materiales',
});

// El año entero de un merchant que empieza el 10 de julio de 2026: antes, NADA en los libros.
const FACTURAS = [
  factura('2026-001', new Date(2026, 6, 10, 12), 1000),
  factura('2026-002', new Date(2026, 7, 20, 12), 500),
  factura('2026-003', new Date(2026, 10, 5, 12), 2000),
];
const GASTOS = [gasto(new Date(2026, 6, 15, 12), 200)];

/** Los libros acotados como los acota `leerBorrador130`: del 1 de enero al fin del trimestre. */
const b130 = (trimestre) => {
  const hasta = new Date(2026, trimestre * 3, 0, 23, 59, 59, 999);
  return construirBorrador130({
    libro: construirLibroRegistro({ facturas: FACTURAS.filter((f) => f.createdAt <= hasta), merchantId: M }),
    libroRecibidas: construirLibroRecibidas({ gastos: GASTOS.filter((g) => g.date <= hasta), merchantId: M }),
    año: 2026, trimestre,
  });
};

test('SCRUM-1065d · alta en julio: el acumulado sigue empezando el 1 de enero', () => {
  // Cifras a mano. T3: 1.000 + 500 = 1.500; hipótesis 1.500 − 200 = 1.300, y su 20 % = 260.
  // T4: 1.500 + 2.000 = 3.500; hipótesis 3.300, y su 20 % = 660.
  const t3 = b130(3);
  assert.equal(t3.desde, new Date(2026, 0, 1, 0, 0, 0, 0).toISOString());
  assert.equal(t3.seccionI.ingresos.valor, 1500);
  assert.deepEqual(t3.hipotesisTodosLosGastosAnotados, { gastosAnotados: 200, rendimientoNeto: 1300, veintePorCiento: 260 });
  const t4 = b130(4);
  assert.equal(t4.desde, new Date(2026, 0, 1, 0, 0, 0, 0).toISOString());
  assert.equal(t4.seccionI.ingresos.valor, 3500);
  assert.deepEqual(t4.hipotesisTodosLosGastosAnotados, { gastosAnotados: 200, rendimientoNeto: 3300, veintePorCiento: 660 });
});

test('SCRUM-1065d · 🔴 los trimestres anteriores al alta no se deducen de unos libros vacíos', () => {
  for (const t of [2, 3, 4]) {
    const r = b130(t);
    assert.equal(r.seccionI.trimestresAnteriores.valor, null, `T${t}: la 05 no puede salir a cero por unos libros vacíos`);
    assert.equal(r.seccionI.trimestresAnteriores.vacioPorque, 'pagos_anteriores_sin_dato');
    assert.equal(r.seccionI.pagoFraccionadoPrevio.valor, null);
  }
  // El T2, antes del alta: la 01 es un cero DE VERDAD (no hay facturas en el libro), y aun así la 05
  // no sale a cero: el cero de la 01 habla de YaQu, no de la actividad.
  const t2 = b130(2);
  assert.deepEqual(t2.miradas, { facturas: 0, gastos: 0 });
  assert.equal(t2.seccionI.ingresos.valor, 0);
});

test('SCRUM-1065d · 🔴 CONTROL POSITIVO: en el T1 la 05 sí es cero, por definición', () => {
  // Lo que la mutación de la 05 imita tiene que ser posible: si el borrador nunca diera 0 en la 05,
  // el caso de arriba sería verde sin mirar nada.
  const r = b130(1);
  assert.equal(r.seccionI.trimestresAnteriores.valor, 0);
});
