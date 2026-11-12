// src/modules/jobs/domain/albaranParaElRol.ts — SCRUM-1707 (PILOTO-1)
//
// LOS PRECIOS DEL ALBARÁN QUE EL OPERARIO RECIBE POR LA API, decididos en UN sitio.
//
// FIRMADO por el fundador (SCRUM-1707 c.21547, Q2, literal): «No: se recortan — el servidor recorta
// los precios del albarán para el rol operario, igual que ya hace con el parte.»
// ALCANCE (c.21556 ②): la API de datos (JSON). El PDF (`/:id/pdf`) queda FUERA: es el documento del
// negocio y lo gobierna el interruptor del merchant (`ocultarPreciosEnDocumento`), no el rol.
//
// POR QUÉ UNA PROYECCIÓN DESPUÉS DE `serializeAlbaran` Y NO OTRO SERIALIZADOR. Es la forma de
// `trabajoParaElRol` (SCRUM-1662): el serializador sigue igual para todos y cada respuesta pasa por
// aquí antes de salir. Lo que sí se escribe CAMPO A CAMPO, como `lineasParaElTecnico` del parte, son
// las LÍNEAS: lo que sale de cada una es exactamente lo nombrado abajo, así que un precio nuevo que
// gane la línea mañana no cruza el cable sin que nadie lo decida. Lo que el objeto de fuera gane, lo
// caza el censo de claves de `tests/scrum1707-operario-sin-dinero`.
//
// El rol se pregunta POR CAPACIDAD (`seesOnlyOwnJobs`, SCRUM-147): un rol desconocido cae del lado
// restringido, que es el seguro.
import { seesOnlyOwnJobs } from '../../../core/http/roleCapabilities';

/** Lo que este fichero lee de la respuesta. Estructural: vale para el detalle, las listas y las escrituras. */
export interface AlbaranSerializado {
  lineas?: unknown;
  totales?: unknown;
  importePendienteDeFacturar?: unknown;
  /** `pendientePorLinea` (detalle del albarán y del trabajo): lleva `precioUnitario` y `tipoIva`. */
  pendientes?: unknown;
}

/** Lo que queda por facturar de una línea, para el operario: cantidades, NI UN IMPORTE. */
function pendienteDeLineaParaElOperario(p: any): {
  index: unknown; concepto: unknown; unidad: unknown; servida: unknown; facturada: unknown; pendiente: unknown;
} {
  return {
    index: p?.index,
    concepto: p?.concepto,
    unidad: p?.unidad,
    servida: p?.servida,
    facturada: p?.facturada,
    pendiente: p?.pendiente,
  };
}

/** Una línea del albarán tal y como la ve el operario: qué, cuánto y de dónde. NI UN IMPORTE. */
function lineaDeAlbaranParaElOperario(l: any): {
  concepto: unknown; cantidad: unknown; unidad: unknown; quoteLineIndex?: number;
} {
  return {
    concepto: l?.concepto,
    cantidad: l?.cantidad,
    unidad: l?.unidad,
    // No es dinero: dice de qué partida del presupuesto sale (SCRUM-367). Sólo si la hay.
    ...(typeof l?.quoteLineIndex === 'number' ? { quoteLineIndex: l.quoteLineIndex } : {}),
  };
}

/**
 * El albarán tal y como lo puede ver este rol. Para quien ve solo lo suyo (el operario): las líneas
 * y los `pendientes` sin `precioUnitario` ni `tipoIva`, `totales` a `null` y, si viaja,
 * `importePendienteDeFacturar` a `null`. Las claves se conservan —no desaparecen— para que la forma sea la misma para todos.
 * `modoValoracion` y `ocultarPreciosEnDocumento` se quedan: dicen CÓMO es el documento, no cuánto vale.
 */
export function albaranParaElRol<T extends AlbaranSerializado>(albaran: T, rol: string | null | undefined): T {
  if (!seesOnlyOwnJobs(rol)) return albaran;
  const out: any = { ...albaran };
  if ('lineas' in albaran) out.lineas = Array.isArray(albaran.lineas) ? albaran.lineas.map(lineaDeAlbaranParaElOperario) : [];
  if ('pendientes' in albaran) out.pendientes = Array.isArray(albaran.pendientes) ? albaran.pendientes.map(pendienteDeLineaParaElOperario) : [];
  if ('totales' in albaran) out.totales = null;
  if ('importePendienteDeFacturar' in albaran) out.importePendienteDeFacturar = null;
  return out;
}

/** Una fila del LISTADO (`GET /admin/albaranes`): su `total` es la suma de los precios. */
export function filaDeAlbaranParaElRol<T extends { total?: unknown }>(fila: T, rol: string | null | undefined): T {
  if (!seesOnlyOwnJobs(rol)) return fila;
  return { ...fila, total: null };
}

/** Un grupo de la bandeja «pendientes de facturar»: su `importePotencial` es la suma de los precios. */
export function grupoPendienteParaElRol<T extends { importePotencial?: unknown }>(grupo: T, rol: string | null | undefined): T {
  if (!seesOnlyOwnJobs(rol)) return grupo;
  return { ...grupo, importePotencial: null };
}
