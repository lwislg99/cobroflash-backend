// src/modules/jobs/domain/tipoParteDelTrabajo.ts — SCRUM-1674
//
// EL TIPO DEL TRABAJO, EN LA ORTOGRAFÍA DEL PARTE.
//
// Es el MISMO vocabulario (SCRUM-651/652), pero el Trabajo lo guarda en MAYÚSCULAS
// (`TIPOS_INTERVENCION`) y el parte en minúsculas (`TIPOS_PARTE`). Tabla explícita y no
// `toLowerCase()`: el `Record` obliga al compilador a que cada valor del Trabajo tenga su par, y lo
// que llegue de fuera del vocabulario cae a `null` en vez de colarse como un cuarto tipo.
//
// ⚠️ Vive aparte y NO dentro de `parteTrabajo.ts` a propósito: ése es el sellador del parte y no
// importa nada (guard de SCRUM-652), para que el hash de un parte firmado no dependa de otro módulo.
import type { TipoParte } from './parteTrabajo';
import { esTipoIntervencion, type TipoIntervencion } from './tipoIntervencion';

const TIPO_PARTE_DE_INTERVENCION: Record<TipoIntervencion, TipoParte> = {
  REPARACION_ASISTENCIA: 'reparacion_asistencia',
  MANTENIMIENTO: 'mantenimiento',
  INSTALACION: 'instalacion',
};

export function tipoParteDesdeIntervencion(bruto: unknown): TipoParte | null {
  return esTipoIntervencion(bruto) ? TIPO_PARTE_DE_INTERVENCION[bruto] : null;
}
