// public/dashboard/js/albaranActionsRegistry.js — SCRUM-302 (C2)
//
// LA TABLA DEL ALBARÁN. Solo la tabla: la LEY (destinos, reglas, resolutor, marcador de microcopy)
// vive en `patronDetalleAcciones.js` y es la misma que usa la factura. Dos registros de acciones
// habrían sido las dos listas de siempre.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS ESTADOS, MEDIDOS — la premisa del ticket estaba equivocada
//
// El enunciado hablaba de un estado «Enviado». **No existe.** Medido en `prisma/schema.prisma`
// (`estado String @default("borrador") // borrador | emitido | firmado`) y en
// `albaran.service.ts` (`ALBARAN_ESTADOS = ['borrador', 'emitido', 'firmado']`).
//
// Lo que sí existe es un DERIVADO: «enviado para firmar» es `enviadoParaFirmaAt != null &&
// estado === 'emitido'` — lo dice el propio schema, y NO es un estado nuevo (la Parte L queda
// intacta). Pintarlo como estado habría metido en la tabla una columna que el modelo no tiene, y
// entonces ninguna transición cuadraría.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «FACTURADO» TAMPOCO ES UN ESTADO, Y APLANARLO PIERDE EL CASO NORMAL
//
// Es un DERIVADO de tres valores (`estadoCobroAlbaran`, `albaranFacturacion.ts`):
// `sin_facturar` · `parcial` · `facturado`, calculado contra `AlbaranLineaFacturada`. En una obra
// por fases, **`parcial` es lo habitual**: se factura lo servido y queda pendiente el resto.
// Aplanarlo a un booleano «facturado sí/no» borraría justo ese caso — por eso aquí no es una
// columna de la tabla, sino CONTEXTO que decide si la acción de facturar tiene sentido hoy.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO SE CONSTRUYE, Y POR QUÉ (medido en A0.2)
//
// **Las líneas del albarán NO se pueden casar con las del presupuesto.** No hay campo que las
// ate: `AlbaranLineaFacturada` referencia `lineaIndex` —el índice dentro del Json del ALBARÁN— y
// `invoiceId`; del presupuesto, nada. Así que esta página **no ofrece ninguna vista de
// «albarán vs presupuesto»**: sería una correspondencia inventada por coincidencia de concepto.

const ALBARAN_STATES = ['borrador', 'emitido', 'firmado'];

// id                 borrador        emitido           firmado          (contexto)
const ALBARAN_ACTION_REGISTRY = [
  // El siguiente paso de cada estado. En `firmado` la primaria es CONTEXTUAL: facturar solo tiene
  // sentido si el albarán lleva precios y queda algo por facturar — y esa condición la responde
  // el derivado de tres valores, no un booleano.
  { id: 'btnEmitir',        destinos: { borrador: 'primaria',   emitido: 'oculta',     firmado: 'oculta' } },
  { id: 'btnEnviarFirmar',  destinos: { borrador: 'oculta',     emitido: 'primaria',   firmado: 'oculta' } },
  { id: 'btnFacturar',      destinos: { borrador: 'oculta',     emitido: 'oculta',     firmado: 'primaria' },
    cuando: 'valorado-con-pendiente' },

  // Secundarias: como mucho dos por estado (regla 2).
  { id: 'btnFirmarAqui',    destinos: { borrador: 'oculta',     emitido: 'secundaria', firmado: 'oculta' } },
  { id: 'btnPdf',           destinos: { borrador: 'secundaria', emitido: 'secundaria', firmado: 'secundaria' } },
  { id: 'btnWhatsApp',      destinos: { borrador: 'oculta',     emitido: 'oculta',     firmado: 'secundaria' } },
  { id: 'btnEditarLineas',  destinos: { borrador: 'secundaria', emitido: 'oculta',     firmado: 'oculta' } },

  // El resto, al «⋮» (regla 3).
  { id: 'btnFoto',          destinos: { borrador: 'overflow',   emitido: 'overflow',   firmado: 'overflow' } },
  { id: 'btnVerTrabajo',    destinos: { borrador: 'overflow',   emitido: 'overflow',   firmado: 'overflow' } },
];

if (typeof window !== 'undefined') {
  window.ALBARAN_ACTION_REGISTRY = ALBARAN_ACTION_REGISTRY;
  window.ALBARAN_STATES = ALBARAN_STATES;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ALBARAN_ACTION_REGISTRY, ALBARAN_STATES };
}
