// tests/scrum1142-irreversibles-factura-44.test.mjs — SCRUM-1142
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES ACCIONES IRREVERSIBLES DE LA FICHA DE FACTURA LLEVAN LA CLASE OPT-IN DE 44 PX.
//
// Hermano de SCRUM-786 (Borrar proveedor/plantilla, Emitir albarán): mismo patrón, clase opt-in
// `accion-irreversible-btn-44`, sin tocar `.btn-sm` ni `.overflow-item`. Aquí van:
//   · «Anular factura…»              — sección propia (`zona-anular`)
//   · «Anular factura» del modal     — el botón que CONFIRMA la anulación (`#anul-si`)
//   · «Emitir factura rectificativa» — que NO es un `btn-sm` en pantalla: su destino es
//     `overflow` en pending y paid (`invoiceActionsRegistry.js`), así que `ubicarAccion` le
//     REESCRIBE el className y `overflowMenu` lo convierte en `.overflow-item`. Por eso la clase
//     se añade DESPUÉS de `ubicarAccion`: puesta al crearlo, se la come la reescritura.
//
// PASO 0, medido en Edge con el árbitro del guard (`__areaDeToque`, elementsFromPoint), con la
// página pintada por el producto (`_banco-lista.mjs`):
//                                    390 px   929 px
//   «Anular factura…»                31       30,5
//   «Anular factura» (modal)         31       30,7
//   «Emitir factura rectificativa»   51,7     42      ← corto sólo en escritorio
//
// Se ejecuta la vista con el banco (mini-DOM) y se mira el botón QUE PINTA EL PRODUCTO, no el
// fuente. La altura resultante la resuelve la cascada en `scrum1167-irreversible-gana-la-cascada`
// para estas clases EXACTAS; aquí se fija que el producto pone exactamente ésas.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLASE = 'accion-irreversible-btn-44';

// `pending` es el estado con las tres: Anular sólo existe en pending, y Rectificar va al «⋯».
const FACTURA = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 121, currency: 'EUR',
  createdAt: '2026-09-01T09:00:00.000Z', customer: { id: 1, name: 'ZZCLIENTE prueba' },
  items: [], rectifiedBy: [],
});

async function montar() {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? FACTURA : []) });
  banco.ctx.apiRequest = async () => [];
  // Los ítems del «⋯» no cuelgan del contenedor hasta que se abre el menú: se capturan al pasar
  // por `overflowMenu`, que es quien les cambia la clase. La función original sigue corriendo.
  let menu = null;
  const original = banco.ctx.overflowMenu;
  banco.ctx.overflowMenu = (els, o) => { menu = els; return original(els, o); };
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha de factura revienta al abrirse: ${r.error && r.error.message}`);
  const botones = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON');
  return { banco, botones, menu: menu || [] };
}

// El ORDEN de las clases no es el contrato (`overflowMenu` quita y añade): se comparan conjuntos.
const clases = (c) => String(c).trim().split(/\s+/).sort();
const porTexto = (lista, texto) => lista.filter((b) => (b.textContent || '').trim() === texto);

test('SCRUM-1142 · SUELO: la ficha en pending pinta «Anular factura…» y el «⋯» con la rectificativa', async () => {
  const { botones, menu } = await montar();
  assert.equal(porTexto(botones, 'Anular factura…').length, 1, '🔴 CIEGO: no encuentro «Anular factura…».');
  assert.equal(porTexto(menu, 'Emitir factura rectificativa').length, 1,
    `🔴 CIEGO: «Emitir factura rectificativa» no pasa por el «⋯» (ítems: ${menu.map((b) => b.textContent).join(' · ') || 'ninguno'}).`);
  assert.ok(menu.length >= 2, '🔴 CIEGO: el «⋯» tiene un solo ítem; el control de hermanos no mide nada.');
});

test('SCRUM-1142 · ① «Anular factura…» lleva la clase de 44 px sobre sus clases de siempre', async () => {
  const { botones } = await montar();
  const [anular] = porTexto(botones, 'Anular factura…');
  assert.deepEqual(clases(anular.className), clases(`btn-secondary btn-sm ${CLASE}`),
    `🔴 «Anular factura…» tiene className "${anular.className}".`);
});

test('SCRUM-1142 · ② «Emitir factura rectificativa» conserva la clase DESPUÉS de ubicarAccion y de overflowMenu', async () => {
  const { menu } = await montar();
  const [rect] = porTexto(menu, 'Emitir factura rectificativa');
  assert.deepEqual(clases(rect.className), clases(`overflow-item ${CLASE}`),
    `🔴 la rectificativa sale del «⋯» con className "${rect.className}": o no se puso, o se puso antes de que ubicarAccion lo reescribiera.`);
});

test('SCRUM-1142 · ③ el «Anular factura» que CONFIRMA en el modal lleva la clase; «Cancelar» no', async () => {
  const { banco, botones } = await montar();
  porTexto(botones, 'Anular factura…')[0].disparar('click');
  const overlay = todos(banco.ctx.document.body).find((n) => n.className === 'modal-overlay');
  assert.ok(overlay, '🔴 CIEGO: pulsar «Anular factura…» no abre el modal.');
  const html = overlay._html || '';
  const si = html.match(/<button[^>]*id="anul-si"[^>]*>/);
  const no = html.match(/<button[^>]*id="anul-no"[^>]*>/);
  assert.ok(si && no, '🔴 CIEGO: el modal no tiene #anul-si y #anul-no.');
  assert.match(si[0], new RegExp(`class="btn-danger btn-sm ${CLASE}"`), `🔴 #anul-si es ${si[0]}`);
  assert.doesNotMatch(no[0], new RegExp(CLASE), `🔴 CONTROL: «Cancelar» del modal también lleva la clase: ${no[0]}`);
});

test('SCRUM-1142 · CONTROL: ninguna acción NO irreversible de la ficha lleva la clase', async () => {
  const { botones, menu } = await montar();
  const otros = [...botones, ...menu].filter((b) => !['Anular factura…', 'Emitir factura rectificativa'].includes((b.textContent || '').trim()));
  assert.ok(otros.length >= 5, `🔴 CIEGO: sólo ${otros.length} acciones hermanas que mirar.`);
  for (const b of otros) {
    assert.ok(!String(b.className).includes(CLASE), `🔴 «${(b.textContent || '').trim()}» (no irreversible) lleva la clase.`);
  }
});
