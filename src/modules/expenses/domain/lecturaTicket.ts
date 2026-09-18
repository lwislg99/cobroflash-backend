// src/modules/expenses/domain/lecturaTicket.ts — SCRUM-912 · leer con IA la foto del ticket de gasto
//
// ── LO QUE HACE, Y LO QUE NO HACE A PROPÓSITO ───────────────────────────────────────────────
// Lee la foto y devuelve una PROPUESTA con los mismos nombres de campo que `POST /admin/expenses`,
// para que la pantalla la pinte en el formulario. **No guarda nada**: ni la foto, ni lo leído. El
// gasto lo guarda el profesional con el alta de siempre, después de mirarlo (decisión del
// fundador en el ticket: «nada se guarda sin que él lo confirme»).
//
// ── POR QUÉ `geminiCompleteConModelo` Y NO `aiComplete` ─────────────────────────────────────
// `ai.service.aiComplete` cae a Claude cuando no hay `GEMINI_API_KEY`, y Claude es de pago. La
// condición del fundador para 912 es Gemini gratis y SIN respaldo (SCRUM-934 cerrado): si falta la
// clave, esto falla con `gemini_not_configured` y no gasta un céntimo. La inyección de `completar`
// es solo para el test; en producción es siempre `geminiCompleteConModelo`.
//
// ── LO QUE LA IA NO DECIDE ──────────────────────────────────────────────────────────────────
// · Si el papel lleva el NIF del PROFESIONAL (lo que hace deducible un ticket, ver `justificante.ts`)
//   no se le pregunta a la IA: `vatDeducible` va siempre a `null` y el veredicto sale, como mucho,
//   «falta confirmar». Lo confirma una persona.
// · Lo que no cuadra no se «arregla»: se DESCARTA y se dice en `descartados`. Un 0,21 no se
//   convierte en 21, ni un «12,10» en 12.10: el profesional lo teclea, que tiene el papel delante.
//   `null` (no se leyó) y descartado (se leyó y no vale) son dos hechos distintos.
//
// Sin frases para el usuario: solo códigos (regla 30). Los textos los firma el fundador.
import { geminiCompleteConModelo, type GeminiParams } from '../../../integrations/gemini';
import { prisma } from '../../../core/db/prisma';
import { normalizarNif, validarNifEspanol } from '../../../core/validation/nifEspanol';
import { TIPOS_IVA_ES_BP } from '../../../core/validation/fiscalInput';
import { clasificarJustificante, TOLERANCIA_CENTIMOS, aCentimos, type Clasificacion } from './justificante';

/**
 * Lecturas por merchant y día natural (Europe/Madrid). La cuota gratis de Google es UNA para todo
 * el proyecto (y por modelo): sin tope, un solo merchant podría dejar sin lectura a los demás.
 * **El número lo decide el fundador**; 5 es provisional (orquestador, 18-sep-2026, tras ver que
 * gemini-2.5-flash tiene 20 peticiones/día para TODO el proyecto).
 * Vive en memoria, como el tope de IA de `ai.routes.ts`: un despliegue lo pone a cero.
 */
export const LECTURAS_TICKET_POR_DIA = 5;

/**
 * LOS MODELOS DE LA LECTURA, PROPIOS y en orden. Google cuenta la cuota por proyecto Y POR MODELO,
 * así que leer tickets con estos NO gasta las 20 diarias de `gemini-2.5-flash`, que son de los
 * presupuestos. Por eso esa familia **no está en la lista**, ni como último recurso (decisión del
 * orquestador, 18-sep-2026).
 *
 * SOLO modelos con cupo MEDIDO y distinto de 0 en el proyecto (tabla de AI Studio del fundador,
 * 18-sep-2026, nivel gratuito; por minuto / tokens por minuto / por día), cada uno con SU cupo:
 *   gemini-3.5-flash-lite  15 / 250K / 500
 *   gemini-3.1-flash-lite  15 / 250K / 500
 *   gemini-2.5-flash-lite  10 / 250K /  20
 * Ids de API comprobados en la ficha de cada modelo de Google (estables; imagen y salida
 * estructurada, sí). Gemma 4 (14,4K/día) NO entra: 16K tokens/min pueden no bastar para una foto,
 * y queda como candidato a medir. `gemini-2-flash` y `-lite`: cupo 0.
 */
export const MODELOS_LECTURA: readonly string[] = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];

/** Los tipos que Gemini admite en línea (guía de imágenes, 17-sep-2026). */
export const MIME_ADMITIDOS: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export type ErrorImagen = 'imagen_requerida' | 'imagen_no_es_data_url' | 'imagen_tipo_no_admitido' | 'imagen_vacia';

/** `data:image/jpeg;base64,AAAA` → `{ mimeType, data }`. Sin regex sobre la cadena entera: pesa MB. */
export function parsearImagen(
  v: unknown,
): { ok: true; mimeType: string; data: string } | { ok: false; error: ErrorImagen } {
  if (typeof v !== 'string' || v === '') return { ok: false, error: 'imagen_requerida' };
  const SEP = ';base64,';
  const corte = v.indexOf(SEP);
  if (!v.startsWith('data:') || corte === -1) return { ok: false, error: 'imagen_no_es_data_url' };
  const mimeType = v.slice('data:'.length, corte).toLowerCase();
  if (!MIME_ADMITIDOS.has(mimeType)) return { ok: false, error: 'imagen_tipo_no_admitido' };
  const data = v.slice(corte + SEP.length);
  if (data === '') return { ok: false, error: 'imagen_vacia' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { ok: false, error: 'imagen_no_es_data_url' };
  return { ok: true, mimeType, data };
}

// ── LO QUE SE LE PIDE AL MODELO ─────────────────────────────────────────────────────────────

export const SISTEMA_LECTURA = `Lees la foto de un ticket o factura de COMPRA de un profesional en España.
Devuelve SOLO lo que está escrito en el papel. Si un dato no aparece o no se lee con claridad,
devuelve null: nunca lo deduzcas, lo calcules ni lo inventes.
- total: importe TOTAL pagado, IVA incluido, en euros, como número (12.10).
- base: base imponible, solo si aparece desglosada.
- tipoIva: porcentaje de IVA como número (21, 10, 4, 0). Si hay MÁS DE UN tipo de IVA, tipoIva y cuota a null.
- cuota: importe del IVA, solo si aparece desglosado.
- fecha: fecha del ticket, en formato AAAA-MM-DD.
- numeroFactura: número de factura o de ticket.
- proveedor: nombre o razón social del establecimiento que VENDE.
- nifProveedor: NIF o CIF del establecimiento que VENDE, nunca el del cliente.
- concepto: qué se ha comprado, en ocho palabras como mucho.`;

export const USUARIO_LECTURA = 'Lee este ticket.';

const ANULABLE = { nullable: true } as const;
export const ESQUEMA_LECTURA = {
  type: 'OBJECT',
  properties: {
    concepto: { type: 'STRING', ...ANULABLE },
    total: { type: 'NUMBER', ...ANULABLE },
    base: { type: 'NUMBER', ...ANULABLE },
    tipoIva: { type: 'NUMBER', ...ANULABLE },
    cuota: { type: 'NUMBER', ...ANULABLE },
    fecha: { type: 'STRING', ...ANULABLE },
    numeroFactura: { type: 'STRING', ...ANULABLE },
    proveedor: { type: 'STRING', ...ANULABLE },
    nifProveedor: { type: 'STRING', ...ANULABLE },
  },
} as const;

// ── LA PROPUESTA ────────────────────────────────────────────────────────────────────────────

/** Mismos nombres que el cuerpo de `POST /admin/expenses`, más `proveedorNombre` (solo se pinta). */
export interface PropuestaGasto {
  concept: string | null;
  amount: number | null;
  baseAmount: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  /** AAAA-MM-DD. La fecha del ticket es a la vez la del apunte y la de la factura del proveedor. */
  date: string | null;
  providerInvoiceDate: string | null;
  providerInvoiceNumber: string | null;
  proveedorNombre: string | null;
  nifProveedor: string | null;
  /** Solo si el NIF leído casa con UN proveedor de este merchant. */
  providerId: number | null;
}

export type MotivoDescarte =
  | 'no_es_numero'
  | 'fuera_de_rango'
  | 'tipo_iva_no_admitido'
  | 'no_cuadra_con_el_total'
  | 'fecha_invalida'
  | 'fecha_futura'
  | 'nif_invalido'
  | 'demasiado_largo'
  | 'no_es_texto';

export interface Descartado {
  campo: keyof PropuestaGasto;
  motivo: MotivoDescarte;
}

export interface LecturaSaneada {
  propuesta: PropuestaGasto;
  descartados: Descartado[];
}

const IMPORTE_MAXIMO = 1_000_000;

/** AAAA-MM-DD de hoy en Madrid: el «futuro» se mide en el calendario del profesional. */
export function hoyEnMadrid(ahora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(ahora);
}

/**
 * Lo que devolvió el modelo → propuesta + lo descartado. Pura: sin red ni base.
 *
 * ⚠️ FAMILIA SCRUM-271: ni un `||`. Un tipo 0 % o una cuota 0 son datos, no «no se sabe».
 */
export function sanearLectura(bruto: unknown, ahora: Date): LecturaSaneada {
  if (bruto === null || typeof bruto !== 'object' || Array.isArray(bruto)) {
    throw new Error('ai_invalid_format');
  }
  const r = bruto as Record<string, unknown>;
  const descartados: Descartado[] = [];
  const descarta = (campo: keyof PropuestaGasto, motivo: MotivoDescarte) => {
    descartados.push({ campo, motivo });
    return null;
  };

  const importe = (v: unknown, campo: keyof PropuestaGasto, minimoExclusivo: boolean): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) return descarta(campo, 'no_es_numero');
    if (v > IMPORTE_MAXIMO || v < 0 || (minimoExclusivo && v === 0)) return descarta(campo, 'fuera_de_rango');
    return Math.round(v * 100) / 100;
  };

  const texto = (v: unknown, campo: keyof PropuestaGasto, max: number): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') return descarta(campo, 'no_es_texto');
    const s = v.trim();
    if (s === '') return null;
    if (s.length > max) return descarta(campo, 'demasiado_largo');
    return s;
  };

  const amount = importe(r.total, 'amount', true);
  let baseAmount = importe(r.base, 'baseAmount', false);
  const vatAmount = importe(r.cuota, 'vatAmount', false);

  // El tipo: el MISMO conjunto que guarda la puerta del presupuesto (se importa, no se copia),
  // y además ENTERO, porque `Expense.vatRate` es `Int` y un 7,5 no cabe sin cambiar de dato.
  let vatRate: number | null = null;
  if (r.tipoIva !== null && r.tipoIva !== undefined) {
    const t = r.tipoIva;
    if (typeof t !== 'number' || !Number.isFinite(t)) descarta('vatRate', 'no_es_numero');
    else if (!Number.isInteger(t) || !TIPOS_IVA_ES_BP.has(t * 100)) descarta('vatRate', 'tipo_iva_no_admitido');
    else vatRate = t;
  }

  // Base + cuota tiene que dar el total. Si no, la base es la que sobra: el total es lo que se
  // pagó, y la cuota la juzga `clasificarJustificante` contra el tipo.
  if (amount !== null && baseAmount !== null && vatAmount !== null) {
    const diferencia = Math.abs((aCentimos(baseAmount) ?? 0) + (aCentimos(vatAmount) ?? 0) - (aCentimos(amount) ?? 0));
    if (diferencia > TOLERANCIA_CENTIMOS) baseAmount = descarta('baseAmount', 'no_cuadra_con_el_total');
  }

  let fecha: string | null = null;
  if (r.fecha !== null && r.fecha !== undefined) {
    const f = r.fecha;
    if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.trim())) descarta('date', 'fecha_invalida');
    else {
      const s = f.trim();
      const [a, m, d] = s.split('-').map(Number);
      const dt = new Date(Date.UTC(a, m - 1, d));
      const existe = dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
      if (!existe || a < 2000) descarta('date', 'fecha_invalida');
      else if (s > hoyEnMadrid(ahora)) descarta('date', 'fecha_futura');
      else fecha = s;
    }
  }

  let nifProveedor: string | null = null;
  const nifLeido = texto(r.nifProveedor, 'nifProveedor', 20);
  if (nifLeido !== null) {
    const nif = normalizarNif(nifLeido);
    // El dígito de control es lo que caza una letra mal leída en la foto: un NIF que no lo pasa
    // no se propone, porque acabaría en la ficha del proveedor (`guardarNifDelProveedor`).
    if (!validarNifEspanol(nif).valido) descarta('nifProveedor', 'nif_invalido');
    else nifProveedor = nif;
  }

  return {
    propuesta: {
      concept: texto(r.concepto, 'concept', 200),
      amount,
      baseAmount,
      vatRate,
      vatAmount,
      date: fecha,
      providerInvoiceDate: fecha,
      providerInvoiceNumber: texto(r.numeroFactura, 'providerInvoiceNumber', 60),
      proveedorNombre: texto(r.proveedor, 'proveedorNombre', 120),
      nifProveedor,
      providerId: null,
    },
    descartados,
  };
}

// ── CUANDO GOOGLE CORTA POR CUOTA ───────────────────────────────────────────────────────────

export type CorteDeCuota = 'diaria' | 'por_minuto' | 'desconocida';

/**
 * ¿El 429 de Google es de la cuota DIARIA («mañana sí») o de la POR MINUTO («en un minuto»)?
 * Se lee del `quotaId` (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, `…PerMinute…`).
 * Si vienen las dos, manda la diaria: esperar un minuto no la arregla. Si no viene ninguna, NO
 * se adivina: `desconocida`.
 */
export function corteDeCuota(quotaIds: readonly string[] | undefined): CorteDeCuota {
  const ids = quotaIds ?? [];
  if (ids.some((q) => /PerDay/.test(q))) return 'diaria';
  if (ids.some((q) => /PerMinute/.test(q))) return 'por_minuto';
  return 'desconocida';
}

export const ERROR_POR_CORTE: Readonly<Record<CorteDeCuota, string>> = {
  diaria: 'ai_cuota_diaria_agotada',
  por_minuto: 'ai_cuota_por_minuto',
  desconocida: 'ai_cuota_agotada',
};

// ── LA LECTURA ENTERA ───────────────────────────────────────────────────────────────────────

export interface ResultadoLectura extends LecturaSaneada {
  justificante: Clasificacion;
  /** Qué modelo de `MODELOS_LECTURA` contestó. Diagnóstico, no texto de pantalla. */
  modelo: string;
}

type ClienteProveedores = { provider: { findMany: (args: any) => Promise<Array<{ id: number; taxId: string | null }>> } };

export async function leerTicket(
  p: { merchantId: number; imagen: { mimeType: string; data: string }; ahora?: Date },
  deps: {
    completar?: (params: GeminiParams) => Promise<{ texto: string; modelo: string }>;
    cliente?: ClienteProveedores;
  } = {},
): Promise<ResultadoLectura> {
  const completar = deps.completar ?? geminiCompleteConModelo;
  const cliente = deps.cliente ?? prisma;

  const { texto: crudo, modelo } = await completar({
    system: SISTEMA_LECTURA,
    user: USUARIO_LECTURA,
    // Holgado: en los modelos que «piensan», el razonamiento sale de este mismo margen.
    maxTokens: 4096,
    temperature: 0,
    jsonSchema: ESQUEMA_LECTURA,
    images: [p.imagen],
    models: [...MODELOS_LECTURA],
  });

  let bruto: unknown;
  try {
    bruto = JSON.parse(crudo);
  } catch {
    throw new Error('ai_invalid_json');
  }
  const { propuesta, descartados } = sanearLectura(bruto, p.ahora ?? new Date());

  // El proveedor se propone SOLO por NIF y solo si casa con UNO: por nombre, «Leroy» y «Leroy
  // Merlin Alcobendas» serían el mismo o no según quién mire. Multi-tenant por `merchantId`.
  if (propuesta.nifProveedor !== null) {
    const fichas = await cliente.provider.findMany({
      where: { merchantId: p.merchantId, taxId: { not: null } },
      select: { id: true, taxId: true },
    });
    const casan = fichas.filter((f) => normalizarNif(f.taxId) === propuesta.nifProveedor);
    if (casan.length === 1) propuesta.providerId = casan[0].id;
  }

  const justificante = clasificarJustificante({
    amount: propuesta.amount,
    date: propuesta.date === null ? null : new Date(`${propuesta.date}T00:00:00Z`),
    nifProveedor: propuesta.nifProveedor,
    vatRate: propuesta.vatRate,
    vatAmount: propuesta.vatAmount,
    providerInvoiceNumber: propuesta.providerInvoiceNumber,
    // La IA no confirma el NIF del destinatario: como mucho, «falta confirmar».
    vatDeducible: null,
  });

  return { propuesta, descartados, justificante, modelo };
}
