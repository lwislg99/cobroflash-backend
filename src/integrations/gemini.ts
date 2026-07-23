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

// Error con el MOTIVO exacto que devuelve Google, para diagnosticar sin adivinar.
export class GeminiError extends Error {
  constructor(public code: string, public providerDetail?: string, public httpStatus?: number) {
    super(code);
  }
}

export type GeminiParams = {
  system: string; user: string; maxTokens?: number; temperature?: number;
  // Si se pasa un esquema, Gemini DEVUELVE JSON válido garantizado (structured
  // output): nada de markdown ni texto alrededor. Se usa para las líneas.
  jsonSchema?: unknown;
};

// Una sola llamada a un modelo concreto.
async function callGeminiModel(model: string, params: GeminiParams): Promise<string> {
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(config.GEMINI_API_KEY)}`;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: params.maxTokens ?? 1024,
    temperature: params.temperature ?? 0.4,
  };
  if (params.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = params.jsonSchema;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents: [{ role: 'user', parts: [{ text: params.user }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err: any) {
    // SCRUM-105: nunca el objeto err crudo — la API key de Gemini viaja en la URL (línea
    // 30) y un error de fetch/axios puede arrastrar la request (headers/URL) completa.
    console.error(`[gemini:${model}] red/timeout:`, err?.message || 'error desconocido');
    throw new GeminiError('gemini_unreachable');
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    let detail = bodyText.slice(0, 300);
    try { detail = JSON.parse(bodyText)?.error?.message || detail; } catch { /* texto plano */ }
    console.error(`[gemini:${model}] HTTP ${response.status}: ${detail}`);
    // 429 (cuota) y 404 (modelo no disponible) son RECUPERABLES con otro modelo.
    if (response.status === 429) throw new GeminiError('gemini_rate_limited', detail, 429);
    if (response.status === 404) throw new GeminiError('gemini_model_unavailable', detail, 404);
    if (response.status === 400 && /API key/i.test(detail)) throw new GeminiError('gemini_bad_key', detail, 400);
    throw new GeminiError('gemini_http_error', detail, response.status);
  }

  const data: any = await response.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('').trim();
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    console.error(`[gemini:${model}] respuesta vacía, finishReason:`, reason);
    throw new GeminiError('gemini_empty', `finishReason: ${reason || 'desconocido'}`);
  }
  return text;
}

/**
 * Instrucción de sistema + entrada del usuario → texto. Prueba los modelos de
 * GEMINI_MODEL (lista separada por comas) EN ORDEN: si el primero da cuota
 * agotada o no existe, pasa al siguiente. Así una clave nueva funciona aunque
 * un modelo concreto tenga la cuota gratis a 0.
 */
export async function geminiComplete(params: GeminiParams): Promise<string> {
  if (!config.GEMINI_API_KEY) throw new GeminiError('gemini_not_configured');

  const models = (config.GEMINI_MODEL || 'gemini-2.5-flash,gemini-2.0-flash,gemini-flash-latest')
    .split(',').map((m) => m.trim()).filter(Boolean);

  let lastErr: GeminiError | undefined;
  for (const model of models) {
    try {
      return await callGeminiModel(model, params);
    } catch (err) {
      const e = err as GeminiError;
      lastErr = e;
      // Probamos otro modelo si: cuota agotada, no existe, o respuesta vacía
      // (p. ej. un modelo que "piensa" agotó el margen de tokens).
      if (e.code === 'gemini_rate_limited' || e.code === 'gemini_model_unavailable' || e.code === 'gemini_empty') continue;
      throw e; // red, key inválida, etc. → no tiene sentido reintentar
    }
  }
  throw lastErr ?? new GeminiError('gemini_http_error');
}
