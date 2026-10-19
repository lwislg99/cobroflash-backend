// SCRUM-1236 · leer el TEXTO de un PDF comprimido (FlateDecode) sin dependencias nuevas.
// Infla cada stream con zlib (de node) y lee los operadores de texto Tj / TJ / ' / ".
// Las cadenas se decodifican como WinAnsi (cp1252), que es lo que escribe pdfkit con sus fuentes
// estándar (Helvetica), las únicas que usa `pdf.service.ts`. Una fuente embebida (Identity-H) saldría
// como basura: por eso el extractor declara cuántas cadenas leyó y el llamador exige un texto conocido.
import zlib from 'node:zlib';

const CP1252 = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ' };
const deBytes = (bytes) => bytes.map((b) => CP1252[b] || String.fromCharCode(b)).join('');

function cadenaLiteral(s, i) { // s[i] === '('
  const out = []; let prof = 1; i++;
  while (i < s.length && prof > 0) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      const esc = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
      if (n in esc) { out.push(esc[n]); i += 2; continue; }
      if (/[0-7]/.test(n)) { let o = ''; let k = i + 1; while (k < i + 4 && /[0-7]/.test(s[k])) o += s[k++]; out.push(parseInt(o, 8) & 255); i = k; continue; }
      i += 2; continue; // \ + salto de línea: continuación
    }
    if (c === '(') prof++;
    if (c === ')') { prof--; if (prof === 0) { i++; break; } }
    out.push(c.charCodeAt(0) & 255); i++;
  }
  return [out, i];
}
function cadenaHex(s, i) { // s[i] === '<'
  const fin = s.indexOf('>', i);
  let h = s.slice(i + 1, fin).replace(/\s+/g, '');
  if (h.length % 2) h += '0';
  const out = []; for (let k = 0; k < h.length; k += 2) out.push(parseInt(h.slice(k, k + 2), 16));
  return [out, fin + 1];
}

/** Texto de UN content stream ya inflado: una línea por cada operador de texto. */
function textoDeStream(s) {
  const lineas = []; let pila = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') { const [b, j] = cadenaLiteral(s, i); pila.push(b); i = j; continue; }
    if (c === '<' && s[i + 1] !== '<') { const [b, j] = cadenaHex(s, i); pila.push(b); i = j; continue; }
    if (c === '[') { pila.push('['); i++; continue; }
    if (c === ']') { const arr = []; while (pila.length && pila[pila.length - 1] !== '[') { const x = pila.pop(); if (Array.isArray(x)) arr.unshift(x); } pila.pop(); pila.push({ arr }); i++; continue; }
    const m = /^[A-Za-z'"*]+/.exec(s.slice(i, i + 4));
    if (m) {
      const op = m[0];
      if (op === 'Tj' || op === "'" || op === '"') { const b = pila.pop(); if (Array.isArray(b)) lineas.push(deBytes(b)); }
      if (op === 'TJ') { const t = pila.pop(); if (t && t.arr) lineas.push(t.arr.map(deBytes).join('')); }
      pila = []; i += op.length; continue;
    }
    i++;
  }
  return lineas;
}

/** @returns {{ streams: number, inflados: number, fallidos: number, cadenas: number, texto: string }} */
export function textoDePdf(buf) {
  const s = buf.toString('latin1');
  const re = /stream\r?\n/g; let m; let streams = 0, inflados = 0, fallidos = 0; const lineas = [];
  while ((m = re.exec(s))) {
    const ini = m.index + m[0].length;
    const fin = s.indexOf('endstream', ini);
    if (fin < 0) break;
    streams++;
    const cabeza = s.slice(Math.max(0, m.index - 300), m.index);
    let cuerpo = buf.subarray(ini, fin);
    if (/\/FlateDecode/.test(cabeza.slice(cabeza.lastIndexOf('<<')))) {
      try { cuerpo = zlib.inflateSync(cuerpo); inflados++; } catch { fallidos++; continue; }
    }
    lineas.push(...textoDeStream(cuerpo.toString('latin1')));
    // Saltar el «endstream» ENTERO: dejando el índice en su inicio, la regex casaba «stream\n» dentro
    // de «endstream\n» y tomaba como stream el hueco entre dos objetos (medido en el albarán #47).
    re.lastIndex = fin + 'endstream'.length;
  }
  return { streams, inflados, fallidos, cadenas: lineas.length, texto: lineas.join('\n') };
}
