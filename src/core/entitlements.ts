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

/**
 * Los planes que EXISTEN (SCRUM-1342). Es la única lista: el comentario de `Merchant.plan` en
 * `prisma/schema.prisma` remite aquí en vez de llevar la suya, que llegó a decir
 * `trial | basic | pro | empresa` — dos que no existen y ninguno de los dos que faltaban.
 */
export const PLANES_CONOCIDOS: readonly string[] = Object.freeze(Object.keys(BY_PLAN));

// SCRUM-1342 — TRES CASOS, Y NO SON DOS:
//   · AUSENTE (`null`/`undefined`): no hay dato —la ruta no encontró el merchant—. `trial`, EN
//     SILENCIO. No es un error, y un aviso aquí llenaría los logs hasta que alguien lo quitara.
//   · CONOCIDO: sus límites.
//   · PRESENTE Y DESCONOCIDO (`empresa`, `Equipo`, `equipo `, ``): sigue cayendo a `trial`
//     —fail-closed: un plan raro no abre límites—, pero AHORA LO DICE, con el valor recibido. El plan
//     Equipo es oferta manual (W1): se escribe a mano, y un nombre mal escrito dejaba la cuenta en 1
//     usuario sin que nada lo contara.
// Se pregunta por clave PROPIA: `BY_PLAN['constructor']`, `['toString']` o `['__proto__']` existen
// por herencia, y con `BY_PLAN[plan] ?? BY_PLAN.trial` devolvían algo SIN `maxUsers` — es decir, sin
// límite de usuarios (`1 + activos >= undefined` es `false`).
// El aviso sale UNA vez por llamada y hoy hay un solo llamante, que corre cuando alguien invita a un
// miembro. Si un día se pregunta aquí en cada petición, hay que agruparlo antes.
export function getEntitlements(
  plan: string | null | undefined,
  quien?: { merchantId?: number },
): Entitlements {
  if (plan === null || plan === undefined) return BY_PLAN.trial;
  if (typeof plan === 'string' && Object.prototype.hasOwnProperty.call(BY_PLAN, plan)) return BY_PLAN[plan];
  const deQuien = quien?.merchantId === undefined ? '' : ` (merchant ${quien.merchantId})`;
  console.warn(
    `[entitlements] ⚠️ plan desconocido ${JSON.stringify(String(plan).slice(0, 60))}${deQuien}: `
    + `se le aplican los límites de trial. Los planes que existen: ${PLANES_CONOCIDOS.join(', ')}.`,
  );
  return BY_PLAN.trial;
}
