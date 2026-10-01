// SCRUM-1278 — EL BANCO DICE CUÁNDO UNA VISTA ACABÓ EN SU PANTALLA DE ERROR, Y EL CLIC SUBE.
//
// Medido el 29-sep-2026: a `_banco-vistas.mjs` le faltaba `new Option`, `expensesView.js` reventaba
// dentro de su `try`, el `catch` se tragaba el TypeError SIN `console.error` y la vista pintaba «No se
// han podido cargar los gastos». `pintarVista` devolvía `error: null` y consola vacía: cualquier
// censo contaba los controles DEL CARTEL como si fueran la pantalla.
//
// Añadir `Option` cura Gastos hoy; mañana faltará otra API. Lo que se prueba aquí es lo estructural:
//   ① CONTROL POSITIVO — se QUITA `Option` del banco a propósito y Gastos TIENE que salir con
//      `noMedida` (nombrando el TypeError y su sitio). Si no saliera, el banco no sabe detectar.
//   ② Con `Option`, la misma vista sale con `noMedida: null` y pinta su lista, no el cartel.
//   ③ El clic SUBE como en el navegador (`target` = lo pulsado, `currentTarget` = quien escucha,
//      `stopPropagation` corta, `focus` no sube) y `disparar` sigue devolviendo solo los oyentes
//      PROPIOS (lo usan `scrum660` y `scrum915d` como «este botón tiene oyente»).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, datosDeMuestra, nodo } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARTEL = 'No se han podido cargar los gastos';
const texto = (n) => todos(n).map((x) => x.textContent || '').join(' ');

test('SCRUM-1278 ① control positivo: SIN `Option`, Gastos sale con `noMedida` y nombra el TypeError', async () => {
  const banco = cargarDashboard(RAIZ, { datos: datosDeMuestra });
  delete banco.ctx.Option;
  const r = await pintarVista(banco, 'renderExpensesView');
  assert.equal(r.error, null, 'la vista se traga el error: por eso hace falta `noMedida`');
  assert.ok(r.noMedida, `el banco NO detectó que Gastos acabó en su camino de error (atrapados: ${JSON.stringify(r.atrapados)})`);
  assert.match(r.noMedida, /renderExpensesView acabó en su camino de error: (TypeError|ReferenceError)/);
  assert.match(r.noMedida, /Option/, 'el motivo tiene que nombrar lo que faltó');
});

test('SCRUM-1278 ② con `Option`, Gastos se mide: `noMedida` es null y no pinta el cartel de error', async () => {
  const banco = cargarDashboard(RAIZ, { datos: datosDeMuestra });
  const r = await pintarVista(banco, 'renderExpensesView');
  assert.equal(r.error, null);
  assert.equal(r.noMedida, null, r.noMedida);
  assert.ok(!texto(r.contenedor).includes(CARTEL), 'Gastos pintó el cartel de error');
  assert.ok(r.nodos > 20, `Gastos pintó solo ${r.nodos} nodos`);
});

test('SCRUM-1278 ③ el clic sube: target = lo pulsado, currentTarget = quien escucha, stopPropagation corta', () => {
  const banco = cargarDashboard(RAIZ);
  const fila = banco.mk('tr');
  const celda = banco.mk('td');
  const casilla = banco.mk('input');
  fila.appendChild(celda);
  celda.appendChild(casilla);
  const vistos = [];
  fila.addEventListener('click', (e) => vistos.push([e.target === celda ? 'celda' : e.target === casilla ? 'casilla' : 'otro', e.currentTarget === fila]));
  casilla.addEventListener('click', (e) => e.stopPropagation());
  fila.addEventListener('focus', () => vistos.push(['focus-subio', true]));

  assert.equal(celda.disparar('click'), 0, '`disparar` devuelve los oyentes PROPIOS: la celda no tiene');
  assert.deepEqual(vistos, [['celda', true]], 'el clic en la celda tiene que llegar a la fila con target = la celda');

  assert.equal(casilla.disparar('click'), 1);
  assert.deepEqual(vistos, [['celda', true]], 'stopPropagation en la casilla tiene que cortar la subida');

  celda.disparar('focus');
  assert.deepEqual(vistos, [['celda', true]], '`focus` no sube en el navegador');
});

// SCRUM-1285 (para S4) · un `<textarea>` nacido del marcado tenía `.value` VACÍO: toda vista con uno
// se medía como si la persona no hubiera escrito nada, sin un rojo.
test('SCRUM-1278 ④ un <textarea> del marcado da su contenido en .value, como el navegador; el vacío da vacío; una entidad desconocida revienta', () => {
  const c = nodo('div');
  c.innerHTML = '<textarea name="descripcion">\nCambio de grifo &amp; revisión  </textarea><textarea name="notas"></textarea>';
  const [lleno, vacio] = todos(c).filter((n) => n.tagName === 'TEXTAREA');
  assert.equal(lleno.value, 'Cambio de grifo & revisión  ', 'contenido con entidad resuelta, sin recortar y sin el primer salto de línea');
  assert.equal(vacio.value, '', 'un <textarea> vacío tiene que dar vacío');
  // Y lo que viene detrás del textarea no se lo come: sigue siendo un hermano.
  assert.equal(todos(c).filter((n) => n.tagName === 'TEXTAREA').length, 2);

  const d = nodo('div');
  assert.throws(() => { d.innerHTML = '<textarea>precio &euro;</textarea>'; }, /no sabe resolver/, 'una entidad desconocida no puede pasar como texto literal');
});
