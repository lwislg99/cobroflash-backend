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

/** Lo único que necesita `isDemoMerchant`: quién es. */
export interface MerchantIdentidad {
  id?: number | null;
  email?: string | null;
}

export interface MerchantLike extends MerchantIdentidad {
  country?: string | null;
  // JsonValue crudo de merchants.flags — lo normaliza isFlagEnabled
  flags?: unknown;
  // SCRUM-1585 (M de SCRUM-1102; D2 de SCRUM-1585 c.20531): OBLIGATORIO a propósito. Un `select`
  // que no trae la columna entrega `undefined`, que aquí es lo mismo que «No consta» — y con el
  // campo opcional ese olvido sería mudo (1102g §⑦.2). Así, el que lo olvide no compila.
  // NULL = «No consta», que NO es «No» (contrato medido en producción, SCRUM-1102 c.17714).
  llevaLibrosPorSii: boolean | null;
}

// SCRUM-1585 · Los mismos dos códigos que la puerta de encendido de SCRUM-1102h
// (`flagFiscal.service.ts`): un hecho, un nombre.
export const ERROR_SII_DECLARADO = 'sii_declarado';
export const ERROR_SII_NO_CONSTA = 'sii_no_consta';
export type MotivoSiiSinEmision = typeof ERROR_SII_DECLARADO | typeof ERROR_SII_NO_CONSTA;

export function isDemoMerchant(m: MerchantIdentidad): boolean {
  if (m.id === DEMO_MERCHANT_ID) return true;
  return (m.email ?? '').trim().toLowerCase() === DEMO_MERCHANT_EMAIL;
}

/**
 * SCRUM-1585 · Por qué un español con la facturación encendida NO emite: su respuesta del SII.
 * RRSIF art. 3.3: el Reglamento no se aplica a quien lleva los libros por el SII. La respuesta
 * caduca (RIVA art. 68 bis: se opta en cualquier momento del ejercicio), así que no basta con
 * la puerta de encendido de SCRUM-1102h: se mira en cada emisión.
 *
 * `null` cuando el SII no decide nada: el demo (que tiene la columna en «No consta» y tiene que
 * seguir emitiendo: la rama del demo va ANTES, 1102g §⑦) o el flag apagado (ya es `receipt` por
 * el flag). Fuera de España no hace falta rama propia: el flag tiene ámbito de país y ahí sale
 * apagado aunque el merchant lo tenga puesto (`tests/flags.test.mjs`). La foral NO entra hasta
 * que confirme el asesor (SCRUM-1585 c.20531, D4; SCRUM-1264).
 */
export function motivoSiiSinEmision(m: MerchantLike): MotivoSiiSinEmision | null {
  if (isDemoMerchant(m)) return null;
  if (!isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m })) return null;
  // `=== false`, no `!== true`: «No consta» bloquea igual que en W (1102g §⑦.1).
  if (m.llevaLibrosPorSii === false) return null;
  return m.llevaLibrosPorSii === true ? ERROR_SII_DECLARADO : ERROR_SII_NO_CONSTA;
}

/**
 * - 'fiscal'  → factura real (no-ES sigue su flujo actual; ES solo con el flag ON post-SIF
 *               y el SII en «No»)
 * - 'demo'    → factura completa con watermark DEMO (solo el merchant demo)
 * - 'receipt' → justificante de cobro (ES real con INVOICING_ES_ENABLED off, o con el flag ON
 *               y el SII en «Sí» o «No consta» — SCRUM-1585)
 */
export function getEmissionMode(m: MerchantLike): EmissionMode {
  const country = (m.country ?? '').trim().toUpperCase();
  if (country && country !== 'ES') return 'fiscal'; // V0-0 solo gobierna España
  if (isDemoMerchant(m)) return 'demo';
  if (!isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m })) return 'receipt';
  return motivoSiiSinEmision(m) === null ? 'fiscal' : 'receipt';
}
