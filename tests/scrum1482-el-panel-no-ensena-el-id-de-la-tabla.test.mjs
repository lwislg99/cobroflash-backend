// tests/scrum1482-el-panel-no-ensena-el-id-de-la-tabla.test.mjs — SCRUM-1482
//
// LA VÍCTIMA: el profesional que busca un presupuesto o abre su ficha y lee «#205» donde su lista
// dice «#4». El 205 es el id de la tabla: es de toda la plataforma, no de su cuenta.
//
// QUÉ SE EJECUTA AQUÍ: los ficheros de verdad (`globalSearch.js`, `quotesDetailView.js`) en el
// banco de vistas, con la red de mentira. En todos los casos el presupuesto tiene id 205 y
// número 4, que es lo que hace que confundirlos se vea.
//
// 🔴 QUÉ NO MIDE, y se dice:
//   · EL TÍTULO DE LA VISTA MIENTRAS CARGA Y SI FALLA. Lo escribe el router (`app.js`) y hoy
//     sigue llevando el id: el literal firmado («Presupuesto», sin número) no puede entrar ahí
//     mientras `tests/scrum832-atras-vuelve-a-la-lista.test.mjs` exija que el router escriba
//     «Presupuesto #». Está dicho en el ticket; no se toca aquel caso desde éste.
//   · El router: el banco no lo ejecuta. En el caso «cargada» el título se SIEMBRA con lo que
//     el router escribe hoy. El recorrido entero se mide en navegador (sonda `id-ficha.mjs`).
//   · Un presupuesto SIN número (`number` nulo): la ficha cae al id. Familia nombrada en el
//     ticket, fuera de él.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 205;
const NUMERO = 4;
const CUANDO = '2026-10-06T10:00:00.000Z';

const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});
const vueltas = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const textos = (raiz) => todos(raiz).map((n) => String(n.textContent || '')).filter(Boolean);
const LOCALE_ES = { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteVerb: 'presupuesto', currency: 'EUR' };

const presupuesto = () => ({
  id: ID, number: NUMERO, quoteNumber: NUMERO, revision: 0, numeroConRevision: 'P4', revisiones: [], vigenteId: ID,
  status: 'draft', total: '1.00', currency: 'EUR', payToken: 'tok1482',
  lines: [{ concept: 'Punto de luz', qty: 1, price: 1, tax: 0 }],
  createdAt: CUANDO, updatedAt: CUANDO,
  customer: { id: 3, name: 'Ana Ruiz', phone: null, email: null, notes: null },
  merchant: { id: 7, name: 'QA 1482', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: null, evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FICHA
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** La ficha del 205 montada con su GET EN VUELO. `contestar` lo suelta con lo que se le pase. */
async function fichaConLaCargaEnVuelo(locale) {
  let contestar;
  const enVuelo = new Promise((res) => { contestar = res; });
  let pedidas = 0;
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'GET' && new RegExp(`/admin/quotes/${ID}$`).test(String(url))) { pedidas++; return enVuelo; }
    return respuesta(200, []);
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  banco.ctx.appLocale = locale;
  // El título de la vista, con lo que el router escribe hoy al abrir la ficha (ver cabecera).
  const titulo = banco.mk('span');
  titulo.id = 'view-title';
  titulo.textContent = 'Presupuesto #' + ID;
  banco.ctx.document.body.appendChild(titulo);

  const v = await pintarVista(banco, 'renderQuoteDetailView', ID);
  assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
  assert.equal(pedidas, 1, '🔴 CIEGO: la ficha no ha pedido el presupuesto, así que no está «cargando».');
  const h2 = () => todos(v.contenedor).filter((n) => n.tagName === 'H2').map((n) => n.textContent);
  return { v, h2, titulo, contestar: (st, cuerpo) => contestar(respuesta(st, cuerpo)) };
}

test('SCRUM-1482 · ficha · mientras carga, la cabecera dice la palabra del documento y el id no sale en ningún texto', async () => {
  const f = await fichaConLaCargaEnVuelo(LOCALE_ES);
  assert.deepEqual(f.h2(), ['Presupuesto'],
    '🔴 la cabecera de la ficha no dice «Presupuesto» a secas mientras carga (firma: SCRUM-1482 c.18490).');
  const conElId = textos(f.v.contenedor).filter((t) => t.includes(String(ID)));
  assert.deepEqual(conElId, [],
    `🔴 la ficha enseña el id de la tabla (${ID}) mientras carga. Aún no sabe el número del presupuesto: `
    + 'lo único que tiene es el id de la ruta, y ése no se enseña.');
  assert.ok(textos(f.v.contenedor).includes('Cargando presupuesto…'),
    '🔴 CIEGO: no sale «Cargando presupuesto…», así que esto no es la ficha a medio cargar.');
});

test('SCRUM-1482 · ficha · la palabra de la cabecera sale del LOCALE, no está escrita', async () => {
  const f = await fichaConLaCargaEnVuelo({ ...LOCALE_ES, quote: 'Cotización', quotePlural: 'Cotizaciones' });
  assert.deepEqual(f.h2(), ['Cotización'],
    '🔴 con un locale que dice «Cotización» la cabecera de la ficha dice otra cosa mientras carga: '
    + 'la palabra está escrita a mano en vez de leerse de `appLocale.quote`.');
});

test('SCRUM-1482 · ficha · si la carga falla, la cabecera se queda en la palabra sola y el aviso de error no cambia', async () => {
  const f = await fichaConLaCargaEnVuelo(LOCALE_ES);
  f.contestar(500, { error: 'internal_error' });
  await vueltas();
  assert.ok(textos(f.v.contenedor).includes('Error cargando presupuesto.'),
    '🔴 CIEGO: no sale «Error cargando presupuesto.», así que la carga no ha fallado o el aviso ha cambiado '
    + '(la firma dice que ese aviso NO se toca).');
  assert.deepEqual(f.h2(), ['Presupuesto'],
    '🔴 con la carga fallida la cabecera no se queda en «Presupuesto» a secas.');
  const conElId = textos(f.v.contenedor).filter((t) => t.includes(String(ID)));
  assert.deepEqual(conElId, [], `🔴 con la carga fallida la ficha se queda enseñando el id de la tabla (${ID}).`);
});

test('SCRUM-1482 · ficha · CONTROL: cargada, la cabecera y el título de la vista llevan el número de siempre', async () => {
  const f = await fichaConLaCargaEnVuelo(LOCALE_ES);
  f.contestar(200, presupuesto());
  await vueltas();
  assert.deepEqual(f.h2(), ['Presupuesto #' + NUMERO],
    '🔴 cargada, la cabecera de la ficha no dice «Presupuesto #4»: se ha quedado sin número.');
  assert.equal(f.titulo.textContent, 'Presupuesto #' + NUMERO,
    '🔴 cargada, el título de la vista no se ha corregido al número del presupuesto. La ficha sólo lo '
    + 'corrige si el título que encuentra es el que ella reconoce: si ha cambiado lo que escribe el '
    + 'router, esto es lo que se rompe y en el fuente no se ve.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL BUSCADOR DE ARRIBA
//
// `globalSearch.js` se engancha en `DOMContentLoaded` y busca sus dos nodos por id. El banco no
// dispara ese evento, así que aquí se le ponen los dos nodos, se vuelve a cargar el fichero con
// un `document.addEventListener` que GUARDA el oyente, y se llama. Es el fichero real.
// ═════════════════════════════════════════════════════════════════════════════════════════════

async function buscar(termino, presupuestos) {
  let pedidas = 0;
  const fetch = async (url) => {
    if (/\/admin\/search\?/.test(String(url))) { pedidas++; return respuesta(200, { customers: [], quotes: presupuestos, invoices: [] }); }
    return respuesta(200, []);
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  banco.ctx.appLocale = LOCALE_ES;
  const doc = banco.ctx.document;
  const entrada = banco.mk('input'); entrada.id = 'global-search-input';
  const lista = banco.mk('div'); lista.id = 'global-search-dropdown';
  doc.body.appendChild(entrada); doc.body.appendChild(lista);

  const alArrancar = [];
  doc.addEventListener = (tipo, fn) => { if (tipo === 'DOMContentLoaded') alArrancar.push(fn); };
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/globalSearch.js'), 'utf8'), banco.ctx, { filename: 'js/globalSearch.js' });
  assert.equal(alArrancar.length, 1, '🔴 CIEGO: `globalSearch.js` ya no se engancha en `DOMContentLoaded`; este banco no lo arranca.');
  alArrancar[0]();

  const abiertos = [];
  banco.ctx.renderAppView = (vista) => abiertos.push({ vista, quoteId: banco.ctx.appState && banco.ctx.appState.quoteId });

  entrada.value = termino;
  entrada.disparar('input');
  // La búsqueda espera 220 ms antes de pedir.
  await new Promise((r) => setTimeout(r, 300));
  await vueltas();
  assert.equal(pedidas, 1, '🔴 CIEGO: el buscador no ha pedido nada al servidor.');
  const filas = todos(lista).filter((n) => String(n.className || '').split(/\s+/).includes('gs-item'));
  return { filas, abiertos, textoDe: (fila) => textos(fila) };
}

// El término NO sale en ningún texto de la fila, a propósito: el buscador envuelve en <mark> lo que
// casa, y el banco no suma el texto de los hijos (límite 4 de `_banco-vistas.mjs`): con «Ana» la
// fila se leería sin el nombre del cliente y el fallo sería del banco.
const TERMINO = 'luz';

const hallado = (numeroVisible) => ({
  id: ID, numeroVisible, status: 'draft', total: '1.00', currency: 'EUR', createdAt: CUANDO,
  customer: { id: 3, name: 'Ana Ruiz' },
});

test('SCRUM-1482 · buscador · la fila del presupuesto pinta el número que manda el servidor, no el id de la tabla', async () => {
  const b = await buscar(TERMINO, [hallado('#' + NUMERO)]);
  assert.equal(b.filas.length, 1, '🔴 CIEGO: el buscador no ha pintado la fila del presupuesto.');
  const t = b.textoDe(b.filas[0]);
  assert.ok(t.includes('Ana Ruiz'), '🔴 CIEGO: la fila no lleva el nombre del cliente; no es la fila que se cree.');
  assert.ok(t.includes('#' + NUMERO),
    `🔴 la fila no enseña «#${NUMERO}», que es lo que manda el servidor en \`numeroVisible\`: [${t.join(' | ')}]`);
  assert.deepEqual(t.filter((x) => x.includes(String(ID))), [],
    `🔴 la fila del buscador enseña el id de la tabla (${ID}): [${t.join(' | ')}]`);
});

test('SCRUM-1482 · buscador · una revisión se pinta tal cual llega, sin recomponerla', async () => {
  const b = await buscar(TERMINO, [hallado('#' + NUMERO + '.1')]);
  assert.equal(b.filas.length, 1, '🔴 CIEGO: el buscador no ha pintado la fila del presupuesto.');
  assert.ok(b.textoDe(b.filas[0]).includes('#' + NUMERO + '.1'),
    '🔴 la fila no pinta el texto del servidor entero: el número de una revisión no se compone en el panel.');
});

test('SCRUM-1482 · buscador · sin número del servidor, la fila no pinta ninguno: ni el id ni una almohadilla suelta', async () => {
  const b = await buscar(TERMINO, [hallado(null)]);
  assert.equal(b.filas.length, 1, '🔴 CIEGO: el buscador no ha pintado la fila del presupuesto.');
  const t = b.textoDe(b.filas[0]);
  assert.ok(t.includes('Ana Ruiz'), '🔴 CIEGO: la fila no lleva el nombre del cliente.');
  assert.deepEqual(t.filter((x) => x.includes(String(ID)) || x.includes('#')), [],
    `🔴 sin número, la fila pinta un repuesto (el id de la tabla o una «#» suelta): [${t.join(' | ')}]`);
});

test('SCRUM-1482 · buscador · CONTROL: pulsar la fila sigue abriendo la ficha por su id', async () => {
  const b = await buscar(TERMINO, [hallado('#' + NUMERO)]);
  assert.equal(b.filas.length, 1, '🔴 CIEGO: el buscador no ha pintado la fila del presupuesto.');
  b.filas[0].disparar('click');
  assert.deepEqual(b.abiertos, [{ vista: 'quotes-detail', quoteId: ID }],
    '🔴 pulsar la fila ya no abre la ficha de ESE presupuesto. El id deja de PINTARSE, no de usarse: '
    + 'es lo que abre la ficha.');
});
