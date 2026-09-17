// scripts/_contraste-de-tokens.mjs — SCRUM-691b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL CONTORNO QUE ESTÁ AHÍ Y NO SE VE.
//
// S5 lo midió y el matiz es lo que decide todo: **no es que las superficies no lleven contorno —
// es que el contorno que llevan está a 1,14 y no se ve**. La norma de DESIGN.md («Plano por
// defecto»: el borde hace el trabajo, la sombra responde a estado) no estaba mal. El valor sí.
//
// ── POR QUÉ SE VIGILAN LOS TOKENS Y NO LAS SUPERFICIES ─────────────────────────────────────
//
// S5 midió también que un guard **no puede** decidir si una superficie concreta necesita contorno:
// eso depende del anidamiento del DOM, y 42 ficheros de `public/dashboard/js/` construyen su
// marcado con `innerHTML` en ejecución. Un guard que lo adivinara daría rojo a la cabecera de un
// modal, que no lo necesita.
//
//   >>> El contraste de un TOKEN es un número y no depende del DOM. Eso sí se puede vigilar. <<<
//
// ── EL UMBRAL, Y DE DÓNDE SALE ─────────────────────────────────────────────────────────────
//
// WCAG 2.1, criterio **1.4.11 Non-text Contrast**: los límites visuales de los componentes de
// interfaz necesitan **3,00:1** contra el color adyacente. Un borde de 1px que separa una tarjeta
// de su lienzo es exactamente eso.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

/** El fichero que manda: DESIGN.md es la norma, y esto es donde vive el valor. */
export const TOKENS = 'public/tokens.css';

/** WCAG 1.4.11 · límite visual de componente: 3,00:1 contra el color adyacente. */
export const UMBRAL_NO_TEXTUAL = 3;

/**
 * Los pares que este guard vigila, y por qué cada uno.
 *
 * ⚠️ SON LOS DOS, NO UNO. Un borde vive sobre el lienzo (`--bg`) o sobre una tarjeta
 * (`--surface`), y `--surface` es más claro: un valor que cumple contra uno puede quedarse corto
 * contra el otro. Declararlos por separado es lo que permite decir cuál es el que aprieta.
 */
export const PARES = Object.freeze([
  { de: '--border', contra: '--bg', porque: 'contorno de una superficie sobre el lienzo' },
  { de: '--border', contra: '--surface', porque: 'divisor dentro de una tarjeta o un modal' },
]);

/** #rgb, #rrggbb → [r,g,b] 0-255. `null` si no es un color hexadecimal. */
export function aRgb(valor) {
  const m = String(valor).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Luminancia relativa (WCAG 2.x, fórmula de sRGB). */
export function luminancia(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores hexadecimales. `null` si alguno no es color. */
export function contraste(a, b) {
  const ra = aRgb(a);
  const rb = aRgb(b);
  if (!ra || !rb) return null;
  const la = luminancia(ra);
  const lb = luminancia(rb);
  const [alto, bajo] = la >= lb ? [la, lb] : [lb, la];
  return (alto + 0.05) / (bajo + 0.05);
}

/**
 * Los tokens de COLOR declarados en la hoja.
 *
 * Se leen con los comentarios BORRADOS primero. Sin eso, un `/* --border: #xxx *​/` de ejemplo
 * dentro de una explicación entraría en el censo como si fuera una declaración viva — que es el
 * defecto de SCRUM-349 aplicado a CSS.
 */
export function tokensDeColor(css) {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const fuera = new Map();
  for (const m of sinComentarios.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const rgb = aRgb(m[2]);
    if (rgb) fuera.set(m[1], m[2].trim());
  }
  return fuera;
}

/**
 * ¿Hay más de un bloque de tokens —un modo oscuro— en esta hoja?
 *
 * Medido el 17-sep-2026: **no existe ninguno** en todo `public/` (cero `prefers-color-scheme`,
 * cero `data-theme`, cero `color-scheme`). Pero el día que alguien lo añada, un guard que sólo
 * mirase `:root` diría verde sobre la mitad del producto. Por eso la pregunta se hace, y si la
 * respuesta cambia el veredicto NO se emite.
 */
export function bloquesDeTema(css) {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...sinComentarios.matchAll(/@media[^{]*prefers-color-scheme|\[data-theme[^\]]*\]/g)].length;
}

/** El censo: cada par declarado con su medida y su veredicto. */
export function censar(raiz) {
  const css = fs.readFileSync(path.join(raiz, TOKENS), 'utf8');
  const tokens = tokensDeColor(css);
  const filas = PARES.map((p) => {
    const a = tokens.get(p.de);
    const b = tokens.get(p.contra);
    const r = a && b ? contraste(a, b) : null;
    return { ...p, valorDe: a || null, valorContra: b || null, razon: r, cumple: r === null ? null : r >= UMBRAL_NO_TEXTUAL };
  });
  return {
    tokensDeColor: tokens.size,
    temasExtra: bloquesDeTema(css),
    filas,
    incumplen: filas.filter((f) => f.cumple === false),
    noMedibles: filas.filter((f) => f.cumple === null),
  };
}

/** La línea que el verde imprime: población y medida, nunca un «0 incumplimientos» suelto. */
export function linea(c) {
  return `población: ${c.tokensDeColor} tokens de color · ${c.filas.length} pares vigilados · `
    + `${c.incumplen.length} POR DEBAJO de ${UMBRAL_NO_TEXTUAL.toFixed(2)} · ${c.noMedibles.length} no medibles `
    + `· bloques de tema extra (modo oscuro): ${c.temasExtra}`;
}
