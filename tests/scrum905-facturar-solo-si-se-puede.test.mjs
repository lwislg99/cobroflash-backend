// tests/scrum905-facturar-solo-si-se-puede.test.mjs — SCRUM-905
//
// LO QUE SCRUM-895 (#1406) DEJÓ, MEDIDO CON EL DASHBOARD ENTERO SOBRE `b0650ac3` (17-sep-2026):
//
//   ① modo justificante (`receipt`) + albarán VALORADO con pendiente: el detalle y la fila del Trabajo
//     ofrecen «Facturar lo entregado». Lleva a la hoja de `facturar-parcial`, que responde 409 en ese
//     modo antes de hacer nada. Es el botón de 895 en otro sitio.
//   ② modo desconocido (`appModoEmision` null): se ofrece convertir en factura.
//   ③ la fila del Trabajo pinta el id crudo «btnConvertirFactura» (demo, fiscal y desconocido).
//
// DECIDIDO (ticket): un botón que no puede funcionar en ese modo NO se ofrece; con el modo
// desconocido, nada; un id interno nunca se ve.
//
// Se pintan las pantallas de verdad —`renderAlbaranDetailView` y `renderJobDetailView`— con los
// scripts de `index.html` en su orden; no se mira el resolutor suelto, porque 895 ya demostró que
// el resolutor puede estar bien y la pantalla no.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const VALORADO = {
  id: 11, numero: 'AB260011', estado: 'firmado', modoValoracion: 'VALORADO', estadoFacturacion: 'parcial',
  quote: null, invoiceId: null, job: { id: 1 }, lineas: [{ concepto: 'Tubería', cantidad: 2, precio: 10 }],
};
const SIN_VALORAR = {
  id: 12, numero: 'AB260012', estado: 'firmado', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'sin_facturar',
  quote: { id: 1878 }, invoiceId: null, job: { id: 1 }, lineas: [],
};
const TRABAJO = {
  id: 1, titulo: 'Reforma baño', status: 'en_curso', customer: { id: 5, name: 'Ana Ruiz' }, customerId: 5,
  // OPERACIONES_SUELTAS + un VALORADO firmado sin facturar: «Consolidar en factura» es elegible.
  tipoOperacion: 'OPERACIONES_SUELTAS',
  quotes: [], invoices: [], albaranes: [VALORADO, SIN_VALORAR],
};

function red(conversion) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url, o) => {
      const u = String(url);
      if (o && o.method === 'POST' && u.includes('/convertir-en-factura') && conversion) return conversion;
      if (u.includes('/admin/albaranes/11')) return resp(200, VALORADO);
      if (u.includes('/admin/albaranes/12')) return resp(200, SIN_VALORAR);
      if (u.includes('/admin/jobs/1')) return resp(200, TRABAJO);
      return resp(200, {});
    },
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

/** Visible = ni él ni ningún antecesor con `display: none`. */
const visible = (n) => { for (let x = n; x; x = x._padre) { if (x.style && x.style.display === 'none') return false; } return true; };

/** Las pantallas con un modo de emisión. `detalle` = `data-accion`; `textosDetalle` y `fila` = textos VISIBLES. */
async function pantallas(modo) {
  const banco = cargarDashboard(RAIZ, { red: red() });
  banco.ctx.appModoEmision = modo;
  const detalle = {};
  const textosDetalle = {};
  for (const alb of [VALORADO, SIN_VALORAR]) {
    const v = await pintarVista(banco, 'renderAlbaranDetailView', alb.id);
    assert.ok(!v.error, `🔴 SUELO: el detalle de ${alb.numero} no se pinta: ${v.error && v.error.message}`);
    const bs = todos(v.contenedor).filter((n) => n.tagName === 'BUTTON' && visible(n));
    detalle[alb.modoValoracion] = bs.map((b) => b.dataset.accion).filter(Boolean);
    textosDetalle[alb.modoValoracion] = Object.fromEntries(bs.filter((b) => b.dataset.accion).map((b) => [b.dataset.accion, String(b.textContent)]));
  }
  const t = await pintarVista(banco, 'renderJobDetailView', TRABAJO.id);
  assert.ok(!t.error, `🔴 SUELO: la ficha del Trabajo no se pinta: ${t.error && t.error.message}`);
  const fila = todos(t.contenedor).filter((n) => n.tagName === 'BUTTON' && visible(n)).map((b) => String(b.textContent));
  return {
    detalle, textosDetalle, fila,
    // `ROTULOS_ALBARAN` es un `const` de script: vive en el ámbito léxico del contexto, no en `window`.
    rotuloFacturar: vm.runInContext("typeof ROTULOS_ALBARAN !== 'undefined' ? ROTULOS_ALBARAN.btnFacturar : undefined", banco.ctx),
    ids: (banco.ctx.ALBARAN_ACTION_REGISTRY || []).map((a) => a.id),
  };
}

// ═══ SUELO · el banco ve las pantallas y distingue ═══════════════════════════════════════════

test('SCRUM-905 · SUELO: con `fiscal` las dos pantallas pintan facturar (el banco ve lo que mide)', async () => {
  const p = await pantallas('fiscal');
  assert.ok(p.detalle.VALORADO.includes('btnPdf'), '🔴 SUELO: el detalle no pinta ni «Descargar PDF»');
  assert.ok(p.detalle.VALORADO.includes('btnFacturar'), '🔴 SUELO: en fiscal el detalle VALORADO no ofrece facturar');
  assert.ok(p.detalle.SIN_VALORAR.includes('btnConvertirFactura'), '🔴 SUELO: en fiscal el detalle SIN_VALORAR no ofrece convertir');
  assert.ok(typeof p.rotuloFacturar === 'string' && p.fila.includes(p.rotuloFacturar),
    '🔴 SUELO: en fiscal la fila del Trabajo no pinta «Facturar lo entregado»: el «no está» de abajo no probaría nada. Fila: ' + JSON.stringify(p.fila));
  assert.ok(p.ids.length > 5, '🔴 SUELO: el registro de acciones no se ha cargado');
});

// ═══ ① receipt: facturar lo entregado no se ofrece ════════════════════════════════════════════

test('SCRUM-905 · 🔴 ① con `receipt` el albarán VALORADO no ofrece «Facturar lo entregado» (409 seguro)', async () => {
  const p = await pantallas('receipt');
  assert.ok(!p.detalle.VALORADO.includes('btnFacturar'),
    '🔴 con INVOICING_ES_ENABLED apagado el detalle del albarán VALORADO sigue ofreciendo facturar; la hoja llama a\n' +
    '  `facturar-parcial`, que responde 409 en este modo. Botones: ' + JSON.stringify(p.detalle.VALORADO));
  assert.ok(!p.fila.includes(p.rotuloFacturar),
    '🔴 la fila del Trabajo ofrece «Facturar lo entregado» en modo justificante. Fila: ' + JSON.stringify(p.fila));
  assert.ok(p.detalle.VALORADO.includes('btnPdf') && p.detalle.VALORADO.includes('btnWhatsApp'),
    '🔴 se ha escondido de más: PDF y WhatsApp funcionan con el flag apagado');
});

// ═══ ② modo desconocido: nada de facturar ═══════════════════════════════════════════════════

for (const modo of [null, undefined, 'fiscalish']) {
  test(`SCRUM-905 · 🔴 ② con el modo DESCONOCIDO (${String(modo)}) no se ofrece facturar en ninguna pantalla`, async () => {
    const p = await pantallas(modo);
    assert.ok(!p.detalle.VALORADO.includes('btnFacturar'), `🔴 modo ${String(modo)}: el detalle VALORADO ofrece facturar`);
    assert.ok(!p.detalle.SIN_VALORAR.includes('btnConvertirFactura'), `🔴 modo ${String(modo)}: el detalle SIN_VALORAR ofrece convertir en factura`);
    assert.ok(!p.fila.includes(p.rotuloFacturar), `🔴 modo ${String(modo)}: la fila ofrece «Facturar lo entregado»`);
  });
}

// ═══ ③ un id interno nunca se ve ═════════════════════════════════════════════════════════════

for (const modo of ['fiscal', 'demo', 'receipt', null]) {
  test(`SCRUM-905 · 🔴 ③ la fila del Trabajo no pinta un id de acción ni un marcador (${String(modo)})`, async () => {
    const p = await pantallas(modo);
    const crudos = p.fila.filter((t) => p.ids.includes(t.trim()));
    assert.deepEqual(crudos, [], `🔴 la fila pinta el identificador interno de una acción: ${JSON.stringify(crudos)}`);
    const marcadores = p.fila.filter((t) => t.includes('[PENDIENTE'));
    assert.deepEqual(marcadores, [], `🔴 la fila pinta un marcador de microcopy: ${JSON.stringify(marcadores)}`);
  });
}

// ═══ POSITIVO · demo conserva facturar ════════════════════════════════════════════════════════

test('SCRUM-905 · ✅ con `demo` el detalle sigue ofreciendo facturar y convertir', async () => {
  const p = await pantallas('demo');
  assert.ok(p.detalle.VALORADO.includes('btnFacturar'), '🔴 en demo desaparece «Facturar lo entregado»: se esconde de más');
  assert.ok(p.detalle.SIN_VALORAR.includes('btnConvertirFactura'), '🔴 en demo desaparece convertir en factura: se esconde de más');
});

// ═══ ④ consolidar en factura: tampoco se ofrece donde no puede funcionar (orquestador, 17-sep) ════
//
// `POST /admin/jobs/:id/consolidar-albaranes` responde 409 `consolidacion_no_disponible` en `receipt`
// antes de hacer nada (albaranes.routes.ts). Mismo defecto, misma decisión.

const CONSOLIDAR = '🧾 Consolidar en factura';

test('SCRUM-905 · SUELO: con `fiscal` la ficha ofrece «Consolidar en factura» (el banco ve el botón)', async () => {
  const p = await pantallas('fiscal');
  assert.ok(p.fila.includes(CONSOLIDAR), '🔴 SUELO: con fiscal y un VALORADO elegible no sale consolidar. Fila: ' + JSON.stringify(p.fila));
});

for (const modo of ['receipt', null]) {
  test(`SCRUM-905 · 🔴 ④ con el modo ${String(modo)} la ficha NO ofrece «Consolidar en factura»`, async () => {
    const p = await pantallas(modo);
    assert.ok(!p.fila.includes(CONSOLIDAR),
      `🔴 modo ${String(modo)}: se ofrece consolidar y la ruta responde 409 consolidacion_no_disponible. Fila: ${JSON.stringify(p.fila)}`);
  });
}

// ═══ ⑤ literales firmados (SCRUM-905 comentario 15696) ═══════════════════════════════════════

test('SCRUM-905 · 🔴 ⑤ L1: «Convertir en factura» en el botón del detalle y en la fila', async () => {
  for (const modo of ['fiscal', 'demo']) {
    const p = await pantallas(modo);
    assert.equal(p.textosDetalle.SIN_VALORAR.btnConvertirFactura, 'Convertir en factura',
      `🔴 ${modo}: el botón de convertir del detalle dice ${JSON.stringify(p.textosDetalle.SIN_VALORAR.btnConvertirFactura)}`);
    assert.ok(p.fila.includes('Convertir en factura'), `🔴 ${modo}: la fila no ofrece «Convertir en factura». Fila: ${JSON.stringify(p.fila)}`);
  }
});

test('SCRUM-905 · 🔴 ⑤ L2: mientras convierte, la franja dice «Convirtiendo…» y no el marcador', async () => {
  let soltar;
  const pendiente = new Promise((res) => { soltar = res; });
  const banco = cargarDashboard(RAIZ, { red: red(pendiente) });
  banco.ctx.appModoEmision = 'demo';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', SIN_VALORAR.id);
  const b = todos(v.contenedor).find((n) => n.tagName === 'BUTTON' && n.dataset.accion === 'btnConvertirFactura');
  assert.ok(b && typeof b.click === 'function', '🔴 SUELO: no hay botón de convertir que pulsar');
  b.click();
  const franja = todos(v.contenedor).find((n) => String(n.className || '').includes('alb-status'));
  assert.ok(franja, '🔴 SUELO: al pulsar no aparece ninguna franja de estado');
  assert.equal(String(franja.textContent), 'Convirtiendo…', '🔴 la franja mientras convierte dice ' + JSON.stringify(franja.textContent));
  soltar({ ok: false, status: 500, statusText: '500', headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '{}', blob: async () => ({}) });
});
