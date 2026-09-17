// src/modules/invoicing/domain/invoiceLines.service.ts — SCRUM-141 (FISCAL-1a)
//
// EL TOTAL DE UNA FACTURA ES CONSECUENCIA DE SUS LÍNEAS, no al revés.
//
// ── EL PROBLEMA QUE CIERRA (los 3 `TODO(SCRUM-16/17)`) ─────────────────────────────────────
// Al facturar un tramo, el importe salía de `distributeStageAmounts` (SCRUM-32) y las LÍNEAS se
// escalaban aparte multiplicando cada precio por el porcentaje. Dos redondeos independientes
// sobre el mismo dinero → hasta 1 céntimo de diferencia. Medido con el código real antes del
// fix: descuadre en 3 de los 8 tramos de la muestra inicial (~37 %).
//
// No es cosmético: los dos números alimentan DOS CAMPOS DE LA MISMA HUELLA VeriFactu, que se
// sella y se ENCADENA (`vfPrevHash`), y que es inmutable (regla 29):
//   · `importeTotal` ← `Invoice.total`
//   · `cuotaTotal`   ← `calcVatCuotaTotal(invoice.lines)`
// Si no cuadran, quien calcule `base = importeTotal − cuotaTotal` obtiene una base distinta de
// la que muestran las líneas — y eso solo se corrige emitiendo una R1. Un céntimo mal PARA
// SIEMPRE, no un céntimo mal.
//
// ── POR QUÉ NO SE FUERZAN LAS LÍNEAS A UN TOTAL PREVIO ─────────────────────────────────────
// El primer diseño forzaba las líneas a cuadrar con el importe de `distributeStageAmounts`.
// NO SIEMPRE ES POSIBLE: `calcVatBreakdown` redondea base y cuota POR SEPARADO, así que el
// bruto es una función ESCALONADA del precio y hay importes que ningún precio produce (medido:
// con una línea al 4 %, el importe 250,77 es inalcanzable — base y cuota saltan a la vez).
// Forzando, el 0,91 % de los tramos quedaba descuadrado igualmente, y sellado.
//
// DECISIÓN DEL FUNDADOR (27-jul-2026, opción A): manda la COHERENCIA INTERNA de cada factura.
// Una factura es un documento AUTÓNOMO — Hacienda no mira el presupuesto del que salió, mira si
// sus líneas suman su total. Así que `Invoice.total` se DERIVA de las líneas (`grossOfLines`) y
// nunca se fuerza.
//
// COSTE ACEPTADO Y MEDIDO: la suma de las facturas de un presupuesto puede diferir del total del
// presupuesto en **1-2 céntimos** (2,05 % de los presupuestos de la muestra; desviación máxima
// 2 céntimos). Es visible, explicable y NO toca la cadena de huellas. Ver también
// `docs/COMO_FUNCIONA_YAQU.md` (explicación para el usuario) y la nota de SCRUM-32 en el máster.
import { calcVatBreakdown, type VatLine, cantidadDeLinea } from './vat.service';
import { precioConDto, descuentoGlobalEnCentimos } from '../../../core/utils/utils';

/** Línea de factura: `tax` en FRACCIÓN (0.21), igual que en `Quote.lines`/`Invoice.lines`. */
export type InvoiceLine = VatLine & { [key: string]: unknown };

/**
 * SCRUM-887 · el rótulo de la línea negativa del descuento global. NO es texto nuevo: es la fila
 * «Descuento global:» que el cliente ya leyó en el pie del presupuesto que firmó
 * (`pieDePresupuesto`), sin los dos puntos de la fila. Un test compara los dos.
 */
const ROTULO_DESCUENTO_GLOBAL = 'Descuento global';

/**
 * ¿Lleva el presupuesto descuento global? Una sola lectura para la pieza y para quien tenga que
 * rechazar por él (el albarán, C7). Un `Decimal` de Prisma se lee por `valueOf`.
 *
 * 🔴 `discountGlobalAmount` ES OBLIGATORIO Y NO SE SUPONE. Un `select` que no lo cargue daría
 * `undefined`, que se leería como «sin global» y facturaría a ciegas.
 */
export function tieneDescuentoGlobal(quote: { discountGlobalAmount?: unknown }): boolean {
  if (quote.discountGlobalAmount === undefined) {
    throw new Error('lineasParaFacturar: el presupuesto llega sin `discountGlobalAmount` cargado');
  }
  const global = Number(quote.discountGlobalAmount);
  return Number.isFinite(global) && global > 0;
}

/**
 * SCRUM-887 · LAS LÍNEAS DE UN PRESUPUESTO QUE ENTRAN EN SU FACTURA. El único sitio que decide
 * qué hace la factura con los descuentos: los seis caminos que convierten `Quote.lines` en
 * `Invoice.lines` —y la vista del plan, que promete su importe— pasan por aquí.
 *
 * El defecto que cierra: el cliente firmaba `calcTotal` (que aplica `dto`) y se le cobraba
 * `calcVatBreakdown(Quote.lines)` (que no lo conoce). Medido en staging: firma 539,05 €, cobro
 * 628,60 €.
 *
 * DECISIÓN (SCRUM-887, comentarios 15616 y 15620, 16-sep-2026), que levanta PARTE de la
 * acotación de SCRUM-594:
 *   A · descuento POR LÍNEA → el `dto` se aplica AL PRECIO con `precioConDto`, la misma función
 *       con la que `calcTotal` calcula lo firmado, y la clave `dto` NO viaja: el precio ya es el
 *       efectivo, y dejarla sería una segunda fuente que alguien acabaría aplicando dos veces.
 *       La reconciliación de SCRUM-141 hace el resto contra el total firmado.
 *   B · descuento GLOBAL con un solo IVA → UNA línea NEGATIVA del mismo IVA, la PRIMERA, rotulada
 *       `ROTULO_DESCUENTO_GLOBAL` (PR 2, decisiones del 17-sep-2026, SCRUM-887 comentario 15675).
 *       Su importe es EXACTAMENTE el que resta `calcTotal`: el global en céntimos, limitado a la
 *       suma de bases de las líneas. Con un solo tipo no hay reparto que decidir: la base de ese
 *       tipo baja antes de calcular la cuota, que es lo que `calcTotal` firma. Si el global se come
 *       toda la base, no hay nada que facturar y las líneas salen a 0 (el portón de SCRUM-246).
 *   C · descuento GLOBAL con IVA mezclado → la acotación SE MANTIENE hasta que la asesoría fije
 *       el reparto. Por eso en C NO SE TOCA NADA, ni siquiera el `dto` de línea: el caso C
 *       no cambia de cálculo.
 *
 * Una línea sin `dto` sale COMO ENTRÓ —el mismo objeto—, así que nada que no tenga descuento se
 * mueve un céntimo.
 *
 * Devuelve `any[]` por lo mismo que `stageLines` es genérico: el resultado acaba en `Invoice.lines`
 * (Json de Prisma, que rechaza tipos con firma de índice), y los llamadores ya trabajaban con `any[]`.
 */
export function lineasParaFacturar(quote: { lines?: unknown; discountGlobalAmount?: unknown }): any[] {
  const conGlobal = tieneDescuentoGlobal(quote);
  const lineas = Array.isArray(quote.lines) ? (quote.lines as InvoiceLine[]) : [];

  const efectivas = (): InvoiceLine[] => lineas.map((l) => {
    const dto = Number(l.dto);
    if (!Number.isFinite(dto) || dto <= 0) return l;
    const { dto: _aplicado, ...resto } = l;
    return { ...resto, price: precioConDto(l.price, dto) } as InvoiceLine;
  });
  if (!conGlobal) return efectivas();

  // Los tipos y el importe, de la MISMA función con la que `calcTotal` calcula lo firmado: si aquí
  // saliera un solo tipo y allí dos, se descontaría un importe distinto del firmado.
  const reparto = descuentoGlobalEnCentimos(lineas, quote.discountGlobalAmount);
  // Sin base que descontar, `calcTotal` ignora el global: aquí tampoco hay línea que añadir.
  if (!reparto) return efectivas();
  if (reparto.tipos.length !== 1) return lineas; // C: la acotación sigue viva

  // Un global que se come TODA la base firma 0 €: no hay nada que cobrar. Las líneas salen a 0,
  // como con `dto: 100`, y el portón de SCRUM-246 (`exigirLineasFacturables`) da su 409 antes de
  // pedir número. Con +X y −X pasaría el portón y se emitiría una factura de 0 € (regla 29).
  if (reparto.aRepartir >= reparto.sumaBases) return efectivas().map((l) => ({ ...l, price: 0 }));

  // LA PRIMERA, no la última: `reconcileToTarget` ajusta la ÚLTIMA línea para cuadrar con lo
  // firmado, y el descuento tiene que salir EXACTO. Así el ajuste cae en un producto, como sin
  // descuento. Es el cambio más pequeño: la reconciliación, que sirve a todas las facturas, no se toca.
  const [[rate]] = reparto.tipos;
  return [
    { concept: ROTULO_DESCUENTO_GLOBAL, qty: 1, price: -reparto.aRepartir / 100, tax: rate / 100 },
    ...efectivas(),
  ];
}

/** Solo se necesita el porcentaje del tramo: no se importa `BillingStage` para no acoplar módulos. */
export interface StageLike {
  percentage: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Importe BRUTO (base + cuota) de unas líneas, calculado EXACTAMENTE como lo verá la huella
 * VeriFactu — mismo `calcVatBreakdown` que alimenta `cuotaTotal`. Este es el `Invoice.total`.
 */
export function grossOfLines(lines: InvoiceLine[] | null | undefined): number {
  const bd = calcVatBreakdown(Array.isArray(lines) ? lines : []);
  return round2(bd.base + bd.cuota);
}

/**
 * Líneas que corresponden al tramo `stageIndex`: cada precio se reparte entre los tramos y el
 * ÚLTIMO absorbe el resto — misma convención que `distributeStageAmounts` (SCRUM-32), pero
 * aplicada A NIVEL DE LÍNEA. Así los precios de los tramos suman EXACTAMENTE el precio original
 * de cada línea (`p·0,3 + p·0,4 + (p − p·0,3 − p·0,4) === p`), sin depender de ningún redondeo.
 *
 * GENÉRICO a propósito: devuelve el MISMO tipo que recibe. Los llamadores pasan las líneas crudas
 * del `Quote` (`any[]`) y el resultado va directo a `Invoice.lines` (Json de Prisma, que rechaza
 * tipos con firma de índice). Sin el genérico haría falta un `as any` en cada call-site.
 */
export function stageLines<T extends InvoiceLine>(
  lines: T[],
  plan: StageLike[],
  stageIndex: number,
): T[] {
  const src = Array.isArray(lines) ? lines : [];
  if (src.length === 0 || !Array.isArray(plan) || plan.length === 0) return [];
  if (stageIndex < 0 || stageIndex >= plan.length) return [];

  const esUltimo = stageIndex === plan.length - 1;
  // Lo que se llevan TODOS los tramos anteriores al último (para que el último sea el resto).
  const pctPrevios = plan.slice(0, plan.length - 1).reduce((a, s) => a + (Number(s.percentage) || 0), 0);
  const pct = Number(plan[stageIndex].percentage) || 0;

  return src.map((l) => {
    const precio = Number(l.price) || 0;
    return { ...l, price: esUltimo ? precio - precio * pctPrevios : precio * pct };
  });
}

/**
 * INTENTA que el bruto de `lines` coincida EXACTAMENTE con `targetGross` (el importe aritmético
 * del tramo, de `distributeStageAmounts`), ajustando la última línea. Devuelve las líneas
 * ajustadas si lo consigue, y **las originales sin tocar** si no.
 *
 * POR QUÉ ES "INTENTA" Y NO "GARANTIZA": `calcVatBreakdown` redondea base y cuota POR SEPARADO,
 * así que el bruto es una función ESCALONADA del precio y hay importes que ningún precio produce
 * (medido: con una línea al 4 %, el importe 250,77 es inalcanzable — base y cuota saltan a la vez).
 *
 * POR QUÉ SE INTENTA IGUALMENTE: el total emitido SIEMPRE se deriva de las líneas
 * (`grossOfLines`), así que la coherencia interna de la factura está garantizada pase lo que
 * pase — esto solo sirve para que, ADEMÁS, la suma de las facturas de un presupuesto cuadre con
 * su total cuando es posible. Medido: sin este ajuste la suma difería en algún céntimo en el
 * 51,7 % de los presupuestos de 2 tramos (hasta 3 cént.); con él, la deriva casi desaparece.
 *
 * Determinista: paso fijo y orden fijo (ajustes más pequeños primero), ventana acotada.
 */
export function reconcileToTarget<T extends InvoiceLine>(lines: T[], targetGross: number): T[] {
  const src = Array.isArray(lines) ? lines : [];
  if (src.length === 0) return src;

  const target = round2(targetGross);
  if (grossOfLines(src) === target) return src;

  const lastIdx = src.length - 1;
  const last = src[lastIdx];
  const qty = cantidadDeLinea(last.qty); // SCRUM-504
  const basePrice = Number(last.price) || 0;
  if (!Number.isFinite(qty) || qty === 0) return src;

  // Ventana ±0,05 € de BASE en pasos de 0,0005 €, probando los ajustes más pequeños primero.
  // El residuo real nunca pasa de un par de céntimos; el paso fino existe porque los saltos del
  // escalón caen en fracciones de céntimo.
  for (let k = 1; k <= 100; k++) {
    for (const signo of [1, -1]) {
      const candidato = { ...last, price: basePrice + (signo * k * 0.0005) / qty } as T;
      const prueba = [...src.slice(0, lastIdx), candidato];
      if (grossOfLines(prueba) === target) return prueba;
    }
  }
  return src; // inalcanzable: se emite el bruto real de las líneas (coherente), con su deriva
}

/**
 * Líneas DEFINITIVAS del tramo: reparto exacto por línea + reconciliación con el importe
 * aritmético del plan cuando es alcanzable. Es lo que usan los 3 puntos de emisión y la vista
 * del plan, para que UI y factura no puedan divergir.
 */
export function stageLinesReconciled<T extends InvoiceLine>(
  lines: T[],
  plan: StageLike[],
  stageIndex: number,
  targetGross?: number,
): T[] {
  const split = stageLines(lines, plan, stageIndex);
  return targetGross == null ? split : reconcileToTarget(split, targetGross);
}

/**
 * Importe de CADA tramo, derivado de sus propias líneas. Es lo que se emitirá de verdad, así que
 * la vista del plan (`billingPlanView`) lo usa para no prometer al usuario un importe distinto
 * del que acabará en su factura.
 */
export function stageAmountsFromLines(
  lines: InvoiceLine[],
  plan: StageLike[],
  targets?: number[],
): number[] {
  if (!Array.isArray(plan) || plan.length === 0) return [];
  return plan.map((_, i) => grossOfLines(stageLinesReconciled(lines, plan, i, targets?.[i])));
}
