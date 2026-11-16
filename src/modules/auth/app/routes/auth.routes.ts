import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { requestMagicLink, verifyMagicLink, revokeSession, registerMerchant } from '../../domain/auth.service';
import { setCookie, clearCookie } from '../../../../core/http/authMiddleware';
import { rateLimit } from '../../../../core/http/rateLimit'; // A11.2 (S3)
import { prisma } from '../../../../core/db/prisma';
import { isInvitedEmail } from '../../../../core/config/env';
import { LOGIN_JS, RUTA_LOGIN_JS } from './loginNavegador'; // SCRUM-1647c
import { ALTA_JS, RUTA_ALTA_JS } from './altaNavegador'; // SCRUM-1647d

const router = Router();

// A11.2 (S3): rate-limit del magic link — 5 envíos/15min por IP+email y
// 30 verificaciones/15min por IP (el token en sí ya es aleatorio y de un solo uso).
const loginLimiter    = rateLimit({ scope: 'login',    max: 5,  windowMs: 15 * 60_000, withEmail: true });
const verifyLimiter   = rateLimit({ scope: 'verify',   max: 30, windowMs: 15 * 60_000 });
// SCRUM-1685: el de antes de SCRUM-1515 (68e33c716^), sólo para quien ya pasó la puerta de invitados.
const registerLimiter = rateLimit({ scope: 'register', max: 5,  windowMs: 15 * 60_000, withEmail: true });

// ── SCRUM-1685 · EL ALTA DEL INVITADO (la llama el manejador de `/register`, más abajo) ────────────
// Va aquí arriba, y no junto a su ruta, a propósito: `scrum264` y `scrum334` leen el texto de cada
// manejador desde la línea que declara su ruta hasta la siguiente, y lo que hubiera entre `/login` y
// `/register` se le atribuiría a `/login`. La PUERTA, en cambio, sí va dentro del manejador: es lo que
// lee `scrum1528` para comprobar que su motivo declarado sigue siendo verdad.
//
// Sólo se llega aquí con un correo de `REGISTRATION_INVITED_EMAILS`. Los campos se limpian como en
// `altaDeMerchant.ts` (`camposDeAlta`), la otra puerta de `registerMerchant`, y es el servicio quien
// exige provincia + domicilio con ES y deja fuera forales y Canarias (`territorioDeAlta.ts`), con el
// texto firmado en SCRUM-1536 c.20225.
async function altaDelInvitado(req: Request, res: Response): Promise<void> {
  const name  = String(req.body?.name  || '').trim();
  const email = String(req.body?.email || '').toLowerCase().trim();
  const country = String(req.body?.country || 'ES').trim();
  const ref = String(req.body?.ref || '').trim();
  // V0-3: atribución de adquisición (UTM "source/medium/campaign" o "ref:CODIGO")
  const source = String(req.body?.source || '').trim().slice(0, 200);
  // SCRUM-1522e / 1536d: quién es la provincia y qué se hace con el domicilio lo decide el servicio.
  const provincia = String(req.body?.provincia || '').trim();
  const domicilio = { foral: respuestaSiNo(req.body?.['domicilio-foral']), canarias: respuestaSiNo(req.body?.['domicilio-canarias']) };

  // Los `message` de este manejador NO son textos nuevos (regla 39): son los literales que
  // `public/register.html` YA pinta hoy para esos mismos códigos (`msgs`) y, para el resto, su texto
  // por defecto («Error al crear la cuenta.»). Van aquí porque `scrum275` no deja que suba el número
  // de respuestas públicas sin `message`; la pantalla dice lo mismo que diría sin ellos.
  if (!name) { res.status(400).json({ error: 'name_required', message: 'Escribe el nombre de tu negocio.' }); return; }
  if (!email || !email.includes('@')) { res.status(400).json({ error: 'invalid_email', message: 'Email inválido.' }); return; }

  try {
    await registerMerchant({ name, email, country, ref: ref || undefined, source: source || undefined, provincia: provincia || undefined, domicilio });
    res.json({ ok: true, message: 'Cuenta creada. Revisa tu email para acceder.' });
  } catch (err) {
    const fallo = err as { code?: string; texto?: string };
    // SCRUM-94: el email ya es de un operario. Mensaje claro pero genérico (no revela la empresa).
    if (fallo?.code === 'email_belongs_to_team') {
      res.status(409).json({
        error: 'email_belongs_to_team',
        message: 'No podemos crear una cuenta con este email. Si trabajas con una empresa que ya usa YaQu, pide a quien la gestiona que te dé acceso a ti.',
      });
      return;
    }
    // SCRUM-1536d: forales y Canarias, fuera, con el texto FIRMADO que trae el propio rechazo.
    if (fallo?.code === 'territorio_excluido' && fallo.texto) {
      res.status(409).json({ error: 'territorio_excluido', message: fallo.texto });
      return;
    }
    if (fallo?.code && CAMPOS_DE_ALTA_QUE_FALTAN.includes(fallo.code)) {
      res.status(400).json({ error: fallo.code, message: 'Error al crear la cuenta.' });
      return;
    }
    console.error('[POST /auth/register]', err);
    res.status(500).json({ error: 'internal_error', message: 'Error al crear la cuenta.' });
  }
}
/** Los rechazos de `registerMerchant` por un campo del alta que falta o no se entiende. */
const CAMPOS_DE_ALTA_QUE_FALTAN = ['provincia_required', 'provincia_desconocida', 'domicilio_fiscal_required', 'domicilio_fiscal_desconocido'];
/** «si»/«sí» → true · «no» → false · lo demás → sin contestar (el servicio lo pide). Como `altaDeMerchant.ts`. */
function respuestaSiNo(valor: unknown): boolean | undefined {
  if (typeof valor !== 'string') return undefined;
  const plano = valor.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  return plano === 'si' ? true : plano === 'no' ? false : undefined;
}

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

// POST /auth/register  { name, email, country?, ref?, source?, provincia, domicilio-foral, domicilio-canarias }
//
// CERRADA salvo para los INVITADOS (SCRUM-1685, alta con invitación; antes SCRUM-1515, paso ②).
// La puerta va DELANTE de todo, también del limitador:
//   · Sin `REGISTRATION_INVITED_EMAILS`, o vacía → nadie es invitado → contesta SIEMPRE la ruta
//     cerrada de SCRUM-1515, byte a byte, sin tocar la base ni mandar correo (fail-closed).
//   · Con correos → sólo esos pasan; cualquier otro recibe exactamente lo mismo que con la ruta
//     cerrada, aunque su cuerpo sea perfecto (no se distingue «no invitado» de «cerrado»).
// Por eso el limitador va DETRÁS: su 429 trae otra frase, que a un no invitado le delataría la puerta.
//
// La frase de la ruta cerrada es la FIRMADA por el fundador en SCRUM-1515 c.18971 (regla 39),
// copiada exacta; `public/register.html` pinta `data.message` lo primero. Tests:
// `tests/scrum1685-alta-con-invitacion.test.mjs` y `…-sin-invitados.test.mjs`; la ruta cerrada
// sin variable, también `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`.
router.post('/register', (req, res) => {
  if (!isInvitedEmail(String(req.body?.email || ''))) {
    return res.status(409).json({
      error: 'registration_closed',
      message: 'Ahora mismo no estamos aceptando altas nuevas. Si quieres probar YaQu, escríbenos y te damos acceso.',
    });
  }
  return registerLimiter(req, res, () => { void altaDelInvitado(req, res); });
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

// GET /auth/js/login.js — SCRUM-1647c (J3): el guion de `public/login.html`, fuera del HTML para que
// la CSP (`script-src 'self'`, SCRUM-1637) se pueda aplicar. Cadena constante, sin datos de la
// petición. `no-cache`: la página es estática y no lleva huella, así que se revalida siempre.
router.get(RUTA_LOGIN_JS, (_req, res) => {
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(LOGIN_JS);
});

// GET /auth/js/alta.js — SCRUM-1647d (J3): el guion de `public/register.html` (incluido el alta con
// invitación de SCRUM-1685), fuera del HTML por el mismo motivo. Cadena constante, `no-cache`.
router.get(RUTA_ALTA_JS, (_req, res) => {
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(ALTA_JS);
});

export default router;
