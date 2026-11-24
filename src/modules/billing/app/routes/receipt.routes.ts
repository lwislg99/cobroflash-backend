// srcNew/modules/billing/app/routes/receipt.routes.ts
import { Router } from 'express';
import fs from 'fs';
import axios from 'axios';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml, documentoEnRegistroHtml } from '../../../../core/http/publicNotFound';
import { esErrorSinSellar, COPY_PUBLICO_SIN_SELLAR } from '../../../invoicing/domain/portonDocumento'; // SCRUM-206
import { esc, formatMoneyEs, hrefSeguro } from '../../../../core/utils/utils';
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { stripe } from '../../../../integrations/stripe';
import { BASE_URL, config } from '../../../../core/config/env';
import { internalHeaders } from '../../../../core/http/internalAuth';
import { ensureInvoicePdf } from '../../../../lib/invoicing';
import { fechaDeCobroDeCharge } from '../../domain/instanteDeCobro'; // SCRUM-397
import { cardChargeMode } from '../../domain/cardCharge'; // SCRUM-893
import { transferenciaDisponible } from '../../domain/transferenciaDisponible'; // SCRUM-910
import { comercioSuprimido } from '../../domain/comercioSuprimido'; // SCRUM-1573b
import { zonaDelMerchant } from '../../../../core/zonaDelMerchant'; // SCRUM-1471
import { clienteDelDocumento } from '../../../invoicing/domain/clienteCongelado'; // SCRUM-1576
import { etiquetaEstiloDePago } from './pagoEstilo'; // SCRUM-1756b (style-src 'self')
import { etiquetaGuionDePago } from './pagoNavegador'; // SCRUM-1756c (script-src 'self')

const router = Router();

// GET /recibo/:token — SCRUM-74: público por diseño (el cliente final no tiene login),
// pero identificado por el token OPACO de Charge.receiptToken, NUNCA por el id
// autoincremental (IDOR/RGPD — Charge.id era enumerable: /recibo/1, /recibo/2…).
router.get('/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const token = req.params.token;

  let charge = await prisma.charge.findUnique({
    where: { receiptToken: token },
    include: { customer: true, merchant: true, events: true, reconciliations: true },
  });
  if (!charge) {
    res.status(404).send(documentNotFoundHtml());
    return;
  }
  const id = charge.id;

  // Fallback Stripe sin webhooks (si se vuelve de success_url)
  try {
    const cardParam = (req.query as any).card;
    const sessId = (req.query as any).session_id;
    if (
      stripe &&
      charge.status === 'pending' &&
      cardParam === 'success' &&
      typeof sessId === 'string' &&
      sessId
    ) {
      // SCRUM-923 · la Checkout Session la creó `payCard.routes.ts` en la cuenta CONECTADA del
      // merchant cuando `cardChargeMode` da 'connect' (regla 23) — Stripe es account-scoped, así
      // que recuperarla sin decir de qué cuenta daba `resource_missing` y este fallback nunca
      // confirmaba el pago de un merchant con Connect. Mismo criterio que ya usa la creación.
      const retrieveOpts =
        cardChargeMode(charge.merchant) === 'connect'
          ? { stripeAccount: (charge.merchant as any)?.stripeAccountId }
          : undefined;
      const s = await stripe.checkout.sessions.retrieve(sessId, retrieveOpts);
      if (s && (s.payment_status === 'paid' || s.status === 'complete')) {
        await axios.post(
          `${BASE_URL}/webhooks/psp`,
          {
            event: 'payment.confirmed',
            charge_id: id,
            method: 'card:stripe',
            bank_ref: s.payment_intent || s.id,
            amount: (s.amount_total ?? 0) / 100,
            currency: (s.currency || 'eur').toUpperCase(),
            ts: new Date().toISOString(),
          },
          { timeout: 10_000, headers: internalHeaders() },
        );
        charge = await prisma.charge.findUnique({
          where: { receiptToken: token },
          include: { customer: true, merchant: true, events: true, reconciliations: true },
        });
      }
    }
  } catch (e) {
    console.error('recibo/stripe-fallback error', (e as any)?.message || e);
  }

  if (!charge) {
    res.status(404).send(documentNotFoundHtml());
    return;
  }
  const ch = charge;

  // localizar invoice (por quote o último evento 'invoiced')
  const quote = await prisma.quote.findFirst({ where: { chargeId: ch.id } });
  let invoice: any = null;
  if (quote) invoice = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
  if (!invoice) {
    const invEv = [...(ch.events || [])]
      .reverse()
      .find((e) => e.type === 'invoiced' && (e as any).payload?.invoice_id);
    const invId = (invEv as any)?.payload?.invoice_id as number | undefined;
    if (invId) invoice = await prisma.invoice.findUnique({ where: { id: invId } });
  }

  // V0-0: el documento es FACTURA (post-SIF) o JUSTIFICANTE (pre-SIF). El copy NUNCA dice
  // "factura" para un justificante (regla 7 / Parte M). Tipo: invoice.type==='JUST' o nº J-…
  const isJust = !!invoice && (invoice.type === 'JUST' || isReceiptNumber(invoice.number));
  const docLabel = isJust ? 'justificante' : 'factura';
  // SCRUM-1576 · un cobro YA FACTURADO se nombra con el cliente congelado en su factura, como el
  // PDF que enlaza esta misma página (SCRUM-729). Sin factura, la ficha viva: el Charge no guarda
  // cliente. La regla es la de `clienteDelDocumento`, no una copia.
  const nombreDelCliente: string | null =
    invoice && (invoice.customerName != null || ch.customer)
      ? clienteDelDocumento(invoice, ch.customer).name
      : ch.customer?.name ?? null;
  const docPron = isJust ? 'lo' : 'la'; // pronombre: lo (justificante) / la (factura)

  const title = `Recibo #${ch.id} — YaQu`;

  // SCRUM-85/90: /pay/card y /pay/bank tokenizados (mismo Charge.receiptToken).
  //
  // SCRUM-893 · ÉSTA ES LA SEGUNDA DE LAS TRES PUERTAS QUE LLEVAN A /pay/card, y era la que ni
  // siquiera lo miraba: el botón de tarjeta salía con `status === 'pending'` y nada más. El
  // selector al menos tenía una condición (rota); aquí no había ninguna. Arreglar sólo el
  // selector habría dejado a la clienta estrellándose por este botón, con el defecto ya dado por
  // cerrado — un arreglo parcial de un defecto con tres puertas no lo reduce, reduce su
  // visibilidad. Misma pregunta, mismo dominio que la puerta de cobro.
  // SCRUM-910 · Y LA TRANSFERENCIA TAMPOCO MIRABA NADA. Con SCRUM-893, en un merchant sin Connect
  // la tarjeta deja de ofrecerse — y este botón se quedaba como ÚNICO, llevando a `/pay/bank`, que
  // sin IBAN (o con CLABE y país que no es MX) no puede enseñar ninguna cuenta. Cerrar la puerta
  // de la tarjeta y dejar ésta abierta no habría reducido el defecto: habría reducido su
  // visibilidad, dejando a la clienta con un solo botón que no lleva a ninguna parte.
  // SCRUM-1573b · un comercio suprimido no ofrece ninguna vía de cobro (c.21057): el recibo se sigue
  // sirviendo, porque el cliente conserva sus documentos, pero sin botones de pago.
  const puedeTarjeta = !comercioSuprimido(ch.merchant) && cardChargeMode(ch.merchant) !== 'refuse';
  const puedeTransferencia = !comercioSuprimido(ch.merchant) && transferenciaDisponible(ch.merchant);
  const payBtns =
    ch.status === 'pending'
      ? [
          puedeTransferencia
            ? `<a href="${BASE_URL}/pay/bank/${token}" class="pay-btn pay-btn-primary">Pagar por transferencia</a>`
            : '',
          puedeTarjeta
            ? `<a href="${BASE_URL}/pay/card/${token}" class="pay-btn pay-btn-secondary">Pagar con tarjeta</a>`
            : '',
        ].filter(Boolean).join('\n       ')
      : '';

  const mailParam =
    typeof (req.query as any).mail === 'string' ? (req.query as any).mail : undefined;
  const emlParam =
    typeof (req.query as any).eml === 'string' ? (req.query as any).eml : undefined;
  // SCRUM-807 · TRES cosas en esta línea, y las tres estaban medidas antes de tocarla:
  //
  // ① EL GATE. Este banner dice «(modo dev)» y el código no lo comprobaba: bastaba pedir
  //    `?mail=saved` para que se pintara TAMBIÉN en producción. Su ÚNICO productor legítimo es
  //    `dev.routes.ts:100`, y `/dev` sólo se monta si `NODE_ENV!=='production'` (`app.ts:354`).
  //    Se le pone el MISMO gate que a su productor: el código pasa a cumplir lo que su propio
  //    rótulo ya prometía. Re-verificado antes de gatearlo que no hay un segundo productor.
  // ② EL ESQUEMA. `emlParam` es un parámetro de URL en crudo: lo controla quien manda el enlace.
  //    `hrefSeguro` valida por LISTA BLANCA donde se construye el href — no dentro de `esc`,
  //    que sigue haciendo lo suyo (escapar el HTML) sobre el resultado ya validado.
  // ③ `rel="noopener"`: era el único `target="_blank"` del fichero sin él. Las otras tres anclas
  //    ya lo llevaban.
  // SCRUM-1309 · el ① de arriba, terminado: `sent` tiene el MISMO único productor
  //    (`dev.routes.ts`, el redirect de `/dev/email-invoice`) y se pintaba sin gate. En producción,
  //    añadir `?mail=sent` a mano hacía que la página le dijera al CLIENTE FINAL que se le mandó un
  //    correo que nadie mandó. Misma condición que `saved`; el texto no cambia.
  const mailBanner =
    mailParam === 'sent' && config.NODE_ENV !== 'production'
      ? `<div class="note note-ok">📧 Email enviado correctamente.</div>`
      : mailParam === 'saved' && config.NODE_ENV !== 'production'
      ? `<div class="note note-info">📧 Email generado en <a href="${esc(
          hrefSeguro(emlParam),
        )}" target="_blank" rel="noopener">.eml</a> (modo dev).</div>`
      : '';

    // Consideramos que solo hay PDF real si pdfUrl existe y no es un placeholder
    const hasRealPdf =
    !!invoice &&
    !!invoice.pdfUrl &&
    !invoice.pdfUrl.startsWith('PENDING');

  // SCRUM-1312 · el formulario hace POST a `/dev/email-invoice`, que en producción no se monta: el
  //    CLIENTE FINAL veía un botón que daba 404. Misma condición que `saved` (807) y `sent` (1309);
  //    el texto no cambia. Decisión del fundador: la (a), no pintarlo (Jira, comentario 17667).
  const emailBlock =
    hasRealPdf && ch.customer?.email && config.NODE_ENV !== 'production'
      ? `<form method="post" action="${BASE_URL}/dev/email-invoice/${ch.id}" class="email-form">
           <button class="btn-email">Enviar ${docLabel} por email</button>
         </form>
         <small>Se enviará a: ${esc(ch.customer!.email!)}</small>`
      : '';

  const invBlock =
    ch.status === 'paid' && invoice
      ? `<p class="doc-link"><a href="${BASE_URL}/recibo/${token}/pdf" target="_blank" rel="noopener">
           📄 Descargar ${docLabel} en PDF (${esc(invoice.number)})
         </a></p>${emailBlock}`
      : '';

      // SCRUM-910 ②: el texto nombra SOLO lo que `payBtns` (arriba, con `puedeTransferencia` /
      // `puedeTarjeta`) pinta de verdad. Antes decía siempre "los botones de pago por banco o pago
      // con tarjeta", y con SCRUM-910③ ya en main un merchant sin Connect y sin IBAN/CLABE se queda
      // en /recibo SIN NINGÚN BOTÓN — ese texto pasó de nombrar un botón roto a nombrar dos que no
      // existen. Cuatro literales firmados (Jira SCRUM-910, comentario 16527 del orquestador):
      // "ambos" y "ninguno" ya estaban firmados (el segundo se reutiliza tal cual de
      // payInvoice.routes.ts:242); "solo banco" y "solo tarjeta" son los dos nuevos que firmó.
      // SCRUM-1800 ②: los botones (`pay-stack`) se pintan DEBAJO de este texto, así que «más arriba»
      // pasó a «a continuación» en los tres (firma del fundador, Jira SCRUM-1800 c.22496 ②).
      const pendingMessage =
        puedeTransferencia && puedeTarjeta
          ? 'Estamos esperando tu pago. Puedes completarlo usando los botones de <b>pago por banco</b> o <b>pago con tarjeta</b> que aparecen a continuación.'
          : puedeTransferencia
          ? 'Estamos esperando tu pago. Puedes completarlo usando el botón de <b>pago por banco</b> que aparece a continuación.'
          : puedeTarjeta
          ? 'Estamos esperando tu pago. Puedes completarlo usando el botón de <b>pago con tarjeta</b> que aparece a continuación.'
          : 'El profesional te indicará cómo pagar.<br/>Contacta con él si tienes dudas.';

      const statusMessage =
      ch.status === 'pending'
        ? `<div class="note note-warn">
             ${pendingMessage}
           </div>`
        : ch.status === 'paid'
        ? invoice
          ? `<div class="note note-ok">
               ✅ <b>Pago recibido correctamente.</b> Tu ${docLabel} está disponible para descargar y ${docPron} hemos enviado por WhatsApp. Si tenemos tu correo, también ${docPron} recibirás por email.
             </div>`
          : `<div class="note note-ok">
               ✅ <b>Pago recibido correctamente.</b> Estamos generando tu ${docLabel}; ${docPron} recibirás en breve por WhatsApp y, si tenemos tu correo, también por email.
             </div>`
        : ch.status === 'failed'
        ? `<div class="note note-danger">
             ❌ No se ha podido completar el pago. Si lo deseas, ponte en contacto con tu proveedor para intentar de nuevo el cobro.
           </div>`
        : ch.status === 'expired'
        ? `<div class="note note-muted">
             ⏰ Este enlace de pago ha caducado. Pide a tu proveedor que te envíe un nuevo enlace si todavía quieres realizar el pago.
           </div>`
        : '';
  

  const simulateBlock =
    config.NODE_ENV !== 'production'
      ? `<details class="recibo-dev-simulacion"><summary>🔧 Simulación (solo dev)</summary>
         <form method="post" action="${BASE_URL}/dev/sim/pay/${ch.id}" class="recibo-dev-formulario">
           <button class="recibo-dev-boton-pago">Simular pago SCTinst</button>
         </form>
         <div class="recibo-dev-fila">
           <form method="post" action="${BASE_URL}/dev/sim/fail/${ch.id}">
             <button class="recibo-dev-boton-fallo">Simular fallo</button>
           </form>
           <form method="post" action="${BASE_URL}/dev/sim/expire/${ch.id}">
             <button class="recibo-dev-boton-caducidad">Simular expiración</button>
           </form>
         </div>
       </details>`
      : '';

  // SCRUM-1471 · las fechas de este recibo se pintan en la zona del NEGOCIO, con la misma forma
  // que la página pública (SCRUM-633). Sin `timeZone` salían del reloj del proceso (UTC en
  // Railway) y un pago de las 00:30 se imprimía con la víspera.
  const zonaDelNegocio = zonaDelMerchant((ch as any).merchant);
  const eventsList = (ch.events || [])
    .sort((a, b) => +new Date(a.ts) - +new Date(b.ts))
    .map(
      (e) =>
        `<li>${esc(e.type)} · ${esc(new Date(e.ts).toLocaleString(undefined, { timeZone: zonaDelNegocio }))}</li>`,
    )
    .join('');

  // Héroe de estado (estilo "Recibo de confianza")
  const SH: Record<string, { icon: string; title: string; cls: string }> = {
    paid:    { icon: '✓', title: 'Pago confirmado', cls: 'paid' },
    pending: { icon: '⏳', title: 'Pago pendiente',  cls: 'pending' },
    failed:  { icon: '✕', title: 'Pago fallido',    cls: 'failed' },
    expired: { icon: '⏰', title: 'Enlace caducado', cls: 'expired' },
    // SCRUM-1532b · literal FIRMADO en SCRUM-1532 c.22430. Sin esta fila caía a «Pago pendiente».
    cancelled: { icon: '✕', title: 'Este cobro se ha cancelado.', cls: 'expired' },
  };
  const sh = SH[ch.status] || SH.pending;
  const business = esc((ch as any).merchant?.legalName || (ch as any).merchant?.name || '');

  // A6.2: llegada RECIÉN pagado (retorno de Stripe `?card=success` o `?celebrate=1`
  // tras Bizum/transferencia) → check celebratorio animado (CSS puro, reduced-motion ok).
  // En visitas posteriores el recibo queda sobrio: la celebración es del momento.
  const celebrate =
    ch.status === 'paid' &&
    ((req.query as any).card === 'success' || (req.query as any).celebrate === '1');

  // R-1 (N3): en el recibo PAGADO mostrar fecha + método del pago.
  //
  // 🔴 SCRUM-397 · ESTO ENSEÑABA LA FECHA DEL REINTENTO. Cogía el evento `paid` MÁS RECIENTE, y
  // `psp.routes.ts` crea otro evento `paid` (marcado `duplicate: true`) cada vez que el webhook se
  // repite. En un cobro con reintento, el documento que se lleva el CLIENTE fechaba el pago el día
  // del reintento. Ahora sale del mismo sitio que la exportación y que el resto: la columna, y
  // para los cobros anteriores a ella el evento MÁS ANTIGUO — que es cuando se pagó.
  const fechaPago = fechaDeCobroDeCharge(ch);
  const methodLabel = (m?: string | null): string => {
    const s = String(m || '').toLowerCase();
    if (!s) return '';
    if (s.includes('card') || s.includes('stripe') || s.includes('tarjeta')) return 'Tarjeta';
    if (s.includes('bizum')) return 'Bizum';
    if (s.includes('mp') || s.includes('mercado')) return 'Mercado Pago';
    if (s.includes('transfer') || s.includes('sct') || s.includes('bank')) return 'Transferencia';
    return String(m);
  };
  const paidMeta =
    ch.status === 'paid'
      ? [
          fechaPago
            ? `Pagado el ${fechaPago.toLocaleDateString('es-ES', { timeZone: zonaDelNegocio, day: '2-digit', month: 'long', year: 'numeric' })}`
            : 'Pagado',
          methodLabel(ch.method),
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  const statusHero = `
    ${business ? `<div class="biz">${business}</div>` : ''}
    <div class="status-hero">
      <div class="status-icon ${sh.cls}${celebrate ? ' celebrate' : ''}">${sh.icon}</div>
      <div class="status-title">${celebrate ? '¡Pago completado!' : sh.title}</div>
      <div class="status-amount">${esc(formatMoneyEs(ch.amount, ch.currency))}</div>
      ${ch.concept ? `<div class="status-sub">${esc(ch.concept)}</div>` : ''}
      ${paidMeta ? `<div class="status-meta">${esc(paidMeta)}</div>` : ''}
    </div>`;

  // ── A2.5: valoración post-pago (versión LEGAL, sin review gating) ─────────
  // El feedback (estrellas + comentario) se guarda SIEMPRE en privado para el
  // merchant (Event del charge + timeline del cliente). El botón de reseña en
  // Google se muestra A TODOS si el merchant tiene URL — PROHIBIDO condicionarlo
  // a X estrellas (viola políticas de Google y normativa UE).
  const existingFb = (ch.events || []).find((e) => e.type === 'customer_feedback');
  const fbThanks = (req.query as any).fb === 'thanks' || !!existingFb;
  const reviewUrl = (ch as any).merchant?.googleReviewUrl || null;
  const googleBtn = reviewUrl
    ? `<a class="pay-btn pay-btn-primary" href="${esc(reviewUrl)}" target="_blank" rel="noopener">⭐ Déjale una reseña en Google</a>`
    : '';
  // A2.5: ESTRELLAS que abren directamente la reseña de Google. Sin gating por nota
  // (cualquier estrella lleva al MISMO formulario de Google) → cumple políticas Google/UE.
  const googleStars = reviewUrl
    ? `<div class="fb-gstars" role="group" aria-label="Dejar reseña en Google">${[1, 2, 3, 4, 5]
        .map(() => `<a href="${esc(reviewUrl)}" target="_blank" rel="noopener" aria-label="Dejar reseña en Google">★</a>`)
        .join('')}</div>`
    : '';
  const feedbackBlock =
    ch.status === 'paid'
      ? `
  ${etiquetaEstiloDePago('recibo-valoracion')}
  <div class="fb">
    ${fbThanks
      ? `<div class="fb-title">🙌 ¡Gracias por tu valoración!</div>
         ${googleBtn ? `<div class="fb-google">${googleBtn}</div>` : ''}`
      : `${reviewUrl
           ? `<div class="fb-title">¿Contento con el trabajo? 🙌</div>
              ${googleStars}
              <div class="fb-hint">Toca una estrella para dejar tu reseña en Google · solo 10 segundos ⭐</div>
              <div class="fb-or">O valóralo en privado para el profesional:</div>`
           : `<div class="fb-title">¿Qué tal fue el trabajo?</div>`}
         <form method="post" action="${BASE_URL}/recibo/${token}/feedback" id="fb-form">
           <input type="hidden" name="stars" id="fb-stars-input" value=""/>
           <div class="fb-stars" role="radiogroup" aria-label="Valoración de 1 a 5 estrellas">
             ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} estrella${n > 1 ? 's' : ''}">⭐</button>`).join('')}
           </div>
           <textarea name="comment" maxlength="500" placeholder="Cuéntale cómo fue (solo lo verá el profesional)"></textarea><br/>
           <button type="submit" class="fb-send">Enviar valoración</button>
         </form>
         ${etiquetaGuionDePago('recibo')}`}
  </div>`
      : '';

  // Detalles internos solo en desarrollo (no para el cliente)
  //
  // SCRUM-254: aquí había un `<a href="${BASE_URL}/charges/${ch.id}">Ver JSON</a>`. Era el ÚNICO
  // llamador de `GET /charges/:id` en todo el repo (medido sobre 452 ficheros), y esa ruta se
  // retiró por leer cross-merchant: buscaba solo por id, sin `merchantId`. Se quita el enlace
  // junto con la ruta — dejar un `<a>` apuntando a un 404 sería peor que no tenerlo.
  // La lista de eventos SE QUEDA: no dependía de esa ruta y sigue siendo útil en desarrollo.
  const devInternals =
    config.NODE_ENV !== 'production'
      ? `<hr class="recibo-dev-separador"/>
         <small>Dev · eventos del cobro</small>
         <ul class="recibo-dev-eventos">${eventsList || '<li>—</li>'}</ul>`
      : '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<link rel="stylesheet" href="/fonts/inter.css"/>
${etiquetaEstiloDePago('recibo')}
</head>
<body>
<div class="card">
  ${statusHero}
  ${statusMessage}
  ${ch.status === 'pending' ? `<div class="pay-stack">${payBtns}</div>` : ''}
  ${invBlock}
  ${mailBanner}
  ${feedbackBlock}
  <div class="recibo-pie"><small>Cobro #${ch.id} · Cliente: ${esc(nombreDelCliente ?? '—')}</small></div>
  ${simulateBlock}
  ${devInternals}
</div>
</body>
</html>`);
});

// GET /recibo/:token/pdf — descarga PÚBLICA del justificante/factura del cliente. Genera el PDF
// BAJO DEMANDA (mismo helper que el BO, ensureInvoicePdf) y lo sirve; así el cliente siempre
// puede descargarlo desde el recibo aunque no se hubiera generado antes. Público por token
// OPACO (SCRUM-74), igual que GET /recibo/:token (el cliente lo abre desde WhatsApp, sin login).
router.get('/:token/pdf', async (req, res) => {
  // SCRUM-1404g · CRUCE DE CARRIL DECLARADO (J2; SCRUM-1404 c.20932, sólo para este cambio). La
  // factura, fuera del `try` y con su comercio: el `catch` necesita los dos para saber si un
  // pendiente de sellado es de los que entran en la cadena (`esErrorSinSellar`).
  let invoice: any = null;
  const conComercio = { merchant: { select: { country: true, taxId: true } } };
  try {
    const ch = await prisma.charge.findUnique({ where: { receiptToken: req.params.token }, include: { events: true } });
    if (!ch || ch.status !== 'paid') return res.status(404).send(documentNotFoundHtml());
    // Localizar la factura ligada (por quote o evento 'invoiced'), igual que en GET /:token.
    const quote = await prisma.quote.findFirst({ where: { chargeId: ch.id } });
    if (quote) invoice = await prisma.invoice.findFirst({ where: { quoteId: quote.id }, include: conComercio });
    if (!invoice) {
      const invEv = [...(ch.events || [])].reverse().find((e) => e.type === 'invoiced' && (e as any).payload?.invoice_id);
      const invId = (invEv as any)?.payload?.invoice_id as number | undefined;
      if (invId) invoice = await prisma.invoice.findUnique({ where: { id: invId }, include: conComercio });
    }
    if (!invoice) return res.status(404).send(documentNotFoundHtml());
    const { diskPath, number } = await ensureInvoicePdf(invoice.id, prisma);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${number}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return fs.createReadStream(diskPath).pipe(res);
  } catch (err) {
    console.error('[GET /recibo/:token/pdf]', (err as any)?.message || err);
    // SCRUM-206 · esta ruta es PÚBLICA (solo la protege el token opaco de SCRUM-74), así que era
    // el clic del CLIENTE FINAL el que disparaba el fail-open y se llevaba un documento sin
    // huella. Ahora no sale nada — y no sale como 404, porque la factura existe: 409 con el copy
    // oficial, que no nombra sellado, huella ni VeriFactu (reglas 26 y 30).
    if (esErrorSinSellar(err, invoice?.number, invoice?.merchant)) {
      return res.status(409).send(documentoEnRegistroHtml(COPY_PUBLICO_SIN_SELLAR));
    }
    return res.status(500).send(documentNotFoundHtml());
  }
});

// POST /recibo/:token/feedback — A2.5: valoración del cliente tras pagar.
// Se guarda SIEMPRE en privado (Event del charge + timeline del cliente); la
// reseña de Google es independiente (sin gating). Idempotente por cobro.
router.post('/:token/feedback', async (req, res) => {
  const token = req.params.token;

  const charge = await prisma.charge.findUnique({
    where: { receiptToken: token },
    include: { events: true, customer: { select: { id: true, name: true } } },
  });
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (charge.status !== 'paid') return res.redirect(303, `/recibo/${token}`);

  const stars = Math.round(Number(req.body?.stars));
  const comment = String(req.body?.comment || '').slice(0, 500).trim();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.redirect(303, `/recibo/${token}`);
  }

  const existing = (charge.events || []).find((e) => e.type === 'customer_feedback');
  if (!existing) {
    await prisma.event.create({
      data: {
        chargeId: charge.id,
        type: 'customer_feedback',
        payload: { stars, comment: comment || null, ts: new Date().toISOString() } as any,
      },
    });
    if (charge.customerId) {
      const { recordCustomerEvent } = await import('../../../system/customerEvents.service');
      recordCustomerEvent({
        merchantId: charge.merchantId,
        customerId: charge.customerId,
        type: 'feedback',
        title: `⭐ ${stars}/5 — valoración del cliente tras el cobro #${charge.id}`,
        detail: comment || null,
      });
    }
  }

  return res.redirect(303, `/recibo/${token}?fb=thanks`);
});

export default router;
