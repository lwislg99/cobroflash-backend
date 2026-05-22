import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../../../core/db/prisma';
import { createMailer } from '../../../integrations/mailer';
import { config } from '../../../core/config/env';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

async function sendEmail(params: { to: string; subject: string; html: string }) {
  if (config.RESEND_API_KEY) {
    await axios.post(
      'https://api.resend.com/emails',
      { from: config.EMAIL_FROM, to: [params.to], subject: params.subject, html: params.html },
      { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10_000 }
    );
    return;
  }
  // Fallback SMTP
  const mailer = createMailer();
  await mailer.sendMail({ from: config.EMAIL_FROM, to: params.to, subject: params.subject, html: params.html });
}
const SESSION_TTL_MS    = 30 * 24 * 60 * 60 * 1000; // 30 días

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function requestMagicLink(email: string): Promise<void> {
  const merchant = await prisma.merchant.findUnique({ where: { email } });
  if (!merchant) return; // silent — no revelamos si el email existe

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await prisma.authSession.create({
    data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt },
  });

  const link = `${config.PUBLIC_BASE_URL}/auth/verify?token=${token}`;

  // Siempre logueamos el link para poder verificar en logs aunque el email falle
  console.log(`[magic-link] to=${email} link=${link}`);

  try {
    await sendEmail({
      to: email,
      subject: 'Tu enlace de acceso a PresuFácil',
      html: `<p>Hola <strong>${merchant.name}</strong>,</p>
<p>Haz clic en el botón para acceder a tu cuenta de PresuFácil:</p>
<p style="margin:24px 0">
  <a href="${link}" style="background:#22c55e;color:#052e16;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
    Entrar a PresuFácil
  </a>
</p>
<p style="color:#6b7280;font-size:13px">Este enlace es de un solo uso y caduca en 15 minutos.<br/>Si no lo solicitaste, puedes ignorar este correo.</p>`,
    });
    console.log(`[magic-link] email enviado OK a ${email}`);
  } catch (emailErr: any) {
    console.error(`[magic-link] ERROR enviando email a ${email}:`, emailErr?.message || emailErr);
  }
}

export async function verifyMagicLink(token: string): Promise<string | null> {
  const session = await prisma.authSession.findUnique({ where: { token } });

  if (!session) return null;
  if (session.type !== 'magic_link') return null;
  if (session.usedAt) return null;
  if (session.expiresAt < new Date()) return null;

  // Marcar como usado
  await prisma.authSession.update({ where: { id: session.id }, data: { usedAt: new Date() } });

  // Crear sesión larga
  const sessionToken = generateToken();
  await prisma.authSession.create({
    data: {
      merchantId: session.merchantId,
      token: sessionToken,
      type: 'session',
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return sessionToken;
}

export async function getSession(token: string) {
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { merchant: { select: { id: true, name: true, plan: true, planExpiresAt: true, onboardingCompleted: true } } },
  });
  if (!session) return null;
  if (session.type !== 'session') return null;
  if (session.expiresAt < new Date()) return null;
  return session;
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { token } });
}

export async function registerMerchant(params: {
  name: string;
  email: string;
  country?: string;
}): Promise<void> {
  const existing = await prisma.merchant.findUnique({ where: { email: params.email } });
  if (existing) {
    // Si ya existe, simplemente mandamos un magic link nuevo
    await requestMagicLink(params.email);
    return;
  }

  await prisma.merchant.create({
    data: {
      name: params.name,
      email: params.email,
      country: params.country ?? 'ES',
      status: 'active',
      plan: 'trial',
      planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 días trial
    },
  });

  await requestMagicLink(params.email);
}
