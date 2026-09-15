// src/modules/billing/domain/gatewayEvents.service.ts — SCRUM-815 · ③ el escritor
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ EVENTOS DE LA PASARELA SE HAN ATENDIDO YA, Y CUÁLES LLEGARON Y NO TERMINARON.
//
// El defecto que cierra esto: `isDuplicateStripeEvent` marca el evento como visto ANTES de
// procesarlo. Si el trabajo falla después, la ruta responde 400, Stripe reintenta… y el
// reintento encuentra el evento «ya visto» y se descarta sin hacer nada. El trabajo no se
// pierde por el fallo: se pierde por la marca puesta antes de tiempo.
//
// ⚠️ Y la memoria NO era el tercer modo de pérdida por casualidad: `seenStripeEvents` es un
// `Set` del módulo con tope 500, así que olvida **sin reiniciar y sin escalar**. Stripe
// reentrega durante 3 días. Por eso esto vive en DISCO y no en un `Map`: un arreglo en
// memoria sería el mismo defecto una capa más arriba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL ORDEN ES TODA LA PROPIEDAD, y son dos marcas de tiempo, no un booleano
//
//   received_at   processed_at   qué significa                    qué hace el reintento
//   ───────────── ────────────── ──────────────────────────────── ──────────────────────
//   puesto        **NULL**       llegó y NO terminó               ENTRA: el trabajo no está hecho
//   puesto        puesto         terminó bien                     200 sin repetir
//   —             —              no ha llegado nunca               se procesa
//
// `processed_at` se escribe **al terminar con éxito, nunca antes**. Un booleano `processed`
// no distingue «en curso» de «murió a medias»: sería el `Set` de hoy con más pasos y
// sobreviviendo a los despliegues.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⛔ ESTO NO SE ENCIENDE PARA LOS SIETE TIPOS, Y ES UNA EXCLUSIÓN DELIBERADA
//
// Ver `EVENTOS_CON_REGISTRO`. El motivo entero está ahí y no se repite aquí.
import { prisma as defaultPrisma } from '../../../core/db/prisma';

/** El `provider` de la tabla. Hoy sólo hay uno; la columna existe para que quepa el siguiente. */
const PROVEEDOR_STRIPE = 'stripe';

/** `last_error` es `VarChar(500)`: un mensaje más largo no se trunca solo, revienta la escritura. */
const MAX_LAST_ERROR = 500;

/**
 * 🔴 LOS CINCO TIPOS QUE LLEVAN REGISTRO — y los DOS que NO, a propósito.
 *
 * Censado por AST en SCRUM-815b: de los siete tipos que despacha el webhook, cinco son seguros
 * de repetir y dos no lo son. El protocolo hace que un evento que murió a medias VUELVA A
 * ENTRAR en el reintento siguiente — que es justo lo que se quiere para los cinco, y justo lo
 * que NO se quiere para los otros dos:
 *
 *   · `charge.dispute.created` manda un WhatsApp al profesional y escribe una fila de línea de
 *     tiempo. Repetirlo es «han disputado tu cobro» otra vez, a una persona. Ya lo dedupe su
 *     propio servicio con una marca en disco (SCRUM-815, efecto ③), así que aquí no hace falta
 *     y encenderlo sería un segundo mecanismo sobre el mismo evento.
 *   · `checkout.session.completed` manda el correo de primer pago y premia al referido. El
 *     correo no se deshace y el referido tiene una carrera conocida: repetirlo puede regalar
 *     dos meses gratis.
 *
 * 🔒 Hoy el defecto es SILENCIOSO: se pierden eventos. Encender el protocolo para los siete lo
 *    volvería RUIDOSO —correo reenviado, WhatsApp repetido, mes gratis duplicado—. Cambiar un
 *    fallo callado por uno que el cliente ve no es progreso. Decisión del asesor, 15-sep-2026.
 *
 * Lo que queda fuera sigue **exactamente como hoy**: con el LRU en memoria de la ruta. Su
 * arreglo es otro trabajo, no éste.
 */
const EVENTOS_CON_REGISTRO: readonly string[] = Object.freeze([
  'payment_intent.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.created',
  'customer.subscription.deleted',
  'checkout.session.expired',
]);

/** Los dos que se dejan fuera, nombrados: una exclusión que no se enumera parece un olvido. */
export const EVENTOS_SIN_REGISTRO: readonly string[] = Object.freeze([
  'charge.dispute.created',
  'checkout.session.completed',
]);

export function llevaRegistro(tipo: string): boolean {
  return EVENTOS_CON_REGISTRO.includes(tipo);
}

/**
 * Qué hacer con esta entrega.
 *
 * `hacer` — o es la primera vez, o el intento anterior no terminó. En los dos casos el trabajo
 * se hace: repetir un intento que murió a medias es el objetivo, no un efecto colateral.
 * `ya_procesado` — hay una fila con `processed_at` puesto. Duplicado real: ACK sin trabajo.
 */
export type DecisionDeEntrega = 'hacer' | 'ya_procesado';

/** Lo mínimo que este servicio necesita del cliente de Prisma — así un test puede doblarlo. */
type ClienteGatewayEvent = {
  gatewayEvent: {
    create(args: any): Promise<any>;
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
};

const clave = (eventId: string, provider: string) =>
  ({ provider_eventId: { provider, eventId } });

/**
 * 🔴 Choque contra el índice único, y NADA MÁS.
 *
 * `P2002` es el código de Prisma para «violación de restricción única». Se compara el CÓDIGO y
 * no el mensaje: el texto va traducido y cambia entre versiones, y tragarse cualquier error
 * aquí convertiría una base caída en un «ya existe» — o sea, en un evento dado por bueno que
 * nunca se escribió.
 */
function esChoqueDelUnico(e: any): boolean {
  return e?.code === 'P2002';
}

/**
 * PASO 1 · AL RECIBIR, antes de despachar. Deja constancia de que el evento llegó.
 *
 * El `INSERT` es el mecanismo: si dos réplicas atienden la misma entrega a la vez, una escribe
 * y la otra choca contra `@@unique([provider, eventId])`. No hay ventana entre comprobar y
 * escribir porque no se comprueba: se escribe y se mira el choque.
 */
export async function abrirRegistroDeEvento(
  eventId: string,
  tipo: string,
  db: ClienteGatewayEvent = defaultPrisma as unknown as ClienteGatewayEvent,
  provider: string = PROVEEDOR_STRIPE,
): Promise<DecisionDeEntrega> {
  try {
    // `received_at` lo pone la base (`@default(now())`): el instante de llegada no lo decide
    // el proceso, y así ninguna fila puede quedarse sin él.
    await db.gatewayEvent.create({ data: { provider, eventId, type: tipo } });
    return 'hacer';
  } catch (e) {
    if (!esChoqueDelUnico(e)) throw e;

    const fila = await db.gatewayEvent.findUnique({ where: clave(eventId, provider) });
    // La fila TIENE que estar: acabamos de chocar contra su índice. Si no aparece, alguien la
    // borró entre medias y no se puede decidir nada — se hace el trabajo, que es el lado
    // seguro para los cinco tipos de esta lista (todos idempotentes al repetir).
    if (fila?.processedAt) return 'ya_procesado';

    // Llegó y no terminó. Se cuenta el intento —un evento atascado tiene que ser VISIBLE, si no
    // es indistinguible de uno recién llegado— y se vuelve a hacer el trabajo.
    await db.gatewayEvent.update({
      where: clave(eventId, provider),
      data: { attempts: { increment: 1 } },
    });
    return 'hacer';
  }
}

/**
 * PASO 2 · AL TERMINAR CON ÉXITO, y nunca antes.
 *
 * 🔴 Ésta es la línea que separa este ticket de su defecto. Marcar al recibir es lo que hace
 * hoy la ruta, y es lo que pierde el reintento cuando el trabajo falla después.
 */
export async function marcarEventoProcesado(
  eventId: string,
  db: ClienteGatewayEvent = defaultPrisma as unknown as ClienteGatewayEvent,
  provider: string = PROVEEDOR_STRIPE,
): Promise<void> {
  await db.gatewayEvent.update({
    where: clave(eventId, provider),
    data: { processedAt: new Date() },
  });
}

/**
 * PASO 3 · SI FALLA. Se anota el motivo y `processed_at` se queda a NULL — que es lo que deja
 * la puerta abierta al reintento. La ruta sigue respondiendo 400, que es lo que hace que Stripe
 * vuelva a entregar; eso no se toca.
 *
 * No propaga: si la anotación falla, el fallo que importa es el de arriba. Tragarse el original
 * para gritar que no se pudo escribir el diagnóstico sería cambiar el error por su nota.
 */
export async function anotarFalloDeEvento(
  eventId: string,
  motivo: string,
  db: ClienteGatewayEvent = defaultPrisma as unknown as ClienteGatewayEvent,
  provider: string = PROVEEDOR_STRIPE,
): Promise<void> {
  try {
    await db.gatewayEvent.update({
      where: clave(eventId, provider),
      // El recorte es obligatorio, no cosmético: `last_error` es `VarChar(500)` y un mensaje
      // más largo no se corta solo — la escritura falla y el diagnóstico se pierde entero.
      data: { lastError: String(motivo ?? '').slice(0, MAX_LAST_ERROR) },
    });
  } catch (e: any) {
    console.error('[gateway-events] no se pudo anotar el fallo:', e?.message || e);
  }
}
