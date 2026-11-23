// src/modules/billing/app/routes/formasDePagoActivas.ts — SCRUM-1787u
//
// «QUÉ FORMAS DE PAGO ESTÁN ACTIVAS PARA ESTE COMERCIO Y ESTE IMPORTE», en UN solo sitio.
//
// Hasta SCRUM-1787u este cálculo vivía EN LÍNEA en la página pública de pago (`payInvoice.routes.ts`,
// `GET /pay/invoice/:token`). Se saca aquí, sin cambiar lo que decide, porque J1 lo necesita al emitir
// una factura (tramos 1787s y 1787s-bis): la factura congela las formas activas el día de la emisión
// (GO del fundador, SCRUM-1787 c.22401, «1-GO»). Dos copias del criterio divergirían; una función, no.
//
// Lo ata `tests/scrum1787u-formas-de-pago-activas.test.mjs`: la página y esta función dan el mismo
// oro (la decisión de la página ANTES de la extracción), y la página pinta lo que esta función devuelve.
//
// PURA respecto a la decisión: no lee la base ni el reloj. Los flags se leen con el MISMO lector que
// usaba la página (`isFlagEnabled`, con el comercio: override del comercio > país > entorno > tabla P).
import { isFlagEnabled } from '../../../../core/flags';
import { bizumAutoDisponible } from '../../domain/bizumCharge'; // SCRUM-3
import { cardChargeMode, type MerchantParaTarjeta } from '../../domain/cardCharge'; // SCRUM-893
import { transferenciaDisponible, type MerchantParaTransferencia } from '../../domain/transferenciaDisponible'; // SCRUM-910

/**
 * Las claves de siempre de la página de pago. `card`, `bizum` y `transfer` son además el vocabulario de
 * `payMethods` (cobro, presupuesto y factura); `bizum_auto` NO lo es: es el Bizum automático vía PSP,
 * hereda el permiso de `bizum` y comparte ruta con la tarjeta (`/pay/card`).
 */
export type FormaDePago = 'bizum' | 'bizum_auto' | 'card' | 'transfer';

/** Los campos del comercio que mira la decisión (el `Merchant` de Prisma los trae todos). */
export type ComercioParaFormasDePago =
  | (NonNullable<MerchantParaTarjeta> &
      NonNullable<MerchantParaTransferencia> & {
        bizumPhone?: string | null;
        whatsappPhone?: string | null;
      })
  | null
  | undefined;

export interface FormasDePagoActivasOpts {
  merchant: ComercioParaFormasDePago;
  /** Importe en unidades de la moneda (euros, no céntimos). */
  importe: number;
  /** Moneda del cobro (`EUR`…): el Bizum automático es sólo EUR. */
  moneda: string;
  /** La lista a la que el PRO limitó ESTE cobro (`payMethods`); `null`/ausente = todas las disponibles. */
  permitidas?: readonly string[] | null;
}

/**
 * Las formas de pago activas, en el orden en que la página de pago las ofrece (la primera es la
 * «Recomendado» cuando hay más de una).
 */
export function formasDePagoActivas({ merchant: m, importe, moneda, permitidas }: FormasDePagoActivasOpts): FormaDePago[] {
  // SCRUM-910 · la condición era `!!(m?.iban || m?.clabe)` y NO MIRABA EL PAÍS. Un negocio ES con
  // sólo CLABE veía «Transferencia bancaria» y aterrizaba en `/pay/bank`, que sólo pinta la CLABE
  // si el país es MX — así que le decía que el profesional no había configurado su cuenta. Se
  // pregunta al dominio, que replica la regla de la página destino y está atado a ella por test.
  const hasTransfer = transferenciaDisponible(m);

  // SCRUM-893 · SE PREGUNTA, NO SE SUPONE. Hasta hoy esto era
  //     `!connectFlag ? true : (connectStatus === 'active' || isDemoMerchant(m))`
  // y con `PAYMENTS_CONNECT_ENABLED` OFF —su valor por defecto— la primera rama ganaba SIEMPRE:
  // la tarjeta se ofrecía a todos, incluidos los merchants que se comen un 409 al pulsarla. La
  // clienta se quedaba en un bucle: única opción, RECOMENDADO, 409, «ver otras formas» → aquí.
  //
  // Ahora se le pregunta al MISMO dominio que decide en la puerta de cobro, con su vocabulario
  // (`connect` / `demo_platform` / `refuse`). No es «una condición más estricta»: es que ofrecer
  // y cobrar han dejado de ser dos preguntas. Reglas 18 y 23, y la 8 para el demo, viven allí y
  // no se reescriben aquí — reescribirlas sería crear la tercera copia del criterio.
  const hasCard = cardChargeMode(m) !== 'refuse';

  // Bizum manual: flag + móvil del PRO + límites bancarios del pagador (W4:
  // >1.000 € se oculta).
  const bizumPhone = m?.bizumPhone || m?.whatsappPhone || null;
  const hasBizum =
    isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: m }) && !!bizumPhone && importe <= 1000;

  // Selector al crear (quote/charge.payMethods): si el PRO limitó los métodos
  // para ESTE cobro, se respeta (null = todos los disponibles).
  const permits = (key: string) => !permitidas || permitidas.includes(key);

  // SCRUM-3 · Bizum AUTOMÁTICO (vía PSP), que convive con el manual — decisión del fundador
  // del 28-jul-2026: **los dos visibles, el manual primero**. El motivo, y conviene que no se
  // pierda: no se decide por el fontanero si prefiere ahorrarse el 0,9 % o tener confirmación
  // automática. Es su dinero y su tiempo. El manual va delante porque es GRATIS y es el que ya
  // conoce; el automático se etiqueta con su ventaja real —«se confirma solo»—, que es
  // exactamente lo que el manual no puede garantizar (es la única vía de la casa que puede
  // mentir sobre si el dinero llegó: la confirma el merchant a mano).
  //
  // Y esto NO contradice la regla 22 («el selector se ordena por probabilidad de cobro del
  // MERCHANT, no por el fee de YaQu»): poner delante el gratuito es justo lo contrario de
  // ordenar por nuestro fee — el manual no nos deja nada.
  const hasBizumAuto =
    bizumAutoDisponible({
      flagOn: isFlagEnabled('BIZUM_AUTO_ENABLED', { merchant: m }),
      useConnect: m?.connectStatus === 'active' && !!m?.stripeAccountId,
      currency: moneda,
      amountCents: Math.round(importe * 100),
    }) === 'ok';

  // Orden W4: ≤500 → Bizum + Tarjeta (transferencia detrás) · 500-1.000 →
  // Tarjeta principal, Bizum secundario · >1.000 → Tarjeta + transferencia.
  // Los TRAMOS no cambian con el Bizum automático (SCRUM-8): el techo de 1.000 € no lo pone
  // Stripe —que admite 5.000— sino el banco DEL PAGADOR (500-1.000 €/op, 2.000 €/día).
  // El automático se coloca SIEMPRE justo detrás del manual, en el hueco que ocupe Bizum.
  const porTramo: FormaDePago[] = importe <= 500 ? ['bizum', 'card', 'transfer'] : ['card', 'bizum', 'transfer'];
  const conBizumAuto: FormaDePago[] = hasBizumAuto
    ? porTramo.flatMap((k): FormaDePago[] => (k === 'bizum' ? ['bizum', 'bizum_auto'] : [k]))
    : porTramo;

  return conBizumAuto.filter((k) =>
    (k === 'card' && hasCard && permits('card')) ||
    (k === 'bizum' && hasBizum && permits('bizum')) ||
    // El automático hereda el permiso de 'bizum' (el PRO limitó "Bizum", no la fontanería
    // de cómo se confirma) y su propia disponibilidad ya la resolvió bizumAutoDisponible.
    (k === 'bizum_auto' && permits('bizum')) ||
    (k === 'transfer' && hasTransfer && permits('transfer')));
}
