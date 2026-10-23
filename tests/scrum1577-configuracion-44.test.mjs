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
