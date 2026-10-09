// src/core/db/jsonAnulable.ts — SCRUM-1188d
//
// «VACÍO» EN UNA COLUMNA `Json?`, EN EL LENGUAJE DE PRISMA, EN UN SOLO SITIO.
//
// Un `null` de JS en una columna `Json?` NO la vacía. Medido contra Postgres 16 con
// @prisma/client 6.18.0 (`docs/master/evidencias/SCRUM-1188d/`): Prisma no lo rechaza ni lo
// ignora, guarda el valor JSON `null` DENTRO de la columna, y la columna deja de ser NULL de SQL.
// Por la API de Prisma las dos cosas se leen `null`, así que no se ve hasta que alguien pregunta
// `IS NULL`. Son tres valores y solo uno vacía:
//
//   · `Prisma.DbNull`   → NULL de SQL: «no hay». ESTE.
//   · `null` de JS      → el valor JSON `null`: la columna TIENE algo.
//   · `undefined`       → «no toques el campo».
//
// Es la misma decisión que `tagsParaPrisma` (SCRUM-595) tomó para las etiquetas, sin su
// normalización: aquí solo se traduce el borde.
import { Prisma } from '@prisma/client';

/** `null` → `Prisma.DbNull` (vacía la columna); cualquier otro valor pasa tal cual. */
export function jsonAnulable<T>(valor: T | null): T | typeof Prisma.DbNull {
  return valor === null ? Prisma.DbNull : valor;
}
