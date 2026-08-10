// src/modules/fiscal/librosAeat/librosAeatCsv.ts — SCRUM-325 (E4).
//
// El libro de expedidas, en CSV que Excel español abre bien.
//
// ⚠️ NO SE ESCRIBE UN SEGUNDO FORMATO CSV. El de la casa lo fijó SCRUM-86 y vive en
// `exports/domain/exportData.ts`: separador `;`, coma decimal SIN punto de miles, CRLF y **BOM
// UTF-8**. Se importa tal cual. Dos formateadores CSV en el mismo producto acaban divergiendo, y
// el día que diverjan uno de los dos abrirá los acentos rotos o los importes como texto — que es
// exactamente el fallo que SCRUM-86 vino a cerrar y el que D1 (SCRUM-312) sufrió al importar.
//
// El BOM es la pieza que hace legible una Ñ en Excel: sin él, Excel lee el fichero como ANSI y
// «Peña» sale «PeÃ±a». Aquí no se reimplementa — se hereda, y el test lo comprueba en BYTES.
import { csvBody, csvNum, csvRow } from '../../exports/domain/exportData';
import { COLUMNAS_EXPEDIDAS, COLUMNAS_RECIBIDAS, type FilaLibro } from './librosAeat';

/** Las columnas que llevan importe: se formatean con coma decimal. El resto va tal cual. */
const COLUMNAS_IMPORTE = new Set(['baseImponible', 'cuotaIva', 'totalFactura']);
/** El tipo de IVA es un porcentaje, no un importe: `21`, no `21,00`. */
const COLUMNA_PORCENTAJE = 'tipoIva';

/**
 * Una celda. **`null` sale VACÍO, nunca `0,00`.**
 *
 * Es la regla que más importa del fichero y viene de A5/A6: un cero es una afirmación —«la base
 * fue cero»— y un hueco es «no se sabe». En un documento que se le entrega a un tercero, escribir
 * cero donde no se sabe es declarar algo que nadie ha comprobado.
 */
export function celda(clave: string, valor: unknown): string {
  if (valor == null) return '';
  if (COLUMNAS_IMPORTE.has(clave)) return csvNum(valor);
  if (clave === COLUMNA_PORCENTAJE) return String(valor);
  return String(valor);
}

/** El CSV completo del libro de expedidas, con su cabecera y su BOM. */
export function csvLibroExpedidas(filas: FilaLibro[]): string {
  const header = COLUMNAS_EXPEDIDAS.map((c) => c.rotulo);
  const rows = filas.map((f) => csvRow(COLUMNAS_EXPEDIDAS.map((c) => celda(c.clave, f[c.clave]))));
  return csvBody({ header, rows });
}

/**
 * El nombre del fichero. Lleva el periodo dentro **a propósito**: un `libro.csv` en la carpeta de
 * descargas no dice de qué trimestre es, y dos trimestres seguidos se pisan sin que se note.
 *
 * ⚠️ El nombre NO dice «AEAT» ni «Libro Registro»: eso es una promesa de conformidad que este
 * ticket no puede hacer (regla 7). Cuando el fundador apruebe el nombre, se cambia aquí.
 */
export function nombreFicheroExpedidas(año: number, trimestre: number): string {
  return `yaqu-emitidas-${año}-T${trimestre}.csv`;
}

/**
 * El CSV del libro de RECIBIDAS — SCRUM-426. Mismo formato de la casa (SCRUM-86) y misma regla:
 * `null` sale VACÍO, nunca `0,00`.
 *
 * ⚠️ LOS AVISOS VAN DENTRO DEL FICHERO, arriba y en su propia línea. No en un `header` HTTP ni en
 * una nota de la pantalla: **el fichero viaja solo**. Se lo reenvían al despacho por correo y ahí
 * ya no hay pantalla que explique nada — si el aviso no está dentro, no existe. Lo que dicen: que
 * el formato es provisional, y cuántos gastos quedaron fuera y por cuánto dinero.
 */
export function csvLibroRecibidas(filas: FilaLibro[], avisos: string[] = []): string {
  const header = COLUMNAS_RECIBIDAS.map((c) => c.rotulo);
  const rows = filas.map((f) => csvRow(COLUMNAS_RECIBIDAS.map((c) => celda(c.clave, f[c.clave]))));
  const cuerpo = csvBody({ header, rows });
  if (avisos.length === 0) return cuerpo;
  // Cada aviso en su fila, antes de la cabecera. Van por `csvRow` para que las comas y las
  // comillas de un texto largo no rompan el fichero.
  const preambulo = avisos.map((a) => csvRow([a])).join('');
  // El BOM tiene que quedarse el PRIMERO del fichero o Excel lee los acentos rotos: se corta del
  // cuerpo y se vuelve a poner delante, en vez de escribir un segundo.
  const bom = cuerpo.startsWith('\ufeff') ? '\ufeff' : '';
  return bom + preambulo + (bom ? cuerpo.slice(1) : cuerpo);
}

/**
 * El nombre del fichero de recibidas. Igual que el de emitidas: lleva el periodo dentro y **no
 * dice «AEAT» ni «Libro Registro»** — esa promesa de conformidad sigue sin poder hacerse (P15.1).
 */
export function nombreFicheroRecibidas(año: number, trimestre: number): string {
  return `yaqu-recibidas-${año}-T${trimestre}.csv`;
}
