// tests/scrum1156c-la-ficha-del-gasto.test.mjs — SCRUM-1156 (la mitad de pantalla)
//
// Hasta hoy un gasto no se podía LEER: tocar la fila abría el modal de edición, y la foto del ticket
// salía en miniatura debajo de catorce campos. La ficha (`renderExpenseDetailView`) pone la foto
// delante, y de los datos de la factura sólo lo que el profesional apuntó: sin ninguno, no hay
// tarjeta (nunca una columna de «—»). Textos: SCRUM-920 comentario 15992, sección «El detalle y el ⋯».
//
// Se pinta la pantalla de verdad (los scripts de `index.html`, con su `apiRequest`) contra
// `GET /admin/expenses/:id` de mentira, y se lee lo que queda en el DOM del banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const GASTO = Object.freeze({
  id: 7, concept: 'Tubo de cobre 22 mm', amount: '48.40', category: 'materiales', date: '2026-10-14T00:00:00.000Z',
  notes: null, tieneFoto: true, job: null, quote: null, provider: null, quoteId: null, providerId: null,
  baseAmount: null, vatRate: null, vatAmount: null, providerInvoiceNumber: null, providerInvoiceDate: null,
});

function red(gasto, status = 200) {
  const resp = (s, data) => ({
    ok: s < 300, status: s, statusText: String(s), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => (/\/admin\/expenses\/7$/.test(String(url))
      ? (status < 300 ? resp(200, { ok: true, item: gasto }) : resp(status, { ok: false, error: 'x' }))
      : resp(200, [])),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const clases = (n) => (typeof n.className === 'string' ? n.className.split(' ') : []);

/** Pinta la ficha de ESE gasto. Devuelve los nodos, el texto entero, el «⋯» capturado y el banco. */
async function ficha(cambios = {}, status = 200) {
  const gasto = { ...GASTO, ...cambios };
  const banco = cargarDashboard(RAIZ, { red: red(gasto, status) });
  banco.ctx.appUserRole = 'admin';
  // El «⋯» no mete sus opciones en el DOM hasta que se abre: se capturan al construirlo.
  const menus = [];
  const original = banco.ctx.overflowMenu;
  // `Array.from`: el array llega del contexto del banco, y `deepStrictEqual` no iguala dos reinos.
  banco.ctx.overflowMenu = (els, o) => { menus.push(Array.from(els || []).filter(Boolean).map((b) => String(b.textContent))); return original(els, o); };
  const navegaciones = [];
  banco.ctx.renderAppView = (vista, p) => navegaciones.push([vista, p || null]);
  const toasts = [];
  banco.ctx.showToast = (t) => toasts.push(String(t));
  const v = await pintarVista(banco, 'renderExpenseDetailView', gasto.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  const nodos = todos(v.contenedor);
  return { nodos, todo: nodos.map((n) => n.textContent || '').join(' | '), menus, navegaciones, toasts };
}

const textos = (nodos, clase) => nodos.filter((n) => clases(n).includes(clase)).map((n) => n.textContent);

test('SCRUM-1156c · 🔴 SUELO: la ficha se monta, con el concepto, el importe y la píldora de la foto', async () => {
  const { nodos, todo } = await ficha();
  assert.ok(nodos.some((n) => n.tagName === 'H2' && n.textContent === 'Tubo de cobre 22 mm'), '🔴 no veo el concepto como título');
  assert.ok(todo.includes('48,40'), '🔴 no veo el importe');
  assert.deepEqual(textos(nodos, 'gasto-foto'), ['Foto guardada']);
});

test('SCRUM-1156c · con foto: la foto DELANTE, por su ruta, con «Ver a tamaño completo» y «Cambiar la foto»', async () => {
  const { nodos, todo } = await ficha();
  const img = nodos.find((n) => n.tagName === 'IMG');
  assert.ok(img, '🔴 la ficha de un gasto con foto no enseña la foto');
  assert.equal(img.src || img.getAttribute('src'), '/admin/expenses/7/foto');
  assert.ok(todo.includes('La foto del ticket'));
  assert.ok(todo.includes('Ver a tamaño completo'));
  assert.ok(todo.includes('Cambiar la foto'));
  assert.ok(!todo.includes('De este gasto no guardaste ninguna foto.'), '🔴 dice que no hay foto teniéndola');
});

test('SCRUM-1156c · sin foto: lo dice, y ofrece añadirla; no pide una foto que no existe', async () => {
  const { nodos, todo } = await ficha({ tieneFoto: false });
  assert.ok(!nodos.some((n) => n.tagName === 'IMG'), '🔴 pide /foto de un gasto sin foto: un 404 por fila');
  assert.ok(todo.includes('De este gasto no guardaste ninguna foto.'));
  assert.ok(todo.includes('📷 Añadir la foto ahora'));
  assert.deepEqual(textos(nodos, 'gasto-foto'), ['Sin foto']);
});

test('SCRUM-1156c · datos de la factura: SÓLO los apuntados, en el orden del alta; sin ninguno, sin tarjeta', async () => {
  const vacia = await ficha();
  assert.ok(!vacia.todo.includes('Datos de la factura del proveedor'), '🔴 tarjeta de datos sin un solo dato');
  assert.ok(!vacia.nodos.some((n) => n.tagName === 'DD' && n.textContent === '—'), '🔴 una fila con raya: la lista de «qué le falta»');

  const { nodos, todo } = await ficha({ providerInvoiceNumber: 'A-2026/114', baseAmount: '40.00', vatRate: '21', vatAmount: '8.40' });
  assert.ok(todo.includes('Datos de la factura del proveedor'));
  const dt = nodos.filter((n) => n.tagName === 'DT').map((n) => n.textContent);
  const dd = nodos.filter((n) => n.tagName === 'DD').map((n) => n.textContent);
  assert.deepEqual(dt, ['Nº de factura del proveedor', 'Base imponible', 'Tipo de IVA', 'Cuota de IVA']);
  assert.equal(dd[0], 'A-2026/114');
  assert.equal(dd[2], '21%');
  assert.ok(dd[1].includes('40,00') && dd[3].includes('8,40'), `🔴 importes mal: ${JSON.stringify(dd)}`);
  // El rótulo que NO se apuntó tampoco sale...
  assert.ok(!dt.includes('Fecha de la factura'));
  // ...y su hermano: apuntada, sale, en su sitio del alta. Sin esto la negación de arriba pasaría
  // también con un rótulo mal escrito (SCRUM-237).
  const conFecha = await ficha({ providerInvoiceNumber: 'A-2026/114', providerInvoiceDate: '2026-10-03' });
  const dtConFecha = conFecha.nodos.filter((n) => n.tagName === 'DT').map((n) => n.textContent);
  assert.deepEqual(dtConFecha, ['Nº de factura del proveedor', 'Fecha de la factura']);
  assert.ok(dtConFecha.includes('Fecha de la factura'));
});

test('SCRUM-1156c · gasto suelto: «Sin trabajo», por qué importa, y «Vincular a un trabajo»', async () => {
  const { todo, menus } = await ficha();
  assert.ok(todo.includes('Sin trabajo'));
  assert.ok(todo.includes('Este gasto no cuenta para el margen de ningún trabajo.'));
  assert.ok(todo.includes('Vincular a un trabajo'));
  assert.equal(menus.length, 1, '🔴 SUELO: no capturé el «⋯» de la ficha');
  assert.deepEqual(menus[0], ['Editar', 'Ver la foto', 'Vincular a un trabajo', '🗑 Eliminar']);
});

test('SCRUM-1156c · gasto con trabajo: su nombre y «Ver trabajo», sin «Vincular»; el «⋯» sin foto ofrece añadirla', async () => {
  const { todo, menus } = await ficha({ tieneFoto: false, job: { id: 500, titulo: 'Reforma baño' }, quote: { id: 61 }, quoteId: 61 });
  assert.ok(todo.includes('Reforma baño'));
  assert.ok(!todo.includes('Este gasto no cuenta para el margen de ningún trabajo.'), '🔴 dice suelto un gasto con trabajo');
  assert.ok(!todo.includes('Vincular a un trabajo'));
  assert.deepEqual(menus[0], ['Editar', '📷 Añadir la foto', 'Ver trabajo', '🗑 Eliminar']);
});

test('SCRUM-1156c · notas: el texto del profesional entra como TEXTO; en blanco, sin sección', async () => {
  const raro = 'medidas: 3 < 4 & <b>hecho</b>';
  const { nodos } = await ficha({ notes: raro });
  assert.deepEqual(textos(nodos, 'gasto-ficha-notas'), [raro], '🔴 la nota se altera al pintarla');
  const blanco = await ficha({ notes: '   ' });
  assert.ok(!blanco.todo.includes('Notas'), '🔴 rótulo «Notas» sobre un hueco');
});

test('SCRUM-1156c · 🔴 un 4xx dice el aviso FIRMADO del router y vuelve a Gastos; no pinta el error', async () => {
  for (const status of [404, 403, 400]) {
    const { navegaciones, toasts, todo } = await ficha({}, status);
    assert.deepEqual(navegaciones, [['expenses', null]], `🔴 con ${status} no vuelve a la lista`);
    assert.deepEqual(toasts, ['Ese gasto ya no existe.'], `🔴 con ${status} el aviso no es el firmado`);
    assert.ok(!todo.includes('Tubo de cobre'), `🔴 con ${status} pinta una ficha`);
  }
});
