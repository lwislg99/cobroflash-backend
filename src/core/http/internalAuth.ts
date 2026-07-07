// src/core/http/internalAuth.ts
// P0-SEC (7-jul-2026): varios endpoints se llaman a sí mismos por HTTP (self-call a
// BASE_URL): los webhooks de pago (Stripe/MP/Connect/Bizum) reenvían a /webhooks/psp,
// y invoiceWhatsApp crea el cobro vía POST /charges. Esos endpoints NO deben ser
// alcanzables desde fuera (permitían marcar cobros como pagados y leer cobros de otros
// merchants sin auth). Este guard exige un secreto que solo conocen los llamadores
// internos (mismo proceso).
//
// El secreto es ALEATORIO por-proceso por defecto (cero configuración, falla cerrado).
// Si algún día hay MÁS DE UNA réplica detrás del balanceador, un self-call podría
// aterrizar en otra instancia con otro secreto → fijar entonces `INTERNAL_API_SECRET`
// en el entorno (mismo valor en todas las réplicas).
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-internal-secret';

export const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET && process.env.INTERNAL_API_SECRET.length >= 16
    ? process.env.INTERNAL_API_SECRET
    : crypto.randomBytes(32).toString('hex');

/** Cabecera para las llamadas internas (axios/fetch) a rutas internas. */
export function internalHeaders(): Record<string, string> {
  return { [HEADER]: INTERNAL_SECRET };
}

/**
 * Middleware: deja pasar solo si la petición trae el secreto interno. Cualquier otra
 * cosa → 404 (no revelamos que el endpoint existe). Comparación en tiempo constante.
 */
export function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const got = String(req.headers[HEADER] || '');
  const ok =
    got.length === INTERNAL_SECRET.length &&
    crypto.timingSafeEqual(Buffer.from(got), Buffer.from(INTERNAL_SECRET));
  if (ok) return next();
  return res.status(404).send('Not found');
}
