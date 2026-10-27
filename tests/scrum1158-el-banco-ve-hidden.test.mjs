// tests/scrum1158-el-banco-ve-hidden.test.mjs — SCRUM-1158
//
// El mini-DOM de `tests/_banco-vistas.mjs` refleja `hidden` como el navegador: la PROPIEDAD y el
// ATRIBUTO son la misma cosa, en los dos sentidos.
//
// Antes no lo hacía, y la página que `scripts/_pagina-panel.mjs` serializa para los guards de
// navegador pintaba visible lo que el producto oculta (23 elementos en 5 vistas, medido sobre
// 73e41ab0 con `docs/master/evidencias/scrum1158/censo-hidden-desacorde.mjs`). La dirección que
// da VERDES HUECOS es la contraria y también se fija aquí: algo que nace `hidden` en el marcado y el
// producto enseña con `.hidden = false` seguía oculto para el guard.
//
// Cada caso compara con lo que hace un navegador, y el elemento que nadie toca es el CONTROL: si
// el banco devolviera «oculto» para todo, cae su caso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodo } from './_banco-vistas.mjs';
import { serializar } from '../scripts/_pagina-panel.mjs';

const reg = () => ({ porId: new Map() });
const ocultoAlServir = (n) => /^<[\w-]+\s(?:[^>]*\s)?hidden(?:[\s=>])/.test(serializar(n));

test('CONTROL · un elemento que nadie oculta: .hidden es false y se sirve sin hidden', () => {
  const n = nodo('span', reg());
  assert.equal(n.hidden, false);
  assert.equal(n.getAttribute('hidden'), null);
  assert.equal(ocultoAlServir(n), false);
});

test('el producto oculta por JS (.hidden = true) → el atributo está y la página lo sirve oculto', () => {
  const n = nodo('span', reg());
  n.hidden = true;
  assert.equal(n.getAttribute('hidden'), '');
  assert.equal(n.hasAttribute('hidden'), true);
  assert.equal(ocultoAlServir(n), true, serializar(n));
});

test('nace hidden en el marcado → .hidden es true', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<span id="dto" hidden>Descuento global</span>';
  assert.equal(c.hijos[0].hidden, true);
});

test('🔴 nace hidden y el producto lo ENSEÑA (.hidden = false) → la página lo sirve visible', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<span hidden>Descuento global</span>';
  const n = c.hijos[0];
  n.hidden = false;
  assert.equal(n.hasAttribute('hidden'), false);
  assert.equal(ocultoAlServir(n), false, serializar(n));
});

test('setAttribute / removeAttribute de hidden mueven la propiedad', () => {
  const n = nodo('p', reg());
  n.setAttribute('hidden', '');
  assert.equal(n.hidden, true);
  n.removeAttribute('hidden');
  assert.equal(n.hidden, false);
});

test('el selector [hidden] encuentra lo ocultado por JS, y no lo visible', () => {
  const c = nodo('div', reg());
  const oculto = nodo('span', reg());
  const visible = nodo('span', reg());
  oculto.hidden = true;
  c.appendChild(visible);
  c.appendChild(oculto);
  assert.deepEqual(c.querySelectorAll('[hidden]'), [oculto]);
});
