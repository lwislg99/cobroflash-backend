// src/integrations/gemini.ts — asistente IA vía Google Gemini (tier gratuito).
// REST directo (sin SDK ni dependencia nueva): mismo patrón system+user que
// usábamos con Claude. Se usa para "Sugerir con IA" (líneas de presupuesto y
// mensaje de WhatsApp). Modelo por defecto: gemini-2.0-flash (rápido y gratis
// hasta el límite diario del free tier; si se supera, coste en céntimos).
import { config } from '../core/config/env';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function isGeminiConfigured(): boolean {
  return !!config.GEMINI_API_KEY;
}

/**
 * Una llamada de texto: instrucción de sistema + entrada del usuario → texto.
 * Lanza Error('gemini_*') en fallo para que la capa superior lo traduzca.
 */
export async function geminiComplete(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  if (!config.GEMINI_API_KEY) throw new Error('gemini_not_configured');

  const model = config.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(config.GEMINI_API_KEY)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents: [{ role: 'user', parts: [{ text: params.user }] }],
        generationConfig: {
          maxOutputTokens: params.maxTokens ?? 1024,
          temperature: params.temperature ?? 0.4,
        },
      }),
      // El SDK de Node 18+ trae fetch; timeout defensivo con AbortSignal
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err: any) {
    console.error('[gemini] red/timeout:', err?.message || err);
    throw new Error('gemini_unreachable');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[gemini] HTTP ${response.status}:`, body.slice(0, 300));
    // 429 = te pasaste del tope gratis del día → mensaje específico aguas arriba
    if (response.status === 429) throw new Error('gemini_rate_limited');
    throw new Error('gemini_http_error');
  }

  const data: any = await response.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text || '')
    .join('')
    .trim();

  if (!text) {
    // Puede venir bloqueado por safety o vacío
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    console.error('[gemini] respuesta vacía, finishReason:', reason);
    throw new Error('gemini_empty');
  }
  return text;
}
