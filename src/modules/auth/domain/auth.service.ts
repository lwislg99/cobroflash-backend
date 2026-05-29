import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../../../core/db/prisma';
import { createMailer } from '../../../integrations/mailer';
import { config } from '../../../core/config/env';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS    = 30 * 24 * 60 * 60 * 1000; // 30 días

async function sendEmail(params: { to: string; subject: string; html: string }) {
  if (config.RESEND_API_KEY) {
    await axios.post(
      'https://api.resend.com/emails',
      { from: config.EMAIL_FROM, to: [params.to], subject: params.subject, html: params.html },
      { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10_000 }
    );
    return;
  }
  const mailer = createMailer();
  await mailer.sendMail({ from: config.EMAIL_FROM, to: params.to, subject: params.subject, html: params.html });
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function requestMagicLink(email: string): Promise<void> {
  const merchant = await prisma.merchant.findUnique({ where: { email } });
  if (!merchant) return; // silent

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await prisma.authSession.create({
    data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt },
  });

  const link = `${config.PUBLIC_BASE_URL}/auth/verify?token=${token}`;
  console.log(`[magic-link] to=${email} link=${link}`);

  try {
    await sendEmail({
      to: email,
      subject: 'Tu enlace de acceso a Yaqu',
      html: `<p>Hola <strong>${merchant.name}</strong>,</p>
<p>Haz clic en el botón para acceder a tu cuenta de Yaqu:</p>
<p style="margin:24px 0">
  <a href="${link}" style="background:#22c55e;color:#052e16;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
    Entrar a Yaqu
  </a>
</p>
<p style="color:#6b7280;font-size:13px">Este enlace es de un solo uso y caduca en 15 minutos.<br/>Si no lo solicitaste, puedes ignorar este correo.</p>`,
    });
    console.log(`[magic-link] email enviado OK a ${email}`);
  } catch (emailErr: any) {
    console.error(`[magic-link] ERROR enviando email a ${email}:`, emailErr?.message || emailErr);
  }
}

// Invita a un miembro del equipo: crea AuthSession magic_link vinculada al teamMemberId
export async function inviteTeamMember(params: {
  merchantId: number;
  teamMemberId: number;
  memberName: string;
  memberEmail: string;
  merchantName: string;
}): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días para aceptar invitación

  await prisma.authSession.create({
    data: {
      merchantId: params.merchantId,
      teamMemberId: params.teamMemberId,
      token,
      type: 'magic_link',
      expiresAt,
    },
  });

  const link = `${config.PUBLIC_BASE_URL}/auth/verify?token=${token}`;
  console.log(`[invite] to=${params.memberEmail} link=${link}`);

  try {
    await sendEmail({
      to: params.memberEmail,
      subject: `Te han invitado a Yaqu — ${params.merchantName}`,
      html: `<p>Hola <strong>${params.memberName}</strong>,</p>
<p><strong>${params.merchantName}</strong> te ha invitado a colaborar en su cuenta de Yaqu.</p>
<p style="margin:24px 0">
  <a href="${link}" style="background:#22c55e;color:#052e16;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
    Aceptar invitación
  </a>
</p>
<p style="color:#6b7280;font-size:13px">Este enlace caduca en 7 días.<br/>Si no esperabas esta invitación, puedes ignorar este correo.</p>`,
    });
    console.log(`[invite] email enviado OK a ${params.memberEmail}`);
  } catch (emailErr: any) {
    console.error(`[invite] ERROR enviando email a ${params.memberEmail}:`, emailErr?.message || emailErr);
  }
}

export async function verifyMagicLink(token: string): Promise<string | null> {
  const session = await prisma.authSession.findUnique({ where: { token } });

  if (!session) return null;
  if (session.type !== 'magic_link') return null;
  if (session.usedAt) return null;
  if (session.expiresAt < new Date()) return null;

  await prisma.authSession.update({ where: { id: session.id }, data: { usedAt: new Date() } });

  // Si es invitación de team member, activar el miembro
  if (session.teamMemberId) {
    await prisma.teamMember.update({
      where: { id: session.teamMemberId },
      data: { status: 'active' },
    });
  }

  const sessionToken = generateToken();
  await prisma.authSession.create({
    data: {
      merchantId: session.merchantId,
      teamMemberId: session.teamMemberId ?? null,
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
    include: {
      merchant: {
        select: { id: true, name: true, plan: true, planExpiresAt: true, onboardingCompleted: true },
      },
      teamMember: {
        select: { id: true, name: true, role: true, status: true },
      },
    },
  });
  if (!session) return null;
  if (session.type !== 'session') return null;
  if (session.expiresAt < new Date()) return null;
  // Suspendidos no pueden entrar
  if (session.teamMember && session.teamMember.status === 'suspended') return null;
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
      planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await requestMagicLink(params.email);
}
