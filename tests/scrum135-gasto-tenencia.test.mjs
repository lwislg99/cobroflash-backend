// SCRUM-135 (hallazgo 2) — tenencia de las referencias del gasto (regla 2).
//
// EL AGUJERO: `Expense.quoteId` / `Expense.providerId` se escribían a pelo. La FK garantiza
// que la fila EXISTE, no que sea de este merchant → el merchant A podía crear un gasto
// apuntando a la cotización del merchant B. La fuga era pequeña MIENTRAS `listExpenses` solo
// devolviera `quote.id` (el número que ya habías tecleado); este mismo ticket ensancha ese
// camino para pintar el trabajo, y ahí pasaría a ser lectura cross-tenant.
//
// ⚠️ Toca BD real (staging), gateado:
//   QA_DB_TEST=1 DATABASE_URL_STAGING="..." npm run test:staging
//
// GUARDA DE PRESENCIA (SCRUM-108/103): cada test de RECHAZO va precedido de su caso POSITIVO
// —  la referencia PROPIA sí se acepta —  porque un test que solo comprueba que algo falla
// pasa igual si `createExpense` está roto del todo y lanza siempre.
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

// Crea una cotización mínima para `merchant`. Solo necesita ser una fila válida: lo que se
// prueba es de QUIÉN es, no su contenido. `quoteNumber` se omite (es nullable) para no
// competir con la numeración por merchant.
async function crearQuote(prisma, merchantId, customerId) {
  return prisma.quote.create({
    data: {
      merchantId,
      customerId,
      total: 100,
      currency: 'EUR',
      lines: [],
      status: 'accepted',
    },
  });
}

async function crearCustomer(prisma, merchantId) {
  return prisma.customer.create({
    data: { merchantId, name: 'Cliente QA SCRUM-135', phone: `+3460000${Math.floor(Math.random() * 10000)}` },
  });
}

test('SCRUM-135: un gasto SÍ acepta una cotización propia (guarda de presencia)', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { createExpense } = await import('../dist/modules/expenses/domain/expenses.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-135 propio', email: `qa-135a-${Date.now()}@test.local` }, async (merchant) => {
    const customer = await crearCustomer(prisma, merchant.id);
    const quote = await crearQuote(prisma, merchant.id, customer.id);

    const expense = await createExpense(merchant.id, {
      concept: 'Material del trabajo propio — SCRUM-135',
      amount: 42.5,
      quoteId: quote.id,
    });

    assert.equal(expense.quoteId, quote.id, 'la vinculación LEGÍTIMA debe seguir funcionando; si esto falla, el rechazo de abajo no prueba nada');
  });
});

test('SCRUM-135: un gasto NO puede apuntar a la cotización de OTRO merchant', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { createExpense, ExpenseRefError } = await import('../dist/modules/expenses/domain/expenses.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-135 victima', email: `qa-135v-${Date.now()}@test.local` }, async (victima) => {
    const customerV = await crearCustomer(prisma, victima.id);
    const quoteAjena = await crearQuote(prisma, victima.id, customerV.id);

    await withMerchant(prisma, { name: 'QA SCRUM-135 atacante', email: `qa-135x-${Date.now()}@test.local` }, async (atacante) => {
      await assert.rejects(
        () => createExpense(atacante.id, {
          concept: 'Gasto apuntando a cotización ajena — SCRUM-135',
          amount: 10,
          quoteId: quoteAjena.id,
        }),
        (err) => {
          assert.ok(err instanceof ExpenseRefError, `se esperaba ExpenseRefError, llegó ${err?.name}: ${err?.message}`);
          assert.equal(err.code, 'quote_not_found', 'mismo código que "no existe": el endpoint no debe servir de oráculo para enumerar ids ajenos');
          return true;
        },
      );

      // Y que no haya quedado escrito nada a medias.
      const escritos = await prisma.expense.count({ where: { merchantId: atacante.id, quoteId: quoteAjena.id } });
      assert.equal(escritos, 0, 'el gasto NO debe haberse creado');
    });
  });
});

test('SCRUM-135: tampoco por la puerta de atrás del PUT', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { createExpense, updateExpense, ExpenseRefError } = await import('../dist/modules/expenses/domain/expenses.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-135 victima2', email: `qa-135v2-${Date.now()}@test.local` }, async (victima) => {
    const customerV = await crearCustomer(prisma, victima.id);
    const quoteAjena = await crearQuote(prisma, victima.id, customerV.id);

    await withMerchant(prisma, { name: 'QA SCRUM-135 atacante2', email: `qa-135x2-${Date.now()}@test.local` }, async (atacante) => {
      // El PUT comprobaba la tenencia del GASTO, pero no la de la referencia NUEVA: se crea
      // un gasto limpio y se intenta re-vincular a la cotización ajena.
      const propio = await createExpense(atacante.id, {
        concept: 'Gasto limpio — SCRUM-135',
        amount: 5,
      });

      await assert.rejects(
        () => updateExpense(atacante.id, propio.id, { quoteId: quoteAjena.id }),
        (err) => {
          assert.ok(err instanceof ExpenseRefError, `se esperaba ExpenseRefError, llegó ${err?.name}: ${err?.message}`);
          assert.equal(err.code, 'quote_not_found');
          return true;
        },
      );

      const trasIntento = await prisma.expense.findUnique({ where: { id: propio.id } });
      assert.equal(trasIntento.quoteId, null, 'la vinculación no debe haberse escrito');
    });
  });
});

test('SCRUM-135: mismo criterio para el proveedor', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { createExpense, ExpenseRefError } = await import('../dist/modules/expenses/domain/expenses.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-135 prov', email: `qa-135p-${Date.now()}@test.local` }, async (victima) => {
    const provAjeno = await prisma.provider.create({
      data: { merchantId: victima.id, name: 'Almacén ajeno QA SCRUM-135' },
    });

    await withMerchant(prisma, { name: 'QA SCRUM-135 prov2', email: `qa-135p2-${Date.now()}@test.local` }, async (atacante) => {
      // Presencia: el proveedor PROPIO sí se acepta.
      const propio = await prisma.provider.create({
        data: { merchantId: atacante.id, name: 'Almacén propio QA SCRUM-135' },
      });
      const ok = await createExpense(atacante.id, {
        concept: 'Compra en almacén propio — SCRUM-135',
        amount: 20,
        providerId: propio.id,
      });
      assert.equal(ok.providerId, propio.id);

      // Y el ajeno no.
      await assert.rejects(
        () => createExpense(atacante.id, {
          concept: 'Compra en almacén ajeno — SCRUM-135',
          amount: 20,
          providerId: provAjeno.id,
        }),
        (err) => {
          assert.ok(err instanceof ExpenseRefError);
          assert.equal(err.code, 'provider_not_found');
          return true;
        },
      );
    });
  });
});
