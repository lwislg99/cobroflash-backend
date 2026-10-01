// tests/scrum1275-la-fila-abre-la-factura.test.mjs — SCRUM-1275
//
// EN LA LISTA DE FACTURAS, PULSAR UNA FILA ABRE LA FACTURA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE CIERRA
//
// SCRUM-845 (b7adfd68, 9-sep-2026) metió la casilla dentro de
// `if (window.sePuedeMarcarPagadaEnLote(inv)) { const cb = … }`, y el manejador de la fila, FUERA
// de ese bloque, seguía haciendo `if (e.target === cb) return;`. `const` tiene ámbito de bloque:
// fuera del `if`, `cb` no existe. El manejador lanzaba `ReferenceError: cb is not defined` ANTES
// de llamar a `renderAppView`, así que ninguna fila —con casilla o sin ella— abría su factura, y
// la fila no tiene otro control para abrirla. Veinte días en producción.
//
// Ningún test lo vio porque ninguno PULSABA una fila: los de SCRUM-845 leían el texto del fichero.
//
// ── QUÉ SE PRUEBA, Y POR QUÉ SON TRES CASOS Y NO UNO ────────────────────────────────────────────
//
//   ① fila CON casilla: pulsar la fila navega a SU factura.
//   ② fila CON casilla: pulsar LA CASILLA no navega. Es el caso que vigila el arreglo: con
//      `let cb = null` fuera del `if`, `e.target === cb` deja de reventar, pero tiene que SEGUIR
//      evitando la navegación. Un arreglo que se cargue la comparación pasaría ① y ③ igual.
//   ③ fila SIN casilla: pulsar la fila navega a SU factura.
//
// El clic se entrega al oyente de la FILA con `target` = el nodo pulsado, que es lo que hace el
// navegador al burbujear: el banco (`_banco-vistas.mjs`) dispara con `target` = el propio nodo, y
// eso no distingue «pulsé la casilla» de «pulsé la fila».
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Una que el lote ADMITE (pendiente → casilla) y una que RECHAZA (pagada → sin casilla).
const CON_CASILLA = { id: 101, number: 'F-2026-0101', status: 'pending', total: 121, currency: 'EUR', createdAt: '2026-09-20T10:00:00Z', customer: { name: 'Cliente A' } };
const SIN_CASILLA = { id: 202, number: 'F-2026-0202', status: 'paid', total: 242, currency: 'EUR', createdAt: '2026-09-21T10:00:00Z', customer: { name: 'Cliente B' } };

async function montar() {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/invoices(\?|$)/.test(url) ? [CON_CASILLA, SIN_CASILLA] : []),
  });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: el dashboard no carga entero en el banco.');
  const navegaciones = [];
  // JSON: `params` nace en el realm de `vm` y `deepStrictEqual` compara prototipos.
  banco.ctx.renderAppView = (vista, params) => { navegaciones.push(JSON.parse(JSON.stringify({ vista, params }))); };
  const r = await pintarVista(banco, 'renderInvoicesView');
  assert.equal(r.error, null, `🔴 CIEGO: la vista revienta al montarse: ${r.error}`);
  return { r, navegaciones };
}

/** La fila de datos cuya celda de número es `numero`. */
function filaDe(contenedor, numero) {
  const tr = todos(contenedor).find((n) => n.tagName === 'TR'
    && n.hijos.some((td) => td && td.className === 'cell-id' && td.textContent === numero));
  assert.ok(tr, `🔴 CIEGO: no encuentro la fila de ${numero}; sin ella este test no mide nada.`);
  return tr;
}

/** Pulsa `objetivo` dentro de `tr`: el clic burbujea al oyente de la fila con ese `target`. */
function pulsar(tr, objetivo) {
  const oyentes = tr._oyentes.click || [];
  assert.ok(oyentes.length > 0, '🔴 CIEGO: la fila no tiene oyente de clic.');
  const errores = [];
  for (const f of oyentes) {
    try { f.call(tr, { type: 'click', target: objetivo, currentTarget: tr, preventDefault() {}, stopPropagation() {} }); }
    catch (e) { errores.push(`${e.name}: ${e.message}`); }
  }
  return errores;
}

const casillaDe = (tr) => todos(tr).find((n) => n.tagName === 'INPUT' && n.className === 'inv-row-check') || null;

test('SCRUM-1275 · SUELO: la fila pendiente lleva casilla y la pagada no', async () => {
  // Si esto cambiara, los casos de abajo dejarían de cubrir las DOS clases de fila sin avisar.
  const { r } = await montar();
  assert.ok(casillaDe(filaDe(r.contenedor, CON_CASILLA.number)), '🔴 la pendiente ha perdido la casilla.');
  assert.equal(casillaDe(filaDe(r.contenedor, SIN_CASILLA.number)), null, '🔴 la pagada tiene casilla.');
});

test('SCRUM-1275 · ① fila CON casilla: pulsar la fila abre SU factura', async () => {
  const { r, navegaciones } = await montar();
  const tr = filaDe(r.contenedor, CON_CASILLA.number);
  const celda = tr.hijos.find((td) => td.className === 'cell-client');
  const errores = pulsar(tr, celda);
  assert.deepEqual(errores, [], '🔴 el manejador de la fila revienta al pulsarla.');
  assert.deepEqual(navegaciones, [{ vista: 'invoice-detail', params: { invoiceId: CON_CASILLA.id } }]);
});

test('SCRUM-1275 · ② fila CON casilla: pulsar LA CASILLA no abre la factura', async () => {
  const { r, navegaciones } = await montar();
  const tr = filaDe(r.contenedor, CON_CASILLA.number);
  const errores = pulsar(tr, casillaDe(tr));
  assert.deepEqual(errores, [], '🔴 el manejador de la fila revienta al pulsar la casilla.');
  assert.deepEqual(navegaciones, [],
    '🔴 pulsar la casilla navega: marcar una factura para el lote te saca de la lista.');
});

test('SCRUM-1275 · ③ fila SIN casilla: pulsar la fila abre SU factura', async () => {
  const { r, navegaciones } = await montar();
  const tr = filaDe(r.contenedor, SIN_CASILLA.number);
  const celda = tr.hijos.find((td) => td.className === 'cell-client');
  const errores = pulsar(tr, celda);
  assert.deepEqual(errores, [], '🔴 el manejador de la fila revienta al pulsarla.');
  assert.deepEqual(navegaciones, [{ vista: 'invoice-detail', params: { invoiceId: SIN_CASILLA.id } }]);
});
