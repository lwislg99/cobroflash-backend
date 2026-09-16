// src/modules/jobs/domain/accesoAlTrabajo.ts — SCRUM-849
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿ES SUYO ESTE TRABAJO? La pregunta que las ESCRITURAS no se hacían.
//
// SCRUM-467 cerró la LECTURA: un técnico no abre por URL el albarán de una obra ajena. Lo que
// no se cerró fue la otra mitad. Censo por AST sobre los 221 handlers de `src/` (SCRUM-849):
// **nueve handlers de ESCRITURA no comprobaban la pertenencia que su hermano de LECTURA sí
// comprueba** — entre ellos `PATCH /admin/albaranes/:id`, `POST /:id/firmar` y
// `PATCH /admin/jobs/:id`.
//
// El agujero no era teórico: `GET /admin/albaranes/:id` devolvía 404 sobre la obra de otro, y
// `POST /admin/albaranes/:id/firmar` sobre ESE MISMO id funcionaba. Se podía firmar un albarán
// que no se podía ni abrir.
//
// ── POR QUÉ ESTA FUNCIÓN EXISTE, EN VEZ DE NUEVE `if` COPIADOS ───────────────────────────
//
// Porque nueve copias de una comprobación de acceso divergen, y la que se queda atrás no da
// error: da acceso. Aquí el criterio se escribe UNA vez y se prueba UNA vez.
//
// ⚠️ **NO se usa en `GET /admin/albaranes/:id`, y no es un descuido.** El guard de SCRUM-467
// (`tests/scrum467-tecnico-ve-lo-suyo.test.mjs`) exige por TEXTO que aquel handler contenga
// `job.operarioId === req.teamMemberId` y `job.assignedUserId === req.teamMemberId`.
// Sustituir esas líneas por una llamada a esto lo pondría en rojo **sin que la garantía
// cambiara**, y un guard en rojo se arregla cambiando el código, nunca lo que el guard exige
// (norma A7). Así que el criterio queda escrito dos veces a propósito, y esa duplicación la
// vigila `tests/scrum849-escritura-no-afloja.test.mjs` **por comportamiento** (AST), no por
// texto: si los dos sitios dejan de usar los mismos ejes, cae.
//
// ── LOS TRES EJES, Y POR QUÉ TRES ────────────────────────────────────────────────────────
//
// Son los de SCRUM-467 + SCRUM-650 (T1), los mismos que `jobIdsVisiblesPara` usa para el
// listado: quien lo creó (`operarioId`), a quien se le asignó (`assignedUserId`) y la tabla de
// asignados (`assignees`). Un técnico asignado por la tabla y no por el campo TAMBIÉN es dueño
// del trabajo: dejarlo fuera le quitaría el parte de su propia obra.

/** Lo mínimo que hace falta del Trabajo. Estructural, para que sirva con cualquier `select`. */
export interface TrabajoConDuenos {
  operarioId?: number | null;
  assignedUserId?: number | null;
  assignees?: ReadonlyArray<{ teamMemberId: number | null }> | null;
}

// 🔴 AQUI NO HAY UNA CONSTANTE `EJES_DE_PERTENENCIA`, Y SE QUITO A PROPOSITO.
//
// La hubo. Era una lista de los tres ejes, exportada para que el guard de SCRUM-849 comprobara
// que la lectura y la escritura miran los mismos. Dos cosas la tumbaron, y la segunda es la
// importante:
//
//  1. La midio el censo de SCRUM-411: no la usaba NADIE en produccion —solo su test—, asi que
//     nacia como export inalcanzable. El guard de aquel ticket se puso rojo con razon (241 medidos
//     contra 240 declarados), y la deuda se QUITA, no se declara.
//  2. Una lista al lado de la funcion no es una fuente: es una SEGUNDA. Si alguien anade un eje
//     aqui abajo y se olvida de la lista, la lista miente — y miente diciendo que todo cuadra.
//
// El guard deriva los ejes del CUERPO de `esSuyoElTrabajo` por AST: lo que la funcion lee de
// verdad. Eso no se puede quedar atras, porque ES el codigo.

/**
 * ¿Este Trabajo es de esta persona?
 *
 * 🔴 `teamMemberId` nulo o ausente devuelve **false**, que es el lado seguro: sin identidad no se
 * puede afirmar pertenencia. Y NO se compara `null === null` — dos trabajos sin operario harían
 * dueño a cualquiera que tampoco lo tenga.
 */
export function esSuyoElTrabajo(
  trabajo: TrabajoConDuenos | null | undefined,
  teamMemberId: number | null | undefined,
): boolean {
  if (!trabajo || teamMemberId == null) return false;
  if (trabajo.operarioId != null && trabajo.operarioId === teamMemberId) return true;
  if (trabajo.assignedUserId != null && trabajo.assignedUserId === teamMemberId) return true;
  return (trabajo.assignees ?? []).some((a) => a?.teamMemberId != null && a.teamMemberId === teamMemberId);
}

/** El `select` de Prisma que `esSuyoElTrabajo` necesita. Derivado, para que no se pida de menos. */
export const SELECT_DUENOS = Object.freeze({
  operarioId: true,
  assignedUserId: true,
  assignees: { select: { teamMemberId: true } },
});
