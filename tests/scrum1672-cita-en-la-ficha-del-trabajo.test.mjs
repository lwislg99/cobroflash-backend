// tests/scrum1672-cita-en-la-ficha-del-trabajo.test.mjs — SCRUM-1672 (S2, PILOTO-1)
//
// TRAS AGENDAR, LA FICHA DEL TRABAJO NO ENSEÑABA NI EL DÍA NI LA HORA DE LA CITA.
//
// `jobDetailView.js` pintaba en el subtítulo `fechaCorta(job.createdAt)` («· 10 nov») y `scheduledAt`
// no salía en ningún sitio de la ficha: el único día visible era el de ALTA y se leía como la cita.
// La lista de Trabajos sí la enseña (jobsView.js `jobRow`).
//
// Textos firmados (regla 39) en SCRUM-1656 c.21408, tanda c.21405 entradas 1 y 2:
//   · «Cita: jue 12 nov, 09:00» — cabecera, trabajo agendado
//   · «Abierto el 10 nov»       — subtítulo, fecha de alta
//
// Se mide el DOM RENDERIZADO: `renderJobDetailView` con el dashboard entero (banco de vistas).
// La hora se fija en Madrid: el dato del ticket es `scheduledAt: 2026-11-12T08:00:00.000Z` = 09:00.
process.env.TZ = 'Europe/Madrid';

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function trabajo(extra) {
  return {
    id: 79, status: 'agendado', createdAt: '2026-11-10T10:00:00.000Z', titulo: 'Cambio de grifo',
    customer: { id: 5, name: 'Cliente Uno' },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
    quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
    ...extra,
  };
}

async function cabecera(job) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Negocio QA' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);
  const n = todos(r.contenedor);
  const h2 = n.find((x) => String(x.tagName || '').toUpperCase() === 'H2');
  // Control de ceguera: si el título no sale, «no hay cita» no dice nada.
  assert.ok(h2 && /Cambio de grifo/.test(String(h2.textContent)), '🔴 CIEGO: la cabecera no se ha pintado');
  const visibles = n.filter((x) => String(x.tagName || '').toUpperCase() === 'P'
    && /\bdetail-sub\b/.test(String(x.className || ''))
    && !(x.style && x.style.display === 'none'));
  return visibles.map((x) => String(x.textContent));
}

test('SCRUM-1672 · 🔴 trabajo agendado: la cabecera enseña «Cita: jue 12 nov, 09:00»', async () => {
  const lineas = await cabecera(trabajo({ scheduledAt: '2026-11-12T08:00:00.000Z' }));
  assert.ok(lineas.includes('Cita: jue 12 nov, 09:00'),
    `🔴 la ficha no enseña la cita agendada. Líneas de la cabecera: ${JSON.stringify(lineas)}`);
});

test('SCRUM-1672 · 🔴 la fecha de alta lleva su rótulo «Abierto el 10 nov» y no va suelta', async () => {
  const lineas = await cabecera(trabajo({ scheduledAt: '2026-11-12T08:00:00.000Z' }));
  assert.ok(lineas.includes('Cliente Uno · Abierto el 10 nov'),
    `🔴 la fecha de alta sigue sin rótulo. Líneas: ${JSON.stringify(lineas)}`);
});

test('SCRUM-1672 · sin cita: no hay línea «Cita:» vacía ni inventada', async () => {
  const lineas = await cabecera(trabajo({ status: 'pendiente', scheduledAt: null }));
  assert.equal(lineas.filter((l) => /Cita/.test(l)).length, 0, `línea de cita sin cita: ${JSON.stringify(lineas)}`);
  assert.ok(lineas.includes('Cliente Uno · Abierto el 10 nov'));
});
