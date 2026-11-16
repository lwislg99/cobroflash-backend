// src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts — SCRUM-1066c · el lector del borrador.
//
// Solo lectura: UN `findMany` y nada más. El `where` va con las claves a la vista (convención de
// `libroRecibidas.repo.ts`): se ve que filtra por merchant (regla 2) y por fecha, y por nada más.
// Sin ruta: hoy no lo llama nadie, y montarla es una pantalla que pide texto firmado (regla 39).
import { rangoTrimestre } from '../modelo303/modelo303';
import { construirBorradorRetenciones, type BorradorRetenciones, type GastoConRetencion } from './retencionesPracticadas';

/** Lo mínimo del cliente Prisma. Por parámetro, para que un test lo apunte a lo que quiera. */
export interface ClienteDeRetenciones {
  expense: { findMany(args: any): Promise<any[]> };
}

const CAMPOS = {
  id: true,
  merchantId: true,
  date: true,
  providerId: true,
  currency: true,
  category: true,
  baseAmount: true,
  retencionPracticadaTipo: true,
  retencionPracticadaCuota: true,
  retencionPracticadaDeclarada: true,
} as const;

/**
 * ⚠️ El trimestre se filtra por `date` (la fecha del APUNTE), el mismo criterio que el libro de
 * recibidas y el 303: un gasto no puede caer en el 111 de un trimestre y en el libro de otro.
 */
export async function leerBorradorRetenciones(
  db: ClienteDeRetenciones,
  params: { merchantId: number; año: number; trimestre: number },
): Promise<BorradorRetenciones> {
  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);
  const gastos = (await db.expense.findMany({
    where: {
      merchantId: params.merchantId,
      date: { gte: desde, lte: hasta },
    },
    select: CAMPOS,
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  })) as unknown as GastoConRetencion[];
  return construirBorradorRetenciones({ gastos, merchantId: params.merchantId, año: params.año, trimestre: params.trimestre });
}

/**
 * SCRUM-1066h · filtro ⑨ (SCRUM-1066 c.21636): ¿hay ALGUNA retención anotada en el año?
 *
 * «Anotada» es lo que el borrador NO cuenta como `sinRetencion` ni como `sinDatoDeRetencion`: lo que
 * acaba en el 111, en el 115 o en `sinClasificar`. No se escribe un segundo criterio: se pasan los
 * gastos del año entero por `construirBorradorRetenciones`, que no filtra fechas (lo dice su
 * contrato), y se lee su recuento. Un solo `findMany`, filtrado por merchant (regla 2).
 */
export async function leerHayRetencionAnotadaEnElAño(
  db: ClienteDeRetenciones,
  params: { merchantId: number; año: number },
): Promise<boolean> {
  const desde = rangoTrimestre(params.año, 1).desde;
  const hasta = rangoTrimestre(params.año, 4).hasta;
  const gastos = (await db.expense.findMany({
    where: {
      merchantId: params.merchantId,
      date: { gte: desde, lte: hasta },
    },
    select: CAMPOS,
  })) as unknown as GastoConRetencion[];
  const b = construirBorradorRetenciones({ gastos, merchantId: params.merchantId, año: params.año, trimestre: 1 });
  return b.miradas - b.sinRetencion - b.sinDatoDeRetencion > 0;
}
