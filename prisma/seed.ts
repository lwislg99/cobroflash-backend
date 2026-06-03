// prisma/seed.ts

/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
      whatsappPhone: '34600000000',
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
      whatsappPhone: '34600000000',
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
      phone: '34629965893',
      email: 'cliente@example.com',
      notes: 'Cliente demo para probar YaQu',
    },
    create: {
      merchantId: 1,
      name: 'Cliente Prueba',
      phone: '34629965893',
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
