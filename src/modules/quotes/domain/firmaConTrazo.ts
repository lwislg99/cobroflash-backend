// src/modules/quotes/domain/firmaConTrazo.ts — SCRUM-892
//
// ¿La firma que manda el cliente tiene TRAZO, o es un lienzo vacío?
//
// El defecto: en «3 opciones» el lienzo nacía oculto, se quedaba en 0×0 y el navegador mandaba
// `data:,` (6 caracteres). El servidor lo aceptaba como «Aceptado con firma digital», SELLABA la
// evidencia sobre esa nada y el panel decía «Firmado digitalmente». Una firma que no existe no
// puede quedar como prueba de que el cliente aceptó.
//
// 🔴 EL CRITERIO ES DE PÍXELES, NO DE TAMAÑO. Medido en Chromium con `canvas.toDataURL('image/png')`:
//
//   lienzo vacío 304×150 ............ 2.142 caracteres
//   un trazo de 1 px en 304×150 ..... 2.262
//   firma real a 390 px, densidad 1 .. 5.770
//   lienzo vacío 912×450 (densidad 3)  13.146  ← MÁS largo que la firma real de arriba
//
// Ningún umbral de longitud separa «vacío» de «firmado». Lo que sí lo separa: el lienzo tiene
// fondo TRANSPARENTE y un píxel transparente se codifica como cuatro ceros (RGBA 0,0,0,0). Una
// firma con trazo tiene al menos un píxel con algún byte distinto de cero.
//
// Y eso se lee SIN deshacer los filtros del PNG: si todos los bytes de datos filtrados son cero,
// al reconstruir cada predictor (izquierda, arriba, media, Paeth) parte de ceros y vuelve a dar
// cero, así que la imagen es entera cero; y si la imagen es entera cero, cualquier filtro da ceros.
// Basta con saltar el byte de tipo de filtro de cada fila.
//
// Qué se da por VACÍO (se rechaza):
//   · lo que no es `data:image/png;base64,` (incluido `data:,` y la cadena vacía)
//   · un PNG ilegible, de 0 de ancho o de alto, entrelazado, o sin canal alfa: el lienzo de firma
//     siempre sale con alfa y sin entrelazar, así que otra cosa no salió de él
//   · un PNG cuyos píxeles son todos transparentes
//
// Límites declarados: medido en Chromium. Firefox y Safari codifican el lienzo con la misma regla
// (alfa, sin entrelazar) pero NO se han medido aquí.
import zlib from 'node:zlib';

/** Código del rechazo. Se ramifica por CÓDIGO, nunca por el texto (SCRUM-151). */
export const ERROR_FIRMA_VACIA = 'firma_vacia';
/**
 * Lo lee la CLIENTE bajo el recuadro de firma (la página pinta `message`). FIRMADO el 17-sep-2026
 * por delegación del fundador (SCRUM-892, comentario 15660). Consta en
 * `docs/microcopy/2026-09-17-SCRUM-892-firma-vacia.md`.
 */
export const COPY_FIRMA_VACIA = 'No nos ha llegado tu firma. Dibújala otra vez en el recuadro o marca «Acepto sin firmar».';

const PREFIJO = 'data:image/png;base64,';
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Canales por tipo de color PNG. Solo 4 (gris + alfa) y 6 (RGBA) llevan alfa. */
const CANALES_CON_ALFA: Record<number, number> = { 4: 2, 6: 4 };
/** Tope de lado: un lienzo de firma a densidad 4 mide ~1.600 px. Corta imágenes infladas a propósito. */
const LADO_MAX = 8192;

export function firmaTieneTrazo(signatureData: unknown): boolean {
  if (typeof signatureData !== 'string' || !signatureData.startsWith(PREFIJO)) return false;
  const png = Buffer.from(signatureData.slice(PREFIJO.length), 'base64');
  if (png.length < FIRMA_PNG.length + 25 || !png.subarray(0, 8).equals(FIRMA_PNG)) return false;

  let ancho = 0, alto = 0, profundidad = 0, tipoColor = -1, entrelazado = -1;
  const idat: Buffer[] = [];
  let p = 8;
  while (p + 8 <= png.length) {
    const largo = png.readUInt32BE(p);
    const tipo = png.toString('latin1', p + 4, p + 8);
    const datos = png.subarray(p + 8, p + 8 + largo);
    if (datos.length !== largo) return false;
    if (tipo === 'IHDR') {
      if (largo < 13) return false;
      ancho = datos.readUInt32BE(0);
      alto = datos.readUInt32BE(4);
      profundidad = datos[8];
      tipoColor = datos[9];
      entrelazado = datos[12];
    } else if (tipo === 'IDAT') {
      idat.push(datos);
    } else if (tipo === 'IEND') {
      break;
    }
    p += 12 + largo;
  }

  const canales = CANALES_CON_ALFA[tipoColor];
  if (!canales || entrelazado !== 0 || (profundidad !== 8 && profundidad !== 16)) return false;
  if (ancho < 1 || alto < 1 || ancho > LADO_MAX || alto > LADO_MAX || idat.length === 0) return false;

  const bytesPorFila = 1 + ancho * canales * (profundidad / 8);
  let crudo: Buffer;
  try {
    crudo = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: bytesPorFila * alto });
  } catch {
    return false;
  }
  if (crudo.length < bytesPorFila * alto) return false;

  for (let fila = 0; fila < alto; fila++) {
    const inicio = fila * bytesPorFila;
    for (let i = inicio + 1; i < inicio + bytesPorFila; i++) {
      if (crudo[i] !== 0) return true;
    }
  }
  return false;
}
