// SCRUM-52 (carril A): Job.operarioId + índice + poblado + audit. `ensureJobForQuote`
// congela la autoría del operario (= creador del presupuesto, quote.teamMemberId) al
// crear el Job en el accept, y deja traza 'operario_asignado' en audit_log. Verifica:
//   (1) poblado con teamMember → Job.operarioId = quote.teamMemberId
//   (2) poblado owner (null)   → Job.operarioId = null (propietario)
//   (3) audit 'operario_asignado' una sola vez (idempotencia: 2ª llamada no re-crea/audita)
//   (4) índice (merchant_id, operario_id) presente en la tabla jobs (db push aplicado)
//
// ⚠️ GATEADO (toca la BD del .env con el merchant demo id=1 y LIMPIA lo suyo):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { interceptarAuditLog } from './_audit-log-sync.mjs'; // SCRUM-255: esperar la escritura, no el reloj

const ENABLED = process.env.QA_DB_TEST === '1';
const MERCHANT_ID = 1;              // demo (regla 8)
const MARK = '(SCRUM-52 QA) operarioId';

// recordAudit es fire-and-forget → poll corto por la traza (sin await del log en el código).
// SCRUM-255: aqui habia un sondeo de 3 s. Ahora se espera a la PROMESA de la escritura
// (`interceptarAuditLog`) y la consulta se hace UNA vez.
//
// EL HELPER DE AUDITORIA ES OTRO QUE EL DE WA-0b, y el porque esta escrito en
// `tests/_audit-log-sync.mjs`: `recordAudit` devuelve `void` -- crea la promesa y la tira DENTRO
// de la funcion --, asi que la premisa de SCRUM-250 ("hay una promesa y nadie la recoge") es
// falsa aqui y hay que envolver el delegate de Prisma, no la exportacion.
async function buscarAudit(prisma, jobId) {
  return prisma.auditLog
    .findFirst({ where: { action: 'operario_asignado', entityType: 'job', entityId: jobId }, orderBy: { id: 'desc' } })
    .catch(() => null);
}

test('SCRUM-52: operarioId = quote.teamMemberId (+ null owner) + audit único + índice', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { ensureJobForQuote } = await import('../dist/modules/jobs/domain/job.service.js');

  const stamp = Date.now();
  const cleanup = async () => {
    // hijos → padres. Los Jobs y sus audit_log se localizan vía los Quotes marcados.
    const quotes = await prisma.quote
      .findMany({ where: { merchantId: MERCHANT_ID, internalNotes: MARK }, select: { id: true } })
      .catch(() => []);
    const qIds = quotes.map((q) => q.id);
    if (qIds.length) {
      const jobs = await prisma.job.findMany({ where: { quoteId: { in: qIds } }, select: { id: true } }).catch(() => []);
      const jIds = jobs.map((j) => j.id);
      if (jIds.length) {
        await prisma.auditLog
          .deleteMany({ where: { merchantId: MERCHANT_ID, action: 'operario_asignado', entityType: 'job', entityId: { in: jIds } } })
          .catch(() => {});
      }
      await prisma.job.deleteMany({ where: { quoteId: { in: qIds } } }).catch(() => {});
    }
    await prisma.quote.deleteMany({ where: { merchantId: MERCHANT_ID, internalNotes: MARK } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { merchantId: MERCHANT_ID, notes: MARK } }).catch(() => {});
    await prisma.teamMember.deleteMany({ where: { merchantId: MERCHANT_ID, name: MARK } }).catch(() => {});
  };
  await cleanup(); // por si una ejecución anterior crasheó

  try {
    // ── Actores: un operario (técnico) y un cliente del merchant demo ──
    const operario = await prisma.teamMember.create({
      data: { merchantId: MERCHANT_ID, name: MARK, email: `qa-scrum52-${stamp}@test.local`, role: 'tecnico', status: 'active' },
    });
    const customer = await prisma.customer.create({ data: { merchantId: MERCHANT_ID, name: 'QA SCRUM-52', notes: MARK } });

    // (1) POBLADO CON TEAMMEMBER: presupuesto creado por el operario, aceptado.
    const qWith = await prisma.quote.create({
      data: {
        merchantId: MERCHANT_ID, customerId: customer.id, total: '100.00', currency: 'EUR',
        lines: [], status: 'accepted', internalNotes: MARK, teamMemberId: operario.id,
      },
    });
    // SCRUM-255: el interceptor se instala ANTES de la accion -- el audit nace dentro de ella.
    const au1 = interceptarAuditLog({ prisma });
    await ensureJobForQuote(qWith.id);
    const jobWith = await prisma.job.findUnique({ where: { quoteId: qWith.id }, select: { id: true, operarioId: true } });
    assert.ok(jobWith, 'ensureJobForQuote debe crear el Job en el accept');
    assert.equal(jobWith.operarioId, operario.id, 'operarioId = creador del presupuesto (quote.teamMemberId)');

    // (3) AUDIT: 'operario_asignado' con teamMemberId = operarioId.
    let audit = null;
    try {
      await au1.esperarAlMenos(1); // espera a que ARRANQUE y luego a que termine (fire-and-forget anidado)
      audit = await buscarAudit(prisma, jobWith.id);
    } finally {
      au1.restaurar();
    }
    assert.ok(audit, au1.explicar('debe registrarse un audit_log operario_asignado para el Job'));
    assert.equal(audit.action, 'operario_asignado');
    assert.equal(audit.entityType, 'job');
    assert.equal(audit.teamMemberId, operario.id, 'audit.teamMemberId = operarioId');

    // IDEMPOTENCIA: la 2ª llamada NO re-crea el Job ni re-audita (guard findUnique).
    await ensureJobForQuote(qWith.id);
    const auditCount = await prisma.auditLog.count({
      where: { merchantId: MERCHANT_ID, action: 'operario_asignado', entityType: 'job', entityId: jobWith.id },
    });
    assert.equal(auditCount, 1, 'idempotente: una sola traza operario_asignado por Job');

    // (2) POBLADO OWNER (null): presupuesto del propietario (teamMemberId null) → operarioId null.
    const qOwner = await prisma.quote.create({
      data: {
        merchantId: MERCHANT_ID, customerId: customer.id, total: '50.00', currency: 'EUR',
        lines: [], status: 'accepted', internalNotes: MARK, teamMemberId: null,
      },
    });
    const au2 = interceptarAuditLog({ prisma }); // ventana propia: el suelo debe valer tambien aqui
    await ensureJobForQuote(qOwner.id);
    const jobOwner = await prisma.job.findUnique({ where: { quoteId: qOwner.id }, select: { id: true, operarioId: true } });
    assert.equal(jobOwner.operarioId, null, 'quote de propietario (teamMemberId null) → operarioId null');
    let auditOwner = null;
    try {
      await au2.esperarAlMenos(1);
      auditOwner = await buscarAudit(prisma, jobOwner.id);
    } finally {
      au2.restaurar();
    }
    assert.ok(auditOwner, au2.explicar('el quote de propietario también deja traza operario_asignado'));
    assert.equal(auditOwner.teamMemberId, null, 'audit del propietario: teamMemberId null (owner)');

    // (4) ÍNDICE: (merchant_id, operario_id) presente en la tabla jobs (Postgres).
    const idx = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'jobs' AND indexdef ILIKE '%operario_id%'`;
    assert.ok(Array.isArray(idx) && idx.length >= 1, 'debe existir un índice sobre operario_id en jobs (db push aplicado)');

    console.log('✔ SCRUM-52: operarioId poblado (teamMember + owner null), audit único operario_asignado, índice presente.');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
