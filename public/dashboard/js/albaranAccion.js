// public/dashboard/js/albaranAccion.js — SCRUM-831
//
// EL SIGUIENTE PASO DE UN ALBARÁN, EN UN SOLO SITIO Y ALCANZABLE POR LAS TRES SUPERFICIES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE — ES LA TERCERA VEZ QUE ESTA CASA TROPIEZA CON LO MISMO
//
// SCRUM-366 sacó `jobNextAction` de dentro de `jobDetailView.js` porque la lista de Trabajos no
// podía nombrarla. SCRUM-823 sacó `abrirAgendarTrabajo` de dentro de `jobsView.js` porque el
// detalle no podía nombrarla. Y aquí `primariaDeAlbaran` vivía dentro de `jobDetailView.js`,
// así que **la lista de Albaranes no podía preguntarle cuál es el siguiente paso de un albarán**
// — y por eso era la única de las cinco listas de la casa con CERO acciones en la fila.
//
// 🔒 Una función correcta que la otra pantalla no puede nombrar acaba en una de dos: o se
// reescribe peor, o no se usa. Aquí pasó lo segundo.
//
// ⚠️ ESTO ES UN TRASLADO, NO UN REDISEÑO. Las dos funciones se mueven VERBATIM: mismo criterio,
// mismas condiciones, mismo `null` cuando no hay siguiente paso. Quien decide sigue siendo
// `ALBARAN_ACTION_REGISTRY` (SCRUM-302) con `destinoEfectivo` (`patronDetalleAcciones.js`); aquí
// no se declara ni una acción.
//
// ── Y NO SE PARECE A LA ESCALERA DE TRABAJOS, a propósito ────────────────────────────────────
// La de Trabajos es una FUNCIÓN que calcula el siguiente paso a partir de otros documentos, del
// dinero y del estado. La de un albarán es una TABLA POR ESTADO, porque su siguiente paso lo
// decide él mismo: `borrador → Emitir`, `emitido → Enviar para firmar`, `firmado → facturar` (y
// esta última sí es contextual). Copiar la forma de Trabajos habría metido una escalera de seis
// peldaños donde el trabajo real tiene tres. Se comparte la LECCIÓN —una sola fuente, alcanzable—
// no la forma.
//
// Depende de `window.ALBARAN_ACTION_REGISTRY` y `window.destinoEfectivo`, así que este script
// CARGA DESPUÉS de `albaranActionsRegistry.js` y de `patronDetalleAcciones.js`, y ANTES de las
// vistas que lo consumen.

/**
 * El CONTEXTO de las primarias contextuales de `firmado`. Tres valores, no un booleano: en una
 * obra por fases `parcial` es lo normal, y aplanarlo escondería que AÚN QUEDA algo que facturar.
 *
 * 🔴 LOS TRES CAMPOS TIENEN QUE LLEGAR, y esto es lo que hacía falta arreglar en el servidor: la
 * lista de Albaranes mandaba `estado` y `estadoFacturacion` pero **no** `modoValoracion` ni
 * `quote`. Sin ellos las dos condiciones dan `false` —`undefined === 'VALORADO'` es `false`— y un
 * albarán `firmado` se quedaba sin primaria **por falta de dato, no por no tener siguiente paso**.
 * Los dos significan «no pintes nada» y son cosas distintas: es el defecto de SCRUM-816 otra vez.
 */
function ctxAlbaranDeFila(alb) {
  return {
    'valorado-con-pendiente': alb.modoValoracion === 'VALORADO' && alb.estadoFacturacion !== 'facturado',
    // La otra mitad, EXCLUYENTE con la de arriba (SCRUM-290): el parte SIN precios se factura
    // contra el presupuesto firmado. Sin presupuesto detrás el endpoint responde 409, así que
    // ofrecerlo sería un botón que sólo sabe fallar.
    'sin-valorar-convertible': alb.modoValoracion !== 'VALORADO' && !!alb.quote && alb.estadoFacturacion !== 'facturado',
  };
}

/**
 * La acción primaria de este albarán según el registro de SCRUM-302, o `null` si su estado no
 * tiene siguiente paso.
 *
 * ⚠️ `null` ES INFORMACIÓN: en `firmado` sin nada pendiente no hay paso siguiente, y la celda
 * vacía SIGNIFICA «nada que hacer». Rellenarla para que la columna «se vea completa» sería
 * inventar un paso que no toca.
 */
function primariaDeAlbaran(alb) {
  const registro = (typeof window !== 'undefined' && window.ALBARAN_ACTION_REGISTRY) || [];
  const ctx = ctxAlbaranDeFila(alb);
  if (typeof window === 'undefined' || typeof window.destinoEfectivo !== 'function') return null;
  return registro.find((a) => window.destinoEfectivo(a, alb.estado, ctx) === 'primaria') || null;
}

// Sin módulos (regla 4: vanilla, sin bundler): al global, para que las TRES superficies lo
// alcancen — la lista de Albaranes, la ficha del Trabajo y el detalle del albarán.
if (typeof window !== 'undefined') {
  window.ctxAlbaranDeFila = ctxAlbaranDeFila;
  window.primariaDeAlbaran = primariaDeAlbaran;
}
