// scripts/_censo-bytes-control.mjs — SCRUM-942 · el mecanismo de la norma A22
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// NINGÚN FICHERO DE TEXTO VERSIONADO LLEVA BYTES DE CONTROL LITERALES.
//
// `\uXXXX` escrito por una sesión aterriza en disco como el CARÁCTER LITERAL, no como la
// secuencia de escape (medido, 7/7 casos: SCRUM-941). Un NUL convierte el fichero en «binario»
// para git: `git diff --numstat` da «- -» y GitHub pone «Binary file not shown» — nadie vuelve a
// ver ese contenido en un diff. Un `\x08` (backspace) dentro de una regex deja un patrón que «no
// casa con nada»: un guard CIEGO (antecedente real, docs/master/SCRUM-428.md).
//
// 🔴 TRAMPA MEDIDA, la que decide si esto sirve: NO se usa `git grep -I`. Un NUL marca el fichero
// como binario para git y `-I` lo SALTA — ciego justo ante el caso que motiva el ticket. Se filtra
// por EXTENSIÓN y se leen los bytes del disco directamente.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Extensiones que este censo trata como texto. Lista cerrada — ampliarla es medir, no adivinar. */
export const EXTENSIONES_TEXTO = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.html', '.css',
  '.yml', '.yaml', '.sql', '.sh', '.cmd', '.ps1', '.tsv', '.csv',
]);
const NOMBRES_TEXTO = new Set(['.gitignore', '.gitattributes', '.eslintrc', '.prettierrc']);

/** ¿Es de texto por extensión (o por nombre completo, para los dotfiles sin extensión)? */
export function esTextoPorExtension(rel) {
  const base = rel.split('/').pop();
  if (NOMBRES_TEXTO.has(base)) return true;
  const punto = base.lastIndexOf('.');
  if (punto <= 0) return false;
  return EXTENSIONES_TEXTO.has(base.slice(punto).toLowerCase());
}

/** Bytes 0-8, 11, 12, 14-31, 127. TAB(9), LF(10) y CR(13) quedan FUERA a propósito. */
export function esByteDeControlProhibido(b) {
  if (b === 9 || b === 10 || b === 13) return false;
  return (b >= 0 && b <= 31) || b === 127;
}

/** Los bytes prohibidos de un Buffer, con su offset. Puro: no toca disco. */
export function bytesProhibidosEn(buf) {
  const out = [];
  for (let i = 0; i < buf.length; i++) {
    if (esByteDeControlProhibido(buf[i])) out.push({ byte: buf[i], offset: i });
  }
  return out;
}

/**
 * EXCEPCIONES — declaradas y fechadas, nunca silenciosas. Cada una con SU motivo, medido.
 * Ampliar esta lista es una decisión, no un descuido: un fichero que entra aquí sin motivo
 * escrito es exactamente el «guard que se relaja para que pase» que la regla 41 prohíbe.
 */
export const EXENTOS = Object.freeze({
  'docs/evidencias/scrum883/C1-pdf-justificante.txt':
    '22-sep-2026 (SCRUM-942): volcado de texto extraído de un PDF real; el 0x0C (form feed) es un '
    + 'salto de página que el extractor conserva tal cual.',
  'docs/evidencias/scrum883/C1-pdf-presupuesto.txt': '22-sep-2026 (SCRUM-942): igual que el anterior.',
  'docs/evidencias/scrum883/C3-pdf-justificante.txt': '22-sep-2026 (SCRUM-942): igual que el anterior.',
  'docs/evidencias/scrum883/C3-pdf-presupuesto.txt': '22-sep-2026 (SCRUM-942): igual que el anterior.',
  'estructura.txt':
    '22-sep-2026 (SCRUM-942, ya declarado en SCRUM-480/_censo-eol.mjs): UTF-16LE, salida de '
    + 'PowerShell (BOM FF FE) — el NUL es el byte alto de cada carácter ASCII, no un defecto.',
  'estructura-completa.txt': '22-sep-2026 (SCRUM-942): igual que el anterior.',
  'docs/master/SCRUM-428.md':
    '22-sep-2026 (SCRUM-942): el documento CUENTA el incidente de un `\\b` que entró como '
    + 'retroceso (0x08) — el byte que exhibe es la prueba del propio relato, no un descuido nuevo.',
  'docs/master/SCRUM-484.md':
    '22-sep-2026 (SCRUM-942): mismo tipo de incidente narrado (un heredoc que se comió barras '
    + 'invertidas y dejó un carácter de control literal en la prosa que lo explica).',
});

/**
 * El censo completo sobre `raiz`. Declara SIEMPRE su población (A3): un cero sin población no
 * es «está limpio», es «no he mirado».
 */
export function censarBytesDeControl(raiz) {
  const listado = execFileSync('git', ['ls-files'], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);
  if (listado.length === 0) throw new Error('🔴 CIEGO: `git ls-files` no devolvió ningún fichero');

  let ficherosVistos = 0;
  const hallazgos = [];
  for (const rel of listado) {
    if (!esTextoPorExtension(rel)) continue;
    ficherosVistos += 1;
    let buf;
    try { buf = fs.readFileSync(path.join(raiz, rel)); } catch { continue; } // borrado en disco, aún en el índice
    const malos = bytesProhibidosEn(buf);
    if (malos.length === 0) continue;
    if (rel in EXENTOS) continue;
    hallazgos.push({ rel, n: malos.length, muestra: malos.slice(0, 5) });
  }
  return { hallazgos, ficherosVistos, totalRastreados: listado.length };
}
