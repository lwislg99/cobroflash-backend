// tests/scrum1787b-ficha-de-factura-como-presupuesto.test.mjs — SCRUM-1787b
//
// LA FICHA DE FACTURA CON LA FORMA DE LA FICHA DEL PRESUPUESTO (decisión del fundador, SCRUM-1787
// c.22303; plan de construcción en c.22307).
//
//   ① el número de serie en el título, con PDF y Volver arriba, y SIN «Duplicar»;
//   ② la línea de progreso Emitida → Enviada → Cobrada (fin ANULADA / RECTIFICATIVA);
//   ③ «Siguiente paso» (lo que antes era «Acciones»), «Cliente» con NIF, y «Cobro»;
//   ④ los CONCEPTOS de la factura, con la numeración de apartados.
//
// Se EJECUTA la vista en el banco (`_banco-vistas.mjs`) y se mira lo que pinta el producto, no el
// fuente. Datos de EJEMPLO, ninguno real. «Dirección» NO se pinta: la factura no la guarda todavía
// (c.22304/c.22305, llega en 1787d).

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las mutaciones que este test tiene que cazar (catálogo de la casa, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Se pierde el paso «Enviada» de la línea de progreso.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "{ label: 'Enviada',",
    a: "{ label: 'Mandada',",
    cae: 'SCRUM-1787b · ② la línea de progreso pinta Emitida, Enviada y Cobrada, en ese orden',
  },
  {
    // La tabla de conceptos se construye pero no se cuelga de la ficha.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: 'concSec.appendChild(tablaConc);',
    a: 'void tablaConc;',
    cae: 'SCRUM-1787b · ④ los conceptos de la factura, con su numeración de apartado',
  },
];

const BASE = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 133.1, currency: 'EUR',
  createdAt: '2026-11-02T09:00:00.000Z',
  customerName: 'ZZCLIENTE Reformas Ejemplo', customerTaxId: 'B12345678',
  customerPhone: '+34600000000', customerEmail: 'cliente@ejemplo.test',
  customer: { id: 1, name: 'ZZCLIENTE ficha viva' },
  lines: [
    { apartado: true, concept: 'Baño' },
    { concept: 'ZZCONCEPTO alicatado', qty: 1, price: 100, tax: 0.21 },
    { concept: 'ZZCONCEPTO grifería', qty: 2, price: 5, tax: 0.21 },
  ],
  rectifiedBy: [],
});

async function montar(cambios = {}) {
  const factura = { ...BASE, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) });
  banco.ctx.apiRequest = async () => [];
  let menu = [];
  const original = banco.ctx.overflowMenu;
  banco.ctx.overflowMenu = (els, o) => { menu = els; return original(els, o); };
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha de factura revienta al abrirse: ${r.error && r.error.message}`);
  return { raiz: r.contenedor, nodos: todos(r.contenedor), menu };
}

// El banco NO agrega textContent (nota 4 de `_banco-vistas.mjs`): el texto de un subárbol se suma aquí.
const textoDe = (n) => [n.textContent || '', ...(n.hijos || []).map(textoDe)].join(' ').replace(/\s+/g, ' ').trim();
const conClase = (nodos, c) => nodos.filter((n) => String(n.className || '').split(/\s+/).includes(c));
const botones = (nodos) => nodos.filter((n) => n.tagName === 'BUTTON');
const porTexto = (lista, t) => lista.filter((b) => (b.textContent || '').trim() === t);

// El PDF NO sube a la cabecera en este tramo: cambiaría el censo de scrum283 y el microcopy que
// vigila scrum600d (decisión preguntada en SCRUM-1787). Se fija que sigue en «Siguiente paso».
test('SCRUM-1787b · ① el título lleva el número, Volver en la cabecera, PDF en «Siguiente paso», sin «Duplicar»', async () => {
  const { nodos } = await montar();
  const h2 = nodos.find((n) => n.tagName === 'H2');
  assert.ok(h2, '🔴 CIEGO: no hay h2 en la ficha.');
  assert.equal((h2.textContent || '').trim(), 'Factura F-2026-0007', `🔴 el título es «${h2.textContent}».`);
  const [cab] = conClase(nodos, 'detail-head-acciones');
  assert.ok(cab, '🔴 la cabecera no tiene su contenedor de acciones.');
  const enCab = botones(todos(cab)).map((b) => (b.textContent || '').trim());
  assert.deepEqual(enCab, ['← Volver a facturas'], `🔴 en la cabecera hay: ${enCab.join(' · ')}.`);
  const [sig] = conClase(nodos, 'detail-next');
  assert.equal(porTexto(botones(todos(sig)), 'Descargar PDF').length, 1, '🔴 «Descargar PDF» no está en «Siguiente paso».');
  assert.equal(botones(nodos).filter((b) => /duplicar/i.test(b.textContent || '')).length, 0, '🔴 la factura no lleva «Duplicar» (c.22303 ④).');
});

test('SCRUM-1787b · ① un justificante conserva su título', async () => {
  const { nodos } = await montar({ type: 'JUST', number: 'J-2026-0003' });
  const h2 = nodos.find((n) => n.tagName === 'H2');
  assert.equal((h2.textContent || '').trim(), 'Justificante de cobro J-2026-0003');
});

test('SCRUM-1787b · ② la línea de progreso pinta Emitida, Enviada y Cobrada, en ese orden', async () => {
  const { nodos } = await montar();
  const pasos = conClase(nodos, 'j1-prog-paso');
  const rotulos = pasos.map((p) => textoDe(conClase(todos(p), 'j1-prog-rotulo')[0] || { textContent: '' }));
  assert.deepEqual(rotulos, ['Emitida', 'Enviada', 'Cobrada'], `🔴 los pasos son: ${rotulos.join(' → ') || 'ninguno'}.`);
  const estados = pasos.map((p) => p.dataset && p.dataset.estado);
  assert.deepEqual(estados, ['hecho', 'actual', 'pendiente'], `🔴 estados en pending sin enviar: ${estados.join(',')}.`);
});

test('SCRUM-1787b · ② enviada por WhatsApp y cobrada: los tres pasos hechos', async () => {
  const { nodos } = await montar({ status: 'paid', paidAt: '2026-11-05T10:00:00.000Z', paidVia: 'bizum', waDelivery: { status: 'read' } });
  const estados = conClase(nodos, 'j1-prog-paso').map((p) => p.dataset.estado);
  assert.deepEqual(estados, ['hecho', 'hecho', 'hecho']);
});

test('SCRUM-1787b · ② anulada: el final es «ANULADA» y no hay «Marcar como cobrada»', async () => {
  const { nodos } = await montar({ status: 'annulled' });
  const rotulos = conClase(nodos, 'j1-prog-paso').map((p) => textoDe(conClase(todos(p), 'j1-prog-rotulo')[0]));
  assert.deepEqual(rotulos, ['Emitida', 'Enviada', 'ANULADA'], `🔴 ${rotulos.join(' → ')}`);
  assert.equal(porTexto(botones(nodos), 'Marcar como cobrada').length, 0);
});

test('SCRUM-1787b · ② rectificativa: el final es «RECTIFICATIVA»', async () => {
  const { nodos } = await montar({ type: 'R1' });
  const rotulos = conClase(nodos, 'j1-prog-paso').map((p) => textoDe(conClase(todos(p), 'j1-prog-rotulo')[0]));
  assert.equal(rotulos[2], 'RECTIFICATIVA', `🔴 ${rotulos.join(' → ')}`);
});

test('SCRUM-1787b · ③ «Siguiente paso», «Cliente» con NIF y «Cobro» en la ficha', async () => {
  const { nodos } = await montar({ status: 'paid', paidAt: '2026-11-05T10:00:00.000Z', paidVia: 'bizum' });
  const [sig] = conClase(nodos, 'detail-next-label');
  assert.ok(sig, '🔴 no hay bloque «Siguiente paso».');
  assert.equal((sig.textContent || '').trim(), 'Siguiente paso');
  const titulos = conClase(nodos, 'detail-section-title').map((n) => (n.textContent || '').trim());
  assert.ok(titulos.includes('Cliente') && titulos.includes('Cobro'), `🔴 títulos: ${titulos.join(' · ')}.`);
  assert.ok(!titulos.includes('Acciones') && !titulos.includes('Datos'), `🔴 quedan títulos viejos: ${titulos.join(' · ')}.`);
  const dts = nodos.filter((n) => n.tagName === 'DT').map((n) => (n.textContent || '').trim());
  for (const r of ['Cliente', 'NIF', 'Teléfono', 'Email', 'Método', 'Pagada']) {
    assert.ok(dts.includes(r), `🔴 falta la fila «${r}» (hay: ${dts.join(' · ')}).`);
  }
  assert.ok(!dts.includes('Dirección'), '🔴 «Dirección» no se pinta hasta 1787d.');
  const dds = nodos.filter((n) => n.tagName === 'DD').map((n) => (n.textContent || '').trim());
  assert.ok(dds.includes('B12345678'), '🔴 el NIF congelado no sale.');
  assert.ok(dds.includes('ZZCLIENTE Reformas Ejemplo'), '🔴 el nombre congelado no sale (regla de 1576b).');
});

test('SCRUM-1787b · ③ en pending, «Anular factura…» y la rectificativa siguen ahí (control positivo)', async () => {
  const { nodos, menu } = await montar();
  assert.equal(porTexto(botones(nodos), 'Anular factura…').length, 1);
  assert.equal(porTexto(menu, 'Emitir factura rectificativa').length, 1);
  assert.equal(conClase(nodos, 'detail-section-title').filter((n) => (n.textContent || '').trim() === 'Cobro').length, 0,
    '🔴 sin cobro, la columna «Cobro» no se pinta vacía.');
});

test('SCRUM-1787b · ④ los conceptos de la factura, con su numeración de apartado', async () => {
  const { nodos } = await montar();
  const tablas = nodos.filter((n) => n.tagName === 'TABLE');
  assert.equal(tablas.length, 1, `🔴 tablas en la ficha: ${tablas.length}.`);
  const txt = textoDe(tablas[0]);
  for (const t of ['ZZCONCEPTO alicatado', 'ZZCONCEPTO grifería', '1. Baño', '1.01', '1.02']) {
    assert.ok(txt.includes(t), `🔴 falta «${t}» en la tabla: ${txt.slice(0, 300)}`);
  }
});

test('SCRUM-1787b · ④ CIEGO: sin líneas no se pinta tabla (y el test lo dice, no pasa en vacío)', async () => {
  const { nodos } = await montar({ lines: [] });
  assert.equal(nodos.filter((n) => n.tagName === 'TABLE').length, 0);
  assert.ok(nodos.length > 20, '🔴 CIEGO: la ficha no pintó nada; el cero de tablas no mide.');
});
