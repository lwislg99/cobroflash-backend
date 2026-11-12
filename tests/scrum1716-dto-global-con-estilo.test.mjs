// tests/scrum1716-dto-global-con-estilo.test.mjs — SCRUM-1716 (defecto de la casilla)
//
// Sin gate: lee styles.css y quotesView.js. Ni BD, ni red, ni navegador.
//
// La casilla «Descuento global» del editor salía con el estilo del NAVEGADOR (medido en yaqu.app el
// 12-nov-2026 a 390 y 1280: borde 2px inset, radio 0, padding 0, 13,33 px, texto negro). Su `<input>`
// cuelga de `.quote-dto-global__campo`, FUERA de `.quote-line`, así que la regla del campo de DESIGN.md
// (`.quote-line input`) no le llegaba. Se arregla con UN selector más en esa misma regla (y en su foco),
// no con una regla gemela que pueda divergir. La GEOMETRÍA la mide en navegador la sonda del registro
// (`docs/master/SCRUM-1716.md`); este test vigila lo que la sostiene:
//   ① la regla del campo cubre `.quote-dto-global__campo input` con borde, radio, padding y suelo de 44;
//   ② su foco también (borde Verde Confianza + anillo Foco, DESIGN.md §Inputs);
//   ③ el `<input>` del descuento sigue DENTRO de `.quote-dto-global__campo` (si sale, el selector no casa).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-line input,\n.quote-dto-global__campo input {',
    a: '.quote-line input {',
    cae: 'SCRUM-1716 ① ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-line input:focus,\n.quote-dto-global__campo input:focus {',
    a: '.quote-line input:focus {',
    cae: 'SCRUM-1716 ② ·',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: '  dtoGlobalCampo.className = "quote-line__field quote-dto-global__campo";',
    a: '  dtoGlobalCampo.className = "quote-line__field";',
    cae: 'SCRUM-1716 ③ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const CSS = soloCodigo(leer('public/dashboard/css/styles.css'), 'styles.css');
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo }; });
const cuerpoDe = (s) => reglas().filter((r) => r.sel.includes(s)).map((r) => r.cuerpo).join(';');

test('SCRUM-1716 ① · el campo del descuento global lleva el estilo de campo de DESIGN.md', () => {
  const c = cuerpoDe('.quote-dto-global__campo input');
  assert.ok(c, '🔴 ninguna regla cubre `.quote-dto-global__campo input`: la casilla vuelve al estilo del navegador.');
  assert.match(c, /border:\s*1px solid var\(--border/, '🔴 sin el borde 1px Borde de DESIGN.md §Inputs.');
  assert.match(c, /border-radius:\s*var\(--radius-md/, '🔴 sin el radio md (12 px) de DESIGN.md §Inputs.');
  assert.match(c, /padding:\s*\d+px \d+px/, '🔴 sin padding: el texto pega al borde.');
  assert.match(c, /min-height:\s*44px/, '🔴 sin suelo de 44: el campo se queda corto al pulgar (AB6).');
  assert.match(c, /color:\s*var\(--ink/, '🔴 sin el texto en Tinta.');
  // CONTROL POSITIVO: es la MISMA regla que la del campo de línea (si alguien la parte en dos, este
  // test tiene que leer las dos y no dar verde por una sola).
  assert.equal(c, cuerpoDe('.quote-line input'),
    '🔴 el campo del descuento y el de línea ya no comparten regla: dos copias del mismo campo divergen.');
});

test('SCRUM-1716 ② · el foco del campo del descuento global es el de DESIGN.md (borde verde + anillo)', () => {
  const f = cuerpoDe('.quote-dto-global__campo input:focus');
  assert.ok(f, '🔴 ninguna regla cubre el foco de `.quote-dto-global__campo input`: sale el contorno del navegador.');
  assert.match(f, /box-shadow:\s*var\(--ring\)/, '🔴 sin el anillo Foco (DESIGN.md §4).');
  assert.match(f, /border-color:\s*var\(--green-600/, '🔴 sin el borde Verde Confianza al enfocar.');
});

test('SCRUM-1716 ③ · el `<input>` del descuento global sigue dentro de `.quote-dto-global__campo`', () => {
  const js = soloCodigo(leer('public/dashboard/js/quotesView.js'), 'quotesView.js');
  assert.match(js, /dtoGlobalCampo\.className = "quote-line__field quote-dto-global__campo";/,
    '🔴 la caja del descuento ya no lleva `quote-dto-global__campo`: el selector del campo no le llega.');
  assert.match(js, /dtoGlobalCampo\.appendChild\(descuentoGlobalInput\);/,
    '🔴 el `<input>` del descuento ya no está DENTRO de su caja: el selector del campo no le llega.');
});
