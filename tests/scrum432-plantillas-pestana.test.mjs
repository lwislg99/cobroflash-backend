// tests/scrum432-plantillas-pestana.test.mjs — SCRUM-432 (B1 · incremento 3)
//
// `Plantillas` deja de ser entrada de menú y pasa a pestaña dentro de Presupuestos. Entre construir
// la pestaña y retirar la entrada hay un estado en el que la vista `templates` **no es alcanzable
// desde ningún sitio**, y ese estado no puede llegar a `main`. Este fichero es lo que lo impide.
//
// ⚠️ Y NO SE COMPRUEBA LEYENDO EL FUENTE. `tests/_banco-vistas.mjs` (SCRUM-417) carga las vistas
// como el navegador, así que la pestaña se mide **en el árbol que la pantalla pinta de verdad**.
// Las dos vistas implicadas pintan en el banco — medido antes de escribir esto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { entradasDeLaBarra, vistasDelRouter, VISTAS_SIN_ENTRADA } from './_barra-lateral.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Los botones de la tira de pestañas del árbol pintado. */
const pestanasDe = (contenedor) => todos(contenedor)
  .filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.pestana)
  .map((n) => ({ vista: n.dataset.pestana, rotulo: n.textContent, className: n.className }));

// ═══ SUELO ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-432 · SUELO: el escáner encuentra las pestañas', async () => {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const r = await pintarVista(banco, 'renderQuotesListView');
  assert.equal(r.error, null, `🔴 el historial ni siquiera pinta: ${r.error && r.error.message}`);
  const p = pestanasDe(r.contenedor);
  assert.ok(p.length >= 2,
    `🔴 ESCÁNER CIEGO: solo veo ${p.length} pestañas en la pantalla de Presupuestos (esperaba ≥2). ` +
    '«No hay pestañas» y «no supe encontrarlas» son el mismo número con significados opuestos: si ' +
    'el detector se rompió, arréglalo antes de creerte nada de abajo.');
});

// ═══ ① EL POSITIVO: `templates` sigue alcanzable DESPUÉS de salir de la barra ═════════════

test('SCRUM-432 · ① `Plantillas` NO está en la barra y SÍ es alcanzable desde la pestaña', async () => {
  const barra = entradasDeLaBarra(path.join(RAIZ, 'public/dashboard/index.html'));
  assert.ok(!barra.entradas.some((e) => e.vista === 'templates'),
    '🔴 `Plantillas` sigue en la barra: el movimiento de B1 no está hecho.');

  const banco = cargarDashboard(RAIZ, { datos: {} });
  const r = await pintarVista(banco, 'renderQuotesListView');
  const p = pestanasDe(r.contenedor);
  assert.ok(p.some((x) => x.vista === 'templates'),
    '🔴 `Plantillas` NO está en la barra y TAMPOCO en la pestaña: la vista se ha quedado sin ' +
    'ningún camino. Un profesional que guarde plantillas ya no puede volver a ellas.\n   ' +
    `pestañas pintadas: ${p.map((x) => x.rotulo).join(' · ') || '(ninguna)'}`);
  assert.ok(vistasDelRouter(path.join(RAIZ, 'public/dashboard/js/app.js')).has('templates'),
    '🔴 la pestaña apunta a `templates` y el router ya no la conoce: una promesa rota.');
});

test('SCRUM-432 · ① la pestaña se pinta en LAS DOS vistas, no solo en el historial', async () => {
  // Sin la tira en Plantillas, entrar sería un callejón: se llega y no se puede volver.
  const b1 = cargarDashboard(RAIZ, { datos: {} });
  const historial = await pintarVista(b1, 'renderQuotesListView');
  const b2 = cargarDashboard(RAIZ, { datos: [] }); // la lista de plantillas
  const plantillas = await pintarVista(b2, 'renderTemplatesView');

  assert.equal(plantillas.error, null,
    `🔴 la pantalla de Plantillas revienta al abrirse: ${plantillas.error && plantillas.error.message}`);

  for (const [nombre, r] of [['Historial', historial], ['Plantillas', plantillas]]) {
    const p = pestanasDe(r.contenedor);
    assert.deepEqual(p.map((x) => x.vista), ['quotes-list', 'templates'],
      `🔴 en «${nombre}» la tira no tiene las dos pestañas en el orden del diseño.`);
  }
});

test('SCRUM-432 · ① la pestaña ACTIVA es la de la pantalla que estás mirando', async () => {
  // Si las dos se pintaran igual, la tira diría dónde puedes ir pero no dónde estás.
  const b1 = cargarDashboard(RAIZ, { datos: {} });
  const historial = pestanasDe((await pintarVista(b1, 'renderQuotesListView')).contenedor);
  const b2 = cargarDashboard(RAIZ, { datos: [] });
  const plantillas = pestanasDe((await pintarVista(b2, 'renderTemplatesView')).contenedor);

  const activa = (lista) => lista.filter((x) => x.className.includes('btn-secondary')).map((x) => x.vista);
  assert.deepEqual(activa(historial), ['quotes-list'],
    '🔴 en el Historial la pestaña marcada no es «Historial».');
  assert.deepEqual(activa(plantillas), ['templates'],
    '🔴 en Plantillas la pestaña marcada no es «Plantillas».');
});

// ═══ ② MICROCOPY (regla 30) ══════════════════════════════════════════════════════════════

test('SCRUM-432 · ② los rótulos son los del diseño, y no hay marcadores', async () => {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const p = pestanasDe((await pintarVista(banco, 'renderQuotesListView')).contenedor);
  assert.deepEqual(p.map((x) => x.rotulo), ['Historial', 'Plantillas'],
    '🔴 los dos rótulos salen LITERALES del diseño §B1 («Historial · Plantillas») y están ' +
    'aprobados por eso. Cambiarlos es microcopy nueva y la aprueba el fundador (regla 30).');
  const conMarcador = p.filter((x) => x.rotulo.includes('[PENDIENTE'));
  assert.deepEqual(conMarcador, [], '🔴 queda microcopy sin aprobar en la tira de pestañas.');
});

// ═══ ③ LO QUE YA FUNCIONABA SIGUE FUNCIONANDO ════════════════════════════════════════════

test('SCRUM-432 · ③ el historial de presupuestos NO se ha tocado', async () => {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  const r = await pintarVista(banco, 'renderQuotesListView');
  assert.equal(r.error, null, '🔴 el historial revienta al abrirse.');
  assert.deepEqual(r.idsNoResueltos, [],
    '🔴 el historial busca ids que su marcado ya no declara: la tira lo ha descolocado.');
  // Sus anclajes de siempre siguen ahí: el contador y la tabla.
  assert.ok(banco.reg.porId.has('quotes-count') || todos(r.contenedor).some((n) => n.id === 'quotes-count'),
    '🔴 el contador del historial (`#quotes-count`) ha desaparecido.');
  // Y la tira va ANTES de la tarjeta: es de Presupuestos, no del historial.
  const orden = todos(r.contenedor).filter((n) => n.className === 'quotes-tabs' || n.className === 'data-card');
  assert.deepEqual(orden.map((n) => n.className), ['quotes-tabs', 'data-card'],
    '🔴 la tira tiene que ir ANTES de la tarjeta del historial.');
});

test('SCRUM-432 · ③ el enlace directo `#templates` sigue siendo válido', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const m = app.match(/const HASH_VIEWS = \[([^\]]*)\]/s);
  assert.ok(m, '🔴 no encuentro `HASH_VIEWS`: el escáner del enlace directo se ha roto.');
  assert.match(m[1], /'templates'/,
    '🔴 `#templates` ha salido de `HASH_VIEWS`: un marcador que el profesional tuviera guardado ' +
    'dejaría de abrir Plantillas. Sacarla de la barra no puede romper los enlaces que ya existen.');
  assert.match(app, /view === 'templates' \? 'quotes-list'/,
    '🔴 estando en Plantillas la barra no marca ninguna sección: el profesional no sabe dónde está.');
});

// ═══ ④ LA DECLARACIÓN, con su ticket ═════════════════════════════════════════════════════

test('SCRUM-432 · ④ `templates` está declarada como vista sin entrada, citando su ticket', () => {
  assert.equal(VISTAS_SIN_ENTRADA.templates.ticket, 'SCRUM-432',
    '🔴 una vista sin entrada de barra y sin ticket deja de ser una decisión y pasa a ser un olvido.');
  assert.ok(VISTAS_SIN_ENTRADA.templates.motivo.length > 60,
    '🔴 la declaración no dice por dónde se llega ahora.');
});
