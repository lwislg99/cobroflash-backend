// SCRUM-1576 · reproducción POR LA RUTA MONTADA: la ficha cambia DESPUÉS del documento, ¿qué sale?
//
// Uso (con dist/ compilado):  node docs/master/evidencias/SCRUM-1576/reproducir.mjs
//
// No es un test: es una SONDA que imprime, por cada lector, lo que sale con la ficha del día del
// documento y con la ficha corregida. Arranca `dist/app.js` entero con el banco de SCRUM-597
// (`tests/_banco-camino-real.mjs`) y pide cada ruta con la cookie del propietario. El doble
// RESPETA `select` e `include`: un lector que no pide las columnas congeladas no las recibe.
// Las columnas congeladas las escribe `congelarDesdeFicha` (la función de la casa), no la sonda.
//
// Cada caso declara su CONTROL: con la ficha sin cambiar, lo que sale tiene que ser lo del día
// del documento (si no, la sonda no mide nada y lo dice: CIEGO).
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from '../../../../tests/_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
const MIO = 1576;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const { congelarDesdeFicha } = require('../../../../dist/modules/invoicing/domain/clienteCongelado.js');

const DIA = new Date('2026-08-10T10:00:00.000Z');
const FICHA_DIA = { id: 10, merchantId: MIO, name: 'Fusionado', legalName: 'Fusionado SL', taxId: 'B11111111', email: 'antes@x.test', phone: '+34600000001' };
const FICHA_HOY = { ...FICHA_DIA, name: 'Principal', legalName: 'Principal SA', taxId: 'B22222222', email: 'hoy@x.test', phone: '+34600000002' };

function proyectar(fila, sel) {
  if (!sel) return { ...fila };
  return Object.fromEntries(Object.keys(sel).filter((k) => sel[k] && k in fila).map((k) => [k, fila[k]]));
}
/** Aplica `include`/`select` de UNA relación `customer`/`provider` sobre la fila. */
function conRelacion(fila, args, rel, ficha) {
  const out = proyectar(fila, args?.select);
  const pide = args?.include?.[rel] ?? args?.select?.[rel];
  if (pide) out[rel] = pide === true ? { ...ficha } : proyectar(ficha, pide.select);
  return out;
}

const resultados = [];
async function caso(nombre, { programar, ruta, extraer, esperadoDia }) {
  const salida = {};
  for (const [etiqueta, ficha] of [['dia', FICHA_DIA], ['hoy', FICHA_HOY]]) {
    bancoDePrisma().programar({ authSession: ses.tabla, merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', taxId: 'B00000000', flags: null }) }, ...programar(ficha) });
    const r = await app.pedir(ruta, { token: ses.PROPIETARIO });
    salida[etiqueta] = { status: r.status, valor: r.status === 200 ? extraer(r) : String(r.texto).slice(0, 160) };
  }
  const control = salida.dia.status === 200 && salida.dia.valor === esperadoDia;
  const veredicto = !control ? 'CIEGO' : salida.hoy.valor === esperadoDia ? 'LEE LO GUARDADO' : 'LEE EL VIVO';
  resultados.push({ nombre, ruta, ...salida, veredicto });
}

// ── 1 · /admin/exports/invoices.csv — factura EMITIDA con su cliente congelado ─────────────────
const facturaEmitida = { id: 1, merchantId: MIO, number: 'F-2026-0001', createdAt: DIA, paidAt: null, type: 'F1', status: 'pending', total: 121, currency: 'EUR', customerId: 10, lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }], vfHash: 'h1', ...congelarDesdeFicha(FICHA_DIA) };
await caso('exports/invoices.csv · columna «Cliente» de una factura emitida', {
  ruta: '/admin/exports/invoices.csv?from=2026-08-01&to=2026-08-31',
  programar: (ficha) => ({
    invoice: { findMany: async (a) => [conRelacion(facturaEmitida, a, 'customer', ficha)] },
    auditLog: { create: async () => ({}) },
  }),
  extraer: (r) => r.texto.replace(/^﻿/, '').split(/\r?\n/)[1]?.split(/[;,]/)[2]?.replace(/"/g, ''),
  esperadoDia: 'Fusionado',
});

// ── 2 · /admin/invoices — la lista del panel. La API manda LAS DOS cosas (la factura va sin
// `select`); lo que pinta la pantalla es `inv.customer.name` (`public/dashboard/js/invoicesView.js:652`,
// y el detalle `invoiceDetailView.js:225`). La sonda extrae ESO, y declara que el congelado viajaba.
await caso('admin/invoices · lo que pinta la columna «Cliente» (inv.customer.name)', {
  ruta: '/admin/invoices',
  programar: (ficha) => ({ invoice: { findMany: async (a) => [conRelacion(facturaEmitida, a, 'customer', ficha)] } }),
  extraer: (r) => {
    const f = (Array.isArray(r.json) ? r.json : r.json?.invoices ?? [])[0];
    return f ? `${f.customer?.name}` + (f.customerName ? ` (customerName en la respuesta: ${f.customerName})` : ' (sin customerName)') : 'sin filas';
  },
  esperadoDia: 'Fusionado (customerName en la respuesta: Fusionado)',
});

// ── 3 · /admin/search — el buscador: la factura se pinta con `customer.name` del `select`.
await caso('admin/search · nombre del cliente de una factura emitida', {
  ruta: '/admin/search?q=F-2026',
  programar: (ficha) => ({
    customer: { findMany: async () => [] },
    quote: { findMany: async () => [] },
    invoice: { findMany: async (a) => [conRelacion(facturaEmitida, a, 'customer', ficha)] },
  }),
  extraer: (r) => `${r.json?.invoices?.[0]?.customer?.name}`,
  esperadoDia: 'Fusionado',
});

for (const x of resultados) {
  console.log(`${x.veredicto}\t${x.nombre}\t${x.ruta}\n\tficha del día → ${x.dia.status} «${x.dia.valor}»\n\tficha de hoy  → ${x.hoy.status} «${x.hoy.valor}»`);
}
console.log(`POBLACIÓN: ${resultados.length} casos · LEE EL VIVO ${resultados.filter((x) => x.veredicto === 'LEE EL VIVO').length} · LEE LO GUARDADO ${resultados.filter((x) => x.veredicto === 'LEE LO GUARDADO').length} · CIEGO ${resultados.filter((x) => x.veredicto === 'CIEGO').length}`);
console.log(`ESCRITURAS en el banco: ${JSON.stringify(bancoDePrisma().escrituras?.map((e) => e.modelo + '.' + e.op) ?? 'n/d')}`);
await app.cerrar();
