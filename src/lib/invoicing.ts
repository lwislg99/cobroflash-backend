// src/lib/invoicing.ts
import { PrismaClient } from '@prisma/client';
import { nextInvoiceNumber } from '../core/utils/utils';
import { generateInvoicePdf } from './pdf';
import { BASE_URL } from '../core/config/env';
import { applyVeriFactu } from '../modules/invoicing/domain/verifactu.service';

export async function ensureInvoiceForCharge(
  chargeId: number,
  prisma: PrismaClient,
) {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: { customer: true, merchant: true, events: true },
  });

  if (!charge) throw new Error('charge_not_found');
  if (charge.status !== 'paid') throw new Error(`charge_not_paid:${charge.status}`);

  const ch: any = charge;

  async function ensurePdfAndEvent(inv: any, chargeParam: any) {
    const alreadyInvoiced = (chargeParam.events || []).some(
      (e: any) => e.type === 'invoiced' && e.payload?.invoice_id === inv.id,
    );

    // Aplicar VeriFactu si es merchant español con NIF — antes de generar PDF
    let qrData: string = inv.qrData && !String(inv.qrData).startsWith('PENDING')
      ? inv.qrData
      : `INV:${inv.number}|AMOUNT:${inv.total.toString()}|CUR:${inv.currency}|REF:${chargeParam.reference ?? ''}`;

    let vfHash: string | null = inv.vfHash ?? null;

    const merchant = await prisma.merchant.findUnique({ where: { id: inv.merchantId } });

    if (merchant?.country === 'ES' && merchant.taxId && !vfHash) {
      try {
        const vf = await applyVeriFactu(inv, merchant.taxId, prisma);
        qrData  = vf.qrUrl;
        vfHash  = vf.vfHash;
        // inv.qrData updated in DB by applyVeriFactu
      } catch (e) {
        console.error('[verifactu] Error al aplicar VeriFactu, se omite:', e);
      }
    }

    const needsPdf =
      !inv.pdfUrl ||
      inv.pdfUrl === 'PENDING_PDF' ||
      String(inv.pdfUrl).startsWith('PENDING');

    let updated = inv;

    if (needsPdf) {
      const customer = await prisma.customer.findUnique({ where: { id: inv.customerId } });
      if (!merchant || !customer) throw new Error('missing_merchant_or_customer');

      const invLines = inv.lines && Array.isArray(inv.lines) ? inv.lines as any[] : [];

      const pdf = await generateInvoicePdf({
        number: inv.number,
        merchant: {
          name: merchant.name,
          legalName: merchant.legalName,
          taxId: merchant.taxId,
          address: merchant.address,
        },
        customer: { name: customer.name, email: (customer as any).email, phone: (customer as any).phone },
        currency: inv.currency,
        total: inv.total.toString(),
        qrData,
        vfHash,
        createdAt: inv.createdAt,
        lines: invLines,
      });

      updated = await prisma.invoice.update({
        where: { id: inv.id },
        data: { pdfUrl: pdf.publicUrlPath, qrData },
      });
    } else if (qrData !== inv.qrData) {
      updated = await prisma.invoice.update({ where: { id: inv.id }, data: { qrData } });
    }

    if (!alreadyInvoiced) {
      await prisma.event.create({
        data: {
          chargeId: chargeParam.id,
          type: 'invoiced',
          payload: { invoice_id: updated.id } as any,
        },
      });
    }

    return updated;
  }

  // 1) Evento 'invoiced' previo con invoice_id
  const prevInvEv = [...(ch.events || [])].reverse().find(
    (e: any) => e.type === 'invoiced' && e.payload?.invoice_id,
  );
  if (prevInvEv) {
    const existing = await prisma.invoice.findUnique({ where: { id: prevInvEv.payload.invoice_id as number } });
    if (existing) return ensurePdfAndEvent(existing, ch);
  }

  // 2) Quote ligado al charge → factura existente
  const quote = await prisma.quote.findFirst({ where: { chargeId: ch.id } });
  if (quote) {
    const existing = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
    if (existing) return ensurePdfAndEvent(existing, ch);
  }

  // 3) Nueva factura desde el charge
  const number = nextInvoiceNumber();

  // Líneas: desde el quote si existe; si no, línea única del charge
  const quoteLines = quote
    ? await prisma.quote.findUnique({ where: { id: quote.id }, select: { lines: true } })
    : null;
  const invoiceLines: any[] = quoteLines && Array.isArray(quoteLines.lines) && (quoteLines.lines as any[]).length > 0
    ? (quoteLines.lines as any[])
    : [{ concept: ch.concept, qty: 1, price: Number(ch.amount), tax: 0 }];

  const inv = await prisma.invoice.create({
    data: {
      merchantId: ch.merchantId,
      customerId: ch.customerId ?? (() => { throw new Error('missing_customer_in_charge'); })(),
      quoteId: quote?.id ?? null,
      number,
      total: ch.amount.toString(),
      currency: ch.currency.toUpperCase(),
      lines: invoiceLines,
      pdfUrl: `${BASE_URL}/invoices/${number}.pdf`,
      qrData: `INV:${number}|AMOUNT:${ch.amount.toString()}|CUR:${ch.currency}|REF:${ch.reference ?? ''}`,
    },
  });

  return ensurePdfAndEvent(inv, ch);
}
