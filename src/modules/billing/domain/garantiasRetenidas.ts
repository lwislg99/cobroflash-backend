// src/modules/billing/domain/garantiasRetenidas.ts — SCRUM-1108
//
// EL AVISO DE LA RETENCIÓN DE GARANTÍA: cuánto le retienen a cada cliente y si ya se puede reclamar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO SE REUSA NINGÚN RECORDATORIO QUE YA EXISTA (medido, docs/master/SCRUM-1108.md §2)
//
//   · `invoiceReminder.service.ts` parece el candidato («ya hay un recordatorio por fecha»), y NO
//     lo es: escribe al CLIENTE FINAL, por WhatsApp. Reusarlo sería mandarle al cliente «paga la
//     garantía» —asesorar a reclamar (regla 7)— y un envío automático nuevo fuera de la tabla J6
//     (regla 28), que para facturas fija 2 y ya los gasta.
//   · `maintenance.service.ts` sí avisa al profesional, pero por WhatsApp: copiarlo es un canal
//     automático nuevo, también regla 28.
//
// Así que el aviso es DERIVADO, como el de SCRUM-171b («aviso, no automatismo»): no se guarda en
// ningún sitio, no hay candado ni columna nueva, y no se envía nada. Se APAGA SOLO: en cuanto
// `retencionGarantiaCobrada` pasa a fecha (SCRUM-1107 lo hace en la misma transacción que crea el
// cobro de la liberación), `retencionPendiente` deja de ser cierto y el cobro sale de la cuenta.
//
// 🔴 CERO ASESORAMIENTO (regla 7): esto recuerda un dato que el profesional metió. Ni dice que
// reclame ni que tenga derecho a nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SOLO COBROS `paid`, Y NO ES UN DESCUIDO
//
// Mientras el cobro sigue `pending`, su factura sigue `pending` y `saldosPendientesPorCliente` ya
// cuenta el 100% — lo retenido incluido. Sumar además la retención contaría dos veces el mismo
// dinero. La retención es deuda APARTE justo cuando el cobro se ha dado por pagado sin ella.
import { prisma } from '../../../core/db/prisma';
import { zonaDelMerchant, diaNaturalEn } from '../../../core/zonaDelMerchant';
import { retencionPendiente, type DatosRetencion } from './retencionGarantia';

/** Lo que se sabe de las garantías retenidas de UN cliente. Ausente del mapa = no tiene ninguna. */
export interface GarantiaDelCliente {
  /** Todo lo retenido y sin cobrar, se pueda reclamar ya o no. */
  total: number;
  count: number;
  /** La parte cuya fecha de liberación ya llegó (en el día natural del merchant). */
  liberable: { total: number; count: number };
  /** La fecha de liberación más temprana de las pendientes. */
  proximaLiberacion: Date;
  /** EL AVISO: hay garantía retenida, sin cobrar, cuya fecha de liberación ya llegó. */
  aviso: boolean;
  /**
   * Una por cobro, por fecha de liberación. La pantalla pinta el literal firmado UNA VEZ POR RETENCIÓN:
   * con dos retenciones de fechas distintas, «total · desde la más temprana» diría que todo se libera ya.
   * `liberacionDia` (YYYY-MM-DD) es el día natural EN LA ZONA DEL MERCHANT: el navegador no la conoce.
   */
  retenciones: Array<{ importe: number; liberacionDia: string; aviso: boolean }>;
}

type CobroConRetencion = Pick<DatosRetencion,
  'retencionGarantiaPorcentaje' | 'retencionGarantiaImporte' | 'retencionGarantiaLiberacion' | 'retencionGarantiaCobrada'
> & { customerId: number | null };

/**
 * Puro. Agrupa por cliente las retenciones PENDIENTES (`retencionPendiente`, de SCRUM-1107: no se
 * redefine aquí qué es «pendiente») y marca el aviso cuando el día de liberación ya llegó.
 *
 * `hoy` es el día natural del merchant (`YYYY-MM-DD`) y la liberación se lee en la MISMA zona: sacar
 * el día del reloj del proceso es el defecto de SCRUM-735. Se suma en céntimos enteros.
 */
function resumirGarantias(
  cobros: readonly CobroConRetencion[],
  hoy: string,
  zona: string,
): Map<number, GarantiaDelCliente> {
  const acc = new Map<number, { cent: number; count: number; libCent: number; libCount: number; proxima: Date;
    lista: Array<{ cent: number; dia: string; ya: boolean }> }>();
  for (const c of cobros) {
    if (c.customerId == null || !retencionPendiente(c)) continue;
    const liberacion = c.retencionGarantiaLiberacion;
    const cent = Math.round(Number(c.retencionGarantiaImporte) * 100);
    // Un importe o una fecha ilegibles no se cuentan como cero ni como «hoy»: se saltan.
    if (!liberacion || !Number.isFinite(liberacion.getTime()) || !Number.isFinite(cent) || cent <= 0) continue;
    const dia = diaNaturalEn(liberacion, zona);
    const yaLlego = dia <= hoy;
    const a = acc.get(c.customerId) ?? { cent: 0, count: 0, libCent: 0, libCount: 0, proxima: liberacion, lista: [] };
    a.lista.push({ cent, dia, ya: yaLlego });
    a.cent += cent;
    a.count += 1;
    if (yaLlego) { a.libCent += cent; a.libCount += 1; }
    if (liberacion < a.proxima) a.proxima = liberacion;
    acc.set(c.customerId, a);
  }
  const fuera = new Map<number, GarantiaDelCliente>();
  for (const [customerId, a] of acc) {
    fuera.set(customerId, {
      total: a.cent / 100,
      count: a.count,
      liberable: { total: a.libCent / 100, count: a.libCount },
      proximaLiberacion: a.proxima,
      aviso: a.libCount > 0,
      retenciones: [...a.lista].sort((x, y) => (x.dia < y.dia ? -1 : x.dia > y.dia ? 1 : 0))
        .map((r) => ({ importe: r.cent / 100, liberacionDia: r.dia, aviso: r.ya })),
    });
  }
  return fuera;
}

/**
 * Las garantías retenidas de los clientes de un merchant (todos, o los de `customerIds`). SOLO
 * LECTURA (dinero): no escribe nada. Siempre por `merchantId` (regla 2).
 */
export async function garantiasRetenidasPorCliente(
  merchantId: number,
  customerIds?: number[],
  ahora: Date = new Date(),
): Promise<Map<number, GarantiaDelCliente>> {
  const [merchant, cobros] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: merchantId }, select: { timezone: true } }),
    prisma.charge.findMany({
      where: {
        merchantId,
        status: 'paid', // ver la cabecera: un cobro `pending` ya lo cuenta su factura
        customerId: customerIds ? { in: customerIds } : { not: null },
        retencionGarantiaPorcentaje: { not: null },
        retencionGarantiaCobrada: null,
      },
      select: {
        customerId: true,
        retencionGarantiaPorcentaje: true, retencionGarantiaImporte: true,
        retencionGarantiaLiberacion: true, retencionGarantiaCobrada: true,
      },
    }),
  ]);
  const zona = zonaDelMerchant(merchant);
  return resumirGarantias(cobros, diaNaturalEn(ahora, zona), zona);
}
