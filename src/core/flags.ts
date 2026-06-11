// src/core/flags.ts — Lectura de feature flags (master Parte P; F1-build = SOLO lectura).
//
// Tabla P del master = lista CERRADA de flags con sus defaults. Prohibido añadir flags
// aquí que no estén en la tabla (regla 5): necesidad nueva = propuesta de cambio de master.
//
// Precedencia (Parte P): merchant > país > env (y env > default de la tabla).
// - merchant: override por merchant. Aún no hay columna en BD (se añadirá de forma aditiva
//   cuando un sprint la necesite — p. ej. activación por merchant tras SIF-1 8/8); mientras,
//   se lee defensivamente de `merchant.flags` (JSON) si existe.
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
    id?: number;
    country?: string | null;
    // Columna futura (aditiva) de overrides por merchant; hoy normalmente undefined.
    flags?: Record<string, unknown> | null;
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

  // Merchant: override explícito por merchant (cuando exista la columna).
  const merchantOverride = merchant?.flags?.[flag];
  if (typeof merchantOverride === 'boolean') return merchantOverride;

  // Env: override de entorno explícito.
  const envOverride = parseBool(process.env[flag]);
  if (envOverride !== undefined) return envOverride;

  return FLAG_DEFAULTS[flag];
}
