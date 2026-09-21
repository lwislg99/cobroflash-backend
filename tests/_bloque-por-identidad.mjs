// tests/_bloque-por-identidad.mjs — SCRUM-675
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UN GUARD SE ANCLA A LO QUE VIGILA, NO A LA DISTANCIA HASTA LO QUE VIGILA.
//
// 🔒 **Una ventana fija no lee el código: lee los primeros N caracteres de donde estaba el código.**
//
// Es la misma familia que el ancla por número de línea (SCRUM-513) y el bloque localizado por
// posición: *referenciar por posición caduca; por identidad no*. Aquí medido en caracteres.
//
// ── LO QUE PASA HOY, Y POR QUÉ ES CARO ────────────────────────────────────────────────────────
//
// Con `src.slice(i, i + 1800)`, escribir un comentario cerca empuja el símbolo fuera de la ventana:
//
//   · si el assert era `match`        → el guard CAE. Frágil, pero su ceguera es RUIDOSA.
//   · si el assert era `doesNotMatch` → el guard **PASA EN VERDE** sin mirar nada. Ceguera
//     SILENCIOSA, que es la que muerde. Medidas en el árbol: **2**.
//
// ── EL ARREGLO: identidad, y suelo cuando la identidad no alcanza ─────────────────────────────
//
// `bloqueDesde` delimita el bloque por su **estructura** —desde el ancla hasta que se cierran sus
// llaves—, no por una distancia. Un comentario dentro del bloque ya no lo desborda, porque el
// bloque acaba donde acaba, no a los N caracteres.
//
// 🔴 **Y NO SE SUBE NINGÚN TOPE.** Subir 1800 a 3600 compra tiempo y reproduce el defecto con otro
// número dentro de tres meses — es literalmente lo que prohíbe la regla 41: se arregla el código,
// no lo que el guard exige.
//
// 🔴 **Si no puede delimitar, LANZA.** No devuelve «lo que pillé»: un instrumento que no sabe
// algo se declara ciego, no contesta que no. Es la salida B del ticket, y aquí va como suelo de la
// A: si el ancla estructural fallara algún día, el guard grita en vez de callarse.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export class BloqueNoDelimitableError extends Error {
  constructor(ancla, motivo) {
    super(
      `bloque_no_delimitable: no pude acotar el bloque que empieza en «${ancla}» (${motivo}). `
      + 'NO se devuelve un trozo aproximado: un guard que lee «lo que pillé» y pasa en verde es '
      + 'peor que uno que falla diciendo que no llega. Arregla el ancla, no el tamaño.',
    );
    this.name = 'BloqueNoDelimitableError';
    this.ancla = ancla;
  }
}

/**
 * El bloque que empieza en `ancla`, delimitado por IDENTIDAD.
 *
 * Dos formas, y se elige la que el llamador declare:
 *   · `{ hasta }`  — hasta la siguiente aparición de ese texto. Para bloques que no son sintácticos.
 *   · por defecto  — hasta que se cierran las llaves abiertas desde el ancla. Para funciones y
 *     bloques de verdad, que es donde el ancla estructural gana.
 *
 * ⚠️ El contador de llaves ignora las que van dentro de cadenas y comentarios: sin eso, un `{` en
 * un mensaje de texto cerraría el bloque antes de tiempo y volveríamos a leer de menos — el mismo
 * defecto con otra cara.
 */
export function bloqueDesde(texto, ancla, { hasta = null } = {}) {
  const i = texto.indexOf(ancla);
  if (i < 0) throw new BloqueNoDelimitableError(ancla, 'el ancla no aparece en la fuente');

  if (hasta != null) {
    const j = texto.indexOf(hasta, i + ancla.length);
    if (j < 0) throw new BloqueNoDelimitableError(ancla, `no aparece el final «${hasta}»`);
    return texto.slice(i, j + hasta.length);
  }

  let profundidad = 0;
  let abierto = false;
  let enCadena = null;
  let enLinea = false;
  let enBloque = false;

  for (let k = i; k < texto.length; k++) {
    const c = texto[k];
    const sig = texto[k + 1];

    if (enLinea) { if (c === String.fromCharCode(10)) enLinea = false; continue; }
    if (enBloque) { if (c === '*' && sig === '/') { enBloque = false; k++; } continue; }
    if (enCadena) {
      if (c === '\\') { k++; continue; }
      if (c === enCadena) enCadena = null;
      continue;
    }
    if (c === '/' && sig === '/') { enLinea = true; k++; continue; }
    if (c === '/' && sig === '*') { enBloque = true; k++; continue; }
    if (c === "'" || c === '"' || c === '`') { enCadena = c; continue; }

    if (c === '{') { profundidad++; abierto = true; continue; }
    if (c === '}') {
      profundidad--;
      if (abierto && profundidad === 0) return texto.slice(i, k + 1);
      if (profundidad < 0) throw new BloqueNoDelimitableError(ancla, 'llave de cierre sin abrir');
    }
  }

  throw new BloqueNoDelimitableError(
    ancla,
    abierto ? 'el bloque no se cierra antes del final del fichero' : 'no se abrió ningún bloque tras el ancla',
  );
}
