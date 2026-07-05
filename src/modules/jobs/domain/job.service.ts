// src/modules/jobs/domain/job.service.ts — A13 (EXT3, JOB-1 · master Parte R)
// Trabajo MÍNIMO: feature de DINERO, no de organización. `terminado` es el
// trigger limpio del segundo tramo (V2: el resto JAMÁS se cobra solo).
// FSM (Parte L, regla 27 — estados CERRADOS):
//   pendiente_agendar → agendado(scheduledAt) → en_curso → terminado → cerrado
import { prisma } from '../../../core/db/prisma';

export const JOB_STATES = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'] as const;
export type JobState = (typeof JOB_STATES)[number];

// Transiciones permitidas (L es lineal; agendado puede re-agendarse a sí mismo
// cambiando la fecha, y volver a pendiente_agendar si se des-programa).
const TRANSITIONS: Record<JobState, JobState[]> = {
  pendiente_agendar: ['agendado'],
  agendado: ['agendado', 'pendiente_agendar', 'en_curso'],
  en_curso: ['terminado'],
  terminado: ['cerrado'],
  cerrado: [],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as JobState] || []).includes(to as JobState);
}

/**
 * Auto-creación al quote→accepted (idempotente: jobs.quote_id es UNIQUE).
 * Fire-and-forget en los call-sites: JAMÁS rompe el flujo de aceptación.
 */
export async function ensureJobForQuote(quoteId: number): Promise<void> {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, merchantId: true, customerId: true, status: true },
    });
    if (!quote || quote.status !== 'accepted') return;
    await prisma.job.upsert({
      where: { quoteId: quote.id },
      update: {}, // ya existe: no tocar su estado
      create: {
        merchantId: quote.merchantId,
        customerId: quote.customerId,
        quoteId: quote.id,
        status: 'pendiente_agendar',
      },
    });
  } catch (err: any) {
    console.error('[jobs] ensureJobForQuote omitido:', err?.message || err);
  }
}
