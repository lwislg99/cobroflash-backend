// src/modules/system/domain/historialDelCliente.ts — SCRUM-980
//
// EL HISTORIAL DE TRABAJO DE UN CLIENTE, para la ficha: sus trabajos (20 por página, con cursor),
// los partes y albaranes de cada uno con cuántas fotos lleva cada albarán, los partes SUELTOS del
// cliente (sin trabajo) y la próxima visita. Solo lectura. v1 SIN fotos: solo se cuentan.
//
// 🔴 `merchantId` EN CADA CONSULTA (regla 2), también en las que ya van acotadas por ids que salieron
// de una consulta acotada: si un día alguien cambia la primera, las demás siguen sin poder cruzar.
//
// 🔴 EL TÉCNICO VE SOLO LO SUYO, con los MISMOS tres ejes que `jobs.routes.ts` (SCRUM-650) y que la
// «Última visita» de SCRUM-979. Sus partes, solo los de SUS trabajos: un parte suelto no tiene autor
// en el esquema (`ParteTrabajo` no guarda quién lo hizo), así que no se le puede atribuir y no sale.
import { Prisma } from '@prisma/client';
import { prisma } from '../../../core/db/prisma';
import { tituloDeTrabajo } from '../../jobs/domain/trabajoDirecto';

const TRABAJOS_POR_PAGINA = 20;

export interface OpcionesHistorial {
  /** `undefined` = sin recorte (admin y propietario). Un número (o `null`) = ese técnico. */
  soloTrabajosDe?: number | null;
  /** Id del último trabajo de la página anterior. */
  despuesDe?: number | null;
  ahora?: Date;
}

function ejesDelTecnico(teamMemberId: number | null): Prisma.JobWhereInput[] {
  return [
    { operarioId: teamMemberId },
    { assignedUserId: teamMemberId },
    { assignees: { some: { teamMemberId: teamMemberId as number } } },
  ];
}

/** `null` si el cliente no es de este merchant (la ruta responde 404). */
export async function historialDelCliente(merchantId: number, customerId: number, op: OpcionesHistorial = {}) {
  const cliente = await prisma.customer.findFirst({ where: { id: customerId, merchantId }, select: { id: true, name: true } });
  if (!cliente) return null;

  const restringido = op.soloTrabajosDe !== undefined;
  const whereTrabajos: Prisma.JobWhereInput = { merchantId, customerId };
  if (restringido) whereTrabajos.OR = ejesDelTecnico(op.soloTrabajosDe ?? null);

  const pagina = await prisma.job.findMany({
    where: whereTrabajos,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: TRABAJOS_POR_PAGINA + 1, // uno de más para saber si hay página siguiente, sin contar
    ...(op.despuesDe ? { cursor: { id: op.despuesDe }, skip: 1 } : {}),
    select: { id: true, titulo: true, status: true, scheduledAt: true, createdAt: true, quoteId: true },
  });
  const hayMas = pagina.length > TRABAJOS_POR_PAGINA;
  const trabajos = pagina.slice(0, TRABAJOS_POR_PAGINA);
  const jobIds = trabajos.map((t) => t.id);
  const quoteIds = trabajos.map((t) => t.quoteId).filter((q): q is number => q !== null);

  const [quotes, partes, albaranes, proxima] = await Promise.all([
    quoteIds.length
      ? prisma.quote.findMany({ where: { merchantId, id: { in: quoteIds } }, select: { id: true, quoteNumber: true } })
      : Promise.resolve([]),
    // Los de SUS trabajos y —sin recorte— los sueltos del cliente (`jobId` nulo, `customerId` suyo).
    prisma.parteTrabajo.findMany({
      where: {
        merchantId,
        OR: restringido
          ? [{ jobId: { in: jobIds } }]
          : [{ jobId: { in: jobIds } }, { jobId: null, customerId }],
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      select: { id: true, jobId: true, numero: true, fecha: true, estado: true },
    }),
    // `Albaran` no lleva `customerId`: se llega por los trabajos.
    jobIds.length
      ? prisma.albaran.findMany({
          where: { merchantId, jobId: { in: jobIds } },
          orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
          select: { id: true, jobId: true, numero: true, fecha: true, estado: true },
        })
      : Promise.resolve([]),
    // La próxima visita: el trabajo `agendado` más cercano a partir de ahora, de TODOS los del cliente
    // que quien mira puede ver (no solo de esta página).
    prisma.job.findFirst({
      where: { ...whereTrabajos, status: 'agendado', scheduledAt: { gte: op.ahora ?? new Date() } },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, scheduledAt: true },
    }),
  ]);

  const fotos = albaranes.length
    ? await prisma.attachment.groupBy({
        by: ['entityId'],
        where: { merchantId, entityType: 'albaran', entityId: { in: albaranes.map((a) => a.id) } },
        _count: { _all: true },
      })
    : [];
  const fotosPorAlbaran = new Map(fotos.map((f) => [f.entityId, f._count._all]));
  const quotePorId = new Map(quotes.map((q) => [q.id, q]));

  return {
    // Ausente no es cero: sin próxima visita la clave NO viaja.
    ...(proxima?.scheduledAt ? { proximaVisita: { trabajoId: proxima.id, fecha: proxima.scheduledAt } } : {}),
    trabajos: trabajos.map((t) => ({
      id: t.id,
      titulo: tituloDeTrabajo({
        titulo: t.titulo,
        quote: t.quoteId !== null ? quotePorId.get(t.quoteId) ?? null : null,
        customer: { name: cliente.name },
        jobId: t.id,
      }),
      estado: t.status,
      scheduledAt: t.scheduledAt,
      createdAt: t.createdAt,
      partes: partes.filter((p) => p.jobId === t.id).map(({ jobId: _j, ...p }) => p),
      albaranes: albaranes.filter((a) => a.jobId === t.id)
        .map(({ jobId: _j, ...a }) => ({ ...a, fotos: fotosPorAlbaran.get(a.id) ?? 0 })),
    })),
    partesSueltos: partes.filter((p) => p.jobId === null).map(({ jobId: _j, ...p }) => p),
    ...(hayMas ? { siguiente: trabajos[trabajos.length - 1].id } : {}),
  };
}
