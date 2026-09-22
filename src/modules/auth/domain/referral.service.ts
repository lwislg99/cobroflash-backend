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

// Canje manual de un mes gratis ganado por referidos (sin cupones de Stripe).
// Extiende planExpiresAt +30 días (desde la expiración actual si está vigente,
// o desde hoy si ya expiró) y descuenta un crédito.
//
// 🔴 UN CRÉDITO SE GASTA UNA VEZ, Y LO GARANTIZA LA BASE — no una comprobación en JavaScript.
//
// Aquí decía «Idempotente por crédito» mientras el código leía `freeMonthsEarned`, comprobaba
// `< 1` y DESPUÉS descontaba. Entre el `if` y el `update` no había nada, y dos canjes simultáneos
// pasaban los dos. Medido en SCRUM-856, con las dos caras:
//   · con UN crédito, el saldo quedaba en **−1** — un estado al que no se llega canjeando;
//   · con DOS créditos se gastaban los dos y la cuenta se extendía **30 días, no 60**, porque los
//     dos calculaban la fecha nueva sobre la misma lectura y escribían el mismo valor absoluto.
//     El merchant pagaba dos y se llevaba uno.
//
// 🔒 Un comentario que afirma una propiedad que el código no tiene es peor que no tenerlo: el
// siguiente que lo lea no va a comprobarlo, ya se lo han dicho. Por eso esta cabecera ya no dice
// «es idempotente»: dice QUÉ lo hace serlo, y si eso se quita, se sabe qué se está quitando.
//
// Lo que lo hace seguro, y no se puede simplificar sin traer la carrera de vuelta:
//   ① la guarda viaja DENTRO del UPDATE (`updateMany` con `freeMonthsEarned: { gte: 1 }`), que la
//      base ejecuta de una pieza — es el patrón de `recapitulativa.service.ts:118`;
//   ② el código MIRA el `count`: es lo único que distingue «he reclamado yo» de «alguien se me
//      adelantó», y un update condicional cuyo resultado no se mira descuenta igual;
//   ③ la extensión se calcula DENTRO de la misma transacción y DESPUÉS de haber reclamado, para
//      que el cerrojo de fila impida que otro canje se cuele entre el descuento y la fecha.
//
// Nota: para suscripciones Stripe activas, planExpiresAt lo refresca el webhook
// de Stripe; el canje es plenamente efectivo en trial/acceso manual.
export async function redeemFreeMonth(
  merchantId: number,
): Promise<{ ok: boolean; reason?: string; planExpiresAt?: Date | null; freeMonthsEarned?: number }> {
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const reclamo = await tx.merchant.updateMany({
      where: { id: merchantId, freeMonthsEarned: { gte: 1 } },
      data: { freeMonthsEarned: { decrement: 1 } },
    });
    if (reclamo.count !== 1) return null; // no existe, no hay crédito, o alguien se adelantó

    const m = await tx.merchant.findUnique({
      where: { id: merchantId },
      select: { planExpiresAt: true, freeMonthsEarned: true },
    });
    const base = m?.planExpiresAt && m.planExpiresAt > now ? m.planExpiresAt : now;
    const newExpiry = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

    return tx.merchant.update({
      where: { id: merchantId },
      data: { planExpiresAt: newExpiry },
      select: { planExpiresAt: true, freeMonthsEarned: true },
    });
  });

  // `count: 0` no distingue «no existe» de «sin crédito», y la ruta SÍ los distingue
  // (`app.ts:638`: no_credit → 409, el resto → 400). Se resuelve con una lectura barata y sólo
  // en el camino de fallo, que es el que no corre a diario.
  if (!updated) {
    const existe = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
    return { ok: false, reason: existe ? 'no_credit' : 'not_found' };
  }

  console.log(`[referral] merchant ${merchantId} canjeó 1 mes gratis → expira ${updated.planExpiresAt?.toISOString()}`);
  return { ok: true, planExpiresAt: updated.planExpiresAt, freeMonthsEarned: updated.freeMonthsEarned };
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

/**
 * Recompensa al referidor cuando el referido paga por primera vez.
 *
 * 🔴 EL CERROJO ES EL `where` DEL UPDATE, NO LA LECTURA DE ARRIBA.
 *
 * Antes esto leía `referralRewardedAt`, comprobaba en JavaScript y DESPUÉS escribía. Dos entregas
 * simultáneas del mismo primer pago leían `null` las dos, las dos pasaban la guarda y las dos
 * incrementaban: **el referidor se llevaba dos meses gratis por un solo referido** (medido en
 * `docs/master/SCRUM-815.md`, paso ① §3). Entre el `if` y el `update` no hay nada que impida que
 * otro proceso haga exactamente lo mismo.
 *
 * Ahora la condición **viaja dentro del UPDATE**: `updateMany` con `referralRewardedAt: null`
 * comprueba y escribe en una sola sentencia, que la base ejecuta de una pieza. El que llega
 * segundo recibe `count: 0` y se va sin cobrar. Es el mismo patrón —y por el mismo motivo— que el
 * guard anti-doble-consolidación de `recapitulativa.service.ts:118`, que el máster describe como
 * «lo que hace segura la concurrencia».
 *
 * ⚠️ `count` NO es decorativo: es lo ÚNICO que distingue «he reclamado yo» de «alguien se me
 * adelantó». Un update condicional cuyo resultado no se mira vuelve a tener el defecto con otra
 * forma — escribiría la recompensa igual.
 */
export async function rewardReferralOnFirstPayment(referredMerchantId: number): Promise<void> {
  const referred = await prisma.merchant.findUnique({
    where: { id: referredMerchantId },
    select: { referredBy: true, referralRewardedAt: true },
  });
  // Atajo BARATO para el caso normal (la entrega repetida de días después). NO es el cerrojo:
  // el cerrojo está abajo, y por eso dos que pasen de aquí a la vez siguen siendo seguras.
  if (!referred?.referredBy || referred.referralRewardedAt) return;

  const referrerId = referred.referredBy;
  const cobrado = await prisma.$transaction(async (tx) => {
    const reclamo = await tx.merchant.updateMany({
      where: { id: referredMerchantId, referralRewardedAt: null },
      data: { referralRewardedAt: new Date() },
    });
    // Otra entrega se adelantó y ya marcó al referido: ni se incrementa ni se deshace nada suyo.
    if (reclamo.count !== 1) return false;

    await tx.merchant.update({
      where: { id: referrerId },
      data: { freeMonthsEarned: { increment: 1 } },
    });
    return true;
  });

  if (!cobrado) {
    console.log(`[referral] recompensa ya reclamada para el referido ${referredMerchantId} — no se paga dos veces`);
    return;
  }
  console.log(`[referral] merchant ${referrerId} +1 mes gratis (referido ${referredMerchantId} pagó)`);
}
