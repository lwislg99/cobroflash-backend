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
