// tests/scrum962g-menu-y-descuento-44.test.mjs — SCRUM-962g
//
// Sin gate: lee styles.css, index.html y quotesView.js. Ni BD, ni red, ni navegador.
//
// Dos objetivos de toque que sólo se vieron cortos MIDIENDO EN yaqu.app (23-oct), y que el banco del
// editor no podía ver: el banco no monta la barra superior y no carga la fuente Inter.
//   · «Menú» (`.topbar-hamburger`), el único camino a la navegación en móvil: 36×36 de área. Se amplía
//     el ÁREA con un `::before` de 44×44 centrado; el dibujo no se mueve (captura idéntica byte a byte).
//   · «Descuento global»: su etiqueta ENVUELVE el campo y lo enfoca, así que recibe el dedo. Medía 44,6
//     con la fuente de respaldo y 43,6 con Inter. Se le pone suelo de 44, que no depende de la fuente.
// La GEOMETRÍA la miden en navegador `docs/master/evidencias/scrum962g/` (contra yaqu.app); este test
// vigila lo que la sostiene:
//   ① el `::before` del «Menú»: 44×44, absoluto, centrado, con el botón `position: relative`;
//   ② el «Menú» sigue siendo un `<button class="topbar-hamburger">` en el shell (si cambia la clase, la
//      regla deja de aplicarse en silencio);
//   ③ el suelo de 44 de la etiqueta del descuento global;
//   ④ la etiqueta sigue ENVOLVIENDO el campo (si deja de envolverlo, el suelo no le da área al campo).
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
    de: '.topbar-hamburger { position: relative; }',
    a: '.topbar-hamburger { }',
    cae: 'SCRUM-962g ① ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  width: 44px;\n  height: 44px;\n  transform: translate(-50%, -50%);',
    a: '  width: 40px;\n  height: 44px;\n  transform: translate(-50%, -50%);',
    cae: 'SCRUM-962g ① ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  transform: translate(-50%, -50%);',
    a: '  transform: none;',
    cae: 'SCRUM-962g ① ·',
  },
  {
    fichero: 'public/dashboard/index.html',
    de: '<button class="topbar-hamburger" id="btn-hamburger"',
    a: '<button class="topbar-menu" id="btn-hamburger"',
    cae: 'SCRUM-962g ② ·',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.quote-dto-global__campo { min-height: 44px; }',
    a: '.quote-dto-global__campo { min-height: 40px; }',
    cae: 'SCRUM-962g ③ ·',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: '  dtoGlobalCampo.appendChild(descuentoGlobalInput);',
    a: '  dtoGlobalWrap.appendChild(descuentoGlobalInput);',
    cae: 'SCRUM-962g ④ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const sinComentariosCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = sinComentariosCss(leer('public/dashboard/css/styles.css'));
const reglas = () => CSS.replace(/@media[^{]*\{/g, '').split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo }; });
const cuerpoDe = (s) => reglas().filter((r) => r.sel.includes(s)).map((r) => r.cuerpo).join(';');

test('SCRUM-962g ① · el «Menú» tiene un `::before` de 44×44, absoluto y CENTRADO, contra el botón relativo', () => {
  assert.match(cuerpoDe('.topbar-hamburger'), /position:\s*relative/,
    '🔴 `.topbar-hamburger` no es `position: relative`: su `::before` se colocaría contra la barra entera.');
  const p = cuerpoDe('.topbar-hamburger::before');
  assert.ok(p, '🔴 no está `.topbar-hamburger::before`: el «Menú» vuelve a 36×36 de toque en móvil.');
  assert.match(p, /content:\s*""/, '🔴 el `::before` sin `content` no se pinta y no recibe el toque.');
  assert.match(p, /position:\s*absolute/, '🔴 el `::before` no es absoluto: empujaría la barra.');
  assert.match(p, /width:\s*44px/, '🔴 el `::before` no mide 44 de ancho.');
  assert.match(p, /height:\s*44px/, '🔴 el `::before` no mide 44 de alto.');
  assert.match(p, /top:\s*50%/, '🔴 el `::before` no está centrado en vertical.');
  assert.match(p, /left:\s*50%/, '🔴 el `::before` no está centrado en horizontal.');
  assert.match(p, /transform:\s*translate\(-50%,\s*-50%\)/,
    '🔴 el `::before` no se recentra: crecería hacia un solo lado y se metería en el título.');
});

test('SCRUM-962g ② · el shell sigue pintando el «Menú» como `<button class="topbar-hamburger">`', () => {
  const html = leer('public/dashboard/index.html').replace(/<!--[\s\S]*?-->/g, '');
  const botones = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]).filter((b) => /id="btn-hamburger"/.test(b));
  assert.equal(botones.length, 1, `🔴 NO PUDE MIRAR: esperaba UN botón #btn-hamburger en el shell y hay ${botones.length}.`);
  assert.match(botones[0], /class="[^"]*\btopbar-hamburger\b[^"]*"/,
    `🔴 el «Menú» ya no lleva la clase \`topbar-hamburger\` (${botones[0]}): la regla de 44 no le llega.`);
});

test('SCRUM-962g ③ · la etiqueta del descuento global tiene suelo de 44, que no depende de la fuente', () => {
  assert.match(cuerpoDe('.quote-dto-global__campo'), /min-height:\s*44px/,
    '🔴 `.quote-dto-global__campo` sin `min-height: 44px`: con Inter mide 43,6 y el campo vuelve a ser corto.');
});

test('SCRUM-962g ④ · la etiqueta del descuento global ENVUELVE el campo (por eso su área es la del campo)', () => {
  const js = soloCodigo(leer('public/dashboard/js/quotesView.js'), 'quotesView.js');
  assert.match(js, /const dtoGlobalCampo = document\.createElement\("label"\);/,
    '🔴 la caja del descuento global ya no es un `<label>`: tocarla no enfocaría el campo.');
  assert.match(js, /dtoGlobalCampo\.className = "quote-line__field quote-dto-global__campo";/,
    '🔴 la etiqueta del descuento global ya no lleva `quote-dto-global__campo`: el suelo de 44 no le llega.');
  assert.match(js, /dtoGlobalCampo\.appendChild\(descuentoGlobalInput\);/,
    '🔴 el campo del descuento global ya no está DENTRO de su etiqueta: el suelo de 44 no le da área al campo.');
});
