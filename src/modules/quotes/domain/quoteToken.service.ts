// src/modules/quotes/domain/quoteToken.service.ts — SCRUM-95
// Token OPACO público del presupuesto (patrón ensureChargeReceiptToken, SCRUM-74;
// Quote.id es autoincremental y NUNCA debe usarse como identificador público). Generado
// perezosamente la primera vez que se necesita un enlace (WhatsApp, email, bot, portal);
// estable en llamadas siguientes (mismo presupuesto → mismo token).
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

export async function ensureQuoteDecisionToken(
  quoteId: number,
  prisma: PrismaClient,
): Promise<string> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { decisionToken: true },
  });
  if (!quote) throw new Error('quote_not_found');
  if (quote.decisionToken) return quote.decisionToken;

  const token = crypto.randomBytes(16).toString('hex');
  await prisma.quote.update({ where: { id: quoteId }, data: { decisionToken: token } });
  return token;
}
