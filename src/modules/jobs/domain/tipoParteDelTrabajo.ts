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

// SCRUM-651: UNA sola fuente del vocabulario. No se copia la lista de tres valores: se DERIVA del
// Trabajo, y el compilador comprueba en los DOS sentidos que el resultado es exactamente `TipoParte`
// (si alguien añade un tipo a un lado y no al otro, esto deja de compilar).
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _mismoVocabulario: Igual<Lowercase<TipoIntervencion>, TipoParte> = true;
void _mismoVocabulario;

export function tipoParteDesdeIntervencion(bruto: unknown): TipoParte | null {
  return esTipoIntervencion(bruto) ? (bruto.toLowerCase() as Lowercase<TipoIntervencion>) : null;
}
