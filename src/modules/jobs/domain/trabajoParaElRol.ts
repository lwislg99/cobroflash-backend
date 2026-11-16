// src/modules/jobs/domain/trabajoParaElRol.ts — SCRUM-1662 (PILOTO-1)
//
// LO QUE EL OPERARIO RECIBE DE UN TRABAJO, decidido en UN sitio.
//
// FIRMADO por el fundador (SCRUM-1662 c.21555, literal): «Ocultarlas al operario — Las notas pasan a
// ser SOLO del jefe, como promete el rótulo: el operario deja de verlas y de poder editarlas, y
// tampoco van en el archivo de calendario. La tarea del operario vive en "Qué hay que hacer". Sin
// textos nuevos.» Supera la regla de SCRUM-120 (23-jul), anterior al rótulo «Solo tú las ves».
//
// POR QUÉ UNA PROYECCIÓN DESPUÉS DE `serializeJob` Y NO UN PARÁMETRO DENTRO. Las firmas y las
// llamadas a `serializeJob`/`serializeJobDetail` las fijan por TEXTO tres guards (SCRUM-58, 363, 816):
// meterles el rol las pondría en rojo sin que su garantía cambiara (regla 41). Así que el serializador
// sigue igual para todos, y cada respuesta de `jobs.routes.ts` pasa por aquí antes de salir.
//
// El rol se pregunta POR CAPACIDAD (`seesOnlyOwnJobs`, SCRUM-147): un rol desconocido cae del lado
// restringido, que es el seguro.
//
// SCRUM-1707 (PILOTO-1) · Y EL ESTADO DE COBRO. FIRMADO por el fundador (c.21547, Q1, literal):
// «Importe de SUS trabajos: ve el importe de los trabajos suyos (igual que ya ve sus presupuestos),
// pero SIN la tarjeta "Por cobrar" ni los filtros de cobro del negocio.» Alcance (c.21556 ①):
// `invoices` (lleva status 'paid') NO sale — el operario ve el IMPORTE, no su estado de cobro.
//   · SE QUEDAN: `totalAceptado`, `importeReferencia`, `quote.total` — el importe.
//   · SALEN «vacíos»: `totalCobrado`, `estadoCobro`, `remaining`, `nextStage`, `pendingStagesCount`,
//     `hasCustomPlan`, `invoices` y, en el detalle, `charge` — lo cobrado, lo pendiente y el plan
//     de cobro, que es de lo que comen la tarjeta «Por cobrar» y los filtros Pendiente/Parcial/Pagado.
//   · Los `albaranes` que viajan DENTRO del detalle pasan por `albaranParaElRol`: son la misma API
//     de datos del albarán que Q2 recorta, y dejarlos aquí sería la puerta de atrás.
// La escalera del front (`jobNextAction.js`) ya salta los niveles de dinero al técnico (SCRUM-89):
// con `invoices: []` no se le pinta ningún CTA de cobrar ni de facturar.
import { seesOnlyOwnJobs } from '../../../core/http/roleCapabilities';
import { albaranParaElRol, type AlbaranSerializado } from './albaranParaElRol';

/** Lo que este fichero lee de la respuesta. Estructural: vale para la lista, el detalle y el PATCH. */
export interface TrabajoSerializado {
  notes?: string | null;
  totalCobrado?: unknown;
  estadoCobro?: unknown;
  remaining?: unknown;
  nextStage?: unknown;
  pendingStagesCount?: unknown;
  hasCustomPlan?: unknown;
  invoices?: unknown;
  charge?: unknown;
  albaranes?: unknown;
}

/**
 * La respuesta del Trabajo tal y como la puede ver este rol. Para quien ve solo lo suyo (el operario),
 * `notes` y el estado de cobro salen con su valor «vacío» (`null`, `0`, `false`, `[]`): las claves se
 * conservan —no desaparecen— para que la forma del objeto sea la misma para todos y nadie tenga que
 * distinguir «no viaja» de «está vacía». Una clave que la respuesta no traía (la lista no lleva
 * `charge`) no se inventa.
 */
export function trabajoParaElRol<T extends TrabajoSerializado>(trabajo: T, rol: string | null | undefined): T {
  if (!seesOnlyOwnJobs(rol)) return trabajo;
  const out: any = {
    ...trabajo,
    notes: null,
    totalCobrado: null,
    estadoCobro: null,
    remaining: null,
    nextStage: null,
    pendingStagesCount: 0,
    hasCustomPlan: false,
    invoices: [],
  };
  if ('charge' in trabajo) out.charge = null;
  if (Array.isArray(trabajo.albaranes)) {
    out.albaranes = trabajo.albaranes.map((a: AlbaranSerializado) => albaranParaElRol(a, rol));
  }
  return out;
}

/**
 * El `DESCRIPTION:` del calendario (`GET /admin/jobs/:id/ics`). El jefe lleva sus notas, como hasta
 * hoy; el operario, «Qué hay que hacer» (c.21555: «tampoco van en el archivo de calendario»).
 * `null` = el evento sale sin descripción.
 */
export function descripcionDelCalendario(
  job: { notes?: string | null; queHayQueHacer?: string | null },
  rol: string | null | undefined,
): string | null {
  const texto = seesOnlyOwnJobs(rol) ? job.queHayQueHacer : job.notes;
  return texto ? texto : null;
}
