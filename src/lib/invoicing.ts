// src/lib/invoicing.ts
import { PrismaClient } from '@prisma/client';
import { nextInvoiceNumber } from '../core/utils/utils';
import { generateInvoicePdf } from './pdf';
import { BASE_URL } from '../core/config/env';

export async function ensureInvoiceForCharge(
  chargeId: number,
  prisma: PrismaClient,
) {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: { customer: true, merchant: true, events: true },
  });

  if (!charge) {
    throw new Error('charge_not_found');
  }
  if (charge.status !== 'paid') {
    throw new Error(`charge_not_paid:${charge.status}`);
  }

  const ch: any = charge; // variable “segura” para usar en helpers

  // Helper interno: asegura PDF real + evento `invoiced`
  async function ensurePdfAndEvent(inv: any, chargeParam: any) {
    // ¿Ya hay evento 'invoiced' para esta factura?
    const alreadyInvoiced = (chargeParam.events || []).some(
      (e: any) =>
        e.type === 'invoiced' &&
        e.payload?.invoice_id === inv.id,
    );

    // ¿El QR está “de verdad” o es placeholder?
    let qrData: string =
      inv.qrData && !String(inv.qrData).startsWith('PENDING')
        ? inv.qrData
        : `INV:${inv.number}|AMOUNT:${inv.total.toString()}|CUR:${
            inv.currency
          }|REF:${chargeParam.reference ?? ''}`;

    // ¿Necesitamos generar PDF?
    const needsPdf =
      !inv.pdfUrl ||
      inv.pdfUrl === 'PENDING_PDF' ||
      String(inv.pdfUrl).startsWith('PENDING');

    let updated = inv;

    if (needsPdf) {
      const merchant = await prisma.merchant.findUnique({
        where: { id: inv.merchantId },
      });
      const customer = await prisma.customer.findUnique({
        where: { id: inv.customerId },
      });

      if (!merchant || !customer) {
        throw new Error('missing_merchant_or_customer');
      }

      const pdf = await generateInvoicePdf({
        number: inv.number,
        merchant: { name: merchant.name },
        customer: { name: customer.name },
        currency: inv.currency,
        total: inv.total.toString(),
        qrData,
      });

      updated = await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          pdfUrl: pdf.publicUrlPath, // p.ej. /invoices/CF-INV-202511-XXXX.pdf
          qrData,
        },
      });
    } else if (qrData !== inv.qrData) {
      // Ya tenía PDF pero QR placeholder → solo actualizamos QR
      updated = await prisma.invoice.update({
        where: { id: inv.id },
        data: { qrData },
      });
    }

    // Si aún no hay evento 'invoiced', lo creamos ahora
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

  // 1) ¿Hay evento 'invoiced' previo con invoice_id?
  const prevInvEv = [...(ch.events || [])]
    .reverse()
    .find(
      (e: any) =>
        e.type === 'invoiced' &&
        e.payload?.invoice_id,
    );

  if (prevInvEv) {
    const existing = await prisma.invoice.findUnique({
      where: {
        id: prevInvEv.payload.invoice_id as number,
      },
    });
    if (existing) {
      return ensurePdfAndEvent(existing, ch);
    }
  }

  // 2) ¿Hay un quote ligado a este charge → factura existente?
  const quote = await prisma.quote.findFirst({
    where: { chargeId: ch.id },
  });

  if (quote) {
    const existing = await prisma.invoice.findFirst({
      where: { quoteId: quote.id },
    });
    if (existing) {
      return ensurePdfAndEvent(existing, ch);
    }
  }

  // 3) No hay factura previa → creamos una nueva desde el charge
  const number = nextInvoiceNumber();

  const inv = await prisma.invoice.create({
    data: {
      merchantId: ch.merchantId,
      customerId:
        ch.customerId ??
        (() => {
          throw new Error('missing_customer_in_charge');
        })(),
      quoteId: quote?.id ?? null,
      number,
      total: ch.amount.toString(),
      currency: ch.currency.toUpperCase(),
      // Valor inicial; luego ensurePdfAndEvent generará el PDF real
      pdfUrl: `${BASE_URL}/invoices/${number}.pdf`,
      qrData: `INV:${number}|AMOUNT:${ch.amount.toString()}|CUR:${ch.currency}|REF:${
        ch.reference ?? ''
      }`,
    },
  });

  return ensurePdfAndEvent(inv, ch);
}
