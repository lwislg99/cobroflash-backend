// tests/scrum1562g-facturas-con-teclado.test.mjs — SCRUM-1562g (J1, 27-oct-2026)
//
// DESDE LA LISTA DE FACTURAS, CON TECLADO, SE ABRE LA FACTURA. Y CON RATÓN, IGUAL QUE ANTES.
//
// La fila (`TR`) abre el detalle con un clic, pero un `<tr>` no recibe foco ni teclas, y dentro
// sólo estaba la casilla del lote: con teclado no se abría ninguna factura (sonda de 1562,
// c.21124). Se resuelve como Trabajos (1562d/f): un `<button>` NATIVO «Ver detalle» por fila, en
// su propia celda, con el rótulo que el fundador firmó para las tres listas (SCRUM-1562 c.21125).
//
// «Con teclado» se mide así: un `<button>` recibe foco con el tabulador y el navegador lo activa
// con Intro y Espacio disparando su `click`. Eso lo da el navegador, no el banco; el banco dice
// qué hace ese `click`. El navegador real lo midió la sonda
// `docs/master/evidencias/SCRUM-1562/sonda-1562g-teclado.mjs` (Edge, Tab + Intro + Espacio).
//
// 🔵 LOS CONTROLES QUE SUELEN FALTAR: el ratón (la fila sigue abriendo su factura, UNA vez, y el
// botón no navega dos veces por la subida del evento) y la casilla del lote (sigue sin navegar).
// Dos filas: una CON casilla (pendiente) y una SIN ella (pagada), las dos clases de SCRUM-1275.
//
// LO QUE NO SABE: el orden del tabulador ni el anillo de foco (CSS), ni cómo lo anuncia un lector
// de pantalla. Eso lo mide la sonda en navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las cinco formas de deshacer el arreglo, cada una con el caso que la caza (SCRUM-745).
export const MUTACIONES_QUE_ME_TUMBAN = [
  // La celda del botón no llega a la fila: vuelve el defecto de c.21124.
  { fichero: 'public/dashboard/js/invoicesView.js', de: '          tr.appendChild(tdAcc);\n', a: '', cae: 'cada fila tiene un control NATIVO «Ver detalle»' },
  // Sin `stopPropagation`, el botón y la fila navegan los dos.
  { fichero: 'public/dashboard/js/invoicesView.js', de: "e.stopPropagation();\n            if (window.renderAppView) window.renderAppView('invoice-detail'",
    a: "if (window.renderAppView) window.renderAppView('invoice-detail'", cae: 'navega UNA vez' },
  // La casilla del lote vuelve a abrir la factura.
  { fichero: 'public/dashboard/js/invoicesView.js', de: 'if (e.target === cb) return;', a: '', cae: 'la casilla del lote sigue sin abrir' },
  // La columna nueva se queda sin cabecera.
  { fichero: 'public/dashboard/js/invoicesView.js', de: '        <th></th>\n', a: '', cae: 'la tabla cuadra' },
  // «Ver detalle» pasa a pesar como una acción.
  { fichero: 'public/dashboard/js/invoicesView.js', de: "bDetalle.className = 'btn-ghost btn-sm';", a: "bDetalle.className = 'btn-primary btn-sm';", cae: 'pesa como mirar' },
];

const CON_CASILLA = { id: 301, number: 'F-2026-0301', status: 'pending', total: 121, currency: 'EUR', createdAt: '2026-10-20T10:00:00Z', customer: { name: 'Cliente A' } };
const SIN_CASILLA = { id: 402, number: 'F-2026-0402', status: 'paid', total: 242, currency: 'EUR', createdAt: '2026-10-21T10:00:00Z', customer: { name: 'Cliente B' } };
const FACTURAS = [CON_CASILLA, SIN_CASILLA];

const esNativo = (n) => n.tagName === 'BUTTON'
  || (n.tagName === 'A' && ((n.getAttribute && n.getAttribute('href') != null) || !!n.href));
const rotulo = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const clase = (n) => String(n.className || '');

async function montar() {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/invoices(\?|$)/.test(url) ? FACTURAS : []),
  });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: el dashboard no carga entero en el banco.');
  const navegaciones = [];
  // JSON: `params` nace en el realm de `vm` y `deepStrictEqual` compara prototipos.
  banco.ctx.renderAppView = (vista, params) => { navegaciones.push(JSON.parse(JSON.stringify({ vista, params }))); };
  const r = await pintarVista(banco, 'renderInvoicesView');
  assert.equal(r.error, null, `🔴 CIEGO: la vista revienta al montarse: ${r.error}`);
  return { r, navegaciones };
}

function filaDe(contenedor, numero) {
  const tr = todos(contenedor).find((n) => n.tagName === 'TR'
    && n.hijos.some((td) => td && td.className === 'cell-id' && td.textContent === numero));
  assert.ok(tr, `🔴 CIEGO: no encuentro la fila de ${numero}; sin ella este test no mide nada.`);
  return tr;
}

/** El clic que llega a la FILA con `target` = lo pulsado (lo que hace el navegador al burbujear). */
function pulsarFila(tr, objetivo) {
  const oyentes = tr._oyentes.click || [];
  assert.ok(oyentes.length > 0, '🔴 CIEGO: la fila no tiene oyente de clic.');
  for (const f of oyentes) f.call(tr, { type: 'click', target: objetivo, currentTarget: tr, preventDefault() {}, stopPropagation() {} });
}

/** Lo que hace el control POR SÍ MISMO: sólo sus oyentes, sin subir a la fila. */
function pulsarSinSubir(n) {
  const ev = { type: 'click', target: n, currentTarget: n, preventDefault() {}, stopPropagation() {} };
  for (const f of ((n._oyentes && n._oyentes.click) || []).slice()) f.call(n, ev);
}

const destinoDe = (inv) => [{ vista: 'invoice-detail', params: { invoiceId: inv.id } }];
const casillaDe = (tr) => todos(tr).find((n) => n.tagName === 'INPUT' && n.className === 'inv-row-check') || null;

test('SCRUM-1562g · SUELO: dos filas, y cada una abre SU factura con RATÓN, una vez', async () => {
  for (const inv of FACTURAS) {
    const m = await montar();
    const tr = filaDe(m.r.contenedor, inv.number);
    pulsarFila(tr, tr.hijos.find((h) => h.className === 'cell-id'));
    assert.deepEqual(m.navegaciones, destinoDe(inv), `🔴 ${inv.number}: el clic en la fila hizo ${JSON.stringify(m.navegaciones)}`);
  }
  const { r } = await montar();
  assert.ok(casillaDe(filaDe(r.contenedor, CON_CASILLA.number)), '🔴 CIEGO: la pendiente ha perdido la casilla; el control de la casilla no mide nada.');
  assert.equal(casillaDe(filaDe(r.contenedor, SIN_CASILLA.number)), null, '🔴 CIEGO: la pagada tiene casilla; falta la clase de fila sin ella.');
});

test('SCRUM-1562g · 🔴 cada fila tiene un control NATIVO «Ver detalle» que abre SU factura, por sí mismo', async () => {
  for (const inv of FACTURAS) {
    const m = await montar();
    const nativos = todos(filaDe(m.r.contenedor, inv.number)).filter(esNativo);
    const ver = nativos.filter((n) => rotulo(n) === 'Ver detalle');
    assert.equal(ver.length, 1,
      `🔴 ${inv.number}: los nativos de la fila dicen ${JSON.stringify(nativos.map(rotulo))}; falta UN «Ver detalle» y con teclado no se abre`);
    pulsarSinSubir(ver[0]);
    assert.deepEqual(m.navegaciones, destinoDe(inv), `🔴 ${inv.number}: «Ver detalle» hizo ${JSON.stringify(m.navegaciones)}`);
  }
});

// Aquí SÍ con `click()`, que sube a la fila: el botón no puede depender de la guarda de la fila.
test('SCRUM-1562g · 🔵 control del ratón: «Ver detalle» navega UNA vez (la fila no repite el viaje)', async () => {
  for (const inv of FACTURAS) {
    const m = await montar();
    const [boton] = todos(filaDe(m.r.contenedor, inv.number)).filter((n) => esNativo(n) && rotulo(n) === 'Ver detalle');
    assert.ok(boton, `🔴 CIEGO: ${inv.number} no tiene «Ver detalle» que pulsar`);
    boton.click();
    assert.deepEqual(m.navegaciones, destinoDe(inv), `🔴 ${inv.number}: «Ver detalle» hizo ${JSON.stringify(m.navegaciones)}; tenía que navegar una vez`);
  }
});

test('SCRUM-1562g · 🔵 la casilla del lote sigue sin abrir la factura', async () => {
  const m = await montar();
  const tr = filaDe(m.r.contenedor, CON_CASILLA.number);
  pulsarFila(tr, casillaDe(tr));
  assert.deepEqual(m.navegaciones, [], `🔴 marcar la casilla navegó: ${JSON.stringify(m.navegaciones)}`);
});

test('SCRUM-1562g · la tabla cuadra: tantas cabeceras como celdas tiene cada fila', async () => {
  const { r } = await montar();
  const ths = todos(r.contenedor).filter((n) => n.tagName === 'TH');
  for (const inv of FACTURAS) {
    const tds = filaDe(r.contenedor, inv.number).hijos.filter((h) => h && h.tagName === 'TD');
    assert.equal(tds.length, ths.length, `🔴 ${inv.number}: ${tds.length} celdas bajo ${ths.length} cabeceras; la columna nueva va sin su <th>`);
  }
});

test('SCRUM-1562g · «Ver detalle» pesa como mirar, no como actuar, y la fila sigue siendo una fila', async () => {
  const { r } = await montar();
  for (const inv of FACTURAS) {
    const tr = filaDe(r.contenedor, inv.number);
    const [boton] = todos(tr).filter((n) => esNativo(n) && rotulo(n) === 'Ver detalle');
    assert.ok(boton, '🔴 CIEGO: no hay «Ver detalle»');
    assert.match(clase(boton), /\bbtn-ghost\b/, `🔴 «Ver detalle» lleva «${clase(boton)}»`);
    assert.doesNotMatch(clase(boton), /\bbtn-(primary|secondary)\b/, '🔴 «Ver detalle» compite con las acciones');
    assert.equal(tr.getAttribute('role'), null, '🔴 un `<tr>` con `role` deja de ser una fila de tabla para quien la oye');
  }
});
