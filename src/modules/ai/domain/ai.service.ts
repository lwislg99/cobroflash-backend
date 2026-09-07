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
// SCRUM-760 · la MISMA regla fiscal que ya guarda la puerta del presupuesto (SCRUM-217). Se
// importa, no se copia: ver el bloque de `sanearLineasAlbaran`.
import { invalidTipoIva } from '../../../core/validation/fiscalInput';
import { cantidadUtilizable, mapearLineasSugeridas } from './lineasSugeridas';
import {
  PROMPT_PARTE_APROBADO,
  sanearDictadoDelParte,
  type PropuestaDelDictado,
} from '../../jobs/domain/parteDictado';


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
}): Promise<{ lineas: Array<{ concept: string; qty: number; price: number; tax: number; supuestos: string[] }>; descartadas: Array<{ concept: string; motivo: string }> }> {
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

  // SCRUM-507 · El criterio vive en `./lineasSugeridas`, NO aqui: aqui hay red y `prisma`, y un
  // test no podia ejercitarlo sin copiarlo. Una copia del criterio es el mismo defecto que este
  // ticket persigue — se comprobo rompiendo el servicio a proposito y viendo la copia seguir verde.
  return mapearLineasSugeridas(parsed);
}

// ─── Suggest albarán lines (SCRUM-71 · VOZ-ALB V1) ─────────────────────────
//
// ⚠️ NO es `suggestQuoteLines` con otro nombre. Dos diferencias que son requisito, no matiz:
//
//   1. PRECIO. `Albaran.modoValoracion` es SIN_VALORAR por defecto: albaranes SIN precios, a
//      propósito (SCRUM-65). El extractor de presupuesto devuelve SIEMPRE `price`; enchufarlo
//      tal cual metería **precios inventados en documentos que por diseño no los llevan** — y
//      un albarán lo firma el cliente. En SIN_VALORAR aquí no sale precio, y no por pedírselo
//      al modelo: se le quita en código (ver `sanearLineasAlbaran`).
//   2. UNIDAD. La línea de albarán es `{concepto, cantidad, unidad, ...}` y **`unidad` no la
//      produce hoy nadie**. Es uno de los tres campos del V1.
//
// EL AUDIO NO SALE DEL MÓVIL, y conviene que siga así. El dictado es la Web Speech API del
// NAVEGADOR (`public/dashboard/js/voiceInput.js`), no una API de transcripción: no hay fichero
// de audio que guardar, no hay coste por minuto y no hay superficie RGPD nueva. Lo que hace la
// IA aquí es convertir TEXTO en líneas. Si alguna vez se propone "mejorar la transcripción con
// una API", eso cambia las tres cosas a la vez y es una decisión de otro tamaño.

/** Unidades que se aceptan. Cerrada a propósito: `unidad` acaba impresa en un documento que
 *  se firma, y texto libre del modelo ahí produce "unidades", "uds.", "Ud" y "u" en el mismo
 *  albarán. Lo que no se reconoce cae a 'ud', que es el caso mayoritario y nunca miente. */
const UNIDADES = ['ud', 'h', 'm', 'm2', 'm3', 'kg', 'l'] as const;
export type UnidadAlbaran = (typeof UNIDADES)[number];

const SINONIMOS_UNIDAD: Record<string, UnidadAlbaran> = {
  ud: 'ud', uds: 'ud', u: 'ud', unidad: 'ud', unidades: 'ud', pieza: 'ud', piezas: 'ud',
  h: 'h', hora: 'h', horas: 'h', hr: 'h', hrs: 'h',
  m: 'm', metro: 'm', metros: 'm', ml: 'm',
  m2: 'm2', 'm²': 'm2', metrocuadrado: 'm2', metroscuadrados: 'm2',
  m3: 'm3', 'm³': 'm3', metrocubico: 'm3', metroscubicos: 'm3',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  l: 'l', litro: 'l', litros: 'l', lt: 'l',
};

export function normalizarUnidad(bruto: unknown): UnidadAlbaran {
  const clave = String(bruto ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.\s]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // tildes fuera: "metros cúbicos" → "metroscubicos"
  return SINONIMOS_UNIDAD[clave] ?? 'ud';
}

export interface LineaAlbaranSugerida {
  concepto: string;
  cantidad: number;
  unidad: UnidadAlbaran;
  precioUnitario?: number;
  tipoIva?: number;
  /**
   * SCRUM-760 · POR QUÉ NO HAY TIPO, cuando el modelo sí dijo uno.
   *
   * Es el MOTIVO tal cual lo devuelve `invalidTipoIva` —que ya nombra el valor recibido—, y
   * existe para que «el modelo no dijo nada» y «el modelo dijo algo imposible» no se lean igual.
   * Sin él, las dos cosas llegan a la pantalla como una línea sin IVA y nadie puede distinguirlas.
   *
   * ⚠️ NO es microcopy: hoy no lo pinta nadie. Qué debe HACER la pantalla con un tipo rechazado
   * es decisión del fundador (regla 30) y va aparte; esto es el dato con el que decidirla.
   */
  tipoIvaRechazado?: string;
}

export type ModoValoracion = 'SIN_VALORAR' | 'VALORADO';

/**
 * Convierte lo que devuelva el modelo en líneas de albarán válidas.
 *
 * ES EL MECANISMO, NO EL PROMPT. Al modelo se le pide que no ponga precio en SIN_VALORAR,
 * pero un prompt es una PETICIÓN: si el modelo se despista, o cambia de versión, o alguien
 * edita el texto del prompt, la petición deja de cumplirse en silencio y nadie se entera hasta
 * que un albarán firmado lleva un precio que el profesional no puso. Por eso el precio se
 * ELIMINA aquí, después de la respuesta, y por eso esta función es pura y testeable sin red.
 */
export function sanearLineasAlbaran(crudo: unknown, modo: ModoValoracion): LineaAlbaranSugerida[] {
  if (!Array.isArray(crudo)) throw new Error('ai_invalid_format');

  const salida: LineaAlbaranSugerida[] = [];
  for (const l of crudo as any[]) {
    const concepto = String(l?.concepto ?? l?.concept ?? '').trim();
    if (!concepto) continue; // una línea sin concepto no es una línea

    const linea: LineaAlbaranSugerida = {
      concepto,
      cantidad: cantidadUtilizable(l?.cantidad ?? l?.qty),
      unidad: normalizarUnidad(l?.unidad ?? l?.unit),
    };

    // El corazón del requisito: en SIN_VALORAR no se copia precio NI IVA, venga como venga.
    if (modo === 'VALORADO') {
      const precio = Number(l?.precioUnitario ?? l?.price);
      if (Number.isFinite(precio)) linea.precioUnitario = Math.max(0, precio);

      // ═══════════════════════════════════════════════════════════════════════════════════
      // 🔴 SCRUM-760 · EL IVA SE RECHAZA, NO SE RECORTA.
      //
      // Aquí había `Math.min(1, Math.max(0, iva))`, y era el defecto más grave abierto: el
      // prompt pide el tipo como decimal (`0.21`), el modelo contestaba `21` queriendo decir
      // «21 %», el recorte lo dejaba en `1` y el `×100` del navegador lo pintaba **100 % DE
      // IVA**. Medido en el camino real: 170,00 € de base salían como 340,00 € de total.
      //
      // Un 100 % es PLAUSIBLE PARA LA MÁQUINA E IMPOSIBLE PARA EL NEGOCIO. No caía en ningún
      // `catch` y el guardado tampoco lo paraba (`validarLineas` admite 0-100), así que se
      // comportaba como un tipo válido hasta que alguien miraba el papel — y el albarán lo
      // firma el cliente.
      //
      // Y la ironía estaba en la cabecera de esta misma función: «ES EL MECANISMO, NO EL
      // PROMPT». Existe porque un prompt es una PETICIÓN; no se defendía de que su propia
      // petición se malinterpretara.
      //
      // ⛔ NO se amplía el recorte a `Math.min(100, …)`: aplanar sigue siendo aplanar, y
      //    convertiría un `2100` (puntos básicos) en un 100 % con la misma cara de inocente.
      // ⛔ NO se arregla en el PROMPT: el prompt ya lo pide: el defecto era no comprobarlo.
      //
      // SE DERIVA de `invalidTipoIva` (SCRUM-217) en vez de escribir una segunda validación:
      // es la MISMA regla —la lista española en puntos básicos, con sus siete tipos, incluidos
      // el 2 %, el 5 % y el 7,5 % de las ventanas temporales que una rectificativa necesita—,
      // y dos copias de una regla derivan en silencio hasta que una admite un tipo que no
      // existe o tira uno que sí. Aquí no hay lista: hay una llamada.
      //
      // Que el modelo NO diga nada no es un rechazo, es un silencio: se distinguen, porque a
      // la pantalla los dos le llegan como una línea sin IVA y sólo uno merece explicación.
      // ═══════════════════════════════════════════════════════════════════════════════════
      const bruto = l?.tipoIva ?? l?.tax;
      if (bruto !== undefined) {
        const motivo = invalidTipoIva(bruto);
        if (motivo === null) linea.tipoIva = Number(bruto);
        else linea.tipoIvaRechazado = motivo;
      }
    }

    salida.push(linea);
  }
  return salida;
}

const ALBARAN_SYSTEM_BASE = `Eres un asistente para profesionales de servicios (fontaneros, \
electricistas, reformistas, pintores, carpinteros…) de España y LATAM.

Tu tarea: analiza lo que el profesional ha dictado EN OBRA y devuelve un JSON array con las
líneas del ALBARÁN — lo que se ha hecho y lo que se ha puesto, no un presupuesto.

Reglas:
- concepto: específico y en pasado o sustantivado ("Sustitución de grifo monomando"), nunca
  genérico ("Trabajos varios").
- cantidad: la que se diga. "dos grifos" → 2. "tres horas" → 3. Si no se dice, 1.
- unidad: UNA de estas exactamente: ud, h, m, m2, m3, kg, l.
  Mano de obra y tiempo → h. Piezas y aparatos → ud. Tubería y cable → m. Superficie → m2.
- Entre 1 y 10 líneas. NUNCA añadas trabajos que no se han mencionado.

Entrada por DICTADO (el texto viene de voz, hablado en obra y a veces con ruido):
- Puede llegar sin puntuación, con muletillas (eh, mira, apúntame, si eso, o sea) y números
  en palabras. Ignora las muletillas: NUNCA las conviertas en conceptos.
- Sinónimos de obra: váter/inodoro → cisterna · calentador/termo/boiler → termo eléctrico ·
  desagüe atascado/embozado → desatasco · pérdida/gotera → fuga · mezclador → grifo monomando.`;

const ALBARAN_SYSTEM_SIN_VALORAR = `${ALBARAN_SYSTEM_BASE}

Formato — SOLO el JSON array, sin texto adicional:
[{"concepto":"string","cantidad":number,"unidad":"string"}]

Este albarán NO lleva precios. NO devuelvas precio ni IVA aunque el profesional los mencione.`;

const ALBARAN_SYSTEM_VALORADO = `${ALBARAN_SYSTEM_BASE}

Formato — SOLO el JSON array, sin texto adicional:
[{"concepto":"string","cantidad":number,"unidad":"string","precioUnitario":number,"tipoIva":number}]

- tipoIva es el IVA como decimal: 0.21 (ES/AR), 0.16 (MX), 0.19 (CO/CL), 0.18 (PE)
- precioUnitario en moneda local. Si el catálogo tiene el ítem, usa SU precio.
- Si el profesional dicta el precio ("unos 200"), usa ESE precio.`;

export async function suggestAlbaranLines(params: {
  description: string;
  merchantId: number;
  country: string;
  currency: string;
  modoValoracion: ModoValoracion;
}): Promise<LineaAlbaranSugerida[]> {
  const valorado = params.modoValoracion === 'VALORADO';

  // El catálogo solo aporta PRECIOS, así que en SIN_VALORAR no se consulta siquiera: sería
  // pagar una consulta para dar contexto que luego se tira (mismo criterio que SCRUM-138).
  const catalogText = valorado
    ? await (async () => {
        const products = await prisma.product.findMany({
          where: { merchantId: params.merchantId, isActive: true },
          select: { name: true, price: true },
          take: 40,
          orderBy: { name: 'asc' },
        });
        return products.length
          ? `\nCatálogo del profesional:\n${products.map((p) => `- ${p.name}: ${Number(p.price).toFixed(2)} ${params.currency}`).join('\n')}\n`
          : '';
      })()
    : '';

  const userContent = `País: ${params.country} | Moneda: ${params.currency}${catalogText}
Dictado del profesional:
${params.description}`;

  const propiedades: Record<string, unknown> = {
    concepto: { type: 'STRING' },
    cantidad: { type: 'NUMBER' },
    unidad: { type: 'STRING' },
  };
  const requeridas = ['concepto', 'cantidad', 'unidad'];
  if (valorado) {
    propiedades.precioUnitario = { type: 'NUMBER' };
    propiedades.tipoIva = { type: 'NUMBER' };
    requeridas.push('precioUnitario', 'tipoIva');
  }

  const raw = (
    await aiComplete({
      system: valorado ? ALBARAN_SYSTEM_VALORADO : ALBARAN_SYSTEM_SIN_VALORAR,
      user: userContent,
      maxTokens: 4096,
      jsonSchema: { type: 'ARRAY', items: { type: 'OBJECT', properties: propiedades, required: requeridas } },
    })
  ).trim();

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('ai_invalid_json');

  // El saneado manda sobre lo que diga el modelo — incluido el precio en SIN_VALORAR.
  return sanearLineasAlbaran(JSON.parse(jsonMatch[0]), params.modoValoracion);
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

// ─── Dictado del técnico → las DOS listas del parte (SCRUM-683, cableado) ──────────────────
//
// 🔴 EL SANEADO MANDA SOBRE EL MODELO, Y AQUÍ MÁS QUE EN NINGÚN SITIO. Igual que
// `suggestAlbaranLines` borra el precio en `SIN_VALORAR` pase lo que pase, esto pasa TODO por
// `sanearDictadoDelParte`, que retira cualquier cantidad que el dictado no respalde. El prompt lo
// pide; el saneador lo garantiza. La diferencia importa: un prompt es una petición.
//
// ⚠️ El `dictado` viaja DOS VECES —al modelo y al saneador— y no es un descuido: sin el texto
// original no hay contra qué contrastar las cantidades. Un saneador que solo mirase la respuesta
// estaría confiando en el prompt.
//
// ⛔ NI UN IMPORTE, en ninguna dirección: no se consulta el catálogo (que es lo único que aporta
// precios) y el esquema que se le pide al modelo no tiene campo de precio ni de IVA.
export async function suggestLineasDeParte(params: { dictado: string }): Promise<PropuestaDelDictado> {
  const raw = (
    await aiComplete({
      system: PROMPT_PARTE_APROBADO,
      user: `Dictado del técnico:\n${params.dictado}`,
      maxTokens: 2048,
      jsonSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            bloque: { type: 'STRING' },
            descripcion: { type: 'STRING' },
            // NULLABLE a propósito: es como el modelo dice «no se dijo». Un campo obligatorio le
            // obligaría a inventarse un número para poder responder.
            unds: { type: 'NUMBER', nullable: true },
          },
          required: ['descripcion'],
        },
      },
    })
  ).trim();

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  // Sin JSON reconocible se entrega al saneador tal cual: devuelve la propuesta VACÍA con su
  // motivo en vez de lanzar, que es lo que deja al técnico seguir escribiendo a mano.
  if (!jsonMatch) return sanearDictadoDelParte(null, params.dictado);

  let parsed: unknown = null;
  try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = null; }
  return sanearDictadoDelParte(parsed, params.dictado);
}
