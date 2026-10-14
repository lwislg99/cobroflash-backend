// Tres resultados y no dos (SCRUM-1536b, por el rojo de tests/scrum622-desconocido-no-es-verde.test.mjs).
// Un control solo dice OK si hay PRUEBA de que pudo mirar y miro limpio. Lo que no es ni ROTO ni OK
// probado cae en «no se pudo saber»: el resultado por defecto es el que no afirma nada.
export const OK = 'OK';
export const ROTO = 'ROTO';
export const NO_SE = 'NO SE PUDO SABER';

/**
 * @param {{ pudoMirar: boolean, roto: boolean }} c
 *   pudoMirar: el instrumento ha visto, en ESE MISMO texto, algo que se sabe que esta.
 *   roto: ha visto lo que no tenia que ver, o le falta lo que tenia que ver.
 */
export function veredicto({ pudoMirar, roto }) {
  if (roto === true) return ROTO;
  if (roto === false && pudoMirar === true) return OK;
  return NO_SE;
}
