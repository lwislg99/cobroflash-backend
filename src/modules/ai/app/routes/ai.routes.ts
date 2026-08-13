import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { suggestQuoteLines, generateQuoteMessage, isAiConfigured, suggestAlbaranLines } from '../../domain/ai.service';
import { hitRateLimit } from '../../../../core/http/rateLimit';
import { isFlagEnabled } from '../../../../core/flags'; // SCRUM-71

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
  const msg = err?.message || err?.code || '';
  // `detail` = el motivo EXACTO que devolvió Google (diagnóstico, sin secretos)
  const detail = err?.providerDetail || undefined;
  if (msg === 'gemini_rate_limited') {
    return res.status(429).json({ error: 'ai_rate_limited', message: 'La IA gratuita alcanzó su límite diario. Prueba de nuevo más tarde o rellena las líneas a mano.', detail });
  }
  if (msg === 'gemini_bad_key') {
    return res.status(503).json({ error: 'ai_bad_key', message: 'La clave de IA (GEMINI_API_KEY) no es válida. Revísala en Railway.', detail });
  }
  if (msg === 'gemini_model_unavailable' || msg === 'gemini_http_error' || msg === 'gemini_unreachable' || msg === 'gemini_empty') {
    return res.status(502).json({ error: 'ai_provider_error', message: 'La IA no respondió bien. Inténtalo de nuevo en un momento.', detail });
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

    const propuesta = await suggestQuoteLines({
      description,
      merchantId: req.merchantId,
      country: merchant?.country || 'ES',
      currency: merchant?.defaultCurrency || 'EUR',
    });

    // SCRUM-507: `descartadas` viaja al navegador. Una linea que no se puede proponer —hoy solo
    // por IVA ilegible— NO desaparece en silencio: el profesional ve QUE trabajo se quedo fuera y
    // puede escribirlo a mano. `lines` conserva su nombre para no romper al consumidor.
    return res.json({ lines: propuesta.lineas, descartadas: propuesta.descartadas });
  } catch (err: any) {
    console.error('[POST /admin/ai/suggest-quote]', err?.message || err);
    return aiErrorResponse(res, err);
  }
});

/**
 * POST /admin/ai/suggest-albaran-lines — SCRUM-71 (VOZ-ALB V1)
 * Body: { albaranId: number, description: string }
 * Devuelve: { lines: [{concepto, cantidad, unidad, precioUnitario?, tipoIva?}] }
 *
 * DOS DECISIONES QUE NO SON DE ESTILO:
 *
 * 1. El GATE del flag está AQUÍ, no solo en la UI. Si el flag únicamente escondiera el
 *    botón, apagarlo no apagaría la función: dejaría la puerta abierta a quien conozca la
 *    ruta. Un flag que no cierra el mecanismo es una prohibición sin mecanismo.
 *
 * 2. `modoValoracion` se lee del ALBARÁN EN LA BD, jamás del cuerpo de la petición. Si el
 *    cliente pudiera mandar 'VALORADO', se saltaría por completo la regla de que un albarán
 *    SIN_VALORAR no lleva precios — que es el requisito central de este ticket. Y el
 *    `findFirst` filtra por `merchantId` (regla 2): el albarán tiene que ser suyo.
 */
router.post('/suggest-albaran-lines', async (req, res) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.merchantId },
    select: { id: true, country: true, defaultCurrency: true, flags: true },
  });
  if (!isFlagEnabled('VOICE_ALBARAN_ENABLED', { merchant })) {
    return res.status(404).json({ error: 'not_found' }); // apagado = indistinguible de inexistente
  }
  if (!isAiConfigured()) return aiUnavailable(res);
  if (aiCapExceeded(req.merchantId)) {
    return res.status(429).json({ error: 'ai_cap', message: 'Has usado el asistente muchas veces seguidas. Espera un poco o rellena las líneas a mano.' });
  }

  const albaranId = Number(req.body?.albaranId);
  const description = String(req.body?.description || '').trim();
  if (!Number.isInteger(albaranId) || albaranId <= 0) return res.status(400).json({ error: 'albaran_id_required' });
  if (!description) return res.status(400).json({ error: 'description_required' });
  if (description.length > 2000) return res.status(400).json({ error: 'description_too_long' });

  try {
    const albaran = await prisma.albaran.findFirst({
      where: { id: albaranId, merchantId: req.merchantId },
      select: { modoValoracion: true, estado: true },
    });
    if (!albaran) return res.status(404).json({ error: 'not_found' });
    // Las líneas solo se editan en borrador (mismo candado que lineas/notas/fecha, SCRUM-65):
    // sugerir para un albarán ya emitido sería ofrecer algo que no se puede aplicar.
    if (albaran.estado !== 'borrador') return res.status(409).json({ error: 'albaran_no_editable' });

    const lines = await suggestAlbaranLines({
      description,
      merchantId: req.merchantId,
      country: merchant?.country || 'ES',
      currency: merchant?.defaultCurrency || 'EUR',
      modoValoracion: albaran.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR',
    });

    return res.json({ lines });
  } catch (err: any) {
    console.error('[POST /admin/ai/suggest-albaran-lines]', err?.message || err);
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
