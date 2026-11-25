// tests/scrum1782b-rotulo-factura-como.test.mjs — SCRUM-1782b
//
// EL RÓTULO DEL CAMPO `tipoDestinatario` EN LAS DOS FICHAS DE CLIENTE (carril J2).
//
// Decisión y firma del fundador (regla 39): SCRUM-1782 c.22268 — opción B, el campo se QUEDA y su
// rótulo pasa a ser `¿Factura como empresa o autónomo (IVA)?` en las dos fichas; las opciones del
// selector NO cambian. c.22272 («1-Sí»): el mismo literal en el aviso de la bandeja
// (`public/dashboard/js/tipoDestinatarioPendiente.js`, carril S2 de Luis): ese tercer sitio NO lo
// toca este test ni este PR; lo ata `tests/scrum615-pedir-tipo-destinatario.test.mjs`.
//
// Se mide POR EFECTO: las dos fichas se montan en el banco de vistas (`_banco-vistas.mjs`), se
// abre cada formulario como lo abre la persona, y se lee el <label> que acompaña al <select> del
// campo. Leer el fuente no basta: un rótulo puede estar escrito y no pintarse junto al campo.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** El literal firmado, copiado de SCRUM-1782 c.22268 (no de la ficha del orquestador). */
const ROTULO = '¿Factura como empresa o autónomo (IVA)?';
/** Las opciones que c.22268 dice que NO cambian: valor guardado → texto. */
const OPCIONES = [['', 'Sin clasificar'], ['PARTICULAR', 'Particular'], ['EMPRESARIO', 'Empresa / profesional']];

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/customersView.js',
    de: '    tipoLabel.textContent = "¿Factura como empresa o autónomo (IVA)?";\n',
    a: '    tipoLabel.textContent = "Tipo de cliente";\n',
    cae: 'el modal de cliente pinta el rótulo firmado junto al selector',
  },
  {
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: '<div class="field"><label>¿Factura como empresa o autónomo (IVA)?</label>',
    a: '<div class="field"><label>Tipo de cliente</label>',
    cae: 'la ficha 360 pinta el rótulo firmado junto al selector',
  },
  {
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: '          <option value="EMPRESARIO">Empresa / profesional</option>\n',
    a: '          <option value="EMPRESARIO">Empresa o autónomo</option>\n',
    cae: 'la ficha 360 pinta el rótulo firmado junto al selector',
  },
];

/** El texto propio de un nodo y de toda su descendencia. */
const textoDe = (n) => todos(n).map((x) => x._texto || '').join('').trim();

/** El <label> hermano del <select>: el del mismo contenedor `.field`. */
function rotuloDelSelect(select) {
  assert.ok(select && select._padre, '🔴 CIEGO: el <select> del campo no tiene contenedor.');
  const label = select._padre.hijos.find((h) => h && h.tagName === 'LABEL');
  assert.ok(label, '🔴 CIEGO: el contenedor del <select> no tiene <label>.');
  return textoDe(label);
}

const opcionesDe = (select) => select.hijos
  .filter((h) => h && h.tagName === 'OPTION')
  .map((o) => [o.value, textoDe(o)]);

function fingeReset(banco) {
  // `openModal` llama a `form.reset()`, que el banco no implementa (misma nota en scrum575b/579).
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'form' && typeof n.reset !== 'function') n.reset = function () {};
    return n;
  };
}

/** Lista de clientes → «Nuevo cliente» → el <select name="tipoDestinatario"> del modal. */
async function selectDelModal() {
  const banco = cargarDashboard(RAIZ, { datos: {} });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  fingeReset(banco);
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la pantalla de clientes revienta: ${r.error && r.error.message}`);
  const btn = todos(r.contenedor).find((n) => String(n._texto || '').includes('Nuevo cliente'));
  assert.ok(btn, '🔴 CIEGO: no encuentro el botón que abre el modal.');
  btn.disparar('click');
  const select = todos(banco.ctx.document.body).find((n) => n.tagName === 'SELECT' && n.name === 'tipoDestinatario');
  assert.ok(select, '🔴 CIEGO: el modal no tiene <select name="tipoDestinatario">.');
  return select;
}

/** Ficha 360 → «Editar» → el <select id="e360-tipodestinatario">. */
async function selectDeLaFicha() {
  const customer = { id: 7, name: 'Ana 1782b', createdAt: '2025-01-01T00:00:00Z' };
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) {
        return { customer, quotes: [], invoices: [], events: [], stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 } };
      }
      if (/\/admin\/customers\/\d+$/.test(u)) return { ...customer };
      return [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomer360View', customer.id);
  assert.equal(r.error, null, `🔴 la ficha 360 no montó: ${r.error && r.error.message}`);
  const porId = (id) => todos(banco.ctx.document.body).find((n) => n.id === id) || null;
  const editar = porId('btn-edit-360');
  assert.ok(editar && typeof editar.onclick === 'function', '🔴 CIEGO: no encuentro «Editar» de la ficha 360.');
  editar.onclick();
  const select = porId('e360-tipodestinatario');
  assert.ok(select, '🔴 CIEGO: pulsar «Editar» no pintó #e360-tipodestinatario.');
  return select;
}

test('SCRUM-1782b · SUELO: el lector de rótulos ve un <label> sembrado junto a su <select>', () => {
  const label = { tagName: 'LABEL', _texto: 'Sembrado 1782b', hijos: [] };
  const select = { tagName: 'SELECT', hijos: [], _padre: null };
  const campo = { tagName: 'DIV', hijos: [label, select] };
  select._padre = campo;
  assert.equal(rotuloDelSelect(select), 'Sembrado 1782b', '🔴 LECTOR CIEGO: no lee un rótulo sembrado a propósito.');
});

test('SCRUM-1782b · el modal de cliente pinta el rótulo firmado junto al selector', async () => {
  const select = await selectDelModal();
  assert.equal(rotuloDelSelect(select), ROTULO,
    '🔴 el rótulo del campo en el modal de cliente no es el firmado en SCRUM-1782 c.22268.');
  assert.deepEqual(opcionesDe(select), OPCIONES,
    '🔴 las opciones del selector han cambiado, y c.22268 dice que NO cambian.');
});

test('SCRUM-1782b · la ficha 360 pinta el rótulo firmado junto al selector', async () => {
  const select = await selectDeLaFicha();
  assert.equal(rotuloDelSelect(select), ROTULO,
    '🔴 el rótulo del campo en la ficha 360 no es el firmado en SCRUM-1782 c.22268.');
  assert.deepEqual(opcionesDe(select), OPCIONES,
    '🔴 las opciones del selector han cambiado, y c.22268 dice que NO cambian.');
});
