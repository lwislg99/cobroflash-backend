// src/lib/invoicing.ts
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { allocateInvoiceNumber, isReceiptNumber } from '../modules/invoicing/domain/invoiceNumber.service';
import { recordAudit, sobreFiscal, flagsFiscalesDe, type ActorAudit } from '../modules/system/audit.service'; // SCRUM-207
import { isDemoMerchant, DEMO_WATERMARK } from '../modules/invoicing/domain/emission.service';
import { generateInvoicePdf } from './pdf';
import { invoicesDir } from '../core/storage/dirs';
import { applyVeriFactu } from '../modules/invoicing/domain/verifactu.service';
import { exigirDocumentoEmitible, FacturaSinSellarError } from '../modules/invoicing/domain/portonDocumento'; // SCRUM-206

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

  // SCRUM-72: fichero en storage/invoices con prefijo de merchant (la serie es única POR
  // merchant: sin prefijo, dos merchants con "2026-CF-001" se pisaban el PDF) y `pdfUrl`
  // apuntando al endpoint AUTENTICADO, no a un estático público.
  const fileName = `${inv.merchantId}-${inv.number}.pdf`;
  const diskPath = path.join(invoicesDir, fileName);
  const publicUrlPath = `/admin/invoices/${inv.id}/pdf`;

  const needs =
    !inv.pdfUrl ||
    inv.pdfUrl === 'PENDING_PDF' ||
    String(inv.pdfUrl).startsWith('PENDING') ||
    // D4: `pdfUrl` legacy (estático `/invoices/...` o URL absoluta con BASE_URL) NO se
    // considera válido — se regenera con el esquema nuevo en vez de confiar en el valor.
    inv.pdfUrl !== publicUrlPath ||
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
      } catch (e: any) {
        // SCRUM-206: el `catch` sigue REGISTRANDO —eso lo trajo SCRUM-207 (A6) y se queda— pero
        // ya NO deja pasar. «Preferir no sellar antes que sellar mal» seguía siendo correcto; lo
        // que estaba mal era lo de después, que entregaba el documento igual.
        console.error('[ensureInvoicePdf] VeriFactu error:', e);
        recordAudit({
          merchantId: inv.merchantId,
          action: 'sellado_fallido', entityType: 'invoice', entityId: inv.id,
          meta: sobreFiscal({
            actor: { tipo: 'sistema', ref: 'ensureInvoicePdf' },
            flagsFiscales: flagsFiscalesDe(inv.merchant),
            payload: {
              numero: inv.number,
              errorMensaje: String(e?.message ?? e).slice(0, 300),
              puntoDeFallo: 'ensureInvoicePdf',
              // SCRUM-206: antes decía `true` y era VERDAD — el cliente se llevaba el PDF. Ahora
              // es `false` porque el `throw` de abajo lo impide. Este campo mide lo que PASÓ.
              pdfEntregadoIgual: false,
            },
          }),
        });
        // Sin huella no sale documento. El número NO se revierte (regla 29): la factura queda
        // existiendo y sin sellar, reintentable. Revertir es lo que crearía el hueco en la serie.
        throw new FacturaSinSellarError(inv.number, { cause: e });
      }
    }

    // SCRUM-206 · PORTÓN, al borde de la salida y no al principio de la función: aquí la
    // garantía es local y se lee de un vistazo. Cubre además el caso que el `catch` no ve — una
    // factura que llega sin huella sin haberse intentado sellar en esta llamada.
    exigirDocumentoEmitible({ number: inv.number, vfHash }, inv.merchant);

    const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
    await generateInvoicePdf({
      number: inv.number,
      invoiceId: inv.id,          // SCRUM-72
      merchantId: inv.merchantId, // SCRUM-72
      merchant: {
        name: inv.merchant.name,
        legalName: inv.merchant.legalName,
        taxId: inv.merchant.taxId,
        address: inv.merchant.address,
        logoUrl: inv.merchant.logoUrl,
        phone: inv.merchant.whatsappPhone, // A2.4: emisor completo
        email: inv.merchant.email,
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
      stageLabel: inv.stageLabel, // SCRUM-33
    });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: publicUrlPath, qrData } });
  }

  return { diskPath, pdfUrl: publicUrlPath, number: inv.number };
}

/**
 * SCRUM-74: token OPACO del recibo público (patrón `Albaran.firmaToken`, SCRUM-49).
 * `Charge.id` es autoincremental y NO debe usarse como identificador público
 * (IDOR/RGPD: cualquiera podía recorrer /recibo/1, /recibo/2… sin login). Generado
 * perezosamente la primera vez que se necesita un enlace (WhatsApp, email, redirect
 * de pago); estable en llamadas siguientes (mismo cobro → mismo token).
 */
export async function ensureChargeReceiptToken(
  chargeId: number,
  prisma: PrismaClient,
): Promise<string> {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    select: { receiptToken: true },
  });
  if (!charge) throw new Error('charge_not_found');
  if (charge.receiptToken) return charge.receiptToken;

  const token = crypto.randomBytes(16).toString('hex');
  await prisma.charge.update({ where: { id: chargeId }, data: { receiptToken: token } });
  return token;
}

export async function ensureInvoiceForCharge(
  chargeId: number,
  prisma: PrismaClient,
  // SCRUM-207 · OPCIONAL a propósito: las 4 bocas de C6 (2 webhooks de PSP + 2 API
  // internas) pueden decir quién son; las que aún no lo hagan quedan como 'sistema',
  // que es la verdad — no un valor de relleno que aparente una atribución que no hay.
  actorC6?: ActorAudit,
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
      } catch (e: any) {
        // SCRUM-206: mismo cambio que el otro. La palabra «se omite» describía el defecto con
        // precisión — se omitía el sellado y la factura salía igual.
        console.error('[verifactu] Error al aplicar VeriFactu:', e);
        recordAudit({
          merchantId: inv.merchantId,
          action: 'sellado_fallido', entityType: 'invoice', entityId: inv.id,
          meta: sobreFiscal({
            actor: { tipo: 'sistema', ref: 'ensureInvoiceForCharge' },
            flagsFiscales: flagsFiscalesDe(merchant ?? null),
            payload: {
              numero: inv.number,
              errorMensaje: String(e?.message ?? e).slice(0, 300),
              puntoDeFallo: 'ensureInvoiceForCharge',
              // SCRUM-206: este `false` ya estaba, pero era cierto solo en el INSTANTE del
              // `catch` — el PDF se renderizaba 34 líneas más abajo y `pdfUrl`/`qrData` se
              // persistían. El único campo diseñado para medir el daño lo declaraba nulo justo
              // cuando ocurría. Ahora es cierto de verdad, porque el `throw` lo garantiza.
              pdfEntregadoIgual: false,
            },
          }),
        });
        throw new FacturaSinSellarError(inv.number, { cause: e });
      }
    }

    const needsPdf =
      !inv.pdfUrl ||
      inv.pdfUrl === 'PENDING_PDF' ||
      String(inv.pdfUrl).startsWith('PENDING');

    let updated = inv;

    // SCRUM-206 · PORTÓN. Va ANTES del `if (needsPdf)` a propósito: la rama `else` de abajo
    // también escribía `qrData` —el fallback casero— sobre una factura sin sellar.
    exigirDocumentoEmitible({ number: inv.number, vfHash }, merchant);

    if (needsPdf) {
      const customer = await prisma.customer.findUnique({ where: { id: inv.customerId } });
      if (!merchant || !customer) throw new Error('missing_merchant_or_customer');

      const invLines = inv.lines && Array.isArray(inv.lines) ? inv.lines as any[] : [];

      const pdf = await generateInvoicePdf({
        number: inv.number,
        invoiceId: inv.id,          // SCRUM-72
        merchantId: inv.merchantId, // SCRUM-72
        merchant: {
          name: merchant.name,
          legalName: merchant.legalName,
          taxId: merchant.taxId,
          address: merchant.address,
          logoUrl: merchant.logoUrl,
          phone: merchant.whatsappPhone, // A2.4: emisor completo
          email: merchant.email,
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
        stageLabel: inv.stageLabel ?? null, // SCRUM-33
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
    const number = await allocateInvoiceNumber(tx, ch.merchantId, {
      camino: 'C6',
      // C6 tiene CUATRO bocas (2 webhooks de PSP + 2 API internas, SCRUM-200 §2.2) y
      // `ensureInvoiceForCharge` no sabe por cuál entró: distinguirlas exige propagar el
      // actor desde los 4 llamadores. Se registra lo que se sabe y NO se inventa el resto.
      actor: actorC6 ?? { tipo: 'sistema', ref: 'ensureInvoiceForCharge' },
    });
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
        // SCRUM-72: ya no se persiste una URL pública absoluta al crear. Nace PENDING y
        // `ensurePdfAndEvent` la fija al endpoint auth cuando genera el PDF.
        pdfUrl: 'PENDING_PDF',
        qrData: `INV:${number}|AMOUNT:${ch.amount.toString()}|CUR:${ch.currency}|REF:${ch.reference ?? ''}`,
      },
    });
  });

  return ensurePdfAndEvent(inv, ch);
}
