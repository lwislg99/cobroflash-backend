// src/modules/payments/connect/connectWebhook.routes.ts
// CONNECT-1 (C1-2) — webhook SEPARADO para eventos de cuentas conectadas
// (master U1.4: "CRÍTICO: endpoint de webhooks Connect separado, mapear
// metadata.chargeId, NO romper la cadena factura→paid").
//
// En Stripe Dashboard se registra como endpoint de tipo "Connect" apuntando a
// /webhooks/stripe-connect con su propio signing secret (STRIPE_CONNECT_WEBHOOK_SECRET).
// Los pagos confirmados se reenvían a /webhooks/psp igual que el webhook de
// plataforma: la cadena post-pago (charge.paid → invoice.paid → WA/email) es la misma.
import express from 'express';
import axios from 'axios';
import type StripeLib from 'stripe';
import { stripe } from '../../../integrations/stripe';
import { config, BASE_URL } from '../../../core/config/env';
import { internalHeaders } from '../../../core/http/internalAuth';
import { prisma } from '../../../core/db/prisma';
import { handleStripeDispute } from '../disputes.service'; // A21.1 (R14)
import { paidViaDesdeStripe } from '../../billing/domain/paidVia'; // SCRUM-191

export const rawBody = express.raw({ type: 'application/json' });
export const router = express.Router();

router.post('/', async (req, res) => {
  try {
    if (!stripe) return res.status(501).send('Stripe no está configurado');

    const sig = req.headers['stripe-signature'] as string;
    const secret = config.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send('Missing STRIPE_CONNECT_WEBHOOK_SECRET');

    const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);

    if (event.type === 'account.updated') {
      // KYC del merchant avanza → connectStatus según charges_enabled (C1-1/D3)
      const account = event.data.object as StripeLib.Account;
      const status = account.charges_enabled
        ? 'active'
        : account.details_submitted ? 'restricted' : 'pending';
      const updated = await prisma.merchant.updateMany({
        where: { stripeAccountId: account.id },
        data: { connectStatus: status },
      });
      if (updated.count === 0) {
        console.warn('[stripe-connect] account.updated sin merchant:', account.id);
      }

    } else if (event.type === 'checkout.session.completed') {
      // Direct charge en la cuenta conectada → misma cadena post-pago
      const s = event.data.object as StripeLib.Checkout.Session;
      if (s.mode === 'payment') {
        const chargeId = Number(s.metadata?.charge_id);
        if (Number.isInteger(chargeId)) {
          // SCRUM-191: con qué pagó el cliente DE VERDAD. Antes iba `method: 'card'` a fuego,
          // lo que no fallaba mientras el checkout solo aceptase tarjeta — pero el Bizum
          // automático entra por ESTE MISMO checkout (SCRUM-3), así que habría registrado
          // todo Bizum como tarjeta. Atribución falsa: el dato existe, parece bueno y miente.
          //
          // No se usa `s.payment_method_types`: con dynamic payment methods esa lista dice lo
          // que se OFRECIÓ, no lo que se usó. El dato real está en el cargo
          // (`payment_method_details.type`, donde `bizum` es un valor documentado), y se llega
          // expandiendo `latest_charge` del PaymentIntent. La llamada va sobre la CUENTA
          // CONECTADA (`stripeAccount`), que es donde vive este pago: es un direct charge.
          let metodo: string | null = null;
          try {
            const piId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
            if (piId) {
              const pi = await stripe.paymentIntents.retrieve(
                piId,
                { expand: ['latest_charge'] },
                // `event.account` = la cuenta conectada que originó el evento. NO se reutiliza
                // la variable `account` de la rama `account.updated`: allí es un objeto Account
                // de otro evento y aquí haría falta el id.
                event.account ? { stripeAccount: event.account } : undefined,
              );
              const cargo = pi.latest_charge as StripeLib.Charge | null;
              metodo = paidViaDesdeStripe(cargo?.payment_method_details?.type);
            }
          } catch (e: any) {
            console.error('[stripe-connect] no pude resolver el método de pago:', e?.message || e);
          }

          if (!metodo) {
            // FAIL-CLOSED, y es el corazón del arreglo: si no se sabe con qué se pagó, NO se
            // inventa. Se omite `method` y `/webhooks/psp` conserva el que ya tenía el cobro
            // (`body.method ?? charge.method`). Cambiar «asumo tarjeta» por «asumo otra cosa»
            // sería repetir el bug con otro disfraz. El cobro se confirma igual: lo que no se
            // toca es la atribución.
            console.error(
              `[stripe-connect] charge ${chargeId}: método de pago NO resuelto; se confirma el ` +
              `cobro sin tocar paid_via (regla 22: mejor sin dato que con un dato falso).`,
            );
          }

          await axios.post(`${BASE_URL}/webhooks/psp`, {
            event: 'payment.confirmed', charge_id: chargeId,
            ...(metodo ? { method: metodo } : {}),
            bank_ref: s.payment_intent || 'pi_unknown',
            amount: (s.amount_total ?? 0) / 100,
            currency: (s.currency || 'eur').toUpperCase(),
            ts: new Date().toISOString(),
          }, { timeout: 10_000, headers: internalHeaders() });
        }
      }

    } else if (event.type === 'charge.dispute.created') {
      // A21.1 (R14): disputa → aviso WA/BO + paquete de evidencia en la factura
      await handleStripeDispute(event.data.object as StripeLib.Dispute);

    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as StripeLib.PaymentIntent;
      const chargeId = Number(pi.metadata?.charge_id);
      if (Number.isInteger(chargeId)) {
        // SCRUM-191 · LA HERMANA. Aquí también iba `method: 'card'` a fuego, y la encontró el
        // guard del arreglo de arriba, no la vista (principio 9: al corregir un patrón
        // copiado, busca las hermanas). Un Bizum fallido se habría reportado como tarjeta
        // fallida — el mismo dato falso, en el camino de los fallos.
        //
        // Aquí NO se resuelve el método y se omite directamente, a diferencia del camino de
        // éxito: en un pago fallido no hay cargo del que leer `payment_method_details`, y
        // gastar una llamada extra a Stripe para adornar un fallo no lo vale. Omitiéndolo,
        // `/webhooks/psp` conserva el método que ya tenía el cobro (`body.method ??
        // charge.method`), que es lo correcto: un intento fallido no cambia con qué se cobró.
        await axios.post(`${BASE_URL}/webhooks/psp`, {
          event: 'payment.failed', charge_id: chargeId,
          bank_ref: pi.id,
          ts: new Date().toISOString(),
        }, { timeout: 10_000, headers: internalHeaders() });
      }
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error('Stripe Connect webhook error:', e?.message || e);
    res.status(400).send(`Webhook Error: ${e?.message || e}`);
  }
});
