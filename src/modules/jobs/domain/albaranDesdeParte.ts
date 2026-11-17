// src/modules/jobs/domain/albaranDesdeParte.ts — SCRUM-1740
//
// EL ALBARÁN QUE NACE DE UN TRABAJO CON PARTE FIRMADO TRAE LAS LÍNEAS DEL PARTE. Puro: sin BD.
//
// Forma decidida en SCRUM-1740 c.21982 (delegación general del fundador, SCRUM-1656 c.21978): al
// crear un albarán desde un trabajo cuyo ÚLTIMO parte está FIRMADO, el borrador nace PRE-CARGADO con
// las líneas de ese parte —concepto y cantidad, SIN precios: nace sin valorar, como hoy—. Las líneas
// son editables en el borrador (el PATCH de siempre). Sin parte firmado, todo como hoy (vacío).
// Nada se escribe en el parte; ningún esquema cambia; ningún texto nuevo.
//
// Quien lee el parte es el alta (`POST /admin/jobs/:id/albaranes`, `jobs.routes.ts`): el último por
// id, del merchant y del trabajo que la puerta por rol ya abrió. Aquí se decide qué se hace con él.
//
// 🔴 SIN PRECIOS, Y POR CONSTRUCCIÓN. La línea del albarán se ESCRIBE campo a campo (concepto,
// cantidad, unidad) y nunca se copia la del parte con un spread: el parte guarda los precios que pone
// la oficina (`precioUnitario`, `tipoIva`) y el albarán nace SIN_VALORAR, que los RECHAZA
// (`validarLineas`). Un spread los arrastraría en cuanto alguien añada un campo al parte.
//
// «ÚLTIMO PARTE» = el de id MAYOR del trabajo (el último que se creó), y precarga SÓLO si ESE está
// `firmado`. Si después de uno firmado hay otro en borrador, el último no está firmado → vacío.
// `facturado` no cuenta: la decisión dice FIRMADO, y precargar un parte ya facturado es el camino a
// cobrar dos veces lo mismo. (MI LECTURA de «último», contada a S2 al casar el contrato.)
import { validarLineas, type AlbaranLinea } from './albaran.service';

/** El tope de `validarLineas`: un albarán no lleva más. */
const MAX_LINEAS_ALBARAN = 200;

/**
 * Las líneas de un parte, traducidas a líneas de albarán SIN VALORAR.
 *
 * concepto = `descripcion` · cantidad = `unds` · unidad = '' (el parte no la tiene, y no se inventa).
 * Cada línea pasa por el MISMO validador que el alta (`validarLineas`, modo SIN_VALORAR): la que no
 * cabe en un albarán (unidades ≤ 0 o ilegibles, descripción vacía o de más de 300) se OMITE y se
 * CUENTA en `omitidas` —no rompe la precarga ni pasa en silencio—.
 */
function lineasDelParteParaAlbaran(lineasParte: unknown): { lineas: AlbaranLinea[]; omitidas: number } {
  if (!Array.isArray(lineasParte)) return { lineas: [], omitidas: 0 };
  const lineas: AlbaranLinea[] = [];
  let omitidas = 0;
  for (const l of lineasParte as any[]) {
    if (lineas.length >= MAX_LINEAS_ALBARAN) { omitidas++; continue; }
    const candidata = {
      concepto: typeof l?.descripcion === 'string' ? l.descripcion : '',
      cantidad: typeof l?.unds === 'number' ? l.unds : Number.NaN,
      unidad: '',
    };
    const v = validarLineas([candidata], 'SIN_VALORAR');
    if (v.ok) lineas.push(v.lineas[0]);
    else omitidas++;
  }
  return { lineas, omitidas };
}

/** Lo que el alta lee del último parte del trabajo (o `null` si no tiene ninguno). */
export interface UltimoParte {
  id: number;
  numero: string;
  estado: string;
  lineas: unknown;
}

export interface PrecargaDelParte {
  parteId: number;
  numero: string;
  lineas: AlbaranLinea[];
  omitidas: number;
}

/** La precarga que sale del último parte del trabajo, o `null` si ese último no está firmado (o no hay). */
export function precargaDelParte(ultimo: UltimoParte | null): PrecargaDelParte | null {
  if (!ultimo || ultimo.estado !== 'firmado') return null;
  const { lineas, omitidas } = lineasDelParteParaAlbaran(ultimo.lineas);
  return { parteId: ultimo.id, numero: ultimo.numero, lineas, omitidas };
}
