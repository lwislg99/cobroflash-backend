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

import { INTERACTIVOS, minimoPara } from './_medidor-de-toque.mjs';

// ═══ SCRUM-962c · LA POBLACIÓN, LA VARA Y LO QUE NO SE MIRÓ, DECLARADOS ═══════════════════════════
// S2 midió (SCRUM-962, tramos 962b y 962b (2)) que el censo fallaba en las DOS direcciones: se le
// escapaban 42 controles y, de sus 72 cortos, sólo 8 incumplían DESIGN.md tal cual. Cuatro averías:
//   ⒜ la población era `INTERACTIVOS` sin decir qué dejaba fuera: 0 de 36 `select` entraban;
//   ⒝ sólo medía el estado del montaje, y lo no pintado salía en una columna que no contaba;
//   ⒞ medía 929 px contra 44 (DESIGN.md §5 dice 36 en escritorio) y no separaba `btn-sm` (exento);
//   ⒟ medía la casilla sola, no la casilla MÁS la etiqueta que la envuelve y que el dedo pulsa.
// Lo de aquí es puro (sin navegador) para que cada decisión tenga su test con mutación.

/** Las casillas: el objetivo puede ser su ETIQUETA envolvente (⒟). */
export const CASILLAS = 'input[type="checkbox"], input[type="radio"]';

/**
 * ⒜ Controles: `INTERACTIVOS` (la definición de los guards, que NO se cambia aquí) más lo que se
 * pulsa igual y no estaba: el `radio` (hermano de la casilla), los `input` que son botones y los
 * roles ARIA de control.
 */
export const CONTROLES = INTERACTIVOS
  + ', input[type="radio"], input[type="reset"], input[type="image"]'
  + ', [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role="menuitem"]';

/**
 * ⒜ Campos de formulario. Se MIDEN, pero DESIGN.md §5 «Inputs / Fields» no les da altura (sólo el
 * «targets ≥44px» genérico de §6): no hay vara escrita, así que van en su propia cuenta y NO se
 * suman a los cortos. Elegir su vara no es del censo: está propuesto en `docs/master/SCRUM-962.md`.
 */
export const CAMPOS = 'select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
  + ':not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])';

export const POBLACION = CONTROLES + ', ' + CAMPOS;

/**
 * El árbitro de una ETIQUETA envolvente: la etiqueta y todo lo pulsable MENOS las casillas. Así un
 * punto sobre la casilla es de la etiqueta (la casilla no está en la lista y `closest` sube), y uno
 * sobre un enlace metido en la etiqueta NO lo es (ese toque se lo lleva el enlace).
 */
export const ARBITRO_ETIQUETA = 'label, ' + POBLACION.split(',').map((s) => s.trim())
  .filter((s) => s !== 'input[type="checkbox"]' && s !== 'input[type="radio"]').join(', ');

const esBtnSm = (sel) => String(sel).split('.').includes('btn-sm');

/**
 * ⒞ La vara de DESIGN.md §5, no 44 a todas las anchuras: `minimoPara(ancho)` (44 hasta 768 px, 36
 * por encima). Debajo de la vara, tres cosas que NO se mezclan:
 *   'corto'  → incumple la regla escrita;
 *   'exento' → `btn-sm`, la excepción deliberada de §5 (sigue contándose, aparte);
 *   'campo'  → un campo, que no tiene vara escrita (⒜).
 */
export function veredicto(m, ancho) {
  if (m.tocable >= minimoPara(ancho)) return 'cumple';
  if (m.clase === 'campo') return 'campo';
  if (m.clase === 'control' && esBtnSm(m.sel)) return 'exento';
  return 'corto';
}

/** Los distintos (pantalla + posición) que alguna vez salieron con ese veredicto. */
export function distintosCon(resultados, cual) {
  return cortosDistintos(resultados.map((r) => ({
    ...r, medidos: r.medidos.map((m) => ({ ...m, cumple: m.veredicto !== cual })),
  })));
}

/**
 * ⒝ SIN MIRAR: el elemento que no se pintó en NINGÚN estado ni anchura medidos. No es «ausente» ni
 * cero: se cuenta y se nombra. Uno que se pinta a una anchura y no a otra SÍ está medido.
 * Devuelve Map clave → { fn, i, sel, clase, texto }.
 */
export function sinMirar(resultados) {
  const vistos = new Set();
  for (const r of resultados) for (const m of [...r.medidos, ...r.noTocables]) vistos.add(`${r.fn}|${m.i}`);
  const sin = new Map();
  for (const r of resultados) {
    for (const s of r.sinPintar) {
      if (!Number.isInteger(s.i)) throw new Error(`censo-distintos: ${r.fn} trae un sin pintar sin posición`);
      const k = `${r.fn}|${s.i}`;
      if (!vistos.has(k) && !sin.has(k)) sin.set(k, { fn: r.fn, i: s.i, sel: s.sel, clase: s.clase, texto: s.texto });
    }
  }
  return sin;
}

/**
 * LAS SONDAS que se inyectan en cada superficie y anchura. Cada una prueba UNA de las averías, y la
 * del botón de 12 px (la única que había) no probaba ninguna: un botón SIEMPRE está en el selector,
 * así que demostraba que la pantalla se mide, nunca que la población esté completa.
 */
const BLOQUE = 'display:block;box-sizing:border-box;width:160px;min-height:0;padding:0;border:0;margin:12px 0';
export const SONDAS_HTML = '<div id="__sondas-962c">'
  + '<button id="__sonda" style="width:12px;height:12px;padding:0;border:0">.</button>'
  // ⒜ de la clase que el selector viejo dejaba FUERA
  + '<select id="__sonda-campo" style="' + BLOQUE + ';height:20px"><option>.</option></select>'
  // ⒞ 40 px: corto en móvil, cumple en escritorio; y un btn-sm de 30: exento, no corto
  + '<button id="__sonda-40" style="' + BLOQUE + ';height:40px">.</button>'
  + '<button id="__sonda-sm" class="btn btn-secondary btn-sm" style="' + BLOQUE + ';height:30px">.</button>'
  // ⒟ la MISMA etiqueta de 60 px: envolvente (larga) y separada con `for` (la casilla, corta)
  + '<label style="' + BLOQUE + ';height:60px"><input type="checkbox" id="__sonda-envuelta"> .</label>'
  + '<input type="checkbox" id="__sonda-suelta"><label for="__sonda-suelta" style="' + BLOQUE + ';height:60px">.</label>'
  // ⒝ un control que no se pinta tiene que salir como SIN PINTAR, no faltar
  + '<div style="display:none"><button id="__sonda-oculta">.</button></div>'
  + '</div>';

/**
 * Juzga las sondas de UNA página (`rs` = lo que devuelve MEDIR) a una anchura. Devuelve la lista de
 * fallos, vacía si todas cazan. Cada fallo dice QUÉ avería deja de verse.
 */
export function juzgarSondas(rs, ancho) {
  const fallos = [];
  const med = (id) => rs.medidos.find((m) => m.id === id);
  const v = (id) => { const m = med(id); return m ? veredicto(m, ancho) : null; };
  const debe = (cond, txt) => { if (!cond) fallos.push(txt); };

  debe(v('__sonda') === 'corto', 'botón de 12 px: no sale corto (la superficie no se mide)');
  const campo = med('__sonda-campo');
  debe(campo && campo.clase === 'campo' && v('__sonda-campo') === 'campo', `⒜ select de 20 px: ${campo ? 'medido como ' + campo.clase + '/' + v('__sonda-campo') : 'NO está en la población'}`);
  const s40 = med('__sonda-40');
  debe(s40 && s40.tocable > 36 && s40.tocable < 44, `⒞ botón de 40 px: mide ${s40 ? s40.tocable : 'nada'}, no prueba la vara`);
  debe(v('__sonda-40') === (ancho <= 768 ? 'corto' : 'cumple'), `⒞ botón de 40 px a ${ancho}: sale ${v('__sonda-40')} (la vara no depende del ancho)`);
  debe(v('__sonda-sm') === 'exento', `⒞ btn-sm de 30 px: sale ${v('__sonda-sm')}, no exento`);
  const env = med('__sonda-envuelta');
  const sue = med('__sonda-suelta');
  debe(env && env.viaEtiqueta && env.tocable >= 44, `⒟ casilla ENVUELTA: ${env ? env.tocable + ' px' + (env.viaEtiqueta ? '' : ' sin su etiqueta') : 'no medida'} (debía salir larga)`);
  debe(sue && !sue.viaEtiqueta && sue.tocable < 44, `⒟ casilla con etiqueta SEPARADA: ${sue ? sue.tocable + ' px' : 'no medida'} (debía salir corta)`);
  debe(!(env && sue) || env.tocable !== sue.tocable, '⒟ las dos casillas salen IGUAL: el censo no distingue la etiqueta envolvente');
  debe(rs.sinPintar.some((s) => s.id === '__sonda-oculta'), '⒝ el control oculto NO sale como sin pintar: lo no mirado desaparece');
  return fallos;
}

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
