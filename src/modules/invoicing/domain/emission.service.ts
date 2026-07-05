// Modo de emisión documental por merchant — V0-0 (master U1.1) + Parte P.
//
// Hasta SIF-1 v2 8/8, `INVOICING_ES_ENABLED` está OFF para merchants ES reales:
// su documento post-pago es un JUSTIFICANTE DE COBRO (sin numeración de factura,
// sin QR VeriFactu; el copy nunca dice "factura" — Parte M). El merchant demo
// (regla 8) conserva facturas completas con marca de agua "DEMO — no válida
// fiscalmente" en PDF y pantalla. Rollback: el flag.
import { isFlagEnabled } from '../../../core/flags';

export type EmissionMode = 'fiscal' | 'demo' | 'receipt';

export const DEMO_WATERMARK = 'DEMO — no válida fiscalmente';

// Merchant demo (regla 8 del master)
export const DEMO_MERCHANT_ID = 1;
export const DEMO_MERCHANT_EMAIL = 'demo@yaqu.app';

export interface MerchantLike {
  id?: number | null;
  email?: string | null;
  country?: string | null;
  // JsonValue crudo de merchants.flags — lo normaliza isFlagEnabled
  flags?: unknown;
}

export function isDemoMerchant(m: MerchantLike): boolean {
  if (m.id === DEMO_MERCHANT_ID) return true;
  return (m.email ?? '').trim().toLowerCase() === DEMO_MERCHANT_EMAIL;
}

/**
 * - 'fiscal'  → factura real (no-ES sigue su flujo actual; ES solo con el flag ON post-SIF)
 * - 'demo'    → factura completa con watermark DEMO (solo el merchant demo)
 * - 'receipt' → justificante de cobro (ES real con INVOICING_ES_ENABLED off)
 */
export function getEmissionMode(m: MerchantLike): EmissionMode {
  const country = (m.country ?? '').trim().toUpperCase();
  if (country && country !== 'ES') return 'fiscal'; // V0-0 solo gobierna España
  if (isDemoMerchant(m)) return 'demo';
  return isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m }) ? 'fiscal' : 'receipt';
}
