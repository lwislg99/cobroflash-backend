// src/modules/auth/domain/referral.service.ts
// Sistema de referidos: código único por merchant, atribución en el registro
// y recompensa (mes gratis) cuando un referido paga por primera vez.
import { prisma } from '../../../core/db/prisma';
import { config } from '../../../core/config/env';

// Genera un código tipo "GARCIA26" + sufijo aleatorio si hace falta para unicidad.
function buildCandidate(name: string): string {
  const base = String(name || 'YAQU')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // sin tildes
    .toUpperCase().replace(/[^A-Z0-9]/g, '')           // solo alfanumérico
    .slice(0, 8) || 'YAQU';
  const year = String(new Date().getFullYear()).slice(-2);
  return `${base}${year}`;
}

export async function generateUniqueReferralCode(name: string): Promise<string> {
  let candidate = buildCandidate(name);
  // Si ya existe, añadimos sufijo aleatorio hasta encontrar uno libre
  for (let i = 0; i < 6; i++) {
    const exists = await prisma.merchant.findUnique({ where: { referralCode: candidate } });
    if (!exists) return candidate;
    candidate = buildCandidate(name) + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  // Fallback prácticamente único
  return 'YQ' + Date.now().toString(36).toUpperCase();
}

// Devuelve el código del merchant, generándolo si aún no tiene (backfill perezoso).
export async function ensureReferralCode(merchantId: number): Promise<string> {
  const m = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { referralCode: true, name: true },
  });
  if (m?.referralCode) return m.referralCode;
  const code = await generateUniqueReferralCode(m?.name || 'YAQU');
  await prisma.merchant.update({ where: { id: merchantId }, data: { referralCode: code } });
  return code;
}

export async function getReferralStats(merchantId: number) {
  const code = await ensureReferralCode(merchantId);
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { freeMonthsEarned: true },
  });

  const referred = await prisma.merchant.findMany({
    where: { referredBy: merchantId },
    select: { plan: true },
  });
  const referredCount = referred.length;
  const payingCount = referred.filter((r) => r.plan && r.plan !== 'trial').length;

  const base = config.PUBLIC_BASE_URL || 'https://yaqu.app';
  return {
    code,
    link: `${base}/register.html?ref=${encodeURIComponent(code)}`,
    referredCount,
    payingCount,
    freeMonthsEarned: merchant?.freeMonthsEarned ?? 0,
  };
}

// Resuelve un código de referido a su merchantId (para atribuir en el registro).
export async function resolveReferrer(refCode: string): Promise<number | null> {
  const code = String(refCode || '').trim().toUpperCase();
  if (!code) return null;
  const referrer = await prisma.merchant.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  return referrer?.id ?? null;
}

// Recompensa al referidor cuando el referido paga por primera vez. Idempotente.
export async function rewardReferralOnFirstPayment(referredMerchantId: number): Promise<void> {
  const referred = await prisma.merchant.findUnique({
    where: { id: referredMerchantId },
    select: { referredBy: true, referralRewardedAt: true },
  });
  if (!referred?.referredBy || referred.referralRewardedAt) return; // sin referidor o ya recompensado

  await prisma.$transaction([
    prisma.merchant.update({
      where: { id: referred.referredBy },
      data: { freeMonthsEarned: { increment: 1 } },
    }),
    prisma.merchant.update({
      where: { id: referredMerchantId },
      data: { referralRewardedAt: new Date() },
    }),
  ]);
  console.log(`[referral] merchant ${referred.referredBy} +1 mes gratis (referido ${referredMerchantId} pagó)`);
}
