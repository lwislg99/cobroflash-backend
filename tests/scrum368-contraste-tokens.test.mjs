// tests/scrum368-contraste-tokens.test.mjs — SCRUM-368, guard de tokens, sin gate.
//
// LOS COLORES DE TOKENS.CSS NO SE MUEVEN SIN QUE ALGO SE PONGA ROJO.
//
// ── QUÉ ES Y QUÉ NO ES ───────────────────────────────────────────────────────
// Esto NO es el censo estático que se descartó. Aquel intentaba adivinar sobre qué fondo cae
// cada texto leyendo selectores, y se equivocaba: daba `.sidebar-logo-text` en 1,00 (blanco
// sobre blanco) sin saber que ese texto vive en el sidebar oscuro. Adivinar ancestros no
// funciona; el barrido de verdad lo hace `npm run guard:contraste` EN NAVEGADOR.
//
// Este fichero comprueba otra cosa, más pequeña y sin inferencia: que los PARES DE TOKENS que
// la medición dejó fijados sigan dando el ratio que dieron. Son valores explícitos de
// `tokens.css`, así que es aritmética sobre hex conocidos — no hay ancestro que adivinar.
//
// Hace falta porque el guard de navegador vive fuera de `npm test` (necesita Edge): sin esto,
// alguien podría tocar `--muted` o `--brand-tint-ink` y no enterarse hasta que alguien se
// acordara de correr el guard a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = fs.readFileSync(path.join(AQUI, '..', 'public/tokens.css'), 'utf8');

/** Lee un token de color de tokens.css. */
function token(nombre) {
  const m = TOKENS.match(new RegExp(`--${nombre}\\s*:\\s*(#[0-9a-fA-F]{3,6})\\s*;`));
  return m ? m[1].toLowerCase() : null;
}

const rgb = (h) => { let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) }; };
const lum = ({ r, g, b }) => { const f = (c) => { const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
/** Ratio WCAG entre dos colores opacos. */
export function ratio(a, b) {
  const l1 = lum(rgb(a)), l2 = lum(rgb(b));
  const [x, y] = l1 > l2 ? [l1, l2] : [l2, l1];
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
}

// ── SUELO ───────────────────────────────────────────────────────────────────

test('SUELO: los tokens de color existen y se leen', () => {
  for (const t of ['brand', 'brand-tint-ink', 'muted', 'bg', 'surface', 'ink', 'body']) {
    assert.ok(token(t), `--${t} no se pudo leer de tokens.css: el guard estaría midiendo el vacío`);
  }
});

test('SUELO: la función de contraste da los valores canónicos de WCAG', () => {
  assert.equal(ratio('#000000', '#ffffff'), 21, 'negro sobre blanco debe dar 21:1');
  assert.equal(ratio('#ffffff', '#ffffff'), 1, 'blanco sobre blanco debe dar 1:1');
});

// ── LO VIGILADO ─────────────────────────────────────────────────────────────

test('--muted cumple AA sobre los dos lienzos del producto', () => {
  // Medido en navegador: antes era #6b756f y daba 4,44 sobre --bg — por debajo de 4,5 por 0,06,
  // en 31 nodos de 8 páginas. Se corrigió -1 por canal (SCRUM-368).
  const m = token('muted');
  assert.ok(ratio(m, token('bg')) >= 4.5,
    `--muted ${m} sobre --bg ${token('bg')} da ${ratio(m, token('bg'))}:1, por debajo de 4,5`);
  assert.ok(ratio(m, token('surface')) >= 4.5,
    `--muted ${m} sobre --surface da ${ratio(m, token('surface'))}:1, por debajo de 4,5`);
});

test('--brand-tint-ink es un verde de TEXTO válido sobre los dos lienzos', () => {
  // tokens.css lo describe como «texto sobre --brand-tint». SCRUM-368 lo puso también donde
  // antes iba --brand como color de texto (enlaces, eyebrows), que daba 3,30.
  const t = token('brand-tint-ink');
  for (const fondo of ['bg', 'surface']) {
    assert.ok(ratio(t, token(fondo)) >= 4.5,
      `--brand-tint-ink ${t} sobre --${fondo} da ${ratio(t, token(fondo))}:1, por debajo de 4,5`);
  }
});

test('--body y --ink siguen cumpliendo AA (no se han tocado, pero se vigilan)', () => {
  for (const t of ['body', 'ink']) {
    for (const fondo of ['bg', 'surface']) {
      assert.ok(ratio(token(t), token(fondo)) >= 4.5,
        `--${t} sobre --${fondo} da ${ratio(token(t), token(fondo))}:1`);
    }
  }
});

// ── LO QUE SIGUE SIN CUMPLIR, ANOTADO CON SU NÚMERO ─────────────────────────

test('el verde de marca sobre blanco sigue SIN cumplir AA — y está medido, no olvidado', () => {
  // No es una regresión: es la decisión pendiente del fundador (identidad, regla 30).
  // Este test NO exige que cumpla; exige que el número siga siendo el que se midió, para que
  // si alguien mueve --brand se entere de que ha tocado la pieza que está en discusión.
  const r = ratio('#ffffff', token('brand'));
  assert.equal(r, 3.3,
    `blanco sobre --brand ${token('brand')} daba 3,3:1 y ahora da ${r}:1. Si el verde se ha ` +
    'movido, es un cambio de identidad (regla 30) y necesita el OK del fundador.');
});

test('MEDIDO: no existe un verde MÁS CLARO que cumpla AA con texto blanco', () => {
  // Cierra una puerta que todo el mundo daba por abierta. Para 4,5:1 con blanco hace falta
  // luminancia <= 0,1748, y todo verde que lo logra es MÁS OSCURO que --brand. Aclarar EMPEORA.
  const brand = token('brand');
  const masClaros = ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'];
  for (const v of masClaros) {
    assert.ok(lum(rgb(v)) > lum(rgb(brand)), `${v} debería ser más claro que --brand`);
    assert.ok(ratio('#ffffff', v) < ratio('#ffffff', brand),
      `${v} es más claro que --brand y sin embargo mejora el contraste con blanco: revisa el cálculo`);
  }
  // el umbral exacto, para que quede escrito y medido
  const umbralLum = +(0.05 * 4.5 - 0.05).toFixed(4);
  assert.equal(umbralLum, 0.175, 'luminancia máxima para 4,5:1 contra blanco');
  assert.ok(lum(rgb(brand)) > umbralLum,
    `--brand tiene luminancia ${lum(rgb(brand)).toFixed(4)}, por encima del máximo ${umbralLum}`);
});
