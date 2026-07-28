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
import { assertSafeStagingUrl } from './_db-guard.mjs';

// GUARD anti-producción: este seed JAMÁS corre contra la BD de prod.
//
// SCRUM-118: antes bloqueaba la subcadena `autorack` — el host de prod de entonces. Eso no
// comprueba nada: cualquier otro host pasaba, incluida una URL de producción tras una
// rotación. Ahora es una ALLOWLIST POSITIVA de host exacto, incondicional y fail-closed
// (la misma que usa el guard de los tests, para que no puedan divergir).
//
// Este seed BORRA Y REESCRIBE datos, así que la protección va antes de construir el cliente
// y no depende de ningún gate.
const dbUrl = process.env.DATABASE_URL || '';
const dbCheck = assertSafeStagingUrl(dbUrl);
if (!dbCheck.safe) {
  console.error(`❌ DATABASE_URL no es una URL de staging segura (${dbCheck.reason}) — abortado. Usa la DATABASE_URL de staging.`);
  process.exit(1);
}

const prisma = new PrismaClient();

const QA_EMAIL = (process.env.E2E_QA_EMAIL || 'qa@staging.yaqu').toLowerCase();
const MARK = '(SCRUM-38 staging seed)';

const CUSTOM_PLAN = [
  { percentage: 0.3, label: 'Anticipo' },
  { percentage: 0.4, label: 'Hito 1' },
  { percentage: 0.3, label: 'Hito 2' },
];

async function main() {
  // 0) SCRUM-42: "quemar" el id 1 — la regla 8 del máster trata merchant.id===1 como
  //    cuenta DEMO (serie fiscal en vez de J-, watermark, lock de envíos V0-2). Un
  //    placeholder INERTE ocupa el id 1 para que el merchant QA caiga en id>=2 con
  //    semántica de merchant REAL. Idempotente; convierte el caso heredado (QA ya
  //    sembrado en id 1) limpiando sus datos primero.
  const RESERVED_EMAIL = 'demo-reserved@staging.yaqu';
  const id1 = await prisma.merchant.findUnique({ where: { id: 1 } });
  if (!id1) {
    await prisma.merchant.create({
      data: { id: 1, name: 'demo-reserved', email: RESERVED_EMAIL, country: 'ES', status: 'suspended' },
    });
    console.log('✓ id 1 quemado con placeholder inerte');
  } else if (id1.email === QA_EMAIL) {
    // Caso heredado: el QA cayó en id 1 → limpiar sus datos y convertirlo en el placeholder
    const wipes = [
      ['events', () => prisma.event.deleteMany({ where: { charge: { merchantId: 1 } } })],
      ['invoices', () => prisma.invoice.deleteMany({ where: { merchantId: 1 } })],
      ['jobs', () => prisma.job.deleteMany({ where: { merchantId: 1 } })],
      ['charges', () => prisma.charge.deleteMany({ where: { merchantId: 1 } })],
      ['quotes', () => prisma.quote.deleteMany({ where: { merchantId: 1 } })],
      ['customers', () => prisma.customer.deleteMany({ where: { merchantId: 1 } })],
      ['authSessions', () => prisma.authSession.deleteMany({ where: { merchantId: 1 } })],
    ];
    for (const [name, del] of wipes) {
      try { const r = await del(); if (r.count) console.log(`  - limpiado ${name}: ${r.count}`); }
      catch (e) { console.log(`  ! ${name}: ${e?.code || e?.message}`); }
    }
    await prisma.merchant.update({
      where: { id: 1 },
      data: { name: 'demo-reserved', email: RESERVED_EMAIL, status: 'suspended', nextQuoteNumber: 1 },
    });
    console.log('✓ QA heredado en id 1 convertido a placeholder (datos limpiados)');
  } else {
    console.log('= id 1 ya ocupado (placeholder u otro) — sin cambios');
  }
  // El create con id explícito NO avanza la secuencia de Postgres → alinearla a MAX(id)
  // para que el siguiente autoincrement no choque con el 1.
  await prisma.$executeRawUnsafe(
    "SELECT setval(pg_get_serial_sequence('merchants','id'), (SELECT GREATEST(MAX(id),1) FROM merchants))"
  );

  // 1) Merchant QA (upsert por email único; cae en id>=2 = semántica de merchant real).
  //    planExpiresAt lejano: el paywall de trial no debe interferir con el QA (no se toca OWNER_EMAILS).
  const merchant = await prisma.merchant.upsert({
    where: { email: QA_EMAIL },
    // SCRUM-61: onboarding completado también en el update (merchant QA preexistente sin wipe).
    update: { status: 'active', onboardingCompleted: true },
    create: {
      name: 'QA Staging',
      email: QA_EMAIL,
      country: 'ES',
      status: 'active',
      // SCRUM-61 (DX del QA): sin wizard de onboarding → el #onboarding-backdrop no intercepta
      // los clicks del suite Playwright (antes había que quitarlo por JS en cada ejecución).
      onboardingCompleted: true,
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

  // 4) SCRUM-14: Trabajos para las quotes aceptadas. El seed acepta por Prisma directo
  //    (sin pasar por /decision → ensureJobForQuote no corre), así que la suite de
  //    albaranes (v1.3) necesita que los Jobs existan. Idempotente: Job.quoteId es único.
  const seededQuotes = await prisma.quote.findMany({
    where: { merchantId: merchant.id, internalNotes: { startsWith: MARK } },
  });
  for (const q of seededQuotes) {
    const existingJob = await prisma.job.findUnique({ where: { quoteId: q.id } });
    if (existingJob) {
      console.log(`= job del quote #${q.quoteNumber ?? q.id} ya existe (#${existingJob.id}) — sin cambios`);
      continue;
    }
    const job = await prisma.job.create({
      data: {
        merchantId: merchant.id,
        customerId: q.customerId,
        quoteId: q.id,
        status: 'pendiente_agendar',
        titulo: `Presupuesto #${q.quoteNumber ?? q.id} · Cliente QA`,
        totalAceptado: q.total,
      },
    });
    console.log(`✓ job #${job.id} creado para el quote #${q.quoteNumber ?? q.id}`);
  }

  // SCRUM-118 · MARCADOR DE STAGING. Es lo que `tests/_staging-db.mjs` lee para verificar
  // la PROPIEDAD «esta BD es staging» en vez del síntoma «la URL no dice autorack».
  // Va aquí para que toda BD recién sembrada quede marcada sin que nadie se acuerde.
  // Producción no lo tiene ni puede tenerlo por accidente: no viaja en `schema.prisma`, y
  // prod se aprovisiona con el mismo `db push`, o sea que recibe el schema y nada más.
  // (Para una BD YA sembrada usa `scripts/marcar-staging.mjs`: re-sembrar retrocedería
  // `nextQuoteNumber`.)
  // format('%I') dentro de Postgres: el nombre nunca sale de la BD y no hay inyección.
  await prisma.$executeRawUnsafe(
    "DO $$ BEGIN EXECUTE format('COMMENT ON DATABASE %I IS %L', current_database(), 'YAQU_STAGING'); END $$;",
  );
  console.log('✓ BD marcada como STAGING (YAQU_STAGING)');

  console.log('DONE — seed staging idempotente completado.');
}

main()
  // SCRUM-196: e?.message en vez del objeto entero — reduce superficie. NO es fuga hoy (Prisma no
  // mete la contraseña en el mensaje de sus errores), pero eso es una propiedad de la versión de
  // Prisma que tenemos, no una garantía nuestra. Imprimir el error entero era superficie de más.
  .catch((e) => { console.error(e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
