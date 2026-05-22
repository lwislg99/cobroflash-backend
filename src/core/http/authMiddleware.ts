import { Request, Response, NextFunction } from 'express';
import { getSession } from '../../modules/auth/domain/auth.service';

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
  // El propietario (teamMemberId null) siempre es admin
  req.teamMemberId = session.teamMemberId ?? null;
  req.userRole = session.teamMember ? (session.teamMember.role as 'admin' | 'tecnico') : 'admin';
  next();
}

export function requireRole(role: 'admin' | 'tecnico') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.userRole !== role) {
      return res.status(403).json({ error: 'forbidden', required_role: role });
    }
    next();
  };
}

// Bloqueo suave tras fin de trial — solo para operaciones de escritura
export async function requireActivePlan(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['pf_session'];
  if (!token) return next();

  const session = await getSession(token);
  if (!session) return next();

  const { plan, planExpiresAt } = session.merchant;

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
