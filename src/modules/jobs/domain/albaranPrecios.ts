// src/modules/jobs/domain/albaranPrecios.ts — SCRUM-607 (ALB-02)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ ENSEÑA EL PAPEL · UNA DECISIÓN, UN SITIO
//
// El profesional deja el material en la obra y entrega un albarán. Hasta hoy o entregaba un
// documento con sus márgenes a la vista de quien no debería verlos, o no entregaba nada.
//
// 🔴 Y ESTO NO ES `modoValoracion`, aunque se le parezca. Aquél decide **qué contiene** el
// albarán, y en `SIN_VALORAR` el backend RECHAZA una línea con precio (400), la pantalla esconde
// las celdas y facturar devuelve `409 albaran_sin_precios`. O sea: usarlo para ocultar precios le
// cuesta al profesional la factura. Éste no toca el contenido — el albarán CONSERVA sus precios,
// el pro los sigue viendo y sigue pudiendo facturar— y sólo decide **qué se imprime**.
//
// Es la misma distinción que ya hace `docFields` en el presupuesto: decide qué muestra EL
// DOCUMENTO, no la pantalla.
//
// ── POR QUÉ VIVE AQUÍ Y NO EN CADA SUPERFICIE ───────────────────────────────────────────────
// El papel son DOS: el PDF (`albaranPdf.service.ts`) y la pantalla pública que el cliente abre
// desde el móvil (`albaranPublicVista.ts`). Si cada una decidiera por su cuenta, taparlo en una
// y no en la otra sería cuestión de tiempo — y el sitio donde no se tapara sería el que el
// cliente tiene delante. Una función, dos llamadores.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ¿Este documento enseña los precios?
 *
 * Puro y defensivo con los dos campos: llegan de una fila de base de datos y de un `req.body`, y
 * cualquiera de los dos puede venir con lo que sea. Ante la duda **NO se enseñan precios**: no
 * enseñarlos es recuperable —el pro lo vuelve a generar—; enseñar el margen del profesional a su
 * cliente por un `undefined` no lo es.
 */
export function documentoEnsenaPrecios(a: {
  modoValoracion?: unknown;
  ocultarPreciosEnDocumento?: unknown;
} | null | undefined): boolean {
  if (!a) return false;
  if (a.modoValoracion !== 'VALORADO') return false;
  return a.ocultarPreciosEnDocumento !== true;
}

/**
 * ¿Se puede cambiar todavía el interruptor?
 *
 * 🔴 **`borrador` Y `emitido`; congelado al FIRMAR.** Y aquí me aparto de `modoValoracion` a
 * propósito, con el visto bueno del asesor: aquél se congela en `emitido` porque **cambia el
 * importe**, y un importe que se mueve después de emitir es otro documento. Éste sólo cambia
 * **qué se imprime**, y el caso real es de un profesional de verdad: «ya lo emití y ahora me lo
 * piden sin precios».
 *
 * Al firmar sí se congela: ahí el papel es prueba de lo entregado y no se retoca.
 *
 * ⚠️ AL SIGUIENTE QUE LEA ESTO Y QUIERA UNIFICARLO CON `modoValoracion`: ése es el motivo de por
 * qué no. No son el mismo candado porque no protegen lo mismo.
 */
export function sePuedeCambiarOcultarPrecios(estado: unknown): boolean {
  return estado === 'borrador' || estado === 'emitido';
}

/**
 * La referencia al presupuesto de origen, para el pie del documento.
 *
 * Si el albarán no lleva precios, TIENE que decir de qué presupuesto sale: sin eso el cliente
 * recibe una lista de cosas sin nada que la ate a lo que aceptó, y deja de ser comprobable.
 *
 * 🔴 VA EN EL PIE Y **FUERA DEL SOBRE DE LA FIRMA**, que se queda en sus cinco campos (SCRUM-452).
 * Ampliarlo a seis cambiaría el hash y dejaría los albaranes ya firmados con un sobre de otra
 * forma: eso es evidencia legal y merece su propia tanda, no ser un efecto colateral de ALB-02.
 * Aquí se imprime como TRAZABILIDAD, en el mismo cajón que `merchant.address` o `notas`: cosas
 * sobre las que el sello no afirma nada y que por eso no pueden contradecirlo.
 *
 * `null` cuando el Trabajo no vino de un presupuesto (`Job.quoteId` es nullable): entonces no se
 * imprime la línea, en vez de imprimir un rótulo con un hueco al lado.
 */
export function referenciaPresupuesto(quote: { id?: unknown; number?: unknown } | null | undefined): string | null {
  if (!quote) return null;
  // La MISMA forma que ya usan `jobs.routes.ts:275` y `albaranes.routes.ts:689` (número con caída
  // al id): dos formas del mismo dato acaban divergiendo y el pro ve dos números para un
  // presupuesto.
  const n = Number.isFinite(quote.number as number) ? quote.number : quote.id;
  if (!Number.isFinite(n as number)) return null;
  return `${ROTULO_PRESUPUESTO_ORIGEN} ${n}`;
}

/**
 * ⚠️ MICROCOPY SIN APROBAR (regla 30). Sale con la grafía que CUENTA el censo de SCRUM-402
 * —`[PENDIENTE`—, para que aprobarlo lo apague desde un solo sitio.
 *
 * Va impreso en un papel que recibe el CLIENTE, así que el marcador se ve: es incómodo a
 * propósito. La alternativa —inventarme el literal— es lo que la regla 30 prohíbe.
 */
// 🔴 SIN `export`, y lo pidió el trinquete de SCRUM-411: su único consumidor real es
// `referenciaPresupuesto`, aquí al lado. Exportarlo sólo para que lo lea un test es un export
// huérfano — desde fuera no se distingue de una pieza entregada. Se prueba por la SUPERFICIE
// PÚBLICA, que es la que de verdad tiene consumidor.
const ROTULO_PRESUPUESTO_ORIGEN = 'Presupuesto nº [PENDIENTE microcopy oficial]';
