// SCRUM-1172 (parte S2) · los `btn-sm` de la ficha del Trabajo llegan a 44 px, empezando por los
// de COBRO («📲 Confirmar Bizum recibido», las acciones de cobro, el enlace de pago, confirmar la
// consolidación en factura).
//
// Medido en Edge el 27-sep-2026 con `styles.css` real (registro: docs/master/SCRUM-1172.md): en
// `origin/main` 17 de los 20 `btn-sm` de esta pantalla daban 30 px; con el opt-in, 0 de 20. El
// arreglo es el patrón que ya usaba esta misma pantalla (SCRUM-962, `.job-toolbar-btn-44`): **no se
// toca `.btn-sm` global**, que lo comparten decenas de pantallas y cuyo control negativo es de
// SCRUM-352.
//
// ⚠️ Este test mira el FUENTE; la altura la mide el navegador (el guard de navegador es la parte de
// S3 del mismo ticket). Lo que fija aquí: que ningún `btn-sm` de la ficha se quede SIN el opt-in,
// incluidas las reasignaciones de clase del botón de Bizum al armarse y desarmarse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js', 'jobDetailView.js');
const CSS = path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css');

/** Cada `x.className = '…btn-sm…'` del fuente, con su línea. Los comentarios no cuentan. */
function asignacionesBtnSm() {
  return fs.readFileSync(JS, 'utf8').split(/\r?\n/)
    .map((l, i) => ({ linea: i + 1, m: l.match(/^\s*[^/]*?\.className = '([^']*\bbtn-sm\b[^']*)'/) }))
    .filter((x) => x.m)
    .map((x) => ({ linea: x.linea, clases: x.m[1] }));
}

test('SCRUM-1172 · 🔴 todo `btn-sm` de la ficha del Trabajo lleva el opt-in de 44 px', () => {
  const todas = asignacionesBtnSm();
  // SUELO: medidos 20 el 27-sep. Si el lector encuentra muchos menos, es que no ve, no que no haya.
  assert.ok(todas.length >= 15, `🔴 CIEGO: sólo ${todas.length} asignaciones de btn-sm; se midieron 20`);
  const sin = todas.filter((a) => !/\bjob-toolbar-btn-44\b/.test(a.clases));
  assert.deepEqual(sin, [], '🔴 hay botones de la ficha del Trabajo que se quedan a 30 px');
});

test('SCRUM-1172 · los de COBRO, uno por uno (van primero en la aceptación)', () => {
  const src = fs.readFileSync(JS, 'utf8');
  // El de Bizum cambia de clase al armarse y al desarmarse: las TRES asignaciones llevan el opt-in.
  const bizum = src.match(/bz\.className = '[^']*'/g) || [];
  assert.ok(bizum.length >= 3, `🔴 CIEGO: ${bizum.length} asignaciones de clase del botón de Bizum`);
  for (const b of bizum) assert.match(b, /job-toolbar-btn-44/, `🔴 Confirmar Bizum se queda a 30 px: ${b}`);
  assert.match(src, /payLink\.className = '[^']*job-toolbar-btn-44'/, '🔴 «Enlace de pago» a 30 px');
  assert.match(src, /consolidaConfirm\.className = '[^']*job-toolbar-btn-44'/, '🔴 confirmar la consolidación a 30 px');
});

test('SCRUM-1172 · la regla del opt-in existe y `.btn-sm` global sigue en 30 (control negativo)', () => {
  const css = fs.readFileSync(CSS, 'utf8');
  assert.match(css, /\.job-toolbar-btn-44\s*\{\s*min-height:\s*44px;\s*\}/, '🔴 falta la regla del opt-in');
  assert.match(css, /\.btn\.btn-sm \{[^}]*min-height: 30px;/, '🔴 se tocó `.btn-sm` global (SCRUM-352)');
});
