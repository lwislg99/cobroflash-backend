// tests/_pdf-texto.mjs — SCRUM-300 (C5)
//
// LEER EL TEXTO DE UN PDF GENERADO, PARA PODER AFIRMAR SOBRE EL DOCUMENTO Y NO SOBRE LA BD.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTO
//
// Los tests de PDF que había (`tests/pdfs.test.mjs`) comprueban que el fichero existe, que
// empieza por `%PDF-` y que pesa más de N bytes. Eso demuestra que se generó ALGO, no que
// dentro ponga lo que tiene que poner: un PDF con los campos en blanco pasa esas tres.
//
// El ticket pide expresamente «test sobre el documento generado, no sobre la base de datos»,
// así que hace falta abrirlo. PDFKit escribe el texto en flujos comprimidos con Flate, de modo
// que se localiza cada `stream…endstream`, se descomprime y se juntan los operadores de texto.
//
// ⚠️ ALCANCE DECLARADO, para que nadie lo dé por más de lo que es:
//   · Solo entiende flujos FlateDecode (los que produce PDFKit aquí). Otro filtro se ignora.
//   · Devuelve el texto de los operadores Tj/TJ, SIN posiciones: sirve para «¿aparece esto?»,
//     no para juzgar maquetación. Para eso está la revisión visual (AB6).
//   · Las tildes salen en la codificación del PDF; por eso `contiene()` compara NORMALIZANDO
//     (sin tildes y sin espacios de más) en vez de exigir el byte exacto.

import zlib from 'node:zlib';
import fs from 'node:fs';

/** Extrae el texto de todos los flujos de contenido del PDF. */
export function textoDePdf(rutaOBuffer) {
  const buf = Buffer.isBuffer(rutaOBuffer) ? rutaOBuffer : fs.readFileSync(rutaOBuffer);
  const trozos = [];
  let desde = 0;

  for (;;) {
    const ini = buf.indexOf('stream', desde);
    if (ini < 0) break;
    // Tras 'stream' viene \r\n o \n; el flujo empieza justo después.
    let p = ini + 'stream'.length;
    if (buf[p] === 0x0d) p++;
    if (buf[p] === 0x0a) p++;
    const fin = buf.indexOf('endstream', p);
    if (fin < 0) break;
    desde = fin + 'endstream'.length;

    const crudo = buf.subarray(p, fin);
    let texto;
    try {
      texto = zlib.inflateSync(crudo).toString('latin1');
    } catch {
      continue; // no es Flate (imagen, fuente incrustada…): no es asunto nuestro
    }
    trozos.push(extraerOperadoresDeTexto(texto));
  }

  return trozos.join('\n');
}

/**
 * Saca el texto de los operadores Tj/TJ. PDF admite DOS formas de cadena y PDFKit usa las dos:
 *
 *   · literal   `(Hola)`            — con escapes `\(`, `\)`, `\351`…
 *   · hexa      `<48 6f 6c 61>`     — que es la que sale aquí de verdad
 *
 * Lo comprobé generando un albarán y mirando el flujo: el título llega como
 * `[<4152c14e202f2050> …] TJ`. Una versión anterior de este fichero solo miraba los paréntesis
 * y devolvía DOS bytes de texto para un PDF entero; parecía que el PDF venía vacío cuando lo
 * que estaba vacío era el instrumento.
 *
 * Un `(` escapado dentro del texto (`\(`) NO cierra la cadena — por eso se recorre a mano y no
 * con una expresión regular, que es justo donde se rompería con «Fontanería (Madrid)».
 */
function extraerOperadoresDeTexto(contenido) {
  const salida = [];
  let i = 0;
  while (i < contenido.length) {
    // ── cadena hexadecimal <...> (pero `<<` es un diccionario, no texto) ──
    if (contenido[i] === '<' && contenido[i + 1] !== '<') {
      const cierre = contenido.indexOf('>', i + 1);
      if (cierre > 0) {
        const cuerpo = contenido.slice(i + 1, cierre).replace(/\s+/g, '');
        if (/^[0-9a-fA-F]*$/.test(cuerpo) && cuerpo.length) {
          let s = '';
          // Un dígito suelto al final se completa con 0, según la norma del formato.
          const par = cuerpo.length % 2 ? cuerpo + '0' : cuerpo;
          for (let k = 0; k < par.length; k += 2) s += String.fromCharCode(parseInt(par.slice(k, k + 2), 16));
          salida.push(s);
          i = cierre + 1;
          continue;
        }
      }
    }
    if (contenido[i] !== '(') { i++; continue; }
    i++;
    let s = '';
    let profundidad = 0;
    while (i < contenido.length) {
      const c = contenido[i];
      if (c === '\\') {
        const sig = contenido[i + 1];
        if (sig >= '0' && sig <= '7') {
          // Escape octal: \351 = é en WinAnsi
          const oct = contenido.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0];
          s += String.fromCharCode(parseInt(oct, 8));
          i += 1 + oct.length;
        } else {
          s += sig === 'n' ? '\n' : sig === 'r' ? '\r' : sig === 't' ? '\t' : sig;
          i += 2;
        }
        continue;
      }
      if (c === '(') { profundidad++; s += c; i++; continue; }
      if (c === ')') {
        if (profundidad === 0) { i++; break; }
        profundidad--; s += c; i++; continue;
      }
      s += c;
      i++;
    }
    salida.push(s);
  }
  // Se unen SIN separador: dentro de un `[…] TJ` los trozos son partes de la MISMA palabra
  // («ALB» + «ARÁN»), y los espacios reales ya viajan dentro de las cadenas. Meter un espacio
  // aquí partiría las palabras y ninguna búsqueda encontraría nada.
  return salida.join('');
}

/** Normaliza para comparar: sin tildes, sin dobles espacios, en minúsculas. */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** ¿Aparece `aguja` en el texto del PDF? Comparación normalizada (ver alcance arriba). */
export function contiene(textoPdf, aguja) {
  return normalizar(textoPdf).includes(normalizar(aguja));
}
