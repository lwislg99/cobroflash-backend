// scripts/clean-staging-tests.mjs — SCRUM-79
// Borra de STAGING los merchants EFÍMEROS que dejan los tests gateados cuando fallan a
// medio camino (el `finally` no llega a correr si el proceso muere o el assert revienta
// antes). Se acumulan y ensucian el entorno: llegamos a 26 de 28 merchants huérfanos.
//
// Criterio de borrado — deliberadamente ESTRECHO: solo merchants cuyo email termina en
// `@test.local`, que es el dominio sintético que usan TODOS los tests (qa-*@test.local).
// Ningún merchant real puede tener ese dominio. Nunca se borra por nombre ni por fecha.
//
// Uso:
//   node scripts/clean-staging-tests.mjs           → DRY RUN (solo lista, no borra)
//   node scripts/clean-staging-tests.mjs --apply   → borra de verdad
//
// ⚠️ GUARD ANTI-PRODUCCIÓN (mismo patrón que scripts/seed-staging.mjs): aborta si la URL
// apunta al host de prod. Además exige DATABASE_URL_STAGING explícita: no se hereda la
// DATABASE_URL del .env "por si acaso".
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const TEST_EMAIL_DOMAIN = '@test.local';
const PROD_HOST = 'autorack.proxy.rlwy.net';
const APPLY = process.argv.includes('--apply');

const url = process.env.DATABASE_URL_STAGING;
if (!url) {
  console.error('❌ Falta DATABASE_URL_STAGING. Este script NO usa DATABASE_URL (podría ser prod).');
  process.exit(1);
}
if (url.includes(PROD_HOST)) {
  console.error('❌ DATABASE_URL_STAGING apunta a PRODUCCIÓN — abortado.');
  process.exit(1);
}
process.env.DATABASE_URL = url;

const prisma = new PrismaClient();

async function main() {
  const t0 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log(`⏱  latencia SELECT 1: ${Date.now() - t0} ms`);

  const huerfanos = await prisma.merchant.findMany({
    where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  if (!huerfanos.length) {
    console.log('✅ No hay merchants de test huérfanos.');
    return;
  }

  console.log(`\n${huerfanos.length} merchants de test (${TEST_EMAIL_DOMAIN}):`);
  for (const m of huerfanos) {
    console.log(`  #${m.id}  ${m.name}  ${m.email}  ${m.createdAt.toISOString().slice(0, 10)}`);
  }

  if (!APPLY) {
    console.log('\n🔎 DRY RUN — no se ha borrado nada. Repite con --apply para borrarlos.');
    return;
  }

  const ids = huerfanos.map((m) => m.id);
  const where = { merchantId: { in: ids } };

  // Hijos antes que padres. `.catch` por si alguna tabla no existe en este entorno:
  // limpiar es best-effort, nunca debe dejar el proceso a medias por una tabla.
  const pasos = [
    ['authSession', () => prisma.authSession.deleteMany({ where })],
    ['auditLog', () => prisma.auditLog.deleteMany({ where })],
    ['albaran', () => prisma.albaran.deleteMany({ where })],
    ['invoice', () => prisma.invoice.deleteMany({ where })],
    ['job', () => prisma.job.deleteMany({ where })],
    ['quote', () => prisma.quote.deleteMany({ where })],
    ['charge', () => prisma.charge.deleteMany({ where })],
    ['expense', () => prisma.expense.deleteMany({ where })],
    ['quoteRequest', () => prisma.quoteRequest.deleteMany({ where })],
    ['customerEvent', () => prisma.customerEvent.deleteMany({ where })],
    ['customer', () => prisma.customer.deleteMany({ where })],
    ['teamMember', () => prisma.teamMember.deleteMany({ where })],
    ['product', () => prisma.product.deleteMany({ where })],
    ['provider', () => prisma.provider.deleteMany({ where })],
    ['quoteTemplate', () => prisma.quoteTemplate.deleteMany({ where })],
  ];

  console.log('');
  for (const [tabla, fn] of pasos) {
    const r = await fn().catch((e) => {
      console.log(`  ⚠️  ${tabla}: ${e.message.split('\n')[0]}`);
      return null;
    });
    if (r && r.count) console.log(`  ${tabla}: ${r.count} borrados`);
  }

  const del = await prisma.merchant.deleteMany({ where: { id: { in: ids } } });
  console.log(`  merchant: ${del.count} borrados`);

  const t1 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log(`\n⏱  latencia SELECT 1 tras la limpieza: ${Date.now() - t1} ms`);
  console.log(`✅ Limpieza terminada (${del.count} merchants de test).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
