// scripts/_censo-distintos.mjs — SCRUM-1559b
//
// QUÉ ES «UN ELEMENTO DISTINTO» en `censo:tactil-panel`.
//
// Antes la clave era pantalla + selector + texto, así que los nueve «Ir →» de una lista —o los tres
// «💬» de Clientes— contaban como UNO. Medido en SCRUM-1559: tres elementos reales, un distinto.
//
// Ahora la clave es pantalla + POSICIÓN del elemento en `querySelectorAll(INTERACTIVOS)`. Vale como
// identidad a los dos anchos porque el censo sirve EL MISMO HTML a 929 y a 390: sólo cambia el
// viewport, así que el n-ésimo interactivo es el mismo nodo en las dos medidas. Lo que sigue siendo
// uno es lo que debe serlo: el mismo elemento corto a dos anchuras.

/**
 * `resultados`: [{ fn, ancho, medidos: [{ i, sel, texto, tocable, cumple }] }].
 * Devuelve un Map clave → { fn, i, sel, texto, tocable } con el área MÍNIMA de las anchuras en que
 * se quedó corto. Un medido sin `i` es un censo que no dice su posición: revienta, no adivina.
 */
export function cortosDistintos(resultados) {
  const distintos = new Map();
  for (const r of resultados) {
    for (const m of r.medidos.filter((x) => !x.cumple)) {
      if (!Number.isInteger(m.i)) throw new Error(`censo-distintos: ${r.fn} @${r.ancho} trae un medido sin posición («${m.texto}»)`);
      const k = `${r.fn}|${m.i}`;
      const p = distintos.get(k);
      if (!p || m.tocable < p.tocable) distintos.set(k, { fn: r.fn, i: m.i, sel: m.sel, texto: m.texto, tocable: m.tocable });
    }
  }
  return distintos;
}

/**
 * SCRUM-1593 · LOS QUE NO SE HAN PODIDO MIRAR, aparte de los que no tienen caja.
 *
 * `sinPintar` mezclaba dos cosas: un interactivo VISIBLE sin caja (de verdad no hay nada que tocar)
 * y uno OCULTO (un panel con `display:none` que el producto abre al pulsar su pestaña). El segundo no
 * es un cero: es un «no pude mirar», y salía igual que el primero.
 *
 * `resultados`: [{ fn, ancho, medidos, ocultos, sinCaja, noTocables }], con un resultado por estado
 * de pantalla (la de montar y cada pestaña abierta). `fn` es la identidad: dos estados con el mismo
 * `fn` son el MISMO DOM y su `i` es el mismo nodo.
 *
 * Devuelve un Map `fn|i` → { fn, i, sel, texto } con los que salen ocultos en ALGÚN resultado y no
 * se han visto (medidos, sin caja o no tocables) en NINGUNO: ni en otra pestaña ni a otra anchura.
 * Un oculto sin `i` revienta, como en `cortosDistintos`.
 */
export function noMedidosPorOcultos(resultados) {
  const vistos = new Set();
  const ocultos = new Map();
  for (const r of resultados) {
    for (const lista of [r.medidos, r.sinCaja, r.noTocables]) {
      for (const m of lista || []) vistos.add(`${r.fn}|${m.i}`);
    }
    for (const o of r.ocultos || []) {
      if (!Number.isInteger(o.i)) throw new Error(`censo-distintos: ${r.fn} @${r.ancho} trae un oculto sin posición («${o.texto}»)`);
      const k = `${r.fn}|${o.i}`;
      if (!ocultos.has(k)) ocultos.set(k, { fn: r.fn, i: o.i, sel: o.sel, texto: o.texto });
    }
  }
  for (const k of vistos) ocultos.delete(k);
  return ocultos;
}
