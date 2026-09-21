// src/modules/jobs/domain/albaranOrigenDelPresupuesto.ts — SCRUM-984
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿PUEDE ESTE PRESUPUESTO ESTRENAR UN ALBARÁN DESDE SU PROPIA PANTALLA? — LA MISMA RESPUESTA DEL BUSCADOR
//
// El botón «Nuevo albarán» del presupuesto aceptado necesita saber A QUÉ TRABAJO ir. Esa pregunta
// ya tiene dueña: `filasParaElegirPresupuesto` (ALB-01, SCRUM-606), que decide con UNA regla —un
// presupuesto es elegible ⇔ hay un Trabajo cuyo `quoteId` ES ÉL— y con la tenencia del técnico
// (SCRUM-467: solo aterriza en SUS Trabajos).
//
// ⚠️ NO SE USA `Quote.jobId`, y el ticket lo proponía. Un presupuesto ADICIONAL (SCRUM-195) cuelga
// del Trabajo del original por `Quote.jobId`, pero `quoteLineIndex` significa «índice en las líneas
// de `Job.quoteId`» y en ningún otro sitio: ofrecer el albarán desde el adicional prellenaría
// índices que se validan contra las líneas de OTRO presupuesto —el «enlace roto» que SCRUM-367 y
// SCRUM-684 declararon peor que ninguno—. La pantalla del presupuesto y el buscador de Albaranes
// tienen que contestar LO MISMO para el mismo presupuesto, y para eso contestan con la misma función.
//
// Solo LEE. No crea Trabajos ni albaranes: el alta sigue teniendo su única puerta
// (`openAlbCrearSheet`, SCRUM-303) y esto solo le dice a la pantalla si puede llamarla y a dónde.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { prisma } from '../../../core/db/prisma';
import { seesOnlyOwnJobs } from '../../../core/http/roleCapabilities';
import { esSuyoElTrabajo, SELECT_DUENOS } from './accesoAlTrabajo';
import { filasParaElegirPresupuesto, type MotivoNoElegible } from './presupuestosParaAlbaran';

/** Lo que viaja en el detalle del presupuesto: la fila del buscador, sin los datos del presupuesto. */
export interface AlbaranOrigen {
  elegible: boolean;
  /** El Trabajo del que colgará el albarán. `null` ⇔ `elegible: false`. */
  jobId: number | null;
  motivo: MotivoNoElegible | null;
}

export async function albaranOrigenDelPresupuesto(
  datos: {
    merchantId: number;
    quoteId: number;
    /** El número visible del presupuesto (`quoteNumber ?? id`); la función de la regla lo pide. */
    number: number | string;
    userRole?: string | null;
    teamMemberId?: number | null;
  },
  cliente: Pick<typeof prisma, 'job'> = prisma,
): Promise<AlbaranOrigen> {
  // Regla 2: la lectura filtra por merchant aunque el id del presupuesto ya venga de una lectura suya.
  const trabajos = await cliente.job.findMany({
    where: { merchantId: datos.merchantId, quoteId: datos.quoteId },
    select: { id: true, quoteId: true, ...SELECT_DUENOS },
  });

  // `null` = quien pregunta ve todos los Trabajos (admin); un array = SOLO esos. Se distinguen a
  // propósito: `[]` es «no ve ninguno», y colapsarlo con `null` convertiría a un técnico en admin
  // (el mismo cuidado que `filasParaElegirPresupuesto` documenta para su tercer argumento).
  const visibles = seesOnlyOwnJobs(datos.userRole)
    ? trabajos.filter((t) => esSuyoElTrabajo(t, datos.teamMemberId)).map((t) => t.id)
    : null;

  const [fila] = filasParaElegirPresupuesto(
    [{ id: datos.quoteId, number: datos.number }],
    trabajos.map((t) => ({ id: t.id, quoteId: t.quoteId })),
    visibles,
  );
  return { elegible: fila.elegible, jobId: fila.jobId, motivo: fila.motivo };
}
