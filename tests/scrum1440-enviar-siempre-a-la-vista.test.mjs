// SCRUM-1440 · PRESUPUESTO RÁPIDO: «Enviar por WhatsApp» no puede quedar fuera de la pantalla.
//
// Medido en yaqu.app (2-oct-2026): la hoja entera se desplaza y el pie iba dentro. A 390×844, en
// «3 opciones», el contenido mide 896 px en una hoja de 760 y el botón quedaba en y=865.
//
// ⚠️ LO QUE ESTE FICHERO ES: un guard sobre el FUENTE de `styles.css`. No dibuja nada. La medida
// de verdad —el botón entero en pantalla y pulsable en ocho ventanas de móvil— está en el
// registro, hecha con navegador. Esto sólo impide que alguien quite la regla sin enterarse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Las declaraciones de TODAS las reglas cuyo selector es exactamente `selector`, fuera de `@media`. */
function declaracionesDe(selector) {
  const fuera = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const reglas = [...fuera.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').map((s) => s.trim()).includes(selector));
  const mapa = {};
  for (const r of reglas) for (const d of r[2].split(';')) {
    const i = d.indexOf(':');
    if (i > 0) mapa[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  }
  return { cuantas: reglas.length, mapa };
}

test('SCRUM-1440 · suelo: el lector de reglas ve `.modal` y que es ella la que se desplaza', () => {
  const modal = declaracionesDe('.modal');
  assert.ok(modal.cuantas >= 1, '🔴 CIEGO: no encuentro la regla `.modal`');
  assert.equal(modal.mapa['overflow-y'], 'auto', '🔴 la hoja ya no se desplaza entera: la premisa de este guard ha cambiado, reléelo');
});

test('SCRUM-1440 · 🔴 el pie del presupuesto rápido se queda pegado abajo', () => {
  const pie = declaracionesDe('.qq-modal .modal-footer');
  assert.ok(pie.cuantas >= 1, '🔴 no hay regla para `.qq-modal .modal-footer`: el botón vuelve a irse con el desplazamiento');
  assert.equal(pie.mapa.position, 'sticky');
  assert.equal(pie.mapa.bottom, '0');
});

test('SCRUM-1440 · 🔴 el pie es OPACO: lo que se desplaza por debajo no se lee encima de los botones', () => {
  const pie = declaracionesDe('.qq-modal .modal-footer');
  const fondo = pie.mapa.background || pie.mapa['background-color'] || '';
  assert.ok(fondo && !/transparent|rgba\([^)]*,\s*0?\.\d+\)/.test(fondo), `🔴 el pie pegado no tiene fondo opaco («${fondo}»)`);
  assert.equal(fondo, declaracionesDe('.modal').mapa.background, 'el fondo del pie es el de la hoja');
});

test('SCRUM-1440 · CONTROL: el lector no se inventa reglas — un selector que no existe da cero', () => {
  assert.equal(declaracionesDe('.qq-modal .no-existe-1440').cuantas, 0);
});
