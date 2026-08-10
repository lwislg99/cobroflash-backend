// src/modules/billing/domain/cobros.service.ts — SCRUM-285 (B4)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ ES UN COBRO AQUÍ, Y POR QUÉ SON DOS POBLACIONES Y NO UNA
//
// El diseño §B4 pide un menú «Cobros = los cobros con su justificante». La tentación es listar
// `Charge` y ya está. **Medido: eso esconde dinero.**
//
// Un cobro por TRANSFERENCIA o EFECTIVO no crea `Charge`: `updateInvoiceStatusAdmin`
// (`system/invoiceAdmin.ts:93`) marca `paidAt` en la Invoice y no toca `Charge` en ningún punto,
// y `Invoice.chargeId` es nullable. O sea que los cobros que el profesional marca A MANO —los que
// más necesita repasar, porque nadie los ha confirmado por él— no aparecerían.
//
// > **Una pantalla que lista solo `Charge` no está incompleta: miente por omisión.**
//
// Así que la población es la UNIÓN, sin solaparse:
//   · todo `Charge` del merchant (pedido, cobrado o caducado);
//   · toda `Invoice` SIN `chargeId` — su cobro no pasó por ninguna pasarela. Cobrada (dinero que
//     entró y solo consta aquí) o pendiente (la deuda que hoy hay que deducir mirando Facturas).
//
// El `chargeId: null` es lo que impide contar dos veces: si la factura tiene charge, el charge ya
// la representa.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL MÉTODO NO SE PUEDE SABER DE LA MITAD, Y NO SE INVENTA
//
// `Charge.method` existe. **`Invoice` NO guarda método de cobro** — medido sobre el esquema: no hay
// `paidVia` ni equivalente. Así que de un cobro marcado a mano **no consta cómo entró el dinero**.
//
// No se rellena con un valor por defecto. Escribir «transferencia» porque suele serlo es
// exactamente el bug que `paidVia.ts` cierra («ante lo desconocido, no se toca el método del cobro
// y se grita en el log»). Sale con `metodo: null` y la pantalla lo agrupa aparte, DICIÉNDOLO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FECHA DE LA DEUDA es `createdAt`, y es la fiable
//
// «Antigüedad de la deuda» es de lo que está SIN cobrar, así que se mide desde que el cobro se
// pidió (o la factura se emitió) — dato que no se toca nunca. NO se usa `paidAt` ni `updatedAt`:
// ninguno es la fecha en que entró el dinero (hallazgo E0 del censo de este mismo ticket), y para
// la deuda ni siquiera hacen falta.
import { prisma } from '../../../core/db/prisma';

/** Un cobro, venga de donde venga. Forma ÚNICA para que la pantalla no sepa de dónde salió. */
export type Cobro = {
  origen: 'charge' | 'invoice';
  id: number;
  fecha: string;
  cliente: string | null;
  concepto: string | null;
  importe: string;
  moneda: string;
  /** `null` = no consta. NO es «otro»: es que nadie lo registró. */
  metodo: string | null;
  estado: string;
  referencia: string | null;
  /** Número del documento, si lo hay. La pantalla lo clasifica con `tipoDeFactura`. */
  numero: string | null;
  tipo: string | null;
  invoiceId: number | null;
  chargeId: number | null;
};

/** Estados que cuentan como DEUDA: dinero pedido o facturado que todavía no ha entrado. */
export const ESTADOS_DEUDA = ['pending'] as const;

export function esDeuda(cobro: Pick<Cobro, 'estado'>): boolean {
  return (ESTADOS_DEUDA as readonly string[]).includes(cobro.estado);
}

/** Días que lleva pendiente. `null` si no es deuda — un cobro cobrado no tiene antigüedad de deuda. */
export function diasDeDeuda(cobro: Cobro, ahora = new Date()): number | null {
  if (!esDeuda(cobro)) return null;
  const desde = new Date(cobro.fecha).getTime();
  if (Number.isNaN(desde)) return null;
  return Math.max(0, Math.floor((ahora.getTime() - desde) / 86400000));
}

/**
 * Los cobros del merchant, las dos poblaciones fundidas y ordenadas por fecha.
 *
 * Multi-tenant: las dos consultas filtran por `merchantId` (regla 2).
 */
export async function listarCobros(merchantId: number): Promise<Cobro[]> {
  const [charges, sueltas] = await Promise.all([
    prisma.charge.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    // Las que NO pasaron por pasarela. Con charge, el charge ya las representa.
    prisma.invoice.findMany({
      where: { merchantId, chargeId: null },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const deCharge: Cobro[] = charges.map((ch) => ({
    origen: 'charge',
    id: ch.id,
    fecha: ch.createdAt.toISOString(),
    cliente: ch.customer?.name ?? null,
    concepto: ch.concept ?? null,
    importe: String(ch.amount),
    moneda: ch.currency,
    metodo: ch.method ?? null,
    estado: ch.status,
    referencia: ch.reference ?? null,
    numero: null,
    tipo: null,
    invoiceId: null,
    chargeId: ch.id,
  }));

  const deInvoice: Cobro[] = sueltas.map((inv) => ({
    origen: 'invoice',
    id: inv.id,
    fecha: inv.createdAt.toISOString(),
    cliente: inv.customer?.name ?? null,
    concepto: null,
    importe: String(inv.total),
    moneda: inv.currency,
    metodo: null, // no consta: la Invoice no guarda método. No se inventa.
    estado: inv.status,
    referencia: null,
    numero: inv.number,
    tipo: (inv as { type?: string | null }).type ?? null,
    invoiceId: inv.id,
    chargeId: null,
  }));

  return [...deCharge, ...deInvoice]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
