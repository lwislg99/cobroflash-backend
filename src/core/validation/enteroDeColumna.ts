// src/core/validation/enteroDeColumna.ts — SCRUM-1379
//
// ¿ESTE NÚMERO CABE EN UNA COLUMNA `Int`? Lo que hay que preguntar antes de mandar a la base un id
// que ha llegado de fuera (la URL, la query, el cuerpo).
//
// EL FALLO QUE CIERRA, medido en producción el 1-oct-2026: `GET /admin/partes/99999999999999999999`
// respondía 500. `Number('99999999999999999999')` es `1e20`, y `Number.isInteger(1e20)` es `true`
// (es un entero en coma flotante): pasaba la validación y reventaba al consultar.
//
// 🔴 `Number.isSafeInteger` NO es el criterio. Deja pasar hasta 2^53, y un `Int` de Postgres llega a
// 2.147.483.647: un id de 10.000.000.000 es «seguro» para JavaScript y revienta igual. El límite que
// importa es el de la COLUMNA. Todos los `id` de `prisma/schema.prisma` son `Int` (ninguno `BigInt`).
//
// Sustituye a `Number.isInteger` SIN cambiar nada más: los negativos y el 0 siguen pasando (caben en
// la columna, y la consulta responde «no existe», que es lo que esas rutas ya contestaban).

/** Límites de un `integer` de Postgres (int4), que es lo que Prisma crea para `Int`. */
export const INT_COLUMNA_MIN = -2_147_483_648;
export const INT_COLUMNA_MAX = 2_147_483_647;

export function cabeEnColumnaInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= INT_COLUMNA_MIN && n <= INT_COLUMNA_MAX;
}
