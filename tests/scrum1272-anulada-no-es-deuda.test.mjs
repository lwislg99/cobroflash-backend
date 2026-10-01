// tests/scrum1272-anulada-no-es-deuda.test.mjs — SCRUM-1272
//
// «X facturados sin cobrar» contaba como deuda TODA factura que no estuviera `paid`. Dos casos le
// decían al profesional que le deben dinero que no le deben:
//   · una factura ANULADA (queda `status: 'annulled'`),
//   · una factura RECTIFICADA con R1 (la R1 nace `paid` y negativa; la original sigue `pending`).
//
// Se mide el VIAJE: la ficha REAL del Trabajo (`renderJobDetailView`) montada en el banco con el
// detalle tal y como lo manda el servidor (`jobs.routes.ts`: status, type, total, rectifiesId), y se
// leen los huecos PINTADOS de «Lo que falta», no el valor de una función.
//
// R1 parcial: medido que NO existe hoy (una R1 niega la factura entera y solo cabe una por original,
// `invoicesAdmin.routes.ts`), así que no hay caso que probar.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const JOB_BASE = {
  id: 42, status: 'terminado', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
  customer: { id: 5, name: 'Cliente Uno', phone: null, mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
  quote: null, direccion: null, totalAceptado: 500, totalCobrado: 0,
};
const factura = (o) => ({ number: 'F-1', currency: 'EUR', createdAt: '2026-09-02T09:00:00Z', type: 'F1',
  rectifiesId: null, paidAt: null, chargeId: null, ...o });

/** Monta la ficha en modo FACTURA y devuelve { id del hueco → texto pintado }. */
async function huecosPintados(invoices) {
  const job = { ...JOB_BASE, invoices };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url) || /gastos/.test(url)) return [];
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  banco.ctx.window.appModoEmision = 'invoice'; // en `receipt` estos huecos se ocultan (SCRUM-1164)
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `SUELO: la ficha no monta (${r.error && r.error.message})`);
  await respirar(20);
  const out = {};
  for (const n of todos(banco.ctx.document.body)) {
    const id = n.dataset && n.dataset.hueco;
    if (id) out[id] = todos(n).map((x) => String(x.textContent || '')).join(' ');
  }
  return out;
}

test('SCRUM-1272 · CONTROL: una factura pendiente normal SÍ sale como «facturados sin cobrar»', async () => {
  const h = await huecosPintados([factura({ id: 1, total: 500, status: 'pending' })]);
  assert.ok(h['sin-cobrar'], `SUELO: el hueco no se pinta ni en el caso normal: ${JSON.stringify(h)}`);
  assert.match(h['sin-cobrar'], /500,00/);
  assert.equal(h['sin-facturar-nada'], undefined, 'con una factura viva, no está «sin facturar»');
});

test('SCRUM-1272 · 🔴 una factura ANULADA no es deuda', async () => {
  const h = await huecosPintados([factura({ id: 1, total: 500, status: 'annulled' })]);
  assert.equal(h['sin-cobrar'], undefined, `🔴 una anulada sale como «sin cobrar»: ${h['sin-cobrar']}`);
});

test('SCRUM-1272 · 🔴 una factura rectificada con R1 no es deuda', async () => {
  const h = await huecosPintados([
    factura({ id: 1, total: 500, status: 'pending' }),
    factura({ id: 2, number: 'R-1', type: 'R1', rectifiesId: 1, total: -500, status: 'paid' }),
  ]);
  assert.equal(h['sin-cobrar'], undefined, `🔴 una factura ya rectificada sale como «sin cobrar»: ${h['sin-cobrar']}`);
});

test('SCRUM-1272 · con la única factura anulada, el Trabajo vuelve a decir que está sin facturar', async () => {
  const h = await huecosPintados([factura({ id: 1, total: 500, status: 'annulled' })]);
  assert.ok(h['sin-facturar-nada'], `🔴 nada facturado de verdad, y la pantalla calla: ${JSON.stringify(h)}`);
  assert.match(h['sin-facturar-nada'], /500,00/);
});

test('SCRUM-1272 · CONTROL: pagada no sale, y la anulada no tapa a la viva de al lado', async () => {
  const pagada = await huecosPintados([factura({ id: 1, total: 500, status: 'paid' })]);
  assert.equal(pagada['sin-cobrar'], undefined);
  const mezcla = await huecosPintados([
    factura({ id: 1, total: 300, status: 'annulled' }),
    factura({ id: 3, number: 'F-2', total: 200, status: 'pending' }),
  ]);
  assert.match(mezcla['sin-cobrar'] || '', /200,00/, `🔴 la viva no sale sola: ${JSON.stringify(mezcla)}`);
});
