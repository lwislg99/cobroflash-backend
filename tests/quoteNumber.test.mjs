// A1.2 — numeración de presupuestos por merchant (quoteNumber.service)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allocateQuoteNumber,
  displayQuoteNumber,
} from '../dist/modules/quotes/domain/quoteNumber.service.js';

test('displayQuoteNumber: usa quoteNumber cuando existe', () => {
  assert.equal(displayQuoteNumber({ id: 47, quoteNumber: 1 }), '#1');
  assert.equal(displayQuoteNumber({ id: 120, quoteNumber: 35 }), '#35');
});

test('displayQuoteNumber: fallback al id global pre-backfill (quoteNumber null/undefined)', () => {
  assert.equal(displayQuoteNumber({ id: 47, quoteNumber: null }), '#47');
  assert.equal(displayQuoteNumber({ id: 47 }), '#47');
});

test('allocateQuoteNumber: devuelve el contador actual y lo avanza (increment atómico)', async () => {
  let stored = 1; // nextQuoteNumber inicial de un merchant nuevo
  const fakeTx = {
    merchant: {
      update: async ({ where, data, select }) => {
        assert.equal(where.id, 7);
        assert.deepEqual(data, { nextQuoteNumber: { increment: 1 } });
        assert.deepEqual(select, { nextQuoteNumber: true });
        stored += 1;
        return { nextQuoteNumber: stored }; // Prisma devuelve el valor POST-incremento
      },
    },
  };

  const first = await allocateQuoteNumber(fakeTx, 7);
  assert.equal(first, 1);
  const second = await allocateQuoteNumber(fakeTx, 7);
  assert.equal(second, 2);
  assert.equal(stored, 3); // el contador quedó apuntando al siguiente
});
