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
import { PAGO_CSS, RUTA_PAGO_CSS, cacheDelEstiloDePago, etiquetaEstiloDePago, paginaDeEstilo } from './pagoEstilo'; // SCRUM-1723 (style-src 'self')
import { isFlagEnabled } from '../../../../core/flags';
import { bizumAutoDisponible } from '../../domain/bizumCharge'; // SCRUM-3
import { cardChargeMode } from '../../domain/cardCharge'; // SCRUM-893
import { transferenciaDisponible } from '../../domain/transferenciaDisponible'; // SCRUM-910
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';

const router = Router();

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
  return res.send(PAGO_CSS[pagina]);
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
  if (charge.status === 'paid' || charge.status === 'expired') {
    return res.redirect(303, `/recibo/${token}`);
  }

  // Nº de factura asociada (si existe), para dar contexto
  const invoice = await prisma.invoice
    .findFirst({ where: { chargeId: id }, select: { number: true } })
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

  // ── A2.1: métodos disponibles + orden por la matriz W4 (por importe) ──
  const amountNum = Number(charge.amount);
  // SCRUM-910 · la condición era `!!(m?.iban || m?.clabe)` y NO MIRABA EL PAÍS. Un negocio ES con
  // sólo CLABE veía «Transferencia bancaria» y aterrizaba en `/pay/bank`, que sólo pinta la CLABE
  // si el país es MX — así que le decía que el profesional no había configurado su cuenta. Se
  // pregunta al dominio, que replica la regla de la página destino y está atado a ella por test.
  const hasTransfer = transferenciaDisponible(m);

  // SCRUM-893 · SE PREGUNTA, NO SE SUPONE. Hasta hoy esto era
  //     `!connectFlag ? true : (connectStatus === 'active' || isDemoMerchant(m))`
  // y con `PAYMENTS_CONNECT_ENABLED` OFF —su valor por defecto— la primera rama ganaba SIEMPRE:
  // la tarjeta se ofrecía a todos, incluidos los merchants que se comen un 409 al pulsarla. La
  // clienta se quedaba en un bucle: única opción, RECOMENDADO, 409, «ver otras formas» → aquí.
  //
  // Ahora se le pregunta al MISMO dominio que decide en la puerta de cobro, con su vocabulario
  // (`connect` / `demo_platform` / `refuse`). No es «una condición más estricta»: es que ofrecer
  // y cobrar han dejado de ser dos preguntas. Reglas 18 y 23, y la 8 para el demo, viven allí y
  // no se reescriben aquí — reescribirlas sería crear la tercera copia del criterio.
  const hasCard = cardChargeMode(m) !== 'refuse';

  // Bizum manual: flag + móvil del PRO + límites bancarios del pagador (W4:
  // >1.000 € se oculta).
  const bizumPhone = m?.bizumPhone || m?.whatsappPhone || null;
  const hasBizum =
    isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: m }) && !!bizumPhone && amountNum <= 1000;

  // Selector al crear (quote/charge.payMethods): si el PRO limitó los métodos
  // para ESTE cobro, se respeta (null = todos los disponibles).
  const allowed = Array.isArray(charge.payMethods) ? (charge.payMethods as string[]) : null;
  const permits = (key: string) => !allowed || allowed.includes(key);

  // SCRUM-3 · Bizum AUTOMÁTICO (vía PSP), que convive con el manual — decisión del fundador
  // del 28-jul-2026: **los dos visibles, el manual primero**. El motivo, y conviene que no se
  // pierda: no se decide por el fontanero si prefiere ahorrarse el 0,9 % o tener confirmación
  // automática. Es su dinero y su tiempo. El manual va delante porque es GRATIS y es el que ya
  // conoce; el automático se etiqueta con su ventaja real —«se confirma solo»—, que es
  // exactamente lo que el manual no puede garantizar (es la única vía de la casa que puede
  // mentir sobre si el dinero llegó: la confirma el merchant a mano).
  //
  // Y esto NO contradice la regla 22 («el selector se ordena por probabilidad de cobro del
  // MERCHANT, no por el fee de YaQu»): poner delante el gratuito es justo lo contrario de
  // ordenar por nuestro fee — el manual no nos deja nada.
  const bizumAuto: Method | null =
    bizumAutoDisponible({
      flagOn: isFlagEnabled('BIZUM_AUTO_ENABLED', { merchant: m }),
      useConnect: m?.connectStatus === 'active' && !!m?.stripeAccountId,
      currency: charge.currency,
      amountCents: Math.round(amountNum * 100),
    }) === 'ok'
      ? {
          key: 'bizum_auto',
          // Comparte ruta con la tarjeta A PROPÓSITO: el Bizum automático vive DENTRO del
          // mismo Checkout de Stripe (dynamic payment methods), no en una pantalla propia.
          // Darle una ruta suya obligaría a fijar `payment_method_types`, que Stripe
          // desaconseja y que congelaría la lista de métodos (ver bizumCharge.ts).
          href: `/pay/card/${token}`,
          ico: '⚡',
          title: 'Bizum al instante',
          sub: 'Se confirma solo, sin esperar',
        }
      : null;

  type Method = { key: string; href: string; ico: string; title: string; sub: string };
  const card: Method = { key: 'card', href: `/pay/card/${token}`, ico: '💳', title: 'Pagar con tarjeta', sub: 'Visa · Mastercard · al instante' };
  const bizum: Method = { key: 'bizum', href: `/pay/bizum/${token}`, ico: '📲', title: 'Pagar por Bizum', sub: 'Desde la app de tu banco' };
  // SCRUM-90: /pay/bank tokenizado (mismo Charge.receiptToken).
  const transfer: Method = { key: 'transfer', href: `/pay/bank/${token}`, ico: '🏦', title: 'Transferencia bancaria', sub: 'Con los datos y el concepto exacto' };

  // Orden W4: ≤500 → Bizum + Tarjeta (transferencia detrás) · 500-1.000 →
  // Tarjeta principal, Bizum secundario · >1.000 → Tarjeta + transferencia.
  // Los TRAMOS no cambian con el Bizum automático (SCRUM-8): el techo de 1.000 € no lo pone
  // Stripe —que admite 5.000— sino el banco DEL PAGADOR (500-1.000 €/op, 2.000 €/día).
  // El automático se coloca SIEMPRE justo detrás del manual, en el hueco que ocupe Bizum.
  const conBizumAuto = (lista: Method[]): Method[] =>
    bizumAuto ? lista.flatMap((mm) => (mm.key === 'bizum' ? [mm, bizumAuto] : [mm])) : lista;

  const ordered = conBizumAuto(amountNum <= 500 ? [bizum, card, transfer] : [card, bizum, transfer])
    .filter((mm) =>
      (mm.key === 'card' && hasCard && permits('card')) ||
      (mm.key === 'bizum' && hasBizum && permits('bizum')) ||
      // El automático hereda el permiso de 'bizum' (el PRO limitó "Bizum", no la fontanería
      // de cómo se confirma) y su propia disponibilidad ya la resolvió bizumAutoDisponible.
      (mm.key === 'bizum_auto' && permits('bizum')) ||
      (mm.key === 'transfer' && hasTransfer && permits('transfer')));

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
    </div>

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
