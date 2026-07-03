// srcNew/modules/billing/app/routes/payCard.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { stripe } from '../../../../integrations/stripe';
import { BASE_URL, config } from '../../../../core/config/env';
import { parseNumericId } from '../../../../core/utils/utils';
import { isFlagEnabled } from '../../../../core/flags';

const router = Router();

router.get('/card/:id', async (req, res) => {
  const id = parseNumericId(req.params.id);   // tolera URLs sucias, igual que el resto de /pay
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  if (!stripe) {
    return res
      .status(501)
      .send('Stripe no está configurado. Define STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.');
  }

  try {
    const charge = await prisma.charge.findUnique({
      where: { id },
      include: { customer: true, merchant: true },
    });
    if (!charge) return res.status(404).send(documentNotFoundHtml());
    if (charge.status !== 'pending') {
      return res.redirect(303, `/recibo/${id}`);
    }

    const amountCents = Math.round(Number(charge.amount) * 100);

    // CONNECT-1 (C1-2): si el merchant tiene Connect activo → DIRECT CHARGE
    // sobre SU cuenta conectada con el application fee de plataforma (0,9 %,
    // APPLICATION_FEE_BPS). El merchant es merchant-of-record (D3/regla 23).
    // Sin Connect activo (o flag off) → comportamiento actual de plataforma
    // (demo/test, regla 18).
    const merchant = charge.merchant;
    const useConnect =
      isFlagEnabled('PAYMENTS_CONNECT_ENABLED', { merchant }) &&
      merchant?.connectStatus === 'active' &&
      !!merchant?.stripeAccountId;

    const sessionParams = {
      mode: 'payment' as const,
      customer_email: charge.customer?.email || undefined,
      line_items: [
        {
          price_data: {
            currency: charge.currency.toLowerCase(),
            product_data: { name: charge.concept || `Cobro #${id}` },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/recibo/${id}?card=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/recibo/${id}?card=cancel`,
      metadata: { charge_id: String(id) },
      ...(useConnect
        ? {
            payment_intent_data: {
              application_fee_amount: Math.round((amountCents * config.APPLICATION_FEE_BPS) / 10_000),
              metadata: { charge_id: String(id) },
            },
          }
        : {}),
    };

    const session = useConnect
      ? await stripe.checkout.sessions.create(sessionParams, { stripeAccount: merchant!.stripeAccountId! })
      : await stripe.checkout.sessions.create(sessionParams);

    await prisma.event.create({
      data: {
        chargeId: id,
        type: 'card_session_created',
        payload: { session_id: session.id, connect: useConnect } as any,
      },
    });

    return res.redirect(303, session.url!);
  } catch (err: any) {
    // Sin esto, un fallo de Stripe (p. ej. clave inválida → 401) se filtraba crudo
    // como "Unauthorized". Logueamos el motivo real (visible en Railway) y mostramos
    // una página clara al cliente.
    console.error('[pay/card] No se pudo crear la Checkout Session de Stripe:', err?.message || err);
    return res
      .status(503)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(
        `<!doctype html><html lang="es"><head><meta charset="utf-8"/>` +
        `<meta name="viewport" content="width=device-width,initial-scale=1"/>` +
        `<title>Pago no disponible</title></head>` +
        `<body style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:48px auto;padding:0 20px;text-align:center;color:#0f1c17">` +
        `<h1 style="font-size:20px;margin:0 0 8px">No se pudo iniciar el pago</h1>` +
        `<p style="color:#6b756f;font-size:14px;line-height:1.5;margin:0 0 16px">Ha habido un problema al abrir el pago con tarjeta. Vuelve a intentarlo en unos minutos o contacta con el negocio que te envió el cobro.</p>` +
        `<a href="/pay/invoice/${id}" style="display:inline-block;color:#15803d;font-weight:600;text-decoration:none">← Volver</a>` +
        `</body></html>`,
      );
  }
});

export default router;
