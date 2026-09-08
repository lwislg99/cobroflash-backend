// src/core/documentos/asignacionDeDocumento.ts — SCRUM-597 (DOC-07)
//
// UN DOCUMENTO SE ASIGNA A UNO O VARIOS USUARIOS DE LA CUENTA. Factura y presupuesto, los dos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 ASIGNAR NO ES UN PERMISO, Y ES LO PRIMERO QUE HAY QUE DECIR
//
// Asignar un documento a alguien **no cambia quién puede editarlo ni emitirlo**. Los permisos
// los sigue dando el rol, en `requireRole` y en la red de `adminOnlyRoutes.ts`, y este módulo no
// participa en ninguna de esas decisiones. Es CATEGORIZACIÓN —dice de quién es el asunto—, no
// una llave.
//
// Por eso este fichero no exporta nada que responda «¿puede?», y hay un guard que lo comprueba:
// si un día alguien lee `quote_assignees` para decidir un 403, la asignación se habrá convertido
// en permiso sin que nadie lo decida.
//
// ⚠️ Y TAMPOCO ABRE LA ECONOMÍA. Un técnico asignado a un documento sigue sin ver coste ni
// margen: eso lo decide `visibilidadEconomica.ts` por ROL, y la asignación no entra en esa
// pregunta (P-DOC-3, fundador, 7-sep-2026).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UNA SOLA FUENTE DE VERDAD, y no es un lujo: es lo que ahorra el guard de SCRUM-650
//
// El trabajo (`Job`) guarda su asignación en DOS sitios —la columna `assignedUserId` y la tabla
// `job_assignees`— porque la columna ya existía y un filtro probado leía de ella. Eso obligó a
// escribir las dos a la vez y a montar un censo de incoherencias para cazar cuándo se separan.
//
// Aquí NO hay columna heredada: `Quote` y `Invoice` nunca han tenido asignado. Así que el dato
// vive SOLO en su tabla puente y no existe la discrepancia que allí hubo que vigilar.
//
// ⚠️ `Quote.teamMemberId` NO es esto, y confundirlos es el error fácil: es AUTORÍA —quién creó el
// presupuesto— y el schema lo dice en su propio comentario («técnico que creó la cotización»).
// Un presupuesto lo redacta uno y puede estar asignado a tres. Este módulo no lo nombra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 REGLA 29 POR CONSTRUCCIÓN
//
// Asignar escribe en `quote_assignees` / `invoice_assignees` y **en ninguna otra tabla**. No toca
// `invoices`, así que asignar a una factura emitida no puede cambiar su número, ni su total, ni
// su PDF: no hay ninguna escritura que pudiera hacerlo. Se declara aquí y se ejerce en el test.

// La normalización de ids es LA MISMA regla que en los trabajos («asignar dos veces al mismo no
// es asignar dos»), así que se REUTILIZA en vez de copiarse: dos implementaciones de la misma
// regla es exactamente cómo acaban diciendo cosas distintas. El sentido del import —`core` usando
// `modules`— es el que ya existe en `core/http/authMiddleware.ts`, que importa `getSession`.
import { normalizarAsignados } from '../../modules/jobs/domain/asignacionDeTrabajo';

export { normalizarAsignados };

/** Los dos documentos del ticket. Lista CERRADA (regla 27): aquí no se inventa un tercero. */
export const DOCUMENTOS_ASIGNABLES = ['quote', 'invoice'] as const;
export type DocumentoAsignable = (typeof DOCUMENTOS_ASIGNABLES)[number];

export function esDocumentoAsignable(v: unknown): v is DocumentoAsignable {
  return typeof v === 'string' && (DOCUMENTOS_ASIGNABLES as readonly string[]).includes(v);
}

/** Lo mínimo de una tabla puente. Tipar de más ataría esto a Prisma. */
interface TablaPuente {
  deleteMany: (args: { where: Record<string, number> }) => Promise<unknown>;
  createMany: (args: { data: Array<Record<string, number>> }) => Promise<unknown>;
  findMany: (args: unknown) => Promise<Array<{ teamMember: { id: number; name: string } }>>;
}

export interface ClienteDeAsignacionDeDocumento {
  quoteAssignee: TablaPuente;
  invoiceAssignee: TablaPuente;
}

/**
 * La tabla y la columna de cada documento, declaradas UNA vez.
 *
 * Sin esto, cada función volvería a elegir entre `quoteId` e `invoiceId` con su propio `if`, y el
 * día que uno se equivoque escribiría las asignaciones de la factura en el presupuesto.
 */
const PUENTE: Record<DocumentoAsignable, { tabla: keyof ClienteDeAsignacionDeDocumento; columna: string }> = {
  quote:   { tabla: 'quoteAssignee',   columna: 'quoteId' },
  invoice: { tabla: 'invoiceAssignee', columna: 'invoiceId' },
};

/**
 * ESCRIBE la asignación de UN documento. Borra y vuelve a crear, igual que los trabajos: son tres
 * o cuatro filas, y calcular el delta añade una forma de equivocarse a cambio de nada.
 *
 * Una lista VACÍA es una orden legítima —«que no lo lleve nadie»— y deja el documento sin
 * asignar, que es exactamente como está hoy todo lo que existe.
 */
export async function escribirAsignadosDeDocumento(
  tx: ClienteDeAsignacionDeDocumento,
  documento: DocumentoAsignable,
  documentoId: number,
  ids: readonly number[],
): Promise<void> {
  const { tabla, columna } = PUENTE[documento];
  const puente = tx[tabla];
  await puente.deleteMany({ where: { [columna]: documentoId } });
  if (ids.length) {
    await puente.createMany({ data: ids.map((teamMemberId) => ({ [columna]: documentoId, teamMemberId })) });
  }
}

/** LEE los asignados de un documento, resueltos a `{id,name}` para pintarlos sin otra consulta. */
export async function leerAsignadosDeDocumento(
  cliente: ClienteDeAsignacionDeDocumento,
  documento: DocumentoAsignable,
  documentoId: number,
): Promise<Array<{ id: number; name: string }>> {
  const { tabla, columna } = PUENTE[documento];
  const filas = await cliente[tabla].findMany({
    where: { [columna]: documentoId },
    select: { teamMember: { select: { id: true, name: true } } },
  });
  return filas.map((f) => ({ id: f.teamMember.id, name: f.teamMember.name }));
}
