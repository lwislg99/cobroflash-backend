// tests/scrum711b-escritorio-36.test.mjs — SCRUM-711 (segunda parte)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD TÁCTIL EXIGE LO QUE DICE DESIGN.md: 44 EN MÓVIL, 36 EN ESCRITORIO
//
// «Nuevo cliente» medía 31 px en móvil. Quitarle `btn-sm`, como a sus cinco hermanas, lo dejaba
// en 45 px en móvil y en 37 en escritorio. El guard lo tumbaba a 929 px porque exigía 44 también
// allí. DESIGN.md §5 no pide eso:
//
//     «Altura cómoda al pulgar: ≥44px en móvil (el escritorio se queda en 36px a propósito —
//      con ratón cumple, y subirlo sería un cambio de aspecto que nadie ha pedido).»
//
// DECISIÓN DEL FUNDADOR (15-sep-2026, SCRUM-711, opción B): esto NO relaja el guard, lo ALINEA
// con la única fuente de tokens. Exigía más de lo que dice la regla de diseño.
//
// 🔒 Y NO SE QUEDA CIEGO EN ESCRITORIO. Un `btn-sm` de 30 px haciendo de acción primaria sigue
// cayendo a 929. El guard lo comprueba en CADA pasada con tres sondas de umbral, junto a la de
// 12 px:
//     40 px a 390 → cae    ·    30 px a 929 → cae    ·    37 px a 929 → pasa
//
// ── LO QUE VIGILA ESTE FICHERO (el guard corre en CI, con navegador; esto corre en la tanda) ──
//   ① `minimoPara` y sus bordes.
//   ② Sus dos cifras ATADAS a su procedencia: el 36 a DESIGN.md y el corte de 768 al `@media` de
//      styles.css que sube los botones a 44. Si una de las dos fuentes cambia, esto cae.
//   ③ Que el guard mida con `minimoPara(ancho)` en sus tres superficies, y no con un 44 fijo.
//   ④ Que las tres sondas de umbral sigan dentro del guard, cada una con su veredicto.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';
import {
  MINIMO_TACTIL, MINIMO_ESCRITORIO, CORTE_MOVIL, minimoPara,
} from '../scripts/_medidor-de-toque.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ═══ ① LOS BORDES ════════════════════════════════════════════════════════════════════════════

test('SCRUM-711 · minimoPara: 44 hasta el corte incluido, 36 a partir de ahí', () => {
  for (const ancho of [320, 360, 390, 768]) {
    assert.equal(minimoPara(ancho), 44, `🔴 a ${ancho} px (móvil) el mínimo tiene que ser 44.`);
  }
  for (const ancho of [769, 929, 1280, 1700]) {
    assert.equal(minimoPara(ancho), 36, `🔴 a ${ancho} px (escritorio) el mínimo tiene que ser 36.`);
  }
  assert.equal(MINIMO_TACTIL, 44, '🔴 el mínimo de móvil ha dejado de ser 44: AB6 no se baja.');
});

test('SCRUM-711 · 🔒 los tres casos del fundador, con la MISMA función que usa el guard', () => {
  // Lo que el guard comprueba en navegador con sus sondas, dicho aquí como aritmética: si
  // `minimoPara` cambiara, estos tres veredictos cambiarían con él.
  assert.ok(40 < minimoPara(390), '🔴 40 px a 390 NO cae: el móvil ha dejado de exigir 44.');
  assert.ok(30 < minimoPara(929), '🔴 30 px a 929 NO cae: el guard se ha quedado ciego en escritorio, '
    + 'y un `btn-sm` haciendo de acción primaria pasaría.');
  assert.ok(37 >= minimoPara(929), '🔴 37 px a 929 NO pasa: el guard sigue exigiendo en escritorio más '
    + 'de lo que dice DESIGN.md, y «Nuevo cliente» vuelve a caer por eso.');
});

// ═══ ② LAS CIFRAS, ATADAS A DE DÓNDE SALEN ═══════════════════════════════════════════════════

test('SCRUM-711 · el 44 y el 36 son los de DESIGN.md, leídos del propio DESIGN.md', () => {
  const design = leer('DESIGN.md');
  // DESIGN.md lo escribe en negrita —`**≥44px en móvil** (el`— y partido en dos líneas: los `*` y el
  // salto se admiten, las palabras no.
  const m = design.match(/≥\s*(\d+)\s*px en móvil\**\s*\(el\s+escritorio se queda en (\d+)\s*px a propósito/);
  assert.ok(m, '🔴 CIEGO: no encuentro en DESIGN.md la frase de la altura de los botones. Si se ha '
    + 'reescrito, estas dos cifras han dejado de estar atadas a su fuente.');
  assert.equal(Number(m[1]), MINIMO_TACTIL,
    `🔴 DESIGN.md dice ≥${m[1]}px en móvil y el medidor exige ${MINIMO_TACTIL}.`);
  assert.equal(Number(m[2]), MINIMO_ESCRITORIO,
    `🔴 DESIGN.md dice ${m[2]}px en escritorio y el medidor exige ${MINIMO_ESCRITORIO}.`);
});

test('SCRUM-711 · el corte de 768 es el del @media de styles.css que sube los botones a 44', () => {
  const css = leer('public/dashboard/css/styles.css');
  // El bloque que lleva la regla de móvil sin `btn-sm` — la misma que SCRUM-352 ata a DESIGN.md.
  const regla = css.indexOf('.btn-primary:not(.btn-sm)');
  assert.ok(regla > 0, '🔴 CIEGO: no encuentro en styles.css la regla móvil de los botones sin `btn-sm`.');
  const medias = [...css.slice(0, regla).matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)];
  assert.ok(medias.length > 0, '🔴 CIEGO: no hay ningún `@media (max-width: …)` antes de esa regla.');
  const corte = Number(medias[medias.length - 1][1]);
  assert.equal(corte, CORTE_MOVIL,
    `🔴 los botones suben a 44 por debajo de ${corte}px y el guard corta en ${CORTE_MOVIL}. Entre las `
    + 'dos cifras quedaría una franja donde el guard exige lo que el CSS no da, o al revés.');
});

// ═══ ③ EL GUARD MIDE CON EL MÍNIMO DE CADA ANCHO ═════════════════════════════════════════════

const GUARD = soloCodigo(leer('scripts/guard-objetivo-tactil.mjs'));

test('SCRUM-711 · el guard importa `minimoPara` y lo usa en sus TRES superficies', () => {
  assert.match(GUARD, /import\s*\{[^}]*\bminimoPara\b[^}]*\}\s*from\s*'\.\/_medidor-de-toque\.mjs'/,
    '🔴 el guard no importa `minimoPara` del medidor único: estaría decidiendo el mínimo por su cuenta.');
  const usos = (GUARD.match(/minimoPara\(ancho\)/g) || []).length;
  assert.ok(usos >= 3,
    `🔴 \`minimoPara(ancho)\` aparece ${usos} veces y el guard tiene tres superficies (landing, lista `
    + 'de Clientes y las vistas del panel). Alguna sigue midiendo con un mínimo fijo.');
});

test('SCRUM-711 · 🔴 ninguna medición se hace ya con el 44 fijo', () => {
  // Así era: `${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, …)` con MINIMO = 44 para todo.
  // Se saca el NOMBRE del segundo argumento de cada llamada y se exige que sea el mínimo del ancho.
  // ⚠️ No con `[^)]*`: se pararía en el `)` de `JSON.stringify(...)` y no llegaría nunca al
  // segundo argumento — un verde que pasaría también con el código viejo.
  const segundos = [...GUARD.matchAll(/\$\{MEDIDOR\}\(\$\{JSON\.stringify\(INTERACTIVOS\)\},\s*\$\{(\w+)\}/g)]
    .map((m) => m[1]);
  assert.ok(segundos.length >= 5,
    `🔴 CIEGO: sólo encuentro ${segundos.length} llamadas al MEDIDOR, y el guard mide la landing (con y sin `
    + 'scroll), la lista de Clientes y las vistas del panel (sonda y medida). La de abajo no mira nada.');
  assert.deepEqual([...new Set(segundos)], ['MIN'],
    '🔴 alguna medición no usa el mínimo de SU ancho: ' + JSON.stringify(segundos)
    + '. Un mínimo igual para todos volvería a exigir 44 a 929 px, más de lo que dice DESIGN.md.');
});

// ═══ ④ LAS SONDAS DE UMBRAL, DENTRO DEL GUARD ═══════════════════════════════════════════════

test('SCRUM-711 · las tres sondas de umbral siguen en el guard, con su veredicto por ancho', () => {
  for (const [nombre, alto] of [['SONDA_40', 40], ['SONDA_30', 30], ['SONDA_37', 37]]) {
    assert.match(GUARD, new RegExp(`const ${nombre} = 'sonda-${alto}'`),
      `🔴 falta \`${nombre}\`: sin ella, «${alto} px» no se comprueba en cada pasada del guard.`);
    assert.match(GUARD, new RegExp(`height:${alto}px`),
      `🔴 la sonda de ${alto} px ya no mide ${alto} px en el HTML que inyecta el guard.`);
  }
  assert.match(GUARD, /ancho <= CORTE_MOVIL/,
    '🔴 las sondas de umbral ya no reparten su veredicto entre móvil y escritorio.');
});
