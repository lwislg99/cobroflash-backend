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
  window.incumplimientosDeLaLey = incumplimientosDeLaLey;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DESTINOS, MICROCOPY_PENDIENTE, destinoEfectivo, incumplimientosDeLaLey };
}
