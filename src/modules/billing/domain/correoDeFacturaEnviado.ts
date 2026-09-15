// src/modules/billing/domain/correoDeFacturaEnviado.ts — SCRUM-815 (efecto: el correo duplicado)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿YA SE LE MANDÓ AL CLIENTE EL CORREO DE ESTA FACTURA?
//
// EL DEFECTO, medido en el paso ① §3 y en el apéndice 815b §4 de `docs/master/SCRUM-815.md`:
// la rama `already_paid` de `psp.routes.ts` llamaba a `ensureInvoiceForCharge` y REENVIABA
// `sendInvoiceEmail` en CADA reintento. Stripe reentrega hasta tres días, así que cada reintento
// de un cobro ya pagado era otro correo al cliente **con la misma factura**.
//
// 🔒 LA MARCA VIVE EN DISCO, NUNCA EN MEMORIA. El defecto entero de este expediente es una
//    memoria que se olvida al reiniciar: `isDuplicateStripeEvent` es un `Set` del módulo con tope
//    500, y en tres días el proceso se reinicia y cada entrega encuentra un `Set` vacío. Aquí la
//    marca es una fila de `events` — el mismo registro por cobro que ya usan `paid`, `invoiced` y
//    `emailed`, y es `emailed` la que se reusa: ya existe en el árbol (`dev.routes.ts:93`).
//
// 🔒 Y SE ESCRIBE AL TERMINAR, NUNCA ANTES. Marcar antes de hacer el trabajo es EL defecto que
//    este ticket viene a quitar: un envío que muera a medias habría dejado la marca puesta y el
//    cliente no recibiría nunca su factura. Marcando al final se paga, en el caso raro, con un
//    correo repetido en vez de con silencio.
//
// ⛔ NO es estado nuevo (regla 27): `Event.type` no es una FSM —la Parte L enumera los `status` de
//    Quote, Invoice, Charge, QuoteRequest, Customer, WhatsAppMessage, VfSubmission, Subscription,
//    Job y Albarán— y aquí no se toca ningún `status` ni ninguna transición. El tipo `emailed`
//    tampoco se inventa: ya se escribe hoy. Mismo razonamiento que el efecto ③ de este expediente.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { prisma as prismaPorDefecto } from '../../../core/db/prisma';

/**
 * El tipo de fila de `events` que hace de marca. No es nuevo: ya existe en el árbol.
 *
 * ⛔ NO se exporta, y no es un descuido. Nació con `export` y **SCRUM-411 lo cazó**: nadie lo
 * importaba, así que era un export inalcanzable y el censo de huérfanos pasaba de 240 a 241 y
 * dejaba de sumar. Se quitó el `export` en vez de declararlo en `_huerfanos-declarados.mjs`:
 * esa lista es para lo que TIENE que estar sin llamador —como `borrarMerchant` y el RGPD—, y
 * meter ahí algo que sobra es cambiar lo que el guard exige en vez de cambiar el código (41).
 * Si algún día hace falta fuera, se exporta el día que exista el llamador.
 */
const MARCA_CORREO = 'emailed';

/**
 * Lo MÍNIMO que estas dos funciones le piden a la base: el modelo `event` con `findMany` y
 * `create`. Los argumentos van como `any` a propósito y no como `unknown`: las firmas de Prisma
 * son genéricas (`<T extends EventFindManyArgs>(args?: …)`) y `unknown` no es asignable a ese
 * parámetro, así que el cliente de verdad NO cumpliría el tipo y el build cae. Medido: con
 * `unknown` el `tsc` salía con 2.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type BaseMinima = {
  event: {
    findMany: (args?: any) => Promise<any[]>;
    create: (args?: any) => Promise<any>;
  };
};

/**
 * ¿Consta en DISCO que el correo de ESTA factura ya salió para ESTE cobro?
 *
 * La clave es el `invoiceId`, que es lo estable entre reintentos: el mismo cobro reentregado
 * devuelve la MISMA factura (`ensureInvoiceForCharge` busca la existente antes de crear). No se
 * inventa ninguna clave.
 *
 * ⚠️ El filtro del `payload` se hace EN MEMORIA, misma decisión y mismo motivo que
 * `existeEventoDePlan` (SCRUM-394) y que `yaAtendida` (efecto ③ de este mismo expediente):
 * Postgres sabe consultar el JSON, pero eso ata el código al motor y falla distinto cuando el
 * campo es `null`. Los candidatos son poquísimos: los correos de UN cobro.
 *
 * 🔴 SI LA CONSULTA FALLA DEVUELVE `true` — «no lo sé, NO reenvíes». **Y es la asimetría
 * CONTRARIA a la de `yaAtendida`, a propósito.** Allí equivocarse hacia el silencio cuesta que el
 * profesional no se entere de una disputa, así que se falla hacia el aviso. Aquí equivocarse
 * hacia el envío cuesta **otro correo al cliente final con una factura que ya tiene**, que es
 * literalmente el defecto que este fichero quita — y el cliente sigue teniendo la factura
 * alcanzable por su enlace de recibo. Se falla hacia el silencio, y queda dicho.
 */
export async function yaSeEnvioElCorreo(
  chargeId: number,
  invoiceId: number,
  db: BaseMinima = prismaPorDefecto as unknown as BaseMinima,
): Promise<boolean> {
  try {
    const previos = await db.event.findMany({
      where: { chargeId, type: MARCA_CORREO },
      select: { payload: true },
      take: 50,
    });
    return previos.some(
      (e: { payload?: unknown }) =>
        !!e?.payload && Number((e.payload as { invoiceId?: unknown }).invoiceId) === invoiceId,
    );
  } catch (err: unknown) {
    console.error(
      '[correo-factura] no se pudo comprobar si ya se envió:',
      (err as { message?: string })?.message || err,
    );
    return true; // hacia el silencio, nunca hacia el correo repetido
  }
}

/**
 * Deja constancia EN DISCO de que el correo salió. Se llama DESPUÉS de que `sendInvoiceEmail`
 * haya vuelto, nunca antes.
 *
 * No puede tumbar la operación: si la marca no se puede escribir, el correo YA salió y lo peor
 * que pasa es que un reintento posterior lo repita — que es el estado de hoy, no uno peor.
 */
export async function marcarCorreoEnviado(
  chargeId: number,
  invoiceId: number,
  db: BaseMinima = prismaPorDefecto as unknown as BaseMinima,
): Promise<void> {
  try {
    await db.event.create({
      data: { chargeId, type: MARCA_CORREO, payload: { invoiceId } },
    });
  } catch (err: unknown) {
    console.error(
      '[correo-factura] no se pudo dejar constancia del envío:',
      (err as { message?: string })?.message || err,
    );
  }
}
