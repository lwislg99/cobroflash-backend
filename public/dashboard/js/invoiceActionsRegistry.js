// public/dashboard/js/invoiceActionsRegistry.js — SCRUM-283 (B2)
//
// EL REGISTRO DECLARATIVO de la LEY del patrón de detalle, aplicada a FACTURA. Es la fuente única:
// la vista PINTA desde aquí y el guard VERIFICA contra aquí. Nadie escribe la tabla dos veces.
//
// Cada acción declara su DESTINO en cada uno de los cuatro estados reales de una factura:
//   primaria       — el siguiente paso (regla 1). EXACTAMENTE UNA por estado (o ninguna).
//   secundaria     — máximo DOS por estado (regla 2).
//   overflow       — el «⋮» (regla 3).
//   seccion-propia — fuera del «⋮», en su bloque con explicación. Excepción de la regla 5 para
//                    actos fiscales irreversibles (solo ANULAR). DESTINO VÁLIDO, no huérfano: el
//                    guard tiene que conocerlo o daría rojo en falso el primer día, y un guard que
//                    da rojo en falso es un guard que alguien silencia.
//   oculta         — no se pinta en ese estado.
//
// LA PRIMARIA DE `pending` ES UN SLOT CON DOS OCUPANTES, uno según el contexto (regla 1: el
// siguiente paso ES distinto según haya un cobro en vuelo o no). No se funden — fundirlas haría
// desaparecer una, que es el fallo mudo que el guard existe para cazar:
//   `cuando: 'bizum-disponible'`     → btnBizum       («el Bizum que esperaba ha llegado»)
//   `cuando: 'bizum-no-disponible'`  → btnTogglePaid  («me han pagado, márcalo»)
//
// 🔴 SCRUM-402 · POR QUÉ EL PREDICADO YA NO ES `con-chargeId`/`sin-chargeId`. Lo era, y con la
// bandera `BIZUM_MANUAL_ENABLED` en `false` eso pintaba `btnBizum` como PRIMARIA de una factura
// `pending` con cobro en vuelo — una acción que al segundo toque devuelve 409 `bizum_disabled`.
// El dato (`hay cobro`) no bastaba: hace falta además que la vía PUEDA funcionar.
//
// Los dos predicados son COMPLEMENTARIOS —`bizum-no-disponible` es la negación exacta de
// `bizum-disponible`— y eso es lo que garantiza que la ranura **nunca quede vacía**: con Bizum
// apagado la primaria pasa a `btnTogglePaid`, que es el mismo ocupante que ya tenía el caso sin
// cobro en vuelo. Se elige ÉSE y no otro porque **funciona y su texto ya está aprobado**: no
// genera microcopy nueva (regla 30).
//
// ⚠️ `btnTogglePaid` NO escribe `paid_via` — no toca `Charge` en absoluto (medido: escribe solo
// `Invoice.status` y `paidAt`, `invoiceAdmin.ts:144`). O sea que NO manda al usuario por el mismo
// camino apagado con otro botón. Lo que sí deja es un hueco declarado: la factura queda `paid` y
// el cobro se queda como estaba, sin vía. Es otro asunto y no se arregla aquí.
//
// Los IDENTIFICADORES son los de los botones de invoiceDetailView.js (el censo los deriva del AST).
// Los RÓTULOS no viven aquí: son microcopy sin aprobar y se pintan con el marcador [PENDIENTE
// microcopy oficial] (regla 30). ANULAR es la excepción: su código y su rótulo NO se tocan.

const INVOICE_ACTION_REGISTRY = [
  // id              pending          paid            annulled     R1           (contexto)
  { id: 'btnPdf',        destinos: { pending: 'secundaria',     paid: 'secundaria', annulled: 'secundaria', R1: 'secundaria' } },
  { id: 'btnWhatsApp',   destinos: { pending: 'secundaria',     paid: 'secundaria', annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnTogglePaid', destinos: { pending: 'primaria',       paid: 'overflow',   annulled: 'oculta',     R1: 'oculta' }, cuando: 'bizum-no-disponible' },
  { id: 'btnBizum',      destinos: { pending: 'primaria',       paid: 'oculta',     annulled: 'oculta',     R1: 'oculta' }, cuando: 'bizum-disponible' },
  { id: 'btnReminder',   destinos: { pending: 'overflow',       paid: 'oculta',     annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnRectify',    destinos: { pending: 'overflow',       paid: 'overflow',   annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnRegen',      destinos: { pending: 'overflow',       paid: 'overflow',   annulled: 'overflow',   R1: 'overflow' } },
  { id: 'btnDispute',    destinos: { pending: 'overflow',       paid: 'overflow',   annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnAnular',     destinos: { pending: 'seccion-propia', paid: 'oculta',     annulled: 'oculta',     R1: 'oculta' } },
];

// Los cuatro estados reales de una factura (Parte L). NO hay «Borrador»: nace EMITIDA del accept
// del presupuesto. La factura suelta (y sus acciones Emitir/Modificar/Duplicar…) llega con SCRUM-289.
const INVOICE_STATES = ['pending', 'paid', 'annulled', 'R1'];

// SCRUM-302 (C2): el resolutor y el marcador son la LEY del patrón —no algo de la factura— y
// viven en `patronDetalleAcciones.js`, que el albarán usa igual.
//
// ⚠️ NO se re-declaran aquí, **ni siquiera como puente**: dos `const` con el mismo nombre en dos
// scripts clásicos del dashboard comparten ámbito léxico, y eso es **SyntaxError EN PARSEO** — el
// segundo fichero no se ejecuta entero y su pantalla desaparece sin 500 ni log en el servidor
// (pasó con `copyRojo`, SCRUM-210). El primer intento de C2 los puenteaba con un `const` y el
// guard de nombres duplicados lo cazó antes de salir. En el navegador ya son globales; en Node
// los toma el bloque de abajo.

// Doble vida: global para el <script> clásico del dashboard, y module.exports para que el guard lo
// IMPORTE en Node (una sola fuente; el guard no re-declara la tabla). `typeof` es seguro en ambos.
if (typeof window !== 'undefined') {
  window.INVOICE_ACTION_REGISTRY = INVOICE_ACTION_REGISTRY;
  window.INVOICE_STATES = INVOICE_STATES;
}
if (typeof module !== 'undefined' && module.exports) {
  // Los guards de B2 (SCRUM-283) importan `destinoEfectivo` y el marcador DESDE AQUÍ. Se
  // re-exportan tomándolos de la ley, para no obligarles a cambiar de sitio por un refactor
  // que no es suyo.
  const ley = require('./patronDetalleAcciones.js');
  module.exports = {
    INVOICE_ACTION_REGISTRY, INVOICE_STATES,
    MICROCOPY_PENDIENTE: ley.MICROCOPY_PENDIENTE,
    destinoEfectivo: ley.destinoEfectivo,
  };
}