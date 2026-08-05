// src/core/csv/csv.ts — SCRUM-312 (D1)
//
// LAS PRIMITIVAS DE CSV DEL PROYECTO, EN UN SOLO SITIO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE EXTRAEN, Y NO ES ORDEN
//
// Había DOS parseos vivos del mismo formato:
//   · `products.service.ts:106` → `parseCsvLine` (servidor, TS), con los arreglos de SCRUM-339;
//   · `public/dashboard/js/csvImport.js:184` → `csvSplitLine` (navegador, JS), sin ellos.
//
// Y no eran equivalentes: el del navegador no honraba `""` (comilla escapada) ni quitaba el BOM,
// así que el MISMO fichero se leía distinto según por dónde entrara. Es la forma exacta del
// defecto de las dos listas: dos copias de una regla, y nada que las ate.
//
// Al mover el importador de clientes al servidor, el del navegador desaparece y queda ÉSTE.
//
// ⚠️ ALCANCE DECLARADO: no cruza saltos de línea. El CSV se trocea por `\n` antes de llegar
// aquí, así que un valor con `\n` embebido queda fuera — igual que en SCRUM-339, y dicho para
// que nadie lo dé por cubierto.

/** El BOM que antepone nuestro propio export, y que Excel también pone. */
const BOM = '﻿';

/**
 * Quita el BOM del principio. El `.trim()` de las rutas ya lo mordía (U+FEFF es whitespace),
 * pero esto no depende de quién llame: un servicio que se defiende solo.
 */
export function quitarBom(texto: string): string {
  return texto.startsWith(BOM) ? texto.slice(BOM.length) : texto;
}

/**
 * El separador del fichero. `;` es el de Excel en español —el caso normal aquí— y `,` el del
 * resto. Se decide por la CABECERA, que es la línea que siempre tiene todas las columnas.
 */
export function detectarSeparador(lineaCabecera: string): ';' | ',' {
  return lineaCabecera.includes(';') ? ';' : ',';
}

/**
 * Parsea UNA línea CSV honrando comillas — `"a; b"` es UNA celda y `""` es una comilla literal.
 *
 * SCRUM-339 (bug 3): antes se hacía `line.split(delimiter)` a pelo, así que un `;` dentro del
 * valor partía la fila y desplazaba las columnas: el dato se leía de la celda equivocada.
 */
export function parsearLineaCsv(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // "" = comilla escapada
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Trocea el CSV entero en cabecera + filas, ya parseadas. Devuelve también el separador para
 * que quien lo necesite (por ejemplo, para reescribir las filas rechazadas) no lo re-adivine.
 */
export function trocearCsv(csv: string): { separador: string; cabecera: string[]; filas: string[][] } {
  const lineas = quitarBom(csv).split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas.length === 0) return { separador: ';', cabecera: [], filas: [] };
  const separador = detectarSeparador(lineas[0]);
  return {
    separador,
    cabecera: parsearLineaCsv(lineas[0], separador).map((s) => s.trim()),
    filas: lineas.slice(1).map((l) => parsearLineaCsv(l, separador)),
  };
}

/** Escribe una celda de vuelta a CSV, entrecomillando solo cuando hace falta. */
export function celdaCsv(valor: unknown, separador: string): string {
  const s = String(valor ?? '');
  return /["\n\r]/.test(s) || s.includes(separador) ? `"${s.replace(/"/g, '""')}"` : s;
}
