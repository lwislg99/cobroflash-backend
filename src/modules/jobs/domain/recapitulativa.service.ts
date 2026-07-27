// src/modules/jobs/domain/recapitulativa.service.ts
//
// SCRUM-171a · EL NÚCLEO DE LA RECAPITULATIVA, UNA SOLA VEZ.
//
// POR QUÉ EXISTE ESTE FICHERO. La emisión de la factura recapitulativa vivía dentro de la ruta
// de Job (`POST /admin/jobs/:id/consolidar-albaranes`). Al abrir la segunda vía —a ámbito
// CLIENTE, que es lo que SCRUM-70 dejó a medias y lo que SCRUM-171 necesita para existir— la
// tentación era copiarla y adaptarla. Copiar la emisión es cómo nacen las divergencias fiscales:
// dos sitios que sellan, numeran y agrupan «casi igual», y el día que uno se arregla el otro se
// queda con el fallo. Aquí el camino es UNO y los dos lo llaman.
//
// Lo que NO cambia respecto a la versión original (y por eso se puede compartir):
//   · la ROTURA del art. 13 RD 1619/2012 — una factura por MES NATURAL, nunca una que los mezcle;
//   · una sola `$transaction` para todos los grupos: si algo falla, no consolida a medias;
//   · el guard anti-doble-consolidación (`invoiceId: null` en el `updateMany`), que es lo que
//     hace segura la concurrencia;
//   · una recapitulativa JAMÁS sale como justificante J- (aborta todo antes que emitir inválido);
//   · el sellado VeriFactu va FUERA de la transacción y EN SERIE (SCRUM-173).
import type { Prisma, PrismaClient } from '@prisma/client';
import { emitInvoice } from '../../invoicing/domain/invoicing.service';
import { applyVeriFactu } from '../../invoicing/domain/verifactu.service';
import { isReceiptNumber } from '../../invoicing/domain/invoiceNumber.service';
import { calcVatBreakdown } from '../../invoicing/domain/vat.service';

/** Un albarán ya validado y listo para entrar en una factura. */
export interface AlbaranAEmitir {
  id: number;
  numero: string;
  fecha: Date | string;
  lineas: unknown;
}

/** Grupo del art. 13: los albaranes de UN mes natural. */
export interface GrupoAEmitir {
  mesLabel: string;
  albaranes: AlbaranAEmitir[];
}

export interface FacturaEmitida {
  id: number;
  number: string;
  mesLabel: string;
  total: string;
}

/**
 * Emite una recapitulativa POR GRUPO (mes natural) y marca sus albaranes.
 *
 * Devuelve también los números que NO se pudieron sellar: callar un sellado incompleto es peor
 * que decirlo, y deshacer la factura para «arreglarlo» iría contra la regla 29.
 *
 * @throws 'consolidacion_no_disponible' si la serie sale J- · 'consolidacion_concurrente' si
 *         otro proceso facturó los mismos albaranes mientras tanto (→ rollback total).
 */
export async function emitirRecapitulativas(
  prisma: PrismaClient,
  params: {
    merchantId: number;
    customerId: number;
    currency: string;
    taxId: string | null;
    grupos: GrupoAEmitir[];
  },
): Promise<{ facturas: FacturaEmitida[]; sinSellar: string[] }> {
  const { merchantId, customerId, currency, taxId, grupos } = params;

  const facturas = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const out: FacturaEmitida[] = [];
    for (const g of grupos) {
      // Líneas VALORADO de cada albarán → líneas de factura {concept, qty, price, tax(fracción)}.
      const lines = g.albaranes.flatMap((a) => {
        const ls = Array.isArray(a.lineas) ? (a.lineas as any[]) : [];
        const fechaTxt = new Date(a.fecha).toLocaleDateString('es-ES');
        return ls.map((l) => ({
          concept: `Albarán ${a.numero} (${fechaTxt}): ${l.concepto}`,
          qty: Number(l.cantidad) || 0,
          price: Number(l.precioUnitario) || 0,
          tax: (Number(l.tipoIva) || 0) / 100,
        }));
      });
      const bd = calcVatBreakdown(lines);
      const total = (bd.base + bd.cuota).toFixed(2);
      const albaranRefs = g.albaranes.map((a) => ({ albaranId: a.id, numero: a.numero, fecha: a.fecha }));

      const invoice = await emitInvoice(tx, {
        merchantId, customerId, total, currency, type: 'F1', lines, albaranRefs, quoteId: null,
      });
      // Robustez fiscal: una recapitulativa JAMÁS puede salir como justificante J-. Si
      // `allocateInvoiceNumber` devolviera serie receipt (porque el gate de modo miró un
      // merchant sin `flags`), se aborta TODO antes que emitir un documento inválido.
      if (isReceiptNumber(invoice.number)) throw new Error('consolidacion_no_disponible');

      // Guard anti-doble-consolidación: solo marca los que SIGUEN con `invoiceId: null`. Si
      // otro proceso se adelantó, `count` no cuadra y la transacción entera se deshace.
      const groupIds = g.albaranes.map((a) => a.id);
      const upd = await tx.albaran.updateMany({
        where: { id: { in: groupIds }, merchantId, invoiceId: null },
        data: { invoiceId: invoice.id },
      });
      if (upd.count !== groupIds.length) throw new Error('consolidacion_concurrente');

      out.push({ id: invoice.id, number: invoice.number, mesLabel: g.mesLabel, total });
    }
    return out;
  });

  // ── Sellado VeriFactu: FUERA del commit y EN SERIE (SCRUM-173) ────────────────────────────
  // Dentro de la transacción, las facturas del lote no se ven entre sí y todas encadenarían al
  // mismo registro anterior. Un fallo aquí NO revierte nada: las facturas existen y los
  // albaranes están marcados; deshacerlo iría contra la regla 29. Se informa y se reintenta.
  const sinSellar: string[] = [];
  for (const f of facturas) {
    try {
      const inv = await prisma.invoice.findUnique({ where: { id: f.id } });
      if (inv) await applyVeriFactu(inv, taxId ?? '', prisma);
    } catch (e: any) {
      console.error(`[recapitulativa] sellado VeriFactu falló en ${f.number}:`, e?.message || e);
      sinSellar.push(f.number);
    }
  }

  return { facturas, sinSellar };
}
