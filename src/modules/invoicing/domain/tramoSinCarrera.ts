// src/modules/invoicing/domain/tramoSinCarrera.ts — SCRUM-814
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// DOS PETICIONES SIMULTÁNEAS EMITÍAN EL MISMO TRAMO, Y EL RESTO SE QUEDABA SIN FACTURAR.
//
// Los tres caminos que emiten por tramos elegían el suyo con `plan[existingInvoices.length]`, a
// partir de un recuento leído ANTES de abrir la transacción. Envolver la creación en una
// transacción no protege una decisión tomada antes de abrirla.
//
// Medido corriendo, con dos procesos y hora de salida común, plan 30/70: dos facturas SELLADAS
// del tramo «Anticipo» (363 € cada una), la siguiente petición contestaba «ya se han emitido
// todas», y el presupuesto se quedaba en **726 € de 1210 — 484 € que ya no se podían facturar**,
// en documentos que la regla 29 no deja borrar. 3 de 3 repeticiones.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UN SOLO SITIO, Y NO ES ESTÉTICA
//
// El patrón vive en tres rutas y una de ellas la dispara el CLIENTE FINAL desde WhatsApp, donde
// pulsar dos veces con mala cobertura es el caso NORMAL. Tres copias del mismo recuento son tres
// sitios que pueden separarse: basta que alguien «simplifique» uno para reabrir el agujero justo
// donde más muerde. Aquí la invariante, el código del error y el texto están escritos UNA vez.
//
// ⛔ NO se toca el cerrojo de serie de SCRUM-728 ni `@@unique([merchantId, number])`: funcionan y
// no eran el problema. Este módulo sólo USA el cerrojo que aquél ya toma.
import { Prisma } from '@prisma/client';
import { SERIE_LOCK_NS } from './invoiceNumber.service';

/**
 * El tramo que esta petición preparó ya lo emitió OTRA mientras tanto.
 *
 * Código propio y NO `no_more_invoices_for_payment_terms`: aquél significa «este presupuesto ya
 * está facturado entero», que es un final legítimo. Éste significa «vuelve a pedirlo y saldrá el
 * siguiente tramo». Un solo código para las dos cosas obligaría a leer el texto para saber si hay
 * que reintentar, y el texto es lo único que no se debe parsear (SCRUM-151).
 */
const TRAMO_TOMADO = 'stage_taken_concurrently';

/**
 * MICROCOPY OFICIAL — **aprobada por el fundador el 7-sep-2026, en SCRUM-814**, sin cambios.
 * Registro: `docs/microcopy/2026-09-07-SCRUM-814-tramo-tomado.md`.
 *
 * Dice qué pasó, no culpa a nadie —puede haber sido el propio usuario pulsando dos veces— y dice
 * qué hacer. Es la MISMA en los tres caminos: dos textos para el mismo hecho acabarían diciendo
 * cosas distintas.
 */
const COPY_TRAMO_TOMADO =
  'Se acaba de emitir otra factura de este presupuesto. Vuelve a intentarlo y saldrá el tramo siguiente.';

class TramoTomadoError extends Error {
  readonly code = TRAMO_TOMADO;
  readonly preparadoSobre: number;
  readonly encontradas: number;
  constructor(preparadoSobre: number, encontradas: number) {
    super(`${TRAMO_TOMADO}: preparado sobre ${preparadoSobre} tramos, encontrados ${encontradas}`);
    this.name = 'TramoTomadoError';
    this.preparadoSobre = preparadoSobre;
    this.encontradas = encontradas;
  }
}

/** ¿Es este el error del tramo tomado? Por IDENTIDAD del código, nunca por subcadena. */
export function esTramoTomado(e: unknown): boolean {
  return (e as any)?.code === TRAMO_TOMADO;
}

// 🔴 `TRAMO_TOMADO`, `COPY_TRAMO_TOMADO` y `TramoTomadoError` NO SE EXPORTAN, y es deliberado:
// nadie los importa. La API de este módulo son `exigirTramoLibre`, `esTramoTomado` y
// `cuerpoTramoTomado` — una forma de lanzar, una de reconocer y una de contestar. Exportar «por si
// acaso» habría dejado tres huérfanos que el censo de SCRUM-411 obliga a declarar uno a uno, y
// declarar una excepción cuesta más que no crearla. Los guards los leen por AST del fuente, que no
// necesita `export`.

/** El cuerpo del 409, igual en los tres sitios. */
export function cuerpoTramoTomado(): { error: string; message: string } {
  return { error: TRAMO_TOMADO, message: COPY_TRAMO_TOMADO };
}

/**
 * EXIGE QUE EL TRAMO SIGA LIBRE, **dentro de la transacción y bajo el cerrojo**.
 *
 * Se llama como PRIMERA sentencia del `$transaction`, antes de `allocateInvoiceNumber`, por la
 * misma razón que SCRUM-246 y SCRUM-771: las comprobaciones van antes de consumir un número de la
 * serie. Que el rollback también lo devuelva es un detalle del motor; el orden se lee.
 *
 * POR QUÉ VE LO DE LA OTRA PETICIÓN, que es lo que hace que esto funcione:
 *
 *   · `pg_advisory_xact_lock` es de TRANSACCIÓN y se libera en el commit, así que la segunda no
 *     entra hasta que la primera ya escribió Y confirmó. Se toma con la MISMA clave que
 *     `allocateInvoiceNumber` (SCRUM-728) — es re-entrante dentro de la misma transacción, así
 *     que tomarlo aquí sólo ADELANTA el momento en que se entra en la sección crítica.
 *   · el nivel es READ COMMITTED —el del proyecto—, donde cada sentencia toma su propia
 *     instantánea: el `count`, ejecutado DESPUÉS de esperar, ve el commit de la otra. Medido
 *     corriendo en `docs/master/evidencias/scrum814/los-dos-caminos.mjs`.
 *
 * 🔴 Con REPEATABLE READ **no lo vería**: la instantánea se tomaría al abrir la transacción, antes
 * de esperar el cerrojo. Si algún día se sube el nivel de aislamiento, esto deja de proteger.
 *
 * ABORTA, no recalcula. Recalcular el tramo aquí dentro obligaría a meter el troceado de líneas y
 * sus dos exigencias dentro de la transacción: medio camino de emisión movido para arreglar una
 * carrera. Quien pierde reintenta y recibe el tramo siguiente, y el presupuesto acaba facturado
 * entero — lo comprueba el caso del dinero del test de carrera.
 *
 * @param tx                cliente DE TRANSACCIÓN (no el global: fuera de una tx el cerrojo se
 *                          tomaría y soltaría en el mismo instante y no serviría de nada)
 * @param quoteId           el presupuesto cuyos tramos se cuentan
 * @param merchantId        para el cerrojo Y para el `where` (regla 2)
 * @param tramosPreparados  cuántas facturas había cuando se eligió el tramo, FUERA de la tx
 */
export async function exigirTramoLibre(
  tx: Prisma.TransactionClient,
  { quoteId, merchantId, tramosPreparados }: { quoteId: number; merchantId: number; tramosPreparados: number },
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;
  // Filtra TAMBIÉN por `merchantId` (regla 2) aunque el presupuesto ya venga acotado por él: la
  // alternativa era apoyarse en la procedencia del id, y el censo de SCRUM-348 llama a eso
  // «correcto hoy y frágil siempre». Aquí el merchant está a mano y no cuesta nada.
  const emitidasAhora = await tx.invoice.count({ where: { quoteId, merchantId } });
  if (emitidasAhora !== tramosPreparados) throw new TramoTomadoError(tramosPreparados, emitidasAhora);
}
