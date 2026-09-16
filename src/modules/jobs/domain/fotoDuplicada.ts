// src/modules/jobs/domain/fotoDuplicada.ts — SCRUM-382
//
// LA MISMA FOTO SUBIDA DOS VECES NO SE GUARDA DOS VECES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `POST /admin/albaranes/:id/fotos` creaba un `Attachment` sin mirar si esos bytes ya estaban.
// En obra se sube dos veces con facilidad —el pulgar, la barra de progreso que no se ve al sol,
// el «no sé si se ha subido»— y la copia se queda en el albarán **para siempre**: ocupa una de
// las diez plazas, sale repetida en el PDF y en el paquete de evidencias de A7.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ `computeAlbaranContentHash` NO SIRVE PARA ESTO, Y CONVIENE DECIRLO
//
// Existe un hash de contenido en el albarán, pero sella el CONTENIDO DEL DOCUMENTO (número,
// fecha, líneas, quién firma) para la evidencia de firma. **No mira los bytes de ninguna foto**,
// y hacerlo dependería de un dato que puede cambiar después de firmar. Son dos cosas distintas
// con la palabra «hash» en medio: reutilizarlo habría atado el dedupe de adjuntos al sellado de
// la firma, que es exactamente lo que la regla 38 no quiere que se toque.
//
// Aquí el hash es de los BYTES del fichero, y solo se usa para comparar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO SE GUARDA EL HASH EN UNA COLUMNA
//
// Sería lo natural (`Attachment.sha256`), pero es **schema**, y el schema es territorio del
// fundador con las migraciones congeladas. Así que se compara contra lo que ya hay, y el coste
// está ACOTADO por el propio límite del producto: **10 fotos por albarán**. No es una solución
// para un álbum de mil; para diez es exacta y no necesita migración.
//
// Si algún día el tope sube mucho, esto se convierte en el argumento para pedir la columna — no
// en algo que arreglar a base de trucos.

import crypto from 'crypto';

/** SHA-256 de los bytes, en hex. Solo para comparar: no se sella, no se guarda, no viaja. */
export function huellaDeBytes(bytes: Uint8Array | Buffer): string {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

export type FotoExistente = { id: number; data: Uint8Array | Buffer | null };

/**
 * ¿Estos bytes ya están entre los adjuntos del albarán? Devuelve el `id` del que ya está, o
 * `null`.
 *
 * 🔴 SE COMPARA PRIMERO POR TAMAÑO. Dos ficheros de distinto tamaño no pueden ser iguales, así
 * que el `sha256` solo se calcula para los candidatos que miden lo mismo. Con el tope de 10 y
 * fotos de móvil, lo normal es que no se calcule ninguno.
 *
 * ⚠️ Una fila con `data` nulo NO es candidata y NO se trata como duplicado: «no tengo los bytes»
 * y «los bytes son otros» no son lo mismo, y confundirlos borraría una foto buena.
 */
export function fotoYaSubida(
  nueva: Uint8Array | Buffer,
  existentes: readonly FotoExistente[],
): number | null {
  const buf = Buffer.from(nueva);
  const candidatas = existentes.filter((f) => f.data != null && Buffer.from(f.data).length === buf.length);
  if (candidatas.length === 0) return null;

  const huellaNueva = huellaDeBytes(buf);
  for (const c of candidatas) {
    if (huellaDeBytes(c.data as Uint8Array) === huellaNueva) return c.id;
  }
  return null;
}
