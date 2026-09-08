// public/dashboard/js/economiaVisible.js — SCRUM-597 (DOC-07) · P-DOC-3
//
// LA MISMA PREGUNTA QUE EL SERVIDOR, ESCRITA UNA VEZ PARA EL PANEL.
//
//   «Coste y margen los ven el PROPIETARIO y los ADMINS. Los técnicos NO.»
//   (P-DOC-3, fundador, 7-sep-2026)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUIEN DECIDE ES EL SERVIDOR. ESTO SÓLO EVITA UI HUÉRFANA
//
// La ocultación de verdad ya está hecha donde no se puede rodear: `core/visibilidadEconomica.ts`
// quita `cost` y `costeUnitario` de la respuesta, así que un técnico NO RECIBE el dato aunque
// esta pantalla se equivoque. Lo de aquí es lo otro que hay que hacer para no dejar la pantalla
// rota: sin esto, al técnico se le pintarían un campo «Coste» y un «Margen %» permanentemente
// vacíos que además, si los rellenara, el servidor ignoraría. Un control que no hace nada es
// peor que ninguno — es la norma de SCRUM-89.
//
// 🔴 Y POR ESO HAY UN GUARD QUE LOS COMPARA. Dos sitios respondiendo la misma pregunta es
// exactamente cómo acaban diciendo cosas distintas; `tests/scrum597-...` ejecuta ESTA función y
// la del servidor sobre la misma lista de roles y exige que coincidan en todos.
//
// FAIL-CLOSED, igual que el servidor: un rol que no se reconoce NO VE. Si mañana entra un tercer
// rol, hereda la ocultación y alguien tiene que venir a concedérsela con su motivo.

/**
 * ¿Este rol ve coste y margen?
 *
 * ⚠️ SE ACEPTA TAMBIÉN `operario`, y no es un rol de más: es como el panel llama al técnico en
 * pantalla (`teamView.js`), y el resto de vistas ya se defienden de los dos nombres
 * (`customersView.js:97`, `invoiceDetailView.js:624`, `quotesDetailView.js:610`). Aquí se hace lo
 * mismo por si algún día lo que llega es la etiqueta y no el valor del schema. Al ser una lista
 * BLANCA, incluirlos no hace falta para que queden fuera — quedan fuera solos —, pero el
 * comentario deja dicho que el caso se miró.
 */
function puedeVerEconomia(rol) {
  return rol === 'admin';
}

if (typeof window !== 'undefined') {
  window.puedeVerEconomia = puedeVerEconomia;
  /** Atajo para las vistas: pregunta por la sesión actual. */
  window.veoEconomia = function veoEconomia() {
    return puedeVerEconomia(window.appUserRole);
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { puedeVerEconomia };
}
