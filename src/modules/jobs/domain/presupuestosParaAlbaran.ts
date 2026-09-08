// src/modules/jobs/domain/presupuestosParaAlbaran.ts — SCRUM-606 (ALB-01)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ PRESUPUESTOS PUEDEN ESTRENAR UN ALBARÁN — Y POR QUÉ NO SON TODOS
//
// ALB-01 pide un buscador de presupuesto detrás de «Nuevo albarán». La pregunta que este módulo
// contesta es la ÚNICA que ese buscador necesita: dado un presupuesto, ¿puede salir de él un
// albarán, y si no, POR QUÉ NO?
//
// ── EL INVARIANTE, QUE NO SE INVENTA AQUÍ: ESTABA YA ESCRITO EN TRES SITIOS ──────────────────
//
// Un albarán cuelga SIEMPRE de un Trabajo — `Albaran.jobId` es `Int`, no `Int?` (medido en
// `prisma/schema.prisma`) —, así que «desde un presupuesto» significa, de hecho, «desde el
// Trabajo de ese presupuesto». Pero un Trabajo puede tener VARIOS presupuestos (SCRUM-195: los
// ADICIONALES cuelgan por `Quote.jobId`), y no todos sirven de origen. Lo que decide es esto:
//
//   🔴 `quoteLineIndex` SIGNIFICA «índice en las líneas de `Job.quoteId`», y en ningún otro sitio.
//
// No es una lectura propia: es lo que sostienen, hoy y a la vez, las TRES piezas que lo usan —
//
//   · `contarLineasDePresupuesto` (albaran.service.ts) valida el rango del índice leyendo
//     `Job.quoteId` y SOLO ése;
//   · `entregaPendiente.ts`, decisión ① del asesor, lo dice con todas las letras: «`quoteLineIndex`
//     significa hoy, de facto, índice en el presupuesto original… Es coherente por el CAMINO, no
//     por el DATO — el índice no dice de qué presupuesto es»;
//   · el pie del PDF de ALB-02 (`albaran.service.ts`, `quoteOrigen`) nombra el presupuesto
//     resolviéndolo también por `Job.quoteId`.
//
// Consecuencia directa para este ticket: si el buscador ofreciera un presupuesto ADICIONAL, el
// prellenado escribiría índices que se validan contra las líneas de OTRO presupuesto. Eso es
// exactamente el «enlace roto» que SCRUM-367 declaró peor que ningún enlace, y el mismo que
// SCRUM-684 acaba de cerrar por las dos puertas: **ninguna línea puede decir que viene de un
// presupuesto que no existe** — ni de uno que existe pero no es el suyo.
//
// Por eso la regla de elegibilidad es UNA y es comprobable:
//
//   🔴 UN PRESUPUESTO ES ELEGIBLE SI Y SOLO SI HAY UN TRABAJO CUYO `quoteId` ES ÉL.
//
// ⚠️ Y ese ancla NO SE MUEVE, que es lo que permite prellenar después sin volver a preguntar.
// Medido por AST el 5-sep-2026 sobre las 268 fuentes de `src/`: hay CINCO escrituras sobre `job`
// (`create`/`update`) y **una sola escribe `quoteId`** — el `create` de `ensureJobForQuote`
// (`job.service.ts:95`). Ningún `update` lo toca. El censo llevaba control positivo: el
// instrumento tenía que encontrar ESA escritura, y la encontró.
//
// ── LO QUE NO SE HACE, Y ES DELIBERADO ──────────────────────────────────────────────────────
//
// NO se crea un Trabajo para un presupuesto que no lo tiene. Sería una segunda puerta de creación
// de Trabajos en paralelo a `ensureJobForQuote` —el propio `jobNuevoModal.js` se niega a eso con
// las mismas palabras: «dos escritores para el mismo hecho acaban discrepando»— y además
// fabricaría Trabajos desde presupuestos que nadie ha aceptado, que es un significado nuevo para
// `accepted` sin cambio de máster (regla 27).
//
// ── Y NADA DESAPARECE SIN DECIRLO (SCRUM-271) ───────────────────────────────────────────────
//
// Los NO elegibles NO se filtran de la respuesta: viajan con `elegible: false` y su MOTIVO. Un
// presupuesto que se busca por su número y sencillamente no sale se lee como «esto está roto»;
// uno que sale y dice por qué no se puede, enseña qué falta hacer.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un presupuesto tal y como lo devuelve `listQuotesAdmin` — se toma lo que se pinta y nada más.
 * Se declara por ESTRUCTURA y no importando el tipo de aquella función: este módulo es puro y su
 * rojo tiene que poder ejercitarse con objetos escritos a mano.
 */
export interface PresupuestoCandidato {
  id: number;
  /** El número VISIBLE por merchant (`quoteNumber ?? id`), ya resuelto por quien lista. */
  number: number | string;
  customerName?: string | null;
  totalAmount?: unknown;
  currency?: string | null;
  status?: string | null;
  createdAt?: unknown;
}

/** Lo justo de un Trabajo para decidir: su id y a qué presupuesto apunta. */
export interface TrabajoConOrigen {
  id: number;
  quoteId: number | null;
}

/**
 * Por qué un presupuesto NO puede estrenar albarán. Conjunto CERRADO: cada valor tiene su texto
 * en el front y su entrada en el censo de microcopy. Añadir uno sin texto deja al profesional
 * mirando un código.
 */
export type MotivoNoElegible = 'sin_trabajo' | 'trabajo_no_visible';

export interface FilaPresupuestoParaAlbaran {
  quoteId: number;
  numero: number | string;
  cliente: string | null;
  total: unknown;
  currency: string;
  estado: string | null;
  /** El Trabajo del que colgará el albarán. `null` ⇔ `elegible: false`. */
  jobId: number | null;
  elegible: boolean;
  motivo: MotivoNoElegible | null;
}

/**
 * Cruza los presupuestos encontrados con los Trabajos que los tienen por ORIGEN.
 *
 * @param candidatos  lo que devolvió la búsqueda de presupuestos.
 * @param trabajos    Trabajos del merchant cuyo `quoteId` está entre los candidatos.
 * @param jobIdsVisibles  `null` = quien pregunta ve todos los Trabajos (admin). Un array = SOLO
 *   esos (SCRUM-467: un técnico ve los que creó y los que le asignaron). Se distingue `null` de
 *   `[]` a propósito: un array vacío significa «no ve ninguno», y colapsarlos con un `if (!lista)`
 *   convertiría a ese técnico en admin — el mismo defecto que `listQuotesAdmin` documenta para
 *   `teamMemberId`.
 */
export function filasParaElegirPresupuesto(
  candidatos: PresupuestoCandidato[],
  trabajos: TrabajoConOrigen[],
  jobIdsVisibles: number[] | null,
): FilaPresupuestoParaAlbaran[] {
  // El índice va por `quoteId`, que es el sentido que define el ancla. Un Trabajo sin `quoteId`
  // (avería abierta como trabajo directo, SCRUM-651) no indexa nada: no es origen de nadie.
  const porQuote = new Map<number, number>();
  for (const t of trabajos) {
    if (t.quoteId == null) continue;
    // Si dos Trabajos reclamaran el mismo presupuesto, se queda el PRIMERO y no se elige por
    // ninguna regla inventada: `jobs.quote_id` es `@unique`, así que este caso no existe en la
    // base. Se escribe el `has` igualmente para que, si el `@unique` cayera algún día, esto sea
    // determinista en vez de depender del orden en que llegaron las filas.
    if (!porQuote.has(t.quoteId)) porQuote.set(t.quoteId, t.id);
  }

  const visibles = jobIdsVisibles == null ? null : new Set(jobIdsVisibles);

  return candidatos.map((c) => {
    const jobId = porQuote.has(c.id) ? (porQuote.get(c.id) as number) : null;
    let motivo: MotivoNoElegible | null = null;
    let jobIdFinal: number | null = jobId;

    if (jobId == null) {
      motivo = 'sin_trabajo';
    } else if (visibles !== null && !visibles.has(jobId)) {
      // El Trabajo existe pero no es de quien pregunta. Se dice que NO SE PUEDE, y no se enseña
      // ni su id: la tenencia por fila de SCRUM-23/467 no filtra existencia, y este motivo
      // tampoco tiene por qué revelar de quién es.
      motivo = 'trabajo_no_visible';
      jobIdFinal = null;
    }

    return {
      quoteId: c.id,
      numero: c.number,
      cliente: c.customerName ?? null,
      total: c.totalAmount ?? null,
      currency: c.currency || 'EUR',
      estado: c.status ?? null,
      jobId: jobIdFinal,
      elegible: motivo === null,
      motivo,
    };
  });
}
