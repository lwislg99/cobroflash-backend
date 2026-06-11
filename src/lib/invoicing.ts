// src/lib/invoicing.ts
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { allocateInvoiceNumber, isReceiptNumber } from '../modules/invoicing/domain/invoiceNumber.service';
import { isDemoMerchant, DEMO_WATERMARK } from '../modules/invoicing/domain/emission.service';
import { generateInvoicePdf } from './pdf';
import { BASE_URL } from '../core/config/env';
import { invoicesDir } from '../core/storage/dirs';
import { applyVeriFactu } from '../modules/invoicing/domain/verifactu.service';

/**
 * Asegura que el PDF de una factura existe en disco (genera bajo demanda si está
 * en PENDING_PDF o si el fichero se perdió — el fs de Railway es efímero) y
 * devuelve la ruta en disco + la URL pública. Reutilizado por "Abrir PDF"
 * (GET /admin/invoices/:id/pdf) y por el email de factura.
 */
export async function ensureInvoicePdf(
  invoiceId: number,
  prisma: PrismaClient,
): Promise<{ diskPath: string; pdfUrl: string; number: string }> {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { merchant: true, customer: true, rectifies: { select: { number: true } } },
  });
  if (!inv) throw new Error('invoice_not_found');
  if (!inv.merchant || !inv.customer) throw new Error('missing_relations');

  const fileName = `${inv.number}.pdf`;
  const diskPath = path.join(invoicesDir, fileName);
  const publicUrlPath = `/invoices/${fileName}`;

  const needs =
    !inv.pdfUrl ||
    inv.pdfUrl === 'PENDING_PDF' ||
    String(inv.pdfUrl).startsWith('PENDING') ||
    !fs.existsSync(diskPath);

  if (needs) {
    let qrData =
      inv.qrData && !String(inv.qrData).startsWith('PENDING')
        ? inv.qrData
        : `INV:${inv.number}|AMOUNT:${inv.total.toString()}|CUR:${inv.currency}`;
    let vfHash = inv.vfHash ?? null;

    // V0-0: los justificantes (J-…) no llevan VeriFactu
    if (inv.merchant.country === 'ES' && inv.merchant.taxId && !vfHash && !isReceiptNumber(inv.number)) {
      try {
        const vf = await applyVeriFactu(inv, inv.merchant.taxId, prisma);
        qrData = vf.qrUrl;
        vfHash = vf.vfHash;
      } catch (e) {
        console.error('[ensureInvoicePdf] VeriFactu error:', e);
      }
    }

    const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
    await generateInvoicePdf({
      number: inv.number,
      merchant: {
        name: inv.merchant.name,
        legalName: inv.merchant.legalName,
        taxId: inv.merchant.taxId,
        address: inv.merchant.address,
        logoUrl: inv.merchant.logoUrl,
      },
      customer: { name: inv.customer.name, email: inv.customer.email, phone: inv.customer.phone },
      currency: inv.currency,
      total: inv.total.toString(),
      qrData,
      vfHash,
      createdAt: inv.createdAt,
      lines,
      type: inv.type,
      rectifiesNumber: inv.rectifies?.number ?? null,
      watermark: isDemoMerchant(inv.merchant) ? DEMO_WATERMARK : null,
    });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: publicUrlPath, qrData } });
  }

  return { diskPath, pdfUrl: publicUrlPath, number: inv.number };
}

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

    if (merchant?.country === 'ES' && merchant.taxId && !vfHash && !isReceiptNumber(inv.number)) {
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
          logoUrl: merchant.logoUrl,
        },
        customer: { name: customer.name, email: (customer as any).email, phone: (customer as any).phone },
        currency: inv.currency,
        total: inv.total.toString(),
        qrData,
        vfHash,
        createdAt: inv.createdAt,
        lines: invLines,
        type: inv.type,
        watermark: merchant && isDemoMerchant(merchant) ? DEMO_WATERMARK : null,
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

  // 3) Nueva factura desde el charge — número de la serie anual del merchant

  // Líneas: desde el quote si existe; si no, línea única del charge
  const quoteLines = quote
    ? await prisma.quote.findUnique({ where: { id: quote.id }, select: { lines: true } })
    : null;
  const invoiceLines: any[] = quoteLines && Array.isArray(quoteLines.lines) && (quoteLines.lines as any[]).length > 0
    ? (quoteLines.lines as any[])
    : [{ concept: ch.concept, qty: 1, price: Number(ch.amount), tax: 0 }];

  const inv = await prisma.$transaction(async (tx) => {
    const number = await allocateInvoiceNumber(tx, ch.merchantId);
    return tx.invoice.create({
      data: {
        merchantId: ch.merchantId,
        customerId: ch.customerId ?? (() => { throw new Error('missing_customer_in_charge'); })(),
        quoteId: quote?.id ?? null,
        number,
        type: isReceiptNumber(number) ? 'JUST' : 'F1', // V0-0: justificante si ES real sin flag
        total: ch.amount.toString(),
        currency: ch.currency.toUpperCase(),
        lines: invoiceLines,
        pdfUrl: `${BASE_URL}/invoices/${number}.pdf`,
        qrData: `INV:${number}|AMOUNT:${ch.amount.toString()}|CUR:${ch.currency}|REF:${ch.reference ?? ''}`,
      },
    });
  });

  return ensurePdfAndEvent(inv, ch);
}
