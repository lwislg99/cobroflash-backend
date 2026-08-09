// SCRUM-377 · EL «(s)» DE PROGRAMADOR NO SE LE ENSEÑA AL PROFESIONAL.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// «1 factura(s) creada(s)» es cómo se escribe un plural cuando no se quiere pensar en el plural.
// El profesional lo lee como lo que es: software a medio hacer. Y aparece en sitios donde el
// número casi siempre es 1 — «1 parte(s) seleccionado(s)»—, así que el paréntesis sobra
// justamente en el caso normal.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ EL CENSO SE MIDIÓ DOS VECES PORQUE EL PRIMER INSTRUMENTO ESTABA MAL
//
// Un `grep` de `\w+\(s\)` sobre los ficheros da 43 resultados y **la mayoría no son texto**:
//
//   · `test(s)`, `has(s)`, `esc(s)`, `Number(s)`, `String(s)`, `includes(s)`, `appendChild(s)`
//     son LLAMADAS con un argumento que se llama `s`. Nada que ver.
//   · `línea(s)` salía como `nea(s)`: `\w` no casa la `í`, así que el instrumento **partía las
//     palabras con tilde** — y en castellano eso no es un detalle.
//
// Por eso este guard mira **solo dentro de literales de cadena** y usa un rango que incluye
// acentos. Contar mal habría dado un número grande y falso, y el trinquete habría nacido flojo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// TRINQUETE, NO PROHIBICIÓN
//
// Los que hay hoy no se arreglan aquí: cada texto nuevo es microcopy y lo aprueba el fundador
// (regla 30). Lo que sí se puede sostener desde hoy es que **el número no suba**: el doceavo cae
// en rojo nombrando su fichero.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['public', 'src'];

// Una palabra CON ACENTOS seguida de `(s)`. Se exige ≥3 letras para no casar `a(s)` ni siglas.
const PLURAL = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}\(s\)/g;
// Literales de cadena: comillas simples, dobles y plantillas. Es donde vive el TEXTO.
const LITERALES = /'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"|`([^`\\]|\\.)*`/gs;

/** Palabras que son CÓDIGO aunque aparezcan dentro de una cadena (nombres de función). */
const NO_ES_TEXTO = new Set(['test', 'has', 'esc', 'Number', 'String', 'includes', 'appendChild', 'function']);

function censo() {
  const out = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { andar(f); continue; }
      if (!/\.(js|ts|mjs|html)$/.test(e.name)) continue;
      const codigo = fs.readFileSync(f, 'utf8');
      // Fuera comentarios: un `(s)` explicado en prosa no lo ve ningún profesional.
      const sinComentarios = codigo.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const lit of sinComentarios.match(LITERALES) || []) {
        for (const m of lit.match(PLURAL) || []) {
          if (NO_ES_TEXTO.has(m.slice(0, -3))) continue;
          out.push({ fichero: path.relative(RAIZ, f).split(path.sep).join('/'), texto: m });
        }
      }
    }
  };
  for (const d of DIRS) andar(path.join(RAIZ, d));
  return out;
}

// El tope se sube A MANO, nunca se deriva del censo: derivarlo haría que añadir uno subiera el
// techo solo (lección de SCRUM-379 y del trinquete de SCRUM-402).
const TOPE = 26;   // medido el 9-ago-2026: 26 ocurrencias en 12 ficheros

test('SCRUM-377 · SUELO: el censo ve «(s)» de verdad, y NO los de código', () => {
  // Dos suelos en uno. Si el censo diera 0, no estaría mirando; si contara `test(s)` o `has(s)`,
  // estaría contando llamadas de función y el trinquete sería humo.
  const c = censo();
  assert.ok(c.length > 0, '🔴 el censo no encuentra ningún «(s)»: el instrumento no está mirando');
  for (const h of c) {
    assert.ok(!NO_ES_TEXTO.has(h.texto.slice(0, -3)),
      `🔴 el censo está contando código como si fuera texto: ${h.texto} en ${h.fichero}`);
  }
});

test('SCRUM-377 · SUELO: las palabras con TILDE se cuentan enteras', () => {
  // El primer instrumento usaba `\w+` y devolvía `nea(s)` en vez de `línea(s)`. En castellano
  // eso no es un detalle: parte justo las palabras que más aparecen.
  assert.match('línea(s)', PLURAL, '🔴 el patrón vuelve a partir las palabras acentuadas');
  assert.match('facturación(s)', PLURAL);
});

test('SCRUM-377 · TRINQUETE: el «(s)» de programador no sube', () => {
  const c = censo();
  const porFichero = new Map();
  for (const h of c) porFichero.set(h.fichero, [...(porFichero.get(h.fichero) || []), h.texto]);

  assert.ok(
    c.length <= TOPE,
    `🔴 HAY ${c.length} «(s)» EN TEXTO DE PANTALLA y el tope es ${TOPE}.\n\n`
    + '  «1 factura(s) creada(s)» es cómo se escribe un plural cuando no se quiere pensar en el\n'
    + '  plural, y el profesional lo lee como software a medio hacer. El texto nuevo NO se\n'
    + '  inventa: se propone al fundador (regla 30) y se baja el tope en el mismo commit.\n\n'
    + [...porFichero].map(([f, t]) => `      ${f} → ${t.join(', ')}`).join('\n'),
  );
});

test('SCRUM-377 · el tope no está por encima de lo que hay (no se afloja solo)', () => {
  // Un tope muy por encima del censo deja sitio para colar varios sin que salte. Se exige que
  // vaya pegado: como mucho, tres de margen.
  const n = censo().length;
  assert.ok(TOPE - n <= 3,
    `🔴 el tope (${TOPE}) va ${TOPE - n} por encima del censo real (${n}): así caben varios nuevos sin rojo`);
});
