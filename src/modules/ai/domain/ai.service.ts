/**
 * AI Quote Assistant.
 * Proveedor: Gemini (tier gratuito) por defecto; Claude como fallback solo si
 * Gemini no está configurado pero sí ANTHROPIC_API_KEY. Decisión del fundador
 * (6-jul-2026): la voz es dictado gratis del navegador; "Sugerir con IA" pasa a
 * una IA gratis para no gastar saldo de pago.
 *
 * suggestQuoteLines: dado un texto descriptivo del trabajo y el catálogo del
 * merchant, devuelve líneas de presupuesto listas para rellenar el formulario.
 * generateQuoteMessage: genera el mensaje de WhatsApp del link del presupuesto.
 */
import { anthropic } from '../../../integrations/claude';
import { geminiComplete, isGeminiConfigured } from '../../../integrations/gemini';
import { config } from '../../../core/config/env';
import { prisma } from '../../../core/db/prisma';

// ¿Hay algún proveedor de IA disponible? (lo usa la ruta para el 503 digno)
export function isAiConfigured(): boolean {
  return isGeminiConfigured() || !!config.ANTHROPIC_API_KEY;
}

// Capa única: Gemini si hay key; si no, Claude; si ninguna, error claro.
async function aiComplete(params: {
  system: string;
  user: string;
  maxTokens: number;
  jsonSchema?: unknown; // fuerza JSON válido en Gemini (líneas de presupuesto)
}): Promise<string> {
  if (isGeminiConfigured()) {
    return geminiComplete({ system: params.system, user: params.user, maxTokens: params.maxTokens, jsonSchema: params.jsonSchema });
  }
  if (config.ANTHROPIC_API_KEY) {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: params.maxTokens,
      system: [{ type: 'text', text: params.system, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: params.user }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('ai_no_response');
    return textBlock.text.trim();
  }
  throw new Error('ai_not_configured');
}

// ─── System prompts (estables → se cachean) ───────────────────────────────

const SUGGEST_SYSTEM = `Eres un asistente especializado en ayudar a profesionales de servicios \
(fontaneros, electricistas, reformistas, pintores, carpinteros…) de España y LATAM a crear presupuestos.

Tu tarea: analiza la descripción del trabajo y devuelve un JSON array con las líneas del presupuesto.

Formato de respuesta — SOLO el JSON array, sin texto adicional:
[{"concept":"string","qty":number,"price":number,"tax":number}]

Reglas:
- tax es el IVA como decimal: 0.21 (ES/AR), 0.16 (MX), 0.19 (CO/CL), 0.18 (PE)
- Precios en moneda local, realistas para el tipo de servicio
- Si el catálogo incluye items relevantes, reutilízalos (mismo precio)
- Conceptos específicos: "Mano de obra instalación grifo" no "Mano de obra"
- Entre 2 y 8 líneas
- qty suele ser 1 salvo que se indique cantidad explícita

Entrada por DICTADO (VZ-2 — el texto puede venir de voz, hablado en la furgoneta):
- Puede llegar sin puntuación, con muletillas (eh, mira, ponme, apúntame, si eso, o sea)
  y números en palabras: "dos horas" → qty 2, "doscientos euros" → 200. Ignora las
  muletillas: NUNCA las conviertas en conceptos.
- El catálogo MANDA aunque lo digan con otras palabras. Sinónimos habituales de obra:
  váter/inodoro → cisterna · calentador/termo/boiler → termo eléctrico · desagüe
  atascado/embozado → desatasco · pérdida/gotera de agua → fuga · mezclador → grifo
  monomando. Si un ítem del catálogo encaja semánticamente, usa EXACTAMENTE su nombre
  y su precio.
- "X horas de mano de obra" → UNA línea de mano de obra del catálogo con qty X (no X líneas).
  "dos grifos" → la línea del grifo con qty 2.
- Fuera de catálogo (desplazamiento, materiales…): concepto claro y precio realista para
  el país; si el profesional dicta el precio ("unos 200"), usa ESE precio.
- NUNCA añadas trabajos que no se han mencionado.`;

const MESSAGE_SYSTEM = `Eres un asistente de comunicación para profesionales de servicios en España y LATAM.
Genera mensajes de WhatsApp concisos, cordiales y profesionales en español.
Requisitos:
- Máximo 3-4 frases
- Menciona el trabajo y el importe total
- Invita a revisar y firmar el presupuesto
- Tono cercano pero profesional
- Sin placeholders como [nombre] — usa los datos reales
- Sin markdown, sin listas, solo texto plano
- Devuelve únicamente el texto del mensaje, sin comillas`;

// ─── Suggest quote lines ───────────────────────────────────────────────────

export async function suggestQuoteLines(params: {
  description: string;
  merchantId: number;
  country: string;
  currency: string;
}): Promise<Array<{ concept: string; qty: number; price: number; tax: number }>> {
  // Catálogo del merchant para dar contexto de precios
  const products = await prisma.product.findMany({
    where: { merchantId: params.merchantId, isActive: true },
    select: { name: true, price: true },
    take: 40,
    orderBy: { name: 'asc' },
  });

  const catalogText = products.length > 0
    ? `\nCatálogo del profesional:\n${products.map(p => `- ${p.name}: ${Number(p.price).toFixed(2)} ${params.currency}`).join('\n')}\n`
    : '';

  const userContent = `País: ${params.country} | Moneda: ${params.currency}${catalogText}
Descripción del trabajo:
${params.description}`;

  // Esquema de salida: array de líneas. En Gemini fuerza JSON válido; da margen
  // de tokens porque los modelos 2.5 "piensan" antes de responder.
  const LINES_SCHEMA = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        concept: { type: 'STRING' },
        qty: { type: 'NUMBER' },
        price: { type: 'NUMBER' },
        tax: { type: 'NUMBER' },
      },
      required: ['concept', 'qty', 'price', 'tax'],
    },
  };
  const raw = (await aiComplete({ system: SUGGEST_SYSTEM, user: userContent, maxTokens: 4096, jsonSchema: LINES_SCHEMA })).trim();

  // Extraer el JSON array del texto (robusto ante texto rodeando el JSON)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('ai_invalid_json');

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) throw new Error('ai_invalid_format');

  return parsed.map((l: any) => ({
    concept: String(l.concept || '').trim(),
    qty: Math.max(0.01, Number(l.qty) || 1),
    price: Math.max(0, Number(l.price) || 0),
    tax: Math.min(1, Math.max(0, Number(l.tax) || 0)),
  }));
}

// ─── Generate WhatsApp message ─────────────────────────────────────────────

export async function generateQuoteMessage(params: {
  customerName: string;
  merchantName: string;
  concept: string;
  total: string;
  currency: string;
}): Promise<string> {
  const user = `Cliente: ${params.customerName}
Profesional: ${params.merchantName}
Trabajo: ${params.concept}
Total: ${params.total} ${params.currency}`;

  return (await aiComplete({ system: MESSAGE_SYSTEM, user, maxTokens: 256 })).trim();
}
