// src/modules/billing/domain/instanteDeCobro.ts — SCRUM-397.
//
// CUÁNDO ENTRÓ EL EURO EN UN COBRO. Puro: sin BD, sin red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, QUE NO ERA "FALTA UNA COLUMNA"
//
// `charges.paid_at` existía y no la escribía nadie — pero el instante SÍ estaba guardado, en el
// `Event{type:'paid'}` que se crea en la MISMA operación que el cambio de estado. El problema real,
// medido en el PASO 0, era que **tres consumidores daban tres respuestas distintas**:
//
//   · `receipt.routes.ts`  → el evento `paid` MÁS RECIENTE. Y `psp.routes.ts:32` crea otro cada vez
//     que el webhook se repite, así que **el recibo del CLIENTE enseñaba la fecha del reintento**.
//   · `exports.routes.ts`  → el PRIMER evento `paid` (lo correcto).
//   · `exportData.ts`      → `updatedAt`, que es «la última vez que alguien tocó la fila».
//
// ⚠️ Y LA VÍCTIMA QUE DECIDE EL DISEÑO: un Bizum recibido el **31 de marzo** y confirmado por el PRO
// el **2 de abril** quedaba fechado en abril. **Cruza de trimestre**, y con criterio de caja eso es
// el euro declarado en el periodo que no toca.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UN SOLO GENERADOR, Y NO DOS ASIGNACIONES QUE "SE PARECEN"
//
// `datosDeCobroPagado()` devuelve la columna Y el evento con **el mismo objeto `Date`**. No es
// estilo: si cada uno se escribiera con su `new Date()` serían **dos relojes**, y la columna se
// convertiría en la cuarta respuesta distinta — exactamente lo que este ticket vino a cerrar.
// Aquí no pueden discrepar porque no hay dos sitios donde escribirlos.
//
// ⚠️ NO HAY BACKFILL. Los cobros anteriores nacen con `paid_at` NULL, que es la verdad («no consta
// cuándo»). Rellenarlos con `updatedAt` sería fabricar el dato que el ticket denuncia. Para ellos
// `fechaDeCobroDeCharge()` recupera el instante del evento, que **no es inventarlo**: es leerlo
// donde sí estaba.

import { resolverFechaDeCobro, type EntradaFecha, type ResolucionFecha } from './fechaDeCobro';

export type { EntradaFecha, ResolucionFecha };

/** Lo mínimo que hay que saber de un evento para responder «cuándo se pagó». */
export type EventoDeCobro = { type?: string | null; ts?: Date | string | null };
export type CobroConEventos = {
  paidAt?: Date | string | null;
  events?: ReadonlyArray<EventoDeCobro> | null;
};

/**
 * Resuelve el instante de un cobro que se marca pagado.
 *
 * `declarada` viene del cuerpo del webhook (`ts`). Hoy los **seis** reenviadores mandan el instante
 * de proceso, así que para los automáticos esto no cambia nada; el que trae fecha de verdad es el
 * camino MANUAL (`confirm-bizum`), que es donde el trimestre se cruzaba.
 *
 * Las reglas de qué fecha se admite —futura no, hacia atrás sin límite— NO se reimplementan aquí:
 * son las de `fechaDeCobro.ts`, aprobadas por el fundador para las facturas en el bloque B de
 * `docs/master/SCRUM-397.md`, donde consta el criterio y su motivo. Un segundo criterio para lo
 * mismo volvería a ser dos respuestas para un solo hecho.
 */
export function resolverInstanteDeCobro(declarada: EntradaFecha, ahora: Date = new Date()): ResolucionFecha {
  return resolverFechaDeCobro(declarada, ahora);
}

/**
 * El fragmento `data` de Prisma para marcar un cobro pagado: columna y evento, **un solo instante**.
 *
 * Se devuelve el objeto entero —y no solo la fecha— para que en la ruta no quede ninguna decisión
 * que tomar: quien quiera marcar un cobro pagado no puede olvidarse del evento ni fecharlo aparte.
 */
export function datosDeCobroPagado(fecha: Date, payload: unknown) {
  return {
    status: 'paid',
    paidAt: fecha,
    events: { create: { type: 'paid', ts: fecha, payload: payload as any } },
  };
}

/**
 * CUÁNDO SE PAGÓ, para quien lo lee. **Un solo sitio para los tres consumidores.**
 *
 * Orden, y cada escalón tiene su motivo:
 *   1. `paid_at` — el dato propio, desde este ticket.
 *   2. el evento `paid` MÁS ANTIGUO — para los cobros anteriores a la columna. El más antiguo y no
 *      el más reciente: los reintentos del webhook crean duplicados (`psp.routes.ts:32`), y el
 *      cobro ocurrió la primera vez, no la última.
 *   3. `null` — «no consta cuándo». Nunca `updatedAt`: eso es cuándo se tocó la fila.
 */
export function fechaDeCobroDeCharge(cobro: CobroConEventos | null | undefined): Date | null {
  if (!cobro) return null;
  if (cobro.paidAt) {
    const propio = new Date(cobro.paidAt);
    if (Number.isFinite(propio.getTime())) return propio;
  }
  let primero: Date | null = null;
  for (const e of cobro.events || []) {
    if (!e || e.type !== 'paid' || !e.ts) continue;
    const t = new Date(e.ts);
    if (!Number.isFinite(t.getTime())) continue;
    if (primero === null || t < primero) primero = t;
  }
  return primero;
}
