// SCRUM-109 — Expense.teamMemberId: sin campo de autoría, el técnico no puede registrar
// gastos con su nombre (bloqueante de la V2 de SCRUM-107). Este test cubre SOLO la parte
// de carril A: el campo existe, es aditivo/nullable, y createExpense lo rellena con el
// autor cuando se indica y con null (propietario) cuando no. El filtrado row-level
// (GET técnico ve solo los suyos) es SCRUM-107 V2, carril B — fuera de este ticket.
//
// ⚠️ Toca BD real (staging), gateado:
//   QA_DB_TEST=1 DATABASE_URL_TESTS="..." npm run test:staging
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant, registrarBarridoFinal } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-109: createExpense guarda teamMemberId cuando se indica', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  registrarBarridoFinal(prisma);
  const { createExpense } = await import('../dist/modules/expenses/domain/expenses.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-109', email: `qa-scrum109-${Date.now()}@test.local` }, async (merchant) => {
    const tecnico = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Técnico QA', email: `qa-tecnico-109-${Date.now()}@test.local`, role: 'tecnico' },
    });

    const expense = await createExpense(merchant.id, {
      concept: 'Codo de cobre 15mm — SCRUM-109',
      amount: 12.5,
      teamMemberId: tecnico.id,
    });

    assert.equal(expense.teamMemberId, tecnico.id);

    const fromDb = await prisma.expense.findUnique({ where: { id: expense.id } });
    assert.equal(fromDb.teamMemberId, tecnico.id, 'debe persistir en BD, no solo en el objeto devuelto');
  });
});

test('SCRUM-109: createExpense sin teamMemberId → null (propietario), no rompe el flujo existente', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  registrarBarridoFinal(prisma);
  const { createExpense } = await import('../dist/modules/expenses/domain/expenses.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-109b', email: `qa-scrum109b-${Date.now()}@test.local` }, async (merchant) => {
    const expense = await createExpense(merchant.id, {
      concept: 'Gasto sin autor — SCRUM-109',
      amount: 30,
    });

    assert.equal(expense.teamMemberId, null, 'sin teamMemberId debe quedar null, como los gastos existentes antes de este cambio');
  });
});
