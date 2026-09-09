// public/dashboard/js/invoiceAccion.js — SCRUM-845
//
// QUÉ SE PUEDE HACER CON UNA FACTURA, EN UN SOLO SITIO Y ALCANZABLE POR LAS DOS PANTALLAS.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE — ES LA CUARTA VEZ DE LA MISMA FAMILIA, Y LA PRIMERA QUE ENCUENTRA UN INSTRUMENTO
//
// SCRUM-366 sacó `jobNextAction` de `jobDetailView.js`; SCRUM-823 sacó `abrirAgendar` de
// `jobsView.js`; SCRUM-831 sacó `primariaDeAlbaran` de `jobDetailView.js`. Las tres las encontró
// una persona mirando la pantalla. Ésta la encontró `npm run censo:decisiones-encerradas`
// (SCRUM-837), que la nombró con sus tres columnas: qué decide, dónde vive, y quién la necesita y
// no la tiene.
//
// Lo que decidía qué se puede hacer con una factura —el mapeo de estado, el contexto y la
// resolución contra `INVOICE_ACTION_REGISTRY`— vivía en **constantes locales dentro de
// `renderInvoiceDetailView`**. Eso está más encerrado que los tres casos anteriores: allí al menos
// había una función con nombre que mover; aquí no había ni eso.
//
// 🔒 Una decisión de producto no vive en una vista.
//
// ⚠️ ESTO ES UN TRASLADO, NO UN REDISEÑO. `estadoDeFactura` y `ctxAccionesFactura` se mueven
// VERBATIM desde `invoiceDetailView.js`: mismo mapeo, mismas condiciones, mismos nombres de clave.
// Quien decide sigue siendo `INVOICE_ACTION_REGISTRY` (SCRUM-283) resuelto con `destinoEfectivo`
// (`patronDetalleAcciones.js`); aquí no se declara ni una acción ni se cambia ni un destino.
//
// Depende de `window.INVOICE_ACTION_REGISTRY` y `window.destinoEfectivo`, así que este script CARGA
// DESPUÉS de `invoiceActionsRegistry.js` y de `patronDetalleAcciones.js`, y ANTES de las vistas.

/**
 * El estado de la factura **para el patrón de acciones** — que no es `invoice.status` a secas.
 *
 * VERBATIM de `invoiceDetailView.js`. Son los cuatro de la Parte L: `pending · paid · annulled ·
 * R1`. Y `R1` NO es un `status`: es el `type` de la rectificativa, columna distinta en el modelo.
 * Por eso manda primero. `expired` es un `pending` vencido y se trata como `pending`.
 */
function estadoDeFactura(invoice) {
  const st = String((invoice && invoice.status) || '').toLowerCase();
  return invoice && invoice.type === 'R1' ? 'R1'
    : (st === 'annulled' ? 'annulled' : (st === 'paid' ? 'paid' : 'pending'));
}

/**
 * El contexto de las acciones de factura. VERBATIM de `invoiceDetailView.js` (SCRUM-402).
 *
 * Los dos predicados de Bizum son COMPLEMENTARIOS por construcción —uno es la negación del otro—,
 * así que la ranura primaria nunca queda vacía.
 *
 * ⚠️ `appBizumManualEnabled` es una bandera de la SESIÓN, no del documento: en una pantalla donde
 * no esté cargada, `bizum-disponible` da `false` y la primaria cae en `btnTogglePaid`, que es el
 * comportamiento que ya tenía el caso sin pasarela. No inventa una acción: elige la otra declarada.
 */
function ctxAccionesFactura(invoice) {
  const hayCharge = !!(invoice && invoice.chargeId);
  const bizumDisponible = hayCharge && (typeof window !== 'undefined' && window.appBizumManualEnabled === true);
  return {
    hayCharge,
    'bizum-disponible': bizumDisponible,
    'bizum-no-disponible': !bizumDisponible,
  };
}

/**
 * El destino declarado de UNA acción sobre ESTA factura: `primaria` · `secundaria` · `overflow` ·
 * `seccion-propia` · `oculta`.
 *
 * Devuelve `'oculta'` para lo que no esté en el registro: lo que no está declarado no se pinta.
 */
function destinoDeAccionFactura(id, invoice) {
  const registro = (typeof window !== 'undefined' && window.INVOICE_ACTION_REGISTRY) || [];
  const accion = registro.find((a) => a.id === id);
  if (!accion || typeof window === 'undefined' || typeof window.destinoEfectivo !== 'function') return 'oculta';
  return window.destinoEfectivo(accion, estadoDeFactura(invoice), ctxAccionesFactura(invoice));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 Y UNA SEGUNDA PREGUNTA, QUE NO ES LA MISMA Y POR ESO NO SE RESPONDE CON EL REGISTRO
//
// El registro contesta «¿DÓNDE va el botón del interruptor en el DETALLE?». La lista necesita otra:
// «¿PUEDE esta fila pasar a pagada en el MARCADO EN LOTE?». Coinciden en `annulled` y NO coinciden
// en `paid` —el registro lo manda a `overflow` (visible) y el lote lo rechaza—, así que contestar
// la de la lista con el registro dejaría el defecto a medias.
//
// La respuesta buena existe y es del servidor: `puedeMarcarsePagadaEnLote` en
// `src/modules/system/invoiceAdmin.ts`, sobre `NO_SE_MARCAN_PAGADAS_EN_LOTE = ['paid','annulled']`
// (SCRUM-496, que cerró que una anulada volviera a salir cobrada). El panel es vanilla sin bundler
// (regla 4) y no puede importar TypeScript, así que aquí va un ESPEJO — y un espejo sin mecanismo
// es una copia que diverge el día que alguien toque el original.
//
// EL MECANISMO: `tests/scrum845-la-lista-pregunta-lo-que-el-servidor-contesta.test.mjs` importa la
// constante del servidor desde `dist/` y exige que sean el MISMO conjunto. Si alguien añade un
// estado allí y no aquí, sale rojo nombrando el que falta.
const FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE = ['paid', 'annulled'];

/**
 * ¿Puede esta factura pasar a `paid` por el marcado en lote? Espejo de `puedeMarcarsePagadaEnLote`.
 *
 * ⚠️ Mira `status`, NO el estado del patrón: una rectificativa nace con `status: 'paid'`, así que
 * queda fuera por su estado y no por su tipo. Preguntarlo por `estadoDeFactura` sería una segunda
 * regla con el mismo nombre — que es justo el defecto que este fichero viene a cerrar.
 */
function sePuedeMarcarPagadaEnLote(invoice) {
  const st = String((invoice && invoice.status) || '').toLowerCase();
  return !FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE.includes(st);
}

// Sin módulos (regla 4: vanilla, sin bundler): al global, para que las DOS pantallas lo alcancen —
// la lista de Facturas y el detalle de la factura.
if (typeof window !== 'undefined') {
  window.estadoDeFactura = estadoDeFactura;
  window.ctxAccionesFactura = ctxAccionesFactura;
  window.destinoDeAccionFactura = destinoDeAccionFactura;
  window.sePuedeMarcarPagadaEnLote = sePuedeMarcarPagadaEnLote;
  window.FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE = FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE;
}

// Para los tests, que corren en node sin navegador.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estadoDeFactura, ctxAccionesFactura, destinoDeAccionFactura,
    sePuedeMarcarPagadaEnLote, FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE,
  };
}
