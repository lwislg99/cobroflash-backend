// public/dashboard/js/contacto.js — SCRUM-406
//
// LA DIRECCIÓN DE CONTACTO, UNA VEZ, PARA TODO EL DASHBOARD.
//
// Estaba escrita a mano en seis sitios y el comentario de `libroRegistroView.js` ya avisaba de la
// consecuencia: «el día que cambie hay que cambiarlo en todos, y el que se olvide deja un canal
// muerto sin que nadie se entere». Un canal de contacto muerto no da error — el profesional
// escribe y no llega, y desde dentro todo parece correcto.
//
// ⚠️ Las dos páginas legales (`privacidad.html`, `terminos.html`) siguen con el literal a mano, y es
// DELIBERADO: son HTML estático, y hacer que su vía de contacto dependa de que cargue un `.js`
// significaría que un fallo de JavaScript deja una página legal sin el dato que el RGPD exige. Lo
// que impide que diverjan es el guard de `tests/scrum406-escribenos.test.mjs`, que compara TODAS
// las apariciones del árbol contra este valor y contra `src/core/config/contacto.ts`.
(function () {
  window.CONTACTO_YAQU = 'hola@yaqu.app';
})();
