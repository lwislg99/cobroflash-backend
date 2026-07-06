import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { suggestQuoteLines, generateQuoteMessage, isAiConfigured } from '../../domain/ai.service';
import { hitRateLimit } from '../../../../core/http/rateLimit';

const router = Router();

function aiUnavailable(res: any) {
  return res.status(503).json({ error: 'ai_not_configured', message: 'El asistente de IA no está configurado. Añade GEMINI_API_KEY (gratis) en Railway.' });
}

// Tope de uso por merchant para que nadie dispare el gasto/cuota de IA:
// 40 sugerencias / hora / merchant (holgado para uso normal, corta el abuso).
function aiCapExceeded(merchantId: number): boolean {
  return hitRateLimit(`ai:${merchantId}`, 40, 60 * 60_000);
}

function aiErrorResponse(res: any, err: any) {
  const msg = err?.message || '';
  if (msg === 'gemini_rate_limited') {
    return res.status(429).json({ error: 'ai_rate_limited', message: 'La IA gratuita alcanzó su límite diario. Prueba de nuevo más tarde o rellena las líneas a mano.' });
  }
  if (msg === 'ai_invalid_json' || msg === 'ai_invalid_format') {
    return res.status(422).json({ error: 'ai_could_not_parse', message: 'La IA no devolvió un formato válido. Inténtalo de nuevo.' });
  }
  if (msg === 'ai_not_configured') return aiUnavailable(res);
  return res.status(500).json({ error: 'internal_error' });
}

/**
 * POST /admin/ai/suggest-quote
 * Body: { description: string }
 * Devuelve: { lines: [{concept, qty, price, tax}] }
 */
router.post('/suggest-quote', async (req, res) => {
  if (!isAiConfigured()) return aiUnavailable(res);
  if (aiCapExceeded(req.merchantId)) {
    return res.status(429).json({ error: 'ai_cap', message: 'Has usado el asistente muchas veces seguidas. Espera un poco o rellena las líneas a mano.' });
  }

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
    return aiErrorResponse(res, err);
  }
});

/**
 * POST /admin/ai/quote-message
 * Body: { quoteId?: number } | { customerName, concept, total, currency }
 * Devuelve: { message: string }
 */
router.post('/quote-message', async (req, res) => {
  if (!isAiConfigured()) return aiUnavailable(res);
  if (aiCapExceeded(req.merchantId)) {
    return res.status(429).json({ error: 'ai_cap', message: 'Has usado el asistente muchas veces seguidas. Espera un poco.' });
  }

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
    return aiErrorResponse(res, err);
  }
});

export default router;
