// src/modules/jobs/domain/parteNumero.ts — SCRUM-652 (T3 fase C) · el número del parte.
//
// Formato `PT-2026-001`. Serie NO FISCAL e independiente de todo lo demás (Parte L del master):
// no pasa por VeriFactu, ni por la serie de facturas, ni por la de albaranes.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 ESTO NO SE NUMERA COMO EL ALBARÁN, Y NO ES UNA ELECCIÓN: ES UNA LIMITACIÓN DECLARADA
//
// `allocateAlbaranNumber` reserva su número contra DOS COLUMNAS de `Merchant`
// (`nextAlbaranNumber` + `albaranSeriesYear`) dentro de la transacción del create. Ése es el
// patrón bueno, y el parte NO puede usarlo hoy: esas columnas son suyas, no hay equivalentes para
// el parte, y crearlas es `prisma/schema.prisma` — territorio del fundador y CONGELADO mientras
// se verifica el db push de SCRUM-674.
//
// Así que aquí se deriva del MÁXIMO ya emitido, dentro de la transacción del create. Y hay que
// decir en voz alta lo que eso NO garantiza, porque un lector que suponga la garantía del albarán
// se llevaría un disgusto:
//
//   · `partes_trabajo` NO tiene índice único sobre (merchant_id, numero) —medido en el schema:
//     solo hay `@@index([merchant_id, fecha])` y `@@index([merchant_id, estado])`—, así que la
//     base NO rechazaría un duplicado. La serie se apoya en la transacción y en nada más.
//   · dos creaciones SIMULTÁNEAS del mismo merchant pueden leer el mismo máximo y acuñar el mismo
//     número. Con un contador propio esto no pasaría: por eso el arreglo definitivo es la columna,
//     no más código aquí.
//
// ⚠️ Lo que SÍ se sostiene: no deja huecos si el create falla (la reserva vive dentro de su
// transacción) y el reinicio anual es correcto, porque el máximo se busca DENTRO del año.
//
// 📌 El arreglo de verdad —`nextParteNumber` + `parteSeriesYear` en `Merchant`— queda propuesto
// para el segundo commit de schema, junto a las dos firmas.

export const PARTE_NUMBER_PREFIX = 'PT-';

export function formatParteNumber(year: number, seq: number): string {
  return `${PARTE_NUMBER_PREFIX}${year}-${String(seq).padStart(3, '0')}`;
}

/**
 * El siguiente de la serie de ESE año, a partir de los que ya hay.
 *
 * Se le pasa la lista de números existentes del merchant. Los que no son de esta serie o de este
 * año **se ignoran**, no se cuentan: contar filas daría el número equivocado en cuanto alguien
 * borrara una, y un parte con un número ya usado es un documento mal identificado.
 */
export function siguienteNumeroParte(numerosExistentes: string[], year: number): string {
  const prefijo = `${PARTE_NUMBER_PREFIX}${year}-`;
  let maximo = 0;
  for (const n of numerosExistentes || []) {
    if (typeof n !== 'string' || !n.startsWith(prefijo)) continue;
    const seq = Number(n.slice(prefijo.length));
    if (Number.isInteger(seq) && seq > maximo) maximo = seq;
  }
  return formatParteNumber(year, maximo + 1);
}
