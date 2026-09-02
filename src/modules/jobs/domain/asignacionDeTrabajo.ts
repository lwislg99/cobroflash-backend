// src/modules/jobs/domain/asignacionDeTrabajo.ts — SCRUM-650 (T1), fase B
//
// UN TRABAJO SE ASIGNA A VARIOS EMPLEADOS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CASO REAL QUE LO PIDE
//
// En el parte de trabajo EN PAPEL de la empresa de Madrid, el campo «Técnico» dice literalmente
// «Israel, Miguel y Jesús.L». **VARIOS no es el caso raro: es el normal.** El modelo de hoy
// (`Job.assignedUserId`, un escalar) solo sabe guardar uno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ HAY DOBLE ESCRITURA, Y POR QUÉ SOLO ES ACEPTABLE CON SU GUARD
//
// Durante la convivencia (paso A) el dato vive en DOS sitios: la tabla `job_assignees` —que es el
// destino y la única fuente futura— y la columna `assignedUserId`, de la que todavía LEE el filtro
// probado de SCRUM-467. Dos sitios con el mismo hecho es exactamente cómo se acaban separando.
//
// Por eso **una sola función escribe los dos**, y hay un guard que cae si discrepan. Sin ese guard
// esto sería una prohibición sin mecanismo — o sea, una costumbre; y una costumbre falla una vez
// de cada seis.
//
// ⚠️ NO TOCA `operarioId`. Ese es AUTORÍA —quién creó el presupuesto, congelada al aceptar— y no
// ejecución. Son dos ideas distintas y el schema lo declara.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UN TRABAJO SIN NADIE ES INVISIBLE PARA LOS TÉCNICOS
//
// Se puede dejar sin asignar —hoy ya se puede, y no se cambia—, pero entonces **solo lo ven los
// admin**: ningún técnico lo tiene en su listado. Se escribe aquí, donde se asigna, porque es el
// único sitio donde alguien lo va a leer antes de dejarlo vacío.

/** El principal, para la columna que todavía se lee. `null` si no hay nadie asignado. */
export function principalDe(ids: readonly number[]): number | null {
  return ids.length ? ids[0] : null;
}

/** Ids limpios, sin repetidos y en orden estable. Asignar dos veces al mismo no es asignar dos. */
export function normalizarAsignados(valor: unknown): number[] {
  const bruto = Array.isArray(valor) ? valor : (valor === null || valor === undefined ? [] : [valor]);
  const out: number[] = [];
  for (const v of bruto) {
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Lo que hay guardado de UN trabajo, mirado desde los dos sitios. */
export interface AsignacionGuardada {
  jobId: number;
  /** La columna de siempre. */
  assignedUserId: number | null;
  /** Las filas de la tabla puente. */
  asignados: number[];
}

/**
 * 🔴 EL GUARD DE LA DOBLE ESCRITURA, en forma pura.
 *
 * Devuelve la discrepancia NOMBRANDO EL TRABAJO, o `null` si los dos sitios dicen lo mismo.
 *
 * «Lo mismo» significa: la columna guarda el PRINCIPAL de la tabla. No que sean iguales —la tabla
 * puede tener tres y la columna solo cabe uno—: que la columna sea **el primero** de la tabla, y
 * que si la tabla está vacía la columna sea `null`.
 */
// NO SE EXPORTA (lo pidio el censo de SCRUM-411): su consumidor real vive DENTRO de este modulo
// —`censoDeIncoherencias` la llama— y de fuera solo entraba su test. El test mide la superficie
// publica, que es el censo: probar el ayudante interno mediria otra cosa que el contrato.
function discrepanciaDeAsignacion(a: AsignacionGuardada): string | null {
  const esperado = principalDe(a.asignados);
  if (a.assignedUserId === esperado) return null;
  return (
    `trabajo ${a.jobId}: la columna \`assignedUserId\` dice ${JSON.stringify(a.assignedUserId)} y la `
    + `tabla \`job_assignees\` dice ${JSON.stringify(esperado)} (asignados: ${JSON.stringify(a.asignados)}). `
    + 'Los dos sitios guardan el mismo hecho y se han separado: mientras el filtro lea la columna, '
    + 'un empleado asignado por la tabla NO vería su trabajo.'
  );
}

/**
 * El censo de incoherencias de una población.
 *
 * 🔴 SUELO DE CEGUERA: con una población VACÍA lanza en vez de devolver `[]`. Un «cero
 * incoherencias» sobre cero trabajos se lee igual que «todo correcto», y no es lo mismo.
 */
export function censoDeIncoherencias(poblacion: readonly AsignacionGuardada[]): string[] {
  if (!poblacion.length) {
    throw new Error(
      'censo de asignaciones VACÍO: no se ha leído ni un trabajo. Un cero aquí se lee como «todo '
      + 'coherente» y significa «no he mirado nada» — y por el mismo camino, un listado vacío se le '
      + 'lee al técnico como «no tienes trabajos» y se queda en casa.',
    );
  }
  return poblacion.map(discrepanciaDeAsignacion).filter((x): x is string => x !== null);
}

/** Lo mínimo del cliente de datos. Tipar de más ataría esto a Prisma. */
export interface ClienteDeAsignacion {
  jobAssignee: {
    deleteMany: (args: { where: { jobId: number } }) => Promise<unknown>;
    createMany: (args: { data: Array<{ jobId: number; teamMemberId: number }> }) => Promise<unknown>;
  };
}

/**
 * ESCRIBE LA TABLA PUENTE. Se llama SIEMPRE en la misma transacción que la columna: si una de las
 * dos escrituras se quedara fuera, la discrepancia que el guard prohíbe se produciría sola.
 *
 * Borra y vuelve a crear en vez de calcular el delta: la asignación de un trabajo son tres o cuatro
 * filas, y un delta añade una forma de equivocarse a cambio de nada.
 */
export async function escribirAsignados(
  tx: ClienteDeAsignacion,
  jobId: number,
  ids: readonly number[],
): Promise<void> {
  await tx.jobAssignee.deleteMany({ where: { jobId } });
  if (ids.length) {
    await tx.jobAssignee.createMany({ data: ids.map((teamMemberId) => ({ jobId, teamMemberId })) });
  }
}
