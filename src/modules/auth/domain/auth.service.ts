import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../../../core/db/prisma';
import { createMailer } from '../../../integrations/mailer';
import { config } from '../../../core/config/env';
import { sendWelcomeEmail } from '../../messaging/domain/lifecycle.service';
import { renderEmailLayout, escEmail } from '../../messaging/domain/emailLayout';
import { generateUniqueReferralCode, resolveReferrer } from './referral.service';
import { maskEmail } from '../../../core/utils/utils';

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

// SCRUM-39: los magic links (credenciales temporales: 15 min login / 7 días invitación)
// SOLO se loguean si el email está realmente deshabilitado (fallback dev/staging sin
// RESEND_API_KEY ni SMTP_URL — ahí el log es la única forma de entrar) o con
// LOG_MAGIC_LINKS=true explícito, env var que NO existe en producción. En prod
// (Resend configurado) el token jamás toca los logs de Railway.
function logMagicLink(tag: string, to: string, link: string) {
  const emailDisabled = !config.RESEND_API_KEY && !config.SMTP_URL;
  if (emailDisabled || process.env.LOG_MAGIC_LINKS === 'true') {
    console.log(`[${tag}] to=${to} link=${link}`);
  }
}

// SCRUM-92: emite el magic link de LOGIN (15 min) y lo envía por email. Compartido
// por la cuenta Merchant (owner, teamMemberId null) y por un TeamMember (operario,
// teamMemberId set) — mismo AuthSession { merchantId, teamMemberId, type:'magic_link' }
// que ya crea inviteTeamMember, así que verifyMagicLink/getSession/requireAuth (que
// derivan req.merchantId/req.userRole de esa fila) quedan INTACTOS: no hay lógica de
// rol/tenancy nueva que pueda equivocarse, solo un segundo punto de entrada que crea
// la fila con la forma ya probada.
async function issueLoginLink(params: {
  merchantId: number;
  teamMemberId: number | null;
  email: string;
  recipientName: string;
  businessName?: string | null;
}): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await prisma.authSession.create({
    data: { merchantId: params.merchantId, teamMemberId: params.teamMemberId, token, type: 'magic_link', expiresAt },
  });

  const link = `${config.PUBLIC_BASE_URL}/auth/verify?token=${token}`;
  logMagicLink('magic-link', params.email, link); // SCRUM-39: gateado — en prod no se loguea

  const intro = params.businessName
    ? `Toca el botón y entras directo a tu cuenta de <strong>${escEmail(params.businessName)}</strong>. Sin contraseñas.`
    : 'Toca el botón y entras directo a tu cuenta. Sin contraseñas.';

  try {
    await sendEmail({
      to: params.email,
      subject: 'Tu enlace de acceso a YaQu',
      // A6.4: layout de marca compartido (emailLayout.ts)
      html: renderEmailLayout({
        heading: 'Tu acceso a YaQu',
        bodyHtml: `<p style="margin:0 0 8px">Hola <strong>${escEmail(params.recipientName)}</strong>,</p>
<p style="margin:0">${intro}</p>`,
        ctaLabel: 'Entrar en YaQu',
        ctaUrl: link,
        footnote: 'Este enlace es de un solo uso y caduca en 15 minutos. Si no lo solicitaste, puedes ignorar este correo.',
      }),
    });
    console.log(`[magic-link] email enviado OK a ${maskEmail(params.email)}`); // SCRUM-101
  } catch (emailErr: any) {
    console.error(`[magic-link] ERROR enviando email a ${maskEmail(params.email)}:`, emailErr?.message || emailErr); // SCRUM-101
  }
}

export async function requestMagicLink(email: string): Promise<void> {
  const merchant = await prisma.merchant.findUnique({ where: { email } });
  if (merchant) {
    await issueLoginLink({ merchantId: merchant.id, teamMemberId: null, email, recipientName: merchant.name });
    return;
  }

  // SCRUM-92: si el email no es un Merchant, probar TeamMember (operario). Sin esto,
  // un operario que necesita VOLVER a entrar (cierra sesión, cambia de móvil, le
  // caduca la cookie) se queda fuera para siempre — el 1er acceso funciona por
  // inviteTeamMember, pero no había vía de vuelta. Precedencia: si el email coincide
  // con AMBAS tablas (raro: alguien es owner de un merchant Y operario de otro con el
  // mismo email — TeamMember.email es @unique global, así que nunca hay ambigüedad
  // DENTRO de TeamMember), gana el Merchant (ya resuelto arriba) — el operario sigue
  // pudiendo entrar a esa cuenta vía la invitación original o que se la reenvíen.
  const teamMember = await prisma.teamMember.findUnique({ where: { email } });
  if (!teamMember) {
    // Requisito del ticket: NUNCA revelar al usuario si el email existe (mismo 200
    // genérico de siempre) — pero SÍ dejar traza en servidor para poder depurarlo.
    // SCRUM-101: el email en SÍ es el dato que este log no debe guardar en claro — la
    // respuesta HTTP ya no lo revela al usuario; el log de Railway tampoco debe hacerlo.
    console.log(`[magic-link] intento de login con email no registrado: ${maskEmail(email)}`);
    return;
  }
  if (teamMember.status === 'suspended') {
    // Mismo trato que "no existe": jamás confirmar el estado de una cuenta ajena.
    console.log(`[magic-link] intento de login de TeamMember SUSPENDIDO: ${maskEmail(email)} (id=${teamMember.id}, merchantId=${teamMember.merchantId})`); // SCRUM-101
    return;
  }
  // status 'invited' se deja pasar a propósito: verifyMagicLink ya activa cualquier
  // AuthSession con teamMemberId al canjearla (mismo camino que aceptar la invitación
  // original), y getSession solo bloquea 'suspended' — no hace falta lógica nueva.

  const merchantOfMember = await prisma.merchant.findUnique({
    where: { id: teamMember.merchantId },
    select: { name: true },
  });
  await issueLoginLink({
    merchantId: teamMember.merchantId,
    teamMemberId: teamMember.id,
    email,
    recipientName: teamMember.name,
    businessName: merchantOfMember?.name,
  });
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
  logMagicLink('invite', params.memberEmail, link); // SCRUM-39 (a): mismo gate — link válido 7 días

  try {
    await sendEmail({
      to: params.memberEmail,
      subject: `Te han invitado a YaQu — ${params.merchantName}`,
      // A6.4: layout de marca compartido (emailLayout.ts)
      html: renderEmailLayout({
        heading: `${escEmail(params.merchantName)} te invita a su equipo`,
        bodyHtml: `<p style="margin:0 0 8px">Hola <strong>${escEmail(params.memberName)}</strong>,</p>
<p style="margin:0"><strong>${escEmail(params.merchantName)}</strong> te ha invitado a colaborar en su cuenta de YaQu.</p>`,
        ctaLabel: 'Aceptar invitación',
        ctaUrl: link,
        footnote: 'Este enlace caduca en 7 días. Si no esperabas esta invitación, puedes ignorar este correo.',
      }),
    });
    console.log(`[invite] email enviado OK a ${maskEmail(params.memberEmail)}`); // SCRUM-101
  } catch (emailErr: any) {
    console.error(`[invite] ERROR enviando email a ${maskEmail(params.memberEmail)}:`, emailErr?.message || emailErr); // SCRUM-101
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
        select: { id: true, name: true, email: true, plan: true, planExpiresAt: true, onboardingCompleted: true },
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
  ref?: string;
  // V0-3: atribución de adquisición ("utm_source/medium/campaign" o "ref:CODIGO")
  source?: string;
}): Promise<void> {
  const existing = await prisma.merchant.findUnique({ where: { email: params.email } });
  if (existing) {
    await requestMagicLink(params.email);
    return;
  }

  // Atribución de referido (si llega un código válido y no es autorreferencia)
  const referredBy = params.ref ? await resolveReferrer(params.ref) : null;
  const referralCode = await generateUniqueReferralCode(params.name);

  const created = await prisma.merchant.create({
    data: {
      name: params.name,
      email: params.email,
      country: params.country ?? 'ES',
      status: 'active',
      plan: 'trial',
      planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      referralCode,
      referredBy: referredBy ?? null,
      acquisitionSource: params.source ?? (params.ref ? `ref:${params.ref}` : null), // V0-3
    },
  });

  // Email de bienvenida (no bloquea el registro si falla)
  sendWelcomeEmail(created.id).catch((e) => console.error('[register] welcome email:', e?.message));

  await requestMagicLink(params.email);
}
