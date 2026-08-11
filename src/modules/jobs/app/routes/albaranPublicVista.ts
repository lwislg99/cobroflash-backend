// src/modules/jobs/app/routes/albaranPublicVista.ts — SCRUM-468
//
// LO QUE VE EL FIRMANTE EN LA PANTALLA, Y POR QUÉ VIVE APARTE DE LA RUTA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO QUE CIERRA ESTE FICHERO
//
// La pantalla pública de firma (`albaranPublic.routes.ts`) enseñaba concepto/cantidad/unidad y
// **nada más**, a TODOS los albaranes. Esa regla era correcta cuando solo existía `SIN_VALORAR`;
// SCRUM-65 metió el modo `VALORADO` —precio unitario, importe por línea, Base y Total— **en el PDF
// y no en la pantalla**. Desde entonces el cliente firmaba una cosa y el papel archivado decía otra.
//
// **Una prueba de conformidad sobre lo que el firmante NO vio no prueba nada.** El PDF firmado
// queda sellado en el sobre v:2 y no se reescribe (regla 29): lo que estaba desactualizado era la
// pantalla, y es la pantalla la que se mueve.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTO SIGUE SIN SER UNA FACTURA (regla 24)
//
// Enseñar precios no convierte un parte de trabajo en documento fiscal — el propio PDF lleva estos
// importes desde SCRUM-65. Lo que NO hay, aquí ni allí: **desglose de cuota de IVA**, serie fiscal
// y QR. La leyenda que acompaña a los importes es la del PDF, LITERAL: no se redacta copy nuevo
// (regla 30), se copia el aprobado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UN MÓDULO Y NO UN BLOQUE DENTRO DE LA RUTA
//
// Para poder comprobar «pantalla y PDF coinciden campo por campo» **ejecutando las dos cosas**, no
// leyéndolas. Dentro del handler haría falta Express, Prisma y un token: el guard habría acabado
// mirando el fuente, que es exactamente como se coló el defecto original.
import { esc } from '../../../../core/utils/utils';
import { calcAlbaranTotales, AlbaranLinea } from '../../domain/albaran.service';

/**
 * El MISMO formato de dinero que imprime el PDF (`albaranPdf.service.ts` → `fmtMoney`).
 *
 * Está copiado porque allí es una función LOCAL del generador y sacarla de ahí sería tocar
 * `generateAlbaranPdf`. Que la copia no derive no depende de la buena voluntad:
 * `tests/scrum468-…` deriva el cuerpo del PDF por AST y lo ejecuta contra este — si alguien cambia
 * uno de los dos, sale rojo.
 *
 * ⚠️ NO es `Intl.NumberFormat(style:'currency')`. Ese pone U+00A0 antes del €; el PDF pone un
 * espacio normal. Se ven igual en pantalla y son dos cadenas distintas: con `currency` el primer
 * intento de este ticket ya divergía del PDF sin que se notara a simple vista.
 */
export function fmtMoneyAlbaran(v: number): string {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/** Leyenda de los importes. LITERAL del PDF (regla 30: no se escribe copy aquí). */
export const LEYENDA_IMPORTES_ORIENTATIVOS =
  'Importes orientativos; el IVA y la factura se emitirán conforme a la normativa vigente.';

/**
 * La tabla de líneas de la pantalla de firma (+ totales, solo si el albarán está VALORADO).
 *
 * `SIN_VALORAR` sale **byte a byte como salía antes de SCRUM-468**: son 4 albaranes ya firmados en
 * producción y su pantalla no se toca.
 */
export function renderLineasAlbaran(lineas: unknown, modoValoracion: unknown): string {
  const filas: any[] = Array.isArray(lineas) ? (lineas as any[]) : [];
  const valorado = modoValoracion === 'VALORADO';

  if (!filas.length) return '<p class="meta">Sin líneas.</p>';

  const cabecera = valorado
    ? '<tr><th>Concepto</th><th>Cant.</th><th>Unidad</th><th class="num">PRECIO UD.</th><th class="num">IMPORTE</th></tr>'
    : '<tr><th>Concepto</th><th>Cant.</th><th>Unidad</th></tr>';

  const fila = (l: any) => {
    const base = `<tr><td>${esc(l?.concepto ?? '')}</td><td>${esc(l?.cantidad ?? '')}</td><td>${esc(l?.unidad ?? '')}</td>`;
    if (!valorado) return `${base}</tr>`;
    // Igual que el PDF: una línea VALORADA sin precio deja las dos celdas VACÍAS. Pintar «0,00 €»
    // sería afirmar que esa línea no cuesta nada — y el PDF no lo afirma.
    const sinPrecio = l?.precioUnitario === undefined || l?.precioUnitario === null;
    if (sinPrecio) return `${base}<td class="num"></td><td class="num"></td></tr>`;
    const importe = Number(l.precioUnitario) * Number(l.cantidad);
    return `${base}<td class="num">${esc(fmtMoneyAlbaran(Number(l.precioUnitario)))}</td>`
      + `<td class="num">${esc(fmtMoneyAlbaran(importe))}</td></tr>`;
  };

  const tabla = `<table class="lines-table"><thead>${cabecera}</thead><tbody>${filas.map(fila).join('')}</tbody></table>`;
  if (!valorado) return tabla;

  // Base y Total, **sin cuota**: la misma aritmética que recibe el PDF (`albaran.service.ts:723`
  // y `:834` le pasan justo esto). Dos cálculos separados del mismo papel acaban discrepando.
  const t = calcAlbaranTotales(filas as AlbaranLinea[]);
  return tabla
    + '<div class="totales">'
    + `<p class="base">Base: ${esc(fmtMoneyAlbaran(t.base))}</p>`
    + `<p class="total">Total: ${esc(fmtMoneyAlbaran(t.total))}</p>`
    + `<p class="leyenda">${esc(LEYENDA_IMPORTES_ORIENTATIVOS)}</p>`
    + '</div>';
}
