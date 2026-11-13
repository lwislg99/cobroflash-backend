// src/core/http/roleCapabilities.ts — SCRUM-147 (S1, nace del recon de SCRUM-137)
//
// EL ROL SE PREGUNTA POR CAPACIDAD, NO POR IGUALDAD A UN LITERAL.
//
// ── EL FALLO QUE CIERRA ────────────────────────────────────────────────────────────────────
// El filtro row-level de SCRUM-23 (el técnico solo ve SUS Trabajos) estaba escrito como
// DENYLIST: `if (req.userRole === 'tecnico') { …restringir… }`. Cualquier rol que NO fuera
// exactamente 'tecnico' se saltaba la restricción — fail-OPEN. Hoy no muerde porque solo hay
// dos roles, pero el PRIMER rol nuevo (p. ej. el "comercial" de SCRUM-137) vería TODOS los
// Trabajos del merchant en vez de los suyos: el rol pensado para tener los MISMOS permisos que
// el operario acabaría con MÁS.
//
// No es un descubrimiento: SCRUM-55 ya arregló esta clase en `consolidar-albaranes` y dejó la
// lección escrita tres líneas más arriba de las dos que se quedaron sin convertir.
//
// ── POR QUÉ LA DIRECCIÓN DEL ALLOWLIST CAMBIA SEGÚN EL USO (leer antes de "unificar") ──────
// No todas estas preguntas se blindan en el mismo sentido, y hacerlo mal es el bug:
//
//   · GATE DE SEGURIDAD (`seesAllJobs`): el lado PRIVILEGIADO es el conjunto cerrado. Se
//     permite ver todo SOLO a 'admin' → un rol desconocido cae del lado RESTRINGIDO. Fail-closed.
//
//   · MÉTRICA DE PANTALLA (`isFieldMember`): aquí el conjunto cerrado es el EXCLUIDO
//     (admin/propietario), y lo abierto es "hace trabajo de campo" → un rol desconocido SÍ
//     aparece en el recuento. Es lo correcto: si se blindara al revés, un rol nuevo quedaría
//     INVISIBLE en las métricas de equipo, que es justo la otra mitad del problema de SCRUM-137.
//
// En los dos casos lo desconocido cae al lado seguro; lo que cambia es cuál es ese lado.

/** Roles que el producto soporta HOY (S1 del máster). Añadir uno es cambio de máster (regla 27). */
export const SUPPORTED_ROLES = ['admin', 'tecnico'] as const;
export type Role = (typeof SUPPORTED_ROLES)[number];

/**
 * Pseudo-rol del PROPIETARIO en los serializers de métricas (no existe en BD: un merchant sin
 * TeamMember es el dueño). `requireAuth` lo normaliza a 'admin' para los gates de ruta.
 */
export const OWNER_ROLE = 'owner';

/** ¿Es un rol soportado? Para VALIDAR entrada, en vez de coaccionarla en silencio. */
export function isSupportedRole(value: unknown): value is Role {
  return typeof value === 'string' && (SUPPORTED_ROLES as readonly string[]).includes(value);
}

/**
 * ¿Este rol ve TODOS los Trabajos del merchant, o solo los suyos?
 *
 * ALLOWLIST a propósito: solo 'admin'. Un rol desconocido (o ausente) devuelve `false` y por
 * tanto queda RESTRINGIDO a lo suyo — que es el lado seguro. Nunca escribir esto como
 * `role !== 'tecnico'`: eso es la denylist que este módulo existe para eliminar.
 */
export function seesAllJobs(role: string | null | undefined): boolean {
  return role === 'admin';
}

/** Complemento legible de `seesAllJobs`, para que el call-site diga lo que hace. */
export function seesOnlyOwnJobs(role: string | null | undefined): boolean {
  return !seesAllJobs(role);
}

/**
 * ¿Cuenta como miembro de CAMPO en las métricas de equipo? Todo lo que no sea administración
 * (admin o propietario). Ver arriba por qué aquí el conjunto cerrado es el excluido: un rol
 * nuevo debe APARECER en las métricas, no desaparecer de ellas.
 */
export function isFieldMember(role: string | null | undefined): boolean {
  return role !== 'admin' && role !== OWNER_ROLE;
}

/**
 * SCRUM-164 · CAMPOS DE UN TRABAJO RESERVADOS AL ADMIN (gate por CAMPO, no por ruta).
 *
 * `PATCH /admin/jobs/:id` NO es admin-only y no debe serlo: status y scheduledAt son el día a día
 * del operario (SCRUM-120). Lo que está reservado al admin son tres campos que tocan FACTURACIÓN o
 * DINERO, y uno que es PRIVADO del jefe:
 *   · `tipoOperacion`   — bandera fiscal (recapitulativa mensual vs. facturar al concluir)
 *   · `assignedUserId`  — reparto del equipo (S1)
 *   · `status: 'cerrado'` — única transición IRREVERSIBLE de la FSM, y mata la vía de "Cobrar el resto"
 *   · `notes`           — «Notas internas · Solo tú las ves». SCRUM-120 (23-jul) se las daba al
 *     operario; el rótulo llegó después (SCRUM-427/917g) y la regla no se revisó. La cambia la firma
 *     del fundador de SCRUM-1662 c.21555: «el operario deja de verlas y de poder editarlas […] La
 *     tarea del operario vive en "Qué hay que hacer"». La LECTURA la recorta `trabajoParaElRol`.
 *
 * POR QUÉ VIVE AQUÍ Y NO EN LA RUTA. Estaba escrito como un `if` suelto dentro del handler: el
 * único gate de rol de todo `src/` que no pasaba por `requireRole`. Eso lo hacía **invisible por
 * partida doble** — ni aparece en la lista de rutas admin-only, ni lo ve la derivación de
 * `scrum55-admin-fail-closed` (que reconoce el marcador `__requiredRole` que pone `requireRole`,
 * y un `if` no lleva marcador). Si desapareciera en un refactor, no se enteraba nadie.
 *
 * NO se convierte en `requireRole('admin')` a propósito: eso haría admin-only la ruta ENTERA y
 * dejaría al técnico sin poder tocar el estado de sus propios trabajos, que es justo lo que
 * SCRUM-120 construyó. La regla es por campo; lo que había que arreglar es que fuera visible y
 * comprobable, no convertirla en otra cosa.
 */
export const ADMIN_ONLY_JOB_FIELDS = ['tipoOperacion', 'assignedUserId', "status:'cerrado'", 'notes'] as const;

/**
 * Devuelve el PRIMER campo reservado al admin que trae el cuerpo, o null si no hay ninguno.
 *
 * FAIL-CLOSED y de una pieza: basta que aparezca UNO —aunque venga mezclado con campos
 * legítimos— para rechazar la petición ENTERA. Nada de aplicar la parte inocente y descartar la
 * fiscal: un PATCH a medias en zona de dinero es peor que un 403.
 */
export function adminOnlyJobField(body: any): string | null {
  if (!body || typeof body !== 'object') return null;
  if (body.tipoOperacion !== undefined) return 'tipoOperacion';
  if (body.assignedUserId !== undefined) return 'assignedUserId';
  if (body.status !== undefined && String(body.status) === 'cerrado') return "status:'cerrado'";
  // SCRUM-1662 (c.21555) · el último a propósito: con un campo de dinero mezclado, el 403 sigue
  // nombrando ése, que es el que más importa ver.
  if (body.notes !== undefined) return 'notes';
  return null;
}

/**
 * SCRUM-1078 · `precios` de un PARTE, reservado al admin (gate por CAMPO, como SCRUM-164).
 * `permisoDeCampos` solo mira el estado del parte, no el rol: un técnico podía escribir importes
 * en su propio parte con `PATCH {precios:[…]}`. FAIL-CLOSED: la petición entera se rechaza.
 */
export function adminOnlyParteField(body: any): string | null {
  if (!body || typeof body !== 'object') return null;
  return body.precios !== undefined ? 'precios' : null;
}

/**
 * SCRUM-1712 · VALORAR UN ALBARÁN es del admin (gate por CAMPO, hermano de `adminOnlyParteField`).
 *
 * Lo que escribe un importe en un albarán desde el cuerpo de `POST /admin/jobs/:id/albaranes` o
 * `PATCH /admin/albaranes/:id` son tres cosas, y las tres quedan para quien `seesAllJobs`:
 *   · `modoValoracion` que NO sea quedarse en SIN_VALORAR. Pasar a VALORADO es valorar; y pasar un
 *     VALORADO a SIN_VALORAR también lo es, porque con líneas sin precio BORRA la valoración de la
 *     oficina. Por eso se mira contra `modoActual` (el del albarán; en el alta, SIN_VALORAR).
 *   · `lineas[].precioUnitario` y `lineas[].tipoIva` presentes (misma noción de «presente» que
 *     `validarLineas`: ni `undefined`, ni `null`, ni `''`; un 0 SÍ es un precio).
 *
 * Lo que NO entra, a propósito: `ocultarPreciosEnDocumento` (qué imprime el papel, no cuánto vale)
 * y `POST /:id/duplicar` (copia lo que la oficina ya puso; no recibe precios del cuerpo).
 *
 * Va POR VALOR y no por presencia porque la pantalla del técnico manda `modoValoracion:'SIN_VALORAR'`
 * en su alta y su edición de siempre: rechazar el campo por venir le cerraría el día a día.
 * FAIL-CLOSED y de una pieza, como SCRUM-164 y SCRUM-1078: un modo raro, aunque sea inválido, no lo
 * decide el técnico, y basta UN campo para rechazar la petición entera.
 *
 * Los handlers le pasan SÓLO `{ modoValoracion, lineas }` del cuerpo, no el cuerpo entero: así el
 * censo de lo que lee cada ruta (SCRUM-1185) sigue viendo sus campos.
 */
export function adminOnlyAlbaranField(body: any, modoActual: string = 'SIN_VALORAR'): string | null {
  if (!body || typeof body !== 'object') return null;
  if (body.modoValoracion !== undefined
    && (String(body.modoValoracion) !== 'SIN_VALORAR' || modoActual !== 'SIN_VALORAR')) {
    return 'modoValoracion';
  }
  if (Array.isArray(body.lineas)) {
    const presente = (v: unknown) => v !== undefined && v !== null && v !== '';
    for (const l of body.lineas) {
      if (!l || typeof l !== 'object') continue;
      if (presente((l as any).precioUnitario)) return 'precioUnitario';
      if (presente((l as any).tipoIva)) return 'tipoIva';
    }
  }
  return null;
}
