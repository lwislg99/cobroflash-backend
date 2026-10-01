// src/modules/jobs/domain/importePendienteAlbaran.ts — SCRUM-1271
//
// EL IMPORTE QUE QUEDA POR FACTURAR DE UN ALBARÁN, DERIVADO EN EL SERVIDOR.
//
// La ficha del Trabajo decía «X entregados sin facturar» con el albarán ENTERO aunque ya se
// hubiera facturado una parte: `facturado` es `invoiceId != null` y la facturación PARCIAL no pone
// `invoiceId` (escribe el libro `AlbaranLineaFacturada`). El profesional perseguía una factura que
// ya había hecho.
//
// La pantalla no puede recomponerlo (SCRUM-423: dos fuentes de verdad para la misma pregunta), así
// que sale de aquí, con la MISMA aritmética que `totales.total` (`calcAlbaranTotales`, por línea,
// en céntimos): sin ninguna parcial da exactamente `totales.total`.
//
// ⚠️ Vive aparte de `albaranFacturacion.ts` a propósito: ése valida lo que se EMITE (camino de
// emisión, regla 40) y esto es solo una lectura para la pantalla. No toca `facturar-parcial`.
import { calcAlbaranTotales, type AlbaranLinea } from './albaran.service';

/**
 * `null` si el albarán no está VALORADO (sin precio no hay importe, igual que `totales`), `0` si se
 * facturó ENTERO por la vía de siempre (`invoiceId`), y si no, el total de lo pendiente.
 *
 * Se calcula sobre las líneas ORIGINALES con la cantidad cambiada por la pendiente, y no sobre
 * `pendientes[]`: allí un precio ausente ya es `0`, y `calcAlbaranTotales` salta las líneas sin
 * precio. Mismo resultado hoy, pero una sola aritmética es la que no diverge.
 */
export function importePendienteDeFacturar(params: {
  lineas: unknown;
  pendientes: ReadonlyArray<{ index: number; pendiente: number }>;
  modoValoracion: unknown;
  facturadoEntero: boolean;
}): number | null {
  if (params.modoValoracion !== 'VALORADO') return null;
  if (params.facturadoEntero) return 0;
  const lineas = (Array.isArray(params.lineas) ? params.lineas : []) as AlbaranLinea[];
  const pendientePorIndice = new Map(params.pendientes.map((p) => [p.index, p.pendiente]));
  return calcAlbaranTotales(
    lineas.map((l, i) => ({ ...l, cantidad: pendientePorIndice.get(i) ?? 0 })),
  ).total;
}
