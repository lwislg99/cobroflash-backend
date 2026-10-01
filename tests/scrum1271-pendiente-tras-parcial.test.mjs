// tests/scrum1271-pendiente-tras-parcial.test.mjs — SCRUM-1271, mitad de pantalla (S2)
//
// «X entregados sin facturar» sumaba el `totales.total` ENTERO de cada albarán firmado sin
// `invoiceId`, y la facturación PARCIAL no pone `invoiceId`: escribe el libro de líneas. Con 600 € de
// 1.000 € facturados, la ficha seguía diciendo «1.000,00 €», y lo seguía diciendo con todo facturado.
//
// Se mide el VIAJE: la ficha REAL del Trabajo (`renderJobDetailView`) en el banco, con el albarán tal
// y como lo manda el detalle del Trabajo (`estadoFacturacion`, `pendientes`, `totales`) más el campo que
// añade S1 (`importePendienteDeFacturar`), y se lee el hueco PINTADO.
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
  asignados: [], operario: null, gastos: [], notes: '', invoices: [],
  quote: null, direccion: null, totalAceptado: 1000, totalCobrado: 0,
};
/** Un albarán firmado de 1.000 € (VALORADO), con lo que diga el libro de líneas. */
const albaran = (o) => ({
  id: 7, numero: 'AB260001', estado: 'firmado', modoValoracion: 'VALORADO', facturado: false,
  lineas: [{ concepto: 'Mano de obra', cantidad: 10, unidad: 'h', precioUnitario: 100, tipoIva: 0 }],
  totales: { base: 1000, cuota: 0, total: 1000 },
  estadoFacturacion: 'sin_facturar', ...o,
});

async function huecos(albaranes) {
  const job = { ...JOB_BASE, albaranes };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url) || /gastos/.test(url)) return [];
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  banco.ctx.window.appModoEmision = 'invoice'; // en `receipt` este hueco se oculta (SCRUM-1164)
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

test('SCRUM-1271 · CONTROL: sin ninguna factura, sale el albarán entero', async () => {
  const h = await huecos([albaran({ importePendienteDeFacturar: 1000 })]);
  assert.match(h['sin-facturar'] || '', /1\.000,00/, `SUELO: el hueco no sale ni en el caso normal: ${JSON.stringify(h)}`);
});

test('SCRUM-1271 · 🔴 tras una parcial de 600 €, dice lo que QUEDA: 400,00 €', async () => {
  const h = await huecos([albaran({ estadoFacturacion: 'parcial', importePendienteDeFacturar: 400 })]);
  assert.match(h['sin-facturar'] || '', /400,00/, `🔴 no dice lo que queda: ${h['sin-facturar']}`);
  assert.doesNotMatch(h['sin-facturar'] || '', /1\.000,00/, '🔴 sigue contando el albarán ENTERO');
});

test('SCRUM-1271 · 🔴 con todo facturado en parciales, el hueco NO sale', async () => {
  const h = await huecos([albaran({ estadoFacturacion: 'facturado', importePendienteDeFacturar: 0 })]);
  assert.equal(h['sin-facturar'], undefined, `🔴 persigue una factura ya hecha: ${h['sin-facturar']}`);
});

test('SCRUM-1271 · un servidor que aún no manda el campo se comporta como antes (no pinta un cero)', async () => {
  const h = await huecos([albaran({})]);
  assert.match(h['sin-facturar'] || '', /1\.000,00/);
});
