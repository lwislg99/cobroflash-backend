// src/modules/invoicing/domain/formasDePagoACongelar.ts — SCRUM-1787s y 1787s-bis
//
// QUÉ FORMAS DE PAGO SE CONGELAN EN UNA FACTURA AL EMITIRSE. GO del fundador (regla 40, los dos
// caminos): SCRUM-1787 c.22401 («1-GO») y c.22404 («1-Sí a las dos»).
//
//   · en la factura tras cobrar, si el COBRO trae lista (`Charge.payMethods`), ESA lista, antes que la del
//     presupuesto (decisión del orquestador, SCRUM-1787 c.22423, lectura de c.22404);
//   · si el presupuesto trae lista (`Quote.payMethods` = ['card', …]), ESA lista (c.22404 b);
//   · si trae `null` («todas») o no hay presupuesto, las ACTIVAS HOY para el comercio y el total de
//     la factura, según la función de J2 (`formasDePagoActivas`, SCRUM-1787u), traducidas al
//     vocabulario de `Invoice.payMethods` (`card | bizum | transfer`): `bizum_auto` → `bizum`, sin
//     duplicados y en el orden en que la página de pago las ofrece;
//   · si no queda ninguna, `null` (la factura no congela nada, como hasta hoy).
//
// Lo congelado es lo del DÍA DE LA EMISIÓN (c.22401 ④): activar Bizum o Connect después no cambia
// una factura ya emitida (regla 29). Esta función no lee la base: recibe lo que el llamador ya tiene.
//
// La usan la factura suelta (`invoicesAdmin.routes.ts`, 1787s) y la factura tras cobrar
// (`ensureInvoiceForCharge`, 1787s-bis). Los cinco caminos de S1 (c.22404 a) la llaman igual.

import { CreateQuoteSchema } from '../../../core/validation/schemas';
import {
  formasDePagoActivas,
  type ComercioParaFormasDePago,
} from '../../billing/app/routes/formasDePagoActivas'; // SCRUM-1787u · de J2: se importa, no se toca

/** El vocabulario de `payMethods` (presupuesto, cobro y factura): se lee del esquema del presupuesto. */
export type FormaDePagoCongelada = NonNullable<
  ReturnType<typeof CreateQuoteSchema.shape.payMethods.parse>
>[number];

const VOCABULARIO: ReadonlySet<string> = new Set(
  CreateQuoteSchema.shape.payMethods.unwrap().element.options,
);

export interface FormasDePagoACongelarOpts {
  /** El cobro del que nace la factura (basta su `payMethods`): su lista manda sobre la del presupuesto (c.22423). */
  cobro?: { payMethods?: unknown } | null;
  /** El presupuesto del que sale la factura (basta su `payMethods`); `null`/ausente = factura sin presupuesto. */
  presupuesto?: { payMethods?: unknown } | null;
  /** El comercio que emite: los campos que mira `formasDePagoActivas` (el `Merchant` de Prisma vale). */
  merchant: ComercioParaFormasDePago;
  /** El total de la factura, en unidades de la moneda (euros, no céntimos). */
  importe: number;
  /** La moneda de la factura (`EUR`…). */
  moneda: string;
}

/** Deja solo valores del vocabulario, sin duplicados y en el orden en que llegan. */
function enVocabulario(valores: readonly unknown[]): FormaDePagoCongelada[] {
  const fuera: FormaDePagoCongelada[] = [];
  for (const v of valores) {
    const forma = v === 'bizum_auto' ? 'bizum' : v; // el Bizum automático hereda el permiso de `bizum`
    if (typeof forma === 'string' && VOCABULARIO.has(forma) && !fuera.includes(forma as FormaDePagoCongelada)) {
      fuera.push(forma as FormaDePagoCongelada);
    }
  }
  return fuera;
}

/**
 * Las formas de pago a CONGELAR en la factura, o `null` si no queda ninguna.
 *
 * Firma: `formasDePagoACongelar({ cobro?, presupuesto, merchant, importe, moneda }): FormaDePagoCongelada[] | null`
 */
export function formasDePagoACongelar({ cobro, presupuesto, merchant, importe, moneda }: FormasDePagoACongelarOpts): FormaDePagoCongelada[] | null {
  // La lista del cobro, si el profesional lo limitó, manda (c.22423). Solo `null`/ausente sigue adelante.
  const delCobro = cobro?.payMethods;
  if (Array.isArray(delCobro)) {
    const lista = enVocabulario(delCobro);
    return lista.length > 0 ? lista : null;
  }
  const delPresupuesto = presupuesto?.payMethods;
  // Una lista del presupuesto manda tal cual (c.22404 b). Solo `null`/ausente significa «todas».
  if (Array.isArray(delPresupuesto)) {
    const lista = enVocabulario(delPresupuesto);
    return lista.length > 0 ? lista : null;
  }
  const activas = enVocabulario(formasDePagoActivas({ merchant, importe, moneda }));
  return activas.length > 0 ? activas : null;
}
