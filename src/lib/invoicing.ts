import { PrismaClient } from '@prisma/client';
import { nextInvoiceNumber } from './utils';
import { generateInvoicePdf } from './pdf';
import axios from 'axios';
import { BASE_URL, config } from '../config/env';

export async function ensureInvoiceForCharge(chargeId: number, prisma: PrismaClient) {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: { customer: true, merchant: true, events: true },
  });
  if (!charge) throw new Error('charge_not_found');
  if (charge.status !== 'paid') throw new Error(`charge_not_paid:${charge.status}`);

  // Evento 'invoiced' previo
  const prevInvEv = [...(charge.events || [])].reverse().find(e => e.type === 'invoiced' && (e as any).payload?.invoice_id);
  if (prevInvEv) {
    const existing = await prisma.invoice.findUnique({
      where: { id: (prevInvEv as any).payload.invoice_id as number },
    });
    if (existing) return existing;
  }

  // Desde quote → invoice previa
  const quote = await prisma.quote.findFirst({ where: { chargeId: charge.id } });
  if (quote) {
    const existing = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
    if (existing) return existing;
  }

  // Crear nueva
  const number = nextInvoiceNumber();

  const inv = await prisma.invoice.create({
    data: {
      merchantId: charge.merchantId,
      customerId: charge.customerId ?? (() => { throw new Error('missing_customer_in_charge'); })(),
      quoteId: quote?.id ?? null,
      number,
      total: charge.amount.toString(),
      currency: charge.currency.toUpperCase(),
      pdfUrl: `${BASE_URL}/invoices/${number}.pdf`,
      qrData: `INV:${number}|AMOUNT:${charge.amount.toString()}|CUR:${charge.currency}|REF:${charge.reference ?? ''}`,
    },
  });

  const merchant = await prisma.merchant.findUnique({ where: { id: inv.merchantId } });
  const customer = await prisma.customer.findUnique({ where: { id: inv.customerId } });
  if (!merchant || !customer) throw new Error('missing_merchant_or_customer');

  const pdf = await generateInvoicePdf({
    number: inv.number,
    merchant: { name: merchant.name },
    customer: { name: customer.name },
    currency: inv.currency,
    total: inv.total.toString(),
    qrData: inv.qrData,
  });

  const updated = await prisma.invoice.update({
    where: { id: inv.id },
    data: { pdfUrl: `${pdf.publicUrlPath}` },
  });

  await prisma.event.create({
    data: { chargeId: charge.id, type: 'invoiced', payload: { invoice_id: updated.id } as any },
  });

  return updated;
}

export async function emitToN8n(kind: 'paid' | 'failed' | 'expired', payload: any) {
  const map = {
    paid: config.N8N_ONPAID_URL,
    failed: config.N8N_ONFAILED_URL,
    expired: config.N8N_ONEXPIRED_URL,
  } as const;

  const url = map[kind];
  if (!url) return;
  try {
    await axios.post(url, payload, {
      headers: config.N8N_TOKEN ? { Authorization: `Bearer ${config.N8N_TOKEN}` } : undefined,
      timeout: 10_000,
    });
  } catch (e: any) {
    console.error(`[n8n emit ${kind}]`, e?.message || e);
  }
}
