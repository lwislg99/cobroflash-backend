// public/dashboard/js/patronDetalleAcciones.js — SCRUM-302 (C2)
//
// LA LEY DEL PATRÓN DE DETALLE, SIN DOCUMENTO. Extraída de `invoiceActionsRegistry.js` (SCRUM-283,
// B2) al abrir C2, y por un motivo que el propio encargo nombró: **si el albarán se llevaba su
// propia copia de la maquinaria, acabaríamos con dos registros del mismo hecho** — el defecto de
// las dos listas que esta casa lleva toda la semana pagando (`wipeDemo` 10 de 21,
// `ORDEN_BORRADO_MERCHANT`, las tres copias de la zona roja).
//
// Aquí vive lo que NO depende de si el documento es una factura o un albarán:
//   · los cinco DESTINOS posibles;
//   · las reglas que un registro tiene que cumplir (una primaria, dos secundarias);
//   · el marcador de microcopy sin aprobar;
//   · el resolutor de la primaria contextual.
//
// Lo que SÍ depende del documento —sus estados y su tabla— vive en el registro de cada uno:
// `invoiceActionsRegistry.js` y `albaranActionsRegistry.js`. Un documento nuevo declara su tabla;
// no vuelve a escribir la ley.

/** Los destinos que una acción puede tener en un estado. */
const DESTINOS = ['primaria', 'secundaria', 'overflow', 'seccion-propia', 'oculta'];

/** El rótulo de toda acción reorganizada, hasta que el fundador apruebe el microcopy (regla 30). */
const MICROCOPY_PENDIENTE = '[PENDIENTE microcopy oficial]';

/**
 * Destino EFECTIVO de una acción en un estado y contexto dados. Resuelve la primaria contextual:
 * si `cuando` no casa con el contexto, la acción no ocupa la primaria (queda oculta ese día).
 *
 * `cuando` es un predicado con nombre que el registro declara y el contexto responde. Se dejó
 * genérico al extraerlo: B2 lo usaba con `con-chargeId`/`sin-chargeId`, y el albarán necesita el
 * suyo (`valorado-sin-facturar`). Codificar los de la factura aquí habría hecho que la ley
 * conociera un documento — justo lo que este fichero viene a evitar.
 */
function destinoEfectivo(accion, estado, ctx) {
  const d = accion.destinos[estado];

  // 🔴 SCRUM-707 · UN ESTADO QUE LA TABLA NO CONTEMPLA SE OCULTA. Aquí se devolvía
  // `undefined`, y los dos consumidores hacen `cubos[destino].push(...)`: `cubos[undefined]` no
  // existe y revienta con un TypeError que se lleva el resto del pintado. Medido sobre el main
  // del 8-sep-2026: con `rectificada`, `draft` o `''` salen 9/9 y 11/11 destinos `undefined`.
  //
  // ⚠️ SE OCULTA, Y NO SE CAE A UN CUBO POR DEFECTO. Medido: un fallback OFRECERÍA las 9 acciones
  // de la factura donde el máximo vetado en un estado conocido es 6 — y entre las que reaparecen
  // está `btnAnular`, que está OCULTA EN LOS CUATRO estados conocidos. En el albarán, 11 sobre 6,
  // con `btnEmitir`, `btnEnviarFirmar` y `btnFirmarAqui` dentro.
  //
  // 🔒 Un fallback no es neutral: abre, en el estado que nadie ha vetado, justo las acciones que
  // alguien decidió ocultar en todos los que sí vetó. Anular una factura emitida es la regla 29;
  // firmar un albarán lo congela.
  //
  // `'oculta'` no es un valor inventado para la ocasión: es uno de los cinco DESTINOS, y los dos
  // consumidores ya lo tratan (`continue` en el albarán, `return` en la factura). No había que
  // enseñarles nada.
  if (d === undefined) return 'oculta';

  if (d !== 'primaria' || !accion.cuando) return d;
  const c = ctx || {};
  // Forma GENÉRICA: el registro nombra su condición y el contexto la responde.
  if (Object.prototype.hasOwnProperty.call(c, accion.cuando)) return c[accion.cuando] ? 'primaria' : 'oculta';
  // Compatibilidad con B2 (SCRUM-283), cuyo contexto es `{hayCharge}` y cuyas condiciones se
  // llaman `con-chargeId`/`sin-chargeId`. Se conserva aquí en vez de dejar allí un segundo
  // resolutor: dos resolutores de la misma ley es el defecto que este fichero viene a cerrar.
  if (accion.cuando === 'con-chargeId') return c.hayCharge ? 'primaria' : 'oculta';
  if (accion.cuando === 'sin-chargeId') return c.hayCharge ? 'oculta' : 'primaria';
  // Condición que nadie sabe responder: se OCULTA. Dejarla como primaria pintaría un siguiente
  // paso que quizá no toca, y el patrón entero se apoya en que la primaria sea de fiar.
  return 'oculta';
}

/**
 * ¿Conoce el registro este estado? DERIVADO de la tabla, no de una lista aparte.
 *
 * 🔴 ES LA DISTINCIÓN QUE HACE HONESTO EL AVISO. Sin ella, una factura `annulled` —que
 * legítimamente sólo ofrece dos acciones— y un estado que no sabemos leer se ven igual en
 * pantalla: las dos con pocos botones. Son dos hechos distintos y el profesional tiene derecho a
 * saber cuál le ha tocado.
 *
 * Se pregunta a las PROPIAS acciones y no a una constante de estados: una lista aparte sería la
 * quinta lista mantenida a mano de este árbol, y ya sabemos cómo acaban (SCRUM-821).
 */
function estadoReconocido(registro, estado) {
  return (registro || []).some((a) => a && a.destinos
    && Object.prototype.hasOwnProperty.call(a.destinos, estado));
}

/**
 * Comprueba que un registro cumple la ley, estado por estado. Devuelve la lista de
 * incumplimientos (vacía = correcto). PURO: lo usan la vista y el guard, y por eso ninguno de los
 * dos escribe las reglas por su cuenta.
 *
 * Las dos que se comprueban son las que se pueden comprobar sobre la tabla:
 *   1. como mucho UNA primaria por estado — dos primarias es no haber elegido el siguiente paso;
 *   2. como mucho DOS secundarias por estado.
 * La regla «el resto al ⋮» no se comprueba aquí porque es la consecuencia de las dos anteriores.
 */
function incumplimientosDeLaLey(registro, estados, ctx) {
  const fallos = [];
  for (const estado of estados) {
    const efectivos = registro.map((a) => destinoEfectivo(a, estado, ctx));
    for (const [i, d] of efectivos.entries()) {
      if (!DESTINOS.includes(d)) fallos.push(`${estado}: «${registro[i].id}» declara el destino desconocido «${d}»`);
    }
    const primarias = registro.filter((a, i) => efectivos[i] === 'primaria').map((a) => a.id);
    const secundarias = registro.filter((a, i) => efectivos[i] === 'secundaria').map((a) => a.id);
    if (primarias.length > 1) fallos.push(`${estado}: ${primarias.length} primarias (${primarias.join(', ')})`);
    if (secundarias.length > 2) fallos.push(`${estado}: ${secundarias.length} secundarias (${secundarias.join(', ')})`);
  }
  return fallos;
}

// Doble vida: global para el <script> clásico del dashboard, y module.exports para los guards.
if (typeof window !== 'undefined') {
  window.DESTINOS_PATRON = DESTINOS;
  window.MICROCOPY_PENDIENTE = MICROCOPY_PENDIENTE;
  window.destinoEfectivo = destinoEfectivo;
  window.estadoReconocido = estadoReconocido;
  window.incumplimientosDeLaLey = incumplimientosDeLaLey;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DESTINOS, MICROCOPY_PENDIENTE, destinoEfectivo, estadoReconocido, incumplimientosDeLaLey,
  };
}
