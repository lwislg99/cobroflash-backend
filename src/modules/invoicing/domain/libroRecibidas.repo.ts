// src/modules/invoicing/domain/libroRecibidas.repo.ts — SCRUM-426 (A6).
//
// El LECTOR del libro de recibidas. Hermano de `libroRegistro.repo.ts`: aquí vive el `prisma.`,
// y `libroRecibidas.ts` se queda puro para poder probarse sin base.
//
// Solo lectura: UN `findMany` y nada más. No compone, no reserva, no escribe.
import { construirLibroRecibidas, type GastoParaLibro, type LibroRecibidas } from './libroRecibidas';

/**
 * Lo mínimo del cliente Prisma que este lector usa. Se pide por parámetro —no se importa el
 * singleton— para que un test pueda apuntarlo a su propia base sin tocar ninguna variable de
 * entorno del proyecto. Mismo patrón que `ClienteDelLibro`.
 */
export interface ClienteDeGastos {
  expense: { findMany(args: any): Promise<any[]> };
}

export interface RangoRecibidas {
  merchantId: number;
  desde?: Date;
  hasta?: Date;
}

/** Las columnas que el libro necesita. Explícitas: un `select` abierto traería de más. */
const CAMPOS_GASTO = {
  id: true,
  merchantId: true,
  date: true,
  concept: true,
  amount: true,
  currency: true,
  providerId: true,
  baseAmount: true,
  vatRate: true,
  vatAmount: true,
  vatDeducible: true,
  providerInvoiceNumber: true,
  providerInvoiceDate: true,
} as const;

/**
 * El filtro de fecha, o `undefined` si no hay periodo. Se saca aparte para que el `where` de abajo
 * pueda escribirse con todas sus claves a la vista.
 */
function filtroDeFecha(rango: RangoRecibidas): { gte?: Date; lte?: Date } | undefined {
  if (!rango.desde && !rango.hasta) return undefined;
  return {
    ...(rango.desde ? { gte: rango.desde } : {}),
    ...(rango.hasta ? { lte: rango.hasta } : {}),
  };
}

/**
 * Lee el libro de recibidas de UN merchant contra la base.
 *
 * ⚠️ EL RANGO SE FILTRA POR `date` (la fecha del APUNTE), no por `providerInvoiceDate`. Es una
 * decisión, no un descuido: `providerInvoiceDate` es nullable —nació a NULL el 10-ago-2026 y la
 * mayoría de las filas la tienen vacía—, así que filtrar por ella dejaría fuera del periodo
 * justo a los gastos peor clasificados, que son los que más importa ver. `date` existe siempre.
 *
 * Qué fecha manda para el periodo es parte de P15.1 (no hay especificación del formato en el
 * repo). Mientras no haya respuesta, el asiento LLEVA LAS DOS y el filtro usa la que siempre
 * está — y esto queda dicho aquí en vez de decidirse en silencio.
 */
export async function leerLibroRecibidas(
  db: ClienteDeGastos,
  rango: RangoRecibidas,
): Promise<LibroRecibidas> {
  // ⚠️ EL `where` SE ESCRIBE CON LAS CLAVES A LA VISTA, sin spread condicional. Su hermano
  // (`libroRegistro.repo.ts`) usa un spread y por eso está censado como OPACO en el guard de
  // SCRUM-289: «el where no es un literal, no se puede ver qué filtra». Con las claves literales
  // se ve de un vistazo que aquí se filtra por merchant y por fecha y **NO por `quoteId`** —
  // que es justo lo que ese censo vigila. `undefined` lo ignora Prisma; `{}` no.
  const fecha = filtroDeFecha(rango);

  const gastos = (await db.expense.findMany({
    where: {
      merchantId: rango.merchantId,
      date: fecha,
    },
    select: CAMPOS_GASTO,
    // Por fecha del apunte y, a igualdad, por id: dos gastos del mismo día salen en el orden en
    // que se registraron.
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  })) as unknown as GastoParaLibro[];

  return construirLibroRecibidas({ gastos, merchantId: rango.merchantId });
}
