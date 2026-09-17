// public/dashboard/js/arranqueSinCobertura.js — SCRUM-918 · ARRANCAR SIN RED NO ES «SESIÓN CADUCADA».
//
// Medido en staging el 17-sep-2026 (Sesión 0 y Sesión 2, corte real): sin red, RECARGAR o REABRIR la
// app acababa en la pantalla de error de Chrome. `app.js` mandaba a /login.html ante CUALQUIER fallo
// de GET /admin/me —también «sin red»— y /login.html no está en el service worker. Con eso, un albarán
// ya descargado para firmar en el sótano no se podía ni abrir.
//
// DECIDIDO (SCRUM-918): sin red la app abre con lo que tiene en local y avisa. Solo manda al login una
// RESPUESTA del servidor: si el servidor contesta, /login.html también carga.
//
// Aquí solo vive la DECISIÓN y la copia local de la sesión, sin DOM: se ejecutan en `npm test`.

/** La copia de la última respuesta buena de /admin/me. Registrada en `CLAVES_LOCALES` y se PURGA. */
var CLAVE_SESION_SIN_COBERTURA = 'yaqu_sesion_sin_cobertura';

/**
 * ⚠️ LITERAL PROPUESTO, PENDIENTE DE FIRMA (regla 30). Lo lee el profesional arriba de la app cuando
 * ha arrancado sin red.
 */
var AVISO_SIN_COBERTURA = 'Sin cobertura. Ves lo que ya tenías en el móvil; lo demás se cargará cuando vuelva la conexión.';

/** Una copia sirve si es un objeto con negocio. Lo demás es basura o una versión que no conocemos. */
function copiaDeSesionValida(copia) {
  return copia && typeof copia === 'object' && copia.merchantId != null ? copia : null;
}

/**
 * Qué hacer cuando GET /admin/me ha fallado.
 *
 *   · fallo SIN RED (`error.sinRed === true`, lo marca `_pedir` en api.js) → `sin-cobertura`, con la
 *     copia local si la hay (`me` null si no: se avisa igual, pero no hay con qué pintar la app);
 *   · cualquier RESPUESTA del servidor (401, 500…) → `login`, como siempre.
 *
 * @returns {{destino: 'login'} | {destino: 'sin-cobertura', me: object|null}}
 */
function decidirArranque(error, copiaGuardada) {
  if (!error || error.sinRed !== true) return { destino: 'login' };
  return { destino: 'sin-cobertura', me: copiaDeSesionValida(copiaGuardada) };
}

/** Guarda la copia. Un almacén lleno o bloqueado no puede tumbar un arranque que ya ha ido bien. */
function guardarCopiaDeSesion(almacen, me) {
  try {
    if (almacen && copiaDeSesionValida(me)) almacen.setItem(CLAVE_SESION_SIN_COBERTURA, JSON.stringify(me));
  } catch (_e) { /* sin almacén no hay copia: sin red se avisará sin app */ }
}

/** Lee la copia; ilegible o ausente es `null`, nunca una sesión inventada. */
function leerCopiaDeSesion(almacen) {
  try {
    if (!almacen) return null;
    const crudo = almacen.getItem(CLAVE_SESION_SIN_COBERTURA);
    return crudo ? copiaDeSesionValida(JSON.parse(crudo)) : null;
  } catch (_e) {
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.CLAVE_SESION_SIN_COBERTURA = CLAVE_SESION_SIN_COBERTURA;
  window.AVISO_SIN_COBERTURA = AVISO_SIN_COBERTURA;
  window.decidirArranque = decidirArranque;
  window.guardarCopiaDeSesion = guardarCopiaDeSesion;
  window.leerCopiaDeSesion = leerCopiaDeSesion;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CLAVE_SESION_SIN_COBERTURA, AVISO_SIN_COBERTURA,
    copiaDeSesionValida, decidirArranque, guardarCopiaDeSesion, leerCopiaDeSesion,
  };
}
