/**
 * Numeración de facturas — serie anual por merchant (Sprint SPAIN).
 *
 * Formato: `2026-CF-001` (año - prefijo del merchant - secuencia correlativa).
 * Al cambiar de año natural la secuencia vuelve a 1 (serie nueva), como exige
 * la práctica habitual del Reglamento de Facturación español (series por año).
 *
 * ÚNICO punto del backend que asigna números de factura: antes había 4 sitios
 * con 3 formatos distintos (CF000007, CF-00005 y un CF-INV aleatorio) que
 * además colisionaban entre merchants al ser `number` único global.
 */
import { Prisma } from '@prisma/client';
import { getEmissionMode } from './emission.service';
import { isFlagEnabled } from '../../../core/flags';
import { recordAuditOrThrow, sobreFiscal, type ActorAudit } from '../../system/audit.service';

/**
 * SCRUM-207 · los 7 caminos por los que puede nacer una factura (mapa de SCRUM-200 §2.1).
 * Unión CERRADA y parámetro OBLIGATORIO: un camino nuevo NO COMPILA hasta que declara cuál
 * es. Mismo criterio que el censo de SCRUM-203 — la lista y el código se atan, en vez de
 * confiar en que alguien se acuerde de rellenar un campo opcional.
 */
export type CaminoEmision =
  | 'C1' // el CLIENTE acepta el presupuesto desde WhatsApp (sin login)
  | 'C2' // el pro cobra el resto (collect-rest)
  | 'C3' // facturar un presupuesto
  | 'C4' // emisión manual (SCRUM-178)
  | 'C5' // rectificativa R1 (SCRUM-153)
  | 'C6' // un cobro pagado se convierte en factura (webhooks e interno)
  | 'C7'; // `emitInvoice()` compartido — recapitulativa y albarán parcial

/**
 * Justificantes de cobro (V0-0): los merchants ES reales con `INVOICING_ES_ENABLED`
 * off NO consumen la serie fiscal — reciben una referencia `J-YYYYMMDD-XXXX` fuera
 * de toda serie de facturación ("sin numeración de factura", Parte M).
 */
export const RECEIPT_NUMBER_PREFIX = 'J-';

export function isReceiptNumber(number: string | null | undefined): boolean {
  return typeof number === 'string' && number.startsWith(RECEIPT_NUMBER_PREFIX);
}

export function makeReceiptNumber(now = new Date()): string {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${RECEIPT_NUMBER_PREFIX}${ymd}-${rand}`;
}

/** Formatea un número de la serie. `rectifying` usa la serie propia de rectificativas (R). */
export function formatInvoiceNumber(
  prefix: string | null | undefined,
  year: number,
  seq: number,
  rectifying = false,
): string {
  const p = (prefix ?? '').trim() || 'CF';
  return `${year}-${p}${rectifying ? '-R' : ''}-${String(seq).padStart(3, '0')}`;
}

/**
 * SCRUM-33: número + etiqueta del tramo (SCRUM-27), para todo lo que el CLIENTE ve
 * (concepto del cobro, plantilla WhatsApp) — nunca cambia la numeración fiscal en sí,
 * solo el texto de display. null en presets (sin plan personalizado) → se omite,
 * mismo patrón condicional que ya usa el PDF (nunca un placeholder inventado).
 * Deliberadamente NO se añade una variable nueva a la plantilla de WhatsApp
 * (Meta no acepta variables vacías, y los presets no tienen etiqueta): el label
 * viaja DENTRO del valor de la variable "número de documento" que ya existe.
 */
export function appendStageLabel(number: string, stageLabel?: string | null): string {
  return stageLabel ? `${number} — ${stageLabel}` : number;
}

/** Secuencia que toca emitir: si la serie guardada no es la del año en curso, empieza serie nueva en 1. */
export function resolveSeriesSeq(
  m: { invoiceSeriesYear: number | null; nextInvoiceNumber: number },
  year: number,
): number {
  return m.invoiceSeriesYear === year ? m.nextInvoiceNumber : 1;
}

/**
 * Reserva el siguiente número de la serie anual del merchant y avanza el contador.
 * DEBE llamarse dentro de la misma transacción que crea la factura, para que
 * un fallo en el create no deje huecos en la serie.
 *
 * `rectifying: true` usa la serie separada de rectificativas (2026-CF-R-001),
 * obligatoria legalmente. Ambas series comparten `invoiceSeriesYear`: al cambiar
 * de año se resetean LOS DOS contadores.
 *
 * ── SCRUM-207 · AQUÍ SE ESCRIBE `factura_emitida`, Y NO ES UN DETALLE DE SITIO ────────
 * Este es el **punto de no retorno A** (SCRUM-200 §5): cuando esta función vuelve, el
 * número está consumido y la serie ha avanzado, dentro de la misma transacción que crea
 * la factura. El registro se escribe **con el mismo `tx`**, así que:
 *
 *   · si el registro falla → la transacción se deshace → NO hay número consumido, NO hay
 *     factura, NO hay hueco en la serie. «Factura sin su registro» pasa de ser algo que
 *     hay que recordar a algo que **no puede ocurrir**;
 *   · y como los 7 caminos pasan por este embudo SIN EXCEPCIÓN (medido y vigilado por el
 *     guard de SCRUM-203), cubrir este punto los cubre los 7 — sin 7 call-sites que
 *     alguien pueda olvidar en el octavo.
 *
 * Se audita **también el justificante**: un `J-…` no entra en la cadena de huellas, pero
 * es un documento con referencia que se le manda a un cliente. `esJustificante` lo
 * distingue en el registro.
 *
 * ⚠️ `entityId` va a `null` a propósito: la factura AÚN NO EXISTE cuando se reserva su
 * número. El identificador que se congela es `meta.numero`, que además es la identidad
 * FISCAL del documento (el `id` de la BD no lo es). La consulta de inspección resuelve por
 * los dos — ver `auditoriaFiscal.query.ts`.
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  merchantId: number,
  opts: {
    /** OBLIGATORIO desde SCRUM-207: cuál de los 7 caminos está emitiendo. */
    camino: CaminoEmision;
    /** OBLIGATORIO: quién actúa. En C1 NO es el propietario, es el cliente final. */
    actor: ActorAudit;
    rectifying?: boolean;
  },
  now = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const m = await tx.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      email: true,
      country: true,
      // SCRUM-81: `flags` es OBLIGATORIO para que getEmissionMode aquí resuelva el modo con la
      // MISMA información que el gate del endpoint (Parte P: override de INVOICING_ES_ENABLED por
      // merchant, precedencia merchant > país > env > default). Sin él, un merchant con el override
      // ON habría emitido un J- de justificante mientras el gate lo trataba como fiscal → factura
      // fiscal con numeración de justificante, fuera de serie. Para merchants sin override (todos
      // hoy, flags null) el comportamiento es IDÉNTICO al previo.
      flags: true,
      invoiceSeriesPrefix: true,
      nextInvoiceNumber: true,
      nextRectInvoiceNumber: true,
      invoiceSeriesYear: true,
    },
  });
  if (!m) throw new Error('merchant_not_found');

  const rect = !!opts.rectifying;

  // SCRUM-207: el modo fiscal del MOMENTO, congelado en el registro. Se calcula con la
  // misma `m` que ya está leída — ni una consulta de más.
  const flagsFiscales = {
    INVOICING_ES_ENABLED: isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m }),
    SIF_ENABLED: isFlagEnabled('SIF_ENABLED', { merchant: m }),
  };

  /** Escribe `factura_emitida` DENTRO de `tx`. Si falla, sube y la transacción se deshace. */
  const auditar = (numero: string, esJustificante: boolean) =>
    recordAuditOrThrow(
      {
        merchantId,
        teamMemberId: opts.actor.teamMemberId ?? null,
        action: 'factura_emitida',
        entityType: 'invoice',
        entityId: null, // la factura aún no existe — la identidad es `meta.numero`
        meta: sobreFiscal({
          actor: opts.actor,
          flagsFiscales,
          payload: {
            numero,
            esJustificante,
            camino: opts.camino,
            // F1 / R1 es lo que este embudo sabe. El tipo REAL lo fija quien crea la fila
            // (`Invoice.type`); aquí se registra la intención con la que se pidió el número.
            tipoFactura: esJustificante ? 'JUST' : rect ? 'R1' : 'F1',
          },
        }),
      },
      tx,
    );

  // V0-0: merchant ES real sin INVOICING_ES_ENABLED → justificante, no factura.
  // No avanza NINGÚN contador de la serie fiscal. Las rectificativas no existen
  // para justificantes (solo rectifican facturas emitidas — regla 29).
  if (getEmissionMode(m) === 'receipt') {
    if (rect) throw new Error('invoicing_es_disabled');
    const numero = makeReceiptNumber(now);
    await auditar(numero, true);
    return numero;
  }
  const sameYear = m.invoiceSeriesYear === year;
  const seq = rect
    ? (sameYear ? m.nextRectInvoiceNumber : 1)
    : resolveSeriesSeq(m, year);

  await tx.merchant.update({
    where: { id: merchantId },
    data: {
      invoiceSeriesYear: year,
      ...(rect
        ? { nextRectInvoiceNumber: seq + 1, ...(sameYear ? {} : { nextInvoiceNumber: 1 }) }
        : { nextInvoiceNumber: seq + 1, ...(sameYear ? {} : { nextRectInvoiceNumber: 1 }) }),
    },
  });
  const numero = formatInvoiceNumber(m.invoiceSeriesPrefix, year, seq, rect);
  await auditar(numero, false);
  return numero;
}
