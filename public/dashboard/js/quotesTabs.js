// public/dashboard/js/quotesTabs.js — SCRUM-432 (B1 · incremento 3)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS PESTAÑAS DE PRESUPUESTOS: `Historial · Plantillas`
//
// Sale del diseño de B, §B1: «**Plantillas** deja de ser entrada de menú y pasa a **pestaña dentro
// de Presupuestos** (`Historial · Plantillas`). Se usa desde ahí y solo desde ahí». Era el último
// movimiento de B1 sin hacer, y SCRUM-420 lo dejó fuera a propósito: retirar la entrada antes de
// que existiera la pestaña habría dejado la vista `templates` **sin ningún camino**.
//
// ⚠️ NO ES UN COMPONENTE NUEVO (regla 4). Es el MISMO control segmentado que ya usan el filtro de
// Trabajos (`jobsView.js:59`) y los diez submenús de Configuración (`settingsView.js`, SCRUM-284):
// `btn-sm` + `btn-secondary` para la activa y `btn-ghost` para el resto, con sus 44 px de alto.
// Escribir un segundo mecanismo de pestañas sería tener dos formas de lo mismo en el mismo producto.
//
// ── POR QUÉ CAMBIAN DE VISTA Y NO DE `display` ────────────────────────────────────────────
// Cada pestaña navega por el router (`renderAppView`) en vez de esconder y enseñar dos árboles.
// Tres motivos medidos:
//   · las dos vistas ya existen, enteras y con su carga propia — fundirlas sería rehacerlas;
//   · el enlace directo sigue funcionando (`#templates` está en `HASH_VIEWS` de `app.js`), así que
//     un marcador guardado por el profesional no se rompe con este cambio;
//   · el router es quien sabe pintar el título de la pantalla, y así no hay dos sitios que decidan
//     en cuál estás.

/**
 * Las dos pestañas, en el orden del diseño. Rótulos APROBADOS: salen literales de §B1.
 *
 * 🔴 CADA UNA ABRE SU DESTINO CON UN LITERAL, y no es decoración: es la convención de la casa.
 * La primera versión hacía `renderAppView(p.vista)` desde el bucle —más corto, y parecía más
 * limpio— y con eso **el camino a Plantillas se volvió invisible**: las ~40 navegaciones del
 * dashboard usan `renderAppView('<vista>')` con literal, y el censo de SCRUM-433 lee justo eso
 * para saber quién abre cada pantalla. Su guard cantó `HAY VISTAS A LAS QUE NO LLEGA NADA:
 * templates` — y tenía razón por su propia regla: yo había retirado la entrada de la barra y
 * puesto a cambio un camino que ningún censo de la casa puede ver.
 *
 * No se arregla ampliando el censo ajeno para que entienda despachos dinámicos: eso lo obligaría
 * a aceptar cualquier variable y dejaría de distinguir un camino real de uno inventado. Se
 * arregla aquí, que es donde estaba la excepción.
 */
var PESTANAS_PRESUPUESTOS = [
  { vista: 'quotes-list', rotulo: 'Historial', abrir: function () { renderAppView('quotes-list'); } },
  { vista: 'templates', rotulo: 'Plantillas', abrir: function () { renderAppView('templates'); } },
];

/**
 * Pinta la tira de pestañas al principio de `container`.
 *
 * @param container  el contenedor de la vista
 * @param activa     la clave de vista que está abierta (`quotes-list` | `templates`)
 */
function renderPestanasPresupuestos(container, activa) {
  if (!container) return null;
  var nav = document.createElement('div');
  nav.className = 'quotes-tabs';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Presupuestos');
  nav.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px';

  PESTANAS_PRESUPUESTOS.forEach(function (p) {
    var esActiva = p.vista === activa;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-sm ' + (esActiva ? 'btn-secondary' : 'btn-ghost');
    b.textContent = p.rotulo;
    b.dataset.pestana = p.vista;
    b.style.minHeight = '44px'; // AB6: objetivo al pulgar (btn-sm se queda en 30)
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', esActiva ? 'true' : 'false');
    // La activa no navega: pulsarla recargaría la pantalla que ya estás mirando.
    if (!esActiva) {
      b.addEventListener('click', function () {
        if (window.renderAppView) p.abrir();
      });
    }
    nav.appendChild(b);
  });

  container.appendChild(nav);
  return nav;
}

if (typeof window !== 'undefined') {
  window.PESTANAS_PRESUPUESTOS = PESTANAS_PRESUPUESTOS;
  window.renderPestanasPresupuestos = renderPestanasPresupuestos;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PESTANAS_PRESUPUESTOS, renderPestanasPresupuestos };
}
