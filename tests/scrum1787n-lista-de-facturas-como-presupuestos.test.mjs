// SCRUM-1787n · la LISTA de facturas con la forma de la lista de presupuestos.
//
// Orden del fundador (SCRUM-1787, descripción): «quiero que sea igual, o solamente lo estrictamente
// necesario diferente, que presupuestos». Clasificado en SCRUM-1787 c.22301 fila 10: la única columna
// distinta NECESARIA es el número de serie (RD 1619/2012 art. 6.1 a); el resto, NO necesaria.
//
// 🔴 La referencia NO se copia aquí: se PINTA la lista de presupuestos (`quotesListView.js`, S2, sólo
// lectura) en el mismo banco y se compara con lo que pinta la de facturas. Si S2 mueve o renombra una
// columna, este test cae y obliga a decidir — en vez de quedarse comparando contra una copia vieja.
//
// Diferencias que SE QUEDAN, con su porqué (y su comprobación, que no es ésta):
//   · la casilla del lote, primera columna y solo en escritorio: es una FUNCIÓN (marcar pagadas en
//     bloque), no un adorno (encargo de 1787n). La miran scrum845 y el control ④ de aquí.
//   · el rótulo del número: «Nº factura» (`rotulosDelDocumento.columnaNumero()`), no «ID»: el número
//     de serie es lo necesario (art. 6.1 a).
//   · «Ver detalle» con `btn-ghost` y no `btn-secondary`: lo fija `scrum1562g` («pesa como mirar, no
//     como actuar», rótulo y peso firmados en SCRUM-1562 c.21125). Regla 41: el guard no se toca.
//   · los ESTADOS: los de la factura (Parte L, cerrados).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el orden viejo: la fecha detrás del estado.
    fichero: 'public/dashboard/js/invoicesView.js',
    de: "          tr.appendChild(tdDate);\n          tr.appendChild(tdTotal);\n",
    a: "          tr.appendChild(tdTotal);\n          tr.appendChild(tdDate);\n",
    cae: 'SCRUM-1787n · ② cada fila pinta sus celdas en el orden y con las clases de la de presupuestos',
  },
  {
    // Vuelve el rótulo viejo de la columna del importe.
    fichero: 'public/dashboard/js/invoicesView.js',
    de: '<th class="j1-fac-col-total">Importe</th>',
    a: '<th class="j1-fac-col-total">Total</th>',
    cae: 'SCRUM-1787n · ① las cabeceras son las de presupuestos, en su orden, con el número de serie en lugar del ID',
  },
  {
    // El método de cobro deja de leerse de la etiqueta compartida.
    fichero: 'public/dashboard/js/invoicesView.js',
    de: "tdMetodo.textContent = inv.paidVia ? window.etiquetaMetodoCobro(inv.paidVia) : '—';",
    a: "tdMetodo.textContent = '—';",
    cae: 'SCRUM-1787n · ③ «Método» y «Fecha» dicen lo mismo que en presupuestos',
  },
];

const PRESUPUESTOS = [
  { id: 31, number: 14, customerName: 'Cliente A', status: 'sent', totalAmount: '1250.00', currency: 'EUR', method: null, createdAt: '2026-11-20T09:15:00Z', tags: [] },
];
const FACTURAS = [
  { id: 41, number: 'F2026-0012', type: 'F1', customerName: 'Cliente A', status: 'pending', total: '1250.00', currency: 'EUR', paidVia: null, createdAt: '2026-11-20T09:15:00Z', tags: [] },
  { id: 42, number: 'F2026-0011', type: 'F1', customerName: 'Cliente B', status: 'paid', total: '480.50', currency: 'EUR', paidVia: 'transfer', createdAt: '2026-11-18T16:40:00Z', tags: [] },
];

const texto = (n) => todos(n).map((x) => x._texto || x.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
const tabla = (contenedor) => {
  const t = todos(contenedor).find((n) => n.tagName === 'TABLE' && /\btable--cards-mobile\b/.test(String(n.className || '')));
  assert.ok(t, '🔴 CIEGO: no hay tabla de lista en la vista.');
  return t;
};
const cabeceras = (t) => todos(t).filter((n) => n.tagName === 'TH').map((th) => texto(th));
const filas = (t) => {
  const tbody = todos(t).find((n) => n.tagName === 'TBODY');
  return (tbody ? tbody.hijos : []).filter((n) => n && n.tagName === 'TR');
};
const celdas = (tr) => tr.hijos.filter((n) => n && n.tagName === 'TD');
const clases = (tr) => celdas(tr).map((td) => String(td.className || '').trim());

async function pintar(nombreFn) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/invoices(\?|$)/.test(url) ? FACTURAS : /\/admin\/quotes(\?|$)/.test(url) ? PRESUPUESTOS : []),
  });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: el dashboard no carga entero en el banco.');
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, nombreFn);
  assert.equal(r.error, null, `🔴 CIEGO: ${nombreFn} revienta al montarse: ${r.error}`);
  const t = tabla(r.contenedor);
  assert.ok(filas(t).length > 0, `🔴 CIEGO: ${nombreFn} no pinta ninguna fila; sin filas no se compara nada.`);
  return { banco, contenedor: r.contenedor, t };
}

test('SCRUM-1787n · ① las cabeceras son las de presupuestos, en su orden, con el número de serie en lugar del ID', async () => {
  const pre = await pintar('renderQuotesListView');
  const fac = await pintar('renderInvoicesView');
  const cp = cabeceras(pre.t);
  const cf = cabeceras(fac.t);
  assert.equal(cp[0], 'ID', `🔴 CIEGO: la lista de presupuestos ya no empieza por «ID» (${cp.join(' · ')}): hay que re-decidir qué sustituye el número de serie.`);
  assert.equal(cf[0], '', `🔴 la primera columna de facturas debía ser la casilla del lote, sin rótulo: «${cf[0]}».`);
  assert.equal(cf[1], fac.banco.ctx.rotulosDelDocumento.columnaNumero(), `🔴 la columna del número no lleva su rótulo: «${cf[1]}».`);
  assert.deepEqual(cf.slice(2), cp.slice(1),
    `🔴 facturas: ${cf.slice(2).join(' · ')}\n   presupuestos: ${cp.slice(1).join(' · ')}`);
});

test('SCRUM-1787n · ② cada fila pinta sus celdas en el orden y con las clases de la de presupuestos', async () => {
  const pre = await pintar('renderQuotesListView');
  const fac = await pintar('renderInvoicesView');
  const referencia = clases(filas(pre.t)[0]);
  assert.equal(referencia[0], 'cell-id', `🔴 CIEGO: la primera celda del presupuesto no es la del número (${referencia[0]}).`);
  for (const tr of filas(fac.t)) {
    const c = clases(tr);
    assert.equal(c.length, cabeceras(fac.t).length, `🔴 ${c.length} celdas bajo ${cabeceras(fac.t).length} cabeceras.`);
    assert.equal(c[0], 'col-hide-mobile', `🔴 la casilla del lote ya no es la primera celda: ${c.join(' | ')}`);
    assert.deepEqual(c.slice(1), referencia,
      `🔴 facturas: ${c.slice(1).join(' | ')}\n   presupuestos: ${referencia.join(' | ')}`);
  }
});

test('SCRUM-1787n · ③ «Método» y «Fecha» dicen lo mismo que en presupuestos', async () => {
  const pre = await pintar('renderQuotesListView');
  const fac = await pintar('renderInvoicesView');
  const iMet = cabeceras(fac.t).indexOf('Método');
  const iFec = cabeceras(fac.t).indexOf('Fecha');
  assert.ok(iMet > 0 && iFec > 0, '🔴 CIEGO: faltan «Método» o «Fecha» en la cabecera de facturas.');
  const [pendiente, pagada] = filas(fac.t).sort((a, b) => texto(celdas(a)[1]).localeCompare(texto(celdas(b)[1]))).reverse();
  // Sin cobro, el mismo guion que el presupuesto sin método; cobrada, la etiqueta de la casa (la de la ficha).
  const sinMetodoPre = texto(celdas(filas(pre.t)[0])[cabeceras(pre.t).indexOf('Método')]);
  assert.equal(texto(celdas(pendiente)[iMet]), sinMetodoPre, '🔴 una factura sin cobrar no dice lo que dice un presupuesto sin método.');
  assert.equal(texto(celdas(pagada)[iMet]), fac.banco.ctx.etiquetaMetodoCobro('transfer'), '🔴 la cobrada no enseña su método.');
  // Misma fecha de creación → el mismo texto que la lista de presupuestos.
  const fechaPre = texto(celdas(filas(pre.t)[0])[cabeceras(pre.t).indexOf('Fecha')]);
  assert.ok(fechaPre.length > 0, '🔴 CIEGO: el presupuesto no pinta fecha.');
  assert.equal(texto(celdas(pendiente)[iFec]), fechaPre, '🔴 la fecha de la factura no tiene el formato de la de presupuestos.');
});

test('SCRUM-1787n · ④ control: la selección múltiple y «Ver detalle» siguen', async () => {
  const fac = await pintar('renderInvoicesView');
  const nodos = todos(fac.contenedor);
  const casillas = nodos.filter((n) => /\binv-row-check\b/.test(String(n.className || '')));
  assert.equal(casillas.length, 1, `🔴 la pendiente lleva casilla y la pagada no (scrum845): ${casillas.length}.`);
  assert.ok(nodos.some((n) => n.id === 'inv-check-all'), '🔴 falta «seleccionar todas».');
  assert.ok(nodos.some((n) => n.id === 'bulk-paid-btn'), '🔴 falta el botón del lote.');
  for (const tr of filas(fac.t)) {
    const b = todos(tr).filter((n) => n.tagName === 'BUTTON' && texto(n) === 'Ver detalle');
    assert.equal(b.length, 1, '🔴 una fila sin «Ver detalle».');
  }
});
