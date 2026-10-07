// src/core/db/escrituraConVersion.ts — SCRUM-1285 · ESCRIBIR SOBRE LA VERSIÓN QUE SE LEYÓ.
//
// 🔴 EL DEFECTO QUE CIERRA: una ruta de edición lee la fila, valida y hace
// `update({ where: { id } })`. Si entre la lectura de la PANTALLA y la escritura otra petición ya
// cambió la fila (otra pestaña, otra persona, dos PATCH con la latencia invertida), el `update`
// REEMPLAZA a ciegas y la base vuelve a lo viejo. Medido en `PATCH /admin/quotes/:id/billing-plan`.
//
// EL PATRÓN (el mismo de SCRUM-1276, que puso la condición de estado dentro del `update`):
//   1. La pantalla manda la `version` que leyó: el `updatedAt` de la fila, tal cual lo recibió.
//   2. La condición va DENTRO del `where` del `update` — `{ id, updatedAt: version }` —, no en una
//      comprobación previa: entre «comprobar» y «escribir» cabe otra petición; dentro del `update`
//      no, porque la base decide las dos cosas en la misma sentencia.
//   3. Si no casa, Prisma lanza P2025 y la ruta contesta 409 `version_superada`, sin escribir nada.
//   4. La respuesta devuelve la `version` nueva, para que el siguiente guardado vaya sobre ella.
//
// 🔴 LA VERSIÓN SE EXIGE. Nació opcional («transición declarada», 29-sep): sin `version` la ruta
// escribía como antes, porque la pantalla aún no la mandaba. La manda desde el 1-oct (#2095), y un
// candado que se abre con no traer la llave no para a nadie: una petición sin `version` seguía
// reemplazando a ciegas. Desde el 7-oct, sin ella no se escribe.
//
// Para copiarlo en otra ruta: `leerVersion(req.body?.version)` → 400 con `v.error` si `!ok` → `updatedAt: v.version`
// LITERAL en el `where` (un spread lo vuelve OPACO para el censo 1285c) → `esVersionSuperada(err)` en el `catch` → 409 con `ERROR_VERSION_SUPERADA`.

export const ERROR_VERSION_SUPERADA = 'version_superada';
export const ERROR_VERSION_INVALIDA = 'version_invalida';
export const ERROR_VERSION_REQUERIDA = 'version_requerida';

/** Lo que manda la pantalla, leído. Un código por causa: no la mandó, o mandó basura. */
export function leerVersion(bruta: unknown):
  | { ok: true; version: Date }
  | { ok: false; error: typeof ERROR_VERSION_REQUERIDA | typeof ERROR_VERSION_INVALIDA } {
  if (bruta === undefined || bruta === null) return { ok: false, error: ERROR_VERSION_REQUERIDA };
  if (typeof bruta !== 'string' || bruta.trim() === '') return { ok: false, error: ERROR_VERSION_INVALIDA };
  const d = new Date(bruta);
  return Number.isNaN(d.getTime()) ? { ok: false, error: ERROR_VERSION_INVALIDA } : { ok: true, version: d };
}

/** ¿El `update` no encontró la fila en la versión pedida? (Prisma: «Record to update not found».) */
export function esVersionSuperada(err: unknown): boolean {
  return (err as any)?.code === 'P2025';
}
