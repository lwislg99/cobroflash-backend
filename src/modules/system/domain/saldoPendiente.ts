import { prisma } from '../../../core/db/prisma';

/**
 * SCRUM-1043 (y 1035) · LO QUE CADA CLIENTE DEBE: la suma de sus facturas `pending`.
 *
 * SITIO ÚNICO. La cifra «Pendiente de cobro» de la ficha 360 (`GET /admin/customers/:id/detail`) y
 * el saldo de la lista «quién me debe» (`GET /admin/customers?conDeuda=1`) salen de esta función:
 * dos formas de sumar acabarían dando dos deudas distintas para el mismo cliente.
 *
 * SOLO LECTURA (dinero): no toca cobros, estados ni facturas. UNA consulta (`groupBy`), no una por
 * cliente; siempre por `merchantId` (multi-tenant). Un cliente sin facturas pendientes NO aparece en
 * el mapa: ausente no es cero.
 */
export async function saldosPendientesPorCliente(
  merchantId: number,
  customerIds?: number[],
): Promise<Map<number, { total: number; count: number }>> {
  const filas = await prisma.invoice.groupBy({
    by: ['customerId'],
    where: {
      merchantId,
      status: 'pending',
      customerId: customerIds ? { in: customerIds } : undefined, // undefined = sin filtro (todos los del merchant)
    },
    _sum: { total: true },
    _count: { _all: true },
  });
  const fuera = new Map<number, { total: number; count: number }>();
  for (const f of filas) {
    fuera.set(f.customerId, { total: Number(f._sum?.total ?? 0), count: f._count?._all ?? 0 });
  }
  return fuera;
}
