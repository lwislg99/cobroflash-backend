// public/dashboard/js/avisoDocumentoSinEnviar.js — SCRUM-885 (P-CONT-1)
//
// LA REGLA del aviso «el documento del cobro no ha salido», en UN solo sitio (patrón de
// jobsCierreTrabajo.js, SCRUM-344): la vista la PINTA desde aquí —en el toast de «Confirmar Bizum»
// y en la fila de la factura del trabajo— y el test la VERIFICA contra aquí. Función pura: sin
// DOM, sin red, sin BD.
//
// Los HECHOS los manda el backend (`src/modules/billing/domain/envioDelDocumento.ts`) como
// `envioDocumento`; aquí sólo se decide si con esos hechos hay que avisar.
//
// ── DECIDIDO (orquestador, 16-sep-2026) ──────────────────────────────────────────────────────
// Se avisa SOLO si el documento no ha salido NI por email NI por WhatsApp:
//   · el envío automático al cobrar está ENCENDIDO — apagado no le llega a nadie, y ese es otro
//     problema, no éste;
//   · el cliente NO tiene email;
//   · el WhatsApp no cuenta: no se intentó, o ninguna fila dice enviado o más. Un WhatsApp que
//     todavía no ha vuelto de Meta (`en_curso`) no es un fallo y no avisa.
// Sin `envioDocumento` (factura sin cobro pagado, o una respuesta de antes) no hay aviso.

var AVISO_DOCUMENTO_SIN_ENVIAR =
  'El documento no se ha enviado: el cliente no tiene email. Añade su email en su ficha y envíaselo.';

/** Devuelve SIEMPRE la misma forma, nunca `null`: `{ mostrar, texto }`. */
function avisoDocumentoSinEnviar(envio) {
  var mostrar = !!envio
    && envio.autoEmail === true
    && envio.clienteTieneEmail === false
    && (envio.whatsapp === 'sin_intento' || envio.whatsapp === 'no_enviado');
  return { mostrar: mostrar, texto: mostrar ? AVISO_DOCUMENTO_SIN_ENVIAR : null };
}

// Doble vida: global para el <script> clásico del dashboard, y module.exports para que el test
// IMPORTE esta misma fuente en Node (una sola copia de la regla).
if (typeof window !== 'undefined') {
  window.AVISO_DOCUMENTO_SIN_ENVIAR = AVISO_DOCUMENTO_SIN_ENVIAR;
  window.avisoDocumentoSinEnviar = avisoDocumentoSinEnviar;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AVISO_DOCUMENTO_SIN_ENVIAR: AVISO_DOCUMENTO_SIN_ENVIAR,
    avisoDocumentoSinEnviar: avisoDocumentoSinEnviar,
  };
}
