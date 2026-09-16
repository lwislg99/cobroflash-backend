// scripts/_hueco-condicion.mjs — SCRUM-564
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DÓNDE CABRÍA LA CONDICIÓN, Y CUÁNTOS CARACTERES — la medida, ARCHIVADA
//
// 🔴 LA DECISIÓN CAMBIÓ, Y ESTA MEDIDA ES LA QUE LA CAMBIÓ. El 20-ago-2026, DESPUÉS de leerla,
// el fundador decidió **no documentar la condición**: los tres medios se quedan enunciados como
// están. «Cuando hagamos el go para empezar a vender, todo será verdad.»
//
// ⛔ **NO SE ESCRIBE NINGUNA NOTA.** Ni en `precios/li#3`, ni en los tres de `#probar`, ni en
// ningún sitio. Lo que sostiene esa decisión es el mecanismo de SCRUM-568, no una advertencia
// al visitante.
//
// ENTONCES ¿POR QUÉ SIGUE ESTO AQUÍ? Porque la medida costó dos intentos y tres trampas, y el
// día que haga falta una nota —si el go llega antes que los flags— el dato ya estará. Esto es un
// ARCHIVO, no un plan: nadie tiene que hacer nada con estos números hoy.
//
// ⛔ AQUÍ NO HAY NI UNA PALABRA DE LA CONDICIÓN. Regla 30: el microcopy es del fundador. Esto
// mide dónde cabría y cuánto; la frase, si algún día hace falta, la elige él.
//
// Los números salen de `scripts/medir-hueco-condicion.mjs`, que los mide EN NAVEGADOR. Se
// congelan aquí para que un test pueda vigilarlos sin abrir Edge en cada `npm test`.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Cómo se midió. Sin esto, los números de abajo son cifras sin unidades. */
export const CONDICIONES = {
  fecha: '2026-08-21',
  navegador: 'Edge headless vía puppeteer-core',
  anchos: [360, 1280],
  sonda: '<small> a 13 px; `display:block` en los sitios de bloque',
  relleno: 'el PROPIO texto de la unidad, repetido — así «caben N caracteres» son N caracteres '
    + 'de prosa como la que ya está ahí, con su misma métrica, y no de una tira de equis',
  detalles: 'los <details> del FAQ se abren antes de medir (3 de 4 nacen cerrados): con el '
    + 'desplegable cerrado la sonda no tiene caja y el número saldría inventado',
  arbitroDeToque: 'SCRUM-562: `closest`, y DESDE EL CENTRO. Nunca `elementsFromPoint().includes()`',
};

/**
 * Qué significa cada columna:
 *
 *   · `unaLinea` — caracteres que caben en UNA línea a la anchura de ese hueco.
 *   · `sinMover` — caracteres que caben **sin que la sección cambie de alto**. Es el número
 *     estricto: por encima de él, la nota empuja lo que hay debajo.
 *   · `visible`  — la sonda tiene caja Y el navegador la devuelve al preguntar por su centro.
 *     `false` significa **ahí no cabe nada**, por mucho que los otros números digan.
 *   · `rompe`    — con 200 caracteres, ¿desborda en horizontal o cambia el ancho de la sección?
 *   · `roba`     — táctiles que dejan de recibir el toque en su centro por culpa de la nota.
 */
export const HUECOS = {
  360: {
    'como/p#4': {
      'junto al texto': { host: 'p', ancho: 274, unaLinea: 39, sinMover: 39, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.prod.reveal.on.in', ancho: 316, unaLinea: 46, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 52, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'todo/p#3': {
      'junto al texto': { host: 'p', ancho: 274, unaLinea: 38, sinMover: 2, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.prod.reveal.on.in', ancho: 316, unaLinea: 44, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 50, sinMover: 0, visible: false, rompe: false, roba: [] },
    },
    'precios/li#3': {
      'junto al texto': { host: 'li', ancho: 254, unaLinea: 21, sinMover: 21, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'li', ancho: 254, unaLinea: 36, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 51, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'precios/p#2': {
      'junto al texto': { host: 'p.fee-note', ancho: 254, unaLinea: 10, sinMover: 10, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'p.fee-note', ancho: 254, unaLinea: 38, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 53, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'precios/p#4': {
      'junto al texto': { host: 'p.fee-note', ancho: 254, unaLinea: 10, sinMover: 10, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'p.fee-note', ancho: 254, unaLinea: 36, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 50, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#15': {
      'junto al texto': { host: 'span.tt', ancho: 126, unaLinea: 13, sinMover: 13, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.try-step', ancho: 286, unaLinea: 5, sinMover: 3, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 45, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#16': {
      'junto al texto': { host: 'span.ts', ancho: 180, unaLinea: 23, sinMover: 7, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.try-step', ancho: 286, unaLinea: 9, sinMover: 4, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 52, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#42': {
      'junto al texto': { host: 'span.pt', ancho: 46, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie del bloque': { host: 'span', ancho: 55, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 54, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#44': {
      'junto al texto': { host: 'span.pt', ancho: 41, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie del bloque': { host: 'span', ancho: 66, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 45, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'faq/div#3': {
      'junto al texto': { host: 'div.a', ancho: 314, unaLinea: 24, sinMover: 24, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'details', ancho: 316, unaLinea: 50, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 360, unaLinea: 51, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
  },
  1280: {
    'como/p#4': {
      'junto al texto': { host: 'p', ancho: 295, unaLinea: 43, sinMover: 43, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.prod.reveal.on.in', ancho: 345, unaLinea: 49, sinMover: 49, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 176, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'todo/p#3': {
      'junto al texto': { host: 'p', ancho: 295, unaLinea: 11, sinMover: 11, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.prod.reveal.on.in', ancho: 345, unaLinea: 48, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 173, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'precios/li#3': {
      'junto al texto': { host: 'li', ancho: 358, unaLinea: 6, sinMover: 6, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'li', ancho: 358, unaLinea: 52, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 174, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'precios/p#2': {
      'junto al texto': { host: 'p.fee-note', ancho: 358, unaLinea: 28, sinMover: 28, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'p.fee-note', ancho: 358, unaLinea: 56, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 183, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'precios/p#4': {
      'junto al texto': { host: 'p.fee-note', ancho: 358, unaLinea: 26, sinMover: 26, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'p.fee-note', ancho: 358, unaLinea: 54, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 175, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#15': {
      'junto al texto': { host: 'span.tt', ancho: 126, unaLinea: 42, sinMover: 277, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.try-step', ancho: 490, unaLinea: 34, sinMover: 320, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 159, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#16': {
      'junto al texto': { host: 'span.ts', ancho: 180, unaLinea: 41, sinMover: 312, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'div.try-step', ancho: 490, unaLinea: 39, sinMover: 375, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 180, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#42': {
      'junto al texto': { host: 'span.pt', ancho: 46, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie del bloque': { host: 'span', ancho: 55, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 187, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'probar/span#44': {
      'junto al texto': { host: 'span.pt', ancho: 41, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie del bloque': { host: 'span', ancho: 66, unaLinea: 0, sinMover: 0, visible: false, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 154, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
    'faq/div#3': {
      'junto al texto': { host: 'div.a', ancho: 758, unaLinea: 52, sinMover: 52, visible: true, rompe: false, roba: [] },
      'pie del bloque': { host: 'details', ancho: 760, unaLinea: 121, sinMover: 0, visible: true, rompe: false, roba: [] },
      'pie de la seccion': { host: 'div.wrap', ancho: 1120, unaLinea: 172, sinMover: 0, visible: true, rompe: false, roba: [] },
    },
  },
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CRITERIO · escrito, y derivado del propio texto — no un número a ojo
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * Un SITIO SIRVE si la sonda se ve y no rompe la maqueta **en los DOS anchos**. Servir en uno
 * solo no sirve: la landing se lee en los dos.
 *
 * Y para decidir si un hueco da para una NOTA o sólo para un guiño hace falta un umbral. No se
 * pone a ojo: se deriva del propio texto que se va a documentar — **el doble de su palabra más
 * larga**. Si en el hueco no caben ni dos palabras del tamaño de las que ya hay ahí, ahí no cabe
 * una frase, y decir que «cabe» sería empujar al fundador a escribir algo que no se lee.
 *
 * ⚠️ El umbral se declara para poder discutirlo, y los números en crudo van al lado: quien lea
 * esto no tiene por qué aceptar mi umbral para usar la medida.
 */
export const UMBRAL = { regla: 'el doble de la palabra más larga del propio texto' };

export const CABE = 'CABE UNA NOTA';
export const SOLO_GUINO = 'SOLO UN GUINO, NO UNA FRASE';
export const NO_CABE = 'NO CABE NADA';

export function palabraMasLarga(texto) {
  return texto.split(/\s+/).reduce((n, p) => Math.max(n, p.replace(/[.,;:—«»()]/g, '').length), 0);
}

/** El veredicto de UN sitio para UN texto, mirando los dos anchos. */
export function veredictoDeSitio(id, texto, sitio) {
  const anchos = Object.keys(HUECOS);
  const datos = anchos.map((a) => HUECOS[a][id] && HUECOS[a][id][sitio]).filter(Boolean);
  if (datos.length !== anchos.length) return { sitio, veredicto: NO_CABE, motivo: 'sin medida en algún ancho' };
  if (datos.some((d) => !d.visible)) {
    return { sitio, veredicto: NO_CABE, peor: 0,
      motivo: 'la sonda no llega a verse en ' + anchos.filter((a, i) => !datos[i].visible).join(' y ') + ' px' };
  }
  if (datos.some((d) => d.rompe)) return { sitio, veredicto: NO_CABE, peor: 0, motivo: 'rompe la maqueta' };
  const peor = Math.min(...datos.map((d) => d.unaLinea));
  const minimo = palabraMasLarga(texto) * 2;
  return {
    sitio, peor, minimo,
    porAncho: Object.fromEntries(anchos.map((a, i) => [a, { unaLinea: datos[i].unaLinea, sinMover: datos[i].sinMover }])),
    veredicto: peor >= minimo ? CABE : SOLO_GUINO,
  };
}

/**
 * Los tres grupos del punto 3.
 *
 * 🔴 El que vuelve al fundador NO es sólo «no cabe en ningún sitio»: es también **«sólo cabe al
 * pie de la sección»**. Una condición a cuarenta líneas de la afirmación que condiciona no
 * documenta nada — el cliente lee la promesa y decide antes de llegar a la nota. Si un texto sólo
 * admite eso, la única salida que le queda es cambiar el texto, y eso es suyo.
 */
export const JUNTO = 'ADMITE NOTA JUNTO A LA AFIRMACION';
export const LEJOS = 'SOLO AL PIE DE LA SECCION';
export const NINGUNO = 'NO ADMITE NOTA EN NINGUN SITIO';

export function clasificar(id, texto) {
  const sitios = ['junto al texto', 'pie del bloque', 'pie de la seccion']
    .map((s) => veredictoDeSitio(id, texto, s));
  const cerca = sitios.filter((s) => s.sitio !== 'pie de la seccion' && s.veredicto === CABE);
  const pie = sitios.find((s) => s.sitio === 'pie de la seccion');
  const grupo = cerca.length ? JUNTO : (pie && pie.veredicto === CABE ? LEJOS : NINGUNO);
  return { id, texto, grupo, sitios };
}
