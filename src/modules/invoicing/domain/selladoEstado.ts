/**
 * SCRUM-205 · EL SELLADO OCURRE AL EMITIR, Y EN UN SOLO SITIO.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA QUE CIERRA ESTO
 *
 * Había DOS puntos de no retorno separados en el tiempo: consumir el número (irreversible en
 * su commit) y sellar la huella, que ocurría PEREZOSAMENTE dentro de `ensureInvoicePdf`. Y uno
 * de los llamadores de `ensureInvoicePdf` es `GET /recibo/:token/pdf`, que es PÚBLICO. O sea
 * que el instante en que una factura entraba en la cadena VeriFactu lo elegía **el cliente
 * final abriendo su PDF**, no el profesional emitiendo.
 *
 * Ahora hay UN punto: la emisión. `ensureInvoicePdf` no sella; si le piden el PDF de una
 * factura sin sellar, eso es un ERROR, no una oportunidad de sellar.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE SELLA **DESPUÉS** DEL COMMIT Y NO DENTRO DE LA TRANSACCIÓN
 *
 * Porque dentro de la transacción rompe la cadena, y eso ya está resuelto y escrito:
 * `applyVeriFactu` LANZA si se le pasa un cliente de transacción
 * (`verifactu_seal_inside_transaction`). El cerrojo `pg_advisory_xact_lock` es de ámbito
 * transaccional y las lecturas dentro de la tx no ven al resto del lote, así que una
 * recapitulativa que crea varias facturas encadenaría TODAS al mismo eslabón anterior. Una
 * cadena bifurcada es justo lo que la AEAT lee como manipulación (SCRUM-173 / SCRUM-177).
 *
 * De ahí la regla: crear en la tx, **sellar después del commit, con el cliente global, una a
 * una**. La atomicidad no la da la transacción — la da el ESTADO.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Y POR ESO EL ESTADO ES DE NACIMIENTO, NO DE ERROR
 *
 * La factura nace `pendiente_de_sellado`. La ventana entre «número consumido» y «sellada»
 * deja de ser una anomalía invisible y pasa a ser un estado legítimo: si el proceso muere en
 * medio queda algo VISIBLE y reintentable, en vez de una factura fantasma indistinguible de
 * una correcta.
 *
 * Con eso, el fail-open de SCRUM-206 cae solo: si el sellado falla, la factura **se queda
 * donde nació**. No hace falta un caso especial para el fallo — hace falta no tener un camino
 * que lo ignore.
 *
 * 🚨 NUNCA se revierte un número consumido: rompería la serie correlativa, que es justo lo que
 * la numeración fiscal garantiza. Un hueco en la serie es peor que una factura pendiente.
 */
import { prisma as defaultPrisma } from '../../../core/db/prisma';
import { recordAudit } from '../../system/audit.service';
import { isReceiptNumber } from './invoiceNumber.service';
import { applyVeriFactu, applyVeriFactuAnulacion } from './verifactu.service';

export const SELLADO_PENDIENTE = 'pendiente_de_sellado';
export const SELLADO_HECHO = 'sellado';
export const SELLADO_NO_APLICA = 'no_aplica';

export type EstadoSellado =
  | typeof SELLADO_PENDIENTE
  | typeof SELLADO_HECHO
  | typeof SELLADO_NO_APLICA;

export interface MerchantFiscal {
  country?: string | null;
  taxId?: string | null;
}

/**
 * ¿Este documento entra alguna vez en la cadena VeriFactu?
 *
 * NO entran: los justificantes de cobro (`J-…`, V0-0 / regla 26 — no son facturas) ni los
 * merchants que no son de España o no tienen NIF configurado. El criterio es el MISMO que ya
 * aplicaba `ensureInvoicePdf` antes de sellar; se extrae aquí para que no vuelva a haber dos
 * copias de la condición (que es como se separan las cosas en este repo).
 */
export function entraEnLaCadena(numero: string, merchant: MerchantFiscal): boolean {
  return merchant.country === 'ES' && !!merchant.taxId && !isReceiptNumber(numero);
}

/**
 * El estado con el que NACE una factura recién creada.
 *
 * Se fija explícitamente en la emisión aunque el schema ya tenga `pendiente_de_sellado` como
 * default: el default está para que un camino OLVIDADO quede visible, no para ahorrarse
 * declarar la intención en el camino bueno.
 */
export function estadoAlNacer(numero: string, merchant: MerchantFiscal): EstadoSellado {
  return entraEnLaCadena(numero, merchant) ? SELLADO_PENDIENTE : SELLADO_NO_APLICA;
}

/**
 * ¿Puede este documento producir PDF y QR?
 *
 * NO si está pendiente de sellado. Un PDF lleva el QR de verificación de la AEAT, y una
 * factura sin huella no tiene nada que verificar: entregarlo sería poner en manos del cliente
 * un documento que aparenta ser fiscal y no lo es. `no_aplica` SÍ produce PDF — un justificante
 * es un documento legítimo, simplemente no fiscal (lleva su propio copy, regla 24/26).
 */
export function puedeProducirDocumento(estado: string): boolean {
  return estado !== SELLADO_PENDIENTE;
}

/** Mensaje único para cuando se pide un documento de una factura sin sellar. */
export const ERROR_PDF_SIN_SELLAR = 'invoice_pendiente_de_sellado';

/**
 * SELLA una factura recién emitida. **Se llama DESPUÉS del commit de la emisión**, con el
 * cliente global, una factura a la vez. Es el ÚNICO punto por el que se entra en la cadena
 * desde la emisión.
 *
 * NO LANZA, y es deliberado (SCRUM-206): si el sellado falla, la factura **se queda
 * `pendiente_de_sellado`** — que es donde nació. Eso ya es el fail-closed, porque en ese
 * estado no produce PDF ni QR y aparece en la lista de pendientes. Lanzar aquí obligaría a
 * cada llamador a decidir qué hacer con un número YA consumido, y la respuesta correcta es
 * siempre la misma: dejarlo pendiente y que se reintente. Se devuelve el resultado para que
 * el llamador pueda decirlo, no para que lo interprete.
 *
 * 🚨 Lo que NO se hace nunca: revertir el número. Un hueco en la serie correlativa es peor que
 * una factura pendiente, y la serie es justo lo que la numeración fiscal garantiza.
 */
export async function sellarTrasEmision(
  invoice: {
    id: number;
    number: string;
    total: { toString(): string };
    createdAt: Date;
    merchantId: number;
    type?: string | null;
  },
  merchant: MerchantFiscal,
  prismaClient = defaultPrisma,
): Promise<{ estado: EstadoSellado; error?: string }> {
  if (!entraEnLaCadena(invoice.number, merchant)) {
    await prismaClient.invoice.update({
      where: { id: invoice.id },
      data: { vfEstado: SELLADO_NO_APLICA },
    });
    return { estado: SELLADO_NO_APLICA };
  }

  try {
    // `applyVeriFactu` exige el cliente GLOBAL: lanza si recibe uno de transacción, porque
    // sellar dentro de una tx bifurca la cadena (SCRUM-173/177). Por eso esto vive fuera.
    await applyVeriFactu(invoice, merchant.taxId!, prismaClient);
    await prismaClient.invoice.update({
      where: { id: invoice.id },
      data: { vfEstado: SELLADO_HECHO },
    });
    return { estado: SELLADO_HECHO };
  } catch (e: any) {
    const mensaje = String(e?.message ?? e).slice(0, 300);
    // La factura se queda pendiente. Queda constancia consultable — no una línea de log en un
    // servidor, que es lo que había antes (SCRUM-206) y lo que hacía el fallo invisible.
    recordAudit({
      merchantId: invoice.merchantId,
      action: 'sellado_fallido',
      entityType: 'invoice',
      entityId: invoice.id,
      meta: {
        numero: invoice.number,
        errorMensaje: mensaje,
        puntoDeFallo: 'emision',
        // La diferencia con el mundo anterior, dicha en el propio registro:
        pdfEntregadoIgual: false,
        estadoResultante: SELLADO_PENDIENTE,
      } as any,
    });
    return { estado: SELLADO_PENDIENTE, error: mensaje };
  }
}

/**
 * ANULAR también es entrar en la cadena — y por eso pasa por aquí.
 *
 * Lo destapó el propio guard de SCRUM-205: al exigir que solo este módulo selle, apareció
 * `applyVeriFactuAnulacion` suelto en la ruta de anulación. No estaba mal colocado (es una
 * ruta autenticada y sella después del commit), pero dejarlo fuera obligaba a abrir una lista
 * de excepciones — y una lista de excepciones en la puerta del punto de no retorno fiscal es
 * justo lo que acaba creciendo.
 *
 * ⚠️ NO toca `vfEstado`, y es deliberado: ese campo describe el sellado del ALTA. Una factura
 * anulada conserva su alta y su huella (regla 29: una emitida jamás se edita ni borra, solo se
 * anula CON su registro), así que sigue siendo `sellado`. El registro de anulación es un
 * eslabón MÁS de la cadena, no un cambio de estado del anterior.
 */
export async function sellarAnulacionTrasEmision(
  invoice: Parameters<typeof applyVeriFactuAnulacion>[0],
  taxId: string,
  prismaClient = defaultPrisma,
): Promise<void> {
  await applyVeriFactuAnulacion(invoice, taxId, prismaClient);
}
