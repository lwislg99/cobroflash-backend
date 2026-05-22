/**
 * AI Quote Assistant — Sprint 9
 * Usa Claude claude-opus-4-7 con prompt caching en el system prompt.
 *
 * suggestQuoteLines: dado un texto descriptivo del trabajo y el catálogo del
 * merchant, devuelve líneas de presupuesto listas para rellenar el formulario.
 *
 * generateQuoteMessage: genera el mensaje de WhatsApp que acompañará al link
 * del presupuesto.
 */
import { anthropic } from '../../../integrations/claude';
import { prisma } from '../../../core/db/prisma';

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
- qty suele ser 1 salvo que se indique cantidad explícita`;

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

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SUGGEST_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ] as any,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('ai_no_response');

  // Extraer el JSON array del texto (robusto ante texto rodeando el JSON)
  const raw = textBlock.text.trim();
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
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 256,
    system: [
      {
        type: 'text',
        text: MESSAGE_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ] as any,
    messages: [
      {
        role: 'user',
        content: `Cliente: ${params.customerName}
Profesional: ${params.merchantName}
Trabajo: ${params.concept}
Total: ${params.total} ${params.currency}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('ai_no_response');
  return textBlock.text.trim();
}
