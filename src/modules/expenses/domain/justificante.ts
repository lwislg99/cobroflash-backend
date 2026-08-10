// src/modules/expenses/domain/justificante.ts — SCRUM-324 (E3) · ¿este justificante deduce IVA?
//
// ── LA CORRECCIÓN LEGAL QUE ORDENA TODO ESTE FICHERO ────────────────────────────────────────
// El diseño v1 vendía la foto del ticket como «la que más euros le devuelve al bolsillo». Es falso:
// **un ticket o factura SIMPLIFICADA no permite deducir el IVA soportado.** La única excepción es la
// **simplificada CUALIFICADA**, que exige dos cosas en el papel:
//
//   · el **NIF DEL DESTINATARIO** —el del profesional, NO el del proveedor—, y
//   · la **cuota repercutida DESGLOSADA**.
//
// La v1 listaba el NIF del proveedor, que es otro campo. Con eso, el flujo estrella capturaba
// justificantes que en su mayoría **no son deducibles**, camino de convertirse en microcopy
// diciéndole a un fontanero cuánto se ahorra.
//
// (Deducible en IVA y deducible como gasto en IRPF **son cosas distintas y con importes distintos**.
// Este módulo habla SOLO de IVA soportado; nada de lo que devuelve debe presentarse como si valiera
// para lo otro.)
//
// ── POR QUÉ AQUÍ NO HAY NI UNA FRASE PARA EL USUARIO ────────────────────────────────────────
// Este módulo devuelve **códigos**, no textos. El aviso le está diciendo a un profesional qué puede
// y qué no puede deducirse: un texto fiscal mal escrito no es feo, es peligroso. La microcopy la
// aprueba el fundador con el asesor (regla 30), y hasta entonces **no existe** — no se pone un
// provisional, porque un relleno que tranquiliza es peor que un hueco (SCRUM-302).
//
// ── LO QUE EL SISTEMA NO PUEDE SABER, Y SE DICE EN VEZ DE ADIVINARSE ────────────────────────
// Si el papel lleva o no el NIF del profesional **no está en ningún campo**: es un hecho del
// documento, no del modelo. Por eso el veredicto tiene TRES valores y no dos. Inventar el tercero
// como «sí» sería exactamente el error de la v1, y como «no» convertiría el aviso en ruido que el
// usuario aprende a ignorar.
import { Prisma } from '@prisma/client';

/** Qué le falta a un justificante para deducir IVA. Códigos, no frases. */
export const FALTA = {
  IMPORTE: 'importe',
  NIF_PROVEEDOR: 'nif_proveedor',
  FECHA: 'fecha',
  CUOTA_DESGLOSADA: 'cuota_desglosada',
  NUMERO_FACTURA_PROVEEDOR: 'numero_factura_proveedor',
  /** El único que NO se deriva: hay que mirar el papel. */
  NIF_DESTINATARIO_EN_EL_DOCUMENTO: 'nif_destinatario_en_el_documento',
} as const;
export type Falta = (typeof FALTA)[keyof typeof FALTA];

export const VEREDICTO = {
  /** Cumple todo lo comprobable Y alguien confirmó que el papel lleva el NIF del profesional. */
  DEDUCIBLE: 'deducible',
  /** Le falta algo comprobable. Es el caso del ticket de almacén. */
  NO_DEDUCIBLE: 'no_deducible',
  /** Todo lo comprobable está; queda mirar el papel. NO se resuelve solo. */
  FALTA_CONFIRMAR: 'falta_confirmar',
} as const;
export type Veredicto = (typeof VEREDICTO)[keyof typeof VEREDICTO];

export interface JustificanteEntrada {
  /** `Expense.amount` — TOTAL con IVA (declarado en SCRUM-324 §1b). */
  amount?: Prisma.Decimal | number | string | null;
  /** `Expense.date` — la del apunte. */
  date?: Date | null;
  /** `Provider.taxId`. */
  nifProveedor?: string | null;
  /** `Expense.vatRate` — ENTERO DE PORCENTAJE (21/10/4/0). */
  vatRate?: number | null;
  /** `Expense.vatAmount` — la cuota, tal y como venga desglosada en el documento. */
  vatAmount?: Prisma.Decimal | number | string | null;
  /** `Expense.providerInvoiceNumber`. */
  providerInvoiceNumber?: string | null;
  /**
   * `Expense.vatDeducible` — la DECISIÓN, no la derivación. `null` = nunca clasificado (convención
   * del propio schema), y por eso el veredicto puede quedar en «falta confirmar».
   */
  vatDeducible?: boolean | null;
}

export interface Clasificacion {
  veredicto: Veredicto;
  /** Vacío si no falta nada comprobable. Orden estable: el del enum. */
  faltan: Falta[];
  /** Avisos que NO impiden deducir pero que alguien tiene que ver. */
  incoherencias: Incoherencia[];
}

export const INCOHERENCIA = {
  /** `vatRate` con pinta de fracción (0,21) donde se espera 21. */
  TIPO_IVA_PARECE_FRACCION: 'tipo_iva_parece_fraccion',
  /** base + cuota ≠ total, fuera de la tolerancia. */
  CUOTA_NO_CUADRA_CON_EL_TOTAL: 'cuota_no_cuadra_con_el_total',
} as const;
export type Incoherencia = (typeof INCOHERENCIA)[keyof typeof INCOHERENCIA];

/**
 * UN CÉNTIMO DE TOLERANCIA, y es una decisión, no un detalle.
 *
 * SCRUM-324 §5 lo midió: hoy no existe ninguna noción de tolerancia en el árbol —`vat.service.ts`
 * solo tiene `round2`—. Y la factura de un proveedor trae a veces una cuota que no es exactamente
 * base × tipo por redondeos de SU programa. Comparar en estricto marcaría como descuadre una
 * diferencia legítima de un céntimo: la fábrica de falsos rojos de siempre, y un aviso que se
 * dispara sin motivo se acaba ignorando igual que uno que no se dispara nunca.
 */
export const TOLERANCIA_CENTIMOS = 1;

/**
 * A céntimos enteros, sin pasar por coma flotante. `null` si no hay un número de verdad.
 *
 * ⚠️ FAMILIA SCRUM-271, y por eso no hay ni un `||` en esta función: `Number('')` es **0**, y
 * `0 || x` es **x**. Un gasto sin importe se convertiría en otra cosa por el camino y nadie lo
 * vería. Aquí el vacío es `null` y el cero es cero, que son dos hechos distintos.
 */
export function aCentimos(v: Prisma.Decimal | number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v.trim() : String(v);
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** `null` para una cadena que no trae contenido. El vacío y el «no hay» son lo mismo aquí. */
function texto(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = v.trim();
  return s === '' ? null : s;
}

/**
 * Qué le falta a este justificante para deducir IVA, y por tanto qué hay que pedir en el almacén.
 *
 * NO decide sola el caso bueno: si todo lo comprobable está, devuelve `falta_confirmar` con
 * `NIF_DESTINATARIO_EN_EL_DOCUMENTO` pendiente, porque eso solo se sabe mirando el papel. Es el
 * mismo principio que rige el OCR si algún día entra: **lo que no se puede comprobar se propone y
 * lo confirma una persona; nunca se da por bueno.**
 */
export function clasificarJustificante(e: JustificanteEntrada): Clasificacion {
  const faltan: Falta[] = [];
  const incoherencias: Incoherencia[] = [];

  const total = aCentimos(e.amount);
  // `total === 0` NO es «falta el importe»: es un importe de cero, y decirlo mal es la trampa de
  // SCRUM-271. Falta solo cuando no hay número.
  if (total === null) faltan.push(FALTA.IMPORTE);
  if (!(e.date instanceof Date) || Number.isNaN(e.date.getTime())) faltan.push(FALTA.FECHA);
  if (texto(e.nifProveedor) === null) faltan.push(FALTA.NIF_PROVEEDOR);

  // ── LA CUOTA DESGLOSADA ────────────────────────────────────────────────────────────────
  const cuota = aCentimos(e.vatAmount);
  if (cuota === null || e.vatRate === null || e.vatRate === undefined) {
    faltan.push(FALTA.CUOTA_DESGLOSADA);
  } else {
    // ⚠️ `vatRate` es ENTERO DE PORCENTAJE (21/10/4/0) — convención de `AlbaranLinea.tipoIva`, NO la
    // fracción de `Quote.lines[].tax`. Mezclarlas multiplica el IVA por cien sin que nada falle, y
    // el schema lo avisa por escrito. Un 0 < tipo < 1 es casi con seguridad una fracción colada.
    if (e.vatRate > 0 && e.vatRate < 1) incoherencias.push(INCOHERENCIA.TIPO_IVA_PARECE_FRACCION);
    // `amount` es el TOTAL con IVA, así que la base es lo que queda al quitarle la cuota. Se
    // comprueba contra el tipo declarado, con la tolerancia de arriba.
    if (total !== null) {
      const base = total - cuota;
      const esperada = Math.round((base * e.vatRate) / 100);
      if (Math.abs(esperada - cuota) > TOLERANCIA_CENTIMOS) {
        incoherencias.push(INCOHERENCIA.CUOTA_NO_CUADRA_CON_EL_TOTAL);
      }
    }
  }

  if (texto(e.providerInvoiceNumber) === null) faltan.push(FALTA.NUMERO_FACTURA_PROVEEDOR);

  // ── EL QUE NO SE DERIVA ────────────────────────────────────────────────────────────────
  // Si ya falta algo comprobable, no se pregunta por el papel: pedirle al usuario que confirme el
  // NIF de un documento al que además le falta la cuota es hacerle trabajar para nada.
  if (faltan.length > 0) {
    return { veredicto: VEREDICTO.NO_DEDUCIBLE, faltan, incoherencias };
  }
  if (e.vatDeducible === true) {
    return { veredicto: VEREDICTO.DEDUCIBLE, faltan: [], incoherencias };
  }
  if (e.vatDeducible === false) {
    // Alguien miró el papel y decidió que no. Se respeta: el sistema no reabre una decisión humana.
    return {
      veredicto: VEREDICTO.NO_DEDUCIBLE,
      faltan: [FALTA.NIF_DESTINATARIO_EN_EL_DOCUMENTO],
      incoherencias,
    };
  }
  return {
    veredicto: VEREDICTO.FALTA_CONFIRMAR,
    faltan: [FALTA.NIF_DESTINATARIO_EN_EL_DOCUMENTO],
    incoherencias,
  };
}

/**
 * ¿Hay que avisar al profesional de que este justificante no le sirve para deducir?
 *
 * Se separa del veredicto a propósito: **una factura completa no puede disparar el aviso**. Si
 * avisara siempre, el usuario aprendería a ignorarlo y habríamos construido ruido — es una de las
 * verificaciones exigidas por el ticket, no una preferencia.
 */
export function avisaDeSimplificado(c: Clasificacion): boolean {
  return c.veredicto === VEREDICTO.NO_DEDUCIBLE;
}
