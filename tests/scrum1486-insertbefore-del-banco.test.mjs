// tests/scrum1486-insertbefore-del-banco.test.mjs — SCRUM-1486
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// `insertBefore` EXISTÍA EN EL BANCO Y HACÍA OTRA COSA: ignoraba el nodo de referencia y ponía
// lo insertado SIEMPRE el primero. Y `firstChild` y `nextSibling` no existían (`undefined`).
//
// No era un hueco de los que revientan —ésos se ven—: era una API que contesta, y contesta mal.
// Medido antes de arreglar (el censo está en el ticket): 15 llamadas en 7 vistas, 22 ficheros de
// test las ejecutan y 13 montaban un DOM que no es el del navegador (el título y el subtítulo de
// Ajustes invertidos; el selector de Productos el primero de cinco; la tarjeta de la Inicio la
// primera). NINGÚN veredicto dependía de ello: 184 tests antes, los mismos 184 después.
//
// 🔴 LAS TRES PIEZAS VAN JUNTAS, y por eso van en el mismo fichero. Con `insertBefore` fiel y sin
// `firstChild`, `x.insertBefore(nuevo, x.firstChild)` —que hoy cae bien POR ACCIDENTE: referencia
// `undefined` + `unshift`— se iría al final. Arreglar sólo la línea que se veía empeoraba el banco.
//
// ⚠️ LO QUE ESTE FICHERO NO HACE: comprobar que cada vista coloque BIEN sus nodos. Eso es del
// dueño de cada vista. Aquí se monta una vista de cada patrón sólo para ver que el banco la deja
// donde la deja el navegador; el veredicto es sobre el banco.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 🔴 MUTACIONES_QUE_ME_TUMBAN · cada una devuelve al banco UNA de las formas del defecto, y dice
// qué caso tiene que caer. Se ejecutan con `npm run meta:mutaciones`. El banco de antes ENTERO
// (las tres piezas a la vez) no cabe en un reemplazo: su rojo está en
// `docs/master/evidencias/SCRUM-1486/`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // ① EL DEFECTO DE ORIGEN: la referencia se ignora y todo va el primero.
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '      n.hijos.splice(i < 0 ? n.hijos.length : i, 0, h);',
    a: '      n.hijos.unshift(h);',
    cae: 'antes de un nodo INTERMEDIO',
  },
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '      n.hijos.splice(i < 0 ? n.hijos.length : i, 0, h);',
    a: '      n.hijos.unshift(h);',
    cae: 'referencia NULA: al final',
  },
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '      n.hijos.splice(i < 0 ? n.hijos.length : i, 0, h);',
    a: '      n.hijos.unshift(h);',
    cae: 'MOVER un nodo que ya era hijo',
  },
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '      n.hijos.splice(i < 0 ? n.hijos.length : i, 0, h);',
    a: '      n.hijos.unshift(h);',
    cae: 'nodo real · Ajustes',
  },
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '      n.hijos.splice(i < 0 ? n.hijos.length : i, 0, h);',
    a: '      n.hijos.unshift(h);',
    cae: 'el aviso en rojo va JUSTO',
  },
  // ② EL ARREGLO A MEDIAS: `insertBefore` fiel y sin `firstChild`. Lo que hoy cae bien por
  //    accidente se iría al final.
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '    get firstChild() { return n.hijos[0] || null; },',
    a: '    get primerHijoQuitado() { return null; },',
    cae: 'la referencia es el PRIMER hijo',
  },
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '    get firstChild() { return n.hijos[0] || null; },',
    a: '    get primerHijoQuitado() { return null; },',
    cae: 'la puerta de serie se pone la PRIMERA',
  },
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '    get firstChild() { return n.hijos[0] || null; },',
    a: '    get primerHijoQuitado() { return null; },',
    cae: 'existen, y cuando no hay dan',
  },
  // ③ Y sin `nextSibling`: «detrás de Y» se convierte en «al final del padre».
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '    get nextSibling() {',
    a: '    get siguienteQuitado() {',
    cae: 'el aviso en rojo va JUSTO',
  },
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '    get nextSibling() {',
    a: '    get siguienteQuitado() {',
    cae: 'existen, y cuando no hay dan',
  },
  // ④ `undefined` donde el navegador da `null`.
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '    get firstChild() { return n.hijos[0] || null; },',
    a: '    get firstChild() { return n.hijos[0]; },',
    cae: 'existen, y cuando no hay dan',
  },
  // ⑤ LA REFERENCIA AJENA SE TRAGA: el nodo acaba al final en vez de lanzar.
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '      if (r && !n.hijos.includes(r)) {',
    a: '      if (false) {',
    cae: 'una referencia que NO es hija',
  },
  // ⑥ Insertar un nodo antes de sí mismo lo manda al final.
  {
    fichero: 'tests/_banco-vistas.mjs',
    de: '      if (r && r === h) r = h.nextSibling;',
    a: '      if (false) r = h.nextSibling;',
    cae: 'MOVER un nodo que ya era hijo',
  },
];

/** Un padre con hijos NOMBRADOS: el orden se compara por nombre, y un nombre repetido delata un duplicado. */
function familia(banco, ...nombres) {
  const padre = banco.mk('div');
  const por = {};
  for (const nombre of nombres) {
    const h = banco.mk('span');
    h.dataset.n = nombre;
    padre.appendChild(h);
    por[nombre] = h;
  }
  return { padre, ...por };
}
function suelto(banco, nombre) {
  const h = banco.mk('span');
  h.dataset.n = nombre;
  return h;
}
const orden = (padre) => padre.hijos.map((h) => (h && h.dataset && h.dataset.n) || '?').join(' ');
const cara = (h) => `${h.tagName}${h.className ? `.${h.className}` : ''}`;

// ═══ ① LAS CUATRO FORMAS ═════════════════════════════════════════════════════════════════

test('SCRUM-1486 · 🔴 antes de un nodo INTERMEDIO: justo delante de la referencia', () => {
  const banco = cargarDashboard(RAIZ);
  const f = familia(banco, 'a', 'b', 'c');
  const nuevo = suelto(banco, 'nuevo');
  const devuelto = f.padre.insertBefore(nuevo, f.b);
  assert.equal(orden(f.padre), 'a nuevo b c',
    '🔴 lo insertado no ha quedado justo antes de su referencia: el banco ignora el segundo argumento.');
  assert.equal(devuelto, nuevo, '🔴 `insertBefore` no devuelve el nodo insertado.');
  assert.equal(nuevo.parentNode, f.padre, '🔴 `parentNode` no señala al padre.');
});

test('SCRUM-1486 · 🔴 la referencia es el PRIMER hijo: queda el primero, y por la referencia', () => {
  const banco = cargarDashboard(RAIZ);
  const f = familia(banco, 'a', 'b', 'c');
  // Lo que dice la vista es `x.insertBefore(nuevo, x.firstChild)`. Si `firstChild` no es el primer
  // hijo, el resultado puede coincidir igual —coincidía— y el caso mediría un accidente.
  assert.equal(f.padre.firstChild, f.a,
    '🔴 `firstChild` no es el primer hijo: quien inserte «antes del primero» está pasando otra cosa.');
  f.padre.insertBefore(suelto(banco, 'uno'), f.padre.firstChild);
  assert.equal(orden(f.padre), 'uno a b c');
  f.padre.insertBefore(suelto(banco, 'dos'), f.padre.firstChild);
  assert.equal(orden(f.padre), 'dos uno a b c', '🔴 la segunda inserción no ha ido delante de la primera.');
});

test('SCRUM-1486 · 🔴 referencia NULA: al final, no al principio', () => {
  const banco = cargarDashboard(RAIZ);
  const f = familia(banco, 'a', 'b');
  f.padre.insertBefore(suelto(banco, 'nulo'), null);
  assert.equal(orden(f.padre), 'a b nulo',
    '🔴 con referencia nula el navegador AÑADE AL FINAL; el banco lo ha puesto en otro sitio.');
  // Sin segundo argumento: el banco lo trata igual que `null` (así lo trata el navegador con
  // `undefined`). Es lo que hace `tests/scrum697`, y se fija aquí para que no cambie sin querer.
  f.padre.insertBefore(suelto(banco, 'sin'));
  assert.equal(orden(f.padre), 'a b nulo sin');
});

test('SCRUM-1486 · 🔴 MOVER un nodo que ya era hijo: cambia de sitio y sigue siendo uno', () => {
  const banco = cargarDashboard(RAIZ);
  const f = familia(banco, 'a', 'b', 'c');
  f.padre.insertBefore(f.c, f.a);
  assert.equal(orden(f.padre), 'c a b', '🔴 moverlo hacia delante no lo deja antes de su referencia.');
  f.padre.insertBefore(f.c, f.b);
  assert.equal(orden(f.padre), 'a c b', '🔴 moverlo hacia atrás no lo deja antes de su referencia.');
  // Sobre sí mismo: el estándar toma como referencia a su siguiente hermano, o sea que no se mueve.
  f.padre.insertBefore(f.c, f.c);
  assert.equal(orden(f.padre), 'a c b', '🔴 insertar un nodo antes de sí mismo lo ha cambiado de sitio.');
  // Y desde OTRO padre: llega a su sitio y deja el viejo (SCRUM-697, que no se pierda aquí).
  const otra = familia(banco, 'x', 'y');
  f.padre.insertBefore(otra.x, f.b);
  assert.equal(orden(f.padre), 'a c x b');
  assert.equal(orden(otra.padre), 'y', '🔴 el nodo movido sigue colgando también de su padre viejo.');
  assert.equal(otra.x.parentNode, f.padre);
});

// ═══ ② `firstChild` Y `nextSibling` ══════════════════════════════════════════════════════

test('SCRUM-1486 · 🔴 `firstChild` y `nextSibling` existen, y cuando no hay dan `null`', () => {
  const banco = cargarDashboard(RAIZ);
  const f = familia(banco, 'a', 'b', 'c');
  assert.equal(f.padre.firstChild, f.a);
  assert.equal(f.a.nextSibling, f.b);
  assert.equal(f.b.nextSibling, f.c);
  // `null`, no `undefined`: `insertBefore(x, null)` es «al final» en el navegador, y una vista
  // puede comparar con `=== null`.
  assert.equal(f.c.nextSibling, null, '🔴 el último hijo tiene «siguiente».');
  assert.equal(banco.mk('div').firstChild, null, '🔴 un padre vacío tiene «primer hijo».');
  assert.equal(banco.mk('div').nextSibling, null, '🔴 un nodo sin padre tiene «siguiente».');
  // Siguen al árbol: tras mover, dicen lo de ahora.
  f.padre.insertBefore(f.c, f.a);
  assert.equal(f.padre.firstChild, f.c);
  assert.equal(f.c.nextSibling, f.a);
  assert.equal(f.b.nextSibling, null);
});

// ═══ ③ LA REFERENCIA QUE NO ES HIJA ══════════════════════════════════════════════════════

test('SCRUM-1486 · 🔴 una referencia que NO es hija del padre LANZA, y no mueve nada', () => {
  // El navegador lanza `NotFoundError`. Ponerlo «al final» sería adivinar un sitio que el producto
  // no pidió: el mismo criterio que `_colocarAdyacente` con una posición que no existe.
  const banco = cargarDashboard(RAIZ);
  const f = familia(banco, 'a', 'b');
  const ajena = familia(banco, 'x', 'y');
  assert.throws(() => f.padre.insertBefore(ajena.y, ajena.x), { name: 'NotFoundError' },
    '🔴 una referencia de OTRO padre se ha aceptado: el nodo acabaría en un sitio cualquiera.');
  assert.equal(orden(f.padre), 'a b', '🔴 el padre ha cambiado aunque la inserción no era válida.');
  assert.equal(orden(ajena.padre), 'x y', '🔴 el nodo se ha desenganchado de su sitio ANTES de saber si cabía.');
  assert.equal(ajena.y.parentNode, ajena.padre);
  // Tampoco vale una referencia suelta, ni el propio nodo cuando no es hijo.
  assert.throws(() => f.padre.insertBefore(suelto(banco, 'n'), suelto(banco, 'r')), { name: 'NotFoundError' });
  const solo = suelto(banco, 'solo');
  assert.throws(() => f.padre.insertBefore(solo, solo), { name: 'NotFoundError' });
  assert.equal(orden(f.padre), 'a b');
});

// ═══ ④ UNA VISTA REAL DE CADA PATRÓN ═════════════════════════════════════════════════════

test('SCRUM-1486 · 🔴 nodo real · Ajustes: título, subtítulo y navegación, en ese orden', async () => {
  // `settingsView.js`: `card.insertBefore(title, nav)` y luego `card.insertBefore(subtitle, nav)`.
  // En el navegador: título, subtítulo, navegación. El banco los dejaba subtítulo, título, navegación.
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: datosDeMuestra }), 'renderSettingsView');
  assert.equal(r.error, null, `SUELO: Ajustes no se monta (${r.error}); el caso no ha mirado nada.`);
  const titulo = todos(r.contenedor).find((x) => x.tagName === 'H2' && x.textContent === 'Datos de la empresa');
  assert.ok(titulo, 'SUELO: no encuentro el título de la tarjeta de Ajustes; el caso no ha mirado nada.');
  const hermanos = titulo.parentNode.hijos;
  const i = hermanos.indexOf(titulo);
  assert.deepEqual(hermanos.slice(i, i + 3).map(cara), ['H2', 'P', 'DIV.settings-nav'],
    `🔴 la tarjeta de Ajustes no queda como en el navegador. Sus hijos: ${hermanos.map(cara).join(' | ')}`);
  assert.equal(i, 0, '🔴 el título no es el primer hijo de la tarjeta.');
});

test('SCRUM-1486 · 🔴 `X.firstChild` · la puerta de serie se pone la PRIMERA de su panel', () => {
  // `puertaSerie.js`: `panel.insertBefore(caja, panel.firstChild)`, sobre un panel que YA tiene contenido.
  const banco = cargarDashboard(RAIZ);
  const panel = banco.mk('div');
  const ya = banco.mk('p');
  const mas = banco.mk('form');
  panel.append(ya, mas);
  // La referencia que la vista va a leer tiene que existir, o el orden sale bien por accidente.
  assert.equal(panel.firstChild, ya, '🔴 `firstChild` no es el primer hijo del panel: la vista pasaría otra referencia.');
  const caja = banco.ctx.renderPuertaSerie(panel, { veredicto: true, anio: 2026 });
  assert.ok(caja, 'SUELO: la puerta no se ha pintado; el caso no ha mirado nada.');
  assert.deepEqual(panel.hijos.map(cara), ['DIV.field', 'P', 'FORM'],
    '🔴 la puerta de serie no ha quedado la primera de su panel.');
  assert.equal(panel.firstChild, caja);
});

test('SCRUM-1486 · 🔴 `Y.nextSibling` · el aviso en rojo va JUSTO DETRÁS de su botón', () => {
  // `semaforoFiscal.js`: `boton.parentNode.insertBefore(caja, boton.nextSibling)`.
  const banco = cargarDashboard(RAIZ);
  const aviso = { titulo: 'No se puede', porque: 'Porque no', opciones: [] };
  // Con algo detrás del botón: el aviso entra entre los dos.
  const padre = banco.mk('div');
  const antes = banco.mk('span');
  const boton = banco.mk('button');
  const despues = banco.mk('p');
  padre.append(antes, boton, despues);
  const caja = banco.ctx.renderRojo(null, aviso, boton);
  assert.ok(caja, 'SUELO: el aviso no se ha pintado; el caso no ha mirado nada.');
  assert.deepEqual(padre.hijos.map(cara), ['SPAN', 'BUTTON.role-locked', 'DIV.semaforo-rojo', 'P'],
    '🔴 el aviso no ha quedado justo detrás de su botón.');
  // Con el botón el último: `nextSibling` es `null` y el aviso va al final, no al principio.
  const padre2 = banco.mk('div');
  const boton2 = banco.mk('button');
  padre2.append(banco.mk('span'), boton2);
  banco.ctx.renderRojo(null, aviso, boton2);
  assert.deepEqual(padre2.hijos.map(cara), ['SPAN', 'BUTTON.role-locked', 'DIV.semaforo-rojo'],
    '🔴 con el botón el último, el aviso no ha quedado detrás de él.');
});
