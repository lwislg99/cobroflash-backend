// tests/scrum1639-filas-con-teclado.test.mjs — SCRUM-1639 (S2, 29-oct-2026)
//
// LAS FILAS QUE ABREN OTRA PANTALLA SE ABREN TAMBIÉN CON TECLADO. Y CON RATÓN, IGUAL QUE ANTES.
//
// El censo del ticket encontró cuatro filas que navegan con un clic y no tienen ninguna vía de
// teclado: Gastos (`expensesView.js`), Equipo ×2 (`teamView.js`) y la tarjeta de factura de la ficha
// del presupuesto (`quotesDetailView.js`). El arreglo copia `homeView.js` (`role="button"` +
// `tabindex="0"` + Intro y Espacio), SIN texto nuevo: el nombre accesible es el propio contenido.
// Donde la fila contiene controles (el «⋯» y el enlace del trabajo en Gastos; «Marcar como pagada»
// en la factura pendiente), el activable es el bloque de texto de dentro: un botón no contiene botones.
//
// 🔵 `teamView.js` es de J3 (`dos-equipos.md:145`): S2 no lo toca (A20). Sus dos filas quedan como
// TECHO EXACTO del censo; cuando J3 las arregle, este test cae y pide bajarlo a 0.
//
// «Con teclado» se mide así: el oyente de `keydown` del activable, con Intro y con Espacio. Que el
// foco llegue con el tabulador lo da `tabindex="0"`; el anillo, el `:focus-visible` global
// (`styles.css:143`), que en estos dos sitios nadie pisa. LO QUE NO SABE: cómo lo anuncia un lector
// de pantalla, ni el orden de tabulación real en el navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { censarFuente } from './_censo-filas-sin-teclado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Cada forma de deshacer el arreglo, con el caso que la caza (SCRUM-745).
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'public/dashboard/js/expensesView.js', de: "  que.addEventListener('keydown', (ev) => {\n    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirGasto(); }\n  });\n", a: '', cae: 'Gastos · Intro y Espacio' },
  { fichero: 'public/dashboard/js/expensesView.js', de: "  que.setAttribute('tabindex', '0');\n", a: '', cae: 'Gastos · Intro y Espacio' },
  { fichero: 'public/dashboard/js/expensesView.js', de: "  que.setAttribute('role', 'button');\n", a: "  fila.setAttribute('role', 'button');\n", cae: 'Gastos · Intro y Espacio' },
  { fichero: 'public/dashboard/js/quotesDetailView.js', de: "        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFactura(); }\n", a: "        if (e.key === 'Enter') { e.preventDefault(); abrirFactura(); }\n", cae: 'ficha del presupuesto · Intro y Espacio' },
  { fichero: 'public/dashboard/js/quotesDetailView.js', de: "      div.addEventListener('click', abrirFactura);\n", a: '', cae: 'ratón' },
  { fichero: 'public/dashboard/css/styles.css', de: '.quote-line__ajustes:focus-visible { outline: none; box-shadow: var(--ring); }', a: '.quote-line__ajustes:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(34,197,94,.30); }', cae: 'el anillo de foco' },
];

const esNativo = (n) => ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(n.tagName);
const clases = (n) => String(n.className || '').split(/\s+/);

/** Pulsa una tecla en el nodo: sólo SUS oyentes de `keydown`. Devuelve si se llamó a `preventDefault`. */
function tecla(n, key) {
  const oyentes = (n._oyentes && n._oyentes.keydown) || [];
  let prevenido = false;
  for (const f of oyentes.slice()) f.call(n, { type: 'keydown', key, target: n, currentTarget: n, preventDefault() { prevenido = true; }, stopPropagation() {} });
  return prevenido;
}

/** El clic del ratón tal como llega a la fila al subir desde `objetivo`. */
function clicEnFila(fila, objetivo) {
  const oyentes = (fila._oyentes && fila._oyentes.click) || [];
  assert.ok(oyentes.length > 0, '🔴 CIEGO: la fila no tiene oyente de clic.');
  for (const f of oyentes.slice()) f.call(fila, { type: 'click', target: objetivo, currentTarget: fila, preventDefault() {}, stopPropagation() {} });
}

function comprobarActivable(n, donde) {
  assert.equal(n.getAttribute('role'), 'button', `🔴 ${donde}: role=${n.getAttribute('role')}; un lector de pantalla no lo anuncia como pulsable`);
  assert.equal(String(n.getAttribute('tabindex')), '0', `🔴 ${donde}: tabindex=${n.getAttribute('tabindex')}; el tabulador no llega`);
  const dentro = todos(n).filter((x) => x !== n && esNativo(x));
  assert.deepEqual(dentro.map((x) => x.tagName), [], `🔴 ${donde}: el botón contiene controles; un botón no puede contener botones`);
}

// ── Gastos ──────────────────────────────────────────────────────────────────────────────────────
const GASTO = { id: 77, concept: 'Cable 2,5 mm', notes: null, date: '2026-10-20T10:00:00.000Z', category: 'material', amount: '42.10', tieneFoto: false, job: { id: 5, title: 'Reforma baño' } };

async function montarGastos() {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/expenses\?/.test(String(url)) ? { items: [GASTO] } : (/\/admin\/expenses\/summary/.test(String(url)) ? {} : [])),
  });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: el dashboard no carga entero en el banco.');
  const navegaciones = [];
  banco.ctx.renderAppView = (vista, params) => { navegaciones.push(JSON.parse(JSON.stringify({ vista, params }))); };
  const r = await pintarVista(banco, 'renderExpensesView');
  assert.equal(r.error, null, `🔴 CIEGO: Gastos revienta al montarse: ${r.error}`);
  const fila = todos(r.contenedor).find((n) => clases(n).includes('gasto-fila'));
  assert.ok(fila, '🔴 CIEGO: no hay fila de gasto; sin ella este test no mide nada.');
  const que = fila.hijos.find((h) => h && clases(h).includes('gasto-que'));
  assert.ok(que, '🔴 CIEGO: la fila no tiene su bloque del concepto.');
  return { fila, que, navegaciones };
}

const AL_GASTO = [{ vista: 'expenses-detail', params: { expenseId: GASTO.id } }];

test('SCRUM-1639 · Gastos · Intro y Espacio abren el gasto, una vez; otra tecla no', async () => {
  for (const key of ['Enter', ' ']) {
    const m = await montarGastos();
    comprobarActivable(m.que, 'Gastos');
    assert.equal(tecla(m.que, key), true, `🔴 «${key}» no hace preventDefault: el Espacio desplazaría la página`);
    assert.deepEqual(m.navegaciones, AL_GASTO, `🔴 «${key}» hizo ${JSON.stringify(m.navegaciones)}`);
  }
  const m = await montarGastos();
  tecla(m.que, 'Tab');
  assert.deepEqual(m.navegaciones, [], '🔴 el tabulador navegó');
});

test('SCRUM-1639 · Gastos · 🔵 control: la fila sigue siendo `listitem` y el ratón abre igual que antes', async () => {
  const m = await montarGastos();
  assert.equal(m.fila.getAttribute('role'), 'listitem', '🔴 la fila dejó de ser `listitem` y su lista queda rota');
  clicEnFila(m.fila, m.que);
  assert.deepEqual(m.navegaciones, AL_GASTO, `🔴 el clic hizo ${JSON.stringify(m.navegaciones)}`);
});

// ── Ficha del presupuesto, sección «Facturas» ───────────────────────────────────────────────────
const PENDIENTE = { id: 9, number: 'F-2026-0009', total: '121.00', currency: 'EUR', status: 'pending', createdAt: '2026-09-21T10:00:00.000Z' };
const PAGADA = { id: 10, number: 'F-2026-0010', total: '60.50', currency: 'EUR', status: 'paid', createdAt: '2026-09-22T10:00:00.000Z' };
const PRESUPUESTO = {
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'accepted', total: '181.50', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1639', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [PENDIENTE, PAGADA],
  decision: { acceptedAt: '2026-09-20T10:00:00.000Z', rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
};

async function montarFicha() {
  const banco = cargarDashboard(RAIZ, { datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? PRESUPUESTO : []) });
  banco.ctx.appModoEmision = 'fiscal';
  const navegaciones = [];
  banco.ctx.renderAppView = (vista, params) => { navegaciones.push(JSON.parse(JSON.stringify({ vista, params }))); };
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 CIEGO: la ficha revienta: ${r.error && r.error.message}`);
  const tarjetas = todos(r.contenedor).filter((n) => clases(n).includes('invoice-item'));
  assert.equal(tarjetas.length, 2, `🔴 CIEGO: la ficha pintó ${tarjetas.length} tarjetas de factura; esperaba la pendiente y la pagada`);
  return { tarjetas, navegaciones };
}

const resumenDe = (tarjeta) => tarjeta.hijos.find((h) => h && h.tagName === 'P');
const AFACTURA = (inv) => [{ vista: 'invoice-detail', params: { invoiceId: inv.id } }];

test('SCRUM-1639 · ficha del presupuesto · Intro y Espacio abren SU factura, pendiente y pagada', async () => {
  for (const [i, inv] of [PENDIENTE, PAGADA].entries()) {
    for (const key of ['Enter', ' ']) {
      const m = await montarFicha();
      const resumen = resumenDe(m.tarjetas[i]);
      assert.ok(resumen, `🔴 CIEGO: la tarjeta de ${inv.number} no tiene su resumen`);
      comprobarActivable(resumen, `factura ${inv.number}`);
      assert.equal(tecla(resumen, key), true, `🔴 ${inv.number} «${key}»: sin preventDefault`);
      assert.deepEqual(m.navegaciones, AFACTURA(inv), `🔴 ${inv.number} «${key}» hizo ${JSON.stringify(m.navegaciones)}`);
    }
  }
});

test('SCRUM-1639 · ficha del presupuesto · 🔵 control: el ratón abre igual, y la pendiente conserva su botón FUERA del resumen', async () => {
  for (const [i, inv] of [PENDIENTE, PAGADA].entries()) {
    const m = await montarFicha();
    clicEnFila(m.tarjetas[i], resumenDe(m.tarjetas[i]));
    assert.deepEqual(m.navegaciones, AFACTURA(inv), `🔴 ${inv.number}: el clic hizo ${JSON.stringify(m.navegaciones)}`);
  }
  const { tarjetas } = await montarFicha();
  assert.ok(todos(tarjetas[0]).some((n) => n.tagName === 'BUTTON'), '🔴 CIEGO: la pendiente ya no tiene «Marcar como pagada»; el control del botón no mide nada');
});

// ── El censo de todo el panel (aceptación 5) ───────────────────────────────────────────────────
// TECHO EXACTO por fichero, en las dos direcciones: si sube, vuelve el defecto; si baja, alguien lo
// arregló y el techo se baja AQUÍ, en el mismo PR (un trinquete que sólo mira hacia arriba esconde las
// bajadas). Las dos de `teamView.js` son de J3 y quedan pedidas en SCRUM-1639.
const TECHO = { 'teamView.js': 2 };

test('SCRUM-1639 · censo: ninguna fila que navega sin vía de teclado, salvo el techo declarado de J3', () => {
  const dir = path.join(RAIZ, 'public/dashboard/js');
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  const tot = { navegan: 0, nativas: 0, conTeclado: 0, desconocidas: 0 };
  const sin = {};
  for (const f of ficheros) {
    const r = censarFuente(fs.readFileSync(path.join(dir, f), 'utf8'), f);
    for (const k of Object.keys(tot)) tot[k] += r[k];
    if (r.sinTeclado.length) sin[f] = r.sinTeclado.length;
  }
  // Población declarada: si el censo deja de ver, esto cae antes de dar un «0» hueco.
  assert.ok(ficheros.length > 80, `🔴 CIEGO: ${ficheros.length} ficheros en public/dashboard/js`);
  assert.ok(tot.navegan > 40 && tot.nativas > 25, `🔴 CIEGO: el censo ve ${JSON.stringify(tot)}`);
  assert.ok(tot.conTeclado >= 6, `🔴 CIEGO: sólo ${tot.conTeclado} filas con teclado; homeView y las de este ticket deberían contar`);
  assert.deepEqual(sin, TECHO, `🔴 filas que navegan sin teclado: ${JSON.stringify(sin)} (techo ${JSON.stringify(TECHO)}). Si subió, vuelve el defecto; si bajó, baja el techo.`);
});

test('SCRUM-1639 · 🔵 control del censo: caza una fila sin teclado, y no caza la que tiene botón nativo', () => {
  const sinTeclado = "function f(x){ const d = document.createElement('div'); d.addEventListener('click', () => renderAppView('a', {})); }";
  const conTeclado = "function f(x){ const d = document.createElement('div'); const ir = () => renderAppView('a', {}); d.addEventListener('click', ir); d.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); }); }";
  const otroDestino = "function f(x){ const d = document.createElement('div'); d.addEventListener('click', () => renderAppView('a', {})); const b = document.createElement('button'); b.addEventListener('click', () => renderAppView('b', {})); }";
  const comentario = "function f(x){ const d = document.createElement('div'); // d.addEventListener('keydown', () => renderAppView('a'))\n d.addEventListener('click', () => renderAppView('a', {})); }";
  assert.equal(censarFuente(sinTeclado).sinTeclado.length, 1, 'el censo no caza la fila sin teclado');
  assert.equal(censarFuente(conTeclado).sinTeclado.length, 0, 'el censo no ve el keydown');
  assert.equal(censarFuente(otroDestino).sinTeclado.length, 1, 'un botón que va a OTRA pantalla no es vía de teclado');
  assert.equal(censarFuente(comentario).sinTeclado.length, 1, 'un comentario no es un oyente');
});

test('SCRUM-1639 · el anillo de foco de styles.css sale del token, no escrito a mano', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const a_mano = css.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /box-shadow:\s*0 0 0 3px rgba\(34,\s*197,\s*94,\s*\.30\)/.test(l));
  assert.deepEqual(a_mano.map(([n]) => n), [], '🔴 un anillo escrito a mano en vez de `var(--ring)` (tokens.css:71)');
});
