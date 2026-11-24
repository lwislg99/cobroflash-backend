// tests/scrum1821-banco-removeattribute-data.test.mjs — SCRUM-1821
//
// En el mini-DOM de `tests/_banco-vistas.mjs`, `removeAttribute('data-x')` borraba el atributo de
// `_attrs` pero NO de `dataset`, y el selector `[data-x]` lee `dataset`. Un nodo al que la vista le
// quita un `data-*` SEGUÍA casando con `[data-x]`; en un navegador no casa (hallazgo de S4, 24-nov).
// La dirección es la mala: un test que afirme «tras quitarlo, ya no hay ninguno» lo ve MAL, y uno que
// busque el que lo conserva cuenta de más.
//
// Cada caso compara con lo que hace un navegador. El nodo que conserva su atributo es el CONTROL: si
// la cura fuera «[data-x] no casa nunca», cae su caso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodo } from './_banco-vistas.mjs';

const reg = () => ({ porId: new Map() });
const lista = () => {
  const c = nodo('ul', reg());
  c.innerHTML = '<li id="a" data-sign="1">uno</li><li id="b" data-sign="2">dos</li>';
  return c;
};

test('CONTROL · sin tocar nada, [data-sign] casa con los dos y con su valor', () => {
  const c = lista();
  assert.equal(c.querySelectorAll('[data-sign]').length, 2);
  assert.equal(c.querySelector('[data-sign="2"]').id, 'b');
});

test('🔴 quitado con removeAttribute, el nodo deja de casar con [data-x] y con [data-x="v"]', () => {
  const c = lista();
  c.hijos[0].removeAttribute('data-sign');
  const casan = c.querySelectorAll('[data-sign]').map((n) => n.id);
  assert.deepEqual(casan, ['b'], 'el nodo sin data-sign sigue casando con [data-sign] (en un navegador no casa)');
  assert.equal(c.querySelector('[data-sign="1"]'), null);
});

test('🔴 quitado, desaparece también de dataset, getAttribute y hasAttribute', () => {
  const c = lista();
  const a = c.hijos[0];
  a.removeAttribute('data-sign');
  assert.equal(a.dataset.sign, undefined);
  assert.equal('sign' in a.dataset, false);
  assert.equal(a.getAttribute('data-sign'), null);
  assert.equal(a.hasAttribute('data-sign'), false);
});

test('CONTROL POSITIVO · el nodo que SÍ conserva el atributo sigue casando, con su valor', () => {
  const c = lista();
  c.hijos[0].removeAttribute('data-sign');
  const b = c.querySelector('[data-sign="2"]');
  assert.ok(b, 'la cura no puede ser «no casa nunca»');
  assert.equal(b.dataset.sign, '2');
  assert.equal(b.hasAttribute('data-sign'), true);
});

test('el nombre con guiones se quita en camelCase (data-foo-bar → dataset.fooBar), y sólo ése', () => {
  const n = nodo('div', reg());
  n.setAttribute('data-foo-bar', 'x');
  n.setAttribute('data-foo', 'y');
  n.removeAttribute('data-foo-bar');
  assert.equal(n.dataset.fooBar, undefined);
  assert.equal(n.dataset.foo, 'y');
  assert.equal(n.getAttribute('data-foo'), 'y');
});

test('quitar un atributo que no es data-* no toca dataset', () => {
  const n = nodo('div', reg());
  n.setAttribute('data-sign', '1');
  n.setAttribute('aria-hidden', 'true');
  n.removeAttribute('aria-hidden');
  assert.equal(n.getAttribute('aria-hidden'), null);
  assert.equal(n.dataset.sign, '1');
});
