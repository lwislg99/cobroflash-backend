// src/modules/messaging/domain/weeklyDigest.service.ts
// Resumen semanal por email: se envía los lunes a las 9h.
import axios from 'axios';
import { prisma } from '../../../core/db/prisma';
import { createMailer } from '../../../integrations/mailer';
import { config } from '../../../core/config/env';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!to || !to.includes('@')) return;
  if (config.RESEND_API_KEY) {
    await axios.post(
      'https://api.resend.com/emails',
      { from: config.EMAIL_FROM, to: [to], subject, html },
      { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10_000 }
    );
    return;
  }
  if (config.SMTP_URL) {
    const mailer = createMailer();
    await mailer.sendMail({ from: config.EMAIL_FROM, to, subject, html });
  }
}

function fmt(n: number, currency = '') {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (currency ? ' ' + currency : '');
}

export async function sendWeeklyDigests(): Promise<void> {
  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  weekAgo.setHours(0, 0, 0, 0);

  // Solo merchants activos con email y digest activado
  const merchants = await prisma.merchant.findMany({
    where: {
      status: 'active',
      notifyEmailWeeklyDigest: true,
      email: { not: null },
    },
    select: {
      id: true, name: true, email: true, defaultCurrency: true,
    },
  });

  if (!merchants.length) return;
  console.log(`[weeklyDigest] Enviando ${merchants.length} resumen(es)…`);

  for (const merchant of merchants) {
    try {
      await sendDigestForMerchant(merchant, weekAgo, now);
    } catch (e: any) {
      console.error(`[weeklyDigest] Error merchant ${merchant.id}:`, e?.message);
    }
  }
}

async function sendDigestForMerchant(
  merchant: { id: number; name: string; email: string | null; defaultCurrency: string },
  from: Date,
  to: Date,
): Promise<void> {
  if (!merchant.email) return;

  const [paidInvoices, newInvoices, acceptedQuotes, newQuotes, newCustomers, pendingInvoices] = await Promise.all([
    // Facturas cobradas esta semana
    prisma.invoice.aggregate({
      where: { merchantId: merchant.id, status: 'paid', paidAt: { gte: from, lte: to } },
      _sum: { total: true }, _count: { id: true },
    }),
    // Facturas emitidas
    prisma.invoice.count({ where: { merchantId: merchant.id, createdAt: { gte: from, lte: to } } }),
    // Presupuestos aceptados
    prisma.quote.count({ where: { merchantId: merchant.id, status: 'accepted', acceptedAt: { gte: from, lte: to } } }),
    // Presupuestos enviados
    prisma.quote.count({ where: { merchantId: merchant.id, createdAt: { gte: from, lte: to } } }),
    // Clientes nuevos
    prisma.customer.count({ where: { merchantId: merchant.id, createdAt: { gte: from, lte: to } } }),
    // Facturas pendientes acumuladas
    prisma.invoice.aggregate({
      where: { merchantId: merchant.id, status: 'pending' },
      _sum: { total: true }, _count: { id: true },
    }),
  ]);

  const cobrado   = Number(paidInvoices._sum.total ?? 0);
  const pendiente = Number(pendingInvoices._sum.total ?? 0);
  const currency  = merchant.defaultCurrency || 'EUR';

  const weekStr = `${from.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${new Date(to.getTime() - 1).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const subject = `📊 Tu semana en YaQu (${weekStr})`;

  const statRow = (label: string, value: string, color = '#0f172a') =>
    `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9">${label}</td>
     <td style="padding:8px 0;text-align:right;font-weight:700;font-size:13px;color:${color};border-bottom:1px solid #f1f5f9">${value}</td></tr>`;

  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#22c55e;font-weight:800;font-size:18px">YaQu</span>
    <span style="color:#64748b;font-size:13px;margin-left:8px">Resumen semanal</span>
  </div>
  <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800">¡Hola, ${merchant.name}! 👋</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">${weekStr}</p>

    <div style="background:#fff;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:12px">Esta semana</div>
      <table style="width:100%;border-collapse:collapse">
        ${statRow('💰 Cobrado', fmt(cobrado, currency), cobrado > 0 ? '#16a34a' : '#0f172a')}
        ${statRow('🧾 Facturas emitidas', String(newInvoices))}
        ${statRow('✅ Presupuestos aceptados', String(acceptedQuotes), acceptedQuotes > 0 ? '#16a34a' : '#0f172a')}
        ${statRow('📋 Presupuestos enviados', String(newQuotes))}
        ${statRow('👤 Clientes nuevos', String(newCustomers))}
      </table>
    </div>

    ${pendiente > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#92400e">⏳ Pendiente de cobro</div>
      <div style="font-size:20px;font-weight:800;color:#92400e;margin-top:4px">${fmt(pendiente, currency)}</div>
      <div style="font-size:12px;color:#78350f;margin-top:2px">${pendingInvoices._count.id} factura${pendingInvoices._count.id !== 1 ? 's' : ''} sin cobrar</div>
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:16px;text-align:center;color:#166534;font-weight:600;font-size:13px">
      ✅ ¡No tienes facturas pendientes de cobro!
    </div>`}

    <div style="text-align:center;margin-top:8px">
      <a href="${config.PUBLIC_BASE_URL}/dashboard/" style="display:inline-block;background:#22c55e;color:#052e16;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
        Abrir YaQu →
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;margin:16px 0 0;text-align:center">
      Para desactivar este resumen ve a Configuración → Notificaciones.
    </p>
  </div>
</div>`;

  await sendEmail(merchant.email, subject, html);
  console.log(`[weeklyDigest] ✓ enviado a ${merchant.email}`);
}

// Generar preview del digest para un merchant (sin enviar)
export async function getDigestPreview(merchantId: number): Promise<{ subject: string; stats: object }> {
  const now     = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  weekAgo.setHours(0, 0, 0, 0);

  const [paidInvoices, newInvoices, acceptedQuotes, newQuotes, newCustomers, pendingInvoices] = await Promise.all([
    prisma.invoice.aggregate({ where: { merchantId, status: 'paid', paidAt: { gte: weekAgo } }, _sum: { total: true }, _count: { id: true } }),
    prisma.invoice.count({ where: { merchantId, createdAt: { gte: weekAgo } } }),
    prisma.quote.count({ where: { merchantId, status: 'accepted', acceptedAt: { gte: weekAgo } } }),
    prisma.quote.count({ where: { merchantId, createdAt: { gte: weekAgo } } }),
    prisma.customer.count({ where: { merchantId, createdAt: { gte: weekAgo } } }),
    prisma.invoice.aggregate({ where: { merchantId, status: 'pending' }, _sum: { total: true }, _count: { id: true } }),
  ]);

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { defaultCurrency: true } });

  return {
    subject: `📊 Tu semana en YaQu`,
    stats: {
      cobrado:          { amount: Number(paidInvoices._sum.total ?? 0), count: paidInvoices._count.id, currency: merchant?.defaultCurrency || 'EUR' },
      facturasEmitidas: newInvoices,
      presupuestosAceptados: acceptedQuotes,
      presupuestosEnviados:  newQuotes,
      clientesNuevos: newCustomers,
      pendiente:       { amount: Number(pendingInvoices._sum.total ?? 0), count: pendingInvoices._count.id, currency: merchant?.defaultCurrency || 'EUR' },
    },
  };
}
