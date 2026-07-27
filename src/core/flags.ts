// src/core/flags.ts — Lectura de feature flags (master Parte P; F1-build = SOLO lectura).
//
// Tabla P del master = lista CERRADA de flags con sus defaults. Prohibido añadir flags
// aquí que no estén en la tabla (regla 5): necesidad nueva = propuesta de cambio de master.
//
// Precedencia (Parte P): merchant > país > env (y env > default de la tabla).
// - merchant: override por merchant vía columna `merchants.flags` (JSONB, A14.3
//   EXT3 — {FLAG_NAME: bool}). Escritura SOLO manual/fundador por ahora.
// - país: los flags con scope de país solo aplican a merchants de ese país
//   (INVOICING_ES_ENABLED y SIF_ENABLED son ES-only).
// - env: variable de entorno homónima ('true'/'1' → ON, 'false'/'0' → OFF).
// Los cambios de flag son auditados y los globales son stop condition (AA1.4).

export const FLAG_DEFAULTS = {
  WHATSAPP_TEMPLATES_ENABLED: true,  // global · ON · rollback solo en incidente grave (R12)
  INVOICING_ES_ENABLED: false,       // país ES / merchant · OFF hasta SIF-1 v2 8/8
  SIF_ENABLED: false,                // global ES · OFF hasta pruebas AEAT (S1-D)
  PAYMENTS_CONNECT_ENABLED: false,   // global · OFF hasta CONNECT-1
  BIZUM_MANUAL_ENABLED: false,       // global/merchant · OFF hasta C1-4
  VOICE_QUOTE_ENABLED: false,        // global · OFF hasta eval VZ-2 (≥8/10)
  // VOZ-ALB (SCRUM-71) · global · OFF. Flag PROPIO y no reutilización de VOICE_QUOTE_ENABLED,
  // por decisión del fundador (27-jul-2026): el dictado en albarán tiene un riesgo distinto
  // —el documento lo FIRMA el cliente y desde 'emitido' se congela (Parte L)— y hay que poder
  // apagarlo sin apagar el del presupuesto, que no tiene esa consecuencia.
  VOICE_ALBARAN_ENABLED: false,
  BOT_INBOUND_ENABLED: false,        // global → merchant · OFF (F2)
  BOT_AI_ENABLED: false,             // merchant · OFF (F2 tardía, gates K2)
  PUBLIC_PROFILE_ENABLED: false,     // merchant opt-in · OFF (F2, PERFIL-1)
  MAINTENANCE_ENABLED: false,        // merchant opt-in · OFF (F2, MANT-1)
} as const;

export type FlagName = keyof typeof FLAG_DEFAULTS;

// Flags que solo tienen sentido para merchants de España: para cualquier otro país
// la respuesta es SIEMPRE false, da igual el env o el override.
const ES_ONLY_FLAGS: ReadonlySet<FlagName> = new Set<FlagName>([
  'INVOICING_ES_ENABLED',
  'SIF_ENABLED',
]);

export interface FlagContext {
  merchant?: {
    id?: number | null;
    country?: string | null;
    // merchants.flags (JSONB, A14.3) — se acepta el JsonValue crudo de Prisma
    // y se normaliza dentro de isFlagEnabled (solo objetos planos cuentan).
    flags?: unknown;
  } | null;
}

function parseBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

/** Lectura con precedencia merchant > país > env > default de la tabla P. */
export function isFlagEnabled(flag: FlagName, ctx?: FlagContext): boolean {
  const merchant = ctx?.merchant ?? undefined;

  // País: flags ES-only nunca se encienden para merchants de otro país.
  if (ES_ONLY_FLAGS.has(flag)) {
    const country = (merchant?.country ?? 'ES').trim().toUpperCase();
    if (country && country !== 'ES') return false;
  }

  // Merchant: override explícito por merchant (columna merchants.flags).
  const rawFlags = merchant?.flags;
  const merchantOverride =
    rawFlags && typeof rawFlags === 'object' && !Array.isArray(rawFlags)
      ? (rawFlags as Record<string, unknown>)[flag]
      : undefined;
  if (typeof merchantOverride === 'boolean') return merchantOverride;

  // Env: override de entorno explícito.
  const envOverride = parseBool(process.env[flag]);
  if (envOverride !== undefined) return envOverride;

  return FLAG_DEFAULTS[flag];
}
