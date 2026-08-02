// srcNew/modules/billing/app/routes/charges.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { CreateChargeSchema } from '../../../../core/validation/schemas';
import { normalizePhone, makeReference } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';
import { ensureChargeReceiptToken } from '../../../../lib/invoicing';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const body = CreateChargeSchema.parse(req.body);

    const merchant = await prisma.merchant.findUnique({ where: { id: body.merchant_id } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    let customerId: number | undefined;
    if (body.customer_id) {
      // Cliente existente: lo usamos tal cual (no duplicamos).
      customerId = body.customer_id;
    } else if (body.customer) {
      const c = await prisma.customer.create({
        data: {
          name: body.customer.name,
          phone: body.customer.phone ? normalizePhone(body.customer.phone) : null,
          email: body.customer.email ?? null,
        },
      });
      customerId = c.id;
    }

    const reference = makeReference();
    const expiresAt = body.expires_at ? new Date(body.expires_at) : null;

    const methodPref = body.method_preference;
    const method = methodPref === 'card' ? 'card' : methodPref === 'mp' ? 'mp' : 'bank';

    const charge = await prisma.charge.create({
      data: {
        merchantId: body.merchant_id,
        customerId: customerId ?? null,
        concept: body.concept,
        amount: body.amount.toFixed(2),
        currency: body.currency.toUpperCase(),
        method,
        status: 'pending',
        expiresAt,
        payMethods: body.pay_methods ?? undefined, // A2.1: selector al crear (heredado del quote)
        events: {
          create: {
            type: 'created',
            payload: {
              method_preference: body.method_preference,
              meta: body.meta ?? {},
            } as any,
          },
        },
      },
      include: { customer: true, merchant: true },
    });

    // SCRUM-85/90: /pay/card, /pay/bank y /pay/mp tokenizados (mismo Charge.receiptToken).
    const payToken = await ensureChargeReceiptToken(charge.id, prisma);
    const paybank_url = `${BASE_URL}/pay/bank/${payToken}`;
    const paycard_url = `${BASE_URL}/pay/card/${payToken}`;
    const paymp_url   = `${BASE_URL}/pay/mp/${payToken}`;

    return res.status(201).json({
      id: charge.id,
      paybank_url,
      paycard_url,
      paymp_url,
      expires_at: charge.expiresAt,
      reference: charge.reference,
      status: charge.status,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /charges error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// SCRUM-251: se RETIRARON `GET /` y `POST /-smoke`, ambos restos del scaffold interno SIN ningún
// caller (medido en src/scripts/tests/public). `GET /` listaba los 20 cobros más recientes de TODA
// la plataforma (findMany SIN `where`): su única protección era `requireInternalSecret` en el
// montaje de app.ts — a un fichero de distancia, no en la consulta, y con el `_req` delatando que
// nadie miraba la petición. Mismo criterio que el retiro de `POST /:id/send` (abajo, SCRUM-129):
// ruta interna muerta que leía cross-merchant, fuera de raíz en vez de declarar una ficción.

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { events: true, reconciliations: true, customer: true, merchant: true },
  });
  if (!charge) return res.status(404).json({ error: 'charge_not_found' });

  res.json({
    id: charge.id,
    status: charge.status,
    method: charge.method,
    amount: charge.amount.toString(),
    currency: charge.currency,
    reference: charge.reference,
    expires_at: charge.expiresAt,
    merchant_id: charge.merchantId,
    customer_id: charge.customerId,
    events: charge.events.map((e) => ({
      id: e.id,
      type: e.type,
      ts: e.ts,
    })),
    reconciliations: charge.reconciliations.map((r) => ({
      id: r.id,
      bank_ref: r.bankRef,
      matched: r.matched,
      ts: r.ts,
    })),
  });
});

// SCRUM-129: se RETIRÓ `POST /:id/send`. Violaba la regla nº1 (n8n vivo: axios.post a la URL de
// webhook de n8n) en una ruta de cobros, y MENTÍA — sin esa URL (lo esperable, n8n está prohibido)
// se saltaba el envío pero igual creaba el Event `type:'sent'` y respondía `{ok:true, status:'sent'}`.
// Además esquivaba TODOS los guards de `whatsapp.ts` (topes J6, opt-out J3, dry-run, registro WA-0b).
// Sin callers (dashboard/tests/scripts). El envío por WhatsApp vive en `whatsapp.ts` — un guard
// estructural (scrum129-n8n-guard) impide que n8n vuelva.

export default router;
