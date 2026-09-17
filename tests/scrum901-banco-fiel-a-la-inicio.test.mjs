// SCRUM-901 · EL BANCO DE VISTAS, FIEL A LA INICIO — y dos infidelidades más.
//
// Sin gate: el mini-DOM de `_banco-vistas.mjs` y la vista real de la Inicio. Ni BD, ni red.
//
// EL DEFECTO, medido el 17-sep-2026 sobre 8c354ff3 con DOS sondas (el banco y Edge pintando la
// misma vista con los mismos scripts y `{}` a todo, comparadas FIRMA A FIRMA): la Inicio daba 109
// elementos en el banco y 143 en Edge. Los −34 son tres causas, y cuadran exactas:
//
//   A · el contenedor de `pintarVista` NO ESTABA EN EL DOCUMENTO. `document.querySelector` sólo
//       recorre `document.body`, así que `renderSetupChecklist` no encontraba `.kpi-grid` y la
//       lista «Completa tu configuración» (9 «Ir →») no se pintaba: −51.
//   B · el parser era PLANO: toda etiqueta de un `innerHTML` quedaba como hija directa. Los
//       esqueletos que el marcado pone DENTRO de `#kpi-grid` y `#activity-feed` eran hermanos, y
//       repintar esos contenedores no los quitaba: +16. Y un selector con descendencia
//       (`.kpi-grid .kpi-card`) no casaba nunca.
//   C · el banco no tiene IndexedDB y la Inicio pinta «No hemos podido comprobar si te queda algo
//       por subir», que Edge no pinta: +1. NO se toca aquí (inyectar IndexedDB por defecto movería
//       lo que miden otros tests); queda declarado.
//
// Y dos que venían de SCRUM-897: al parsear, `value`/`checked` del marcado no llegaban a la
// propiedad (el falso verde de scrum889 fue de esta familia), y `textContent` vaciaba sin sacar a
// los hijos del documento.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);

test('SCRUM-901 · al parsear, `value` y `checked` del marcado llegan a la propiedad', () => {
  const banco = cargarDashboard(RAIZ);
  const c = banco.mk('div');
  c.innerHTML = '<input class="con" value="Cambio de diferencial"><input class="sin"><input type="checkbox" class="marcada" checked>';
  const [con, sin, marcada] = ['.con', '.sin', '.marcada'].map((s) => c.querySelector(s));
  assert.ok(con && sin && marcada, '🔴 NO PUDE MIRAR: el banco no pintó los tres campos (SUELO)');

  assert.equal(con.value, 'Cambio de diferencial',
    '🔴 un <input value="…"> recién parseado tiene `.value` vacío: un test que lea lo pintado ve un campo en blanco');
  assert.equal(marcada.checked, true, '🔴 un <input checked> recién parseado sale sin marcar');
  // Control: sin atributo, vacío y sin marcar, como en el navegador.
  assert.equal(sin.value, '');
  assert.equal(con.checked, false);
  // Y después de escribir, manda la propiedad, no el atributo (por esto REFLEJADOS no incluye `value`).
  con.value = 'otra cosa';
  assert.equal(con.getAttribute('value'), 'Cambio de diferencial', 'escribir no toca el atributo');
});

test('SCRUM-901 · asignar textContent saca a los hijos del documento', () => {
  const banco = cargarDashboard(RAIZ);
  const doc = banco.ctx.document;
  const c = banco.mk('div');
  c.innerHTML = '<p id="hijo-901">antes</p>';
  const hijo = doc.getElementById('hijo-901');
  assert.ok(hijo, 'SUELO: el hijo existe antes');

  c.textContent = 'solo texto';
  assert.equal(c.children.length, 0, '🔴 textContent no ha vaciado');
  assert.equal(doc.getElementById('hijo-901'), null, '🔴 `getElementById` sigue encontrando un hijo que textContent quitó');
  assert.equal(hijo.parentNode, null, '🔴 el hijo quitado por textContent sigue creyendo que tiene padre');
});

test('SCRUM-901 · el marcado ANIDA: lo de dentro es hijo, y repintar el de dentro lo quita', () => {
  const banco = cargarDashboard(RAIZ);
  const doc = banco.ctx.document;
  const c = banco.mk('div');
  c.innerHTML = '<div id="grid-901" class="grid"><span class="esq">…</span><input class="vacio"><span class="esq">…</span></div><p>fuera</p>';
  const grid = doc.getElementById('grid-901');
  assert.ok(grid, 'SUELO: el contenedor interno existe');

  assert.equal(c.children.length, 2, `🔴 el contenedor tiene ${c.children.length} hijos directos y el marcado declara 2: el parser es plano`);
  assert.equal(grid.children.length, 3, '🔴 lo que el marcado pone dentro de #grid-901 no es hijo suyo');
  assert.equal(c.querySelector('.esq').parentNode, grid, '🔴 el padre del esqueleto no es su contenedor del marcado');
  assert.equal(c.querySelectorAll('.grid .esq').length, 2, '🔴 un selector con descendencia no casa');
  // Un elemento vacío (void) no se traga lo que viene detrás.
  assert.equal(c.querySelectorAll('.esq')[1].parentNode, grid, '🔴 <input> se ha comido a su hermano');

  grid.innerHTML = '<b>cargado</b>';
  assert.equal(c.querySelectorAll('.esq').length, 0,
    '🔴 repintar el contenedor interno no quita los esqueletos que llevaba dentro');
  assert.equal(todos(c).length, 4, 'el árbol queda: contenedor, #grid-901, <b> y <p>');
});

test('SCRUM-901 · la vista se monta DENTRO del documento: `document.querySelector` la ve', async () => {
  const banco = cargarDashboard(RAIZ);
  vm.runInContext(`window.vistaDePrueba901 = function (c) {
    c.innerHTML = '<div class="marca-901"></div>';
    c.setAttribute('data-desde-document', String(document.querySelectorAll('.marca-901').length));
  };`, banco.ctx);

  const r1 = await pintarVista(banco, 'vistaDePrueba901');
  assert.equal(r1.error, null, `NO PUDE MIRAR: la vista de prueba no monta (${r1.error})`);
  assert.equal(r1.contenedor.getAttribute('data-desde-document'), '1',
    '🔴 `document.querySelector` no encuentra lo que la vista acaba de pintar: el contenedor no está en el documento');

  // Como el panel, que pinta cada vista en el MISMO hueco: la anterior deja de estar.
  const r2 = await pintarVista(banco, 'vistaDePrueba901');
  assert.equal(r2.contenedor.getAttribute('data-desde-document'), '1',
    '🔴 la vista montada antes sigue en el documento: `document.querySelector` encuentra las dos');
});

test('SCRUM-901 · la Inicio del banco es la de Edge: sin esqueletos y con la lista de configuración', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ), 'renderHomeView');
  // SUELO: si la Inicio no monta, esto es «no pude mirar», nunca un cero.
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: renderHomeView no monta (${r.error})`);
  const nodos = todos(r.contenedor);
  assert.ok(nodos.length > 50, `🔴 NO PUDE MIRAR: la Inicio sólo produce ${nodos.length} nodos`);
  assert.ok(nodos.some((n) => n._id === 'kpi-grid'), '🔴 NO PUDE MIRAR: la Inicio ya no tiene #kpi-grid');

  // Edge, con los mismos scripts y datos (17-sep-2026): 0 esqueletos y 9 «Ir →» de la lista.
  const esqueletos = nodos.filter((n) => clases(n).includes('skeleton'));
  assert.equal(esqueletos.length, 0,
    `🔴 quedan ${esqueletos.length} esqueletos de carga que Edge ya ha sustituido: el banco mide la Inicio a medio cargar`);
  // `#btn-home-prefs` («⚙ Personalizar») lleva las mismas clases y no es de la lista.
  const irA = nodos.filter((n) => n.tagName === 'BUTTON' && n._id !== 'btn-home-prefs'
    && clases(n).includes('btn-ghost') && clases(n).includes('btn-sm'));
  assert.equal(irA.length, 9,
    `🔴 la Inicio tiene ${irA.length} botones «Ir →» y Edge pinta 9: la lista «Completa tu configuración» no está`);
});
