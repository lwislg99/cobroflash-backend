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
//   `cuando: 'con-chargeId'` → btnBizum   («el Bizum que esperaba ha llegado»)
//   `cuando: 'sin-chargeId'` → btnTogglePaid («me han pagado, márcalo»)
//
// Los IDENTIFICADORES son los de los botones de invoiceDetailView.js (el censo los deriva del AST).
// Los RÓTULOS no viven aquí: son microcopy sin aprobar y se pintan con el marcador [PENDIENTE
// microcopy oficial] (regla 30). ANULAR es la excepción: su código y su rótulo NO se tocan.

const INVOICE_ACTION_REGISTRY = [
  // id              pending          paid            annulled     R1           (contexto)
  { id: 'btnPdf',        destinos: { pending: 'secundaria',     paid: 'secundaria', annulled: 'secundaria', R1: 'secundaria' } },
  { id: 'btnWhatsApp',   destinos: { pending: 'secundaria',     paid: 'secundaria', annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnTogglePaid', destinos: { pending: 'primaria',       paid: 'overflow',   annulled: 'oculta',     R1: 'oculta' }, cuando: 'sin-chargeId' },
  { id: 'btnBizum',      destinos: { pending: 'primaria',       paid: 'oculta',     annulled: 'oculta',     R1: 'oculta' }, cuando: 'con-chargeId' },
  { id: 'btnReminder',   destinos: { pending: 'overflow',       paid: 'oculta',     annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnRectify',    destinos: { pending: 'overflow',       paid: 'overflow',   annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnRegen',      destinos: { pending: 'overflow',       paid: 'overflow',   annulled: 'overflow',   R1: 'overflow' } },
  { id: 'btnDispute',    destinos: { pending: 'overflow',       paid: 'overflow',   annulled: 'oculta',     R1: 'oculta' } },
  { id: 'btnAnular',     destinos: { pending: 'seccion-propia', paid: 'oculta',     annulled: 'oculta',     R1: 'oculta' } },
];

// Los cuatro estados reales de una factura (Parte L). NO hay «Borrador»: nace EMITIDA del accept
// del presupuesto. La factura suelta (y sus acciones Emitir/Modificar/Duplicar…) llega con SCRUM-289.
const INVOICE_STATES = ['pending', 'paid', 'annulled', 'R1'];

// El rótulo sale de la ley compartida (regla 30): un solo literal para todos los documentos.
const MICROCOPY_PENDIENTE = ((typeof module !== 'undefined' && module.exports)
  ? require('./patronDetalleAcciones.js')
  : window).MICROCOPY_PENDIENTE;

// SCRUM-302 (C2): el resolutor y el marcador YA NO viven aquí. Son la LEY del patrón, no algo de
// la factura, y el albarán los necesita igual: viven en `patronDetalleAcciones.js`. Aquí queda lo
// único que es de este documento — su tabla y sus estados.
const __ley = (typeof module !== 'undefined' && module.exports)
  ? require('./patronDetalleAcciones.js')
  : { destinoEfectivo: window.destinoEfectivo, MICROCOPY_PENDIENTE: window.MICROCOPY_PENDIENTE };
const destinoEfectivo = __ley.destinoEfectivo;

// Doble vida: global para el <script> clásico del dashboard, y module.exports para que el guard lo
// IMPORTE en Node (una sola fuente; el guard no re-declara la tabla). `typeof` es seguro en ambos.
if (typeof window !== 'undefined') {
  window.INVOICE_ACTION_REGISTRY = INVOICE_ACTION_REGISTRY;
  window.INVOICE_STATES = INVOICE_STATES;
  window.MICROCOPY_PENDIENTE = MICROCOPY_PENDIENTE;
  window.destinoEfectivo = destinoEfectivo;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { INVOICE_ACTION_REGISTRY, INVOICE_STATES, MICROCOPY_PENDIENTE, destinoEfectivo };
}
