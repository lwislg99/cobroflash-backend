// src/modules/jobs/domain/parteRango.ts — SCRUM-1488
//
// EL RANGO DE «DESPLAZAMIENTO» Y «KILÓMETROS» DEL PARTE, DECIDIDO UNA VEZ.
//
// 🔴 EL FALLO QUE CIERRA: la ruta guardaba `-1` desplazamientos y `-5` kilómetros con un 200. El
// parte es un documento que el cliente FIRMA: eso era lo que firmaba. La casilla del panel puede
// poner su `min`, pero un `min` se salta con cualquier petición: es cortesía, no protección. La
// regla vive aquí, y toda puerta que escriba uno de los dos campos pasa por aquí
// (`tests/scrum1488-rango-del-parte.test.mjs` cae si una los escribe por otro camino).
//
// EL RANGO: los dos, `>= 0`. El cero vale (un parte sin desplazamiento es un parte normal). Por
// arriba no hay más tope que el de la columna. Desplazamiento, además, es un ENTERO: cuenta viajes.
//
// 🔴 UN CÓDIGO POR CAUSA. La pantalla decide su texto por el CÓDIGO (SCRUM-1491 pinta el suyo con
// `desplazamientos_invalido`, que quiere decir «no es un número entero» y nada más). Meter otra
// causa en un código que ya tiene texto vuelve falso ese texto sin tocar su fichero.
//
// Los `message` son para quien llama a la ruta a mano: el panel no los pinta (medido por S4,
// SCRUM-1490 comentario 18536).
import { INT_COLUMNA_MAX } from '../../../core/validation/enteroDeColumna';

/** Lo más que cabe en `kilometros Decimal(10,2)`: ocho cifras enteras y dos decimales. */
const KILOMETROS_MAX = 99_999_999.99;

export type CampoDelParteLeido =
  | { ok: true; valor: number | null }
  | { ok: false; error: string; message: string };

// `-0` no es negativo y pasa el rango: se guarda como 0.
const sinSigno = (n: number) => (n === 0 ? 0 : n);

/** `desplazamientos Int?` — `null` lo vacía. La coerción es la que la ruta ya hacía: `Number(…)`. */
export function leerDesplazamientos(bruto: unknown): CampoDelParteLeido {
  if (bruto === null) return { ok: true, valor: null };
  const n = Number(bruto);
  if (!Number.isInteger(n)) {
    return { ok: false, error: 'desplazamientos_invalido', message: 'Los desplazamientos son un número entero.' };
  }
  if (n < 0) {
    return { ok: false, error: 'desplazamientos_negativo', message: 'Los desplazamientos no pueden ser negativos.' };
  }
  if (n > INT_COLUMNA_MAX) {
    return { ok: false, error: 'desplazamientos_no_cabe', message: `Los desplazamientos no pueden pasar de ${INT_COLUMNA_MAX}.` };
  }
  return { ok: true, valor: sinSigno(n) };
}

/** `kilometros Decimal(10,2)?` — `null` lo vacía. */
export function leerKilometros(bruto: unknown): CampoDelParteLeido {
  if (bruto === null) return { ok: true, valor: null };
  const n = Number(bruto);
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'kilometros_invalido', message: 'Los kilómetros son un número.' };
  }
  if (n < 0) {
    return { ok: false, error: 'kilometros_negativo', message: 'Los kilómetros no pueden ser negativos.' };
  }
  if (n > KILOMETROS_MAX) {
    return { ok: false, error: 'kilometros_no_cabe', message: `Los kilómetros no pueden pasar de ${KILOMETROS_MAX}.` };
  }
  return { ok: true, valor: sinSigno(n) };
}
