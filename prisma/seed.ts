// prisma/seed.ts

/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── 🔴 SCRUM-746 (fase B) · A DÓNDE SIEMBRO, ANTES DE ESCRIBIR UNA FILA ───────────────────
  //
  // Este fichero era el ÚNICO de los TRES sembradores de la casa que no lo comprobaba:
  // `scripts/seed-demo.mjs` y `scripts/seed-video.mjs` llaman a `destinoSembrable` desde
  // SCRUM-381, y éste hacía `new PrismaClient()` a secas contra lo que apuntara `DATABASE_URL`.
  // El `upsert` de abajo pisa nombre, NIF, dirección, plan y `planExpiresAt` del merchant 1.
  //
  // 🔴 NO se escribe una comprobación nueva: se llama a LA MISMA que ya usan los otros dos. Su
  // allowlist (`DESTINOS_SEMBRABLES`) es staging, localhost y loopback — producción no está y no
  // puede estar, y ampliarla es un cambio de código que se ve en el diff, no una variable de
  // entorno que convierta el guard en un trámite.
  //
  // Y NO añade fricción para sembrar en desarrollo, que era la condición: la URL de dev vive en
  // el mismo host que staging, así que un `DATABASE_URL=<dev> npm run db:seed` pasa igual que
  // antes. Lo único que deja de poder hacerse es lo que nadie quería hacer.
  //
  // `import()` dinámico porque `_db-guard.mjs` es ESM y esto lo ejecuta ts-node en CommonJS.
  // `tsconfig.json` sólo incluye `src`, así que este fichero no pasa por `npm run build`.
  //
  // SCRUM-1105b: y por eso nadie vio que ts-node NO lo compilaba: el `.mjs` no trae tipos y el
  // `import()` daba TS7016, así que `npm run db:seed` moría antes de la primera línea. El
  // `@ts-expect-error` dice cuál es el error que se acepta; si un día trae tipos, cae él solo.
  //
  // SCRUM-1105b: la base se NOMBRA, no se exporta: `npm run seed -- --dev` (o `--staging`), y la
  // URL la resuelve `fijarDestinoPorBandera`, el mismo que usan los otros tres sembradores. Sin
  // bandera, el camino de antes (la condición de arriba: sin fricción nueva en desarrollo).
  // @ts-expect-error TS7016: `_destino-de-semilla.mjs` no trae declaración de tipos.
  const { fijarDestinoPorBandera, RECHAZADO, FIJADO } = await import('../scripts/_destino-de-semilla.mjs');
  const porBandera = fijarDestinoPorBandera();
  if (porBandera.estado === RECHAZADO) {
    console.error(`\n🔴 NO SE SIEMBRA.\n   ${porBandera.mensaje}\n`);
    process.exit(1);
  }
  if (porBandera.estado === FIJADO) for (const aviso of porBandera.avisos) console.warn(`⚠️  ${aviso}`);

  // @ts-expect-error TS7016: `_db-guard.mjs` no trae declaración de tipos.
  const { destinoSembrable } = await import('../scripts/_db-guard.mjs');
  const destino = destinoSembrable(process.env.DATABASE_URL);
  if (!destino.ok) {
    console.error(`\n🔴 NO SE SIEMBRA. Destino: ${destino.etiqueta}\n   ${destino.motivo}\n`);
    console.error('   Nombra la base y la clave se resuelve por dentro:');
    console.error('     npm run seed -- --dev        (o --staging)\n');
    process.exit(1);
  }
  console.log(`→ sembrando en ${destino.etiqueta}`);

  // 🔹 Merchant demo (id 1 que ya usas en los cURL)
  const merchant = await prisma.merchant.upsert({
    where: { id: 1 },
    update: {
      name: 'Demo ES',
      country: 'ES',
      status: 'active',
      legalName: 'Demo ES S.L.',
      address: 'C/ Ejemplo 123, 28000 Madrid',
      defaultCurrency: 'EUR',
      invoiceSeriesPrefix: 'CF',
      logoUrl: null,
      taxId: 'B12345678',
      whatsappPhone: '34000000001',
    },
    create: {
      name: 'Demo ES',
      email: 'demo@yaqu.app',
      country: 'ES',
      status: 'active',
      legalName: 'Demo ES S.L.',
      address: 'C/ Ejemplo 123, 28000 Madrid',
      defaultCurrency: 'EUR',
      invoiceSeriesPrefix: 'CF',
      logoUrl: null,
      taxId: 'B12345678',
      whatsappPhone: '34000000001',
      nextInvoiceNumber: 1,
      plan: 'trial',
      planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    }
  });

  // 🔹 Customer demo (para los ejemplos que usas en los cURL)
  const customer = await prisma.customer.upsert({
    where: { id: 1 },
    update: {
      name: 'Cliente Prueba',
      phone: '34000000002',
      email: 'cliente@example.com',
      notes: 'Cliente demo para probar YaQu',
    },
    create: {
      merchantId: 1,
      name: 'Cliente Prueba',
      phone: '34000000002',
      email: 'cliente@example.com',
      notes: 'Cliente demo para probar YaQu',
    }
  });

  console.log('✅ Seed completado');
  console.log('Merchant demo:', merchant);
  console.log('Customer demo:', customer);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
