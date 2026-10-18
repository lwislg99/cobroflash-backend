// tests/scrum1442b-la-cabecera-no-pinta-nan.test.mjs — SCRUM-1442 (la página pública; el PDF es de J1)
//
// 🔴 UNA CABECERA DE APARTADO SE PINTABA «NaN €» EN LA PÁGINA DONDE FIRMA EL CLIENTE.
//
// La cabecera (SCRUM-655) viaja sin `qty` ni `price`, y las dos tablas de `GET /pay/quote/:token`
// —la del presupuesto y la tarjeta de cada opción— calculaban `l.qty * l.price` sin mirar si salía
// un número. Medido por esta ruta antes del arreglo: «NaN €» en LAS DOS. El ticket sólo nombraba la
// tarjeta (alcanzable por API); la tabla del presupuesto la alcanza el editor completo del panel,
// que es quien crea los apartados.
//
// Vía decidida (orquestador, 18-oct-2026): la cabecera pinta su CONCEPTO y NO su importe, como la
// tabla del PDF. Sin texto nuevo. El gemelo del PDF (la tarjeta de opción del PDF) es de J1 y no
// está aquí.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El de `scrum1431`: la ruta REAL de `dist/` con `prisma.quote.findUnique` doblado. Se lee el HTML.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import { quoteDecisionLandingRouter } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
import { calcTotal } from '../dist/core/utils/utils.js';

const merchant = {
  id: 77, email: 'obra@ejemplo.es', flags: null, name: 'Electricidad', legalName: null, logoUrl: null,
  address: null, country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, timezone: 'Europe/Madrid',
};
// La cabecera TAL COMO LA GUARDA EL ESQUEMA: sin `qty` ni `price`, con `tax: 0` por defecto.
const CABECERA = { concept: 'Fase 1 · Desmontaje', tax: 0, apartado: true };
const NORMAL = { concept: 'Cuadro eléctrico', qty: 2, price: 50, tax: 0.21 };

async function pagina({ lines, tiers = null }) {
  const quote = {
    id: 9, quoteNumber: 1, currency: 'EUR', total: calcTotal(lines), status: 'sent',
    createdAt: new Date('2026-09-20T10:00:00Z'), validUntil: null, paymentTerms: 'FULL', customBillingPlan: null,
    discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, merchant, customer: { name: 'Cliente' },
    lines, tiers,
  };
  const original = prisma.quote.findUnique;
  const originalCount = prisma.quote.count;
  prisma.quote.findUnique = async () => quote;
  prisma.quote.count = async () => 0; // SCRUM-1302p: ninguna versión más reciente
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route?.path?.includes?.('/quote/:token'));
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /quote/:token');
  let html = '';
  const res = { setHeader() { return res; }, status() { return res; }, send(b) { html = String(b); return res; }, redirect() { return res; } };
  try { await capa.route.stack[0].handle({ params: { token: 'abcdef0123456789abcdef0123456789' }, query: {}, headers: {} }, res); }
  finally { prisma.quote.findUnique = original; prisma.quote.count = originalCount; }
  return html;
}

const tablaDelPresupuesto = (html) => {
  const t = html.split('class="lines-table"')[1];
  assert.ok(t, '🔴 CIEGO: la página no trae la tabla del presupuesto');
  return t.split('</table>')[0];
};
const tarjetas = (html) => {
  const t = html.split('id="tier-cards"')[1];
  assert.ok(t, '🔴 CIEGO: la página no trae tarjetas de opción');
  return t.split('id="tier-confirm"')[0];
};
const filaDe = (trozo, concepto) => {
  const i = trozo.indexOf(concepto);
  assert.ok(i >= 0, `🔴 la cabecera desapareció: «${concepto}» no está. Tiene que pintar su concepto, no esconderse`);
  return trozo.slice(i, trozo.indexOf(trozo.includes('</tr>') ? '</tr>' : '</div>', i));
};

test('SCRUM-1442 · CONTROL: una línea normal sigue pintando su importe neto, en las dos tablas', async () => {
  const html = await pagina({ lines: [NORMAL], tiers: [{ id: 't1', label: 'Opción A', lines: [NORMAL], total: calcTotal([NORMAL]) }] });
  assert.ok(tablaDelPresupuesto(html).includes('100,00'), '🔴 la tabla del presupuesto ya no pinta el neto de una línea normal');
  assert.ok(tarjetas(html).includes('100,00'), '🔴 la tarjeta ya no pinta el neto de una línea normal');
});

test('SCRUM-1442 · 🔴 la cabecera en la TABLA DEL PRESUPUESTO: su concepto, sin «NaN» ni «undefined»', async () => {
  const t = tablaDelPresupuesto(await pagina({ lines: [CABECERA, NORMAL] }));
  assert.ok(!t.includes('NaN'), '🔴 la tabla donde firma el cliente pinta «NaN» en la cabecera de apartado');
  assert.ok(!t.includes('undefined'), '🔴 la tabla pinta «undefined»');
  assert.ok(!filaDe(t, CABECERA.concept).includes('€'), '🔴 la cabecera pinta un importe: no tiene ninguno');
  assert.ok(t.includes('100,00'), '🔴 la línea de debajo de la cabecera perdió su importe');
});

test('SCRUM-1442 · 🔴 la cabecera en la TARJETA DE UNA OPCIÓN: su concepto, sin «NaN» ni «undefined»', async () => {
  const lines = [CABECERA, NORMAL];
  const t = tarjetas(await pagina({ lines: [NORMAL], tiers: [{ id: 't1', label: 'Opción A', lines, total: calcTotal(lines) }] }));
  assert.ok(!t.includes('NaN'), '🔴 la tarjeta de opción pinta «NaN» en la cabecera de apartado');
  assert.ok(!t.includes('undefined'), '🔴 la tarjeta pinta «undefined»');
  assert.ok(!filaDe(t, CABECERA.concept).includes('€'), '🔴 la cabecera pinta un importe: no tiene ninguno');
  assert.ok(t.includes('100,00'), '🔴 la línea normal de la opción perdió su importe');
});
