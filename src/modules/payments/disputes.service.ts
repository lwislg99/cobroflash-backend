// src/modules/payments/disputes.service.ts — A21.1 (EXT3, R14)
// Disputa de tarjeta (charge.dispute.created) → aviso WA/BO al merchant y
// paquete de evidencia en 1 clic desde la factura. "La firma digital gana
// disputas" — el paquete junta TODO lo que el banco pide: presupuesto firmado,
// evidencia de aceptación (ts/IP/UA), justificante y el registro de entrega
// de los WhatsApp. El handler lo comparten el webhook Connect (spec R14) y el
// de plataforma (las tarjetas de HOY aún van por la cuenta de plataforma).
import { prisma } from '../../core/db/prisma';
import { recordCustomerEvent } from '../system/customerEvents.service';
import { notifyMerchantAlert } from '../../integrations/whatsappNotifications';
import { formatMoneyEs } from '../../core/utils/utils';
import { firmaTieneTrazo } from '../quotes/domain/firmaConTrazo';

/**
 * SCRUM-1436 · ¿La factura de este cobro viene de un presupuesto FIRMADO?
 *
 * El aviso de abajo decía «Tranquilo: tienes el presupuesto FIRMADO» SIEMPRE, sin mirar si había
 * presupuesto ni firma. Se lo decíamos al profesional justo cuando un banco le reclama el dinero.
 *
 * 🔴 SE MIRA LO MISMO QUE VA A ENSEÑAR EL «PAQUETE DE DISPUTA» al que el aviso le manda: el
 * presupuesto de ESA factura (`invoice.quoteId`) y su `signatureUrl`. No `acceptedAt`: aceptar y
 * firmar no son lo mismo («Acepto sin firmar» deja la firma a `null`), y es el criterio que ya usa
 * el Libro (`libroRegistro.repo.ts`).
 *
 * ⚠️ DIVERGENCIA DECLARADA sobre el MISMO campo: el Libro usa `signatureUrl` no nulo; aquí se pasa
 * por `firmaTieneTrazo` (SCRUM-892) A PROPÓSITO, porque el aviso afirma que hay prueba. Un lienzo
 * vacío guardado no es una firma, y con él volveríamos a decir lo que no es.
 *
 * 🔴 SI LA CONSULTA FALLA, DEVUELVE `false`. No saber no es «firmado»: el aviso sale igual, sin
 * la afirmación. La asimetría es la del dinero — callar una firma que existe cuesta que el
 * profesional vaya a mirarla; afirmar una que no existe le cuesta la disputa.
 *
 * ⚠️ LÍMITE DECLARADO: un cobro sin factura, o cuya factura no apunta a su presupuesto, sale
 * como «no firmado» aunque exista un presupuesto firmado por otro camino (`Quote.chargeId`). Ahí
 * el paquete tampoco lo enseñaría.
 */
async function presupuestoFirmadoDe(
  merchantId: number,
  invoice: { quoteId: number | null } | null,
): Promise<boolean> {
  if (!invoice || invoice.quoteId == null) return false;
  try {
    const quote = await prisma.quote.findFirst({
      where: { id: invoice.quoteId, merchantId },
      select: { signatureUrl: true },
    });
    return firmaTieneTrazo(quote?.signatureUrl);
  } catch (err: any) {
    console.warn('[dispute] no se pudo leer la firma del presupuesto — el aviso sale sin afirmarla:', err?.message || err);
    return false;
  }
}

/**
 * Tipo del apunte que deja constancia de que ESTA entrega ya se atendió. Vive en `events`, que es
 * el registro por cobro que ya usan `paid`, `invoiced`, `emailed`… No es un estado (Parte L): es
 * una ocurrencia en un log de sólo-añadir.
 */
const MARCA_DISPUTA = 'dispute_created';

/**
 * ¿Ya se atendió esta entrega? La clave se DERIVA del evento de Stripe, que es estable entre
 * reintentos; si faltara, se cae al id de la disputa, que también lo es. Ninguno se inventa.
 *
 * ⚠️ EL FILTRO DEL `payload` SE HACE EN MEMORIA, y es deliberado — misma decisión y mismo motivo
 * que `existeEventoDePlan` (SCRUM-394): Postgres sabe consultar el JSON, pero eso ata el código al
 * motor y falla distinto cuando el campo es `null`. Los candidatos son poquísimos: las disputas de
 * UN cobro.
 *
 * 🔴 Y SI LA CONSULTA FALLA, DEVUELVE `false` — «no lo he visto, avisa». La asimetría es la del
 * dinero: equivocarse hacia un aviso repetido cuesta un WhatsApp de más; equivocarse hacia el
 * silencio cuesta que el profesional no se entere de que le han disputado un cobro.
 */
async function yaAtendida(chargeId: number, clave: string): Promise<boolean> {
  try {
    const previos = await prisma.event.findMany({
      where: { chargeId, type: MARCA_DISPUTA },
      select: { payload: true },
      take: 50,
    });
    return previos.some((e: any) => e?.payload && String(e.payload.stripeEventId) === clave);
  } catch (err: any) {
    console.error('[dispute] no se pudo comprobar si ya estaba atendida:', err?.message || err);
    return false; // hacia «avisa», nunca hacia el silencio
  }
}

export async function handleStripeDispute(dispute: {
  id?: string;
  payment_intent?: string | { id: string } | null;
  amount?: number | null;
  currency?: string | null;
  reason?: string | null;
}, stripeEventId?: string): Promise<void> {
  const piId = typeof dispute.payment_intent === 'string'
    ? dispute.payment_intent
    : dispute.payment_intent?.id || '';
  if (!piId) {
    console.warn('[dispute] charge.dispute.created sin payment_intent — ignorado');
    return;
  }
  const charge = await prisma.charge.findFirst({
    where: { intentId: piId },
    include: {
      merchant: { select: { id: true, name: true, whatsappPhone: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  if (!charge) {
    console.warn(`[dispute] sin charge para intent ${piId} — revisar a mano en Stripe`);
    return;
  }
  // 🔴 UNA VEZ POR DISPUTA, NO UNA POR REINTENTO. Stripe reentrega hasta 3 días, y los dos efectos
  // de abajo —la fila de la ficha y el WhatsApp al profesional— no se podían repetir.
  const clave = stripeEventId || dispute.id || '';
  if (!clave) {
    console.warn('[dispute] entrega sin id de evento ni de disputa — se atiende sin deduplicar');
  } else if (await yaAtendida(charge.id, clave)) {
    console.log(`[dispute] entrega repetida ${clave} para charge ${charge.id} — ya atendida, no se reavisa`);
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: { chargeId: charge.id },
    select: { id: true, number: true, quoteId: true },
    orderBy: { id: 'desc' },
  });
  const firmado = await presupuestoFirmadoDe(charge.merchantId, invoice);

  const amountTxt = dispute.amount != null
    ? formatMoneyEs(dispute.amount / 100, (dispute.currency || 'EUR').toUpperCase())
    : formatMoneyEs(charge.amount, charge.currency);
  const custName = charge.customer?.name || 'un cliente';

  // BO (ficha 360 + timeline): siempre queda constancia
  // 🔴 AHORA SE ESPERA. Antes salía sin `await`, y una marca que se escribe mientras el trabajo
  // sigue en vuelo no sirve para deduplicar: la siguiente entrega podría no verla todavía.
  await recordCustomerEvent({
    merchantId: charge.merchantId,
    customerId: charge.customerId ?? undefined,
    type: 'dispute_created',
    title: `⚠️ Disputa abierta por el banco de ${custName}`,
    detail: `${amountTxt}${dispute.reason ? ` · motivo: ${dispute.reason}` : ''}` +
      (invoice ? ` · genera el paquete de evidencia desde la factura ${invoice.number}` : ''),
  });

  // WA al pro (ventana-first + plantilla merchant_alert si existe)
  await notifyMerchantAlert({
    merchantId: charge.merchantId,
    merchantPhone: charge.merchant?.whatsappPhone,
    customerName: custName,
    action: 'ha disputado un cobro',
    detail: `${amountTxt}${invoice ? ` · ${invoice.number}` : ''}`,
    freeText:
      `⚠️ El banco de ${custName} ha abierto una disputa por ${amountTxt}.\n` +
      // SCRUM-1436: la oración sale SÓLO con firma detrás. Sin ella el resto no cambia: qué
      // decirle entonces es texto nuevo y necesita firma del fundador (regla 39).
      `${firmado ? 'Tranquilo: tienes el presupuesto FIRMADO. ' : ''}Entra en la factura` +
      `${invoice ? ` ${invoice.number}` : ''} y pulsa "Paquete de disputa" — ` +
      `sale todo listo para responder al banco.`,
  }).catch(() => null);

  // 🔴 LA MARCA SE ESCRIBE AL TERMINAR, NUNCA ANTES.
  //
  // Es la semántica de `processed_at` que el propio expediente fija (`docs/master/SCRUM-815.md`,
  // paso ① §4): marcar ANTES de hacer el trabajo es EL defecto de este ticket —`isDuplicateStripeEvent`
  // pregunta y marca en la misma llamada, antes de empezar—. Marcando al final, una entrega que
  // muriese a medias no deja marca y el reintento vuelve a entrar: se paga con un aviso repetido
  // en un caso raro, en vez de con silencio sobre una disputa, que es dinero.
  //
  // ⚠️ LÍMITE DECLARADO: entre la lectura y esta escritura hay ventana. No se puede cerrar aquí
  // sin `@@unique([provider, eventId])`, y esa tabla (`gateway_events`) es de otra sesión y de ③.
  // Los reintentos de Stripe van espaciados, así que la ventana es estrecha; lo que este arreglo
  // quita —tres días de avisos repetidos— no depende de ella.
  if (clave) {
    try {
      await prisma.event.create({
        data: {
          chargeId: charge.id,
          type: MARCA_DISPUTA,
          payload: { stripeEventId: clave, disputeId: dispute.id ?? null } as any,
        },
      });
    } catch (err: any) {
      console.error('[dispute] no se pudo dejar la marca de atendida:', err?.message || err);
    }
  }

  console.log(`[dispute] registrado para charge ${charge.id} (${amountTxt})`);
}
