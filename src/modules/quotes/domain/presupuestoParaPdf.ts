// src/modules/quotes/domain/presupuestoParaPdf.ts — SCRUM-734
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL ÚNICO SITIO DONDE SE DECIDE QUÉ LLEVA EL PDF DE UN PRESUPUESTO.
//
// ── EL DEFECTO QUE ESTO CIERRA, MEDIDO ─────────────────────────────────────────────────────
//
// El mismo documento se generaba desde TRES puertas, y cada una armaba a mano su objeto de
// veinte claves. Escritas en tres tickets distintos, habían divergido:
//
//   · P3 (`GET /admin/quotes/:id/pdf`, la que SOBRESCRIBE `pdfUrl`) no conocía
//     `discountGlobalAmount` (SCRUM-731), `modoIva`, `clausulas` ni `clausulasExcluidas`.
//   · P2 (regenerar al firmar) no conocía `tiers`.
//
// Añadir los cuatro campos a mano habría dejado el quinto para dentro de un mes: el defecto no
// es qué campo falta, es **que haya tres listas**. Aquí hay una.
//
// ── POR QUÉ ESTO ES IMPOSIBLE Y NO VIGILADO ────────────────────────────────────────────────
//
// `Completo<T>` quita el `?` de todas las claves de `ParamsPdfPresupuesto`. Efecto: **una clave
// que falte no compila**. No hace falta un guard que lo vigile —el compilador ya lo impide— y,
// lo que importa más, el día que alguien añada un parámetro NUEVO al documento, este fichero
// deja de compilar hasta que decida de dónde sale. Un guard habría avisado después; esto no
// deja llegar.
//
// Los valores siguen pudiendo ser `null`: los catorce opcionales del PDF ya declaraban `| null`,
// así que «no hay firma» se dice con `null` y no omitiendo la clave. La distinción que importa
// —«este documento no lleva firma»— se conserva; la que se pierde —«esta puerta se olvidó de la
// firma»— es justo la que había que perder.
//
// ── 🔴 SE ALIMENTA DE LA FILA DE AHORA, NO DE LA DE ANTES ──────────────────────────────────
//
// Medido en P2: la ruta actualiza el presupuesto (`total` y `lines` cambian cuando el cliente
// elige un tramo) y **regeneraba el PDF desde la fila ANTERIOR a esa actualización**. El cliente
// elegía la opción «Better», firmaba, y el papel que quedaba guardado enseñaba el total viejo.
// Esta función recibe `quote` y no lo va a buscar: quien la llame tiene que pasarle la fila que
// vale AHORA, y eso está escrito aquí para que no se lea como un detalle.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import type { ParamsPdfPresupuesto } from '../../invoicing/infra/pdf/pdf.service';
import { leerClausulasDelMerchant } from './clausulas';
import { getLocale } from '../../../core/i18n/locales';

/** Todas las claves, obligatorias. Lo que hace que «se me olvidó una» no compile. */
export type Completo<T> = { [K in keyof T]-?: T[K] };

export type ParamsCompletosDelPresupuesto = Completo<ParamsPdfPresupuesto>;

/**
 * 🔴 EL SUELO DE LA LECTURA DE CLÁUSULAS: «no ha configurado ninguna» y «no supe leerlas» acaban
 * las dos en un PDF sin condiciones, y significan lo contrario.
 *
 * Viene TAL CUAL de `quotes.routes.ts`, donde era una función privada que sólo veían dos de las
 * tres puertas — y ésa era exactamente la forma del defecto. El comportamiento no cambia: una
 * columna ilegible sigue dando cero cláusulas, que es lo único seguro que se puede hacer con
 * ella, y sigue quedando registrado. Sin esto, un JSON roto en `merchants.clausulas_presupuesto`
 * deja de imprimir la garantía de todos los presupuestos de ese merchant sin una línea en ningún
 * sitio que lo diga: se descubre el día que un cliente discute la garantía.
 */
// NO SE EXPORTA: sólo lo usa el constructor de aquí abajo. Exportarlo lo dejaría como huérfano
// —un export sin llamador, que desde fuera es indistinguible de una función entregada— y el
// censo de SCRUM-411 lo cazaría con razón.
function clausulasDelMerchantParaPdf(merchant: any) {
  const leido = leerClausulasDelMerchant((merchant as any)?.clausulasPresupuesto);
  if (!leido.ok) {
    console.error(
      '[quotes] clausulas_presupuesto ILEGIBLE para el merchant', (merchant as any)?.id,
      '— el PDF saldrá SIN condiciones. No es que no tenga: es que no se han podido leer.',
    );
    return [];
  }
  return leido.clausulas;
}

/** Lo mínimo que hace falta saber para pintar el documento. Deliberadamente laxo (`any` en los
 *  campos que Prisma tipa como `JsonValue`): lo que se vigila aquí es que NO FALTE NINGUNO, no
 *  volver a declarar el modelo. */
export type FuentesDelPresupuesto = {
  quote: any;
  merchant: any;
  customer: any;
};

/**
 * El objeto ENTERO que espera `generateQuotePdf`, derivado de la fila.
 *
 * Todo sale de `quote`, `merchant` y `customer`: **no hay ni un campo que aplique legítimamente a
 * una sola puerta**, y está medido — incluida la firma, que en P2 ya está escrita en la fila
 * (`signatureUrl`, `acceptedAt`) antes de regenerar el papel, así que no hace falta pasarla por
 * separado.
 */
export function paramsDePresupuestoParaPdf(f: FuentesDelPresupuesto): ParamsCompletosDelPresupuesto {
  const { quote, merchant, customer } = f;
  return {
    quoteId: quote.id,
    // A1.2: número visible por merchant; si falta, el documento muestra el id.
    quoteNumber: quote.quoteNumber ?? null,
    merchant: {
      name: merchant.name,
      legalName: merchant.legalName ?? null,
      taxId: merchant.taxId ?? null,
      address: merchant.address ?? null,
      whatsappPhone: merchant.whatsappPhone ?? null,
      logoUrl: merchant.logoUrl ?? null,
    },
    // A20.4: cliente empresa — la razón social manda sobre el nombre dentro del documento.
    customer: {
      name: customer.name,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      legalName: customer.legalName ?? null,
      taxId: customer.taxId ?? null,
    },
    docFields: (quote.docFields as any) ?? null,
    // SCRUM-594 · el descuento global, DE LA FILA: el papel dice lo que quedó GUARDADO.
    discountGlobalAmount: quote.discountGlobalAmount ?? null,
    // SCRUM-593 · los dos textos libres del documento.
    docHeaderText: quote.docHeaderText ?? null,
    docFooterText: quote.docFooterText ?? null,
    // SCRUM-602 · la dirección de la obra va EN CRUDO: quien resuelve los tres modos es el
    // documento, para que las tres puertas no puedan decir direcciones distintas.
    direccionObra: {
      modo: quote.shippingAddressMode ?? null,
      personalizada: quote.shippingAddress ?? null,
      cliente: customer,
    },
    currency: quote.currency,
    total: quote.total.toString(),
    lines: (Array.isArray(quote.lines) ? quote.lines : []) as any,
    // La firma sale de la FILA y no de la petición: cuando P2 llega aquí ya la ha escrito.
    signatureData: quote.signatureUrl ?? null,
    signedAt: quote.acceptedAt ?? null,
    country: merchant.country ?? null,
    // SCRUM-647 · la resolución por PAÍS vive aquí y no dentro del documento: es la que miente en
    // Canarias (IGIC) y en Ceuta y Melilla (IPSI). Cuando SCRUM-646 traiga el territorio, se
    // cambia en ESTE sitio, que ahora es uno solo.
    taxName: getLocale(merchant.country).vatName,
    // SCRUM-656 · cómo presenta el IVA ESTE presupuesto, y las cláusulas de cierre.
    modoIva: (quote.ivaModo as any) ?? null,
    clausulas: clausulasDelMerchantParaPdf(merchant),
    clausulasExcluidas: (quote.clausulasExcluidas as any) ?? null,
    tiers: (quote.tiers as any) ?? null,
  };
}
