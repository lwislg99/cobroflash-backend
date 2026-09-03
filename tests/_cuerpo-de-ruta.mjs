// tests/_cuerpo-de-ruta.mjs — SCRUM-683b (2ª vuelta) · DÓNDE ACABA UNA RUTA, medido.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DEFECTO QUE ESTO CURA, Y ES DE UNA FAMILIA QUE YA CONOCEMOS
//
// El guard de SCRUM-683b acotaba «la ruta del dictado» así:
//
//     const ini = fuente.indexOf("router.post('/:id/dictado'");
//     const fin = fuente.indexOf('\nexport default router', ini);
//     const cuerpo = fuente.slice(ini, fin);
//
// O sea: **medía dónde acaba el FICHERO, no dónde acaba la RUTA**. Funcionaba sólo mientras el
// dictado fuera la última ruta escrita, que es un hecho accidental del orden del fichero.
//
// El 3-sep-2026 se añadió `POST /:id/firmar-tecnico` después, y el guard saltó diciendo que **la
// ruta del dictado escribe en el parte** — cuando la que escribía era la de al lado. Un rojo que
// nombra al inocente es peor que no tenerlo: se pierde media hora buscando en el sitio equivocado
// y se aprende a desconfiar del guard.
//
// Es la misma familia que llevamos días curando: **el instrumento mide la FORMA y no el HECHO.**
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CÓMO SE MIDE EL HECHO
//
// Una ruta de Express es una llamada: `router.post('/x', async (req, res) => { … });`. Acaba
// donde se cierra ESE paréntesis. Así que se cuentan paréntesis desde el de apertura hasta su
// pareja — ni un carácter más.
//
// 🔴 Y se cuentan sobre el código BLANQUEADO por `soloCodigo`, no sobre el fuente crudo: un
// paréntesis dentro de una cadena (`'La firma debe ser una imagen (PNG o JPEG)'`) o dentro de un
// comentario descuadraría la cuenta y el corte saldría en cualquier sitio. `soloCodigo` usa el
// escáner de TypeScript y **conserva las posiciones exactas** —medido: 28.402 caracteres antes y
// después, y el mismo offset para el mismo texto—, así que se cuenta sobre el blanqueado y se
// corta sobre el original.
import { soloCodigo } from './_solo-codigo.mjs';

/**
 * El cuerpo EXACTO de una ruta, del `router.<verbo>(` a su paréntesis de cierre.
 *
 * `fuente` es el fichero entero; `patron` es lo que abre la ruta, tal cual aparece —por ejemplo
 * `router.post('/:id/dictado'`—.
 *
 * Devuelve `{ ok, cuerpo, ini, fin, motivo }`. **Nunca devuelve un cuerpo a medias**: si no
 * encuentra la ruta o no consigue cerrar el paréntesis, devuelve `ok:false` con el motivo. Un
 * trozo cortado por donde sea se lee igual que un cuerpo entero y hace fallar al guard por el
 * sitio equivocado — que es exactamente el defecto que este fichero existe para no repetir.
 */
export function cuerpoDeRuta(fuente, patron) {
  const texto = String(fuente ?? '');
  const ini = texto.indexOf(patron);
  if (ini < 0) {
    return { ok: false, motivo: `no encuentro la ruta \`${patron}\` en el fichero`, cuerpo: '', ini: -1, fin: -1 };
  }

  // Blanqueado con posiciones intactas: los paréntesis de cadenas y comentarios desaparecen.
  const codigo = soloCodigo(texto, 'ruta.ts');
  if (codigo.length !== texto.length) {
    return {
      ok: false,
      motivo: 'el blanqueador ha cambiado la longitud del fichero, así que las posiciones ya no ' +
        'sirven para cortar. No se devuelve un cuerpo que podría estar mal cortado.',
      cuerpo: '', ini, fin: -1,
    };
  }

  const abre = codigo.indexOf('(', ini);
  if (abre < 0) {
    return { ok: false, motivo: 'la ruta no abre paréntesis: no parece una llamada', cuerpo: '', ini, fin: -1 };
  }

  let nivel = 0;
  for (let i = abre; i < codigo.length; i += 1) {
    const c = codigo[i];
    if (c === '(') nivel += 1;
    else if (c === ')') {
      nivel -= 1;
      if (nivel === 0) {
        const fin = i + 1;
        return { ok: true, cuerpo: texto.slice(ini, fin), ini, fin, motivo: null };
      }
    }
  }

  return {
    ok: false,
    motivo: 'el paréntesis de la ruta no se cierra en todo el fichero. Antes que devolver medio ' +
      'cuerpo se devuelve el fallo: medio cuerpo se lee igual que uno entero.',
    cuerpo: '', ini, fin: -1,
  };
}
