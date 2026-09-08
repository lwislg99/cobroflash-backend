// src/modules/quotes/domain/presupuestoSello.ts — SCRUM-805
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ FIRMÓ EL CLIENTE. El sello del PRESUPUESTO, y por qué es SUYO y no el del albarán.
//
// Un presupuesto firmado guardaba `signatureUrl` y `acceptedAt`, y nada más. Medido corriendo
// contra dev el 7-sep-2026: tras firmar, NINGUNA columna de la fila identifica qué documento
// estaba delante del cliente; y cambiando una línea de 85 € a 385 € después de la firma, el
// total pasa a 511,34 €, el trazo sigue ahí y **no queda nada en la fila que pueda desmentirlo**.
//
// ── 🔴 POR QUÉ NO SE LLAMA A `computeAlbaranContentHash` ─────────────────────────────────
// El encargo pedía reutilizarlo. Se midió antes de escribir nada y el fundador retiró la
// instrucción: **el canónico del albarán no sella `total`, ni `validUntil`, ni `paymentTerms`,
// ni las cláusulas** — justo lo que un cliente discute cuando dice «yo no firmé eso». Sellar con
// él daría una promesa de integridad que no cubre lo que se promete.
//
// Y hay precedente, medido y en `main`: **SCRUM-652 se encontró exactamente esto con el parte de
// trabajo** y escribió canónico propio, con el motivo escrito en `parteTrabajo.ts`:
//
//     «⛔ El canónico del albarán NO SE TOCA. Son dos documentos con dos sellos distintos,
//       y unificarlos rompería uno de los dos.»
//
// El motivo de fondo es de `JSON.stringify`: serializa las claves EN SU ORDEN DE INSERCIÓN, así
// que un canónico compartido ataría el hash de un documento al del otro. El día que alguien
// añadiera un campo al presupuesto cambiaría el hash de **albaranes ya firmados**, y no se
// rompería nada en el momento: se rompe después, cuando alguien verifique uno y le salga «no
// coincide» sobre un documento intacto. Una acusación de falsificación contra un papel que nadie
// tocó. **Una versión cerrada no se refactoriza.**
//
// Lo ÚNICO que se comparte es SHA-256, que es un algoritmo, no un canónico.
//
// ── ⛔ ESTO NO ES VERIFACTU ──────────────────────────────────────────────────────────────
// No lo es y no se rotula como tal. La huella fiscal es la de la FACTURA —encadenada, sellada y
// con QR, verificada contra el vector oficial de la AEAT— y a ésa **no se le añade nada**: un
// segundo hash al lado del oficial invita a confundirlos. Esto es lo mismo que el albarán: un
// documento NO FISCAL que el cliente firma (regla 24).
//
// ── QUÉ ENTRA EN EL SELLO, Y DE DÓNDE SALE LA LISTA ──────────────────────────────────────
// De lo que EL PAPEL ENSEÑA (`presupuestoParaPdf.ts`), no de mi criterio: lo que se firma es el
// contenido que el cliente tenía delante. Por eso entran los importes, la validez, las
// condiciones de pago, las cláusulas excluidas, los dos textos libres y la dirección de obra.
//
// 🔴 Y NO entra `internalNotes` (el cliente no la ve, así que no la firmó) ni el TEXTO de las
// cláusulas del merchant (es dato vivo suyo: editarlo rompería sellos de documentos intactos —
// el defecto que SCRUM-431 documentó en el albarán). Sí entra `clausulasExcluidas`, que es una
// decisión DE ESTE presupuesto.
import crypto from 'crypto';

/** La versión del contenido sellado que se escribe HOY. Nace en 1. */
export const PRESUPUESTO_CONTENIDO_VERSION_ACTUAL = 1;

/** Una línea del presupuesto, tal como la guarda `Quote.lines`. */
export interface PresupuestoLinea {
  description?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  taxRate?: number | string | null;
  discount?: number | string | null;
}

/**
 * Los identificativos, CONGELADOS al firmar.
 *
 * 🔴 Nace congelado y no es un adorno: el albarán llegó aquí por las malas. Su v:1 y v:2
 * recalculaban el hash desde las filas vivas, así que **corregir la razón social de un cliente
 * hacía que el verificador dijera «no coincide» sobre un documento intacto** (SCRUM-431), y hubo
 * que sacar una v:3 (SCRUM-438). El presupuesto no repite ese camino: se guarda con la evidencia
 * lo que el papel decía cuando se firmó.
 */
export interface ContenidoCongeladoPresupuesto {
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
}

export interface PresupuestoContenidoParams {
  numero: number | null;
  fecha: Date | string;
  moneda: string;
  lineas: PresupuestoLinea[];
  total: unknown;
  descuentoGlobal: unknown;
  ivaModo: string | null;
  validUntil: Date | string | null;
  paymentTerms: string | null;
  clausulasExcluidas: unknown;
  docHeaderText: string | null;
  docFooterText: string | null;
  direccionObraModo: string | null;
  direccionObra: string | null;
  contenidoCongelado: ContenidoCongeladoPresupuesto;
}

/** El sobre que se guarda en `Quote.evidenciaFirma`. */
export interface FirmaEvidenciaPresupuesto {
  v: number;
  canal: 'remoto' | 'in_situ';
  firmadoAt: string;
  ip: string | null;
  ua: string | null;
  tokenId: string | null;
  firmante: string;
  hashAlg: 'sha256';
  contentHash: string;
  contenidoCongelado: ContenidoCongeladoPresupuesto;
}

/**
 * Un importe, en texto y sin depender del tipo que traiga la fila.
 *
 * `Decimal` de Prisma, `number` y `string` tienen que producir el MISMO texto o el hash cambiaría
 * según por dónde se leyó la fila — y entonces verificar daría «no coincide» sobre un documento
 * que nadie tocó. Se normaliza a dos decimales, que es como se imprime y como se guarda
 * (`@db.Decimal(12,2)`).
 */
function importe(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

/** Una cantidad. NO se redondea a 2: `3.5` horas y `0.25` jornadas son cantidades legítimas. */
function cantidad(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function fechaISO(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

/** Las líneas, en su forma canónica. CON precios: un presupuesto se firma con sus importes delante. */
function lineasCanonicas(lineas: PresupuestoLinea[]) {
  return (Array.isArray(lineas) ? lineas : []).map((l) => ({
    concepto: l.description ?? null,
    cantidad: cantidad(l.quantity),
    precioUnitario: importe(l.unitPrice),
    tipoIva: cantidad(l.taxRate),
    descuento: importe(l.discount),
  }));
}

/**
 * El objeto canónico de cada versión, ESCRITO ENTERO Y APARTE.
 *
 * ┌─ SI HAS VENIDO A COMPARTIR ESTO CON EL ALBARÁN O EL PARTE, LEE ARRIBA ─────────────────┐
 * │ El orden de estas claves queda CONGELADO desde el primer presupuesto que se selle en   │
 * │ v:1. Un helper común ataría este orden al de otro documento. No se hace.               │
 * └───────────────────────────────────────────────────────────────────────────────────────┘
 */
function contenidoCanonico(params: PresupuestoContenidoParams, version: number): unknown {
  if (version === 1) {
    const c = params.contenidoCongelado;
    return {
      v: 1,
      numero: params.numero ?? null,
      fecha: fechaISO(params.fecha),
      moneda: params.moneda,
      cliente: c.cliente ?? null,
      emisor: c.emisor ?? null,
      emisorNif: c.emisorNif ?? null,
      lineas: lineasCanonicas(params.lineas),
      descuentoGlobal: importe(params.descuentoGlobal),
      ivaModo: params.ivaModo ?? null,
      total: importe(params.total),
      validUntil: fechaISO(params.validUntil),
      paymentTerms: params.paymentTerms ?? null,
      clausulasExcluidas: params.clausulasExcluidas ?? null,
      docHeaderText: params.docHeaderText ?? null,
      docFooterText: params.docFooterText ?? null,
      direccionObraModo: params.direccionObraModo ?? null,
      direccionObra: params.direccionObra ?? null,
    };
  }

  // Una versión que no conocemos NO se aproxima con la más parecida: se dice. Un verificador que
  // «hace lo que puede» con una versión futura devolvería «no coincide» sobre un documento
  // intacto, y eso se lee como una falsificación que no ha ocurrido.
  throw new Error(`presupuesto_contenido_version_desconocida:${version}`);
}

/**
 * SHA-256 del CONTENIDO canónico del presupuesto — NO del binario del PDF: lo que se firma es el
 * contenido, y cualquier alteración posterior cambia el hash (`docs/legal/INVESTIGACION_ALBARANES.md`
 * §1.3). Regenerar el PDF sin tocar el contenido NO lo cambia, que es la prueba de que se sella
 * el contenido y no el papel.
 *
 * `version` por defecto = la ACTUAL, que es lo correcto al SELLAR. Para VERIFICAR una evidencia
 * ya guardada NO se usa el defecto: se pasa la versión leída del dato.
 */
export function computePresupuestoContentHash(
  params: PresupuestoContenidoParams,
  version: number = PRESUPUESTO_CONTENIDO_VERSION_ACTUAL,
): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(contenidoCanonico(params, version)), 'utf8')
    .digest('hex');
}

/**
 * Construye y sella la evidencia en el momento de firmar.
 *
 * 🔴 LO QUE SE SELLA Y LO QUE SE GUARDA SALEN DEL MISMO OBJETO. Construir el bloque congelado dos
 * veces —una para el hash y otra para el sobre— es exactamente cómo se consigue que el sello
 * certifique algo distinto de lo que el sobre dice haber sellado, y no se detectaría hasta que
 * alguien verificara, meses después. Es la lección de SCRUM-438, adoptada de entrada.
 *
 * ⛔ `firmadoAt` lo pone QUIEN LLAMA con el reloj del SERVIDOR. Una marca de tiempo que pone
 * quien firma no es una marca de tiempo: es una afirmación suya.
 */
export function buildFirmaEvidenciaPresupuesto(params: {
  contenido: Omit<PresupuestoContenidoParams, 'contenidoCongelado'>;
  contenidoCongelado: ContenidoCongeladoPresupuesto;
  canal: 'remoto' | 'in_situ';
  ip: string | null;
  ua: string | null;
  tokenId: string | null;
  firmadoAt: Date;
}): FirmaEvidenciaPresupuesto {
  const contenidoCongelado = params.contenidoCongelado;
  const contentHash = computePresupuestoContentHash(
    { ...params.contenido, contenidoCongelado },
    PRESUPUESTO_CONTENIDO_VERSION_ACTUAL,
  );
  return {
    v: PRESUPUESTO_CONTENIDO_VERSION_ACTUAL,
    canal: params.canal,
    firmadoAt: params.firmadoAt.toISOString(),
    ip: params.ip || null,
    ua: params.ua ? String(params.ua).slice(0, 500) : null,
    tokenId: params.tokenId || null,
    firmante: contenidoCongelado.cliente || 'Cliente',
    hashAlg: 'sha256',
    contentHash,
    contenidoCongelado,
  };
}

/**
 * Recalcula el hash de una evidencia YA GUARDADA para VERIFICARLA. No la reescribe: recalcular y
 * volver a guardar el sello de un documento firmado es falsificarlo aunque el resultado coincida
 * (regla 29). Esto solo compara.
 *
 * La versión sale de `evidencia.v`. Un lector que diera por hecho la versión de hoy rompería en
 * silencio todas las anteriores el día que exista una v:2.
 */
export function recomputarHashDeEvidenciaPresupuesto(params: {
  evidencia: Pick<FirmaEvidenciaPresupuesto, 'v' | 'contenidoCongelado'>;
  contenido: Omit<PresupuestoContenidoParams, 'contenidoCongelado'>;
}): string {
  return computePresupuestoContentHash(
    { ...params.contenido, contenidoCongelado: params.evidencia.contenidoCongelado },
    params.evidencia.v,
  );
}

/** ¿La evidencia guardada sigue cuadrando con el contenido actual del presupuesto? Solo LEE. */
export function verificarEvidenciaPresupuesto(
  params: Parameters<typeof recomputarHashDeEvidenciaPresupuesto>[0] & {
    evidencia: Pick<FirmaEvidenciaPresupuesto, 'v' | 'contenidoCongelado' | 'contentHash'>;
  },
): boolean {
  return recomputarHashDeEvidenciaPresupuesto(params) === params.evidencia.contentHash;
}

/**
 * Los parámetros de sello A PARTIR DE LA FILA. Vive aquí y no en la ruta para que el sellador y
 * el verificador lean el contenido de UN SOLO SITIO: si mañana se añade un campo al documento,
 * los dos lados se enteran a la vez o ninguno.
 */
export function contenidoDePresupuesto(quote: {
  quoteNumber: number | null;
  createdAt: Date;
  currency: string;
  lines: unknown;
  total: unknown;
  discountGlobalAmount: unknown;
  ivaModo: string | null;
  validUntil: Date | null;
  paymentTerms: string | null;
  clausulasExcluidas: unknown;
  docHeaderText: string | null;
  docFooterText: string | null;
  shippingAddressMode: string | null;
  shippingAddress: string | null;
}): Omit<PresupuestoContenidoParams, 'contenidoCongelado'> {
  return {
    numero: quote.quoteNumber ?? null,
    fecha: quote.createdAt,
    moneda: quote.currency,
    lineas: (Array.isArray(quote.lines) ? quote.lines : []) as PresupuestoLinea[],
    total: quote.total,
    descuentoGlobal: quote.discountGlobalAmount,
    ivaModo: quote.ivaModo ?? null,
    validUntil: quote.validUntil ?? null,
    paymentTerms: quote.paymentTerms ?? null,
    clausulasExcluidas: quote.clausulasExcluidas ?? null,
    docHeaderText: quote.docHeaderText ?? null,
    docFooterText: quote.docFooterText ?? null,
    direccionObraModo: quote.shippingAddressMode ?? null,
    direccionObra: quote.shippingAddress ?? null,
  };
}
