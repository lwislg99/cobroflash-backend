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
  { de: '--input-border', contra: '--bg', porque: 'contorno de un campo sobre el lienzo' },
  { de: '--input-border', contra: '--surface', porque: 'contorno de un campo dentro de una tarjeta' },
]);

/**
 * 🔴 LA JERARQUÍA, COMO NÚMERO Y NO COMO COMENTARIO.
 *
 * `--input-border` se declara en la hoja como *«borde de input mas visible (legible a pleno sol)»*
 * — texto que ya estaba ahí, no una intención inventada aquí. Pero **una jerarquía que sólo vive
 * en un comentario se invierte en cuanto alguien toca un token**, y eso acaba de pasar: subir
 * `--border` a 3,04 dejó el campo en 1,43, o sea el contorno del campo MÁS FLOJO que el de la
 * tarjeta que lo contiene, al revés de lo que ese mismo comentario promete.
 *
 * ⚠️ LO QUE SE VIGILA ES QUE NO SE INVIERTA, no que la distancia sea exactamente la de hoy. Fijar
 * la proporción (hoy 1,27) convertiría en rojo cualquier ajuste legítimo de cualquiera de los dos.
 * Lo que no puede pasar —lo que pasó— es que el orden se dé la vuelta sin que nadie lo note.
 */
export const JERARQUIA = Object.freeze([
  {
    mas: '--input-border',
    que: '--border',
    porque: 'la hoja declara el borde del campo como «mas visible»; el campo se lee antes que su tarjeta',
  },
]);

/**
 * A qué token le aplica el criterio 1.4.11, DERIVADO DEL USO EN LAS HOJAS y no de su nombre.
 *
 * Un token es un **límite visual** si alguna regla lo pinta en `border*` u `outline*`. Si sólo se
 * usa en `color` es texto, y eso es el criterio 1.4.3 a 4,5 — que ya vigila SCRUM-368, no éste. Si
 * sólo se usa en `background*` es una superficie, y una superficie no es un límite.
 *
 * 🔴 LO QUE NO SE PUEDE DECIDIR VA A `NO_CLASIFICADO`, Y CUENTA DEL LADO MALO: un token que se usa
 * a la vez como fondo y como texto depende del nodo, y uno que no aparece en ninguna hoja no se
 * puede clasificar por su uso. Ninguno de los dos casos es «no aplica».
 */
export const HOJAS = Object.freeze([
  'public/tokens.css', 'public/auth.css', 'public/dashboard/css/styles.css',
]);
const ES_LIMITE = /^(border|outline)(-(top|right|bottom|left))?(-color)?$/;
const ES_FONDO = /^background(-color|-image)?$/;
const ES_TEXTO = /^(color|-webkit-text-fill-color|caret-color|fill|stroke)$/;

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

/** En qué propiedades CSS se pinta cada token, contadas sobre las hojas declaradas. */
export function usoDeTokens(raiz) {
  const css = HOJAS
    .filter((h) => fs.existsSync(path.join(raiz, h)))
    .map((h) => fs.readFileSync(path.join(raiz, h), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const fuera = new Map();
  for (const m of css.matchAll(/([\w-]+)\s*:\s*([^;{}]*)[;}]/g)) {
    for (const v of m[2].matchAll(/var\((--[\w-]+)/g)) {
      if (!fuera.has(v[1])) fuera.set(v[1], new Map());
      const props = fuera.get(v[1]);
      props.set(m[1], (props.get(m[1]) || 0) + 1);
    }
  }
  return fuera;
}

/** Cada token de color con su clase frente a 1.4.11, derivada del uso. */
export function clasificar(raiz) {
  const tokens = tokensDeColor(fs.readFileSync(path.join(raiz, TOKENS), 'utf8'));
  const uso = usoDeTokens(raiz);
  return [...tokens.keys()].map((t) => {
    const props = [...(uso.get(t) || new Map()).keys()];
    const usos = [...(uso.get(t) || new Map()).values()].reduce((a, b) => a + b, 0);
    const limite = props.some((p) => ES_LIMITE.test(p));
    const fondo = props.some((p) => ES_FONDO.test(p));
    const texto = props.some((p) => ES_TEXTO.test(p));
    let clase; let motivo;
    if (usos === 0) { clase = 'NO_CLASIFICADO'; motivo = 'no se pinta en ninguna hoja declarada'; }
    else if (limite) { clase = 'APLICA'; motivo = 'se pinta como límite visual (border/outline)'; }
    else if (texto && !fondo) { clase = 'NO_APLICA'; motivo = 'sólo texto → criterio 1.4.3 a 4,5, que vigila SCRUM-368'; }
    else if (fondo && !texto) { clase = 'NO_APLICA'; motivo = 'sólo fondo, y un fondo no es un límite'; }
    else if (fondo && texto) { clase = 'NO_CLASIFICADO'; motivo = 'fondo Y texto: depende del nodo'; }
    else { clase = 'NO_CLASIFICADO'; motivo = `sólo en propiedades no decididas (${props.join(', ')})`; }
    return { token: t, valor: tokens.get(t), usos, props, clase, motivo };
  });
}

/** El censo: cada par declarado con su medida y su veredicto, más la jerarquía y el reparto. */
export function censar(raiz) {
  const css = fs.readFileSync(path.join(raiz, TOKENS), 'utf8');
  const tokens = tokensDeColor(css);
  const filas = PARES.map((p) => {
    const a = tokens.get(p.de);
    const b = tokens.get(p.contra);
    const r = a && b ? contraste(a, b) : null;
    return { ...p, valorDe: a || null, valorContra: b || null, razon: r, cumple: r === null ? null : r >= UMBRAL_NO_TEXTUAL };
  });

  // La jerarquía se comprueba contra CADA fondo vigilado: invertirse en uno solo ya es invertirse.
  const fondos = [...new Set(PARES.map((p) => p.contra))];
  const jerarquia = JERARQUIA.flatMap((j) => fondos.map((fondo) => {
    const a = tokens.get(j.mas);
    const b = tokens.get(j.que);
    const f = tokens.get(fondo);
    const ra = a && f ? contraste(a, f) : null;
    const rb = b && f ? contraste(b, f) : null;
    return {
      ...j, fondo, razonMas: ra, razonQue: rb,
      cumple: ra === null || rb === null ? null : ra > rb,
    };
  }));

  const clases = clasificar(raiz);
  return {
    tokensDeColor: tokens.size,
    temasExtra: bloquesDeTema(css),
    filas,
    incumplen: filas.filter((f) => f.cumple === false),
    noMedibles: filas.filter((f) => f.cumple === null),
    jerarquia,
    jerarquiaRota: jerarquia.filter((j) => j.cumple !== true),
    clases,
    aplica: clases.filter((c) => c.clase === 'APLICA'),
    noAplica: clases.filter((c) => c.clase === 'NO_APLICA'),
    noClasificados: clases.filter((c) => c.clase === 'NO_CLASIFICADO'),
  };
}

/** La línea que el verde imprime: población y medida, nunca un «0 incumplimientos» suelto. */
export function linea(c) {
  return `población: ${c.tokensDeColor} tokens de color · ${c.filas.length} pares vigilados · `
    + `${c.incumplen.length} POR DEBAJO de ${UMBRAL_NO_TEXTUAL.toFixed(2)} · ${c.noMedibles.length} no medibles `
    + `· bloques de tema extra (modo oscuro): ${c.temasExtra}`;
}

/**
 * El reparto de los tokens frente a 1.4.11. Va aparte de `linea()` a propósito: son dos preguntas
 * distintas —«¿cumplen los pares que vigilo?» y «¿cuántos DEBERÍA vigilar?»— y juntarlas en una
 * sola cifra escondería la segunda, que es la que dice de qué no se sabe nada.
 */
export function lineaDeReparto(c) {
  return `reparto 1.4.11: ${c.clases.length} tokens de color · ${c.aplica.length} APLICA · `
    + `${c.noAplica.length} no aplica · ${c.noClasificados.length} NO CLASIFICADO (cuentan del lado malo) `
    + `· ${c.filas.length} pares vigilados hoy`;
}
