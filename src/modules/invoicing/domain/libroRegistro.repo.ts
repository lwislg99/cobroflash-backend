// src/modules/invoicing/domain/libroRegistro.repo.ts — SCRUM-296 (A6) · el LECTOR del libro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO EXISTE, SEPARADO DEL CONSTRUCTOR
//
// `libroRegistro.ts` es puro y su guard PROHÍBE la palabra `prisma.`: así el que lo lea sabe,
// sin ejecutarlo, que ese módulo no puede escribir en el camino de emisión (regla 38). El día
// que la consulta viviera dentro, ese guard habría que aflojarlo — y un guard aflojado deja de
// vigilar lo que se escribió para vigilar. La consulta vive aquí, y aquí tiene el suyo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES CONSULTAS LLEVAN `merchantId`. LAS TRES.
//
// No es ceremonia multi-tenant: en un libro de registro, colar la factura de otro no es una
// fuga de datos — es **declarar como propia la facturación de un tercero**. Y el `merchantId`
// viaja también en el `select`, para que el constructor pueda volver a comprobarlo y CONTAR lo
// que descarte. Si un día alguien quita el `where`, el libro no enseña facturas ajenas: las
// cuenta en `ajenas` y quien lo lea lo ve.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «PRESUPUESTO FIRMADO» SE DERIVA DE `signatureUrl`, NO DE `acceptedAt` — Y ES UNA DECISIÓN
//
// Aceptar y FIRMAR no son lo mismo. `acceptedAt` dice que el cliente le dio a un botón;
// `signatureUrl` es el trazo, y es la PRUEBA el día que ese cliente diga que él no pidió esto.
// En un libro que existe para enseñárselo a un tercero, el enlace tiene que apuntar a la
// prueba, no a la intención. Es el mismo criterio que ya usa `metrics.service` para el paso
// «Que tu cliente firme» (SCRUM-314/315): un solo significado de «firmado» en toda la casa.
//
// ⚠️ Y la firma NO VIAJA. `signatureUrl` es un data-URI con el trazo del cliente — dato
// personal, y de paso decenas de KB por fila. Al libro llega solo el HECHO de que existe: el
// filtro `signatureUrl: { not: null }` se resuelve EN POSTGRES y de vuelta viene el `id`.
import {
  construirLibroRegistro,
  type LibroRegistro,
  type FacturaParaLibro,
  type AlbaranVivo,
} from './libroRegistro';

/**
 * Lo mínimo del cliente Prisma que el lector usa. Se pide por parámetro (no se importa el
 * singleton) para que el test pueda apuntarlo a SU Postgres sin tocar ninguna variable de
 * entorno del proyecto — que es justo como se ha medido esto contra una base real.
 */
export interface ClienteDelLibro {
  invoice: { findMany(args: any): Promise<any[]> };
  quote: { findMany(args: any): Promise<any[]> };
  albaran: { findMany(args: any): Promise<any[]> };
}

export interface RangoLibro {
  merchantId: number;
  desde?: Date;
  hasta?: Date;
}

/** Las columnas que el libro necesita. Explícitas: un `select` abierto traería la firma. */
const CAMPOS_FACTURA = {
  id: true,
  merchantId: true,
  number: true,
  createdAt: true,
  type: true,
  total: true,
  currency: true,
  status: true,
  customerId: true,
  quoteId: true,
  chargeId: true,
  albaranRefs: true,
  lines: true,
} as const;

/**
 * Lee el libro de registro de UN merchant contra la base.
 *
 * Solo lectura: tres `findMany` y nada más. No compone números, no reserva, no escribe.
 */
export async function leerLibroRegistro(
  db: ClienteDelLibro,
  rango: RangoLibro,
): Promise<LibroRegistro> {
  const fecha: Record<string, Date> = {};
  if (rango.desde) fecha.gte = rango.desde;
  if (rango.hasta) fecha.lte = rango.hasta;

  const facturas = (await db.invoice.findMany({
    where: {
      merchantId: rango.merchantId,
      ...(Object.keys(fecha).length > 0 ? { createdAt: fecha } : {}),
    },
    select: CAMPOS_FACTURA,
    // Por fecha y, a igualdad, por número: dos facturas del mismo día tienen que salir en el
    // orden en que se emitieron, que es el de la serie.
    orderBy: [{ createdAt: 'asc' }, { number: 'asc' }],
  })) as unknown as (FacturaParaLibro & { id: number })[];

  const idsFactura = facturas.map((f) => f.id).filter((n) => typeof n === 'number');
  const idsPresupuesto = [
    ...new Set(facturas.map((f) => f.quoteId).filter((n): n is number => typeof n === 'number')),
  ];

  // Las dos consultas de enlace se piden a la vez: son independientes y ninguna depende del
  // resultado de la otra.
  const [firmados, albaranes] = await Promise.all([
    idsPresupuesto.length === 0
      ? Promise.resolve([] as { id: number }[])
      : (db.quote.findMany({
          where: {
            merchantId: rango.merchantId,
            id: { in: idsPresupuesto },
            // El filtro se resuelve en Postgres: el data-URI de la firma no sale de la base.
            signatureUrl: { not: null },
          },
          select: { id: true },
        }) as Promise<{ id: number }[]>),
    idsFactura.length === 0
      ? Promise.resolve([] as { id: number; numero: string; invoiceId: number }[])
      : (db.albaran.findMany({
          where: { merchantId: rango.merchantId, invoiceId: { in: idsFactura } },
          select: { id: true, numero: true, invoiceId: true },
        }) as Promise<{ id: number; numero: string; invoiceId: number }[]>),
  ]);

  const albaranesVivos = new Map<number, AlbaranVivo[]>();
  for (const a of albaranes) {
    const lista = albaranesVivos.get(a.invoiceId) ?? [];
    lista.push({ albaranId: a.id, numero: a.numero });
    albaranesVivos.set(a.invoiceId, lista);
  }

  return construirLibroRegistro({
    facturas,
    merchantId: rango.merchantId,
    presupuestosFirmados: firmados.map((q) => q.id),
    albaranesVivos,
  });
}
