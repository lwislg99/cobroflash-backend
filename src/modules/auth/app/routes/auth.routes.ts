import { Router } from 'express';
import { requestMagicLink, verifyMagicLink, registerMerchant, revokeSession } from '../../domain/auth.service';
import { setCookie, clearCookie } from '../../../../core/http/authMiddleware';
import { rateLimit } from '../../../../core/http/rateLimit'; // A11.2 (S3)

const router = Router();

// A11.2 (S3): rate-limit del magic link — 5 envíos/15min por IP+email y
// 30 verificaciones/15min por IP (el token en sí ya es aleatorio y de un solo uso).
const loginLimiter    = rateLimit({ scope: 'login',    max: 5,  windowMs: 15 * 60_000, withEmail: true });
const registerLimiter = rateLimit({ scope: 'register', max: 5,  windowMs: 15 * 60_000, withEmail: true });
const verifyLimiter   = rateLimit({ scope: 'verify',   max: 30, windowMs: 15 * 60_000 });

// POST /auth/login  { email }
router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  try {
    await requestMagicLink(email);
    // Respuesta siempre 200 para no revelar si el email existe
    return res.json({ ok: true, message: 'Si el email está registrado recibirás el enlace en breve.' });
  } catch (err) {
    console.error('[POST /auth/login]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /auth/register  { name, email, country? }
router.post('/register', registerLimiter, async (req, res) => {
  const name  = String(req.body?.name  || '').trim();
  const email = String(req.body?.email || '').toLowerCase().trim();
  const country = String(req.body?.country || 'ES').trim();
  const ref = String(req.body?.ref || '').trim();
  // V0-3: atribución de adquisición (UTM "source/medium/campaign" o "ref:CODIGO")
  const source = String(req.body?.source || '').trim().slice(0, 200);

  if (!name)  return res.status(400).json({ error: 'name_required' });
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });

  try {
    await registerMerchant({ name, email, country, ref: ref || undefined, source: source || undefined });
    return res.json({ ok: true, message: 'Cuenta creada. Revisa tu email para acceder.' });
  } catch (err) {
    console.error('[POST /auth/register]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /auth/verify?token=xxx
router.get('/verify', verifyLimiter, async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.redirect('/login.html?error=invalid_token');

  try {
    const sessionToken = await verifyMagicLink(token);
    if (!sessionToken) return res.redirect('/login.html?error=link_expired');

    setCookie(res, sessionToken);
    return res.redirect('/dashboard/');
  } catch (err) {
    console.error('[GET /auth/verify]', err);
    return res.redirect('/login.html?error=internal_error');
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/pf_session=([^;]+)/);
  if (match?.[1]) {
    await revokeSession(decodeURIComponent(match[1])).catch(() => {});
  }
  clearCookie(res);
  return res.json({ ok: true });
});

export default router;
