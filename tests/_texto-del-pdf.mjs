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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-659 · LEER LAS LÍNEAS, NO SÓLO EL TEXTO
//
// `extraerTextoPdf` **no distingue un salto de línea de su ausencia**. Medido en las dos
// direcciones: `'ALFA\nBETA'` y `'ALFABETA'` devuelven los dos `"ALFABETA"`. PDFKit sí respeta el
// salto —lo pinta en dos líneas—, pero aquí los trozos se concatenan sin separador.
//
// Eso deja SIN VERIFICAR el criterio de DOC-03 y de SCRUM-655 (T6): «los saltos se ven en el PDF».
// Un test escrito contra el lector de texto pasaría en verde con el salto roto: guard muerto el
// día que nace.
//
// ── POR QUÉ SE AÑADE UNA LECTURA EN VEZ DE CAMBIAR LA QUE HAY ────────────────────────────────
// `extraerTextoPdf` sostiene los controles de SCRUM-603, 604, 604b, 623, 625, 636 y 647. Si
// cambiara lo que DEVUELVE, esos siete tests cambiarían de significado sin que nadie lo pidiera.
// Medido antes de decidir: los consumidores usan `r.ok` (147), `r.motivo` (107) y `r.texto` (54)
// — y **nadie usa `r.trozos`**. Aun así se añade una función APARTE en vez de un campo: el riesgo
// sobre el camino existente pasa a ser CERO, no «pequeño», y no cuesta nada.
//
// ── CÓMO, Y ESTÁ MEDIDO, NO SUPUESTO ────────────────────────────────────────────────────────
// PDFKit emite un bloque `BT … Tm … TJ … ET` POR LÍNEA, con la matriz de texto completa:
//
//     BT  1 0 0 1 72 712.82 Tm  /F1 10 Tf  [<414c46> 80 <41> 0] TJ  ET     ← «ALFA»
//     BT  1 0 0 1 72 701.26 Tm  /F1 10 Tf  [<42455441> 0] TJ         ET     ← «BETA»
//
// Misma `x` (72) y distinta `y`. Dos fragmentos con la misma `y` son la MISMA línea; con `y`
// distinta, dos líneas. La `y` decrece hacia abajo, así que ordenar por `y` descendente da el
// orden de lectura.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Dos `y` que difieren menos que esto son la misma línea. Medido: el interlineado real es ~11,6. */
const TOLERANCIA_Y = 1.5;

/** Los seis números de un `Tm`, o los dos de un `Td`/`TD`. `null` si no es un operador de posición. */
function posicionDe(linea) {
  const t = linea.trim();
  const numeros = t.split(/\s+/);
  const op = numeros[numeros.length - 1];
  const n = numeros.slice(0, -1).map(Number);
  if (op === 'Tm' && n.length === 6 && n.every(Number.isFinite)) return { x: n[4], y: n[5], relativo: false };
  if ((op === 'Td' || op === 'TD') && n.length === 2 && n.every(Number.isFinite)) return { x: n[0], y: n[1], relativo: true };
  return null;
}

/**
 * Las LÍNEAS que imprime un PDF, con su posición.
 *
 * @returns {{ok: true, lineas: {x:number, y:number, texto:string}[], texto: string}
 *          | {ok: false, motivo: string}}
 *          `ok:false` es «NO SUPE LEERLO», que NO es lo mismo que «no tiene líneas».
 */
export function lineasDePdf(buf) {
  // Los mismos suelos que el lector de texto: si aquél no sabe leer el documento, éste tampoco.
  const base = extraerTextoPdf(buf);
  if (!base.ok) return base;

  const fragmentos = [];
  let sinPosicion = 0;
  for (const flujo of flujosDeContenido(buf)) {
    if (!flujo.includes('TJ') && !flujo.includes('Tj')) continue;
    let x = null;
    let y = null;
    for (const linea of flujo.split('\n')) {
      const p = posicionDe(linea);
      if (p) {
        if (p.relativo && x !== null) { x += p.x; y += p.y; } else { x = p.x; y = p.y; }
        continue;
      }
      if (!linea.includes('<')) continue;
      let texto = '';
      let i = 0;
      while (i < linea.length) {
        if (linea[i] !== '<') { i++; continue; }
        const fin = linea.indexOf('>', i + 1);
        if (fin === -1) break;
        texto += deHex(linea.slice(i + 1, fin));
        i = fin + 1;
      }
      if (texto === '') continue;
      if (y === null) { sinPosicion += 1; continue; }
      fragmentos.push({ x, y, texto });
    }
  }

  // 🔴 SUELO · texto sin posición NO se cuela en silencio. Si hubiera fragmentos que no sabemos
  // situar, el recuento de líneas sería menor que el real y el guard mentiría en verde.
  if (sinPosicion > 0) {
    return { ok: false, motivo: `${sinPosicion} fragmento(s) de texto sin operador de posición: no sé en qué línea van` };
  }
  if (fragmentos.length === 0) {
    return { ok: false, motivo: 'no he situado ni un fragmento: el lector de líneas no ha sabido leer este PDF' };
  }

  // Se agrupa por `y`, y dentro de cada línea se ordena por `x` — que es como se lee.
  const lineas = [];
  for (const f of fragmentos.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const ultima = lineas[lineas.length - 1];
    if (ultima && Math.abs(ultima.y - f.y) <= TOLERANCIA_Y) {
      ultima.texto += f.texto;
      ultima.x = Math.min(ultima.x, f.x);
    } else {
      lineas.push({ x: f.x, y: f.y, texto: f.texto });
    }
  }
  return { ok: true, lineas, texto: lineas.map((l) => l.texto).join('') };
}

/**
 * Cuántas LÍNEAS del PDF contienen `aguja`. Es lo que hace falta para afirmar un salto: un texto
 * de dos líneas que se pinta en una sola devuelve 1, y ahí está la regresión.
 */
export function lineasConPdf(lineas, aguja) {
  if (aguja === '') return 0;
  return lineas.filter((l) => l.texto.includes(aguja)).length;
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
