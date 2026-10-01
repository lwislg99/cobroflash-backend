// src/modules/metrics/domain/actividadEquipo.ts — SCRUM-1341
//
// EL ENSAMBLADO DE «Actividad del equipo»: lo que el Técnico ve de sus compañeros. SIN IMPORTES.
//
// El fundador firmó dos cosas el mismo día: «el operario ve la actividad de sus compañeros»
// (SCRUM-1337) y «cobrado / gastos / beneficio → ❌ para el Técnico» (tabla S1). El panel del
// admin, `ensamblarMetricasEquipo`, reparte lo COBRADO del mes por persona: dárselo entero
// rompía la segunda. La decisión («1-B», SCRUM-1341) es actividad sí, dinero no.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ES UNA FUNCIÓN PROPIA Y NO UN RECORTE DE `ensamblarMetricasEquipo`
//
// Medido sobre aquélla (docs/evidencias/scrum1341/sonda-que-queda): el dinero sale por CINCO
// mecanismos, y sólo cuatro son campos que se puedan borrar — `members[].collected`,
// `members[].isBest` (la estrella cambia de persona con sólo cambiar lo cobrado),
// `totalCollected`, `sinAsignar.collected`/`.label`… y que `sinAsignar` EXISTA: es `null` u
// objeto según haya cobros sin presupuesto ese mes, así que la clave sola ya delata un cobro.
// Un recorte por campo se deja el quinto.
//
// Aquí no hay nada que recortar: este módulo NO RECIBE facturas. No importa
// `desgloseEmpleado`, no tiene parámetro por el que entre un importe, y su tipo de salida no
// tiene dónde ponerlo. Lo que no entra no puede salir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO DEVUELVE, Y POR QUÉ (SCRUM-1341, comentario 17825)
//
//   · `id` de los compañeros — con él, `GET /admin/quotes?teamMemberId=<id>` y
//     `GET /admin/invoices` reconstruyen lo cobrado de un compañero (SCRUM-1346).
//   · `isBest` — «Mejor del mes» se calcula por lo cobrado; dársela por aceptados sería cambiarle
//     el significado a un rótulo firmado.
//   · `inactive` — el aviso «Sin actividad esta semana» le dice a un jefe a quién perseguir: es
//     herramienta de gestión, y el Técnico no lo ve.
//   · nada de «Sin asignar» ni de totales.
//
// El recuento (enviados, aceptados, % y «esta semana») es EL MISMO que hace el panel del admin,
// y está escrito dos veces a propósito: sacarlo de `metricasEquipo.ts` a un sitio común era
// tocar la ruta del admin, que no cambia ni un byte. Que las dos copias no diverjan lo sujeta
// `tests/scrum1341-actividad-del-equipo-sin-importes.test.mjs`, que las compara persona a persona.
import { isFieldMember, OWNER_ROLE } from '../../../core/http/roleCapabilities';

export interface MiembroActividad {
  id: number;
  name: string;
  role: string;
  status: string;
}
export interface QuoteActividad {
  teamMemberId: number | null;
  status: string;
  createdAt: Date | string;
}

/** Una persona del equipo, sin `id` y sin un solo importe. */
export interface FilaActividad {
  name: string;
  role: string;
  status: string;
  sent: number;
  accepted: number;
  acceptanceRate: number;
  thisWeek: number;
}

/** Clave del propietario en el recuento: `teamMemberId` es `null` en BD. No sale en la respuesta. */
const CLAVE_PROPIETARIO = 0;

/**
 * Ensambla la respuesta. El orden es el de entrada —el propietario primero, y detrás los
 * miembros tal como los trae la consulta, que lleva su `orderBy` escrito—: no depende de nada
 * que se cuente aquí.
 */
export function ensamblarActividadEquipo(entrada: {
  members: MiembroActividad[];
  monthQuotes: QuoteActividad[];
  nombrePropietario: string;
  weekAgo: Date;
}): { hasTeam: boolean; members: FilaActividad[] } {
  const { members, monthQuotes, nombrePropietario, weekAgo } = entrada;

  type Actividad = { sent: number; accepted: number; thisWeek: number };
  const actividad = new Map<number, Actividad>();
  for (const q of monthQuotes) {
    const k = q.teamMemberId ?? CLAVE_PROPIETARIO;
    const a = actividad.get(k) ?? { sent: 0, accepted: 0, thisWeek: 0 };
    a.sent++;
    if (q.status === 'accepted') a.accepted++;
    if (new Date(q.createdAt) >= weekAgo) a.thisWeek++;
    actividad.set(k, a);
  }

  // Campo a campo, nunca `...m` ni `...a`: lo que sale es lo que está escrito aquí.
  const fila = (k: number, name: string, role: string, status: string): FilaActividad => {
    const a = actividad.get(k);
    const sent = a?.sent ?? 0;
    const accepted = a?.accepted ?? 0;
    return {
      name,
      role,
      status,
      sent,
      accepted,
      acceptanceRate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
      thisWeek: a?.thisWeek ?? 0,
    };
  };

  return {
    // SCRUM-147: por capacidad, no por igualdad de rol.
    hasTeam: members.some((m) => isFieldMember(m.role)),
    members: [
      fila(CLAVE_PROPIETARIO, nombrePropietario, OWNER_ROLE, 'active'),
      ...members.map((m) => fila(m.id, m.name, m.role, m.status)),
    ],
  };
}
