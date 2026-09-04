/**
 * public/dashboard/js/quoteCaducidad.js — SCRUM-633
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EL DÍA NATURAL EN LA ZONA DEL MERCHANT — la mitad de navegador.
 *
 * La caducidad de un presupuesto se decidía con `toISOString().slice(0, 10)`, que da el día en
 * **UTC**. Medido sobre 2026 con dos métodos independientes, para un profesional en Madrid:
 *
 *     a las 09:00 y 12:00 →   0 de 365 días salen mal
 *     a las 23:30         →  30 de 365   (los +30 días son 24 h fijas: en la ventana del
 *                                         cambio de hora la hora local se desplaza)
 *     a la  01:00         → 210 de 365   (sólo en verano, cuando Madrid es UTC+2)
 *     a las 00:30         → 335 de 365
 *
 * 🔴 NO ES «EL CAMBIO DE HORA». Quien lea eso buscará dos días al año y no encontrará nada. Es
 * que UTC y la hora local son dos calendarios distintos casi todas las noches.
 *
 * ── POR QUÉ LA ZONA DEL MERCHANT Y NO LA DEL NAVEGADOR ─────────────────────────────────────
 *
 * `zonaDelMerchant.ts` lo deja escrito para el mes fiscal y vale igual aquí: *«el error no fue
 * elegir la hora local: fue suponer que "local" sería un solo sitio»*. La zona del NAVEGADOR
 * repite ese defecto un piso más abajo — un empleado que viaja vería una caducidad distinta de
 * la que rige el presupuesto. **La fecha de validez es del NEGOCIO, no del dispositivo que la
 * mira.**
 *
 * ── 🔴 ESTO ES UNA COPIA DECLARADA DE `diaNaturalEn` (core/zonaDelMerchant.ts) ──────────────
 *
 * El escalón bueno es: **hacerlo imposible → derivar → duplicar con guard → duplicar con
 * comentario**. Aquí el 1 y el 2 **no existen**: el sitio único es TypeScript que se compila a
 * `dist/` para Node, y esta pantalla es JavaScript de navegador servido tal cual, sin bundler —
 * regla dura de la casa (frontend vanilla, sin build). No hay forma de que el navegador ejecute
 * aquel módulo ni de derivar esta salida de aquella llamada.
 *
 * **Se cae al escalón 3 por IMPOSIBILIDAD MEDIDA, no por comodidad.** Y el guard que las ata es
 * **por COMPORTAMIENTO**, no por texto: `tests/scrum633-caducidad-en-la-zona.test.mjs` corre las
 * dos sobre la MISMA tabla de casos —instantes, zonas y cambios de hora— y exige la misma
 * salida. Un guard de texto habría nacido mudo, que es como han nacido tres trinquetes esta
 * semana.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  /** Igual que `ZONA_POR_DEFECTO` del backend: UTC, y es una constante DECLARADA. */
  var ZONA_POR_DEFECTO = 'UTC';

  /** ¿`Intl` reconoce esta zona? Se pregunta al motor, no a una lista a mano que se desfasaría. */
  function zonaValida(zona) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zona });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * La zona de un merchant, con la MISMA regla que el backend: sin declarar o ilegible → UTC.
   *
   * ⚠️ UTC **coincide** con la zona del contenedor, pero NO se deriva de ella: es la decisión A
   * del fundador (2-sep-2026) —«exactamente lo que el sistema hacía antes de existir la
   * columna»—, para que un merchant que no ha declarado nada no vea un cambio que no ha pedido.
   * Caer a `Europe/Madrid` declararía peninsular a un canario, y Canarias es mercado.
   */
  function zonaDelMerchant(merchant) {
    var declarada = merchant && merchant.timezone;
    if (typeof declarada !== 'string' || declarada.trim() === '') return ZONA_POR_DEFECTO;
    var z = declarada.trim();
    return zonaValida(z) ? z : ZONA_POR_DEFECTO;
  }

  var FORMATEADORES = {};
  function formateador(zona) {
    if (!FORMATEADORES[zona]) {
      // `sv-SE` da `YYYY-MM-DD` sin tener que recomponer las partes: mismo día natural que
      // calcula `diaNaturalEn` con `formatToParts`, por otro camino igual de explícito.
      FORMATEADORES[zona] = new Intl.DateTimeFormat('sv-SE', {
        timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
      });
    }
    return FORMATEADORES[zona];
  }

  /** El día natural (`YYYY-MM-DD`) al que pertenece un instante EN esa zona. */
  function diaNaturalEn(instante, zona) {
    var z = zonaValida(zona) ? zona : ZONA_POR_DEFECTO;
    return formateador(z).format(instante instanceof Date ? instante : new Date(instante));
  }

  /**
   * El día por DEFECTO de la caducidad: hoy + `dias`, en la zona del merchant.
   *
   * Los 30 días se suman en MILISEGUNDOS —24 h fijas—, igual que hacía el código de antes y
   * igual que hace el servidor en su respaldo (`quotes.routes.ts`). Cambiar eso movería la
   * caducidad de todos los presupuestos, y este ticket es sobre **cómo se escribe el día**, no
   * sobre cuánto dura un presupuesto.
   */
  function diaPorDefecto(merchant, dias, ahora) {
    var base = (ahora instanceof Date ? ahora : new Date()).getTime();
    return diaNaturalEn(new Date(base + dias * 86400000), zonaDelMerchant(merchant));
  }

  var api = {
    ZONA_POR_DEFECTO: ZONA_POR_DEFECTO,
    zonaValida: zonaValida,
    zonaDelMerchant: zonaDelMerchant,
    diaNaturalEn: diaNaturalEn,
    diaPorDefecto: diaPorDefecto,
  };

  root.quoteCaducidad = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
