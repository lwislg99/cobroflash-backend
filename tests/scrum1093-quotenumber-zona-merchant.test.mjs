// tests/scrum1093-quotenumber-zona-merchant.test.mjs — SCRUM-1093
//
// EL AÑO DEL PRESUPUESTO SALÍA DEL RELOJ DEL PROCESO, NO DE LA ZONA DEL MERCHANT.
//
// Mismo defecto que SCRUM-735 arregló en `invoiceNumber.service.ts`, en los otros dos sitios de
// `quoteNumber.service.ts`: `now.getFullYear()` (allocate) y `d.getFullYear()` (display) leen el
// reloj del PROCESO — Railway va en UTC. Un merchant en `Europe/Madrid` que numera un presupuesto
// a las 23:30 UTC del 31 de diciembre ya está en 1 de enero SU hora: el proceso todavía dice
// diciembre y le pondría el año viejo a un documento del año nuevo, y ese número no se corrige
// después (regla de correlatividad, SCRUM-592).
//
// La ventana es ANUAL, no diaria (mismo aviso que SCRUM-1093 hace sobre sí mismo): solo puede
// fallar la noche del 31 de diciembre, y solo en zonas por delante de UTC.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateQuoteNumber, displayQuoteNumber } from '../dist/modules/quotes/domain/quoteNumber.service.js';

// 23:30 UTC del 31-dic-2026 = 00:30 del 1-ene-2027 en Europe/Madrid (UTC+1 en invierno).
const INSTANTE_FRONTERA = new Date(Date.UTC(2026, 11, 31, 23, 30));

test('🔴 allocateQuoteNumber: un merchant en Europe/Madrid ya está en el año NUEVO cuando el proceso (UTC) sigue en el viejo', async () => {
  let estado = { nextQuoteNumber: 5, quoteSeriesYear: 2026 };
  const fakeTx = {
    $executeRaw: async () => 1,
    merchant: {
      findUnique: async () => ({ id: 42, timezone: 'Europe/Madrid', ...estado }),
      update: async ({ data }) => {
        estado = { nextQuoteNumber: data.nextQuoteNumber, quoteSeriesYear: data.quoteSeriesYear };
        return { id: 42 };
      },
    },
  };

  const r = await allocateQuoteNumber(fakeTx, 42, INSTANTE_FRONTERA);

  // Con el reloj del PROCESO (UTC) esto habría dado year:2026, seq:6 — el fallo que
  // `getFullYear()` sobre `now` (sin zona) produciría. Quitar `zonaDelMerchant`/`diaNaturalEn`
  // de `allocateQuoteNumber` y volver a `now.getFullYear()` hace caer este assert.
  assert.deepEqual(r, { numero: 'P270001', seq: 1, year: 2027 },
    `🔴 el merchant en Europe/Madrid ya vive en 2027 a esta hora; salió ${JSON.stringify(r)}`);
});

test('allocateQuoteNumber: SIN zona declarada (o UTC explícito), el mismo instante sigue siendo 2026 — no hay cambio para quien no lo pidió', async () => {
  let estado = { nextQuoteNumber: 5, quoteSeriesYear: 2026 };
  const fakeTx = {
    $executeRaw: async () => 1,
    merchant: {
      findUnique: async () => ({ id: 43, timezone: null, ...estado }),
      update: async ({ data }) => {
        estado = { nextQuoteNumber: data.nextQuoteNumber, quoteSeriesYear: data.quoteSeriesYear };
        return { id: 43 };
      },
    },
  };

  const r = await allocateQuoteNumber(fakeTx, 43, INSTANTE_FRONTERA);
  assert.deepEqual(r, { numero: 'P260005', seq: 5, year: 2026 });
});

test('🔴 displayQuoteNumber: el mismo instante frontera se PINTA con el año del merchant, no el del proceso', () => {
  const q = { quoteNumber: 1, createdAt: INSTANTE_FRONTERA };

  // Sin merchant (o merchant sin zona): cae a UTC, año 2026 — comportamiento previo intacto.
  assert.equal(displayQuoteNumber(q), 'P260001');
  assert.equal(displayQuoteNumber(q, null), 'P260001');
  assert.equal(displayQuoteNumber(q, { timezone: null }), 'P260001');

  // Con el merchant de Europe/Madrid: el mismo instante ya es 2027 en SU calendario.
  // `d.getFullYear()` (sin zona) daría 'P260001' aquí — es exactamente lo que este test cierra.
  assert.equal(displayQuoteNumber(q, { timezone: 'Europe/Madrid' }), 'P270001',
    '🔴 se pintó con el año del reloj del PROCESO (UTC) en vez del año del merchant');
});

test('displayQuoteNumber: Canarias (UTC+0 en invierno) NO adelanta el año en la misma frontera — control negativo por zona', () => {
  // Mismo instante, zona DISTINTA: en invierno Atlantic/Canary sigue en UTC+0, así que a esta
  // hora (23:30 del 31-dic) todavía es 2026 ahí — a diferencia de Madrid, que ya es 2027.
  const q = { quoteNumber: 1, createdAt: INSTANTE_FRONTERA };
  assert.equal(displayQuoteNumber(q, { timezone: 'Atlantic/Canary' }), 'P260001');
});
