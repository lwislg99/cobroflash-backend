// V0-2 (master U1.1) — Modo demo seguro: el merchant demo (regla 8) SOLO puede
// enviar WhatsApp a los números de `DEMO_SAFE_NUMBERS` (env, separados por comas).
// Destino fuera de la lista → bloquear y loguear. Lista vacía/ausente → se bloquea
// TODO envío desde el demo (imposible spamear). Rollback: quitar el guard.
//
// Pura y sin dependencias de red/BD para poder testearla (tests/whatsappPolicy.test.mjs).
import { normalizePhone } from '../core/utils/utils';
import { DEMO_MERCHANT_ID } from '../modules/invoicing/domain/emission.service';

export function demoSendBlocked(
  merchantId: number | null | undefined,
  to: string,
  safeNumbers: readonly string[],
): boolean {
  if (merchantId !== DEMO_MERCHANT_ID) return false;
  const dest = normalizePhone(to);
  if (!dest) return true; // destino ilegible desde demo → bloquear
  const allowed = safeNumbers.map((n) => normalizePhone(n)).filter(Boolean);
  return !allowed.includes(dest);
}
