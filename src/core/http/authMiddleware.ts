import { Request, Response, NextFunction } from 'express';
import { getSession } from '../../modules/auth/domain/auth.service';
import { isVerifiedPlatformOwner } from '../config/env';

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['pf_session'];

  if (!token) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const session = await getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'session_expired' });
  }

  req.merchantId = session.merchantId;
  // SCRUM-360 (H5 fase 2) · QUÉ sesión es. La fila ya está cargada aquí, así que esto no cuesta
  // ninguna consulta; sin ella, escribir el entorno obligaría a resolver la cookie otra vez.
  req.sessionId = session.id;
  // El propietario (teamMemberId null) siempre es admin
  req.teamMemberId = session.teamMemberId ?? null;
  req.userRole = session.teamMember ? (session.teamMember.role as 'admin' | 'tecnico') : 'admin';
  next();
}

// SCRUM-55: el middleware que devuelve requireRole va MARCADO (`__requiredRole`).
// Sin la marca es una arrow anónima indistinguible de cualquier otro middleware, y
// la red fail-closed (tests/scrum55-admin-fail-closed.test.mjs) no puede saber qué
// rutas declaran rol. La marca es el contrato: quitarla deja ciega a la red.
export interface RoleGate {
  (req: Request, res: Response, next: NextFunction): void;
  __requiredRole: 'admin' | 'tecnico';
}

export function requireRole(role: 'admin' | 'tecnico'): RoleGate {
  const gate = (req: Request, res: Response, next: NextFunction) => {
    if (req.userRole !== role) {
      return res.status(403).json({ error: 'forbidden', required_role: role });
    }
    next();
  };
  return Object.assign(gate, { __requiredRole: role } as const);
}

// Bloqueo suave tras fin de trial — solo para operaciones de escritura
export async function requireActivePlan(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['pf_session'];
  if (!token) return next();

  const session = await getSession(token);
  if (!session) return next();

  const { plan, planExpiresAt } = session.merchant;

  // Cuentas owner: exentas del paywall de prueba. No afecta al resto.
  // SCRUM-102: dos factores (email en OWNER_EMAILS + Merchant.isPlatformOwner en BD).
  if (isVerifiedPlatformOwner(session.merchant)) return next();

  if (plan === 'trial' && planExpiresAt && planExpiresAt < new Date()) {
    return res.status(403).json({ error: 'trial_expired', redirect: '/dashboard/#plans' });
  }

  next();
}

export function setCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 30 * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `pf_session=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${isProd ? '; Secure' : ''}`
  );
}

export function clearCookie(res: Response) {
  res.setHeader('Set-Cookie', 'pf_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}
