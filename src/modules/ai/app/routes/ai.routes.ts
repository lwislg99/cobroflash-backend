import { Router } from 'express';
import { config } from '../../../../core/config/env';
import { prisma } from '../../../../core/db/prisma';
import { suggestQuoteLines, generateQuoteMessage } from '../../domain/ai.service';

const router = Router();

function aiUnavailable(res: any) {
  return res.status(503).json({ error: 'ai_not_configured', message: 'Configura ANTHROPIC_API_KEY en Railway para activar el asistente IA.' });
}

/**
 * POST /admin/ai/suggest-quote
 * Body: { description: string }
 * Devuelve: { lines: [{concept, qty, price, tax}] }
 */
router.post('/suggest-quote', async (req, res) => {
  if (!config.ANTHROPIC_API_KEY) return aiUnavailable(res);

  const description = String(req.body?.description || '').trim();
  if (!description) return res.status(400).json({ error: 'description_required' });
  if (description.length > 2000) return res.status(400).json({ error: 'description_too_long' });

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { country: true, defaultCurrency: true },
    });

    const lines = await suggestQuoteLines({
      description,
      merchantId: req.merchantId,
      country: merchant?.country || 'ES',
      currency: merchant?.defaultCurrency || 'EUR',
    });

    return res.json({ lines });
  } catch (err: any) {
    console.error('[POST /admin/ai/suggest-quote]', err?.message || err);
    if (err?.message === 'ai_invalid_json' || err?.message === 'ai_invalid_format') {
      return res.status(422).json({ error: 'ai_could_not_parse', message: 'La IA no devolvió un formato válido. Inténtalo de nuevo.' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/ai/quote-message
 * Body: { quoteId?: number } | { customerName, concept, total, currency }
 * Devuelve: { message: string }
 */
router.post('/quote-message', async (req, res) => {
  if (!config.ANTHROPIC_API_KEY) return aiUnavailable(res);

  try {
    const quoteId = req.body?.quoteId ? Number(req.body.quoteId) : null;

    let customerName: string;
    let merchantName: string;
    let concept: string;
    let total: string;
    let currency: string;

    if (quoteId && Number.isInteger(quoteId)) {
      const quote = await prisma.quote.findFirst({
        where: { id: quoteId, merchantId: req.merchantId },
        include: { customer: true, merchant: true },
      });
      if (!quote) return res.status(404).json({ error: 'quote_not_found' });

      customerName = quote.customer.name;
      merchantName = quote.merchant.name;
      concept = ((quote.lines as any[])?.[0]?.concept as string) || 'trabajo realizado';
      total = Number(quote.total).toFixed(2);
      currency = quote.currency;
    } else {
      customerName = String(req.body?.customerName || '').trim();
      concept      = String(req.body?.concept      || '').trim();
      total        = String(req.body?.total        || '0');
      currency     = String(req.body?.currency     || 'EUR');

      if (!customerName || !concept) {
        return res.status(400).json({ error: 'missing_params' });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { id: req.merchantId },
        select: { name: true },
      });
      merchantName = String(req.body?.merchantName || merchant?.name || 'el profesional');
    }

    const message = await generateQuoteMessage({ customerName, merchantName, concept, total, currency });
    return res.json({ message });
  } catch (err: any) {
    console.error('[POST /admin/ai/quote-message]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
