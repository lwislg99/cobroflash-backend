// SCRUM-1462 · en las listas en TARJETA (móvil), el nombre del cliente envuelve; no se sale.
//
// La regla compartida `.table--cards-mobile td.cell-client` pedía `overflow-wrap: anywhere`, pero
// la tabla hereda `white-space: nowrap` (≤768 px) y con `nowrap` el texto no tiene dónde partir.
// Se arregló dos veces por separado (`.table--trabajos`, `.table--albaranes`) y seguía roto en las
// demás. Medido en yaqu.app el 6-oct-2026 (Presupuestos, 390 y 320 px): el nombre se salía.
//
// QUÉ MIDE ESTO, y qué no: lee la hoja y comprueba que la regla COMPARTIDA declara las dos cosas
// que hacen falta juntas. No pinta nada: que en pantalla quepa está medido con navegador y escrito
// en `docs/master/SCRUM-1462.md`. Aquí se guarda que nadie quite la mitad que lo hace funcionar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOJA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');

/** Las declaraciones de TODAS las reglas cuyo selector es exactamente ése, sin comentarios. */
function declaracionesDe(css, selector) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(limpio))) {
    const selectores = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (selectores.includes(selector)) out.push(m[2]);
  }
  return out.join(';');
}
const declara = (css, selector, propiedad, valor) =>
  new RegExp(`(^|;)\\s*${propiedad}\\s*:\\s*${valor}\\s*(;|$)`).test(declaracionesDe(css, selector));

const CLIENTE = '.table--cards-mobile td.cell-client';
const TRABAJO = '.table--albaranes td.cell-trabajo';

test('SCRUM-1462 · SUELO: la hoja tiene la regla compartida de la tarjeta, y el lector la encuentra', () => {
  assert.ok(declaracionesDe(HOJA, CLIENTE).includes('grid-area'),
    '🔴 CIEGO: no encuentro `.table--cards-mobile td.cell-client` en la hoja. Lo de abajo no mediría nada.');
  assert.ok(declara(HOJA, '.table td', 'white-space', 'nowrap'),
    '🔴 CIEGO: `.table td` ya no declara `white-space: nowrap`. Si la tabla ha dejado de heredarlo, este guard sobra: revísalo.');
});

test('SCRUM-1462 · 🔴 el cliente ENVUELVE en la tarjeta, en la regla COMPARTIDA: `white-space: normal` y `overflow-wrap: anywhere`', () => {
  assert.ok(declara(HOJA, CLIENTE, 'white-space', 'normal'),
    '🔴 la regla compartida no deshace el `nowrap` de la tabla: el nombre del cliente se sale de la tarjeta en toda lista que no lo arregle por su cuenta.');
  assert.ok(declara(HOJA, CLIENTE, 'overflow-wrap', 'anywhere'),
    '🔴 sin `overflow-wrap: anywhere` una palabra más ancha que la tarjeta se sigue saliendo.');
});

test('SCRUM-1462 · 🔴 el título del Trabajo envuelve en la tarjeta de albaranes', () => {
  assert.ok(declara(HOJA, TRABAJO, 'white-space', 'normal'), '🔴 el Trabajo largo se sale de la tarjeta (medido a 390 y 320 px).');
  assert.ok(declara(HOJA, TRABAJO, 'overflow-wrap', 'anywhere'));
});

test('SCRUM-1462 · CONTROL: número, fecha e importe NO pasan a envolver', () => {
  for (const celda of ['cell-id', 'cell-date', 'cell-amount']) {
    assert.equal(declara(HOJA, `.table--cards-mobile td.${celda}`, 'white-space', 'normal'), false,
      `🔴 \`${celda}\` envuelve: un número o un importe partido en dos líneas se lee mal.`);
  }
});

test('SCRUM-1462 · CONTROL POSITIVO: con la regla de antes (sin `white-space: normal`) el lector CAE', () => {
  const antes = '.table td { white-space: nowrap; }\n@media (max-width: 640px) {\n'
    + '  /* white-space: normal en un comentario no cuenta */\n'
    + '  .table--cards-mobile td.cell-client { grid-area: client; overflow-wrap: anywhere; }\n}';
  assert.equal(declara(antes, CLIENTE, 'overflow-wrap', 'anywhere'), true, 'el lector ve lo que sí está');
  assert.equal(declara(antes, CLIENTE, 'white-space', 'normal'), false,
    '🔴 el lector da por bueno el estado de antes: no caza.');
});
