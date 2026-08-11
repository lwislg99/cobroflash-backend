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
    // SCRUM-474 · «bank» NO está en PAID_VIA y era el caso POR DEFECTO: todo lo que no fuera
    // tarjeta ni MercadoPago caía ahí. El valor del conjunto cerrado para eso es «transfer».
    const method = methodPref === 'card' ? 'card' : methodPref === 'mp' ? 'mp' : 'transfer';

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

// SCRUM-254: se RETIRÓ `GET /:id`, hermano del anterior y con el mismo defecto. Hacía
// `prisma.charge.findUnique({ where: { id } })` — SOLO por id, sin `merchantId` — y devolvía el
// cobro de CUALQUIER merchant con `merchant`, `customer`, `events` y `reconciliations` dentro.
// Bastaba con probar ids: son enteros consecutivos.
//
// ⚠️ POR QUÉ SE RETIRA EN VEZ DE FILTRARSE, que es la pregunta que toca hacerse:
// medido sobre 452 ficheros (src/scripts/tests/public) con el suelo puesto —el buscador
// encuentra la propia definición, así que el cero no era «no miré»—, tenía UN solo llamador:
// un `<a href="…/charges/:id">Ver JSON</a>` de diagnóstico en `receipt.routes.ts`, emitido
// SOLO fuera de producción. Cero llamadores reales. Filtrar habría exigido cambiar la firma
// para que el llamador declarase de quién es el cobro; retirar deja cero superficie, que es
// mejor que superficie filtrada. Ese enlace se retiró en el mismo PR: dejar un `<a>` apuntando
// a un 404 es peor que quitarlo.
//
// LA PROTECCIÓN QUE HABÍA NO SE VEÍA DESDE AQUÍ, y ese es el patrón, no el detalle: la cubría
// `requireInternalSecret` en el montaje de `app.ts:218` — a un fichero de distancia. Quien leía
// esta consulta no tenía delante nada que le dijera que estaba a salvo. Por eso este comentario
// vive JUNTO a donde estaba la consulta y no en `app.ts`.

// SCRUM-129: se RETIRÓ `POST /:id/send`. Violaba la regla nº1 (n8n vivo: axios.post a la URL de
// webhook de n8n) en una ruta de cobros, y MENTÍA — sin esa URL (lo esperable, n8n está prohibido)
// se saltaba el envío pero igual creaba el Event `type:'sent'` y respondía `{ok:true, status:'sent'}`.
// Además esquivaba TODOS los guards de `whatsapp.ts` (topes J6, opt-out J3, dry-run, registro WA-0b).
// Sin callers (dashboard/tests/scripts). El envío por WhatsApp vive en `whatsapp.ts` — un guard
// estructural (scrum129-n8n-guard) impide que n8n vuelva.

export default router;
