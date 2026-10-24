// src/modules/fiscal/modelo347/modelo347.repo.ts — SCRUM-1067 · el lector del borrador del 347.
//
// No lee facturas ni gastos por su cuenta: lee LOS LIBROS del año (el de expedidas con
// `soloFacturas`, SCRUM-1232: el libro son facturas y nada más) y, aparte, el NIF de los
// proveedores que salen en el de recibidas (un gasto no congela el NIF de su proveedor: sólo está
// en la ficha). Solo lectura. Sin ruta: hoy no lo llama nadie, y montarla es una pantalla que pide
// texto firmado (regla 39).
import { leerLibroRegistro, type ClienteDelLibro } from '../../invoicing/domain/libroRegistro.repo';
import { leerLibroRecibidas, type ClienteDeGastos } from '../../invoicing/domain/libroRecibidas.repo';
import { exigirLibroRecibidasLegible } from '../../invoicing/domain/libroRecibidas';
import { rangoTrimestre } from '../modelo303/modelo303';
import { construirModelo347, type BorradorModelo347, type ProveedorPara347 } from './modelo347';

/** Lo mínimo del cliente Prisma para leer las fichas de proveedor. */
export interface ClienteDeProveedores {
  provider: { findMany(args: any): Promise<any[]> };
}

/**
 * ⚠️ El año se lee con los bordes de `rangoTrimestre` (1T desde, 4T hasta): el mismo calendario
 * que el 303 y los libros, para que una factura del 31 de diciembre a última hora no cambie de año.
 */
export async function leerBorradorModelo347(
  db: ClienteDelLibro & ClienteDeGastos & ClienteDeProveedores,
  params: { merchantId: number; año: number },
): Promise<BorradorModelo347> {
  const { desde } = rangoTrimestre(params.año, 1);
  const { hasta } = rangoTrimestre(params.año, 4);
  const libro = await leerLibroRegistro(db, { merchantId: params.merchantId, desde, hasta, soloFacturas: true });
  const libroRecibidas = await leerLibroRecibidas(db, { merchantId: params.merchantId, desde, hasta });
  exigirLibroRecibidasLegible(libroRecibidas);

  const ids = [...new Set(libroRecibidas.asientos.map((g) => g.proveedorId).filter((n): n is number => typeof n === 'number'))];
  const proveedores = ids.length === 0
    ? []
    : ((await db.provider.findMany({
        where: { merchantId: params.merchantId, id: { in: ids } },
        select: { id: true, merchantId: true, name: true, legalName: true, taxId: true },
      })) as ProveedorPara347[]);

  return construirModelo347({ libro, libroRecibidas, proveedores, merchantId: params.merchantId, año: params.año });
}
