/**
 * Mercado Pago — Checkout Pro
 * Docs: https://www.mercadopago.com.mx/developers/es/reference/preferences/_checkout_preferences/post
 */
import axios from 'axios';
import crypto from 'crypto';

const MP_API = 'https://api.mercadopago.com';

export interface MpPreferenceResult {
  preferenceId: string;
  checkoutUrl: string;   // sandbox en dev, producción en prod
}

export async function createMpPreference(params: {
  chargeId: number; // interno: SOLO para external_reference (reconciliación del webhook)
  payToken: string; // SCRUM-90: público — usado en las back_urls, NUNCA el chargeId
  title: string;
  amount: number;
  currency: string;
  customerName?: string | null;
  customerEmail?: string | null;
  notificationUrl: string;
  backBaseUrl: string;
  accessToken: string;
}): Promise<MpPreferenceResult> {
  const body = {
    items: [
      {
        title: params.title,
        unit_price: params.amount,
        quantity: 1,
        currency_id: params.currency.toUpperCase(),
      },
    ],
    payer: params.customerEmail
      ? { name: params.customerName ?? '', email: params.customerEmail }
      : undefined,
    back_urls: {
      success: `${params.backBaseUrl}/pay/mp/${params.payToken}/result?status=approved`,
      failure: `${params.backBaseUrl}/pay/mp/${params.payToken}/result?status=rejected`,
      pending: `${params.backBaseUrl}/pay/mp/${params.payToken}/result?status=pending`,
    },
    auto_return: 'approved',
    notification_url: params.notificationUrl,
    external_reference: `charge_${params.chargeId}`,
    statement_descriptor: 'YaQu',
  };

  const { data } = await axios.post(`${MP_API}/checkout/preferences`, body, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });

  const isProd = process.env.NODE_ENV === 'production';
  const checkoutUrl = isProd ? data.init_point : (data.sandbox_init_point || data.init_point);

  return { preferenceId: data.id, checkoutUrl };
}

export async function getMpPayment(
  mpPaymentId: string | number,
  accessToken: string,
): Promise<{
  status: string;           // approved | rejected | pending | in_process | cancelled
  externalReference: string; // charge_<id>
  amount: number;
  currency: string;
  method: string;
}> {
  const { data } = await axios.get(`${MP_API}/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10_000,
  });

  return {
    status: data.status,
    externalReference: data.external_reference ?? '',
    amount: data.transaction_amount,
    currency: data.currency_id,
    method: data.payment_type_id ?? 'mp',
  };
}

/**
 * Verifica la firma del webhook de Mercado Pago.
 * Header x-signature: "ts=1234;v1=abc..."
 * Mensaje para HMAC: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */
export function verifyMpWebhookSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}): boolean {
  if (!params.secret) return true; // sin secret configurado → aceptar (dev)

  const parts = Object.fromEntries(
    params.xSignature.split(';').map((p) => p.split('=')),
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) return false;

  const message = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', params.secret)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
}
