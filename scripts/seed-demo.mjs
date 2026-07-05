/**
 * A6.1 — Cuenta demo IMPECABLE (sprint DEMO-READY EXT).
 *
 * Resetea y siembra el merchant DEMO (id=1, demo@yaqu.app — regla 8) con datos
 * bonitos y creíbles: "Fontanería García", 7 clientes, catálogo, 12 presupuestos
 * repartidos por estados, 4 cobros hechos (métodos variados) y 1 pendiente
 * (alimenta el "dinero en juego" de la Home). Idempotente: cada ejecución borra
 * SOLO los datos transaccionales del demo y los recrea igual.
 *
 * Uso:  node scripts/seed-demo.mjs        (aplica: es un script de reset)
 *
 * NO toca ningún otro merchant. Los teléfonos de los clientes son ficticios y
 * el guard V0-2 (DEMO_SAFE_NUMBERS) impide cualquier envío real desde el demo.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_ID = 1;

const now = new Date();
const daysAgo = (d, h = 10, m = 30) => {
  const t = new Date(now);
  t.setDate(t.getDate() - d);
  t.setHours(h, m, 0, 0);
  return t;
};

// Logo sencillo (SVG data-URI): gota + FG. En web se ve; en PDF cae al fallback.
const LOGO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44"><rect width="120" height="44" rx="10" fill="#0e7490"/><text x="14" y="29" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="bold" fill="#fff">💧 F. García</text></svg>`,
  ).toString('base64');

async function wipeDemo() {
  // Orden respetando FKs. Todo scoped al merchant demo.
  await prisma.customerEvent.deleteMany({ where: { merchantId: DEMO_ID } }).catch(() => {});
  await prisma.whatsAppMessage.deleteMany({ where: { merchantId: DEMO_ID } }).catch(() => {});
  await prisma.expense.deleteMany({ where: { merchantId: DEMO_ID } });
  await prisma.event.deleteMany({ where: { charge: { merchantId: DEMO_ID } } });
  await prisma.reconciliation.deleteMany({ where: { charge: { merchantId: DEMO_ID } } }).catch(() => {});
  await prisma.quoteRequest.deleteMany({ where: { merchantId: DEMO_ID } });
  await prisma.invoice.deleteMany({ where: { merchantId: DEMO_ID } });
  await prisma.quote.deleteMany({ where: { merchantId: DEMO_ID } });
  await prisma.charge.deleteMany({ where: { merchantId: DEMO_ID } });
  // Sesiones del bot de los teléfonos demo (ficticios, prefijo 6110000xx)
  await prisma.botSession.deleteMany({ where: { phone: { startsWith: '346110000' } } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { merchantId: DEMO_ID } });
  await prisma.product.deleteMany({ where: { merchantId: DEMO_ID } });
}

async function seed() {
  // ── Perfil del negocio demo ────────────────────────────────────────────
  await prisma.merchant.update({
    where: { id: DEMO_ID },
    data: {
      name: 'Fontanería García',
      legalName: 'Fontanería García S.L.',
      trade: 'fontanero',
      taxId: 'B87654321',
      address: 'Calle del Agua 12, 28005 Madrid',
      country: 'ES',
      defaultCurrency: 'EUR',
      invoiceSeriesPrefix: 'FG',
      invoiceSeriesYear: now.getFullYear(),
      nextInvoiceNumber: 6, // 5 facturas sembradas
      nextRectInvoiceNumber: 1,
      nextQuoteNumber: 13, // 12 presupuestos sembrados
      logoUrl: LOGO,
      iban: 'ES9121000418450200051332',
      googleReviewUrl: 'https://g.page/r/fontaneria-garcia/review',
    },
  });

  // ── Catálogo de fontanería ─────────────────────────────────────────────
  const productsData = [
    { name: 'Sustitución de grifo monomando', price: 65 },
    { name: 'Desatasco de tubería', price: 90 },
    { name: 'Instalación de termo eléctrico', price: 240 },
    { name: 'Cambio de cisterna completa', price: 85 },
    { name: 'Reparación de fuga de agua', price: 75 },
    { name: 'Instalación de lavabo con grifería', price: 160 },
    { name: 'Revisión general de fontanería', price: 45 },
    { name: 'Mano de obra (hora)', price: 35 },
  ];
  for (const p of productsData) {
    await prisma.product.create({
      data: { merchantId: DEMO_ID, name: p.name, price: p.price.toFixed(2) },
    });
  }

  // ── Clientes (teléfonos FICTICIOS 34611000xx — el guard V0-2 bloquea envíos) ──
  const customersData = [
    { name: 'María García',                     phone: '34611000001', email: 'maria.garcia@example.com' },
    { name: 'José Luis Martín',                 phone: '34611000002', email: 'jl.martin@example.com' },
    { name: 'Carmen Ruiz',                      phone: '34611000003', email: null },
    { name: 'Antonio López',                    phone: '34611000004', email: 'antoniolopez@example.com' },
    { name: 'Lucía Fernández',                  phone: '34611000005', email: 'lucia.f@example.com' },
    { name: 'Comunidad de Vecinos C/ Mayor 5',  phone: '34611000006', email: 'admin.mayor5@example.com' },
    { name: 'Bar El Rincón',                    phone: '34611000007', email: 'barelrincon@example.com' },
  ];
  const customers = [];
  for (const c of customersData) {
    customers.push(await prisma.customer.create({ data: { merchantId: DEMO_ID, ...c } }));
  }
  const [maria, joseluis, carmen, antonio, lucia, comunidad, bar] = customers;

  // ── Helper de líneas (IVA 21) ──────────────────────────────────────────
  const L = (concept, qty, price) => ({ concept, qty, price, tax: 0.21 });
  const total = (lines) =>
    Math.round(lines.reduce((s, l) => s + l.qty * l.price * 1.21, 0) * 100) / 100;

  let qn = 0; // quoteNumber correlativo del demo
  async function quote({ customer, lines, status, createdDaysAgo, terms = 'FULL_UPFRONT', extra = {} }) {
    qn += 1;
    const t = total(lines);
    return prisma.quote.create({
      data: {
        merchantId: DEMO_ID,
        customerId: customer.id,
        quoteNumber: qn,
        status,
        total: t.toFixed(2),
        currency: 'EUR',
        lines,
        paymentTerms: terms,
        createdVia: 'text',
        createdAt: daysAgo(createdDaysAgo),
        updatedAt: daysAgo(createdDaysAgo),
        ...extra,
      },
    });
  }

  // Cobro pagado + factura pagada ligados a un quote aceptado
  let invoiceSeq = 0;
  async function paidJob(q, customer, method, paidDaysAgo) {
    invoiceSeq += 1;
    const number = `${now.getFullYear()}-FG-${String(invoiceSeq).padStart(3, '0')}`;
    const charge = await prisma.charge.create({
      data: {
        merchantId: DEMO_ID,
        customerId: customer.id,
        concept: `Factura ${number}`,
        amount: q.total,
        currency: 'EUR',
        method,
        status: 'paid',
        createdAt: daysAgo(paidDaysAgo, 12),
        events: {
          create: [
            { type: 'created', ts: daysAgo(paidDaysAgo, 12), payload: {} },
            { type: 'paid', ts: daysAgo(paidDaysAgo, 18), payload: { method } },
          ],
        },
      },
    });
    await prisma.invoice.create({
      data: {
        merchantId: DEMO_ID,
        customerId: customer.id,
        quoteId: q.id,
        chargeId: charge.id,
        number,
        type: 'F1',
        status: 'paid',
        paidAt: daysAgo(paidDaysAgo, 18),
        total: q.total,
        currency: 'EUR',
        lines: q.lines,
        pdfUrl: 'PENDING_PDF', // se regenera bajo demanda (con watermark DEMO)
        qrData: 'PENDING_QR',
        createdAt: daysAgo(paidDaysAgo, 12),
      },
    });
    await prisma.quote.update({ where: { id: q.id }, data: { chargeId: charge.id } });
    await prisma.customerEvent.create({
      data: {
        merchantId: DEMO_ID, customerId: customer.id, type: 'payment_received',
        title: 'Pago recibido', detail: `${q.total} EUR · Factura ${number}`,
        createdAt: daysAgo(paidDaysAgo, 18),
      },
    }).catch(() => {});
    return charge;
  }

  // ── 12 presupuestos, estados repartidos, importes 180–2.400 € ──────────
  // 4 ACEPTADOS + COBRADOS (métodos variados)
  // Fechas de cobro: 2 del mes pasado (historial) + 2 de ESTE mes, para que
  // "Cobrado este mes" de la Home nunca salga a 0 en demo.
  const q1 = await quote({ customer: maria,     createdDaysAgo: 20, status: 'accepted', extra: { acceptedAt: daysAgo(19), decisionChannel: 'whatsapp', decisionComment: 'Aceptado con firma digital' }, lines: [L('Sustitución de grifo monomando (cocina)', 1, 65), L('Reparación de fuga bajo fregadero', 1, 75), L('Mano de obra adicional', 1, 35)] });
  await paidJob(q1, maria, 'card', 18);
  const q2 = await quote({ customer: bar,       createdDaysAgo: 16, status: 'accepted', extra: { acceptedAt: daysAgo(15), decisionChannel: 'whatsapp' }, lines: [L('Desatasco de tubería principal', 1, 90), L('Revisión general de fontanería', 1, 45), L('Mano de obra (hora)', 2, 35)] });
  await paidJob(q2, bar, 'bizum_manual', 14);
  const q3 = await quote({ customer: comunidad, createdDaysAgo: 6, status: 'accepted', extra: { acceptedAt: daysAgo(5), decisionChannel: 'whatsapp', decisionComment: 'Aprobado en junta' }, lines: [L('Instalación de termo eléctrico 100L', 2, 240), L('Sustitución de llaves de corte', 4, 28), L('Mano de obra (hora)', 6, 35)] });
  await paidJob(q3, comunidad, 'transfer', Math.min(4, now.getDate() - 1));
  const q4 = await quote({ customer: antonio,   createdDaysAgo: 5,  status: 'accepted', extra: { acceptedAt: daysAgo(4), decisionChannel: 'whatsapp' }, lines: [L('Instalación de lavabo con grifería', 1, 160), L('Cambio de cisterna completa', 1, 85)] });
  await paidJob(q4, antonio, 'card', Math.min(2, Math.max(0, now.getDate() - 2)));

  // 1 ACEPTADO con COBRO PENDIENTE (el "dinero en juego" nº1)
  const q5 = await quote({ customer: lucia, createdDaysAgo: 4, status: 'accepted', extra: { acceptedAt: daysAgo(3), decisionChannel: 'whatsapp', decisionComment: 'Firmado desde el móvil' }, lines: [L('Reforma de baño: fontanería completa', 1, 1650), L('Instalación de plato de ducha', 1, 320)] });
  {
    invoiceSeq += 1;
    const number = `${now.getFullYear()}-FG-${String(invoiceSeq).padStart(3, '0')}`;
    const charge = await prisma.charge.create({
      data: {
        merchantId: DEMO_ID, customerId: lucia.id,
        concept: `Factura ${number}`, amount: q5.total, currency: 'EUR',
        method: 'card', status: 'pending', createdAt: daysAgo(3, 12),
        payMethods: ['card', 'bizum', 'transfer'],
        events: { create: [{ type: 'created', ts: daysAgo(3, 12), payload: {} }] },
      },
    });
    await prisma.invoice.create({
      data: {
        merchantId: DEMO_ID, customerId: lucia.id, quoteId: q5.id, chargeId: charge.id,
        number, type: 'F1', status: 'pending', total: q5.total, currency: 'EUR',
        lines: q5.lines, pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', createdAt: daysAgo(3, 12),
      },
    });
    await prisma.quote.update({ where: { id: q5.id }, data: { chargeId: charge.id } });
  }

  // 1 ACEPTADO sin facturar aún (CTA "Cobrar ahora" en demo)
  await quote({ customer: carmen, createdDaysAgo: 2, status: 'accepted', extra: { acceptedAt: daysAgo(1), decisionChannel: 'whatsapp' }, lines: [L('Cambio de bajante de cocina', 1, 380), L('Mano de obra (hora)', 3, 35)] });

  // 3 ENVIADOS (esperando el sí — alimentan el héroe)
  await quote({ customer: joseluis,  createdDaysAgo: 3, status: 'sent', lines: [L('Instalación de descalcificador', 1, 690), L('Mano de obra (hora)', 3, 35)] });
  await quote({ customer: maria,     createdDaysAgo: 1, status: 'sent', lines: [L('Cambio de radiador toallero', 1, 210), L('Purga de radiadores (vivienda)', 1, 60)] });
  await quote({ customer: bar,       createdDaysAgo: 0, status: 'sent', lines: [L('Renovación de fontanería de barra', 1, 1980), L('Instalación de lavavajillas industrial', 1, 420)] });

  // 1 RECHAZADO (con motivo real — se enseña el manejo digno)
  await quote({ customer: antonio, createdDaysAgo: 10, status: 'rejected', extra: { rejectedAt: daysAgo(9), decisionChannel: 'whatsapp', rejectionReason: 'Me lo hace un conocido', decisionComment: 'Gracias de todas formas' }, lines: [L('Instalación de osmosis inversa', 1, 340)] });

  // 2 BORRADORES (para enseñar "Enviar por WhatsApp" desde el detalle)
  await quote({ customer: lucia,  createdDaysAgo: 0, status: 'draft', lines: [L('Revisión general de fontanería', 1, 45), L('Cambio de latiguillos', 4, 12)] });
  await quote({ customer: carmen, createdDaysAgo: 0, status: 'draft', terms: 'FIFTY_FIFTY', lines: [L('Instalación de bomba de presión', 1, 480), L('Mano de obra (hora)', 2, 35)] });

  // Un par de eventos extra para que las fichas respiren
  await prisma.customerEvent.create({
    data: { merchantId: DEMO_ID, customerId: maria.id, type: 'feedback', title: '⭐ 5/5 — valoración del cliente tras el cobro', detail: 'Rápido y muy limpio. Repetiré.', createdAt: daysAgo(17) },
  }).catch(() => {});
  await prisma.customerEvent.create({
    data: { merchantId: DEMO_ID, customerId: bar.id, type: 'quote_requested', title: 'Solicitud de presupuesto por WhatsApp (bot)', detail: 'Gotera en el almacén · Zona: Centro', createdAt: daysAgo(5) },
  }).catch(() => {});
}

console.log('A6.1 · Reseteando y sembrando el merchant DEMO (id=1)…');
await wipeDemo();
await seed();

const counts = {
  clientes: await prisma.customer.count({ where: { merchantId: DEMO_ID } }),
  productos: await prisma.product.count({ where: { merchantId: DEMO_ID } }),
  presupuestos: await prisma.quote.count({ where: { merchantId: DEMO_ID } }),
  facturas: await prisma.invoice.count({ where: { merchantId: DEMO_ID } }),
  cobros: await prisma.charge.count({ where: { merchantId: DEMO_ID } }),
};
console.log('Sembrado ✅', counts);
await prisma.$disconnect();
