// SCRUM-1165 · «⬇ VeriFactu XML» EN INFORMES ERA UN CLAIM FISCAL PARA TODOS LOS MERCHANTS.
//
// El botón, titulado «Registro de facturación RRSIF del año (España, RD 1007/2023)», se pintaba a
// todo el mundo. Con `INVOICING_ES_ENABLED` en OFF —todos los merchants españoles reales, antes de
// SIF-1— el servidor contesta 404 a `/admin/exports/verifactu.xml` (SCRUM-73): la pantalla afirmaba
// algo que el producto no hace (reglas 7/17/26). Se OCULTA fuera del modo `fiscal`; no se reescribe.
//
// Se mide EL VIAJE, no el gesto: merchant → el veredicto del SERVIDOR (`modoEmisionVisible`, de
// `dist`) → la derivación REAL de `app.js` (la sentencia que asigna `window.appModoEmision`,
// ejecutada, no copiada) → `renderReportsView` montada en el banco → ¿está el botón en el DOM?
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { modoEmisionVisible } from '../dist/modules/invoicing/domain/modoVisible.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ⚠️ `id` REAL: `isDemoMerchant` es `id === 1` o `demo@yaqu.app` (ver scrum298).
const ES_REAL = { id: 7, email: 'pro@fontaneria.es', country: 'ES', flags: null };
const ES_CON_FLAG = { ...ES_REAL, flags: { INVOICING_ES_ENABLED: true } };
const DEMO = { id: 1, email: 'demo@yaqu.app', country: 'ES', flags: null };

/** La sentencia de `app.js` que convierte `me.modoEmision` en `window.appModoEmision`, tal cual. */
function derivacionDeApp() {
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const m = app.match(/window\.appModoEmision\s*=[^;]+;/);
  assert.ok(m, '🔴 CIEGO: `app.js` ya no asigna `window.appModoEmision`; este test no sabría qué modo llega a Informes');
  return m[0];
}

const PL_VACIO = {
  months: Array.from({ length: 12 }, (_, i) => ({ label: String(i), revenue: 0, expenses: 0, profit: 0 })),
  totals: { revenue: 0, expenses: 0, profit: 0, maintenance: 0 },
  prevYear: { revenue: 0, expenses: 0, profit: 0 }, currency: 'EUR', byEmployee: [],
};
const datos = (url) => {
  const u = String(url);
  if (/\/admin\/reports\/pl\?/.test(u)) return PL_VACIO;
  if (/\/admin\/reports\/x2\?/.test(u)) return { paymentMethods: [], reminderSavings: null, agingBuckets: [] };
  if (/\/admin\/libros\/recibidas\.json\?/.test(u)) return { filas: [], miradas: 0, avisos: [], desde: '2026-04-01', hasta: '2026-06-30' };
  return {};
};

async function informesDe(merchant) {
  const me = { modoEmision: modoEmisionVisible(merchant) };
  const banco = cargarDashboard(RAIZ, { datos });
  vm.runInContext(`(function (me) { ${derivacionDeApp()} })`, banco.ctx)(me);
  const r = await pintarVista(banco, 'renderReportsView');
  assert.equal(r.error, null, `🔴 SUELO: Informes no monta: ${r.error && r.error.message}`);
  const botones = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON');
  // Control de ceguera: los otros botones de exportar SÍ tienen que estar, o «no está» no dice nada.
  assert.ok(botones.length >= 3, `🔴 CIEGO: Informes pinta ${botones.length} botones; la fila de exportar no se montó`);
  const vf = botones.find((n) => /VeriFactu XML/.test(String(n._html || n.textContent || '')));
  return { modo: banco.ctx.appModoEmision, vf };
}

test('SCRUM-1165 · 🔴 un merchant español real (receipt) NO ve «⬇ VeriFactu XML»', async () => {
  const { modo, vf } = await informesDe(ES_REAL);
  assert.equal(modo, 'receipt', 'SUELO: el viaje no llegó en modo receipt');
  assert.equal(Boolean(vf), false, '🔴 Informes enseña el registro RRSIF (RD 1007/2023) a quien no puede emitirlo: el servidor le daría 404');
});

test('SCRUM-1165 · 🔴 el demo tampoco lo ve (cero claims fiscales hasta SIF-1)', async () => {
  const { modo, vf } = await informesDe(DEMO);
  assert.equal(modo, 'demo');
  assert.equal(Boolean(vf), false, '🔴 el demo enseña el registro RRSIF');
});

test('SCRUM-1165 · CONTROL POSITIVO: con el interruptor encendido (fiscal) el botón SÍ está, con su título', async () => {
  const { modo, vf } = await informesDe(ES_CON_FLAG);
  assert.equal(modo, 'fiscal');
  assert.ok(Boolean(vf), '🔴 en modo fiscal el botón ha desaparecido: ocultarlo no era borrarlo');
  assert.match(String(vf.title || ''), /RD 1007\/2023/, 'el texto no se reescribe: sigue siendo el mismo botón');
});

test('SCRUM-1165 · falla cerrado: sin modo (`/admin/me` sin el campo) no se enseña', async () => {
  const banco = cargarDashboard(RAIZ, { datos });
  vm.runInContext(`(function (me) { ${derivacionDeApp()} })`, banco.ctx)({});
  assert.equal(banco.ctx.appModoEmision, null);
  const r = await pintarVista(banco, 'renderReportsView');
  assert.equal(r.error, null);
  const vf = todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && /VeriFactu XML/.test(String(n._html || n.textContent || '')));
  assert.equal(Boolean(vf), false, '🔴 con el modo desconocido se enseña el claim fiscal');
});
