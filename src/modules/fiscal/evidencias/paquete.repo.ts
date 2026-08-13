// src/modules/fiscal/evidencias/paquete.repo.ts — SCRUM-297 (A7) · el lector del paquete.
//
// Junta las cinco piezas LEYENDO por sus propias puertas, sin reimplementar ninguna:
//   · el Libro (A6) y el modelo 303 (A5) por sus lectores, que ya filtran por merchant;
//   · los albaranes firmados del periodo, y su verificación con `entradaDesdeFilas` +
//     `verificarSobre` / `verificarPoblacion` de SCRUM-369/371 — las MISMAS funciones, no una
//     copia de las recetas: una segunda receta declararía manipulados documentos intactos.
//
// ⚠️ Solo lectura. Y las tres consultas propias llevan `merchantId`: en un paquete de
// cumplimiento, colar el documento de otro no es una fuga — es entregar como prueba propia la
// actividad de un tercero.
import { leerLibroRegistro, type ClienteDelLibro } from '../../invoicing/domain/libroRegistro.repo';
import { leerModelo303 } from '../modelo303/modelo303.repo';
import { rangoTrimestre } from '../modelo303/modelo303';
import {
  entradaDesdeFilas,
  type FilaAlbaranFirmado, type FilaJob, type FilaCustomer, type FilaMerchant,
} from '../../jobs/domain/albaranBarrido';
import { verificarSobre, verificarPoblacion, type EntradaVerificacion } from '../../jobs/domain/albaranVerificacion';
import { construirPaqueteEvidencias, type PaqueteEvidencias, type AlbaranDelPaquete } from './paquete';
import { criterioDelMerchantParaElLibro } from '../../invoicing/domain/criterioDelMerchant'; // SCRUM-294 fase C

/** Lo que el lector necesita del cliente Prisma. Inyectable: el test le pasa el suyo. */
export interface ClienteDelPaquete extends ClienteDelLibro {
  job: { findMany(args: any): Promise<any[]> };
  customer: { findMany(args: any): Promise<any[]> };
  merchant: { findUnique(args: any): Promise<any> };
}

export async function leerPaqueteEvidencias(
  db: ClienteDelPaquete,
  params: { merchantId: number; año: number; trimestre: number },
): Promise<PaqueteEvidencias> {
  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);
  const { merchantId } = params;

  // SCRUM-294 (fase C) · el criterio de caja del merchant. Va ANTES del Promise.all: si el
  // merchant no se puede leer, no se arma ningun paquete de evidencias con un devengo adivinado.
  const criterio = await criterioDelMerchantParaElLibro(db as never, merchantId);
  const [libro, modelo303, filasAlbaran, emisor] = await Promise.all([
    leerLibroRegistro(db, { merchantId, desde, hasta, ...criterio }),
    leerModelo303(db, { merchantId, año: params.año, trimestre: params.trimestre }),
    db.albaran.findMany({
      // Firmados y del periodo: son los que tienen sello que comprobar.
      where: { merchantId, estado: 'firmado', fecha: { gte: desde, lte: hasta } },
      orderBy: { id: 'asc' },
      select: {
        id: true, merchantId: true, jobId: true, numero: true, fecha: true,
        modoValoracion: true, lineas: true, notas: true, evidenciaFirma: true,
        // SCRUM-300 (C5), añadidas al entrar el esquema: las CUATRO que el sobre v:2 sella. Sin
        // ellas `entradaDesdeFilas` las resuelve a `null`, recalcula el hash sin lo que sí se
        // selló y el paquete declara MANIPULADO un albarán intacto — sobre la población entera.
        //
        // ⚠️ Van las cuatro y no solo `lugarEntrega`: el guard singulariza esa porque es la que
        // usa de rueda, pero el adaptador lee las cuatro. Añadir una y creerse el verde sería
        // dejar tres agujeros del mismo tamaño detrás del test que acaba de ponerse verde.
        //
        // NO cambia nada de lo sellado: esto es el LADO LECTOR. `v:1` se recalcula igual que
        // antes —su receta ignora estos campos— y por eso los sobres ya firmados no se mueven.
        // El mismo `select` que el `lectorPrisma` del barrido (SCRUM-371), a propósito: dos
        // lectores del mismo hash que lean columnas distintas darían veredictos distintos.
        lugarEntrega: true, fechaEntrega: true, firmadoPorNombre: true, firmadoPorCalidad: true,
        invoiceId: true,
      },
    }) as Promise<(FilaAlbaranFirmado & { invoiceId: number | null })[]>,
    db.merchant.findUnique({ where: { id: merchantId }, select: { name: true, legalName: true, taxId: true } }) as Promise<FilaMerchant | null>,
  ]);

  // Los Trabajos y clientes de esos albaranes, para reconstruir las MISMAS fuentes que se
  // sellaron. Las dos consultas van acotadas al merchant (regla 2).
  const idsJob = [...new Set(filasAlbaran.map((a) => a.jobId))];
  const jobs = idsJob.length === 0 ? [] : await db.job.findMany({
    where: { merchantId, id: { in: idsJob } },
    select: { id: true, titulo: true, direccion: true, merchantId: true, customerId: true },
  });
  const porJob = new Map<number, FilaJob & { customerId: number }>(jobs.map((j: any) => [j.id, j]));

  const idsCliente = [...new Set(jobs.map((j: any) => j.customerId).filter((n: unknown) => typeof n === 'number'))];
  const clientes = idsCliente.length === 0 ? [] : await db.customer.findMany({
    where: { merchantId, id: { in: idsCliente } },
    select: { id: true, name: true, legalName: true },
  });
  const porCliente = new Map<number, FilaCustomer>(clientes.map((c: any) => [c.id, c]));

  const entradas: EntradaVerificacion[] = [];
  const albaranes: AlbaranDelPaquete[] = [];
  for (const a of filasAlbaran) {
    const job = porJob.get(a.jobId) ?? null;
    const cliente = job ? (porCliente.get(job.customerId) ?? null) : null;
    const entrada = entradaDesdeFilas(a, job, cliente, emisor);
    entradas.push(entrada);
    albaranes.push({
      albaranId: a.id,
      numero: a.numero,
      invoiceId: a.invoiceId ?? null,
      // El MISMO verificador que usa el barrido. Aquí se guarda por albarán porque el índice
      // necesita el estado de cada uno; el resumen sale de `verificarPoblacion`, que llama a
      // esta misma función — una fuente, dos usos, ninguna receta duplicada.
      resultado: verificarSobre(entrada),
      lineas: a.lineas,
    });
  }

  return construirPaqueteEvidencias({
    libro,
    modelo303,
    albaranes,
    informeVerificacion: verificarPoblacion(entradas),
    merchantId,
    periodo: {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      año: params.año,
      trimestre: params.trimestre,
    },
  });
}