// src/modules/billing/app/routes/payInvoice.routes.ts
// Selector de método de pago (tarjeta vía Stripe + transferencia vía PayByBank).
// Landing del botón de payment_request_es: /pay/invoice/:token
// Diseño "Recibo de confianza" (Impeccable: Stripe/Wise, mobile-first).
// SCRUM-85: identificado por Charge.receiptToken (patrón SCRUM-74), NO por el
// chargeId autoincremental — mismo token compartido con /recibo, /pay/card y /pay/bizum.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { comercioSuprimido } from '../../domain/comercioSuprimido'; // SCRUM-1573b
import { esc, formatMoneyEs } from '../../../../core/utils/utils';
import { PAGO_JS, RUTA_PAGO_JS, cacheDelGuionDePago, etiquetaGuionDePago } from './pagoNavegador'; // SCRUM-1647 (CSP paso 2)
import { cssDeHoja, RUTA_PAGO_CSS, cacheDelEstiloDePago, etiquetaEstiloDePago, paginaDeEstilo } from './pagoEstilo'; // SCRUM-1723 (style-src 'self')
import { formasDePagoActivas, type FormaDePago } from './formasDePagoActivas'; // SCRUM-1787u
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { pieDePresupuesto } from '../../../quotes/domain/presentacionIva'; // SCRUM-1787h: el desglose de la página del presupuesto
import { zonaDelMerchant } from '../../../../core/zonaDelMerchant'; // SCRUM-1787q: «Vence el» en la zona del negocio

const router = Router();

/**
 * SCRUM-1787h · EL DETALLE DE LÍNEAS DE LA FACTURA, COMO EN LA PÁGINA DEL PRESUPUESTO.
 *
 * Decisión del fundador (SCRUM-1787 c.22327, «1-Sí»): el cliente que abre el enlace de pago ve las
 * líneas de la factura. Se LEEN de la factura emitida (`Invoice.lines`); la emisión no se toca.
 *
 * Rótulos: ninguno nuevo. La tabla y el desglose son los de `quoteDecisionLanding.routes.ts`
 * (`renderQuoteDetail`): cabecera «Concepto · Cant. · Importe», importe de línea = cantidad × precio
 * (neto, el IVA va debajo), y las filas de `pieDePresupuesto` («Base imponible», «IVA (21%)» y, si hay
 * descuento, «Suma de líneas» y «Descuento») con el mismo `rotuloEnLaPagina`.
 *
 * 🔴 SÓLO SI CUADRA. La página dice «Importe a pagar» con el importe del COBRO. Si la suma del
 * desglose no es el total de la factura (suplidos, otro motor de redondeo: SCRUM-624) o el cobro no
 * es la factura entera, una tabla debajo diría otra cifra que la de arriba, y explicarlo pediría un
 * texto sin firmar (regla 39). En esos casos la página queda como estaba.
 */
function detalleDeLaFactura(
  invoice: { total: unknown; lines: unknown } | null,
  importeDelCobro: number,
  currency: string,
): string {
  const lineas: any[] = Array.isArray(invoice?.lines) ? (invoice!.lines as any[]) : [];
  if (lineas.length === 0) return '';
  const money = (n: number) => esc(formatMoneyEs(n, currency));
  const pie = pieDePresupuesto({ lineas, modo: 'sumar', nombreImpuesto: 'IVA' });
  const desdeBase = pie.filas.findIndex((f) => f.etiqueta === 'Base imponible:');
  if (desdeBase < 0) return '';
  const sumaDelDesglose = pie.filas.slice(desdeBase).reduce((s, f) => s + f.importe, 0);
  const totalFactura = Number(invoice!.total);
  const cuadra = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;
  if (!cuadra(sumaDelDesglose, totalFactura) || !cuadra(importeDelCobro, totalFactura)) return '';

  const rotuloEnLaPagina = (etiqueta: string) => {
    // «IVA 21%:» → «IVA (21%)», sin expresión regular (SCRUM-1325: ninguna mira texto sin declarar).
    const sinDosPuntos = etiqueta.endsWith(':') ? etiqueta.slice(0, -1) : etiqueta;
    if (sinDosPuntos.startsWith('IVA ') && sinDosPuntos.endsWith('%')) {
      return `IVA (${sinDosPuntos.slice(4)})`;
    }
    return sinDosPuntos;
  };
  // Una cabecera de apartado (SCRUM-655) viaja sin cantidad ni precio: concepto sí, importe vacío.
  const importeDeLinea = (l: any) => {
    const neto = Number(l?.qty) * Number(l?.price);
    return l?.qty != null && l?.price != null && Number.isFinite(neto) ? money(neto) : '';
  };
  return `
    <table class="lines-table">
      <thead><tr><th>Concepto</th><th>Cant.</th><th>Importe</th></tr></thead>
      <tbody>${lineas.map((l: any) => `
        <tr>
          <td>${esc(l?.concept ?? '')}</td>
          <td>${esc(l?.qty ?? '')}</td>
          <td>${importeDeLinea(l)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals-block">
      ${pie.filas.map((f) => `
      <div class="totals-row"><span>${esc(rotuloEnLaPagina(f.etiqueta))}</span><span>${money(f.importe)}</span></div>`).join('')}
    </div>`;
}

// SCRUM-1647 · el guion de las tres páginas de pago, servido desde 'self' (`script-src 'self'`). Dos
// tramos de ruta: ningún `/<algo>/:token` de los routers de /pay lo pisa. `immutable` sólo con la huella buena.
router.get(RUTA_PAGO_JS, (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', cacheDelGuionDePago(req.query?.v));
  return res.send(PAGO_JS);
});

// SCRUM-1723 · el CSS de las tres páginas de pago, servido desde 'self' (`style-src 'self'`). Una hoja
// por página, elegida por `?p=` de un conjunto cerrado: lo que no esté en él es 404.
router.get(RUTA_PAGO_CSS, (req, res) => {
  const pagina = paginaDeEstilo(req.query?.p);
  if (pagina === null) return res.status(404).end();
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', cacheDelEstiloDePago(pagina, req.query?.v));
  return res.send(cssDeHoja(pagina)); // SCRUM-1756b: también las del recibo y el portal
});

router.get('/invoice/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');

  const token = req.params.token;

  const charge = await prisma.charge.findUnique({
    where: { receiptToken: token },
    include: { merchant: true },
  });
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml()); // SCRUM-1573b
  const id = charge.id;

  // Pagado o vencido → recibo
  // SCRUM-1532b: un cobro cancelado tampoco se paga; el recibo dice por qué.
  if (charge.status === 'paid' || charge.status === 'expired' || charge.status === 'cancelled') {
    return res.redirect(303, `/recibo/${token}`);
  }

  // Nº de factura asociada (si existe), para dar contexto. SCRUM-1787h: también sus líneas y su total,
  // y SIEMPRE del comercio del cobro: sin `merchantId`, una factura de otro comercio con el mismo
  // `chargeId` pintaría aquí su número y, desde este ticket, sus líneas.
  const invoice = await prisma.invoice
    .findFirst({
      where: { chargeId: id, merchantId: charge.merchantId },
      select: { number: true, total: true, lines: true, dueDate: true },
    })
    .catch(() => null);

  const m = charge.merchant;
  const business = esc(m?.legalName || m?.name || 'Tu proveedor');
  const initial = esc((m?.name || m?.legalName || 'Y').trim().charAt(0).toUpperCase());
  const amount = esc(formatMoneyEs(charge.amount, charge.currency)); // A6.6: 2.383,70 €
  const concept = esc(charge.concept || '');
  const num = invoice?.number ? esc(invoice.number) : '';
  // Regla 24/26: J-… = justificante, jamás "factura"
  const invRef = num ? `${isReceiptNumber(invoice!.number) ? 'Justificante' : 'Factura'} ${num}` : '';
  // P1-2: el concepto del cobro a veces YA es "Factura CFxxxx"; no duplicar la
  // referencia. Si el concepto ya incluye el nº de factura, mostramos solo invRef.
  const conceptIsInvoiceRef = !!num && concept.includes(num);
  const subline = conceptIsInvoiceRef
    ? invRef
    : [concept, invRef].filter(Boolean).join(' · ');

  const detalleHtml = detalleDeLaFactura(invoice, Number(charge.amount), charge.currency);

  // SCRUM-1787q · «Vence el» (firmado, SCRUM-1787 c.22325 ①): la fecha CONGELADA al emitir la factura
  // (1787i), sólo si consta; nunca la del presupuesto. Formato y zona, los del recibo, la otra página
  // pública de esta familia («Pagado el …», receipt.routes.ts): día y mes largo, en la zona del negocio.
  // SCRUM-1787y · el día sin cero a la izquierda («5 de diciembre», no «05»): SCRUM-1787 c.22431.
  const vence = invoice?.dueDate ? new Date(invoice.dueDate) : null;
  const venceHtml = vence && !Number.isNaN(vence.getTime())
    ? `<div class="subline">Vence el ${esc(vence.toLocaleDateString('es-ES', { timeZone: zonaDelMerchant(m), day: 'numeric', month: 'long', year: 'numeric' }))}</div>`
    : '';

  // ── A2.1: métodos disponibles + orden por la matriz W4 (por importe) ──
  // SCRUM-1787u · el CÁLCULO (qué vías están activas para este comercio y este importe, y en qué
  // orden) vive en `formasDePagoActivas`, que también usa J1 al emitir (GO SCRUM-1787 c.22401).
  // Aquí sólo se pinta. Las razones de cada condición (SCRUM-3, 893, 910, W4) viajaron con él.
  const amountNum = Number(charge.amount);
  // Selector al crear (quote/charge.payMethods): si el PRO limitó los métodos para ESTE cobro.
  const allowed = Array.isArray(charge.payMethods) ? (charge.payMethods as string[]) : null;

  type Method = { key: FormaDePago; href: string; ico: string; title: string; sub: string };
  const metodo: Record<FormaDePago, Method> = {
    card: { key: 'card', href: `/pay/card/${token}`, ico: '💳', title: 'Pagar con tarjeta', sub: 'Visa · Mastercard · al instante' },
    bizum: { key: 'bizum', href: `/pay/bizum/${token}`, ico: '📲', title: 'Pagar por Bizum', sub: 'Desde la app de tu banco' },
    // Comparte ruta con la tarjeta A PROPÓSITO: el Bizum automático vive DENTRO del
    // mismo Checkout de Stripe (dynamic payment methods), no en una pantalla propia.
    // Darle una ruta suya obligaría a fijar `payment_method_types`, que Stripe
    // desaconseja y que congelaría la lista de métodos (ver bizumCharge.ts).
    bizum_auto: { key: 'bizum_auto', href: `/pay/card/${token}`, ico: '⚡', title: 'Bizum al instante', sub: 'Se confirma solo, sin esperar' },
    // SCRUM-90: /pay/bank tokenizado (mismo Charge.receiptToken).
    transfer: { key: 'transfer', href: `/pay/bank/${token}`, ico: '🏦', title: 'Transferencia bancaria', sub: 'Con los datos y el concepto exacto' },
  };

  const ordered = formasDePagoActivas({ merchant: m, importe: amountNum, moneda: charge.currency, permitidas: allowed })
    .map((k) => metodo[k]);

  const methodsHtml = ordered.map((mm, i) => `
    <a class="method" href="${mm.href}">
      <span class="method-ico">${mm.ico}</span>
      <span class="method-txt">
        <span class="method-title">${mm.title}</span>
        <span class="method-sub">${mm.sub}</span>
        ${i === 0 && ordered.length > 1 ? '<span class="method-chip">Recomendado</span>' : ''}
      </span>
      <span class="chev">›</span>
    </a>`).join('');

  // SCRUM-893b · EL PIE SÓLO NOMBRA A STRIPE SI ALGO DE LO QUE SE PINTA PASA POR STRIPE.
  // Mientras la tarjeta se ofrecía a todos (el defecto de SCRUM-893), «Procesado por Stripe ·
  // Nunca vemos los datos de tu tarjeta» era verdad en todas las páginas. Desde que la tarjeta
  // sólo sale con Connect, un negocio con transferencia o Bizum manual —o sin ninguna vía— le
  // seguía diciendo a la clienta que Stripe procesaba un pago que Stripe no toca. Se mira la
  // lista YA FILTRADA, no `hasCard`: el Bizum automático también va por `/pay/card`, y el PRO
  // puede haber quitado la tarjeta de ESTE cobro. No hay texto nuevo: es el mismo literal, que
  // deja de pintarse donde no es cierto.
  const pasaPorStripe = ordered.some((mm) => mm.key === 'card' || mm.key === 'bizum_auto');

  // Si el logo no carga (URL rota, file://…), se oculta y no rompe la landing: lo hace el guion de
  // `pagoNavegador.ts` (SCRUM-1647), que escucha el `error` del `.logo-img` sin manejador en línea.
  const logoHtml = m?.logoUrl
    ? `<img class="logo-img" src="${esc(m.logoUrl)}" alt="${business}"/>`
    : `<div class="logo-mark">${initial}</div>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/><!-- SCRUM-184: sin esto el navegador pide /favicon.ico y se lleva un 404 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#16a34a"/>
  <title>Pagar ${amount} — YaQu</title>
  <link rel="stylesheet" href="/fonts/inter.css"/>
  ${etiquetaGuionDePago('factura')}
  ${etiquetaEstiloDePago('factura')}
</head>
<body>
  <div class="card">
    <div class="biz">
      ${logoHtml}
      <div class="biz-name">${business}</div>
    </div>

    <div class="amount-wrap">
      <div class="amount-label">Importe a pagar</div>
      <div class="amount">${amount}</div>
      ${subline ? `<div class="subline">${subline}</div>` : ''}
      ${venceHtml}
    </div>
    ${detalleHtml}

    <div class="methods-label">Elige cómo pagar</div>
    ${methodsHtml || `
    <div class="pago-sin-metodos">
      El profesional te indicará cómo pagar.<br/>Contacta con él si tienes dudas.
    </div>`}

    <div class="trust">
      <span class="trust-main">
        <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Pago seguro y cifrado
      </span>
      ${pasaPorStripe ? '<div class="trust-sub">Procesado por Stripe · Nunca vemos los datos de tu tarjeta</div>' : ''}
    </div>
  </div>
</body>
</html>`);
});

export default router;
