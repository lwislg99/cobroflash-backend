// tests/scrum1431-tarjeta-sin-claim-de-iva.test.mjs — SCRUM-1431
//
// 🔴 LA TARJETA DE CADA OPCIÓN DECÍA «IVA incluido» SIN CONDICIÓN.
//
// SCRUM-212 quitó esa afirmación del rótulo grande cuando no hay cuota («de `cuota === 0` no se
// deduce nada»). La tarjeta de opción se quedó atrás: con líneas sin impuesto pintaba «100,00 €» y
// debajo «IVA incluido». El guard de 212 no la ve, porque `renderTierCards` no se exporta.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La ruta REAL `GET /pay/quote/:token` de `dist/`, con `prisma.quote.findUnique` doblado (el arnés
// de `scrum1001`). No se exporta ni se toca nada de producción para medir: se lee el HTML que sale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import { quoteDecisionLandingRouter } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
import { calcTotal } from '../dist/core/utils/utils.js';

const merchant = {
  id: 77, email: 'obra@ejemplo.es', flags: null, name: 'Electricidad', legalName: null, logoUrl: null,
  address: null, country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, timezone: 'Europe/Madrid',
};
const opcion = (id, tax) => {
  const lines = [{ concept: `Cuadro ${id}`, qty: 1, price: 100, tax }];
  return { id, label: `Opción ${id}`, recommended: false, lines, total: calcTotal(lines) };
};

/** Las tarjetas de la página, una por opción, en el orden en que salen. */
async function tarjetas(tiers) {
  const quote = {
    id: 9, quoteNumber: 1, currency: 'EUR', total: tiers[0].total, status: 'sent',
    createdAt: new Date('2026-09-20T10:00:00Z'), validUntil: null, paymentTerms: 'FULL', customBillingPlan: null,
    discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, merchant, customer: { name: 'Cliente' },
    lines: tiers[0].lines, tiers,
  };
  const original = prisma.quote.findUnique;
  prisma.quote.findUnique = async () => quote;
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route?.path?.includes?.('/quote/:token'));
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /quote/:token');
  let html = '';
  const res = { setHeader() { return res; }, status() { return res; }, send(b) { html = String(b); return res; }, redirect() { return res; } };
  try { await capa.route.stack[0].handle({ params: { token: 'abcdef0123456789abcdef0123456789' }, query: {}, headers: {} }, res); }
  finally { prisma.quote.findUnique = original; }
  const trozos = html.split('<div class="tier-card').slice(1).map((t) => t.split('Elegir este plan')[0]);
  assert.equal(trozos.length, tiers.length, `🔴 CIEGO: esperaba ${tiers.length} tarjeta(s) y la página trae ${trozos.length}`);
  return trozos;
}

test('SCRUM-1431 · CONTROL: una opción CON cuota de IVA sigue diciendo «IVA incluido»', async () => {
  const [t] = await tarjetas([opcion('a', 0.21)]);
  assert.ok(t.includes('121,00'), '🔴 CIEGO: la tarjeta no trae el total con impuesto');
  assert.ok(t.includes('IVA incluido'), '🔴 con IVA de verdad debe decirse: no se arregla borrando el texto');
});

test('SCRUM-1431 · 🔴 una opción SIN cuota no afirma «IVA incluido»', async () => {
  const [t] = await tarjetas([opcion('a', 0)]);
  assert.ok(t.includes('100,00'), '🔴 CIEGO: la tarjeta no trae su total');
  assert.ok(!t.includes('IVA incluido'), '🔴 la tarjeta afirma «IVA incluido» sin que haya ningún IVA (SCRUM-212)');
});

test('SCRUM-1431 · cada tarjeta decide por SUS líneas, no por las de la opción de al lado', async () => {
  const [con, sin] = await tarjetas([opcion('a', 0.21), opcion('b', 0)]);
  assert.ok(con.includes('IVA incluido'));
  assert.ok(!sin.includes('IVA incluido'));
});
