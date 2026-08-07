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

  const [libro, modelo303, filasAlbaran, emisor] = await Promise.all([
    leerLibroRegistro(db, { merchantId, desde, hasta }),
    leerModelo303(db, { merchantId, año: params.año, trimestre: params.trimestre }),
    db.albaran.findMany({
      // Firmados y del periodo: son los que tienen sello que comprobar.
      where: { merchantId, estado: 'firmado', fecha: { gte: desde, lte: hasta } },
      orderBy: { id: 'asc' },
      select: {
        id: true, merchantId: true, jobId: true, numero: true, fecha: true,
        modoValoracion: true, lineas: true, notas: true, evidenciaFirma: true,
        // ⚠️ SIN `lugarEntrega`: ese campo llega con SCRUM-300 (C5) y HOY NO EXISTE en el
        // esquema — pedirlo revienta la consulta entera. El barrido de SCRUM-371 tampoco lo
        // selecciona, y `entradaDesdeFilas` lo resuelve a `null`, que es exactamente lo que
        // se selló en los sobres v:1. Cuando C5 entre, se añade aquí y en el barrido a la vez.
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
