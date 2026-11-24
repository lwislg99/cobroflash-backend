// tests/scrum1825-banco-dataset-es-el-atributo.test.mjs — SCRUM-1825
//
// La dirección CONTRARIA de SCRUM-1821. En el mini-DOM de `tests/_banco-vistas.mjs`, `dataset` era
// un objeto suelto: lo que la vista hacía SOBRE `dataset` no llegaba a `_attrs`.
//   · `delete el.dataset.x` → `getAttribute('data-x')`, `hasAttribute('data-x')` y la página que
//     sirve `serializar` seguían diciendo que el atributo estaba;
//   · `el.dataset.x = 'v'` → no lo creaba en `_attrs`: `hasAttribute` decía que no.
// En `public/` se borra por `dataset` en 5 sitios (api.js, expensesView.js, quotesView.js,
// signaturePad.js ×2). En un navegador `dataset` ES el atributo, en las dos direcciones.
//
// Cada caso lleva su CONTROL: lo que no se toca sigue igual, y la cura no puede ser «no hay nunca».
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodo } from './_banco-vistas.mjs';
import { serializar } from '../scripts/_pagina-panel.mjs';

const reg = () => ({ porId: new Map() });
const conDos = () => {
  const c = nodo('div', reg());
  c.innerHTML = '<span id="a" data-timer="7" data-foo-bar="x">uno</span><span id="b" data-timer="9">dos</span>';
  return c;
};

test('CONTROL · sin tocar nada, el atributo del marcado está en los dos sitios', () => {
  const a = conDos().hijos[0];
  assert.equal(a.dataset.timer, '7');
  assert.equal(a.dataset.fooBar, 'x');
  assert.equal(a.getAttribute('data-timer'), '7');
  assert.equal(a.hasAttribute('data-foo-bar'), true);
});

test('🔴 delete el.dataset.x quita el atributo: getAttribute, hasAttribute, selector y página', () => {
  const c = conDos();
  const a = c.hijos[0];
  delete a.dataset.timer;
  assert.equal(a.dataset.timer, undefined);
  assert.equal('timer' in a.dataset, false);
  assert.equal(a.getAttribute('data-timer'), null, 'getAttribute sigue viendo el data-* borrado por dataset');
  assert.equal(a.hasAttribute('data-timer'), false, 'hasAttribute sigue viendo el data-* borrado por dataset');
  assert.deepEqual(c.querySelectorAll('[data-timer]').map((n) => n.id), ['b']);
  assert.ok(!serializar(a).includes('data-timer'), `la página servida conserva el data-* borrado: ${serializar(a)}`);
});

test('🔴 el.dataset.x = v crea el atributo, con su nombre en guiones', () => {
  const n = nodo('div', reg());
  n.dataset.deSugerencia = '1';
  assert.equal(n.getAttribute('data-de-sugerencia'), '1', 'getAttribute no ve el data-* puesto por dataset');
  assert.equal(n.hasAttribute('data-de-sugerencia'), true, 'hasAttribute no ve el data-* puesto por dataset');
  n.dataset.n = 3;
  assert.equal(n.getAttribute('data-n'), '3', 'el valor se guarda como cadena, como en el navegador');
  assert.equal(n.dataset.n, '3');
});

test('🔴 reescribir por dataset cambia el atributo, y la página sale UNA vez con el valor nuevo', () => {
  const a = conDos().hijos[0];
  a.dataset.timer = '8';
  assert.equal(a.getAttribute('data-timer'), '8');
  const s = serializar(a);
  assert.equal((s.match(/data-timer=/g) || []).length, 1, s);
  assert.ok(s.includes('data-timer="8"'), s);
});

test('CONTROL POSITIVO · borrar uno por dataset deja los demás, en el mismo nodo y en el vecino', () => {
  const c = conDos();
  const [a, b] = c.hijos;
  delete a.dataset.timer;
  assert.equal(a.dataset.fooBar, 'x', 'la cura no puede ser «dataset vacío»');
  assert.equal(a.getAttribute('data-foo-bar'), 'x');
  assert.equal(b.dataset.timer, '9');
  assert.equal(b.hasAttribute('data-timer'), true);
  assert.ok(serializar(a).includes('data-foo-bar="x"'), serializar(a));
});

test('dataset se enumera como en el navegador: sólo los data-*, en camelCase', () => {
  const n = nodo('div', reg());
  n.setAttribute('aria-hidden', 'true');
  n.setAttribute('data-foo-bar', 'x');
  n.dataset.sign = '1';
  assert.deepEqual(Object.keys(n.dataset).sort(), ['fooBar', 'sign']);
  assert.deepEqual({ ...n.dataset }, { fooBar: 'x', sign: '1' });
  assert.equal(n.dataset.ariaHidden, undefined);
});

// `assert` pinta un Proxy por su objetivo, sin pasar por las trampas: si el espejo no se refresca, el
// mensaje de un test rojo dice `{}` de un `dataset` con datos (medido antes de escribir la cura).
test('el mensaje de un assert rojo enseña el dataset de verdad, tras poner, borrar y setAttribute', () => {
  const n = nodo('div', reg());
  n.dataset.sign = '1';
  n.setAttribute('data-foo-bar', 'x');
  n.dataset.fuera = 'z';
  delete n.dataset.fuera;
  let e = null;
  try { assert.deepStrictEqual(n.dataset, { otro: '1' }); } catch (x) { e = x; }
  assert.ok(e, 'el deepStrictEqual tenía que fallar: son distintos');
  assert.match(e.message, /sign: '1'/, e.message);
  assert.match(e.message, /fooBar: 'x'/, e.message);
  assert.doesNotMatch(e.message, /fuera/, e.message);
});

test('dataset es de sólo lectura, como en el navegador: reasignarlo lanza', () => {
  const n = nodo('div', reg());
  assert.throws(() => { n.dataset = { x: '1' }; }, TypeError);
  n.dataset.x = '1';
  assert.equal(n.getAttribute('data-x'), '1');
});

test('lo que no es data-* sigue sin tocar dataset, y quitar por removeAttribute sigue curado (SCRUM-1821)', () => {
  const n = nodo('div', reg());
  n.setAttribute('data-sign', '1');
  n.setAttribute('title', 't');
  n.removeAttribute('title');
  assert.equal(n.dataset.sign, '1');
  n.removeAttribute('data-sign');
  assert.equal(n.dataset.sign, undefined);
  assert.equal(n.hasAttribute('data-sign'), false);
});
