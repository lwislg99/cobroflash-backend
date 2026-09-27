// tests/scrum1093f-albarannumber-zona-merchant.test.mjs — SCRUM-1093 (el resto: albaranes)
//
// EL AÑO DEL ALBARÁN SALÍA DEL RELOJ DEL PROCESO, NO DE LA ZONA DEL MERCHANT.
//
// Mismo defecto que SCRUM-735 arregló en `invoiceNumber.service.ts` y SCRUM-1093 en
// `quoteNumber.service.ts`: `allocateAlbaranNumber` hacía `now.getFullYear()`, que lee el reloj
// del PROCESO — Railway va en UTC. Un merchant en `Europe/Madrid` que numera un albarán a las
// 23:30 UTC del 31 de diciembre ya está en 1 de enero SU hora: el proceso todavía dice diciembre
// y le pondría el año viejo (y el correlativo de la serie vieja) a un albarán del año nuevo.
//
// La ventana es ANUAL: solo puede fallar la noche del 31 de diciembre, y solo en zonas por
// delante de UTC.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateAlbaranNumber } from '../dist/modules/jobs/domain/albaranNumber.service.js';

// 23:30 UTC del 31-dic-2026 = 00:30 del 1-ene-2027 en Europe/Madrid (UTC+1 en invierno).
const INSTANTE_FRONTERA = new Date(Date.UTC(2026, 11, 31, 23, 30));

function txFalsa(id, timezone) {
  let estado = { nextAlbaranNumber: 5, albaranSeriesYear: 2026 };
  const tx = {
    $executeRaw: async () => 1,
    merchant: {
      findUnique: async () => ({ id, timezone, ...estado }),
      update: async ({ data }) => {
        estado = { nextAlbaranNumber: data.nextAlbaranNumber, albaranSeriesYear: data.albaranSeriesYear };
        return { id };
      },
    },
  };
  return { tx, estado: () => estado };
}

test('🔴 allocateAlbaranNumber: un merchant en Europe/Madrid ya está en el año NUEVO cuando el proceso (UTC) sigue en el viejo', async () => {
  const { tx, estado } = txFalsa(42, 'Europe/Madrid');

  const numero = await allocateAlbaranNumber(tx, 42, INSTANTE_FRONTERA);

  // Con el reloj del PROCESO (UTC) esto daba 'AB260005' y dejaba la serie en 2026. Volver a
  // `now.getFullYear()` en `allocateAlbaranNumber` hace caer este assert.
  assert.equal(numero, 'AB270001',
    '🔴 el merchant en Europe/Madrid ya vive en 2027 a esta hora; se numeró con el año del proceso');
  assert.deepEqual(estado(), { nextAlbaranNumber: 2, albaranSeriesYear: 2027 });
});

test('allocateAlbaranNumber: SIN zona declarada, el mismo instante sigue siendo 2026 — no hay cambio para quien no lo pidió', async () => {
  const { tx, estado } = txFalsa(43, null);

  assert.equal(await allocateAlbaranNumber(tx, 43, INSTANTE_FRONTERA), 'AB260005');
  assert.deepEqual(estado(), { nextAlbaranNumber: 6, albaranSeriesYear: 2026 });
});

test('allocateAlbaranNumber: Canarias (UTC+0 en invierno) NO adelanta el año en la misma frontera — control negativo por zona', async () => {
  const { tx } = txFalsa(44, 'Atlantic/Canary');

  assert.equal(await allocateAlbaranNumber(tx, 44, INSTANTE_FRONTERA), 'AB260005');
});
