// src/modules/fiscal/modelo303/modelo303.repo.ts — SCRUM-295 (A5) · el lector del 303.
//
// No lee facturas: lee EL LIBRO (SCRUM-296) del mismo periodo y lo suma. Un solo camino a la
// base, un solo filtro por `merchantId` (el del libro, ya probado contra Postgres), un solo
// criterio de fechas. El día que haya que cambiar cómo se leen las facturas emitidas se cambia
// en un sitio, y el 303 y el libro siguen diciendo lo mismo.
import { leerLibroRegistro, type ClienteDelLibro } from '../../invoicing/domain/libroRegistro.repo';
import { construirModelo303, rangoTrimestre, type Modelo303 } from './modelo303';
import { criterioDelMerchantParaElLibro } from '../../invoicing/domain/criterioDelMerchant'; // SCRUM-294 fase C

export async function leerModelo303(
  db: ClienteDelLibro,
  params: { merchantId: number; año: number; trimestre: number },
): Promise<Modelo303> {
  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);
  // SCRUM-294 (fase C) · EL CABLE: el criterio de caja del merchant llega al libro. Hoy devuelve
  // `{}` —la columna aun no esta en el modelo de Prisma— y el libro devenga por emision, EXACTAMENTE
  // como siempre. El dia que el campo entre en `schema.prisma`, esto empieza a mandar solo.
  const criterio = await criterioDelMerchantParaElLibro(db as never, params.merchantId);
  const libro = await leerLibroRegistro(db, { merchantId: params.merchantId, desde, hasta, ...criterio });
  return construirModelo303({ libro, año: params.año, trimestre: params.trimestre });
}
