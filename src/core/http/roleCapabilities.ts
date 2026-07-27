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
 * `PATCH /admin/jobs/:id` NO es admin-only y no debe serlo: status, scheduledAt y notes son el
 * día a día del operario (SCRUM-120). Lo que está reservado al admin son tres campos que tocan
 * FACTURACIÓN o DINERO:
 *   · `tipoOperacion`   — bandera fiscal (recapitulativa mensual vs. facturar al concluir)
 *   · `assignedUserId`  — reparto del equipo (S1)
 *   · `status: 'cerrado'` — única transición IRREVERSIBLE de la FSM, y mata la vía de "Cobrar el resto"
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
export const ADMIN_ONLY_JOB_FIELDS = ['tipoOperacion', 'assignedUserId', "status:'cerrado'"] as const;

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
  return null;
}
