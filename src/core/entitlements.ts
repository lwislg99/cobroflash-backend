// src/core/entitlements.ts — A10.3 (EXT3, Parte W3 · regla 34)
// ÚNICO lugar donde el plan se traduce a límites. PROHIBIDO hardcodear checks
// de plan en rutas (regla 34): las rutas preguntan aquí.
//
// W3: SOLO dos entitlements en todo YaQu —
//   1) límite de usuarios (1 Pro/Founding · 5 Equipo manual)
//   2) fair-use WhatsApp (soft, ya implementado en A9.3 — aviso, nunca corte)
// Todo lo demás = incluido = cero checks (W2: "Pro incluye TODO").

export interface Entitlements {
  /** Usuarios TOTALES de la cuenta (owner incluido). */
  maxUsers: number;
  /** Fair use WhatsApp (soft): plantillas/mes con aviso, NUNCA corte (W2). */
  waFairUseMonthly: number;
}

const BY_PLAN: Record<string, Entitlements> = {
  trial:    { maxUsers: 1, waFairUseMonthly: 300 },   // prueba = como Pro
  pro:      { maxUsers: 1, waFairUseMonthly: 300 },
  founding: { maxUsers: 1, waFairUseMonthly: 300 },   // Pro a mitad de precio, mismos límites
  equipo:   { maxUsers: 5, waFairUseMonthly: 1000 },  // oferta manual W1
};

export function getEntitlements(plan: string | null | undefined): Entitlements {
  return BY_PLAN[String(plan || 'trial')] ?? BY_PLAN.trial;
}
