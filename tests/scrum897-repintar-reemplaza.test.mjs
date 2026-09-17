// SCRUM-897 · EN EL BANCO DE VISTAS, `innerHTML = …` REEMPLAZA. No añade.
//
// Sin gate: el mini-DOM de `_banco-vistas.mjs` y la vista real de presupuestos. Ni BD, ni red.
//
// EL DEFECTO, medido el 17-sep-2026 sobre 018d1807 con DOS sondas independientes: el banco y Edge
// pintando la misma vista, con los mismos scripts en el mismo orden y la misma red (`{}` a todo).
//
//   renderQuotesView   banco 261 nodos (251 elementos + 10 #text) · Edge 227 elementos
//                      sobran DIV 6 · SPAN 9 · STRONG 9 = 24, todos de dos contenedores que la vista
//                      REPINTA: `.quote-totals` (24 hijos, su último marcado declara 6: cuatro
//                      pintadas apiladas) y `.quote-block` (8 hijos frente a 2).
//   renderProductsView · renderCustomersView: banco = Edge.
//
// El setter hacía `n.hijos.push(...)` sin vaciar antes. En el navegador, asignar `innerHTML`
// QUITA los hijos que había: dejan de estar en el documento (`getElementById` ya no los encuentra)
// y pierden su padre. Lo que costaba no era un número: un test del tipo «tras X, ya no aparece» se
// medía sobre un árbol que todavía guardaba lo de antes, y uno del tipo «aparece» podía salir verde
// encontrando la pintada VIEJA.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SCRUM-897 · tras repintar con innerHTML, lo viejo ya no está', () => {
  const banco = cargarDashboard(RAIZ);
  const doc = banco.ctx.document;
  const c = banco.mk('div');

  c.innerHTML = '<p id="viejo-897" class="pintada-vieja">antes</p><span>resto</span>';
  const viejo = doc.getElementById('viejo-897');
  // SUELO: si la primera pintada no llegara a existir, todo lo de abajo saldría verde sin mirar.
  assert.ok(viejo && c.children.length === 2,
    '🔴 el banco no llegó a pintar la primera vez: no se puede juzgar el repintado (SUELO)');

  c.innerHTML = '<p id="nuevo-897">después</p>';

  assert.equal(c.children.length, 1,
    `🔴 tras repintar, el contenedor tiene ${c.children.length} hijos y su marcado declara 1: `
    + 'el banco ha APILADO la pintada nueva sobre la vieja, y el navegador no hace eso.');
  assert.equal(c.querySelector('.pintada-vieja'), null,
    '🔴 la pintada vieja se sigue encontrando dentro del contenedor');
  assert.equal(doc.getElementById('viejo-897'), null,
    '🔴 `getElementById` sigue encontrando un nodo que el repintado quitó del documento');
  assert.equal(viejo.parentNode, null,
    '🔴 el nodo quitado sigue creyendo que tiene padre');
  // Control positivo: lo nuevo SÍ está. Sin esto, un banco que vaciara y no pintara pasaría arriba.
  assert.equal(doc.getElementById('nuevo-897')?.textContent, 'después',
    '🔴 la pintada nueva no está: el banco vacía pero no pinta');
});

test('SCRUM-897 · repintar también quita lo que se colgó a mano, y sus id', () => {
  const banco = cargarDashboard(RAIZ);
  const doc = banco.ctx.document;
  const c = banco.mk('div');
  c.innerHTML = '<div class="caja">x</div>';
  const colgado = banco.mk('button');
  colgado.id = 'colgado-897';
  c.querySelector('.caja').appendChild(colgado);
  assert.equal(doc.getElementById('colgado-897'), colgado, 'SUELO: el nodo colgado a mano se encuentra antes de repintar');

  c.innerHTML = '';
  assert.equal(c.children.length, 0, '🔴 `innerHTML = ""` no ha vaciado');
  assert.equal(doc.getElementById('colgado-897'), null,
    '🔴 un id de un nieto sigue registrado después de vaciar a su abuelo');

  // Un id que la pintada nueva vuelve a declarar resuelve al nodo NUEVO, no al quitado.
  c.innerHTML = '<i id="colgado-897"></i>';
  assert.equal(doc.getElementById('colgado-897')?.tagName, 'I', '🔴 el id redeclarado resuelve al nodo viejo');
});

test('SCRUM-897 · la vista de presupuestos: cada contenedor repintado tiene solo su última pintada', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ), 'renderQuotesView');
  // SUELO: si la vista no monta, esto es «no pude mirar», nunca un cero que parezca un cumplimiento.
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: renderQuotesView no monta (${r.error})`);
  const nodos = todos(r.contenedor);
  const conClase = (c) => nodos.filter((n) => String(n.className).split(/\s+/).includes(c));
  // Por clase EXACTA: `.quote-block` a secas son siete bloques y el primero no se repinta.
  const totales = conClase('quote-totals');
  const kpi = conClase('quote-total-kpi');
  assert.ok(totales.length && kpi.length && totales[0]._html && kpi[0]._html,
    '🔴 NO PUDE MIRAR: la vista ya no pinta `.quote-totals`/`.quote-total-kpi` por innerHTML; '
    + 'este test tiene que buscarse otro repintado real, no darse por bueno');
  assert.equal(totales.length, 1, `🔴 hay ${totales.length} \`.quote-totals\` y Edge pinta 1`);

  const etiquetas = (html) => (String(html).match(/<[a-zA-Z][\w-]*/g) || []).length;
  for (const [nombre, n] of [['.quote-totals', totales[0]], ['.quote-total-kpi', kpi[0]]]) {
    assert.equal(n.hijos.length, etiquetas(n._html),
      `🔴 ${nombre} tiene ${n.hijos.length} hijos y su último marcado declara ${etiquetas(n._html)}: `
      + 'el banco guarda pintadas que el navegador ya quitó (Edge: 227 elementos en esta vista).');
  }
});
