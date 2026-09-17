// src/modules/invoicing/domain/crearFacturaEmitida.ts — SCRUM-729
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA LÍNEA ÚNICA NO SE BUSCA: SE CREA.
//
// El plan del escritor empezó buscando «la función y la línea exacta donde se congela el cliente»
// y el censo contestó que no hay una: hay SIETE sitios que crean una fila `Invoice`
// (`tests/_embudo-factura.mjs`, SCRUM-203). Poner el escritor en `emitInvoice` habría cubierto
// uno de los siete y dejado los otros seis emitiendo con las cinco columnas a NULL.
//
// Si un dato tiene que escribirse en siete sitios, el arreglo no es escribirlo siete veces: es que
// haya un sitio. Esto es ese sitio.
//
// ── POR QUÉ ESTE ENVOLTORIO Y NO MIGRAR LOS SIETE A `emitInvoice` ──────────────────────────────
//
// Se consideró y se DESCARTÓ (decisión del fundador, 9-sep-2026). `invoicing.service.ts` declara
// por qué desde SCRUM-17: dos de los llamadores aplican VeriFactu **inline** y `emitInvoice` es
// **lazy**, así que unificarlos cambia CUÁNDO se sella. Congelar cinco cadenas no puede arrastrar
// un cambio de sellado (regla 29). Esto, en cambio, es un renombrado mecánico: mismo `create`,
// mismo `data`, mismo momento.
//
// ── 🔴 EL CONGELADO ES PARÁMETRO, Y VA EL SEGUNDO ──────────────────────────────────────────────
//
// No es un campo más del `data` que se pueda olvidar: es un ARGUMENTO OBLIGATORIO, y el tipo de
// `datos` EXCLUYE los cinco campos, así que tampoco se puede colar por el otro lado. Un camino de
// emisión nuevo **no compila** hasta declarar de qué cliente es la factura.
//
// Es el mismo mecanismo que ya usan `actor` (SCRUM-207) y `origen` (SCRUM-347) en `emitInvoice`,
// y está aquí por la misma razón: es la forma más barata de guard y la más difícil de saltarse.
//
// Y encima hay un segundo cinturón, porque el tipo sólo protege a quien pasa por aquí: el censo
// del embudo exige **CERO `invoice.create` directos en `src/` fuera de este fichero**. Sin esa
// exigencia, la regla de lectura de `clienteCongelado.ts` —«NULL significa anterior al escritor»—
// dejaría de ser cierta el día que alguien añadiera el camino ocho.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import type { Prisma } from '@prisma/client';
import type { ClienteCongelado } from './clienteCongelado';

/**
 * Todo lo que hoy se escribe en un `invoice.create`, MENOS los cinco campos del cliente: ésos
 * entran por su parámetro y no por el `data`. Escribirlos a mano aquí no compila.
 */
export type DatosDeFacturaEmitida = Omit<
  Prisma.InvoiceUncheckedCreateInput,
  keyof ClienteCongelado
>;

/**
 * Crea la fila de una factura EMITIDA con el cliente de ese instante escrito dentro.
 *
 * La copia viaja en el MISMO `INSERT` que ya se hacía: **cero viajes de más a la base, y cero
 * dentro del cerrojo de serie**. El único viaje que añade este ticket es la lectura de la ficha
 * (`congelarCliente`), y va FUERA de la `$transaction`.
 *
 * ⛔ No se llama para presupuestos (oferta viva) ni para rectificar una fila ya escrita: una
 *    factura emitida no se edita (regla 29). Sólo nace.
 */
export function crearFacturaEmitida(
  tx: Prisma.TransactionClient,
  cliente: ClienteCongelado,
  datos: DatosDeFacturaEmitida,
) {
  return tx.invoice.create({ data: { ...datos, ...cliente } });
}
