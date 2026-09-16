// src/modules/billing/domain/fechaDeCobro.ts — SCRUM-397.
//
// CUÁNDO ENTRÓ EL DINERO, cuando lo marca una persona. Puro: sin BD, sin red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `paidAt` se escribía SIEMPRE con `new Date()`. Medido: **cinco sitios**, no tres —
// `mpWebhook:142`, `psp:121`, `psp:167` (webhooks, correctos), `invoicesAdmin:373` (marcado MANUAL
// EN LOTE) e `invoicesAdmin:907` (nace una R1, fuera de alcance).
//
// **La víctima:** un pago del 31 de marzo conciliado el 2 de abril queda fechado en abril. Cruza de
// trimestre — y con criterio de caja es el euro declarado en el periodo que no toca. Lo heredan
// `maintenance.service.ts:496` y `weeklyDigest.service.ts:68`, que agrupan POR `paidAt`.
//
// Y en el marcado EN LOTE el defecto se multiplica por el número de facturas de la selección.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CRITERIO, APROBADO (fundador, 10-ago-2026)
//
//   · NO se admite fecha FUTURA. Una fecha futura no puede ser un hecho: el dinero no ha entrado.
//     Rechazarla no pierde nada.
//   · HACIA ATRÁS, SIN LÍMITE. Un tope convertiría «no me deja» en «pongo la de hoy» — que es el
//     defecto de este ticket con el usuario forzado a cometerlo. El caso real es conciliar una
//     transferencia vieja.
//
// ⚠️ DECLARADO: esto roza el criterio de caja (A3), bloqueado esperando al asesor. Se revisa cuando
// conteste. Mientras tanto, lo que se guarda es lo que la persona AFIRMA, no lo que el reloj dice.

/** Lo que se admite en el cuerpo: una fecha ISO (`2026-03-31`) o el instante completo. */
export type EntradaFecha = string | Date | null | undefined;

export const COPY_FECHA_FUTURA = 'Esa fecha no puede ser posterior a hoy.';
export const COPY_FECHA_ILEGIBLE = 'No reconozco esa fecha.';

export type ResolucionFecha =
  | { ok: true; fecha: Date; origen: 'declarada' | 'ahora' }
  | { ok: false; error: 'fecha_futura' | 'fecha_ilegible'; message: string };

/**
 * Resuelve la fecha de cobro de un marcado MANUAL.
 *
 * ⚠️ Sin entrada devuelve `ahora`, y eso NO es el defecto: es el valor por defecto que la pantalla
 * propone y la persona puede cambiar. El defecto era que **no se podía cambiar**.
 *
 * `ahora` se inyecta para que el test pueda situarse un 2 de abril sin tocar el reloj del proceso.
 */
export function resolverFechaDeCobro(entrada: EntradaFecha, ahora: Date = new Date()): ResolucionFecha {
  if (entrada === null || entrada === undefined || entrada === '') {
    return { ok: true, fecha: ahora, origen: 'ahora' };
  }

  const d = entrada instanceof Date ? entrada : new Date(String(entrada));
  if (!Number.isFinite(d.getTime())) {
    return { ok: false, error: 'fecha_ilegible', message: COPY_FECHA_ILEGIBLE };
  }

  // Se compara por INSTANTE, y el margen es el propio día de hoy: una fecha ISO sin hora llega
  // como medianoche UTC, así que «hoy» tiene que seguir valiendo aunque el reloj vaya por la tarde.
  const finDeHoy = new Date(ahora);
  finDeHoy.setHours(23, 59, 59, 999);
  if (d.getTime() > finDeHoy.getTime()) {
    return { ok: false, error: 'fecha_futura', message: COPY_FECHA_FUTURA };
  }

  return { ok: true, fecha: d, origen: 'declarada' };
}

/**
 * 🔴 EL LOTE: UNA fecha para toda la selección, y es una decisión, no una simplificación.
 *
 * `POST /bulk-paid` marca N facturas de golpe. Dos formas:
 *
 *   · **una por factura** — más fiel, pero exige una fila editable por documento y convierte una
 *     acción de dos clics en un formulario;
 *   · **una para el lote** — la elegida.
 *
 * **Por qué la del lote:** la acción que la persona ejecuta ES una sola afirmación — «estas se
 * cobraron el día X». Si se cobraron en días distintos, eso son DOS hechos distintos y se marcan en
 * dos operaciones. Lo que no puede pasar es que el producto ponga la misma fecha a documentos de
 * días distintos **sin que nadie lo haya dicho**, que es justo lo que hacía `new Date()`.
 *
 * Por eso la pantalla lo dice (microcopy aprobada) y la auditoría lo registra: queda escrito que la
 * fecha la afirmó una persona para TODO el lote, no que el sistema la dedujo.
 */
export const COPY_LOTE_UNA_FECHA =
  'Se aplicará esta fecha a todas las facturas seleccionadas. Si se cobraron en días distintos, márcalas por separado.';
