// tests/_texto-del-pdf.mjs — SCRUM-604 (DOC-14) · LEER LO QUE EL PDF IMPRIME.
//
// ── 🔴 POR QUE HACIA FALTA ESTO ──────────────────────────────────────────────
// Hasta hoy la suite comprobaba los PDF **por tamaño en bytes**: `pdfs.test.mjs` afirma que el
// watermark está porque «el fichero con watermark pesa más que el fichero sin él». Eso distingue
// «hay algo más» de «no hay nada más», y no distingue NADA sobre qué dice el documento. Un
// desglose fiscal con la cuota equivocada pesa exactamente lo mismo que uno correcto.
//
// Este módulo lee el TEXTO. Solo LEE el camino de emisión —lo que la regla 38 permite sin GO— y
// no añade ninguna dependencia (regla 36): `zlib` es de Node.
//
// ── POR QUE SE PUEDE, Y CUANDO DEJARIA DE PODERSE ────────────────────────────
// MEDIDO sobre un PDF real de factura: los tipos son los ESTÁNDAR (`/BaseFont /Helvetica` y
// `/Helvetica-Bold`), con `/WinAnsiEncoding` y **sin `/ToUnicode`**. Con tipos estándar PDFKit no
// hace subsetting, así que cada byte del texto ES su código WinAnsi. El texto viaja en cadenas
// HEXADECIMALES dentro de arrays de kerning:
//
//     BT ... /F2 22 Tf [<46> 80 <41> 40 <4354555241> 0] TJ ET     →  "FACTURA"
//
// (Se midió: 25 operadores `TJ`, cero `Tj`, cero literales `(…)`. Buscar literales entre
// paréntesis —que es lo que uno escribe primero— devolvía CERO, y un cero ahí se lee como «el
// PDF no dice eso» en vez de como «no supe leerlo». Por eso el suelo ② existe.)
//
// 🔴 EL SUPUESTO ESTA VIGILADO, no dado por bueno: si algún día se embebe un tipo propio, los
// bytes pasarían a ser códigos de glifo de un subconjunto y esto devolvería basura. Por eso
// `extraerTextoPdf` **se declara CIEGO** cuando el documento trae `/ToUnicode` o un `/BaseFont`
// con subsetting (el prefijo `ABCDEF+`), en vez de devolver una cadena vacía.
import zlib from 'node:zlib';

/**
 * WinAnsi (CP-1252) y Latin-1 sólo se separan en 0x80–0x9F. Se traducen los que un documento de
 * YaQu puede llevar de verdad; el resto de ese tramo se deja como está y NO se inventa.
 */
const WINANSI = {
  0x80: '€', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”',
  0x95: '•', 0x96: '–', 0x97: '—',
};

/** Una cadena hexadecimal del flujo (`4354555241`) a su texto. */
function deHex(hex) {
  const limpio = hex.replace(/[^0-9A-Fa-f]/g, '');
  let fuera = '';
  for (let i = 0; i + 1 < limpio.length; i += 2) {
    const b = parseInt(limpio.slice(i, i + 2), 16);
    fuera += WINANSI[b] ?? String.fromCharCode(b);
  }
  return fuera;
}

/** Todos los flujos de contenido descomprimidos de un PDF. */
function flujosDeContenido(buf) {
  const s = buf.toString('latin1');
  const fuera = [];
  let i = 0;
  while ((i = s.indexOf(' obj', i)) !== -1) {
    const finObj = s.indexOf('endobj', i);
    if (finObj === -1) break;
    const cuerpo = s.slice(i, finObj);
    const iniStream = cuerpo.indexOf('stream');
    if (iniStream !== -1) {
      const cabecera = cuerpo.slice(0, iniStream);
      // Las imágenes (QR, logo) no llevan texto: se saltan para no inflar la salida ni el coste.
      if (!cabecera.includes('/Image')) {
        const desde = iniStream + 'stream'.length + (cuerpo[iniStream + 'stream'.length] === '\r' ? 2 : 1);
        const hasta = cuerpo.indexOf('endstream', desde);
        if (hasta !== -1) {
          const crudo = Buffer.from(cuerpo.slice(desde, hasta), 'latin1');
          if (cabecera.includes('FlateDecode')) {
            try { fuera.push(zlib.inflateSync(crudo).toString('latin1')); } catch { /* no era un flujo */ }
          } else {
            fuera.push(crudo.toString('latin1'));
          }
        }
      }
    }
    i = finObj + 6;
  }
  return fuera;
}

/**
 * El TEXTO que imprime un PDF, en orden de aparición.
 *
 * @returns {{ok: true, texto: string, trozos: string[]} | {ok: false, motivo: string}}
 *          `ok:false` es «NO SUPE LEERLO», que NO es lo mismo que «no dice nada».
 */
export function extraerTextoPdf(buf) {
  const s = buf.toString('latin1');

  // ── SUELO ① · los supuestos que hacen válido el extractor ──────────────────
  if (s.includes('/ToUnicode')) {
    return { ok: false, motivo: 'el PDF trae /ToUnicode: hay un tipo embebido y el texto ya no son literales legibles' };
  }
  const bases = [];
  let b = 0;
  while ((b = s.indexOf('/BaseFont', b)) !== -1) {
    const trozo = s.slice(b + 9, b + 70);
    const m = trozo.indexOf('/');
    if (m !== -1) bases.push(trozo.slice(m + 1).split(/[\s/\]>]/)[0]);
    b += 9;
  }
  const subset = bases.find((n) => n.length > 7 && n[6] === '+');
  if (subset) {
    return { ok: false, motivo: `tipo con subsetting (${subset}): los literales serían códigos de glifo` };
  }
  if (bases.length === 0) return { ok: false, motivo: 'el PDF no declara ningún /BaseFont: no sé qué estoy leyendo' };

  // ── Las cadenas hex de los flujos de contenido, en orden ───────────────────
  const trozos = [];
  for (const flujo of flujosDeContenido(buf)) {
    if (!flujo.includes('TJ') && !flujo.includes('Tj')) continue;
    let i = 0;
    while (i < flujo.length) {
      if (flujo[i] !== '<') { i++; continue; }
      const fin = flujo.indexOf('>', i + 1);
      if (fin === -1) break;
      trozos.push(deHex(flujo.slice(i + 1, fin)));
      i = fin + 1;
    }
  }

  // ── SUELO ② · si no ha salido texto, es que no supe leerlo ─────────────────
  const texto = trozos.join('');
  if (texto.trim() === '') {
    return { ok: false, motivo: 'no he extraído ni un carácter: el extractor no ha sabido leer este PDF' };
  }
  return { ok: true, texto, trozos };
}

/**
 * ¿Aparece `aguja` en el texto del PDF? Devuelve CUÁNTAS veces, no un booleano: «una vez» y «tres
 * veces» son hechos distintos en un documento fiscal, y un booleano los da por iguales.
 *
 * El texto sale troceado por el kerning (`[(T)-20(OTAL)] TJ`), así que se busca sobre la
 * concatenación —que es lo que un humano LEE— y no trozo a trozo.
 */
export function vecesEnPdf(texto, aguja) {
  if (aguja === '') return 0;
  return texto.split(aguja).length - 1;
}
