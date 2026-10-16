// tests/scrum1158c-inicio-informes-44px.test.mjs — SCRUM-1158c
//
// Sin gate: lee styles.css y monta Inicio e Informes en el banco. Ni BD, ni red, ni navegador.
//
// Con el banco que ya no pierde estilos (SCRUM-1158b) aparecieron 18 objetivos de toque de 30-31 px,
// a 929 y a 390: «⚙ Personalizar» y los «Ir →» de «Completa tu configuración» (Inicio) y los «1T-4T»
// de los dos bloques trimestrales (Informes). Se arreglan con reglas ACOTADAS (decisión de
// SCRUM-786, opción ③: nunca `.btn-sm` global). La ALTURA la mide `censo:tactil-panel` en navegador;
// este test, que sí corre en cada PR, vigila las dos mitades que la sostienen: que la regla exista
// con 44 px y que el producto siga pintando los botones DENTRO de lo que la regla nombra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };
const clases = (n) => String(n.className || '').split(/\s+/).filter(Boolean);
const esBtnSm = (n) => n.tagName === 'BUTTON' && clases(n).includes('btn-sm');

const PL_VACIO = {
  months: Array.from({ length: 12 }, (_, i) => ({ label: String(i), revenue: 0, expenses: 0, profit: 0 })),
  totals: { revenue: 0, expenses: 0, profit: 0, maintenance: 0 },
  prevYear: { revenue: 0, expenses: 0, profit: 0 },
  currency: 'EUR',
  byEmployee: [],
};
const datos = (url) => {
  const u = String(url || '');
  if (/\/admin\/reports\/pl\?/.test(u)) return PL_VACIO;
  if (u.includes('/admin/merchant')) return { id: 1, name: 'Fontanería Soler' };
  return [];
};

const reglas = () => fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('}')
  .map((b) => { const [sel, cuerpo = ''] = b.split('{'); return { sel: sel.split(',').map((s) => s.trim()), cuerpo }; });

test('SCRUM-1158c · las tres reglas acotadas existen con 44 px, y `.btn-sm` global sigue sin tocar', () => {
  const rs = reglas();
  const con = (s) => rs.filter((r) => r.sel.includes(s));
  for (const s of ['#btn-home-prefs', '.home-checklist .btn-sm', '#vat-quarter-row > .btn-sm', '#resumen-quarter-row > .btn-sm', '.informes-exportar > .btn-sm']) {
    assert.ok(con(s).some((r) => /min-height:\s*44px/.test(r.cuerpo)), `🔴 ${s} no tiene su min-height de 44 px en styles.css.`);
  }
  for (const s of ['.home-checklist .btn-sm', '#vat-quarter-row > .btn-sm', '#resumen-quarter-row > .btn-sm']) {
    assert.ok(con(s).some((r) => /min-width:\s*44px/.test(r.cuerpo)), `🔴 ${s} perdió el ancho de 44 px («Ir →» y «1T» son estrechos).`);
  }
  assert.ok(!con('.btn-sm').some((r) => /min-height:\s*44px/.test(r.cuerpo)),
    '🔴 alguien subió `.btn-sm` GLOBAL a 44 px: la decisión de SCRUM-786 es acotar, nunca global.');
});

test('SCRUM-1158c · Inicio pinta «⚙ Personalizar» y los «Ir →» DENTRO de lo que la regla nombra', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ, { datos, rol: 'admin' }), 'renderHomeView');
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: Inicio revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const nodos = todos(r.contenedor);
  assert.equal(nodos.filter((n) => n.id === 'btn-home-prefs').length, 1, '🔴 no está «⚙ Personalizar» con su id: la regla no le llega.');
  const lista = nodos.filter((n) => clases(n).includes('home-checklist'));
  assert.equal(lista.length, 1, '🔴 «Completa tu configuración» no lleva `.home-checklist`: sus «Ir →» vuelven a 30 px.');
  const ir = todos(lista[0]).filter(esBtnSm);
  assert.ok(ir.length > 0, '🔴 CIEGO: la lista de configuración no tiene ningún «Ir →» con estos datos; no mide nada.');
});

test('SCRUM-1158c · Informes pinta los «1T-4T» como hijos DIRECTOS de sus dos filas', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ, { datos, rol: 'admin' }), 'renderReportsView');
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: Informes revienta al montarse: ${r.error && r.error.message}`);
  await esperar();
  const nodos = todos(r.contenedor);
  for (const id of ['vat-quarter-row', 'resumen-quarter-row']) {
    const fila = nodos.filter((n) => n.id === id);
    assert.equal(fila.length, 1, `🔴 no está #${id}: la regla nombra un contenedor que ya no existe.`);
    const hijos = (fila[0].children || fila[0].childNodes || []).filter(esBtnSm);
    assert.deepEqual(hijos.map((b) => String(b.textContent).trim()), ['1T', '2T', '3T', '4T'],
      `🔴 los trimestres de #${id} no son hijos directos .btn-sm: el «>» de la regla no les llega.`);
  }
  // De paso: la fila de descargas. El censo en navegador NO la ve (el HTML serializado del banco la
  // pierde), así que aquí es el único sitio que vigila que sus enlaces sigan bajo la regla.
  const fila = nodos.filter((n) => clases(n).includes('informes-exportar'));
  assert.equal(fila.length, 1, '🔴 la fila de descargas no lleva `.informes-exportar`: sus botones vuelven a 30 px.');
  const enlaces = (fila[0].children || fila[0].childNodes || []).filter((n) => n.tagName === 'A' && clases(n).includes('btn-sm'));
  assert.ok(enlaces.length >= 5, `🔴 CIEGO: sólo ${enlaces.length} descargas .btn-sm como hijos directos de la fila (esperaba las 5 CSV).`);
});
