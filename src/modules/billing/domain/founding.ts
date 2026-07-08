// V0-4 (master U1.1 / W1) — Oferta founding: 9,90 €/mes DE POR VIDA, 20 plazas.
// El contador es REAL (merchants con plan='founding' en BD); prohibido fake (V0-4).
import { prisma } from '../../../core/db/prisma';

export const FOUNDING_SEATS = 20;
export const FOUNDING_PRICE = 9.9;

export async function getFoundingStatus(): Promise<{ price: number; seatsTotal: number; seatsLeft: number; taken: number }> {
  const taken = await prisma.merchant.count({ where: { plan: 'founding' } });
  return {
    price: FOUNDING_PRICE,
    seatsTotal: FOUNDING_SEATS,
    seatsLeft: Math.max(0, FOUNDING_SEATS - taken),
    taken,
  };
}
