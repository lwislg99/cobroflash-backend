// public/dashboard/js/quoteActionsRegistry.js — SCRUM-421
//
// LA TABLA DEL PRESUPUESTO. Solo la tabla: la LEY (destinos, reglas, resolutor, marcador de
// microcopy) vive en `patronDetalleAcciones.js`, la misma que usan albarán y factura. Un cuarto
// registro con reglas propias habrían sido las cuatro listas de siempre.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS SEIS ESTADOS, cerrados y verificados uno a uno por la sesión que especificó el ticket
//
//   draft · pending_approval · sent · accepted · rejected · expired
//
// ⚠️ `already_accepted` y `already_rejected` NO son estados: son CUERPOS DE RESPUESTA HTTP
// (`res.json({ ok: true, status: … })`), el patrón de idempotencia del proyecto. Meterlos en esta
// tabla habría creado dos columnas que el modelo no tiene, y entonces ninguna transición cuadra.
//
// ⚠️ Y `Quote.status` es un **String LIBRE**, no un enum: el modelo no cierra el conjunto. Por eso
// la tabla sola no basta y viene con su escáner (`tests/scrum421-registro-acciones-presupuesto`),
// que lee `src/` por AST y falla si alguien escribe un estado que no esté aquí. Registro y guard
// son UNA SOLA PIEZA: una tabla que promete cobertura sin nada que la contraste es peor que no
// empezarla, porque parece hecha.

const QUOTE_STATES = ['draft', 'pending_approval', 'sent', 'accepted', 'rejected', 'expired'];

// id                    draft         pending_approval   sent          accepted      rejected      expired
const QUOTE_ACTION_REGISTRY = [
  // ── El siguiente paso de cada estado. Uno por columna, y ninguna columna sin él. ────────────
  { id: 'btnEnviarAprobacion', destinos: { draft: 'oculta',     pending_approval: 'oculta',     sent: 'oculta',      accepted: 'oculta',    rejected: 'oculta',    expired: 'oculta' },
    cuando: 'requiere-aprobacion' },
  { id: 'btnEnviar',           destinos: { draft: 'primaria',   pending_approval: 'oculta',     sent: 'oculta',      accepted: 'oculta',    rejected: 'oculta',    expired: 'oculta' } },
  // `pending_approval` es el presupuesto que espera el visto bueno de dentro de la empresa: su
  // siguiente paso NO es enviarlo, es aprobarlo. Sin esta fila, ese estado se quedaba sin primaria
  // y era un callejón sin salida en el primer documento del ciclo.
  { id: 'btnAprobar',          destinos: { draft: 'oculta',     pending_approval: 'primaria',   sent: 'oculta',      accepted: 'oculta',    rejected: 'oculta',    expired: 'oculta' } },
  // En `sent` la pelota está en el cliente y el profesional no puede aceptar por él: lo que sí
  // puede es recordárselo. Es la acción que mueve el dinero desde aquí.
  { id: 'btnRecordar',         destinos: { draft: 'oculta',     pending_approval: 'oculta',     sent: 'primaria',    accepted: 'oculta',    rejected: 'oculta',    expired: 'oculta' } },
  // Aceptado: el siguiente paso es cobrar/trabajar. Es el único sitio donde nace el Trabajo.
  { id: 'btnCrearTrabajo',     destinos: { draft: 'oculta',     pending_approval: 'oculta',     sent: 'oculta',      accepted: 'primaria',  rejected: 'oculta',    expired: 'oculta' } },
  // Rechazado y caducado comparten salida: **duplicar y volver a intentarlo**. Es lo único que
  // hace avanzar el dinero desde ahí, y sin ella los dos estados eran un final.
  { id: 'btnDuplicar',         destinos: { draft: 'overflow',   pending_approval: 'overflow',   sent: 'overflow',    accepted: 'overflow',  rejected: 'primaria',  expired: 'primaria' } },

  // ── Secundarias: como mucho dos por estado (regla 2). ──────────────────────────────────────
  { id: 'btnPdf',              destinos: { draft: 'secundaria', pending_approval: 'secundaria', sent: 'secundaria',  accepted: 'secundaria', rejected: 'secundaria', expired: 'secundaria' } },
  { id: 'btnEditarLineas',     destinos: { draft: 'secundaria', pending_approval: 'secundaria', sent: 'oculta',      accepted: 'oculta',    rejected: 'oculta',    expired: 'oculta' } },
  { id: 'btnWhatsApp',         destinos: { draft: 'oculta',     pending_approval: 'oculta',     sent: 'secundaria',  accepted: 'secundaria', rejected: 'oculta',    expired: 'secundaria' } },

  // ── El resto, al «⋮» (regla 3). ────────────────────────────────────────────────────────────
  { id: 'btnVerCliente',       destinos: { draft: 'overflow',   pending_approval: 'overflow',   sent: 'overflow',    accepted: 'overflow',  rejected: 'overflow',  expired: 'overflow' } },
  { id: 'btnMarcarRechazado',  destinos: { draft: 'oculta',     pending_approval: 'oculta',     sent: 'overflow',    accepted: 'oculta',    rejected: 'oculta',    expired: 'oculta' } },
  { id: 'btnBorrar',           destinos: { draft: 'overflow',   pending_approval: 'overflow',   sent: 'oculta',      accepted: 'oculta',    rejected: 'overflow',  expired: 'overflow' } },
];

// ── RÓTULOS · REGLA 30: NINGUNO ESTÁ APROBADO ────────────────────────────────────────────────
//
// Van con marcador visible, como hicieron `albaranesView` y la pantalla del Libro registro antes
// de que el asesor los firmara. El marcador NO es un recordatorio para el equipo: **se ve en
// pantalla a propósito**, para que nadie encienda por descuido texto que nadie ha aprobado.
//
// 17-ago-2026: el fundador APROBÓ los doce rótulos, así que se quitaron las marcas y
// `MARCA_MICROCOPY` se BORRA — dejarla sin consumidores es dejar a mano lo que alguien reenchufa.
// Tres cambiaron al aprobarse, y el motivo se conserva porque vale para el siguiente registro de
// acciones: MISMA ACCIÓN, MISMAS PALABRAS que en el detalle de factura. «PDF» pasó a «Descargar
// PDF», «WhatsApp» a «Enviar por WhatsApp» y «Recordar al cliente» a «Enviar recordatorio».
const QUOTE_ACTION_ROTULOS = {
  btnEnviarAprobacion: 'Enviar a aprobación',
  btnEnviar:           'Enviar al cliente',
  btnAprobar:          'Aprobar',
  btnRecordar:         'Enviar recordatorio',
  btnCrearTrabajo:     'Crear trabajo',
  btnDuplicar:         'Duplicar',
  btnPdf:              'Descargar PDF',
  btnEditarLineas:     'Editar líneas',
  btnWhatsApp:         'Enviar por WhatsApp',
  btnVerCliente:       'Ver cliente',
  btnMarcarRechazado:  'Marcar como rechazado',
  btnBorrar:           'Borrar',
};

if (typeof window !== 'undefined') {
  window.QUOTE_ACTION_REGISTRY = QUOTE_ACTION_REGISTRY;
  window.QUOTE_STATES = QUOTE_STATES;
  window.QUOTE_ACTION_ROTULOS = QUOTE_ACTION_ROTULOS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QUOTE_ACTION_REGISTRY, QUOTE_STATES, QUOTE_ACTION_ROTULOS };
}
