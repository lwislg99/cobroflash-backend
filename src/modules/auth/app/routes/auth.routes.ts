import { Router } from 'express';
import crypto from 'crypto';
import { requestMagicLink, verifyMagicLink, registerMerchant, revokeSession } from '../../domain/auth.service';
import { setCookie, clearCookie } from '../../../../core/http/authMiddleware';
import { rateLimit } from '../../../../core/http/rateLimit'; // A11.2 (S3)
import { prisma } from '../../../../core/db/prisma';

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

// SCRUM-38: login de TEST para el QA autónomo en STAGING (Playwright MCP).
// TRES CERRADURAS fail-closed — NINGUNA de estas env vars existe en producción:
//   (1) E2E_TEST_LOGIN_ENABLED !== 'true'  → cae al 404 estándar ANTES de leer el body
//   (2) E2E_TEST_LOGIN_SECRET ausente/vacía → ídem (jamás "sin secret = sin comprobación")
//   (3) email fuera de la allowlist E2E_TEST_LOGIN_EMAILS → ídem
// INDISTINGUIBILIDAD: los fallos NO responden aquí — `next('route')`/`next()` dejan caer la
// petición al manejador 404 final de la app (app.ts), byte-idéntico a una ruta inexistente.
// El gate va DELANTE del rate-limiter: con el flag OFF el limiter ni se ejecuta (un 429
// delataría que la ruta existe). El flujo real del magic link queda INTACTO. Ni el secret
// ni el token de sesión se escriben en logs ni en el body de la respuesta.
const testLoginLimiter = rateLimit({ scope: 'test_login', max: 30, windowMs: 15 * 60_000 });
const testLoginGate = (req: any, res: any, next: any) => {
  if (process.env.E2E_TEST_LOGIN_ENABLED !== 'true') return next('route'); // cerradura 1
  if (!process.env.E2E_TEST_LOGIN_SECRET) return next('route');            // cerradura 2 (fail-closed)
  return next();
};
router.post('/test-login', testLoginGate, testLoginLimiter, async (req, res, next) => {
  try {
    const expected = process.env.E2E_TEST_LOGIN_SECRET || '';
    const email = String(req.body?.email || '').toLowerCase().trim();
    const secret = String(req.body?.secret || '');

    // Comparación en TIEMPO CONSTANTE: hashes SHA-256 (longitud fija) + timingSafeEqual.
    const a = crypto.createHash('sha256').update(secret).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    if (!crypto.timingSafeEqual(a, b)) return next(); // → 404 estándar

    const allow = (process.env.E2E_TEST_LOGIN_EMAILS || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!email || !allow.includes(email)) return next(); // cerradura 3 → 404 estándar

    const merchant = await prisma.merchant.findUnique({ where: { email } });
    if (!merchant) return next(); // la cuenta la crea el seed → 404 estándar

    // Sesión real reutilizando las primitivas existentes (mismo type='session' + cookie
    // pf_session de authMiddleware). TTL corto de QA: 24 h (no los 30 días del flujo real).
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchant.id, token, type: 'session', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    setCookie(res, token);
    return res.json({ ok: true }); // el token viaja SOLO en la cookie HttpOnly
  } catch (err) {
    console.error('[POST /auth/test-login] internal_error'); // sin body/secret/token en el log
    return res.status(500).json({ error: 'internal_error' });
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
