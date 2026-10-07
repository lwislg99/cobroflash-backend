// srcNew/modules/billing/app/routes/psp.routes.ts
// src/modules/billing/app/routes/psp.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { PSPWebhookSchema } from '../../../../core/validation/schemas';
import { ensureInvoiceForCharge, ensureChargeReceiptToken } from '../../../../lib/invoicing';
import { sendInvoiceEmail } from '../../../../lib/email';
import { canalDeWhatsApp, tieneNumeroDeContacto } from '../../../../core/contacto/canalDeWhatsApp'; // SCRUM-590 (CONT-19)
import { config } from '../../../../core/config/env';
import { formatMoneyEs } from '../../../../core/utils/utils';
import { sendWhatsAppCtaUrl } from '../../../../integrations/whatsapp';
import { sendPaymentConfirmationInvoice, notifyMerchantPaid } from '../../../../integrations/whatsappNotifications';
import { recordCustomerEvent } from '../../../system/customerEvents.service';
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { sendMerchantPaymentEmail } from '../../../messaging/domain/merchantNotifications';
// SCRUM-477: un aviso que no sale deja constancia -- y sin poder tumbar la operacion.
import { conConstancia } from '../../../messaging/domain/avisoConstancia';
import { esMetodoValido } from '../../domain/metodoDeCobro';
import { recalcJobCobradoForCharge } from '../../../jobs/domain/job.service'; // SCRUM-13
import { datosDeCobroPagado, resolverInstanteDeCobro } from '../../domain/instanteDeCobro'; // SCRUM-397
import { zonaDelMerchant } from '../../../../core/zonaDelMerchant'; // SCRUM-1301
// SCRUM-502: la guarda de anulada se CONSUME de donde vive, no se reescribe aqui.
import { puedeCobrarPorPasarela, ESTADO_ANULADA } from '../../../system/invoiceAdmin';
// SCRUM-815: la constancia EN DISCO de que el correo de la factura ya salio para este cobro.
import { yaSeEnvioElCorreo, marcarCorreoEnviado } from '../../domain/correoDeFacturaEnviado';
// SCRUM-1292: un cobro PAGADO no retrocede a fallido ni a caducado.
import { ESTADOS_QUE_UN_FALLO_PUEDE_PISAR, elFalloPuedePisar, esFilaQueNoCasa } from '../../domain/estadoDelCobro';


const router = Router();

router.post('/', async (req, res) => {
  try {
    const body = PSPWebhookSchema.parse(req.body);
    const chargeId =
      typeof body.charge_id === 'number' ? body.charge_id : Number(body.charge_id);
    if (!Number.isInteger(chargeId)) {
      return res.status(400).json({ error: 'invalid_charge_id' });
    }

    const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!charge) return res.status(404).json({ error: 'charge_not_found' });

    if (charge.status === 'paid' && body.event === 'payment.confirmed') {
      await prisma.event.create({
        data: {
          chargeId,
          type: 'paid',
          payload: { duplicate: true, body } as any,
        },
      });
    
      if (config.AUTO_INVOICE_ON_PAID) {
        try {
          const inv = await ensureInvoiceForCharge(chargeId, prisma);
    
          // Solo enviamos email si hay PDF real
          const hasRealPdf =
            !!inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF' && inv.pdfUrl !== '';
    
          if (
            hasRealPdf &&
            config.AUTO_EMAIL_INVOICE_ON_PAID &&
            charge.customerId
          ) {
            // 🔴 SCRUM-815 · AQUÍ ESTABA EL CORREO DUPLICADO. Esta rama es un REINTENTO de un
            // cobro ya pagado, y Stripe reentrega hasta tres días: sin esta guarda, cada entrega
            // mandaba al cliente otro correo con LA MISMA factura. La marca vive en `events`, en
            // DISCO, porque la memoria del proceso se vacía al reiniciar — que es el defecto
            // entero de este expediente.
            //
            // No se envía «nunca»: se envía si NO consta que ya saliera. Así se conserva el caso
            // en que el cobro llegó a `paid` por otro camino y esta entrega es la primera que
            // puede mandarlo.
            if (await yaSeEnvioElCorreo(chargeId, inv.id, prisma)) {
              console.log(`[psp] reintento de ${chargeId}: el correo de la factura ${inv.id} ya salió, no se reenvía`);
            } else {
              const cust = await prisma.customer.findUnique({
                where: { id: charge.customerId },
              });
              if (cust?.email) {
                await sendInvoiceEmail({
                  invoiceId: inv.id,
                  toEmail: cust.email,
                  toName: cust.name ?? '',
                  prisma,
                });
                // 🔒 AL TERMINAR, NUNCA ANTES: marcar antes de enviar es el defecto que se quita.
                await marcarCorreoEnviado(chargeId, inv.id, prisma);
              }
            }
          }
        } catch (e) {
          console.error('auto-invoice/error duplicate', (e as any)?.message || 'error desconocido'); // SCRUM-105
        }
      }
    
      return res.json({ ok: true, status: 'already_paid' });
    }
    

    if (
      (charge.status === 'failed' && body.event === 'payment.failed') ||
      (charge.status === 'expired' && body.event === 'payment.expired')
    ) {
      return res.json({ ok: true, status: `already_${charge.status}` });
    }

    // SCRUM-1292 · PRIMERA BARRERA: un cobro PAGADO no retrocede. Esta guarda es la que da la
    // respuesta buena y ahorra la escritura; la que de verdad sujeta es la condición dentro del
    // `update` de abajo, porque entre este `if` y aquella escritura cabe otra petición.
    if (
      !elFalloPuedePisar(charge.status) &&
      (body.event === 'payment.failed' || body.event === 'payment.expired')
    ) {
      return res.json({ ok: true, status: `already_${charge.status}` });
    }

    if (body.event === 'payment.confirmed') {
      // SCRUM-397 · el instante del cobro sale de UN generador: columna y evento con la misma
      // fecha. `body.ts` ya venía en el esquema y no lo leía nadie — es la fecha DECLARADA del
      // camino manual (confirm-bizum), y es donde el Bizum del 31-mar confirmado el 2-abr cruzaba
      // de trimestre. Los cinco reenviadores automáticos mandan el instante de proceso, así que
      // para ellos esto no cambia nada.
      // SCRUM-1301 · con la zona del merchant DEL COBRO, la misma con la que `confirm-bizum` la acaba
      // de aceptar. Sin ella, de madrugada en Madrid el «hoy» del profesional era «mañana» aquí.
      const merchantDelCobro = await prisma.merchant.findUnique({ where: { id: charge.merchantId }, select: { timezone: true } });
      const resolucion = resolverInstanteDeCobro(body.ts, new Date(), zonaDelMerchant(merchantDelCobro));
      if (!resolucion.ok) {
        // Fail-closed: no se marca nada. El único llamador que trae fecha declarada la valida
        // antes con el mismo criterio, así que esto no debería verse; si se ve, es preferible un
        // error a un cobro fechado con un reloj que no es el suyo.
        return res.status(400).json({ error: resolucion.error, message: resolucion.message });
      }

      const updated = await prisma.charge.update({
        where: { id: chargeId },
        data: {
          ...datosDeCobroPagado(resolucion.fecha, body),
          // 🔴 SCRUM-473 · LA PUERTA ABIERTA, CERRADA. Esto escribía lo que viniera en el cuerpo,
          // sin mirarlo: es el ÚNICO escritor de los nueve capaz de meter un valor arbitrario, y
          // por tanto el único que explica los 6 cobros con `bizum` a secas que hay en producción
          // y que ningún camino vivo escribe.
          //
          // Mientras esta línea siguiera abierta, cualquier guard sobre los otros ocho era
          // decorativo. Un valor que no cumple la forma `<metodo>[:<pasarela>]` NO se guarda: se
          // conserva el que ya tenía el cobro, que es un dato real, en vez de pisarlo con basura.
          method: esMetodoValido(body.method) ? body.method : charge.method,
          reference: body.bank_ref ?? charge.reference,
          reconciliations: {
            create: { bankRef: body.bank_ref ?? 'n/a', matched: true },
          },
        },
        include: { customer: true },
      });

      // P0-3: marcar la factura como PAGADA de forma ROBUSTA, independiente de la
      // generación del PDF. Antes solo se marcaba si ensureInvoiceForCharge() devolvía
      // un invoiceId, pero esa función genera el PDF y, si falla (ver P0-2), lanzaba y
      // la factura se quedaba en PENDIENTE aunque el cobro estuviera pagado. La factura
      // se localiza por chargeId directo o vía el presupuesto ligado al cobro.
      let paidInvoiceNumber: string | null = null;   // nº de factura real para la confirmación (P1-6)
      try {
        const linkedQuote = await prisma.quote.findFirst({
          where: { chargeId: updated.id },
          select: { id: true },
        });
        const linkedInvoice = await prisma.invoice.findFirst({
          where: {
            OR: [
              { chargeId: updated.id },
              ...(linkedQuote ? [{ quoteId: linkedQuote.id }] : []),
            ],
          },
          // SCRUM-502 · el ESTADO entra en el select porque sin el no se puede aplicar la guarda.
          select: { id: true, number: true, status: true },
        });
        if (linkedInvoice) {
          paidInvoiceNumber = linkedInvoice.number;
          // 🔴 SCRUM-502 · UNA ANULADA NO VUELVE, TAMPOCO POR AQUI. Este `findFirst` no filtra por
          // estado, y el enlace sobrevive a la anulacion —anular escribe SOLO `status`—, asi que un
          // pago que llegue despues resucitaba el documento como COBRADO. Y aqui no pulsa nadie un
          // boton: se dispara con lo que llegue por la red.
          //
          // La guarda va sobre la ESCRITURA y no sobre el `where`: asi lo demas —el numero para la
          // confirmacion al cliente— se comporta exactamente igual que hoy.
          //
          // 🔴 SCRUM-1303 · Y LA MISMA GUARDA VA DENTRO DEL `where`. La de arriba mira el estado leído
          // en el `findFirst`; si el profesional anula mientras llega este pago, la fila ya está
          // anulada al escribir. Entonces Prisma no la encuentra (P2025) y no se escribe nada. Al
          // proveedor se le contesta lo mismo que antes: esto sólo decide si se escribe.
          if (puedeCobrarPorPasarela(linkedInvoice)) {
          try {
          await prisma.invoice.update({
            where: { id: linkedInvoice.id, status: { not: ESTADO_ANULADA } },
            data: { status: 'paid', paidAt: new Date() },
          });
          } catch (e) {
            if (!esFilaQueNoCasa(e)) throw e;
            console.error(`[psp] SCRUM-1303 ${linkedInvoice.number} se anuló entre la lectura y el cobro: no se marca pagada`);
          }
          }
        }
      } catch (e) {
        console.error('[psp] P0-3 marcar factura pagada (robusto) error', (e as any)?.message || 'error desconocido'); // SCRUM-105
      }

      // 👇 NUEVO: intentamos emitir / asegurar la factura
        // 👇 NUEVO: intentamos emitir / asegurar la factura
  let invoiceId: number | null = null;
  // SCRUM-502 · el estado de esa misma factura, para poder aplicar la guarda de anulada abajo.
  // `ensureInvoiceForCharge` puede DEVOLVER una existente —busca por el evento `invoiced` y por
  // `quoteId`, las dos SIN filtro de estado (`lib/invoicing.ts`)—, asi que puede ser una anulada.
  let invoiceEstado: string | null = null;

  if (config.AUTO_INVOICE_ON_PAID) {
    try {
      const inv = await ensureInvoiceForCharge(updated.id, prisma);
      invoiceId = inv.id;
      invoiceEstado = (inv as { status?: string }).status ?? null;

      // P0-4: enviar el email de la factura SIEMPRE (sendInvoiceEmail genera el
      // PDF bajo demanda si falta y envía por Resend con adjunto). Antes se
      // exigía un PDF "real" y, como la generación se quedaba en PENDING, el
      // email no salía nunca.
      if (config.AUTO_EMAIL_INVOICE_ON_PAID && updated.customer?.email) {
        try {
          await sendInvoiceEmail({
            invoiceId: inv.id,
            toEmail: updated.customer.email,
            toName: updated.customer.name ?? '',
            prisma,
          });
          // 🔒 SCRUM-815 · la constancia EN DISCO de que este correo salió, escrita AL TERMINAR.
          // Es lo que hace que el reintento de arriba sepa que no tiene que reenviarlo. Si se
          // escribiera antes del envío, un fallo a mitad dejaría al cliente sin su factura y con
          // la marca puesta — que es exactamente el defecto que este ticket quita.
          await marcarCorreoEnviado(updated.id, inv.id, prisma);
        } catch (e) {
          console.error('auto-email error', (e as any)?.message || 'error desconocido'); // SCRUM-105
        }
      }
    } catch (e) {
      console.error('auto-invoice error', (e as any)?.message || 'error desconocido'); // SCRUM-105
    }
  }


        // 👇 NUEVO: si hemos conseguido una factura, la marcamos como PAGADA
        // 🔴 SCRUM-502 · misma guarda que arriba: una anulada no se marca cobrada.
        //
        // 🔴 SCRUM-1315 · Y VA TAMBIÉN DENTRO DEL `where`, como la de arriba desde SCRUM-1303. La guarda
        // mira el estado que devolvió `ensureInvoiceForCharge`; si el profesional anula después, la
        // fila ya está anulada al escribir. Entonces Prisma no la encuentra (P2025), no se escribe
        // nada y se dice. Lo demás —la respuesta al proveedor, los avisos— sigue igual.
        if (invoiceId && puedeCobrarPorPasarela({ status: invoiceEstado ?? '' })) {
          try {
            await prisma.invoice.update({
              where: { id: invoiceId, status: { not: ESTADO_ANULADA } },
              data: {
                status: 'paid',
                // solo ponemos paidAt si no lo tenía aún, para que sea idempotente
                paidAt: new Date(),
              },
            });
          } catch (e) {
            if (esFilaQueNoCasa(e)) {
              console.error(`[psp] SCRUM-1315 la factura ${invoiceId} se anuló entre la lectura y el cobro: no se marca pagada`);
            } else {
              console.error('auto-mark invoice paid error', (e as any)?.message || 'error desconocido'); // SCRUM-105
            }
          }
        }
  
      
      

      // Cargar merchant para notificaciones
      const merchant = await prisma.merchant.findUnique({
        where: { id: updated.merchantId },
        select: { whatsappPhone: true, googleReviewUrl: true, name: true, legalName: true, email: true, notifyEmailOnPaid: true },
      });

      // Confirmación de pago al cliente por WhatsApp (J1: payment_confirmation_invoice_es,
      // con botón "Ver documento" → /recibo/:token; copy neutro factura/justificante).
      const cur = body.currency ?? updated.currency;
      // SCRUM-1436: lo que lee el PROFESIONAL (historial y aviso), en la forma de la casa.
      const importe = formatMoneyEs(body.amount ?? updated.amount, cur);
      const invConf = invoiceId
        ? await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { number: true } }).catch(() => null)
        : null;
      // P1-6: nº de documento REAL (sin '#') — factura o justificante, no el id del cobro.
      const documentNumber = invConf?.number || paidInvoiceNumber || String(updated.id);
      if (updated.customer && tieneNumeroDeContacto(updated.customer)) { // SCRUM-590 (CONT-19)
        // SCRUM-74: token OPACO del recibo público, NUNCA el chargeId (IDOR/RGPD).
        const receiptToken = await ensureChargeReceiptToken(updated.id, prisma);
        sendPaymentConfirmationInvoice({
          toPhone: canalDeWhatsApp(updated.customer),
          customerName: updated.customer.name,
          merchantId: updated.merchantId, // J3: respeta waOptOut
          customerId: updated.customerId ?? undefined, // A5.3: vía ventana (0 €) si hay entrante <24 h
          // SCRUM-931: en bruto; lo formatea quien envía. El `detail` del panel y el aviso al PRO
          // llevan `importe`, de arriba (SCRUM-1436).
          amount: Number(body.amount ?? updated.amount),
          currency: cur,
          documentNumber,
          // P1-7: nombre del negocio como en presupuesto/factura/landing (legalName||name).
          businessName: merchant?.legalName || merchant?.name,
          chargeId: updated.id, // log interno (WhatsAppMessage.relatedId), NO la URL pública
          receiptToken, // botón "Ver documento" → /recibo/:token
        }).catch(() => {});

        // ENT-3: historial
        recordCustomerEvent({
          merchantId: updated.merchantId,
          customerId: updated.customerId,
          type: 'payment_received',
          title: 'Pago recibido',
          detail: `${importe}${invConf?.number ? ` · ${isReceiptNumber(invConf.number) ? 'Justificante' : 'Factura'} ${invConf.number}` : ''}`,
        });
      }

      // Solicitud de reseña Google al cliente — A23: BOTÓN-ENLACE (fire-and-forget; solo
      // en ventana, que está abierta porque el cliente acaba de pagar por el enlace).
      if (merchant?.googleReviewUrl && updated.customer && tieneNumeroDeContacto(updated.customer)) { // SCRUM-590 (CONT-19)
        const reviewPhone = canalDeWhatsApp(updated.customer);
        if (reviewPhone) {
          const customerName = updated.customer.name || 'Cliente';
          const merchantName = merchant.name || 'tu proveedor';
          sendWhatsAppCtaUrl({
            to: reviewPhone,
            merchantId: updated.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
            bodyText: `¡Gracias por confiar en *${merchantName}*, ${customerName}! 🙏\n¿Nos dejas una reseña en Google? Solo te lleva 10 segundos y nos ayuda muchísimo ⭐`,
            buttonText: '⭐ Dejar reseña',
            url: merchant.googleReviewUrl,
            // SCRUM-227: deja rastro consultable de la reseña (relatedType 'review', no 'charge')
            log: { customerId: updated.customer?.id ?? null, relatedType: 'review', relatedId: updated.id },
          }).catch((err) => console.error('[review] Error enviando reseña:', err?.message));
        }
      }

      // Notificar al profesional por WhatsApp (J1: texto libre si la ventana 24 h está
      // abierta; si no, fallback a la plantilla merchant_alert_es). Fire-and-forget.
      {
        const customerName = updated.customer?.name || 'Un cliente';
        notifyMerchantPaid({
          merchantId: updated.merchantId, // V0-2 + J3 reaplicados dentro
          merchantPhone: merchant?.whatsappPhone,
          customerName,
          freeText: `💰 Pago recibido de ${customerName}: ${importe}`,
          detail: `${importe}${documentNumber ? ` · ${documentNumber}` : ''}`,
        }).catch((err) => console.error('[psp] Error notificando al merchant:', err));
      }

      // Email al merchant si tiene notificaciones activadas
      if (merchant?.notifyEmailOnPaid && merchant?.email) {
        const inv = await prisma.invoice.findFirst({ where: { id: invoiceId ?? undefined }, select: { number: true } }).catch(() => null);
        // SCRUM-477 · el `.catch(() => {})` que había aquí se comía el fallo entero: al profesional
        // no le llegaba el «te han pagado» y no quedaba ni una línea de que no le llegó.
        // ⚠️ SIGUE SIN `await` a propósito: el cobro ya está registrado y un aviso que no sale NO
        // puede tumbar la confirmación del pago. Lo que cambia es que ahora deja constancia.
        conConstancia('pago_recibido', merchant.email, sendMerchantPaymentEmail({
          merchantId: updated.merchantId, // SCRUM-508: para que el aviso deje fila
          merchantEmail: merchant.email,
          merchantName: merchant.name || 'Tu negocio',
          customerName: updated.customer?.name || 'Cliente',
          amount: (body.amount ?? updated.amount).toString(),
          currency: body.currency ?? updated.currency,
          invoiceNumber: inv?.number ?? null,
        }));
      }

      // SCRUM-13 (COBROS-1): recalcular Job.totalCobrado (suma desde cero de los Charge
      // paid del Job). AÑADIDO al final, fire-and-forget: un fallo aquí NUNCA rompe la
      // confirmación del pago; la cadena de arriba NO se toca.
      recalcJobCobradoForCharge(updated.id).catch((e) => console.error('[psp] SCRUM-13 recalc totalCobrado:', e?.message || e));

      return res.json({ ok: true, status: 'paid' });
    }


    // SCRUM-1292 · SEGUNDA BARRERA: la condición de estado VA EN LA ESCRITURA. Un cobro `paid` no
    // retrocede a fallido ni a caducado por un aviso posterior —el caso normal es un Bizum ya
    // cobrado cuya sesión de Stripe caduca después—, y si alguien paga entre la lectura de arriba y
    // esta escritura, Prisma no encuentra la fila (P2025) y aquí no se escribe nada. El porqué de la
    // lista, en `domain/estadoDelCobro.ts`.
    if (body.event === 'payment.failed' || body.event === 'payment.expired') {
      const nuevo = body.event === 'payment.failed' ? 'failed' : 'expired';
      try {
        await prisma.charge.update({
          where: { id: chargeId, status: { in: ESTADOS_QUE_UN_FALLO_PUEDE_PISAR } },
          data: {
            status: nuevo,
            events: { create: { type: nuevo, payload: body as any } },
          },
        });
      } catch (e) {
        if (!esFilaQueNoCasa(e)) throw e;
        // Pagaron entre la lectura y la escritura. No se escribe nada, y se contesta lo mismo que si
        // se hubiera visto arriba. Para Stripe sigue siendo un 200, que es lo que evita el reintento.
        return res.json({ ok: true, status: 'already_paid' });
      }
      return res.json({ ok: true, status: nuevo });
    }

    return res.status(400).json({ error: 'unhandled_event' });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /webhooks/psp error', err?.message || 'error desconocido'); // SCRUM-105
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
