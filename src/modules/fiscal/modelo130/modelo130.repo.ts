// src/modules/fiscal/modelo130/modelo130.repo.ts — SCRUM-1065b · el lector del borrador del 130.
//
// No lee facturas ni gastos: lee LOS LIBROS del periodo ACUMULADO (1 de enero → fin del trimestre),
// con los mismos lectores que el 303. Un solo filtro por `merchantId` (el de cada libro, ya probado)
// y un solo criterio de fechas. Sin ruta: montarla es una pantalla que pide texto firmado (regla 39).
//
// ⚠️ SIN `criterioDelMerchantParaElLibro`, a diferencia del 303: el criterio de caja es del IVA
// (LIVA 163 decies), no del IRPF. El libro devenga por emisión, como hoy en todos los merchants.
import { leerLibroRegistro, type ClienteDelLibro } from '../../invoicing/domain/libroRegistro.repo';
import { leerLibroRecibidas, type ClienteDeGastos } from '../../invoicing/domain/libroRecibidas.repo';
import { exigirLibroRecibidasLegible } from '../../invoicing/domain/libroRecibidas';
import { construirBorrador130, rangoAcumulado, type Borrador130 } from './modelo130';

export async function leerBorrador130(
  db: ClienteDelLibro & ClienteDeGastos & ClienteDelAlta,
  params: { merchantId: number; año: number; trimestre: number },
): Promise<Borrador130> {
  const { desde, hasta } = rangoAcumulado(params.año, params.trimestre);
  const libro = await leerLibroRegistro(db, { merchantId: params.merchantId, desde, hasta });
  const libroRecibidas = await leerLibroRecibidas(db, { merchantId: params.merchantId, desde, hasta });
  exigirLibroRecibidasLegible(libroRecibidas);
  // SCRUM-1065e: el alta se LEE de la fila del merchant (su `id` es el filtro de tenant). Sin esquema nuevo.
  const fila = await db.merchant.findUnique({ where: { id: params.merchantId }, select: { createdAt: true } });
  const altaDelMerchant = fila?.createdAt instanceof Date ? fila.createdAt : null;
  return construirBorrador130({ libro, libroRecibidas, año: params.año, trimestre: params.trimestre, altaDelMerchant });
}

/** SCRUM-1065e · lo único que hace falta de la fila del merchant: su alta. */
export interface ClienteDelAlta {
  merchant: { findUnique(args: any): Promise<{ createdAt?: unknown } | null> };
}
