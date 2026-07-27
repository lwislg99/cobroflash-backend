// tests/billingPlan.test.mjs — SCRUM-32: reparto EXACTO de tramos (el último absorbe el resto).
// Invariante: céntimos enteros + suma de tramos == total, EXACTA (par e impar). Puro, no toca BD.
//
// ── SCRUM-141 (27-jul-2026) · QUÉ SIGUE PROTEGIENDO ESTE FICHERO, Y QUÉ YA NO ──────────────
// Estos tests siguen siendo VÁLIDOS y no se han tocado: `distributeStageAmounts` conserva su
// invariante (los tramos suman el total, exacto). Lo que cambió es QUIÉN LA CONSUME.
//
// Hasta SCRUM-141, `Invoice.total` se copiaba de aquí y las líneas de la factura se escalaban
// APARTE. Dos redondeos independientes sobre el mismo dinero → hasta 1 céntimo de diferencia
// entre el total y lo que suman sus propias líneas. Y esos dos números van a DOS CAMPOS DE LA
// MISMA HUELLA VeriFactu (`importeTotal` ← total, `cuotaTotal` ← líneas), que se sella, se
// encadena (`vfPrevHash`) y es inmutable (regla 29): el descuadre solo se corregía con una R1.
//
// DECISIÓN DEL FUNDADOR (opción A): una factura es un documento AUTÓNOMO — Hacienda no mira el
// presupuesto del que salió, mira si sus líneas suman su total. Así que `Invoice.total` se
// DERIVA de las líneas (`grossOfLines`). Este reparto sigue usándose como OBJETIVO a alcanzar
// (`reconcileToTarget`), y se alcanza en el ~99 % de los tramos; cuando el importe es
// matemáticamente inalcanzable (base y cuota redondean saltándolo), manda la coherencia interna
// de la factura y la suma de las facturas queda a 1-2 céntimos del total del presupuesto.
//
// ⚠️ NO "restaures" el acoplamiento antiguo (copiar este importe a `Invoice.total`) para hacer
// que la suma cuadre siempre: eso reintroduce el descuadre SELLADO, que es el daño irreversible.
// El coste aceptado está medido y con tope en tests/scrum141-factura-final.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';

const { distributeStageAmounts, getStageAmount, getBillingPlan } = await import('../dist/modules/quotes/domain/billingPlan.js');

const toCents = (a) => a.map((x) => Math.round(x * 100));
const sumCents = (a) => toCents(a).reduce((s, x) => s + x, 0);

test('SCRUM-32: FIFTY_FIFTY impar 100,01 → [50,01 , 50,00] y suma EXACTA', () => {
  const a = distributeStageAmounts('100.01', getBillingPlan('FIFTY_FIFTY'));
  assert.deepEqual(toCents(a), [5001, 5000]);
  assert.equal(sumCents(a), 10001);
});

test('SCRUM-32: FIFTY_FIFTY impar 151,25 → [75,63 , 75,62] y suma EXACTA (el bug real)', () => {
  const a = distributeStageAmounts('151.25', getBillingPlan('FIFTY_FIFTY'));
  assert.deepEqual(toCents(a), [7563, 7562]);
  assert.equal(sumCents(a), 15125); // NO 15126
});

test('SCRUM-32: FIFTY_FIFTY par 100,00 → [50,00 , 50,00]', () => {
  assert.deepEqual(toCents(distributeStageAmounts('100.00', getBillingPlan('FIFTY_FIFTY'))), [5000, 5000]);
});

test('SCRUM-32: FULL_UPFRONT → un tramo == total (impar incluido)', () => {
  const a = distributeStageAmounts('100.01', getBillingPlan('FULL_UPFRONT'));
  assert.deepEqual(toCents(a), [10001]);
  assert.equal(sumCents(a), 10001);
});

test('SCRUM-32: MANUAL/[] → sin tramos', () => {
  assert.deepEqual(distributeStageAmounts('100.01', getBillingPlan('MANUAL')), []);
  assert.deepEqual(distributeStageAmounts('100.01', getBillingPlan('SIN_CONDICIONES')), []);
});

test('SCRUM-32: getStageAmount indexa el reparto — el 2º tramo es el RESTO', () => {
  assert.equal(getStageAmount('151.25', 'FIFTY_FIFTY', 0), 75.63);
  assert.equal(getStageAmount('151.25', 'FIFTY_FIFTY', 1), 75.62); // el resto, no 75,63
  assert.equal(getStageAmount('100.01', 'FIFTY_FIFTY', 0), 50.01);
  assert.equal(getStageAmount('100.01', 'FIFTY_FIFTY', 1), 50.00);
});

test('SCRUM-32: invariante general — suma == total en muchos impares', () => {
  for (const euros of [10.01, 33.33, 99.99, 151.25, 200.01, 1234.57]) {
    const a = distributeStageAmounts(String(euros), getBillingPlan('FIFTY_FIFTY'));
    assert.equal(sumCents(a), Math.round(euros * 100), `suma exacta para ${euros}`);
  }
});
