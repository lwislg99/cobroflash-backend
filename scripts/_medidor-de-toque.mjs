// scripts/_medidor-de-toque.mjs — SCRUM-562
//
// UN SOLO MEDIDOR DEL ÁREA QUE RECIBE EL TOQUE, para que no vuelva a haber dos.
//
// ── EL DEFECTO QUE ESTE FICHERO EXISTE PARA QUE NO VUELVA ────────────────────────────────────
// El idioma de la casa era:
//
//     const toca = (y) => document.elementsFromPoint(cx, y).includes(el);
//
// Eso pregunta «¿ESTÁ EL ELEMENTO EN LA PILA?». Y la respuesta es SÍ aunque haya otra cosa
// ENCIMA tapándolo: sigue en la pila, pero el toque se lo lleva el de arriba. Su fallo va en la
// dirección cómoda — produce VERDES.
//
// Lo destapó SCRUM-542: `.cta-band::after`, un círculo decorativo de 420×420 sin
// `pointer-events:none`, se comía los 20 px superiores del botón principal a 360 px. Caja
// 61,8 px, área real 41,5. Invisible a 1280, e invisible en cualquier revisión del CSS.
//
// ⚠️ Y NO ERA UN DEFECTO, ERAN DOS. El bucle viejo expandía DESDE LOS BORDES DE LA CAJA y sólo
//    hacia fuera: nunca encogía. Con eso, un elemento tapado por arriba seguía devolviendo el
//    alto de su caja aunque el árbitro fuese el correcto — la medición sólo podía sobre-reportar.
//    Por eso aquí se expande DESDE EL CENTRO: lo que se mide es hasta dónde llega el elemento
//    partiendo de un punto que se ha comprobado que le pertenece.
//
// ── LAS TRES PIEZAS QUE HACEN QUE UNA MEDIDA VALGA ───────────────────────────────────────────
// ① EL ÁRBITRO es «qué activaría el dedo aquí»:  elementsFromPoint(x,y)[0].closest(SEL) === el
//    Acierta con los hijos (el `<span>` de dentro de un enlace pertenece a su enlace) y deja de
//    mentir cuando algo lo tapa.
// ② SE EXPANDE DESDE EL CENTRO, con control positivo (el centro TIENE que pertenecerle) y
//    negativo (400 px más abajo NO puede pertenecerle).
// ③ SE AFINA EL BORDE POR BISECCIÓN. Sin esto el medidor MIENTE POR DEFECTO: un objetivo de
//    44,0 px exactos se lee 43,5 sólo porque su borde cae entre dos muestras de 0,5, y eso se
//    denuncia como un defecto de CSS que no existe. Medido en SCRUM-542.
//
// ── LO QUE NO ES ESTE ARBITRAJE ──────────────────────────────────────────────────────────────
// Preguntar por PERTENENCIA a la pila no está mal siempre: está mal para «¿se puede pulsar?».
// Cuando la pregunta es «¿qué hay DEBAJO de este elemento?» —contraste, superposiciones— la
// posición en la pila es justo el dato que hace falta. Por eso el censo de SCRUM-562 clasifica
// por LA PREGUNTA y no por la sintaxis.

/**
 * Qué cuenta como «se puede pulsar». Una sola definición para todos los guards.
 *
 * 🔴 SCRUM-782 · ENTRAN LAS CASILLAS, y no es un detalle: sin `input[type="checkbox"]` este
 * selector no veía NI UNA de las 11 casillas de la lista de Clientes. Medido: el guard, aunque
 * hubiera visitado esa página, habría dado «✅ todo cumple» sin mirar el control del que va el
 * ticket. Un selector incompleto es la misma ceguera que una página no visitada, y más difícil de
 * ver porque no se nota en el nombre.
 *
 * ⚠️ NO cambia lo que mide la landing: allí hay CERO casillas (medido, `grep -c` sobre
 * `public/` fuera de `dashboard/` = 0), así que su población es la misma antes y después.
 */
export const INTERACTIVOS = 'a[href], button, [role="button"], summary, input[type="submit"], input[type="button"], input[type="checkbox"]';

/** AB6. No se baja: si un caso no llega, va como excepción declarada con su motivo. */
export const MINIMO_TACTIL = 44;

/**
 * El medidor, como FUENTE para inyectar en la página con `page.evaluate(FUENTE_MEDIDOR)`.
 *
 * Instala `window.__areaDeToque(el, sel, opciones)` → `{ caja, tocable, error }`.
 *   · `opciones.scroll` lleva el elemento a la vista antes de medir. 🔴 Hace falta siempre que
 *     el elemento pueda estar bajo el pliegue: `elementsFromPoint` SÓLO VE EL VIEWPORT, y sin
 *     scroll un censo del pie devuelve cero y ese cero PARECE una respuesta.
 */
export const FUENTE_MEDIDOR = `(() => {
  const espera = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  window.__areaDeToque = async (el, SEL, opciones) => {
    const o = opciones || {};
    if (!el) return { error: 'NO EXISTE' };

    const r0 = el.getBoundingClientRect();
    if (!r0.width || !r0.height) return { error: 'no se está pintando (caja de 0×0)' };

    if (o.scroll) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); await espera(); }

    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    // ① EL ÁRBITRO: no «está en la pila», sino «el de encima le pertenece».
    const toca = (y) => {
      const arriba = document.elementsFromPoint(cx, y)[0];
      return !!arriba && arriba.closest(SEL) === el;
    };

    // CONTROL POSITIVO del propio detector: en el centro TIENE que pertenecerle. Si no, no está
    // midiendo el elemento que cree, y su «cumple» no valdría nada.
    if (!toca(cy)) return { caja: +r.height.toFixed(1), error: 'el detector no lo alcanza ni en su centro' };
    // CONTROL NEGATIVO: 400 px más abajo NO puede seguir siendo suyo.
    if (toca(cy + 400)) return { caja: +r.height.toFixed(1), error: 'el detector dice que le pertenece un punto 400px más abajo: no sabe decir que no' };

    // ② DESDE EL CENTRO, no desde los bordes de la caja.
    let top = cy, bottom = cy;
    while (top > cy - 90 && toca(top - 0.5)) top -= 0.5;
    while (bottom < cy + 90 && toca(bottom + 0.5)) bottom += 0.5;

    // ③ AFINADO DEL BORDE por bisección (≈0,01 px) antes de acusar a nadie.
    const afinar = (bueno, malo) => {
      for (let i = 0; i < 7; i++) { const m = (bueno + malo) / 2; if (toca(m)) bueno = m; else malo = m; }
      return bueno;
    };
    top = afinar(top, top - 0.5);
    bottom = afinar(bottom, bottom + 0.5);

    return { caja: +r.height.toFixed(1), tocable: +(bottom - top).toFixed(1) };
  };
  return true;
})()`;
