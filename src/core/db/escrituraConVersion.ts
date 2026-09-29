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
// ⚠️ TRANSICIÓN DECLARADA: sin `version` en la petición, la ruta escribe como hasta hoy. No es un
// olvido: la pantalla aún no la manda, y exigirla rompería el guardado normal el día del despliegue.
// Cuando todas las pantallas que escriben esa fila la manden, se exige y se retira este hueco.
//
// Para copiarlo en otra ruta: `leerVersion(req.body?.version)` → 400 si `!ok` → `...condicionDeVersion(v)`
// en el `where` → `esVersionSuperada(err)` en el `catch` → 409 con `ERROR_VERSION_SUPERADA`.

export const ERROR_VERSION_SUPERADA = 'version_superada';
export const ERROR_VERSION_INVALIDA = 'version_invalida';

/** Lo que manda la pantalla, leído. `null` = no la mandó (transición); `ok:false` = mandó basura. */
export function leerVersion(bruta: unknown): { ok: true; version: Date | null } | { ok: false } {
  if (bruta === undefined || bruta === null) return { ok: true, version: null };
  if (typeof bruta !== 'string' || bruta.trim() === '') return { ok: false };
  const d = new Date(bruta);
  return Number.isNaN(d.getTime()) ? { ok: false } : { ok: true, version: d };
}

/** El trozo de `where` que ata la escritura a la versión leída (vacío si no se mandó). */
export function condicionDeVersion(v: { version: Date | null }): { updatedAt?: Date } {
  return v.version ? { updatedAt: v.version } : {};
}

/** ¿El `update` no encontró la fila en la versión pedida? (Prisma: «Record to update not found».) */
export function esVersionSuperada(err: unknown): boolean {
  return (err as any)?.code === 'P2025';
}
