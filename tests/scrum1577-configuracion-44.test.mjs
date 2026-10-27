// tests/scrum1577-configuracion-44.test.mjs — SCRUM-1577 (de SCRUM-962b, equipo de Luis)
//
// Sin gate: lee `settingsView.js` y `styles.css`. Ni BD, ni red, ni navegador.
//
// «Añadir condición» (Configuración → Facturación, cláusulas del presupuesto) era un `<button>` NATIVO,
// sin clase de la casa y con `font-size:13px` en línea: 22 px de toque a todas las anchuras (962b, nº 1).
// Su hermano de fila, «Quitar», igual (22 px; no salía en 962b porque los datos de muestra no traen
// cláusulas). Ahora llevan `btn btn-secondary` y `btn btn-ghost`, que miden lo que manda DESIGN.md §5:
// 44 en móvil y 36 en escritorio. La GEOMETRÍA la mide en navegador
// `docs/master/evidencias/scrum1577/banco-44.mjs` (3 anchos, con sonda sembrada); este test vigila
// lo que la sostiene:
//   ① que los dos botones lleven una clase de botón de la casa, y NO la variante pequeña (`btn-sm` se
//      queda en 30 también en móvil, DESIGN.md §5);
//   ② que no vuelvan a llevar un `style=` en línea (era lo que les quitaba el aspecto de botón);
//   ③ que la regla de móvil que sube esas clases a 44 siga existiendo en `styles.css`.
//
// SCRUM-1577b (partes 2 y 3): el selector de color de marca llevaba `height:38px` en un `style=` en línea
// (38,7 px de toque) y a 320 se encogía a 18,2 de ancho; los `select` «Retención de IRPF» y «¿Qué tipo
// de actividad tienes?» daban 36,5–37 (su alto sale de `.input`, sin mínimo). Ahora los tres van a 44 en
// todas las anchuras desde el bloque «J3 · SCRUM-1577b» de `styles.css`. Este test vigila:
//   ④ el color: sin `style=` en línea (ganaría a la hoja), con `height: 44px` y `flex: none`, y su fila
//      con `flex-wrap: wrap` (sin ella, a 320 «Sin color (por defecto)» sale cortado por la tarjeta);
//   ⑤ los dos `select`: el mínimo de 44 por su id, fuera de toda `@media`, y los ids siguen en la vista.
//
// SCRUM-1577c (parte 4, decisión del fundador en c.20987: el enlace en línea NO se exime, DESIGN.md §6):
// el enlace `yaqu.app/p/…` de «Tu página pública» daba 17 px de toque a 390 y 929, y a 320 se partía en
// dos renglones. Ahora lleva `pp-enlace`, que en el bloque «J3 · SCRUM-1577c» de `styles.css` lo hace
// `inline-flex` con `min-height: 44px` en todas las anchuras. Este test vigila:
//   ⑥ el enlace (por su destino `/p/`, no por su posición) lleva `pp-enlace` y ningún `style=`, y la regla
//      está fuera de toda `@media` con su `display: inline-flex` (sin él, `min-height` no hace nada en un
//      enlace en línea) y su `min-height: 44px`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/settingsView.js',
    de: `'<button type="button" class="btn btn-secondary" id="clausulas-anadir">'`,
    a: `'<button type="button" id="clausulas-anadir">'`,
    cae: 'SCRUM-1577 ① ·',
  },
  {
    fichero: 'public/dashboard/js/settingsView.js',
    de: `'<button type="button" class="btn btn-secondary" id="clausulas-anadir">'`,
    a: `'<button type="button" class="btn btn-secondary btn-sm" id="clausulas-anadir">'`,
    cae: 'SCRUM-1577 ① ·',
  },
  {
    fichero: 'public/dashboard/js/settingsView.js',
    de: `'<button type="button" class="btn btn-ghost" data-clausula-quitar="' + i + '">'`,
    a: `'<button type="button" class="btn btn-ghost" data-clausula-quitar="' + i + '" style="font-size:13px">'`,
    cae: 'SCRUM-1577 ② ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  .btn-ghost:not(.btn-sm) { min-height: 44px; }',
    a: '  .btn-ghost:not(.btn-sm) { }',
    cae: 'SCRUM-1577 ③ ·',
  },
  {
    fichero: 'public/dashboard/js/settingsView.js',
    de: '<input type="color" id="brand-color-input" value="#22c55e"/>',
    a: '<input type="color" id="brand-color-input" value="#22c55e" style="height:38px"/>',
    cae: 'SCRUM-1577 ④ ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  flex: none; width: 48px; height: 44px; padding: 2px;',
    a: '  width: 48px; height: 38px; padding: 2px;',
    cae: 'SCRUM-1577 ④ ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: ':has(> #brand-color-input) { flex-wrap: wrap; }',
    a: ':has(> #brand-color-input) { }',
    cae: 'SCRUM-1577 ④ ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '#actividad-tipo { min-height: 44px; }',
    a: '#actividad-tipo { }',
    cae: 'SCRUM-1577 ⑤ ·',
  },
  {
    fichero: 'public/dashboard/js/settingsView.js',
    de: '<a class="pp-enlace" href="/p/${escSettings(m.slug)}"',
    a: '<a href="/p/${escSettings(m.slug)}"',
    cae: 'SCRUM-1577 ⑥ ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.pp-enlace { display: inline-flex; align-items: center; min-height: 44px; }',
    a: '.pp-enlace { align-items: center; min-height: 44px; }',
    cae: 'SCRUM-1577 ⑥ ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.pp-enlace { display: inline-flex; align-items: center; min-height: 44px; }',
    a: '.pp-enlace { display: inline-flex; align-items: center; }',
    cae: 'SCRUM-1577 ⑥ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// La etiqueta de apertura de cada botón, por su IDENTIDAD (id o atributo de datos), no por su posición.
const BOTONES = [
  ['«Añadir condición»', /<button\b[^>]*\bid="clausulas-anadir"[^>]*>/g, 'btn-secondary'],
  ['«Quitar» (fila de cláusula)', /<button\b[^>]*\bdata-clausula-quitar="[^>]*>/g, 'btn-ghost'],
];
const etiquetas = (re) => JS.match(re) || [];

test('SCRUM-1577 ① · «Añadir condición» y «Quitar» llevan clase de botón de la casa, y no la pequeña', () => {
  for (const [nombre, re, clase] of BOTONES) {
    const t = etiquetas(re);
    assert.equal(t.length, 1, `🔴 NO PUDE MIRAR: ${nombre} aparece ${t.length} veces en settingsView.js (esperaba 1).`);
    const clases = (t[0].match(/\bclass="([^"]*)"/) || [, ''])[1].split(/\s+/);
    assert.ok(clases.includes(clase),
      `🔴 ${nombre} sin \`${clase}\` (${t[0]}): vuelve a ser un botón nativo de 22 px de toque.`);
    assert.ok(!clases.includes('btn-sm'),
      `🔴 ${nombre} con \`btn-sm\`: se queda en 30 px también en móvil (DESIGN.md §5).`);
  }
});

test('SCRUM-1577 ② · los dos botones no llevan estilo en línea', () => {
  for (const [nombre, re] of BOTONES) {
    for (const t of etiquetas(re)) {
      assert.doesNotMatch(t, /\bstyle=/, `🔴 ${nombre} lleva \`style=\` en línea otra vez: ${t}`);
    }
  }
});

test('SCRUM-1577 ③ · la regla de móvil que sube `.btn-secondary` y `.btn-ghost` a 44 sigue en styles.css', () => {
  const movil = [...CSS.matchAll(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.ok(movil.length > 0, '🔴 NO PUDE MIRAR: no encuentro ningún `@media (max-width: 768px)` en styles.css.');
  for (const clase of ['btn-secondary', 'btn-ghost']) {
    assert.match(movil, new RegExp(`\\.${clase}:not\\(\\.btn-sm\\)[^{]*\\{\\s*min-height:\\s*44px;`),
      `🔴 en móvil ya no hay \`.${clase}:not(.btn-sm) { min-height: 44px }\`: los dos botones volverían a 36.`);
  }
});

// La hoja (ya sin comentarios) SIN los bloques `@media`, recortados por llaves equilibradas: lo que queda
// vale en TODAS las anchuras. Los selectores se anclan a principio de línea (A23 nº 4).
const SUPERIOR = (() => {
  let out = '', i = 0;
  while (i < CSS.length) {
    const m = CSS.indexOf('@media', i);
    if (m < 0) { out += CSS.slice(i); break; }
    out += CSS.slice(i, m);
    let j = CSS.indexOf('{', m), prof = 0;
    for (; j < CSS.length; j++) { if (CSS[j] === '{') prof++; else if (CSS[j] === '}' && --prof === 0) break; }
    i = j + 1;
  }
  return out;
})();
// La etiqueta del selector de color, por su id.
const COLOR = JS.match(/<input\b[^>]*\bid="brand-color-input"[^>]*>/g) || [];
const reglaDe = (selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\#>:]/g, '\\$&');
  const m = SUPERIOR.match(new RegExp(`\\n${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
};

test('SCRUM-1577 ④ · el selector de color mide 44 sin estilo en línea, no se encoge y su fila salta de línea', () => {
  assert.ok(SUPERIOR.length > 0 && SUPERIOR.length < CSS.length,
    `🔴 NO PUDE MIRAR: el recorte de @media no quitó nada (${SUPERIOR.length} de ${CSS.length}).`);
  assert.equal(COLOR.length, 1, `🔴 NO PUDE MIRAR: el color de marca aparece ${COLOR.length} veces en settingsView.js (esperaba 1).`);
  assert.doesNotMatch(COLOR[0], /\bstyle=/, `🔴 el color lleva \`style=\` en línea otra vez (le gana a la hoja): ${COLOR[0]}`);
  const regla = reglaDe('#brand-color-input');
  assert.ok(regla !== null, '🔴 en styles.css, fuera de @media, no hay regla `#brand-color-input { … }` al principio de línea.');
  assert.match(regla, /(^|;)\s*height:\s*44px;/, `🔴 \`#brand-color-input\` sin \`height: 44px\` (era 38): ${regla.trim()}`);
  assert.match(regla, /(^|;)\s*flex:\s*none;/, `🔴 \`#brand-color-input\` sin \`flex: none\`: a 320 se encoge a 18 px de ancho.`);
  const fila = reglaDe(':has(> #brand-color-input)');
  assert.ok(fila !== null && /flex-wrap:\s*wrap;/.test(fila),
    '🔴 la fila del color no tiene `flex-wrap: wrap`: a 320 «Sin color (por defecto)» sale cortado por la tarjeta.');
});

test('SCRUM-1577 ⑤ · los dos select de Facturación tienen mínimo de 44 en todas las anchuras', () => {
  for (const id of ['retencion-irpf-tipo', 'actividad-tipo']) {
    assert.match(JS, new RegExp(`\\.id = "${id}";`), `🔴 NO PUDE MIRAR: settingsView.js ya no da el id \`${id}\`; la regla apuntaría a nada.`);
  }
  const m = SUPERIOR.match(/\n#retencion-irpf-tipo,\s*\n#actividad-tipo\s*\{([^}]*)\}/);
  assert.ok(m, '🔴 en styles.css, fuera de @media, no está la regla `#retencion-irpf-tipo,\\n#actividad-tipo { … }`.');
  assert.match(m[1], /(^|;)\s*min-height:\s*44px;/, `🔴 los dos select sin \`min-height: 44px\`: vuelven a 36 (\`.input\` no tiene mínimo). ${m[1].trim()}`);
});

test('SCRUM-1577 ⑥ · el enlace de «Tu página pública» llega a 44 de toque en todas las anchuras', () => {
  const enlaces = JS.match(/<a\b[^>]*\bhref="\/p\/\$\{[^>]*>/g) || [];
  assert.equal(enlaces.length, 1, `🔴 NO PUDE MIRAR: el enlace a \`/p/…\` aparece ${enlaces.length} veces en settingsView.js (esperaba 1).`);
  const clases = (enlaces[0].match(/\bclass="([^"]*)"/) || [, ''])[1].split(/\s+/);
  assert.ok(clases.includes('pp-enlace'), `🔴 el enlace de la página pública sin \`pp-enlace\`: vuelve a 17 px de toque. ${enlaces[0]}`);
  assert.doesNotMatch(enlaces[0], /\bstyle=/, `🔴 el enlace de la página pública lleva \`style=\` en línea: ${enlaces[0]}`);
  const regla = reglaDe('.pp-enlace');
  assert.ok(regla !== null, '🔴 en styles.css, fuera de @media, no hay regla `.pp-enlace { … }` al principio de línea.');
  assert.match(regla, /(^|;)\s*display:\s*inline-flex;/, `🔴 \`.pp-enlace\` sin \`display: inline-flex\`: en un enlace en línea \`min-height\` no hace nada. ${regla.trim()}`);
  assert.match(regla, /(^|;)\s*min-height:\s*44px;/, `🔴 \`.pp-enlace\` sin \`min-height: 44px\`: vuelve a 17 px. ${regla.trim()}`);
});
