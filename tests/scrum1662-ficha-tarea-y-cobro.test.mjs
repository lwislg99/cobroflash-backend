// tests/scrum1662-ficha-tarea-y-cobro.test.mjs — SCRUM-1662 (d) y D1 · mitad de FRONT (S2)
//
// Sin gate: monta la ficha del Trabajo en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// (d) «Qué hay que hacer» (rótulo FIRMADO, c.21548): el GET ya devuelve `queHayQueHacer`; la ficha lo
//     pinta, al jefe y al operario. Sin tarea, no hay línea (cero textos nuevos).
// D1  (contexto SCRUM-1725 c.21713): el servidor manda al operario `totalCobrado`/`estadoCobro`
//     vacíos (SCRUM-1707, `trabajoParaElRol`). La ficha derivaba de ahí «Te falta por cobrar»,
//     «Cobrado» y la barra: con lo cobrado a 0, una cifra FALSA. El IMPORTE («Aceptado») se queda
//     (c.21547 Q1). Lista blanca: sólo el admin ve el cobro; un rol desconocido NO (SCRUM-147).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAREA = 'Cambiar el termostato 1662 (prueba)';

const linea = (n) => (n.dataset && n.dataset.linea) || (n.getAttribute && n.getAttribute('data-linea')) || null;
const clase = (n) => String((n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className) || '');

async function ficha(rol, extra) {
  const job = Object.assign({
    id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
    customer: { id: 5, name: 'Cliente Uno 1662' },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: null,
    quote: { currency: 'EUR', total: 500 }, direccion: null, invoices: [],
    queHayQueHacer: TAREA, totalAceptado: 500, totalCobrado: 200, estadoCobro: 'Parcial',
  }, extra || {});
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Taller' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = rol;
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta con rol ${rol} (${r.error && r.error.message})`);
  const n = todos(r.contenedor);
  const lineas = n.map(linea).filter(Boolean);
  assert.ok(lineas.includes('gastos'), `🔴 CIEGO: con rol ${rol} no se pintó el bloque «El trabajo» (líneas: ${JSON.stringify(lineas)})`);
  // El banco no agrega `textContent` de los hijos: se lee el rótulo de cada lado en su `<span>`.
  const lados = n.filter((x) => clase(x).split(/\s+/).includes('detail-dinero__lado'))
    .map((x) => todos(x).filter((h) => h !== x).map((h) => String(h.textContent || '')).filter(Boolean).join(' '));
  assert.ok(lados.length >= 1, `🔴 CIEGO: con rol ${rol} no se pintó la franja del importe`);
  return {
    lineas,
    lados,
    tareaPintada: n.some((x) => clase(x).includes('detail-tarea') && String(x.textContent || '') === TAREA),
    foco: n.some((x) => clase(x).split(/\s+/).includes('detail-dinero__rotulo')),
    barra: n.some((x) => clase(x).split(/\s+/).includes('detail-dinero__barra')),
  };
}

test('SCRUM-1662 (d) · CONTROL: el admin ve «Qué hay que hacer» con la tarea dentro', async () => {
  const a = await ficha('admin');
  assert.ok(a.lineas.includes('tarea') && a.tareaPintada, `🔴 al admin no se le pinta la tarea: ${JSON.stringify(a.lineas)}`);
});

test('SCRUM-1662 (d) · 🔴 el operario SÍ ve «Qué hay que hacer»', async () => {
  const t = await ficha('tecnico');
  assert.ok(t.lineas.includes('tarea') && t.tareaPintada, `🔴 al operario no se le pinta su tarea: ${JSON.stringify(t.lineas)}`);
});

test('SCRUM-1662 (d) · sin tarea no hay línea (cero textos nuevos)', async () => {
  const v = await ficha('admin', { queHayQueHacer: null });
  assert.ok(!v.lineas.includes('tarea'), `🔴 se pinta una línea de tarea vacía: ${JSON.stringify(v.lineas)}`);
  const b = await ficha('tecnico', { queHayQueHacer: '   ' });
  assert.ok(!b.lineas.includes('tarea'), '🔴 una tarea en blanco pinta línea');
});

test('SCRUM-1662 D1 · CONTROL: el admin conserva foco, Aceptado + Cobrado y la barra', async () => {
  const a = await ficha('admin');
  assert.ok(a.foco, '🔴 NO PUDE MIRAR: el admin no tiene «Te falta por cobrar»');
  assert.equal(a.lados.length, 2, `🔴 el admin perdió un lado: ${JSON.stringify(a.lados)}`);
  assert.ok(a.barra, '🔴 el admin perdió la barra de cobro');
});

for (const rol of ['tecnico', 'oficina']) {
  test(`SCRUM-1662 D1 · 🔴 «${rol}» ve el importe y NADA derivado de lo cobrado`, async () => {
    // Lo que manda el servidor de 1707 a quien no ve el cobro: lo cobrado VACÍO.
    const t = await ficha(rol, { totalCobrado: 0, estadoCobro: null });
    assert.ok(!t.foco, `🔴 «${rol}» ve «Te falta por cobrar»: una cifra falsa con lo cobrado vacío`);
    assert.ok(!t.barra, `🔴 «${rol}» ve la barra de cobro`);
    assert.equal(t.lados.length, 1, `🔴 «${rol}» ve más que el importe: ${JSON.stringify(t.lados)}`);
    assert.ok(/^Aceptado/.test(t.lados[0]), `🔴 «${rol}» perdió el IMPORTE (c.21547 Q1): ${JSON.stringify(t.lados)}`);
  });
}
