// tests/scrum1559-serializar-lee-los-dos-sitios.test.mjs — SCRUM-1559
//
// El banco guarda cada dato de un nodo en DOS sitios —el campo (`a.href`, `b.type`, `_texto`) y
// `_attrs` / `hijos`— y `serializar` (`scripts/_pagina-panel.mjs`) leía cada uno de UNO solo. Medido
// sobre ce054fb4 en las 18 vistas que montan, con control positivo (marcado y `setAttribute` salen;
// propiedad no):
//   1. atributo puesto por PROPIEDAD (`a.href = …`) → no salía. El censo selecciona `a[href]`: 18
//      enlaces en 5 vistas eran invisibles (Clientes 10 de 10, Informes 5 de 5, el aviso de S2);
//   2. `type` del MARCADO → no salía: `<input type="checkbox">` se servía como cuadro de texto
//      (25 nodos en 7 vistas; Exportar perdía sus 9 casillas);
//   3. texto propio + un hijo (`btn.textContent = 'Nuevo cliente'; btn.appendChild(kbd)`) → salía
//      sólo el hijo y la caja encogía: el CTA de Clientes se medía como «N» (23 nodos).
//
// Cada caso lleva su CONTROL: lo que ya salía tiene que seguir saliendo, y lo que no existe no se
// inventa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodo } from './_banco-vistas.mjs';
import { serializar } from '../scripts/_pagina-panel.mjs';

const reg = () => ({ porId: new Map() });

test('CONTROL · href por marcado y por setAttribute salen, y un <a> sin href sale sin él', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<a href="/marcado">m</a>';
  const a = nodo('a', reg()); a.setAttribute('href', '/attr'); c.appendChild(a);
  c.appendChild(nodo('a', reg()));
  const s = serializar(c);
  assert.ok(s.includes('href="/marcado"'), s);
  assert.ok(s.includes('href="/attr"'), s);
  assert.equal((s.match(/href=/g) || []).length, 2, s);
});

test('href, title, placeholder, name, download y for puestos por PROPIEDAD llegan a la página', () => {
  const a = nodo('a', reg());
  a.href = '/admin/exports/invoices.csv';
  a.title = 'Exportar';
  a.download = 'f.csv';
  const s = serializar(a);
  for (const d of ['href="/admin/exports/invoices.csv"', 'title="Exportar"', 'download="f.csv"']) assert.ok(s.includes(d), `falta ${d} en ${s}`);
  const i = nodo('input', reg());
  i.placeholder = 'Buscar'; i.name = 'q';
  const si = serializar(i);
  assert.ok(si.includes('placeholder="Buscar"') && si.includes('name="q"'), si);
  const l = nodo('label', reg());
  l.htmlFor = 'campo';
  assert.ok(serializar(l).includes('for="campo"'), serializar(l));
});

test('si el atributo y la propiedad están los dos, sale UNA vez', () => {
  const a = nodo('a', reg());
  a.setAttribute('href', '/x');
  a.href = '/x';
  assert.equal((serializar(a).match(/href=/g) || []).length, 1, serializar(a));
});

test('type del MARCADO llega a la página (las casillas de Exportar)', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<input type="checkbox"><button type="button">x</button>';
  // Igualdad con la salida ENTERA, no `includes`: es más estricta y no es un extractor (SCRUM-553).
  assert.equal(serializar(c), '<div><input type="checkbox"><button type="button">x</button></div>');
});

test('CONTROL · type por propiedad sigue saliendo, una vez', () => {
  const i = nodo('input', reg());
  i.type = 'checkbox';
  assert.equal(serializar(i), '<input type="checkbox">');
});

test('texto propio + un hijo: salen los dos, el texto delante (el CTA «Nuevo cliente» + <kbd>)', () => {
  const b = nodo('button', reg());
  b.textContent = 'Nuevo cliente';
  const k = nodo('kbd', reg()); k.textContent = 'N';
  b.appendChild(k);
  assert.equal(serializar(b), '<button>Nuevo cliente<kbd>N</kbd></button>');
});

test('texto del MARCADO delante de un hijo («Tu plan incluye <strong>…</strong>»)', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<p>Tu plan incluye <strong>3</strong></p>';
  assert.equal(serializar(c), '<div><p>Tu plan incluye<strong>3</strong></p></div>');
});

test('CONTROL · un nodo con innerHTML de etiquetas no repite su marcado como texto', () => {
  const c = nodo('div', reg());
  c.innerHTML = '<span>a</span>';
  assert.equal(serializar(c), '<div><span>a</span></div>');
});
