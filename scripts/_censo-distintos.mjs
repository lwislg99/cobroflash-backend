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
 * `resultados`: [{ fn, ancho, medidos: [{ i, sel, texto, caja, tocable, cumple }] }].
 * Devuelve un Map clave → { fn, i, sel, texto, caja, tocable } con el área MÍNIMA de las anchuras en
 * que se quedó corto, y la caja DE ESA MISMA medida. Un medido sin `i` es un censo que no dice su
 * posición: revienta, no adivina.
 */
export function cortosDistintos(resultados) {
  const distintos = new Map();
  for (const r of resultados) {
    for (const m of r.medidos.filter((x) => !x.cumple)) {
      if (!Number.isInteger(m.i)) throw new Error(`censo-distintos: ${r.fn} @${r.ancho} trae un medido sin posición («${m.texto}»)`);
      const k = `${r.fn}|${m.i}`;
      const p = distintos.get(k);
      if (!p || m.tocable < p.tocable) distintos.set(k, { fn: r.fn, i: m.i, sel: m.sel, texto: m.texto, caja: m.caja, tocable: m.tocable });
    }
  }
  return distintos;
}

/**
 * SCRUM-1603c · LA CAJA Y EL TOQUE, EN UNA SOLA FORMA DE IMPRIMIRLOS.
 *
 * El censo juzga por el TOQUE y sólo imprimía el toque, así que la caja CSS de un campo (los 34 px
 * de `.input` que pide la aceptación de SCRUM-1603) no salía en ningún log. Son dos números
 * distintos y salen los dos, siempre en este orden y con su palabra delante.
 *
 * `leerCajaYToque` hace el camino de vuelta: el censo lo usa sobre su sonda TAPADA (caja 40, toque
 * 30) para comprobar que lo que IMPRIME distingue las dos cifras. Si un día se imprimiera el toque
 * dos veces, la sonda saldría «caja 30» y el censo diría que no supo medir.
 */
export const cajaYToque = (m) => `caja ${m.caja} · toque ${m.tocable}`;
export function leerCajaYToque(linea) {
  const x = /caja (\S+) · toque (\S+)/.exec(String(linea));
  return x ? { caja: Number(x[1]), tocable: Number(x[2]) } : null;
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
