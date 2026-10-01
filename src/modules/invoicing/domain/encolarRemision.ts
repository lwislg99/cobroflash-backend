/**
 * SCRUM-1296 · SIF-1 fase 2 · EMITIR ENCOLA: una factura recién sellada deja su registro de alta en
 * la cola de remisión a la AEAT (`VfSubmission`).
 *
 * GO del fundador: `docs/master/SCRUM-1296.md` §1. Lo que NO hace, y es deliberado:
 *   · NO sella ni toca la huella o el QR: se llama DESPUÉS de que el sellado terminó bien.
 *   · NO envía nada. Deja la fila `pending`; enviarla es del procesador de la cola
 *     (`sif.procesador.ts`), con sus reintentos (`decidirTrasEnvio`, SCRUM-1228b) y ninguno más.
 *   · NO LANZA. Si no se puede encolar, la factura queda sellada igual —el sellado no depende de
 *     la cola ni de la AEAT— y queda constancia consultable: `encolado_fallido` (firma del
 *     fundador, SCRUM-1296 comentario 17642).
 *   · El merchant DEMO no encola: sus facturas son datos de ejemplo (regla 8) y su NIF no es de
 *     nadie; remitirlas a la AEAT sería declarar lo que no existe. Por eso el paso de la cola en
 *     `barridoDemo` no espera borrar nada nunca.
 */
import { prisma as defaultPrisma } from '../../../core/db/prisma';
import { recordAudit } from '../../system/audit.service';
import { RegistroNoEmitibleError } from '../../fiscal/verifactu/registro.builder';
import { isDemoMerchant } from './emission.service';
import { registroParaRemision } from './verifactu.service';

const TIPO_OPERACION_ALTA = 'Alta';

// SCRUM-1333 · Primera clave del cerrojo consultivo del encolado; la segunda es el id de la
// FACTURA. Es por factura y no por comercio a propósito: sólo tienen que esperarse dos encolados
// de la misma, y así no se pone a la cola de la reserva de número (1749) ni del sellado (1748).
const ENCOLADO_LOCK_NS = 1750;

export type ResultadoEncolado =
  | { encolado: true }
  | { encolado: false; motivo: 'demo' | 'excluida' | 'error' | 'ya_encolada' };

export async function encolarAltaTrasSellado(
  invoice: { id: number; number: string; merchantId: number },
  merchant: { taxId?: string | null; email?: string | null },
  prismaClient = defaultPrisma,
): Promise<ResultadoEncolado> {
  try {
    if (isDemoMerchant({ id: invoice.merchantId, email: merchant.email ?? null })) {
      return { encolado: false, motivo: 'demo' };
    }
    const registroXml = await registroParaRemision(invoice.id, prismaClient);

    // ── SCRUM-1333 · UNA FACTURA, UN ALTA EN LA COLA ───────────────────────────────────────
    //
    // `sellarTrasEmision` llega aquí después de CADA pasada, y la cola no tiene único por factura:
    // dos entregas a la vez del mismo cobro dejaban la misma alta dos veces. La guarda de
    // `applyVeriFactu` (SCRUM-1330) le conserva la huella a la que pierde, pero no la para.
    //
    // Se pregunta A LA COLA, no «quién selló»: una pasada que selló y no pudo encolar deja la
    // huella escrita y la cola vacía, y la siguiente tiene que poder encolarla.
    //
    // Y la pregunta va DENTRO del cerrojo: fuera, dos encolados preguntan a la vez, los dos oyen
    // «no hay» y los dos escriben.
    const encolada: boolean = await (prismaClient as any).$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ENCOLADO_LOCK_NS}::int, ${invoice.id}::int)`;
      const yaEnCola = await tx.vfSubmission.count({
        where: { invoiceId: invoice.id, merchantId: invoice.merchantId, tipoOperacion: TIPO_OPERACION_ALTA }, // regla 2: scoped
      });
      if (yaEnCola > 0) return false;
      await tx.vfSubmission.create({
        data: {
          merchantId: invoice.merchantId,
          invoiceId: invoice.id,
          // El obligado es el NIF con el que se SELLÓ: si mañana cambia el del comercio, un registro
          // ya presentado no cambia de obligado (SCRUM-1127 §④).
          obligadoNif: merchant.taxId,
          tipoOperacion: TIPO_OPERACION_ALTA,
          registroXml,
        },
      });
      return true;
    });
    if (!encolada) {
      // Que no encolar no sea mudo. No es un fallo, y no se registra como `encolado_fallido`.
      console.warn(`[verifactu] invoice=${invoice.number} ya tenía su alta en la cola de remisión: no se encola otra`);
      return { encolado: false, motivo: 'ya_encolada' };
    }
    return { encolado: true };
  } catch (e: any) {
    const motivo = e instanceof RegistroNoEmitibleError ? 'excluida' : 'error';
    try {
      recordAudit({
        merchantId: invoice.merchantId,
        action: 'encolado_fallido',
        entityType: 'invoice',
        entityId: invoice.id,
        meta: {
          numero: invoice.number,
          motivo,
          errorMensaje: String(e?.message ?? e).slice(0, 300),
          tipoOperacion: TIPO_OPERACION_ALTA,
        } as any,
      });
    } catch { /* la constancia tampoco puede tumbar una emisión ya sellada */ }
    return { encolado: false, motivo };
  }
}
