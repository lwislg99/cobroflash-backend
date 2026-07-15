// scripts/seed-video.mjs — V0-6: cuenta realista para grabar el vídeo comercial (60s).
//
// TAREA DE DATOS. Escribe SOLO en BD vía Prisma Client sobre el esquema EXISTENTE.
// NO toca schema/migraciones. NO envía WhatsApp/email. NO crea objetos en Stripe.
// NO toca el merchant demo (id=1) ni ningún merchant existente. Idempotente por el
// email del owner: si la cuenta ya existe, ABORTA (no duplica, no borra, no actualiza).
//
// Numeración: usa el mecanismo VIGENTE del código (allocateQuoteNumber /
// allocateInvoiceNumber / allocateAlbaranNumber) — PROHIBIDO hardcodear números.
// Requiere `npm run build` antes (importa los servicios compilados de dist/).
//
// EJECUCIÓN (el fundador decide la BD; el script NO asume prod):
//   1) export DATABASE_URL=<la BD que el fundador indique>
//   2) export SEED_VIDEO_CONFIRM=<hostname EXACTO de esa BD>   (te lo dice el script si falta)
//   3) node scripts/seed-video.mjs
//
// TODOS los clientes son INVENTADOS con teléfono estructuralmente inválido (346000000NN)
// → cero riesgo de envío accidental. (María García es uno más; el seed no envía nada.)

import { PrismaClient } from '@prisma/client';
import { allocateQuoteNumber } from '../dist/modules/quotes/domain/quoteNumber.service.js';
import { allocateInvoiceNumber, isReceiptNumber } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';
import { allocateAlbaranNumber } from '../dist/modules/jobs/domain/albaranNumber.service.js';
import { resolveBillingPlan, distributeStageAmounts } from '../dist/modules/quotes/domain/billingPlan.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN EDITABLE POR EL FUNDADOR
// ─────────────────────────────────────────────────────────────────────────────
const OWNER_EMAIL = 'lwislg99@gmail.com';           // magic link normal
// María García: cliente INVENTADO como el resto (teléfono estructuralmente inválido).
const MARIA_PHONE = '34600000001';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const NOW = new Date();
const abort = (msg) => { console.error('\n❌ ABORTADO: ' + msg + '\n'); process.exit(1); };
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000);
const daysFromNow = (n) => new Date(NOW.getTime() + n * 86_400_000);
const thisMonthDay = (day) => new Date(NOW.getFullYear(), NOW.getMonth(), day, 11, 0, 0);
const round2 = (n) => Math.round(n * 100) / 100;
// Total de una línea = base + IVA (line.tax es FRACCIÓN, p.ej. 0.21 = 21% — convención del código, quotesView.js).
const lineTotal = (l) => round2(Number(l.qty) * Number(l.price) * (1 + Number(l.tax || 0)));
const linesTotal = (lines) => round2(lines.reduce((a, l) => a + lineTotal(l), 0));
// Firma de muestra (PNG 1x1 válido) — placeholder visual; el rótulo "✅ Firmado digitalmente" es el que manda.
const SAMPLE_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// PNG 1x1 (bytes) para una foto adjunta de solicitud (la galería muestra miniatura).
const SAMPLE_PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// ─────────────────────────────────────────────────────────────────────────────
// GUARDS de seguridad (stop conditions del brief)
// ─────────────────────────────────────────────────────────────────────────────
async function preflight() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) abort('DATABASE_URL no está definida. El fundador decide contra qué BD se ejecuta.');

  let host = '';
  try { host = new URL(dbUrl).hostname; } catch { abort('DATABASE_URL no es una URL válida.'); }

  // El fundador DEBE confirmar explícitamente el host de la BD (no se asume prod).
  if (process.env.SEED_VIDEO_CONFIRM !== host) {
    abort(
      `Confirma la BD de forma EXPLÍCITA. La DATABASE_URL apunta al host:\n\n    ${host}\n\n` +
      `Si es la BD correcta, re-ejecuta con:\n\n    SEED_VIDEO_CONFIRM=${host} node scripts/seed-video.mjs\n`,
    );
  }

  // Entorno reconocible: debe existir el merchant demo (regla 8) y haber merchants.
  const merchantCount = await prisma.merchant.count();
  if (merchantCount === 0) {
    abort('La BD no tiene ningún merchant (parece vacía/no-prod). El id=1 está reservado al demo (regla 8). Aborto por seguridad.');
  }
  const demo = await prisma.merchant.findFirst({
    where: { OR: [{ id: 1 }, { email: 'demo@yaqu.app' }] },
    select: { id: true, email: true },
  });
  if (!demo) abort('No encuentro el merchant demo (id=1 / demo@yaqu.app). No reconozco este entorno — aborto por seguridad.');

  // Idempotencia: si el owner ya existe, no duplicar/borrar/actualizar.
  const existing = await prisma.merchant.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (existing) {
    abort(`Ya existe un merchant con email ${OWNER_EMAIL} (id=${existing.id}). ` +
      'El seed es idempotente: no duplica ni modifica. Nada que hacer.');
  }

  console.log(`✓ Preflight OK — host=${host}, demo id=${demo.id}, merchants=${merchantCount}. Owner libre.`);
  return { host };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS (catálogo, clientes, presupuestos)
// ─────────────────────────────────────────────────────────────────────────────

// 30 ítems de fontanería (precios de venta plausibles Madrid 2026). tax = fracción.
// 3 de mano de obra en vivienda >2 años al 10% (26/27/28). cost para el margen.
const CATALOG = [
  { name: 'Termo eléctrico 80L', price: 189, cost: 120, vat: 0.21 },
  { name: 'Termo eléctrico 50L', price: 149, cost: 95, vat: 0.21 },
  { name: 'Cisterna empotrada (bastidor)', price: 265, cost: 175, vat: 0.21 },
  { name: 'Grifería monomando cocina', price: 79, cost: 45, vat: 0.21 },
  { name: 'Grifería monomando baño (lavabo)', price: 69, cost: 38, vat: 0.21 },
  { name: 'Grifería monomando ducha/bañera', price: 89, cost: 52, vat: 0.21 },
  { name: 'Plato de ducha resina 120x80', price: 210, cost: 140, vat: 0.21 },
  { name: 'Inodoro completo (taza + cisterna)', price: 175, cost: 110, vat: 0.21 },
  { name: 'Lavabo con pedestal', price: 95, cost: 58, vat: 0.21 },
  { name: 'Radiador toallero 500x800', price: 119, cost: 72, vat: 0.21 },
  { name: 'Válvula termostática de radiador', price: 24.5, cost: 12, vat: 0.21 },
  { name: 'Latiguillo flexible inox 1/2"', price: 4.9, cost: 1.8, vat: 0.21 },
  { name: 'Sifón botella universal', price: 8.5, cost: 3.2, vat: 0.21 },
  { name: 'Llave de paso 1/2"', price: 6.9, cost: 2.5, vat: 0.21 },
  { name: 'Flexo de conexión termo', price: 12, cost: 5, vat: 0.21 },
  { name: 'Bomba de circulación (recambio)', price: 145, cost: 95, vat: 0.21 },
  { name: 'Grupo de seguridad para termo', price: 18, cost: 8, vat: 0.21 },
  { name: 'Mano de obra oficial de 1ª (hora)', price: 35, cost: 0, vat: 0.21 },
  { name: 'Ayudante (hora)', price: 24, cost: 0, vat: 0.21 },
  { name: 'Desplazamiento (zona sur de Madrid)', price: 25, cost: 0, vat: 0.21 },
  { name: 'Urgencia fin de semana / festivo', price: 60, cost: 0, vat: 0.21 },
  { name: 'Retirada y transporte de aparato viejo', price: 20, cost: 0, vat: 0.21 },
  { name: 'Desatasco con máquina eléctrica', price: 90, cost: 0, vat: 0.21 },
  { name: 'Localización de fuga (equipo de detección)', price: 110, cost: 0, vat: 0.21 },
  { name: 'Sustitución de bajante (metro lineal)', price: 45, cost: 15, vat: 0.21 },
  { name: 'Instalación de termo (mano de obra)', price: 70, cost: 0, vat: 0.10 },
  { name: 'Instalación de plato de ducha (mano de obra)', price: 180, cost: 0, vat: 0.10 },
  { name: 'Reforma de aseo pequeño (mano de obra)', price: 650, cost: 0, vat: 0.10 },
  { name: 'Boletín / certificado de instalación de agua', price: 60, cost: 0, vat: 0.21 },
  { name: 'Mantenimiento anual de caldera', price: 85, cost: 0, vat: 0.21 },
];

// 15 clientes INVENTADOS. Todos con teléfono estructuralmente inválido 346000000NN.
// 4 con email (@example.com = RFC-2606, NUNCA se entrega → cero riesgo). El resto sin email (realista).
const CLIENTS = [
  { name: 'María García', city: 'Alcorcón', address: 'C/ Mayor 12, 28921 Alcorcón (Madrid)', phone: MARIA_PHONE, email: 'maria.garcia@example.com' },
  { name: 'José Martínez', city: 'Móstoles', address: 'Av. de Portugal 45, 28931 Móstoles (Madrid)', phone: '34600000002', email: null },
  { name: 'Carmen López', city: 'Leganés', address: 'C/ Río Manzanares 8, 28914 Leganés (Madrid)', phone: '34600000003', email: 'carmen.lopez@example.com' },
  { name: 'Antonio Sánchez', city: 'Fuenlabrada', address: 'C/ de la Plaza 3, 28941 Fuenlabrada (Madrid)', phone: '34600000004', email: null },
  { name: 'Isabel Fernández', city: 'Getafe', address: 'Av. de España 120, 28903 Getafe (Madrid)', phone: '34600000005', email: 'isabel.fernandez@example.com' },
  { name: 'Manuel Rodríguez', city: 'Alcorcón', address: 'C/ Cáceres 22, 28924 Alcorcón (Madrid)', phone: '34600000006', email: null },
  { name: 'Dolores Gómez', city: 'Móstoles', address: 'C/ Simón Hernández 60, 28936 Móstoles (Madrid)', phone: '34600000007', email: null },
  { name: 'Francisco Jiménez', city: 'Leganés', address: 'Av. Rey Juan Carlos I 40, 28916 Leganés (Madrid)', phone: '34600000008', email: 'francisco.jimenez@example.com' },
  { name: 'Ana Ruiz', city: 'Fuenlabrada', address: 'C/ Portugal 15, 28943 Fuenlabrada (Madrid)', phone: '34600000009', email: null },
  { name: 'Juan Moreno', city: 'Getafe', address: 'C/ Madrid 78, 28901 Getafe (Madrid)', phone: '34600000010', email: null },
  { name: 'Pilar Muñoz', city: 'Alcorcón', address: 'C/ Fuenlabrada 9, 28922 Alcorcón (Madrid)', phone: '34600000011', email: null },
  { name: 'Luis Álvarez', city: 'Móstoles', address: 'C/ Antonio Hernández 5, 28934 Móstoles (Madrid)', phone: '34600000012', email: null },
  { name: 'Rosa Romero', city: 'Leganés', address: 'C/ Priorato 11, 28915 Leganés (Madrid)', phone: '34600000013', email: null },
  { name: 'Teresa Navarro', city: 'Getafe', address: 'C/ Toledo 33, 28905 Getafe (Madrid)', phone: '34600000014', email: null },
  { name: 'Beatriz Ortega', city: 'Fuenlabrada', address: 'C/ Grecia 27, 28946 Fuenlabrada (Madrid)', phone: '34600000015', email: null },
];

// Helper para construir una línea desde el catálogo por nombre.
const L = (name, qty, priceOverride) => {
  const p = CATALOG.find((c) => c.name === name);
  if (!p) throw new Error('Catálogo sin ítem: ' + name);
  return { concept: p.name, qty, price: priceOverride ?? p.price, tax: p.vat };
};

// 12 presupuestos con historia. NO se incluye el del "termo 80L con señal de 450 €"
// (ESE lo crea el fundador EN DIRECTO durante el rodaje — es la escena del vídeo).
// clientIdx = índice en CLIENTS. job/pay describen el estado a materializar.
function buildQuotes() {
  return [
    // ── 6 ACEPTADOS (con firma) ──────────────────────────────────────────────
    {
      key: 'aseo', clientIdx: 2, status: 'accepted', createdAgo: 40, decidedAgo: 38,
      paymentTerms: 'FIFTY_FIFTY', job: 'terminado',
      lines: [
        L('Reforma de aseo pequeño (mano de obra)', 1),
        L('Plato de ducha resina 120x80', 1),
        L('Instalación de plato de ducha (mano de obra)', 1),
        L('Inodoro completo (taza + cisterna)', 1),
        L('Grifería monomando ducha/bañera', 1),
        L('Mano de obra oficial de 1ª (hora)', 14),
      ],
      // FIFTY_FIFTY: 2 tramos. anticipo PAGADO este mes; resto PENDIENTE.
      stagesPaid: [true, false], stagesPaidDay: [8, null],
    },
    {
      key: 'fuga', clientIdx: 7, status: 'accepted', createdAgo: 20, decidedAgo: 18,
      paymentTerms: 'FULL_UPFRONT', job: 'en_curso',
      lines: [
        L('Localización de fuga (equipo de detección)', 1),
        L('Sustitución de bajante (metro lineal)', 8),
        L('Mano de obra oficial de 1ª (hora)', 6),
        L('Desplazamiento (zona sur de Madrid)', 1),
      ],
      stagesPaid: [false], stagesPaidDay: [null], // en curso, cobro al terminar → PENDIENTE
    },
    {
      key: 'termo50', clientIdx: 5, status: 'accepted', createdAgo: 6, decidedAgo: 5,
      paymentTerms: 'FULL_UPFRONT', job: 'agendado', scheduledIn: 3,
      lines: [
        L('Termo eléctrico 50L', 1),
        L('Instalación de termo (mano de obra)', 1),
        L('Grupo de seguridad para termo', 1),
        L('Flexo de conexión termo', 2),
        L('Retirada y transporte de aparato viejo', 1),
        L('Mano de obra oficial de 1ª (hora)', 3),
      ],
      stagesPaid: [true], stagesPaidDay: [4], // señal 100% pagada, trabajo agendado
    },
    {
      key: 'griferia', clientIdx: 1, status: 'accepted', createdAgo: 55, decidedAgo: 53,
      paymentTerms: 'FULL_UPFRONT', job: 'cerrado',
      lines: [
        L('Grifería monomando cocina', 1),
        L('Grifería monomando baño (lavabo)', 1),
        L('Latiguillo flexible inox 1/2"', 4),
        L('Mano de obra oficial de 1ª (hora)', 6),
        L('Desplazamiento (zona sur de Madrid)', 1),
      ],
      stagesPaid: [true], stagesPaidDay: [10],
    },
    {
      key: 'desatasco', clientIdx: 6, status: 'accepted', createdAgo: 12, decidedAgo: 12,
      paymentTerms: 'FULL_UPFRONT', job: 'cerrado',
      lines: [
        L('Desatasco con máquina eléctrica', 1),
        L('Urgencia fin de semana / festivo', 1),
        L('Desplazamiento (zona sur de Madrid)', 1),
        L('Mano de obra oficial de 1ª (hora)', 3),
      ],
      stagesPaid: [true], stagesPaidDay: [11],
    },
    {
      key: 'toallero', clientIdx: 4, status: 'accepted', createdAgo: 15, decidedAgo: 14,
      paymentTerms: 'FULL_UPFRONT', job: 'cerrado',
      lines: [
        L('Radiador toallero 500x800', 1),
        L('Válvula termostática de radiador', 2),
        L('Mano de obra oficial de 1ª (hora)', 6),
        L('Desplazamiento (zona sur de Madrid)', 1),
      ],
      stagesPaid: [true], stagesPaidDay: [9],
    },
    // ── 3 ENVIADOS (esperando decisión) ──────────────────────────────────────
    {
      key: 'caldera', clientIdx: 9, status: 'sent', createdAgo: 4,
      paymentTerms: 'FIFTY_FIFTY',
      lines: [
        L('Mantenimiento anual de caldera', 1),
        L('Bomba de circulación (recambio)', 1),
        L('Mano de obra oficial de 1ª (hora)', 8),
        L('Desplazamiento (zona sur de Madrid)', 1),
      ],
    },
    {
      key: 'bajante', clientIdx: 3, status: 'sent', createdAgo: 3,
      paymentTerms: 'FULL_UPFRONT',
      lines: [
        L('Sustitución de bajante (metro lineal)', 14),
        L('Mano de obra oficial de 1ª (hora)', 6),
        L('Ayudante (hora)', 6),
      ],
    },
    {
      key: 'alta', clientIdx: 11, status: 'sent', createdAgo: 2,
      paymentTerms: 'FULL_UPFRONT',
      lines: [
        L('Boletín / certificado de instalación de agua', 1),
        L('Llave de paso 1/2"', 3),
        L('Mano de obra oficial de 1ª (hora)', 4),
      ],
    },
    // ── 2 BORRADORES ─────────────────────────────────────────────────────────
    {
      key: 'cocina', clientIdx: 12, status: 'draft', createdAgo: 1,
      paymentTerms: 'FIFTY_FIFTY',
      lines: [
        L('Grifería monomando cocina', 1),
        L('Inodoro completo (taza + cisterna)', 1),
        L('Lavabo con pedestal', 1),
        L('Mano de obra oficial de 1ª (hora)', 20),
        L('Ayudante (hora)', 20),
      ],
    },
    {
      key: 'radiadores', clientIdx: 13, status: 'draft', createdAgo: 1,
      paymentTerms: 'FULL_UPFRONT',
      lines: [
        L('Radiador toallero 500x800', 3),
        L('Válvula termostática de radiador', 6),
        L('Mano de obra oficial de 1ª (hora)', 14),
      ],
    },
    // ── 1 RECHAZADO ──────────────────────────────────────────────────────────
    {
      key: 'rechazo', clientIdx: 8, status: 'rejected', createdAgo: 30, decidedAgo: 27,
      paymentTerms: 'FULL_UPFRONT',
      rejectionReason: 'Precio alto — va a pedir otro presupuesto',
      lines: [
        L('Bomba de circulación (recambio)', 1),
        L('Mano de obra oficial de 1ª (hora)', 6),
        L('Desplazamiento (zona sur de Madrid)', 1),
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED (todo en UNA transacción → atómico; si algo falla, no deja datos a medias)
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  const counts = {
    merchant: 0, teamMembers: 0, customers: 0, products: 0, providers: 0,
    quotes: 0, invoices: 0, charges: 0, jobs: 0, albaranes: 0, expenses: 0,
    quoteTemplates: 0, quoteRequests: 0, attachments: 0, customerEvents: 0,
  };
  let collectedThisMonth = 0, pendingAmount = 0, awaitingAmount = 0;

  await prisma.$transaction(async (tx) => {
    // 1) MERCHANT — ES, sin flag INVOICING → emite JUSTIFICANTES (J-), NO demo (sin watermark).
    //    plan='trial' + planExpiresAt lejano: SIN paywall y SIN banners (el único banner de la
    //    Parte L es past_due, que dejamos null). Ver informe para "Plan Pro" sin tocar el plan.
    const merchant = await tx.merchant.create({
      data: {
        name: 'Fontanería Torres',
        legalName: 'Fontanería Torres S.L.',
        email: OWNER_EMAIL,
        taxId: 'B87654321',                 // CIF formato válido, ficticio
        address: 'C/ del Fontanero 7, 28922 Alcorcón (Madrid)',
        trade: 'fontanero',
        country: 'ES',
        defaultCurrency: 'EUR',
        invoiceSeriesPrefix: 'FT',
        whatsappPhone: '34600000100',       // ficticio (no se envía nada en el seed)
        bizumPhone: '34600000100',
        iban: 'ES9121000418450200051332',   // formato válido, ficticio
        status: 'active',
        onboardingCompleted: true,
        plan: 'trial',
        planExpiresAt: daysFromNow(3650),   // +10 años → nunca expira → sin paywall/banner
        subscriptionStatus: null,           // sin banner past_due
        acquisitionSource: 'video-demo',
      },
    });
    counts.merchant = 1;
    if (merchant.id === 1) throw new Error('El merchant creado tomó id=1 (reservado al demo). Aborto.');
    const mid = merchant.id;

    // 1b) TeamMember (Equipo tiene pantalla) — 1 oficial activo.
    await tx.teamMember.create({
      data: { merchantId: mid, name: 'Rubén Torres', email: 'ruben.torres@example.com', role: 'tecnico', status: 'active' },
    });
    counts.teamMembers = 1;

    // 2) CLIENTES
    const customerIds = {};
    for (const c of CLIENTS) {
      const cust = await tx.customer.create({
        data: { merchantId: mid, name: c.name, phone: c.phone, email: c.email, notes: c.address },
      });
      customerIds[c.name] = cust.id;
      counts.customers++;
    }

    // 3) PROVEEDORES (Proveedores tiene pantalla) — 2.
    const prov1 = await tx.provider.create({ data: { merchantId: mid, name: 'Suministros Fontanería Sur S.L.', phone: '34600000201', email: 'ventas@example.com', notes: 'Almacén habitual — material sanitario' } });
    const prov2 = await tx.provider.create({ data: { merchantId: mid, name: 'Almacenes Hidráulica Madrid', phone: '34600000202', email: null, notes: 'Termos y calderas' } });
    counts.providers = 2;

    // 4) CATÁLOGO (Productos)
    const productByName = {};
    for (const p of CATALOG) {
      const prod = await tx.product.create({
        data: {
          merchantId: mid,
          name: p.name,
          nameSearch: p.name.toLowerCase(),
          price: p.price.toFixed(2),
          cost: p.cost != null ? p.cost.toFixed(2) : null,
          vat: p.vat.toFixed(4),
          providerId: (p.cost > 0 ? prov1.id : null),  // materiales → proveedor; mano de obra → sin proveedor
          isActive: true,
        },
      });
      productByName[p.name] = prod.id;
      counts.products++;
    }

    // 5) PRESUPUESTOS + (6) JOBS + INVOICES + CHARGES
    const quotesSpec = buildQuotes();
    const jobByKey = {};
    for (const q of quotesSpec) {
      const client = CLIENTS[q.clientIdx];
      const customerId = customerIds[client.name];
      const total = linesTotal(q.lines);
      const createdAt = daysAgo(q.createdAgo);
      const isDecided = q.status === 'accepted' || q.status === 'rejected';
      const decidedAt = q.decidedAgo != null ? daysAgo(q.decidedAgo) : null;

      // Numeración VIGENTE del código (no hardcodeada).
      const quoteNumber = await allocateQuoteNumber(tx, mid);

      const quote = await tx.quote.create({
        data: {
          merchantId: mid,
          customerId,
          quoteNumber,
          status: q.status,
          total: total.toFixed(2),
          currency: 'EUR',
          lines: q.lines,
          paymentTerms: q.paymentTerms ?? null,
          origin: 'manual',
          createdVia: 'text',
          validUntil: new Date(createdAt.getTime() + 30 * 86_400_000),
          createdAt,
          updatedAt: decidedAt ?? createdAt,
          acceptedAt: q.status === 'accepted' ? decidedAt : null,
          rejectedAt: q.status === 'rejected' ? decidedAt : null,
          decisionChannel: isDecided ? 'whatsapp' : null,
          rejectionReason: q.status === 'rejected' ? (q.rejectionReason ?? null) : null,
          // Evidencia + firma plausibles para los aceptados (coherente con el flujo real).
          signatureUrl: q.status === 'accepted' ? SAMPLE_SIGNATURE : null,
          evidence: q.status === 'accepted'
            ? { ts: decidedAt?.toISOString(), method: 'signature', channel: 'whatsapp', ua: 'seed/video' }
            : (q.status === 'rejected'
              ? { ts: decidedAt?.toISOString(), method: 'reject', channel: 'whatsapp' }
              : undefined),
        },
      });
      counts.quotes++;
      if (q.status === 'sent') awaitingAmount = round2(awaitingAmount + total);

      // Documentos de cobro (justificantes J-) + cobros, solo para ACEPTADOS con plan.
      if (q.status === 'accepted') {
        const plan = resolveBillingPlan({ paymentTerms: q.paymentTerms, customBillingPlan: null });
        const stageAmounts = distributeStageAmounts(total, plan); // reparto exacto (último tramo = resto)
        const isCustom = false;
        let cobradoJob = 0;

        for (let i = 0; i < q.stagesPaid.length; i++) {
          const stage = plan[i];
          const amount = stageAmounts[stage.index];
          const paid = q.stagesPaid[i];
          const paidAt = paid ? thisMonthDay(q.stagesPaidDay[i]) : null;
          const method = (i % 2 === 0) ? 'bizum' : 'transfer';

          // Cobro (Charge) en BD, estado ya resuelto (sin Stripe).
          const charge = await tx.charge.create({
            data: {
              merchantId: mid, customerId,
              concept: `${client.name} · ${q.key} (tramo ${i + 1}/${plan.length})`,
              amount: amount.toFixed(2), currency: 'EUR',
              method, status: paid ? 'paid' : 'pending',
              reference: paid ? `${method.toUpperCase()}-${quoteNumber}-${i + 1}` : null,
              createdAt, updatedAt: paidAt ?? createdAt,
            },
          });
          counts.charges++;

          // Justificante (Invoice). allocateInvoiceNumber → J- (merchant ES sin flag).
          // El nº lleva la fecha de emisión histórica (paidAt/createdAt).
          const emitAt = paidAt ?? createdAt;
          const invoiceNumber = await allocateInvoiceNumber(tx, mid, {}, emitAt);
          const scaled = stage.percentage < 1
            ? q.lines.map((l) => ({ ...l, price: round2(Number(l.price) * stage.percentage) }))
            : q.lines;
          await tx.invoice.create({
            data: {
              merchantId: mid, customerId, quoteId: quote.id, chargeId: charge.id,
              number: invoiceNumber,
              type: isReceiptNumber(invoiceNumber) ? 'JUST' : 'F1',
              total: amount.toFixed(2), currency: 'EUR',
              stageLabel: isCustom ? stage.label : null,
              lines: scaled,
              pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', registerId: null,
              status: paid ? 'paid' : 'pending',
              paidAt,
              createdAt: emitAt,
            },
          });
          counts.invoices++;
          if (paid) { collectedThisMonth = round2(collectedThisMonth + amount); cobradoJob = round2(cobradoJob + amount); }
          else pendingAmount = round2(pendingAmount + amount);
        }

        // JOB del presupuesto aceptado (FSM Parte L) — estado y fechas explícitos.
        const scheduledAt = q.job === 'agendado' ? daysFromNow(q.scheduledIn ?? 3)
          : (q.job === 'en_curso' ? daysAgo(2) : (q.job === 'terminado' || q.job === 'cerrado' ? daysAgo(q.decidedAgo - 2) : null));
        const job = await tx.job.create({
          data: {
            merchantId: mid, customerId, quoteId: quote.id,
            status: q.job,
            scheduledAt,
            titulo: `Presupuesto #${quoteNumber} · ${client.name}`,
            direccion: client.address,
            totalAceptado: total.toFixed(2),
            totalCobrado: cobradoJob.toFixed(2),
            createdAt, updatedAt: decidedAt ?? createdAt,
          },
        });
        jobByKey[q.key] = job;
        counts.jobs++;

        // CustomerEvents (timeline de la ficha 360) para los aceptados.
        await tx.customerEvent.create({ data: { merchantId: mid, customerId, type: 'quote_accepted', title: `Presupuesto #${quoteNumber} aceptado`, detail: 'Firmado digitalmente', createdAt: decidedAt ?? createdAt } });
        if (cobradoJob > 0) { await tx.customerEvent.create({ data: { merchantId: mid, customerId, type: 'payment_received', title: 'Pago recibido', detail: `${cobradoJob.toFixed(2)} EUR`, createdAt: thisMonthDay(10) } }); counts.customerEvents++; }
        counts.customerEvents++;
      }
    }

    // 7a) ALBARANES (pantalla en el detalle del Trabajo) — sobre los jobs terminado/en_curso.
    if (jobByKey['aseo']) {
      const j = jobByKey['aseo'];
      // Firmado (congelado)
      const numFirmado = await allocateAlbaranNumber(tx, mid);
      await tx.albaran.create({
        data: {
          merchantId: mid, jobId: j.id, numero: numFirmado, fecha: daysAgo(30),
          lineas: [
            { concepto: 'Retirada de aparatos y demolición de alicatado', cantidad: 1, unidad: 'jornada' },
            { concepto: 'Montaje de plato de ducha e inodoro', cantidad: 1, unidad: 'ud' },
          ],
          estado: 'firmado', version: 2, signatureUrl: SAMPLE_SIGNATURE, firmadoAt: daysAgo(29),
          notas: 'Primera fase de obra ejecutada. Conforme el cliente.', pdfUrl: null,
          createdAt: daysAgo(30), updatedAt: daysAgo(29),
        },
      });
      counts.albaranes++;
      // Borrador
      const numBorr = await allocateAlbaranNumber(tx, mid);
      await tx.albaran.create({
        data: {
          merchantId: mid, jobId: j.id, numero: numBorr, fecha: daysAgo(3),
          lineas: [{ concepto: 'Sellados y remates finales', cantidad: 1, unidad: 'jornada' }],
          estado: 'borrador', version: 1, notas: 'Pendiente de firma en la próxima visita.', pdfUrl: null,
          createdAt: daysAgo(3), updatedAt: daysAgo(3),
        },
      });
      counts.albaranes++;
    }
    if (jobByKey['fuga']) {
      const j = jobByKey['fuga'];
      const numEmit = await allocateAlbaranNumber(tx, mid);
      await tx.albaran.create({
        data: {
          merchantId: mid, jobId: j.id, numero: numEmit, fecha: daysAgo(1),
          lineas: [
            { concepto: 'Localización de fuga en bajante', cantidad: 1, unidad: 'ud' },
            { concepto: 'Sustitución de tramo de bajante', cantidad: 8, unidad: 'm' },
          ],
          estado: 'emitido', version: 1, notas: 'Trabajo en curso.', pdfUrl: null,
          createdAt: daysAgo(1), updatedAt: daysAgo(1),
        },
      });
      counts.albaranes++;
    }

    // 7b) GASTOS (Gastos tiene pantalla) — materiales/desplazamiento/herramientas/subcontrata.
    const expenses = [
      { concept: 'Compra de termos y grifería (pedido mensual)', amount: 520.0, category: 'materiales', providerId: prov2.id, date: thisMonthDay(6) },
      { concept: 'Combustible furgoneta', amount: 78.4, category: 'desplazamiento', providerId: null, date: thisMonthDay(9) },
      { concept: 'Alquiler máquina desatascadora', amount: 45.0, category: 'herramientas', providerId: null, date: daysAgo(12) },
      { concept: 'Material sanitario (reforma aseo)', amount: 610.0, category: 'materiales', providerId: prov1.id, date: daysAgo(35) },
      { concept: 'Subcontrata alicatado (reforma aseo)', amount: 300.0, category: 'subcontrata', providerId: null, date: daysAgo(34) },
    ];
    for (const e of expenses) {
      await tx.expense.create({ data: { merchantId: mid, concept: e.concept, amount: e.amount.toFixed(2), currency: 'EUR', category: e.category, providerId: e.providerId, date: e.date } });
      counts.expenses++;
    }

    // 7c) PLANTILLAS de presupuesto (Plantillas tiene pantalla) — 3.
    const templates = [
      { name: 'Cambio de termo 80L', paymentTerms: 'FULL_UPFRONT', lines: [L('Termo eléctrico 80L', 1), L('Instalación de termo (mano de obra)', 1), L('Retirada y transporte de aparato viejo', 1), L('Grupo de seguridad para termo', 1)] },
      { name: 'Desatasco con máquina', paymentTerms: 'FULL_UPFRONT', lines: [L('Desatasco con máquina eléctrica', 1), L('Desplazamiento (zona sur de Madrid)', 1)] },
      { name: 'Punto de agua nuevo', paymentTerms: 'FIFTY_FIFTY', lines: [L('Llave de paso 1/2"', 1), L('Mano de obra oficial de 1ª (hora)', 3), L('Desplazamiento (zona sur de Madrid)', 1)] },
    ];
    for (const t of templates) {
      await tx.quoteTemplate.create({ data: { merchantId: mid, name: t.name, currency: 'EUR', lines: t.lines, paymentTerms: t.paymentTerms } });
      counts.quoteTemplates++;
    }

    // 7d) SOLICITUDES (Solicitudes tiene pantalla) — 2 pendientes + 1 foto adjunta.
    const req1 = await tx.quoteRequest.create({ data: { merchantId: mid, customerId: customerIds['Ana Ruiz'], description: 'Tengo una fuga bajo el fregadero de la cocina, gotea al mueble. ¿Podéis venir esta semana?', status: 'pending', zone: 'Fuenlabrada', source: 'whatsapp_bot', createdAt: daysAgo(2) } });
    await tx.quoteRequest.create({ data: { merchantId: mid, customerId: customerIds['Juan Moreno'], description: 'El termo no da agua caliente y hace un ruido raro. Creo que hay que cambiarlo.', status: 'pending', zone: 'Getafe', source: 'whatsapp_bot', createdAt: daysAgo(1) } });
    counts.quoteRequests = 2;

    // Foto adjunta a la solicitud (la galería de Solicitudes muestra miniatura).
    const att = await tx.attachment.create({ data: { merchantId: mid, entityType: 'quote_request', entityId: req1.id, kind: 'photo', url: '', data: new Uint8Array(SAMPLE_PHOTO), mime: 'image/png' } });
    await tx.attachment.update({ where: { id: att.id }, data: { url: `/admin/attachments/${att.id}` } });
    counts.attachments = 1;

    return { mid };
  }, { timeout: 120_000, maxWait: 20_000 });

  return { counts, kpis: { collectedThisMonth, pendingAmount, awaitingAmount } };
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await preflight();
  console.log('\nSembrando "Fontanería Torres"…\n');
  const { counts, kpis } = await seed();

  console.log('✅ SEED COMPLETADO — conteos:');
  for (const [k, v] of Object.entries(counts)) console.log(`   ${k.padEnd(16)} ${v}`);
  console.log('\n📊 KPIs esperados en el Home (derivados, no hardcodeados):');
  console.log(`   Cobrado este mes   ~ ${kpis.collectedThisMonth.toFixed(2)} €`);
  console.log(`   Pendiente de cobro ~ ${kpis.pendingAmount.toFixed(2)} €`);
  console.log(`   En presupuestos vivos (esperando sí) ~ ${kpis.awaitingAmount.toFixed(2)} €`);
  console.log('\nSiguiente: verificación visual (ver checklist del PR). El presupuesto del termo 80L NO se sembró (escena en directo).\n');
}

main()
  .catch((e) => { console.error('\n❌ Error en el seed (transacción revertida, sin datos a medias):\n', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
