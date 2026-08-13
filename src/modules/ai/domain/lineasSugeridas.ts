// src/modules/ai/domain/lineasSugeridas.ts — SCRUM-507
//
// EL CRITERIO CON EL QUE SE ACEPTA (O NO) LO QUE PROPONE LA IA, EN UN SITIO Y SIN RED.
//
// ── POR QUE ESTA AQUI Y NO DENTRO DE `ai.service.ts` ──────────────────────────────────────
// Estaba dentro de `suggestQuoteLines`, detras de una llamada al modelo. Un test solo podia
// **reproducir** ese mapeo, no ejercitarlo — y una copia del criterio es exactamente el defecto que
// este ticket persigue: dos sitios decidiendo lo mismo. Se comprobo midiendo: al romper el servicio
// a proposito, cuatro tests que deberian haber caido **seguian verdes**, porque median la copia.
// Aqui es codigo puro (sin `prisma`, sin `config`, sin red) y el test ejercita LO QUE CORRE.
//
// ── LA DECISION DEL FUNDADOR (2-ago-2026) ─────────────────────────────────────────────────
//   · `qty` y `price` ilegibles → la linea SE PROPONE y sale MARCADA como supuesta. Un numero raro
//     se ve: el profesional lo mira, lo corrige y sigue.
//   · `tax` ilegible → la linea NO SE PROPONE. Un IVA a cero no se ve: *parece una decision que
//     alguien tomo*. La asimetria de coste lo cierra — una linea que falta se anade a mano en diez
//     segundos; una exenta que no debia serlo se descubre en una inspeccion.

export type LineaSugerida = {
  concept: string;
  qty: number;
  price: number;
  tax: number;
  /** Que campos NO venian y hemos tenido que suponer. Vacio = todo lo dijo el modelo. */
  supuestos: Array<'qty' | 'price'>;
};

export type LineaDescartada = { concept: string; motivo: 'iva_ilegible' };

/**
 * Cantidad utilizable a partir de lo que devuelva el modelo.
 *
 * Todo lo que no sea un número POSITIVO cae a 1, que es la regla que ya se le pide al modelo
 * ("si no se dice, 1"). Se hace explícito en vez de heredar el `Math.max(0.01, Number(x) || 1)`
 * del extractor de presupuesto, que es incoherente: con ese, un 0 acaba en 1 (porque 0 es
 * falsy) pero un -4 acaba en **0,01** — "0,01 unidades" de algo, impreso en un documento que
 * firma el cliente. Cero y negativo son la misma clase de basura de dictado y merecen la misma
 * respuesta.
 */
export function cantidadUtilizable(bruto: unknown): number {
  const n = Number(bruto);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * El IVA que devuelve el modelo, o `null` si NO SE PUEDE LEER.
 *
 * 🔴 NO VALE `Number(bruto)`, y este es el filo entero del ticket: `Number(null)`, `Number('')`,
 * `Number(false)` y `Number([])` valen **0**. Con ese criterio, un modelo que se calla el impuesto
 * produce una línea **exenta**, y una exenta no se ve — parece una decisión que alguien tomó.
 * Por eso solo se acepta lo que ES un número: un `number` finito, o una cadena con un número
 * dentro. Ausente, vacío o de otro tipo son "no se sabe", y la línea no se propone.
 *
 * El rango es [0, 1] porque el contrato del servicio es la FRACCIÓN (0,21). Un `21` es el modelo
 * hablando en porcentaje: colarlo multiplicaría el impuesto por cien.
 */
export function ivaLegible(bruto: unknown): number | null {
  const enRango = (n: number) => (Number.isFinite(n) && n >= 0 && n <= 1 ? n : null);
  if (typeof bruto === 'number') return enRango(bruto);
  if (typeof bruto === 'string' && bruto.trim() !== '') return enRango(Number(bruto.trim()));
  return null;
}

/**
 * Mapea lo que devolvio el modelo a lo que se le ensena al profesional.
 *
 * ⚠️ LO DESCARTADO NO DESAPARECE: viaja en `descartadas` con su concepto y su motivo, y el
 * navegador lo pinta. Quitar una linea en silencio seria cambiar un fallo mudo por otro — el
 * profesional tiene que saber QUE trabajo no se pudo proponer para escribirlo a mano.
 */
export function mapearLineasSugeridas(parsed: unknown[]): {
  lineas: LineaSugerida[];
  descartadas: LineaDescartada[];
} {
  const lineas: LineaSugerida[] = [];
  const descartadas: LineaDescartada[] = [];

  for (const bruto of parsed) {
    const l = bruto as any;
    const concept = String(l?.concept || '').trim();

    // (c) El IVA es lo unico que descarta la linea entera.
    const tax = ivaLegible(l?.tax);
    if (tax === null) {
      descartadas.push({ concept, motivo: 'iva_ilegible' });
      continue;
    }

    // (b) Lo demas se propone, con su valor de siempre y DECLARANDO lo que se invento.
    const qtyBruto = Number(l?.qty);
    const priceBruto = Number(l?.price);
    const supuestos: Array<'qty' | 'price'> = [];
    if (!Number.isFinite(qtyBruto) || qtyBruto <= 0) supuestos.push('qty');
    if (!Number.isFinite(priceBruto) || priceBruto < 0) supuestos.push('price');

    lineas.push({
      concept,
      qty: cantidadUtilizable(l?.qty),
      price: Math.max(0, priceBruto || 0),
      tax,
      supuestos,
    });
  }

  return { lineas, descartadas };
}
