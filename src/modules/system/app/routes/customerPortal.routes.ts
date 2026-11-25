// src/modules/system/app/routes/customerPortal.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { formatMoneyEs, formatImporteEs, calcTotal, type QuoteLine } from '../../../../core/utils/utils'; // A22.1: dinero es-ES con símbolo
import { capitulos, lineasQueSuman } from '../../../quotes/domain/apartados'; // SCRUM-1568 · SCRUM-1807c: capitulos
import { getLocale } from '../../../../core/i18n/locales';
import { esc } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';
import { sendWhatsAppText } from '../../../../integrations/whatsapp';
import { normalizePhone } from '../../../../core/utils/utils';
import { recordCustomerEvent } from '../../customerEvents.service';
import { ensureChargeReceiptToken } from '../../../../lib/invoicing';
import { ensureQuoteDecisionToken } from '../../../quotes/domain/quoteToken.service'; // SCRUM-95
import { cardChargeMode } from '../../../billing/domain/cardCharge'; // SCRUM-893
import { comercioSuprimido } from '../../../billing/domain/comercioSuprimido'; // SCRUM-1573b
import { zonaDelMerchant, diaNaturalEn } from '../../../../core/zonaDelMerchant'; // SCRUM-1018 · 1471b
import { getEmissionMode } from '../../../invoicing/domain/emission.service'; // SCRUM-1567b
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service'; // SCRUM-1567b
import { etiquetaEstiloDePago } from '../../../billing/app/routes/pagoEstilo'; // SCRUM-1756b (style-src 'self')
import { claseDeEtiquetaDelPortal } from '../../../billing/app/routes/reciboPortalEstilo'; // SCRUM-1756b
import { etiquetaGuionDePago } from '../../../billing/app/routes/pagoNavegador'; // SCRUM-1756c (script-src 'self')

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado',
  pending: 'Pendiente', paid: 'Pagada', expired: 'Caducada',
};

function pill(status: string) {
  const label = STATUS_LABELS[status] ?? status;
  return `<span class="portal-pill ${claseDeEtiquetaDelPortal(status)}">${esc(label)}</span>`;
}

function fmt(n: number) {
  return formatImporteEs(n);
}

// SCRUM-1471 · la fecha corta, en la zona del NEGOCIO: la misma forma que la página pública
// (SCRUM-633). Sin `timeZone` salía del reloj del proceso (UTC en Railway) y un pago de las 00:30
// se leía con la víspera. La zona llega ya resuelta por `zonaDelMerchant`.
function dateShort(d: Date | string, zona: string) {
  return new Date(d).toLocaleDateString('es', { timeZone: zona, day: '2-digit', month: 'short', year: 'numeric' });
}

// SCRUM-1471b · LA FECHA DE LA FACTURA ES EL DÍA NATURAL DE SU REGISTRO. Decisión del fundador
// (SCRUM-1470 c.20530, «Sí, el mismo día»): su gemelo, la «Fecha:» del PDF de la factura (`dateStr`,
// SCRUM-1470c), y la `FechaExpedicionFactura` del registro salen de `diaNaturalEn(createdAt, zona)`.
// El día se pide a ESA función, no a `toLocaleDateString` con zona: así el portal no puede decir otro
// día que el registro aunque las dos formas de calcularlo divergieran. Sólo se le pone la forma corta.
// Sin zona declarada, `zonaDelMerchant` da UTC y la tarjeta dice lo que decía.
function fechaDeLaFactura(d: Date | string, zona: string) {
  const dia = new Date(`${diaNaturalEn(new Date(d), zona)}T00:00:00Z`);
  return dia.toLocaleDateString('es', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
}

function css() {
  return `
<link rel="stylesheet" href="/fonts/inter.css"/>
${etiquetaEstiloDePago('portal')}`;
}

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/><!-- SCRUM-184: sin esto el navegador pide /favicon.ico y se lleva un 404 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  ${css()}
</head>
<body>
${body}
<p class="pf-footer">Hecho con <a href="${BASE_URL}" class="portal-pie-enlace">YaQu</a></p>
${etiquetaGuionDePago('portal')}
</body>
</html>`;
}

/**
 * SCRUM-1568 · el importe de UNA línea del presupuesto, con su descuento de línea y su IVA.
 *
 * Aquí ponía `qty||1 × price||0 × (1+tax)`: sin el `dto`, mientras el total de la tarjeta sí lo
 * lleva. Con 2 × 100 € al 21 % y un 10 % de descuento, la línea decía 242,00 € y el total 217,80 €,
 * y el portal no tiene pie que explique la resta. Decisión del fundador (c.21043): la línea va CON
 * el descuento, sin fila nueva. Por eso no hay cuenta propia: es `calcTotal` sobre la línea sola,
 * el MISMO término (`precioConDto` × IVA) con el que se guardó el total.
 *
 * Una cabecera de apartado es un título y sale VACÍA, como en la página de firma y en el PDF
 * (c.21043, punto 2); antes salía «0,00 €». Se reconoce por su marca, con `lineasQueSuman`.
 */
function importeDeLineaDelPresupuesto(l: QuoteLine, currency: string): string {
  if (lineasQueSuman([l]).length === 0) return '';
  const importe = calcTotal([l]);
  return Number.isFinite(importe) ? formatMoneyEs(importe, currency) : '';
}

/**
 * SCRUM-1624b · la fila «Descuento global» de la tarjeta del presupuesto, o `null` si no hay.
 *
 * Con SCRUM-1568 cada línea lleva su descuento de LÍNEA, pero el global sólo lo restaba el total:
 * con 20 € de global, las filas sumaban 278,30 € y el total decía 254,10 €. Firma del fundador
 * (SCRUM-1624 c.21094): una fila más, la PRIMERA, con el rótulo de la tarjeta de factura, en
 * negativo y CON IVA, y su importe es la diferencia entre dos `calcTotal` —la función que guardó
 * el total—, sin cuenta propia. El rótulo es el de `invoiceLines.service.ts`, que no se exporta
 * porque es camino de emisión (regla 38); scrum1624b comprueba que los dos dicen lo mismo.
 */
function filaDescuentoGlobalDelPresupuesto(lineas: QuoteLine[], global: unknown): { concepto: string; importe: number } | null {
  if (global == null || global === '') return null;
  const sinGlobal = calcTotal(lineas);
  const conGlobal = calcTotal(lineas, String(global));
  if (!(conGlobal < sinGlobal)) return null;
  return { concepto: 'Descuento global', importe: Math.round((conGlobal - sinGlobal) * 100) / 100 };
}

/**
 * SCRUM-1786g · las filas de la tarjeta del presupuesto, con «Total del apartado» bajo cada apartado.
 *
 * Literal firmado en SCRUM-1786 c.22269; lanzado como en el PDF (1786f1, c.22329). El criterio es
 * el del PDF (`pdf.service.ts`, `generateQuotePdf`): una cabecera es la línea que `lineasQueSuman`
 * deja fuera, y sus líneas son las que la siguen hasta la próxima cabecera; las de antes de la
 * primera no son de ningún apartado. SCRUM-1807c: el recorrido ya no es una COPIA del del PDF; los
 * dos lo leen de `capitulos()` (`apartados.ts`). La cifra es `calcTotal` de esas líneas: en el portal cada línea
 * va CON IVA y con su descuento de línea, y el total de la tarjeta es `calcTotal` de todas, así que
 * la fila suma lo que el cliente ve encima. Sin cabeceras devuelve las líneas tal cual.
 */
function filasConTotalDelApartado(lineas: QuoteLine[]): Array<{ linea: QuoteLine } | { totalDelApartado: number }> {
  const filas: Array<{ linea: QuoteLine } | { totalDelApartado: number }> = [];
  for (const { cabecera, lineas: delApartado } of capitulos(lineas)) {
    if (cabecera) filas.push({ linea: cabecera });
    for (const l of delApartado) filas.push({ linea: l });
    if (cabecera) filas.push({ totalDelApartado: calcTotal(delApartado) });
  }
  return filas;
}

// ── GET /cliente/:token ──────────────────────────────────────────────────
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: {
      merchant: {
        // SCRUM-893: `connectStatus`, `stripeAccountId` y `flags` entran para poder preguntar si
        // este negocio puede cobrar con tarjeta HOY. Sin ellos la pregunta no se podía hacer, y
        // por eso el botón «Pagar ahora» se pintaba sin mirar nada. Es lectura de tres columnas
        // más: ni esquema, ni camino de cobro.
        select: { id: true, email: true, name: true, legalName: true, logoUrl: true, whatsappPhone: true, country: true,
          connectStatus: true, stripeAccountId: true, flags: true, timezone: true,
          // SCRUM-1567b · `getEmissionMode` lo pide (SCRUM-1585): con el flag en ON, un SII en «Sí»
          // o «No consta» también es `receipt`, y su portal tampoco habla de facturas.
          llevaLibrosPorSii: true },
      },
    },
  });

  if (!customer) {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(
      page('Portal no encontrado',
        '<div class="portal-enlace-no-valido">Este enlace no es válido o ha expirado.</div>'
      )
    );
  }

  const [quotes, invoices, proximoJob] = await Promise.all([
    prisma.quote.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: { customerId: customer.id },
      include: { charge: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // SCRUM-1018: la PRÓXIMA visita agendada, si hay una — GO de Javier (comentario 16610),
    // sin foto y con franja de 1h EMPEZANDO en `scheduledAt` (no centrada: el profesional agenda
    // pensando en el inicio). Solo `agendado`/`en_curso` y con fecha en el futuro: una visita ya
    // pasada que el profesional no cerró no es "tu visita", y por eso no basta con `scheduledAt`
    // no nulo (SCRUM-1018.md §4).
    prisma.job.findFirst({
      // regla 2: `merchantId` en la propia consulta, no solo heredado de `customer` (SCRUM-243).
      where: { merchantId: customer.merchantId, customerId: customer.id, scheduledAt: { gte: new Date() }, status: { in: ['agendado', 'en_curso'] } },
      orderBy: { scheduledAt: 'asc' },
      // `select`, no `include` (SCRUM-860: ninguna lectura que llegue a una respuesta sin nombrar
      // sus columnas) — solo lo que el portal pinta, nunca el Job entero.
      select: {
        scheduledAt: true,
        assignedUserId: true,
        // SCRUM-650: JobAssignee es el destino final; se lee primero y se cae a `assignedUserId`
        // solo si no hay ningún asignado por la tabla nueva (los dos sitios pueden discrepar
        // mientras esa migración no esté completa). Un job puede tener varios asignados; el
        // portal es singular ("Tu técnico"), así que se enseña el primero asignado.
        assignees: { orderBy: { assignedAt: 'asc' }, take: 1, select: { teamMember: { select: { name: true } } } },
      },
    }),
  ]);

  let nombreTecnico: string | null = null;
  if (proximoJob) {
    nombreTecnico = proximoJob.assignees[0]?.teamMember?.name ?? null;
    if (!nombreTecnico && proximoJob.assignedUserId) {
      // findFirst, no findUnique: TeamMember no tiene unicidad compuesta con merchantId, y regla 2
      // pide filtrarlo en la propia consulta (convención de team.service.ts/notasDelCliente.ts).
      const tm = await prisma.teamMember.findFirst({ where: { id: proximoJob.assignedUserId, merchantId: customer.merchantId }, select: { name: true } });
      nombreTecnico = tm?.name ?? null;
    }
  }

  // SCRUM-85: token OPACO por cobro pendiente — NUNCA el chargeId en el botón "Pagar ahora".
  const payTokens = new Map<number, string>();
  for (const inv of invoices) {
    if (inv.status === 'pending' && inv.charge?.id && !payTokens.has(inv.charge.id)) {
      payTokens.set(inv.charge.id, await ensureChargeReceiptToken(inv.charge.id, prisma));
    }
  }

  // SCRUM-95: token OPACO por presupuesto enviado — NUNCA el quote.id en el botón
  // "Ver y responder" (mismo motivo que payTokens arriba: sexta puerta de la misma fuga).
  const quoteTokens = new Map<number, string>();
  for (const q of quotes) {
    if (q.status === 'sent') {
      quoteTokens.set(q.id, await ensureQuoteDecisionToken(q.id, prisma));
    }
  }

  const m          = customer.merchant!;
  // SCRUM-893: una sola vez para toda la página. Si se preguntara dentro del bucle de facturas,
  // dos filas del mismo merchant podrían acabar contestando distinto el día que alguien toque el
  // criterio — y el portal enseñaría el botón en una factura y no en la de al lado.
  // SCRUM-1573b · un comercio suprimido no ofrece ninguna vía de cobro (c.21057): el portal sigue abierto.
  const puedeTarjeta = !comercioSuprimido(m) && cardChargeMode(m) !== 'refuse';
  // SCRUM-1567b · un comercio en `receipt` no emite ningún documento (SCRUM-1027): su portal no
  // habla de facturas. Firmado en SCRUM-1567 c.21121; con el flag en ON el portal sigue como estaba.
  const sinFacturas = getEmissionMode(m) === 'receipt';
  const mName      = esc(m.legalName || m.name || 'Tu proveedor');
  const initial    = esc((m.name || m.legalName || 'Y').trim().charAt(0).toUpperCase());
  const logoHtml   = m.logoUrl
    ? `<img class="pf-logo" src="${esc(m.logoUrl)}" alt="logo"/>`
    : `<div class="portal-inicial">${initial}</div>`;

  // A22.1: el portal habla el idioma del documento del país (ES → "Presupuesto")
  const locale = getLocale((customer.merchant as any)?.country);
  // SCRUM-1471: una sola vez para toda la página, como `puedeTarjeta`.
  const zonaDelNegocio = zonaDelMerchant(m);

  // ── Cotizaciones ────────────────────────────────────────────────────────
  const quotesHtml = quotes.length
    ? quotes.map((q) => {
        const lineasDelPresupuesto = Array.isArray(q.lines) ? q.lines as any[] : [];
        const hasLines = lineasDelPresupuesto.length > 0;
        // SCRUM-1624b · P3 la fila va la primera; P4 no se cuenta en «Ver detalles (N líneas)».
        const filaDescuentoGlobal = hasLines ? filaDescuentoGlobalDelPresupuesto(lineasDelPresupuesto, q.discountGlobalAmount) : null;
        const nLineas = lineasDelPresupuesto.length;
        const linesHtml = hasLines
          ? `<div class="pf-lines">
              <button class="pf-lines-toggle">
                <span class="pf-chevron">▼</span> Ver detalles (${nLineas} línea${nLineas !== 1 ? 's' : ''})
              </button>
              <div class="pf-lines-body">
                ${filaDescuentoGlobal ? `<div class="pf-line-row">
                    <span class="pf-line-concept">${esc(filaDescuentoGlobal.concepto)}</span>
                    <span class="pf-line-amount">${formatMoneyEs(filaDescuentoGlobal.importe, q.currency)}</span>
                  </div>` : ''}
                ${filasConTotalDelApartado(lineasDelPresupuesto).map((f) => {
                  if ('totalDelApartado' in f) {
                    return `<div class="pf-line-row pf-apartado-total">
                    <span class="pf-apartado-total-concepto">Total del apartado</span>
                    <span class="pf-apartado-total-importe">${formatMoneyEs(f.totalDelApartado, q.currency)}</span>
                  </div>`;
                  }
                  const l: any = f.linea;
                  return `<div class="pf-line-row">
                    <span class="pf-line-concept">${esc(l.concept||'')}</span>
                    <span class="pf-line-amount">${importeDeLineaDelPresupuesto(l, q.currency)}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>` : '';
        // SCRUM-806 · el botón NO sale de `q.pdfUrl`. Esa columna la escribe la ruta de ADMIN
        // con su propia URL (`/admin/quotes/<id>/pdf`), así que el cliente pulsaba y recibía
        // `401 {"error":"not_authenticated"}` — medido, en la pantalla donde decide si firma.
        //
        // Se usa el `decisionToken` que YA tiene la fila y que este portal ya reparte en «Ver y
        // responder» (SCRUM-95: token opaco, nunca el id). No se acuña ninguno nuevo: si no lo
        // tiene —un borrador que nunca se envió— el botón NO se pinta, que es preferible a
        // pintarlo hacia un sitio donde el cliente no puede entrar.
        const pdfToken  = quoteTokens.get(q.id) ?? q.decisionToken;
        const btnPdf    = pdfToken ? `<a class="pf-btn pf-btn-pdf" href="/pay/quote/${pdfToken}/pdf" target="_blank">📄 Ver PDF</a>` : '';
        const btnAccept = q.status === 'sent' ? `<a class="pf-btn pf-btn-pay" href="/pay/quote/${quoteTokens.get(q.id)}/accept">✅ Ver y responder</a>` : '';
        const hasActions = btnAccept || btnPdf;
        return `
          <div class="pf-card">
            <div class="pf-card-body">
              <div class="pf-card-row">
                <div>
                  <div class="pf-card-title">${locale.quote} #${q.quoteNumber ?? q.id}</div>
                  <div class="pf-card-meta">${dateShort(q.createdAt, zonaDelNegocio)}</div>
                </div>
                <div>
                  <div class="pf-card-amount">${formatMoneyEs(Number(q.total), q.currency)}</div>
                  ${pill(q.status)}
                </div>
              </div>
              ${hasActions ? `<div class="portal-acciones">${btnAccept}${btnPdf}</div>` : ''}
            </div>
            ${linesHtml}
          </div>`;
      }).join('')
    : `<p class="pf-empty">No hay ${locale.quotePlural.toLowerCase()} aún.</p>`;

  // ── Facturas ─────────────────────────────────────────────────────────────
  const invoicesHtml = invoices.length
    ? invoices.map((inv) => {
        const lines = inv.lines && Array.isArray(inv.lines) ? inv.lines as any[] : [];
        const linesHtml = lines.length > 0
          ? `<div class="pf-lines">
              <button class="pf-lines-toggle">
                <span class="pf-chevron">▼</span> Ver detalles (${lines.length} línea${lines.length !== 1 ? 's' : ''})
              </button>
              <div class="pf-lines-body">
                ${lines.map((l: any) => {
                  const total = Number(l.qty||1) * Number(l.price||0) * (1 + Number(l.tax||0));
                  return `<div class="pf-line-row">
                    <span class="pf-line-concept">${esc(l.concept||'')}</span>
                    <span class="pf-line-amount">${formatMoneyEs(total, inv.currency)}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>` : '';
        const pdfUrl = inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF'
          ? (inv.pdfUrl.startsWith('http') ? inv.pdfUrl : BASE_URL + inv.pdfUrl)
          : null;
        // SCRUM-1567b · un J- antiguo en un comercio sin facturas es un justificante, y así se llama.
        const esJustificante = sinFacturas && isReceiptNumber(inv.number);
        const btnPdf  = pdfUrl ? `<a class="pf-btn pf-btn-pdf" href="${esc(pdfUrl)}" target="_blank">${esJustificante ? '📄 Descargar justificante' : '📄 Descargar factura'}</a>` : '';
        const payToken = inv.charge?.id ? payTokens.get(inv.charge.id) : undefined;
        // SCRUM-893 · LA TERCERA PUERTA. «Pagar ahora» lleva a /pay/card y tampoco miraba si el
        // negocio puede cobrar con tarjeta: un merchant sin Stripe Connect mandaba a su cliente a
        // un 409 desde su propio portal. Misma pregunta y mismo dominio que las otras dos.
        const btnPay  = inv.status === 'pending' && payToken && puedeTarjeta
          ? `<a class="pf-btn pf-btn-pay" href="/pay/card/${payToken}">💳 Pagar ahora</a>`
          : '';
        const hasActions = btnPay || btnPdf;
        return `
          <div class="pf-card">
            <div class="pf-card-body">
              <div class="pf-card-row">
                <div>
                  <div class="pf-card-title">${esJustificante ? 'Justificante' : 'Factura'} ${esc(inv.number)}</div>
                  <div class="pf-card-meta">${fechaDeLaFactura(inv.createdAt, zonaDelNegocio)}${inv.paidAt ? ' · Pagada ' + dateShort(inv.paidAt, zonaDelNegocio) : ''}</div>
                </div>
                <div>
                  <div class="pf-card-amount">${formatMoneyEs(Number(inv.total), inv.currency)}</div>
                  ${pill(inv.status)}
                </div>
              </div>
              ${hasActions ? `<div class="portal-acciones">${btnPay}${btnPdf}</div>` : ''}
            </div>
            ${linesHtml}
          </div>`;
      }).join('')
    : '<p class="pf-empty">No hay facturas aún.</p>';

  // ── Tu visita (SCRUM-1018: franja + nombre, sin foto — literal firmado en el comentario 16610) ──
  const visitaHtml = (() => {
    if (!proximoJob?.scheduledAt) return '';
    const zona = zonaDelMerchant(m);
    const inicio = new Date(proximoJob.scheduledAt);
    const fin = new Date(inicio.getTime() + 60 * 60 * 1000); // GO: 1h desde el inicio, no centrada
    const fmtHora = (d: Date) => new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: zona }).format(d);
    const franja = `entre las ${fmtHora(inicio)} y las ${fmtHora(fin)}`;
    const linea = nombreTecnico ? `${esc(nombreTecnico)} · ${franja}` : franja;
    return `<div class="pf-section">
        <div class="pf-section-title">Tu visita</div>
        <div class="pf-card"><div class="pf-card-body">
          <div class="pf-card-title portal-sin-margen-inferior">${linea}</div>
        </div></div>
      </div>`;
  })();

  // ── Botón WhatsApp para contactar ────────────────────────────────────────
  const waPhone    = m.whatsappPhone ? normalizePhone(m.whatsappPhone) : null;
  const contactHtml = waPhone
    ? `<div class="pf-section">
        <div class="pf-section-title">Contacto</div>
        <div class="pf-contact-row">
          <a class="pf-wa-btn" href="https://wa.me/${esc(waPhone.replace('+',''))}" target="_blank">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.52.15-.17.2-.29.3-.49.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.57-.49-.49-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.02 1-1.02 2.43 0 1.43 1.04 2.82 1.19 3.01.15.2 2.05 3.13 4.97 4.39.7.3 1.24.48 1.67.61.7.22 1.34.19 1.84.12.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.26.17-1.39-.07-.12-.27-.19-.57-.34z"/><path d="M12 0C5.37 0 0 5.37 0 12c0 2.1.54 4.07 1.49 5.79L.06 23.3a.75.75 0 0 0 .94.93l5.57-1.45A11.95 11.95 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0zm0 21.75A9.72 9.72 0 0 1 6.7 20.1l-.37-.23-3.85 1 1.01-3.77-.25-.39A9.72 9.72 0 0 1 2.25 12C2.25 6.62 6.62 2.25 12 2.25S21.75 6.62 21.75 12 17.38 21.75 12 21.75z"/></svg>
            WhatsApp
          </a>
        </div>
      </div>`
    : '';

  const requestUrl = `${BASE_URL}/cliente/${token}/quote-request`;

  const html = page(`Portal de ${esc(customer.name)} · ${mName}`, `
    <div class="pf-header">
      ${logoHtml}
      <div>
        <div class="pf-brand">${mName}</div>
        <div class="pf-brand-sub">Tu portal de cliente</div>
      </div>
    </div>
    <div class="pf-main">
      <div class="pf-greeting">Hola, ${esc(customer.name)} 👋</div>
      <div class="pf-greeting-sub">${sinFacturas ? 'Aquí tienes tus presupuestos.' : `Aquí tienes tus ${locale.quotePlural.toLowerCase()}, facturas y pagos.`}</div>

      ${visitaHtml}

      <!-- Solicitar presupuesto -->
      <div class="pf-section">
        <button class="pf-request-btn" id="pf-req-btn">✏️ Solicitar nuevo presupuesto</button>
        <div class="pf-request-form" id="pf-req-form" data-url="${esc(requestUrl)}">
          <label class="pf-request-label">Describe brevemente el trabajo que necesitas:</label>
          <textarea class="pf-request-textarea" id="pf-req-ta"
            placeholder="Ej. Quiero reparar una gotera en el baño y revisar las tuberías del suelo..."></textarea>
          <button class="pf-request-submit" id="pf-req-submit">✅ Enviar solicitud</button>
          <button class="pf-request-cancel" id="pf-req-cancel">Cancelar</button>
        </div>
        <div class="pf-success portal-oculto" id="pf-req-success">
          ✅ ¡Solicitud enviada! Te contactaremos pronto.
        </div>
      </div>

      ${contactHtml}

      <div class="pf-section">
        <div class="pf-section-title">${locale.quotePlural}</div>
        ${quotesHtml}
      </div>

      ${!sinFacturas ? `<div class="pf-section">
        <div class="pf-section-title">Facturas</div>
        ${invoicesHtml}
      </div>` : invoices.length ? `<div class="pf-section">
        ${invoicesHtml}
      </div>` : ''}
    </div>
  `);

  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// ── POST /cliente/:token/quote-request ─────────────────────────────────
router.post('/:token/quote-request', async (req, res) => {
  const { token } = req.params;
  const description = String(req.body?.description || '').trim();

  if (!description) return res.status(400).json({ error: 'description_required' });
  if (description.length > 2000) return res.status(400).json({ error: 'too_long' });

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: { merchant: { select: { name: true, whatsappPhone: true } } },
  });

  if (!customer) return res.status(404).json({ error: 'not_found' });

  try {
    // Guardar la solicitud
    await prisma.quoteRequest.create({
      data: {
        merchantId:  customer.merchantId,
        customerId:  customer.id,
        description,
        status:      'pending',
      },
    });

    // ENT-3: historial
    recordCustomerEvent({
      merchantId: customer.merchantId,
      customerId: customer.id,
      type: 'quote_requested',
      title: 'El cliente solicitó un presupuesto',
      detail: description.length > 140 ? description.slice(0, 140) + '…' : description,
    });

    // Notificar al profesional por WhatsApp (fire-and-forget)
    const mPhone = normalizePhone(customer.merchant?.whatsappPhone);
    if (mPhone) {
      const trimmed = description.length > 500
        ? description.slice(0, 500) + '…'
        : description;
      sendWhatsAppText({
        to: mPhone,
        merchantId: customer.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
        text: `📋 *Nueva solicitud de presupuesto*\n\n👤 *Cliente:* ${customer.name}\n\n📝 *Descripción:*\n"${trimmed}"\n\nRevísala en tu panel 👉 ${BASE_URL}/dashboard/#quote-requests`,
      }).catch((e) => console.error('[quoteRequest] WA error:', e?.message));
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[POST /cliente/:token/quote-request]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
