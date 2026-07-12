// scripts/seed-staging.mjs — SCRUM-38 · Seed del entorno STAGING para QA autónomo.
// Idempotente: ejecutable N veces sin duplicar (merchant por email único; customer y
// quotes por marcador). Crea: merchant QA + cliente + 3 presupuestos ACCEPTED:
//   1) preset FIFTY_FIFTY (200,00 €)   2) preset FULL_UPFRONT (150,00 €)
//   3) custom 30/40/30 (Anticipo/Hito 1/Hito 2) con total IMPAR 100,01 €
//     → tramos exactos 30,00 / 40,00 / 30,01 (SCRUM-32: el último absorbe el resto).
// Uso:  DATABASE_URL=<postgres de STAGING> node scripts/seed-staging.mjs
//   (email del merchant QA configurable con E2E_QA_EMAIL; default qa@staging.yaqu)
// ⚠️ SIN datos personales (regla del brief): emails sintéticos del dominio staging.yaqu.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GUARD anti-producción: este seed JAMÁS corre contra la BD de prod.
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('autorack.proxy.rlwy.net')) {
  console.error('❌ DATABASE_URL apunta a PRODUCCIÓN — abortado. Usa la DATABASE_URL de staging.');
  process.exit(1);
}

const QA_EMAIL = (process.env.E2E_QA_EMAIL || 'qa@staging.yaqu').toLowerCase();
const MARK = '(SCRUM-38 staging seed)';

const CUSTOM_PLAN = [
  { percentage: 0.3, label: 'Anticipo' },
  { percentage: 0.4, label: 'Hito 1' },
  { percentage: 0.3, label: 'Hito 2' },
];

async function main() {
  // 1) Merchant QA (upsert por email único). planExpiresAt lejano: el paywall de trial
  //    no debe interferir con el QA (no se toca OWNER_EMAILS).
  const merchant = await prisma.merchant.upsert({
    where: { email: QA_EMAIL },
    update: { status: 'active' },
    create: {
      name: 'QA Staging',
      email: QA_EMAIL,
      country: 'ES',
      status: 'active',
      legalName: 'QA Staging S.L.',
      address: 'C/ Staging 1, 28000 Madrid',
      defaultCurrency: 'EUR',
      invoiceSeriesPrefix: 'QA',
      whatsappPhone: '34600000001',
      plan: 'trial',
      planExpiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000), // +10 años
    },
  });
  console.log(`✓ merchant QA #${merchant.id} (${QA_EMAIL})`);

  // 2) Cliente QA (idempotente por marcador en notes)
  let customer = await prisma.customer.findFirst({ where: { merchantId: merchant.id, notes: MARK } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        name: 'Cliente QA',
        phone: '34600000002',
        email: 'cliente@staging.yaqu',
        notes: MARK,
      },
    });
  }
  console.log(`✓ customer #${customer.id}`);

  // 3) Los 3 presupuestos ACCEPTED (idempotentes por marcador en internalNotes)
  const specs = [
    { key: 'fifty', total: '200.00', paymentTerms: 'FIFTY_FIFTY', customBillingPlan: undefined, concept: 'Trabajo QA 50/50' },
    { key: 'full', total: '150.00', paymentTerms: 'FULL_UPFRONT', customBillingPlan: undefined, concept: 'Trabajo QA 100%' },
    { key: 'custom', total: '100.01', paymentTerms: null, customBillingPlan: CUSTOM_PLAN, concept: 'Obra QA por hitos (30/40/30)' },
  ];

  let nextNumber = merchant.nextQuoteNumber || 1;
  for (const s of specs) {
    const marker = `${MARK} ${s.key}`;
    const existing = await prisma.quote.findFirst({ where: { merchantId: merchant.id, internalNotes: marker } });
    if (existing) {
      console.log(`= quote "${s.key}" ya existe (#${existing.quoteNumber ?? existing.id}) — sin cambios`);
      continue;
    }
    const q = await prisma.quote.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        quoteNumber: nextNumber++,
        status: 'accepted',
        acceptedAt: new Date(),
        decisionChannel: 'backoffice',
        total: s.total,
        currency: 'EUR',
        lines: [{ concept: s.concept, qty: 1, price: Number(s.total), tax: 0 }],
        paymentTerms: s.paymentTerms,
        customBillingPlan: s.customBillingPlan,
        internalNotes: marker,
      },
    });
    console.log(`✓ quote "${s.key}" creada (#${q.quoteNumber}, ${s.total} €)`);
  }

  // Contador de numeración del merchant al día (solo avanza, nunca retrocede)
  if (nextNumber > (merchant.nextQuoteNumber || 1)) {
    await prisma.merchant.update({ where: { id: merchant.id }, data: { nextQuoteNumber: nextNumber } });
  }

  console.log('DONE — seed staging idempotente completado.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
