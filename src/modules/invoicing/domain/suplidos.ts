// src/modules/invoicing/domain/suplidos.ts — SCRUM-500 (A2-c)
//
// LOS SUPLIDOS: FUERA DE LA BASE IMPONIBLE, SIN IVA, Y DENTRO DEL TOTAL.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES UN SUPLIDO, EN DOS FRASES
//
// Es lo que el profesional paga POR CUENTA del cliente y le repercute tal cual: **sin IVA y sin
// margen** — una tasa municipal, el visado de un colegio profesional, una licencia de obra.
// Poner ahí un material propio es un ERROR FISCAL, no un despiste de clasificación: el material
// se compra para uno y se revende con su IVA y su margen; el suplido es dinero ajeno que solo
// pasa por la cuenta del profesional.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES REGLAS, Y LA TERCERA ES LA QUE TODO EL MUNDO SE SALTA
//
//   ① NO entra en la BASE IMPONIBLE. Un suplido no es contraprestación del servicio: es un
//      reembolso. Meterlo en la base infla la base y, con ella, la cuota.
//   ② NO lleva IVA. No se repercute impuesto sobre un impuesto.
//   ③ 🔴 SÍ ENTRA EN EL TOTAL. El cliente lo paga. Un suplido que desaparece del total es una
//      factura que pide menos dinero del que se ha adelantado.
//
// Las tres juntas dan la única aritmética correcta:
//
//     TOTAL = base imponible + cuota de IVA + suplidos
//                  (①)            (②)          (③)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 Y EL CRUCE CON LA RETENCIÓN (A2), QUE ES POR LO QUE ESTE TICKET EXISTE SEPARADO
//
// La retención de IRPF se practica **sobre la base imponible**. Si el suplido se coló en la base,
// el error se paga DOS VECES: una en la cuota de IVA y otra en la retención. Sobre una factura de
// 800 € de mano de obra con 50 € de tasa municipal:
//
//     correcto            base 800,00 · IVA 168,00 · suplidos 50,00 · TOTAL 1.018,00 · ret. 120,00
//     suplido en la base  base 850,00 · IVA 178,50 ················· TOTAL 1.028,50 · ret. 127,50
//                                       ↑ +10,50 € de IVA                             ↑ +7,50 €
//
// Diez euros y medio de IVA que nadie debía, sobre una tasa que ya era un impuesto. Por eso el
// caso cruzado está escrito A MANO en `tests/scrum500-suplidos.test.mjs`: un test que recalcula
// con las mismas funciones no probaría nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTE MÓDULO NO LO LLAMA TODAVÍA NINGÚN CÁLCULO DE EMISIÓN, Y ES DELIBERADO
//
// Igual que `retencionIrpf.ts` (A2) y `recargoEquivalencia.ts` (A3): enchufarlo a la emisión
// cambia **el número que se sella**, porque el total y la base de una factura con suplidos no son
// los que salen hoy de `grossOfLines`/`calcVatBreakdown`. Eso es camino de emisión sellado
// (regla 38) y necesita GO del fundador con el diff delante.
//
// Lo que SÍ está vivo hoy, y es la mitad fiscal que se podía entregar sin tocar nada sellado: la
// casilla del editor de líneas **fuerza el IVA de esa línea a 0 %** (`quoteSuplido.js`, y el
// validador lo exige en la puerta). Un suplido deja de llevar IVA HOY, con el mismo total que
// calcula el back, sin que ningún número sellado se mueva. Lo que queda para el cable es sacarlo
// de la base — que es clasificación, no dinero cobrado de más.
//
// ⚠️ Y ESTE MÓDULO NO TOCA `calcVatBreakdown`: la LLAMA, sobre las líneas ya filtradas. Los 16
// consumidores de esa función —uno de ellos `registro.builder.ts`, que manda la base literal al
// XML— no tienen nada que aprender.
import { calcVatBreakdown, cantidadDeLinea, type VatLine, type VatRateEntry } from './vat.service';

/** Dos decimales, medio arriba. El MISMO redondeo que `round2` en `vat.service`/`invoiceLines`. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * LA CLAVE de la marca dentro de la línea. Una sola constante, y la pantalla la importa en vez de
 * escribir el literal: dos literales `'suplido'` en dos ficheros son dos cosas que pueden
 * separarse en silencio el día que una se renombre, y entonces la casilla marca algo que el
 * cálculo no lee. El guard de `scrum500-suplidos.test.mjs` exige que front y back usen ésta.
 */
export const MARCA_SUPLIDO = 'suplido';

/** Línea de factura o de presupuesto: `tax` en FRACCIÓN (0.21), igual que en `Invoice.lines`. */
export type LineaConSuplido = VatLine & { [key: string]: unknown };

export type LecturaSuplido =
  | { ok: true; suplido: boolean }
  | { ok: false; motivo: string };

/**
 * ⚠️ SUELO — LEE LA MARCA SIN DEGRADAR A «NO ES SUPLIDO» EN SILENCIO.
 *
 * «No es suplido» es el valor de la inmensa mayoría de las líneas, y por eso es **el peor sitio
 * del producto para degradar**: un fallo de lectura produce exactamente el resultado que se ve
 * normal. Nadie lo nota nunca. La factura sale, el cliente paga IVA sobre una tasa, y el error
 * solo aparece si alguien lo cruza a mano meses después.
 *
 * Por eso se distinguen TRES cosas donde el reflejo pondría dos:
 *
 *   · marca AUSENTE            → `{ ok: true, suplido: false }`  ← contrato: una línea normal
 *   · marca `true` / `false`   → `{ ok: true, suplido }`         ← declarado
 *   · marca PRESENTE E ILEGIBLE→ `{ ok: false, motivo }`         ← «no lo sé», y se dice
 *
 * Ausente **sí** es un no legítimo: es lo que tienen las líneas de siempre y las de antes de esta
 * casilla. Lo que no puede pasar por «no» es un `'sí'`, un `1` o un `'false'` — alguien escribió
 * algo ahí, y si no se entiende, no se adivina.
 */
export function leerMarcaSuplido(linea: unknown): LecturaSuplido {
  if (linea === null || linea === undefined || typeof linea !== 'object') {
    return { ok: false, motivo: 'línea ilegible: no se puede saber si es un suplido' };
  }
  const bruto = (linea as Record<string, unknown>)[MARCA_SUPLIDO];
  if (bruto === undefined) return { ok: true, suplido: false }; // línea normal de siempre
  if (typeof bruto === 'boolean') return { ok: true, suplido: bruto };
  return {
    ok: false,
    motivo: `marca de suplido ilegible: ${JSON.stringify(bruto)} (se esperaba true o false)`,
  };
}

/**
 * El importe de UNA línea de suplido: cantidad × precio, **y nada más**.
 *
 * Sin IVA (regla ②) y sin margen: un suplido se repercute TAL CUAL. Si llevara margen dejaría de
 * ser un suplido y pasaría a ser un servicio propio, con su IVA — que es justo la frontera que la
 * casilla existe para no cruzar.
 *
 * La cantidad sale de `cantidadDeLinea` (SCRUM-504) y no de un `Number(x) || 1` nuevo: una
 * cantidad ausente vale 0, aquí igual que en el resto de la factura.
 */
export function importeSuplido(linea: LineaConSuplido): number {
  return round2(cantidadDeLinea(linea?.qty) * (Number(linea?.price) || 0));
}

export type TotalSuplidos =
  | { ok: true; total: number; lineas: number }
  | { ok: false; motivo: string };

/**
 * EL TOTAL DE SUPLIDOS DE UNA FACTURA — el valor que va a la columna `invoices.suplidos`.
 *
 * 🔴 UNA SOLA FUENTE. La columna no es un dato independiente que alguien teclee: es SIEMPRE esto,
 * calculado sobre las líneas. Dos sitios que sepan cuánto suman los suplidos acaban diciendo
 * cosas distintas —lección de SCRUM-504, cinco copias de la misma línea divergiendo—, así que
 * quien escriba la columna llama a esta función y no suma por su cuenta.
 *
 * `total: 0` con `lineas: 0` es **«no hay suplidos»**, que es distinto de `{ ok: false }`. Quien
 * escriba la columna traduce: `ok:false` → NO se escribe nada (queda `NULL` = «no consta»);
 * `ok:true` → se escribe el total, aunque sea `0.00` (= «declarado que no hay»).
 */
export function totalSuplidos(lineas: LineaConSuplido[] | null | undefined): TotalSuplidos {
  const src = Array.isArray(lineas) ? lineas : [];
  let total = 0;
  let cuantas = 0;
  for (let i = 0; i < src.length; i++) {
    const lectura = leerMarcaSuplido(src[i]);
    // No se salta la línea ni se cuenta como «no suplido»: se para. Ver el suelo de arriba.
    if (!lectura.ok) return { ok: false, motivo: `línea ${i + 1}: ${lectura.motivo}` };
    if (!lectura.suplido) continue;
    total += importeSuplido(src[i]);
    cuantas += 1;
  }
  return { ok: true, total: round2(total), lineas: cuantas };
}

/** Las líneas que SÍ forman la base imponible: todas menos los suplidos. */
export type ParticionLineas =
  | { ok: true; sujetas: LineaConSuplido[]; suplidos: LineaConSuplido[] }
  | { ok: false; motivo: string };

export function partirPorSuplido(lineas: LineaConSuplido[] | null | undefined): ParticionLineas {
  const src = Array.isArray(lineas) ? lineas : [];
  const sujetas: LineaConSuplido[] = [];
  const suplidos: LineaConSuplido[] = [];
  for (let i = 0; i < src.length; i++) {
    const lectura = leerMarcaSuplido(src[i]);
    if (!lectura.ok) return { ok: false, motivo: `línea ${i + 1}: ${lectura.motivo}` };
    (lectura.suplido ? suplidos : sujetas).push(src[i]);
  }
  return { ok: true, sujetas, suplidos };
}

export type DesgloseConSuplidos =
  | {
      ok: true;
      /** Base imponible SIN suplidos — la que lleva IVA y sobre la que se calcula la retención. */
      base: number;
      /** Cuota de IVA, calculada solo sobre las líneas sujetas. */
      cuota: number;
      /** Desglose por tipo, solo de las sujetas. */
      entries: VatRateEntry[];
      /** Lo repercutido por cuenta del cliente. Fuera de la base, dentro del total. */
      suplidos: number;
      /** Lo que el cliente paga: base + cuota + suplidos. */
      total: number;
    }
  | { ok: false; motivo: string };

/**
 * EL DESGLOSE COMPLETO de una factura que puede llevar suplidos.
 *
 * 🔴 CONTROL NEGATIVO INTEGRADO EN EL DISEÑO: sin ninguna línea marcada, `partirPorSuplido`
 * devuelve las líneas TAL CUAL y esto se reduce a `calcVatBreakdown(lineas)` con
 * `suplidos: 0` — o sea, **exactamente el mismo desglose y el mismo total que hoy**, hasta el
 * céntimo. No es que «probablemente no cambie»: es la misma llamada sobre el mismo array.
 *
 * La retención se calcula con `bloqueRetencion({ baseImponible: base, total, tipo })` de
 * `retencionIrpf.ts` — con ESTA `base`, la de aquí, que ya viene sin suplidos.
 */
export function desgloseConSuplidos(
  lineas: LineaConSuplido[] | null | undefined,
): DesgloseConSuplidos {
  const particion = partirPorSuplido(lineas);
  if (!particion.ok) return { ok: false, motivo: particion.motivo };

  // Las sujetas van a la MISMA función de siempre, sin tocarla (regla 38).
  const bd = calcVatBreakdown(particion.sujetas);
  const suma = particion.suplidos.reduce((a, l) => a + importeSuplido(l), 0);
  const suplidos = round2(suma);

  return {
    ok: true,
    base: bd.base,
    cuota: bd.cuota,
    entries: bd.entries,
    suplidos,
    total: round2(bd.base + bd.cuota + suplidos),
  };
}
