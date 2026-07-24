// SCRUM-130 (r23 · reglas 23 + 18) — decisión de CÓMO se cobra una tarjeta, extraída como función PURA
// (sin red ni BD) para poder verificarla en `npm test` normal, igual que `demoSendBlocked` (V0-2).
//
// Regla 23: «PSP = cuenta conectada del merchant o NADA». Prohibido procesar pagos de clientes
// finales en la cuenta Stripe de PLATAFORMA. Regla 18: la cuenta de plataforma solo es legítima
// para el merchant DEMO (test, con marca de agua). Por tanto:
//   - Connect activo            → 'connect'        (direct charge en la cuenta del merchant)
//   - sin Connect pero es DEMO  → 'demo_platform'  (cuenta de plataforma, test/watermark)
//   - sin Connect y NO es demo  → 'refuse'         (NADA: no cae a plataforma — dinero de clientes
//                                                   finales en la cuenta equivocada es regulatorio)
//
// FAIL-CLOSED: ante un merchant desconocido/sin id, 'refuse'. Antes de r23 el handler caía SIEMPRE
// a la cuenta de plataforma cuando faltaba Connect; solo lo tapaba el selector de la UI (no ofrecía
// tarjeta). Esto lo cierra en el backend (defensa en profundidad).

export type CardChargeMode = 'connect' | 'demo_platform' | 'refuse';

export function cardChargeDecision(opts: { useConnect: boolean; isDemo: boolean }): CardChargeMode {
  if (opts.useConnect) return 'connect';
  if (opts.isDemo) return 'demo_platform';
  return 'refuse';
}
