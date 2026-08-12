// public/dashboard/js/selectorMetodoCobro.js — SCRUM-441
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SELECTOR DE MÉTODO AL MARCAR UNA FACTURA COBRADA A MANO — UNA SOLA PIEZA
//
// El gesto de «marcar cobrada a mano» vive en VARIOS sitios del dashboard (medido: detalle de
// factura, detalle de presupuesto y detalle de Trabajo). Si cada uno pintara su propio desplegable,
// tendríamos tres listas de métodos donde hoy hay una — que es exactamente la enfermedad que
// SCRUM-474 arrancó de `cobrosView.js` y que este módulo existe para no repetir.
//
// 🔴 LAS OPCIONES NO SE ESCRIBEN AQUÍ. Llegan derivadas de `PAID_VIA` desde el servidor, en el
// ARRANQUE (`/admin/me` → `window.appMetodosDeclarables`). Este fichero pinta y lee; no decide qué
// métodos existen, porque el front no puede decidir nada del conjunto cerrado (regla 22).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «SIN ESPECIFICAR» ES LA OPCIÓN POR DEFECTO, Y NO ESCRIBE NADA
//
// Es la mitad importante de este cambio. El profesional que hoy marca una factura como cobrada y
// se va **tiene que poder seguir haciendo exactamente eso**: un campo nuevo que obliga a contestar
// convierte un gesto de un toque en uno de dos, y en la pantalla del dinero eso se nota.
//
// Por eso «sin especificar» va primero, viene seleccionada, y `metodoElegido()` devuelve `null`:
// el cuerpo de la petición sale SIN `paidVia` y la columna **no se toca**. `null` en la base
// significa «no consta», que es la verdad de quien no dijo nada — y no es lo mismo que
// «desconocido», que sería haber preguntado y no saberlo.
(function () {
  var TEXTO_SIN_ESPECIFICAR = 'Sin especificar';

  /** Las opciones servidas. Vacío = no llegaron: entonces no se pinta nada (ver abajo). */
  function opciones() {
    return Array.isArray(window.appMetodosDeclarables) ? window.appMetodosDeclarables : [];
  }

  /**
   * Pinta el selector dentro de `contenedor` y devuelve el `<select>`, o `null` si no hay opciones.
   *
   * Devolver `null` no es un fallo: es lo correcto. Sin opciones servidas, pintar un desplegable
   * vacío —o peor, uno con una lista de repuesto escrita aquí— sería ofrecerle al profesional algo
   * que el servidor no ha confirmado. Sin selector, la pantalla se comporta como antes de existir.
   */
  function pintarSelectorMetodo(contenedor, opts) {
    var lista = opciones();
    if (!contenedor || !lista.length) return null;
    var o = opts || {};

    var envoltorio = document.createElement('div');
    envoltorio.className = 'form-group';

    var etiqueta = document.createElement('label');
    etiqueta.textContent = o.etiqueta || '¿Cómo lo has cobrado?';
    etiqueta.htmlFor = o.id || 'metodo-cobro';
    envoltorio.appendChild(etiqueta);

    var sel = document.createElement('select');
    sel.id = o.id || 'metodo-cobro';
    sel.className = 'form-control';
    sel.dataset.selectorMetodo = '1';
    sel.style.minHeight = '44px'; // AB6

    // «Sin especificar» la PRIMERA y con valor vacío: es lo que sale seleccionado, así que el
    // comportamiento por defecto es el de siempre.
    var vacia = document.createElement('option');
    vacia.value = '';
    vacia.textContent = TEXTO_SIN_ESPECIFICAR;
    sel.appendChild(vacia);

    lista.forEach(function (m) {
      var op = document.createElement('option');
      op.value = m.valor;
      op.textContent = m.rotulo;
      sel.appendChild(op);
    });

    envoltorio.appendChild(sel);
    contenedor.appendChild(envoltorio);
    return sel;
  }

  /**
   * Qué método eligió, o `null` si «sin especificar».
   *
   * `null` es la señal de NO MANDAR el campo. No se devuelve `''` ni `'desconocido'`: lo primero
   * viajaría como un valor vacío y lo segundo AFIRMARÍA que se preguntó y no se sabe.
   */
  function metodoElegido(sel) {
    if (!sel || !sel.value) return null;
    var v = String(sel.value).trim();
    return v === '' ? null : v;
  }

  /**
   * El cuerpo de la petición, con el método SOLO si lo hay.
   *
   * Se centraliza aquí para que ningún llamador tenga que acordarse: si mandara `paidVia: null` o
   * `paidVia: ''`, el dominio lo descartaría igual —falla cerrado— pero la petición estaría
   * diciendo algo que el profesional no dijo.
   */
  function cuerpoConMetodo(base, sel) {
    var cuerpo = Object.assign({}, base || {});
    var m = metodoElegido(sel);
    if (m) cuerpo.paidVia = m;
    return cuerpo;
  }

  window.pintarSelectorMetodo = pintarSelectorMetodo;
  window.metodoElegido = metodoElegido;
  window.cuerpoConMetodo = cuerpoConMetodo;
  window.SELECTOR_METODO_SIN_ESPECIFICAR = TEXTO_SIN_ESPECIFICAR;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pintarSelectorMetodo, metodoElegido, cuerpoConMetodo, TEXTO_SIN_ESPECIFICAR };
  }
})();
