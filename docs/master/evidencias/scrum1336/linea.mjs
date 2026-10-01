// linea.mjs — SCRUM-1336 · LA LÍNEA AGREGADA DEL BANCO (aceptación E2, c.17949).
//
// PURA: recibe las filas de UN escenario y dice cuántos guards midieron y cuántos no supieron
// mirar. Sale SIEMPRE, también con ceros: si sólo saliera cuando alguno no supo mirar, que no esté
// no distinguiría «todos midieron» de «alguien quitó la cuenta».
//
//   midió ............ el guard salió con 0 (verde) o con 1 (hallazgo): llegó a juzgar.
//   no supo mirar .... salió con 2, 3 o 4: los códigos de ciego de la casa.
//   sin contar ....... la pasada no vale: el banco no aplicó la rotura, o el proceso murió, o no
//                      dijo nada. No es ni lo uno ni lo otro, y se dice aparte.
//
// No es la línea de la puerta (`lineaDeArranque`, en `scripts/guards-visuales.mjs`): ésa ve a los
// guards de la casa en una pasada real. Ésta ve las pasadas de ESTE banco.
const CODIGOS_DE_MEDIR = new Set([0, 1]);
const CODIGOS_DE_CIEGO = new Set([2, 3, 4]);

export function clasificarPasada(fila) {
  if (!fila || fila.valida !== true) return 'sin contar';
  if (CODIGOS_DE_MEDIR.has(fila.exit)) return 'midio';
  if (CODIGOS_DE_CIEGO.has(fila.exit)) return 'no supo mirar';
  return 'sin contar';
}

export function lineaDeLosQueMidieron(filas) {
  const lista = Array.isArray(filas) ? filas : [];
  const n = lista.filter((f) => clasificarPasada(f) === 'midio').length;
  const k = lista.filter((f) => clasificarPasada(f) === 'no supo mirar').length;
  const m = lista.length - n - k;
  return n + (n === 1 ? ' guard midió' : ' guards midieron')
    + ' · ' + k + (k === 1 ? ' no supo mirar' : ' no supieron mirar')
    + ' · ' + m + (m === 1 ? ' pasada sin contar' : ' pasadas sin contar')
    + ' (de ' + lista.length + ')';
}
