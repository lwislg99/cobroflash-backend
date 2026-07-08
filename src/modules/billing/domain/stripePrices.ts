// V0-4 (master U1.1 / W1) — Resolución de precios de suscripción en Stripe.
//
// Los precios canónicos viven en Stripe con `lookup_key` (creados por
// `scripts/setup-stripe-prices.mjs`): así no dependemos de añadir nuevas
// variables en Railway. Orden de resolución: lookup_key en Stripe → fallback
// a la env histórica (STRIPE_PRICE_ID_PRO / _PRO_ANNUAL) → null (501 al pagar).
// EQUIPO existe en Stripe pero NO se lista en ninguna página (W1).
import { stripe } from '../../../integrations/stripe';
import { config } from '../../../core/config/env';

export const PRICE_LOOKUP_KEYS = {
  pro_monthly: 'yaqu_pro_monthly',          // 19,90 €/mes
  pro_annual: 'yaqu_pro_annual',            // 199 €/año
  founding_monthly: 'yaqu_founding_monthly',// 9,90 €/mes de por vida (20 plazas)
  equipo_monthly: 'yaqu_equipo_monthly',    // 59 €/mes — NO listado
} as const;

export type PriceKey = keyof typeof PRICE_LOOKUP_KEYS;

const ENV_FALLBACK: Partial<Record<PriceKey, string>> = {
  pro_monthly: config.STRIPE_PRICE_ID_PRO || undefined,
  pro_annual: config.STRIPE_PRICE_ID_PRO_ANNUAL || undefined,
};

const cache = new Map<PriceKey, string>();

export async function resolvePriceId(key: PriceKey): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;
  if (!stripe) return ENV_FALLBACK[key] ?? null;

  try {
    const found = await stripe.prices.list({
      lookup_keys: [PRICE_LOOKUP_KEYS[key]],
      active: true,
      limit: 1,
    });
    const id = found.data[0]?.id ?? null;
    if (id) {
      cache.set(key, id);
      return id;
    }
  } catch (err: any) {
    console.error(`[stripePrices] error resolviendo ${key}:`, err?.message || err);
  }
  return ENV_FALLBACK[key] ?? null;
}
