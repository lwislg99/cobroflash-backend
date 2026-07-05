// src/core/http/rateLimit.ts — A11.2 (S3): rate-limit del magic link/login.
// Limitador en memoria por clave (IP o IP+email), ventana deslizante simple.
// Suficiente para F1 (una instancia Railway); sin dependencias nuevas.
import type { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Limpieza perezosa para que el Map no crezca sin límite
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function hitRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > max;
}

export function requestIpForLimit(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd || req.socket?.remoteAddress || '');
  return String(raw).split(',')[0].trim() || 'unknown';
}

/** Middleware: máx `max` peticiones por `windowMs` por IP (+ email si viene). */
export function rateLimit(opts: { max: number; windowMs: number; scope: string; withEmail?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const email = opts.withEmail ? String(req.body?.email || '').toLowerCase().trim() : '';
    const key = `${opts.scope}:${requestIpForLimit(req)}${email ? `:${email}` : ''}`;
    if (hitRateLimit(key, opts.max, opts.windowMs)) {
      // 429 con copy humano — sin desvelar si el email existe (mismo principio del login)
      return res.status(429).json({
        error: 'too_many_requests',
        message: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
      });
    }
    return next();
  };
}

// Solo para tests
export function __resetRateLimits(): void {
  buckets.clear();
}
