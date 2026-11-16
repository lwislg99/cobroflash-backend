// src/modules/billing/domain/cobrosDeFactura.ts — SCRUM-1732 (opción A, PR-1)
//
// UN SOLO SITIO APUNTA LO COBRADO DE UNA FACTURA (`invoice_payments`). Diseño: SCRUM-1732 c.21926 §①;
// decisiones y firma de Javier: c.21928. Todos los escritores (webhook psp, confirm-bizum, Mercado
// Pago, la liberación de la garantía, el marcado a mano y el lote) pasan por `apuntarCobroDeFactura`:
// un segundo sitio que escriba la tabla es un segundo criterio de «cuánto entró».
//
// · V1 (c.21928 ①): esto NO cambia `Invoice.status`; cada escritor sigue marcando `paid` como antes.
// · `importe` es lo que ENTRÓ (> 0). `Charge.amount` es lo PEDIDO (c.21928 ②).
// · Idempotente por el único `(invoice_id, charge_id)`: un reintento del aviso de pago no apunta dos
//   veces. La segunda escritura choca (P2002) y se da por apuntada.
// · En este PR NADIE LEE la tabla (el devengo por tramos es el PR-2, de J1).

/** Conjuntos cerrados de la tabla (c.21926 §①; `anulacion` por c.21928 ⑤). */
export const TIPOS_DE_COBRO = ['cobro', 'liberacion_garantia', 'anulacion'] as const;
export type TipoDeCobro = (typeof TIPOS_DE_COBRO)[number];
export const ORIGENES_DE_FECHA = ['declarada', 'aviso', 'marcado'] as const;
export type OrigenDeFecha = (typeof ORIGENES_DE_FECHA)[number];

export function esOrigenDeFecha(v: unknown): v is OrigenDeFecha {
  return typeof v === 'string' && (ORIGENES_DE_FECHA as readonly string[]).includes(v);
}

export type CobroDeFactura = {
  merchantId: number;
  invoiceId: number;
  chargeId: number | null;
  importe: number;
  fechaCobro: Date;
  fechaOrigen: OrigenDeFecha;
  metodo: string | null;
  tipo: TipoDeCobro;
};

/** Céntimos enteros: la única forma de comparar dinero aquí (A10, SCRUM-624d). */
export function aCentimos(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Importe recibido DECLARADO por quien confirma (confirm-bizum). Sin declarar → lo pedido.
 * Se admite de 0,01 a lo pedido: más de lo pedido no se puede atribuir a la factura.
 */
export function resolverImporteRecibido(declarado: unknown, pedido: unknown):
  { ok: true; importe: number } | { ok: false; error: 'importe_invalido' } {
  const pedidoC = aCentimos(pedido);
  if (declarado === undefined || declarado === null || declarado === '') {
    return pedidoC !== null && pedidoC > 0 ? { ok: true, importe: pedidoC / 100 } : { ok: false, error: 'importe_invalido' };
  }
  const c = aCentimos(declarado);
  if (c === null || c <= 0 || pedidoC === null || c > pedidoC) return { ok: false, error: 'importe_invalido' };
  return { ok: true, importe: c / 100 };
}

function esChoqueDeUnico(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'P2002';
}

type ClienteConPagos = { invoicePayment: { create: (args: any) => Promise<unknown> } };

/**
 * Apunta UNA fila. Devuelve `apuntado` (fila nueva) o `ya_estaba` (reintento del mismo aviso).
 * Lanza si la fila no es válida: un escritor que manda basura es un defecto, no un caso.
 */
export async function apuntarCobroDeFactura(db: ClienteConPagos, c: CobroDeFactura): Promise<'apuntado' | 'ya_estaba'> {
  const centimos = aCentimos(c.importe);
  if (centimos === null || centimos <= 0) throw new Error(`[cobrosDeFactura] importe no válido: ${c.importe}`);
  if (!(c.fechaCobro instanceof Date) || !Number.isFinite(c.fechaCobro.getTime())) throw new Error('[cobrosDeFactura] fecha no válida');
  if (!esOrigenDeFecha(c.fechaOrigen)) throw new Error(`[cobrosDeFactura] origen de fecha no válido: ${c.fechaOrigen}`);
  if (!(TIPOS_DE_COBRO as readonly string[]).includes(c.tipo)) throw new Error(`[cobrosDeFactura] tipo no válido: ${c.tipo}`);
  try {
    await db.invoicePayment.create({
      data: {
        merchantId: c.merchantId,
        invoiceId: c.invoiceId,
        chargeId: c.chargeId,
        importe: centimos / 100,
        fechaCobro: c.fechaCobro,
        fechaOrigen: c.fechaOrigen,
        metodo: c.metodo,
        tipo: c.tipo,
      },
    });
    return 'apuntado';
  } catch (e) {
    if (esChoqueDeUnico(e)) return 'ya_estaba';
    throw e;
  }
}

type ClienteConPagosLeibles = ClienteConPagos & { invoicePayment: { findMany: (args: any) => Promise<any[]> } };

/**
 * Deshace lo cobrado de una factura SIN borrar nada (c.21928 ⑤, append-only): por cada fila de
 * cobro o de liberación que nadie ha anulado, una fila `anulacion` con `anulaId` = esa fila, el
 * mismo importe y `chargeId` NULL. La usa el «des-pagar» de un justificante (`invoiceAdmin.ts`).
 * Idempotente por el único de `anula_id`: una fila se anula una sola vez.
 */
export async function anularCobrosDeFactura(db: ClienteConPagosLeibles, merchantId: number, invoiceId: number, cuando: Date): Promise<number> {
  const vivas = await db.invoicePayment.findMany({
    where: { merchantId, invoiceId, tipo: { in: ['cobro', 'liberacion_garantia'] }, anuladaPor: null },
    select: { id: true, importe: true, metodo: true },
  });
  let n = 0;
  for (const fila of vivas) {
    try {
      await db.invoicePayment.create({
        data: {
          merchantId, invoiceId, chargeId: null, importe: fila.importe, fechaCobro: cuando,
          fechaOrigen: 'marcado', metodo: fila.metodo ?? null, tipo: 'anulacion', anulaId: fila.id,
        },
      });
      n++;
    } catch (e) {
      if (!esChoqueDeUnico(e)) throw e;
    }
  }
  return n;
}
