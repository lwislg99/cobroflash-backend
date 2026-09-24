// public/dashboard/js/jobTrabajoPlegable.js — SCRUM-917g (corte F del detalle del Trabajo)
//
// «EL TRABAJO», PLEGABLE.
//
// Tipo de trabajo · Datos · Quién ejecuta · Notas internas · Gastos eran CINCO secciones sueltas,
// cada una con su cabecera en versalitas, y empezaban pasados los 900 px: a 390 px las cinco quedan
// bajo el pliegue (medido en `docs/master/evidencias/SCRUM-917/salida-paso0-detalle-f.txt`). Aquí son
// cinco LÍNEAS dentro de una sola tarjeta, cerradas, cada una con su valor a la derecha para que no
// haga falta abrirlas para saber qué hay dentro. Es el mismo patrón que el fundador aprobó en el
// editor de presupuesto (SCRUM-915 v3) y en el prototipo de SCRUM-917 (`docs/prototipos/SCRUM-917/`).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ES UN MÓDULO Y NO CÓDIGO DENTRO DE LA VISTA
//
// Lo que dice cada línea cerrada es una DECISIÓN —«No tienes equipo» y «Sin asignar» no son lo
// mismo, y «Sin gastos» no es «no se han podido leer los gastos»— y una decisión que vive dentro de
// una vista de 3.000 líneas sólo se puede probar montando un navegador. Aquí son funciones que
// devuelven texto: su test las corre con datos y no hay forma de que la pantalla diga otra cosa.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⛔ MICROCOPY: NI UNA PALABRA NUEVA SIN FIRMA (regla 30)
//
// Todos los literales de abajo están firmados: el com. 15881 de SCRUM-917 firma «El trabajo»,
// «Nombre y dirección», «Quién lo ejecuta», «Sin nombre», «Sin gastos», «No tienes equipo», los dos
// marcadores, la explicación del nombre y «Dar de alta a alguien»; «Sin asignar», «Solo tú las ves»
// y los rótulos de las líneas ya existían en el producto; y el com. 16142 firma «1 gasto» /
// «N gastos» para la línea de gastos cuando los hay. Ficha en `docs/microcopy/`.
//
// Lo que NO se firmó y por eso NO está: una suma de importes en la línea de gastos (SCRUM-370 y
// SCRUM-403: sin totales, y no consta si el importe guardado es base o con IVA).
const TEXTOS_EL_TRABAJO = {
  titulo: 'El trabajo',
  // Los rótulos de las líneas. Tres de ellos ya existían como títulos de sección.
  rotuloTipo: 'Tipo de trabajo',
  rotuloDatos: 'Nombre y dirección',
  rotuloQuien: 'Quién lo ejecuta',
  rotuloNotas: 'Notas internas',
  rotuloGastos: 'Gastos de este trabajo',
  // Lo que dice cada línea CERRADA.
  sinNombre: 'Sin nombre',
  sinAsignar: 'Sin asignar',
  sinEquipo: 'No tienes equipo',
  notasPrivadas: 'Solo tú las ves',
  sinGastos: 'Sin gastos',
  unGasto: '1 gasto',
  // Lo que dicen los campos de dentro.
  marcadorNombre: 'Por ejemplo: cambio de cuadro en el 3º B',
  ayudaNombre: 'El nombre es lo que verás en la lista. Si lo dejas vacío, se usa el del cliente.',
  marcadorNotas: 'Lo que necesites recordar de este trabajo.',
  altaEquipo: 'Dar de alta a alguien',
};

/** «N gastos», N ≥ 2. El singular y el vacío tienen su propio literal. */
function textoVariosGastos(n) {
  return n + ' gastos';
}

/** Lo que dice la línea «Nombre y dirección» cerrada: el nombre del trabajo, o «Sin nombre». */
function resumenDeNombre(nombre) {
  const n = nombre == null ? '' : String(nombre).trim();
  return n || TEXTOS_EL_TRABAJO.sinNombre;
}

/**
 * Lo que dice la línea «Quién lo ejecuta» cerrada.
 *
 * 🔴 TRES COSAS QUE NO SE MEZCLAN:
 *   · hay nombres         → los nombres, tal y como se leen en el parte de papel;
 *   · no hay, y SE SABE que no hay a quién asignar (`sinEquipo`) → «No tienes equipo»;
 *   · no hay, y sí hay equipo (o no se sabe) → «Sin asignar».
 * «Sin equipo» sólo se dice cuando se LEYÓ el equipo y estaba vacío de gente asignable: decirlo por
 * defecto sería afirmar lo que no se sabe (SCRUM-650: un cero de equipo es «no he leído nada»).
 */
function resumenDeQuien(o) {
  const op = o || {};
  const nombres = typeof op.nombres === 'string' ? op.nombres.trim() : '';
  if (nombres) return nombres;
  return op.sinEquipo === true ? TEXTOS_EL_TRABAJO.sinEquipo : TEXTOS_EL_TRABAJO.sinAsignar;
}

/**
 * Lo que dice la línea «Gastos de este trabajo» cerrada.
 *
 * Devuelve cadena vacía —no «Sin gastos»— si `n` no es un número: una lista que no se pudo leer y
 * una lista vacía se leen IGUAL en pantalla, y una de las dos manda al profesional a meter otra vez
 * un gasto que ya está guardado (SCRUM-370). Sin dato, la línea no dice nada.
 */
function resumenDeGastos(n) {
  if (typeof n !== 'number' || !isFinite(n) || n < 0) return '';
  if (n === 0) return TEXTOS_EL_TRABAJO.sinGastos;
  if (n === 1) return TEXTOS_EL_TRABAJO.unGasto;
  return textoVariosGastos(n);
}

/**
 * UNA LÍNEA PLEGABLE: `<details>` nativo, así que se abre y se cierra con teclado y con lector de
 * pantalla sin JS de posicionamiento, y NINGÚN nodo se mueve al abrir (un campo cerrado sigue
 * existiendo y sigue enviándose).
 *
 * @param doc  `document` (o el de juguete del test)
 * @param o    { clave, rotulo, valor }
 * @returns    { elemento, cuerpo, poner(texto), cerrar(), sinCuerpo() }
 */
function construirLineaPlegable(doc, o) {
  const op = o || {};
  const det = doc.createElement('details');
  det.className = 'detail-plega';
  det.dataset.linea = String(op.clave || '');

  const cab = doc.createElement('summary');
  cab.className = 'detail-plega-cab';
  const rotulo = doc.createElement('span');
  rotulo.className = 'detail-plega-rotulo';
  // El id deja que el campo de dentro se nombre con el rótulo de su línea (`aria-labelledby`) sin
  // repetir el texto: dos copias del mismo rótulo son dos fuentes que se separan.
  rotulo.id = 'job-plega-rotulo-' + String(op.clave || '');
  rotulo.textContent = String(op.rotulo || '');
  const valor = doc.createElement('span');
  valor.className = 'detail-plega-valor';
  valor.textContent = op.valor == null ? '' : String(op.valor);
  cab.appendChild(rotulo);
  cab.appendChild(valor);
  det.appendChild(cab);

  const cuerpo = doc.createElement('div');
  cuerpo.className = 'detail-plega-cuerpo';
  det.appendChild(cuerpo);

  return {
    elemento: det,
    cuerpo: cuerpo,
    rotulo: rotulo,
    valor: valor,
    /** Cambia lo que dice la línea cerrada. */
    poner: function (texto) { valor.textContent = texto == null ? '' : String(texto); },
    /** Vuelve a plegar: tras guardar un cambio, la línea enseña el valor nuevo y se recoge. */
    cerrar: function () { det.open = false; },
    /**
     * La línea se queda SIN NADA que abrir (p. ej. no se pudo leer el equipo). Un control que no se
     * puede usar y no puede explicar por qué no se deshabilita: se quita. La línea sigue diciendo su
     * valor, pero deja de ser un control — sin galón, sin foco y sin abrirse.
     */
    sinCuerpo: function () {
      det.classList.add('detail-plega--fija');
      cab.tabIndex = -1;
      cab.addEventListener('click', function (e) { e.preventDefault(); });
      cuerpo.remove();
    },
  };
}

/**
 * LA TARJETA «EL TRABAJO»: su título y las líneas, en el orden que se le pasa. Devuelve el nodo,
 * que la vista cuelga UNA vez.
 */
function construirBloqueElTrabajo(doc, lineas) {
  const sec = doc.createElement('div');
  sec.className = 'detail-section detail-trabajo';
  sec.dataset.seccion = 'el-trabajo';
  const h = doc.createElement('h3');
  h.className = 'detail-section-title';
  h.textContent = TEXTOS_EL_TRABAJO.titulo;
  sec.appendChild(h);
  (Array.isArray(lineas) ? lineas : []).forEach(function (l) { if (l && l.elemento) sec.appendChild(l.elemento); });
  return sec;
}

if (typeof window !== 'undefined') {
  window.TEXTOS_EL_TRABAJO = TEXTOS_EL_TRABAJO;
  window.resumenDeNombre = resumenDeNombre;
  window.resumenDeQuien = resumenDeQuien;
  window.resumenDeGastos = resumenDeGastos;
  window.construirLineaPlegable = construirLineaPlegable;
  window.construirBloqueElTrabajo = construirBloqueElTrabajo;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TEXTOS_EL_TRABAJO, resumenDeNombre, resumenDeQuien, resumenDeGastos,
    construirLineaPlegable, construirBloqueElTrabajo,
  };
}
