// SCRUM-1487b · EL RÓTULO DE LAS TRES OPCIONES DECÍA «Cotización» EN TODOS LOS PAÍSES, ESPAÑA INCLUIDA.
//
// La ficha de un presupuesto con opciones Básico/Estándar/Premium pinta, encima de las tres, un rótulo
// escrito a mano: «Cotización con 3 opciones». En España (y en Argentina) la palabra del documento es
// «Presupuesto»: la cabecera de esa misma ficha dice «Presupuesto #N» (SCRUM-1487) y el rótulo, dos
// líneas más abajo, «Cotización».
//
// El arreglo es el mecanismo, no la palabra: `window.appLocale.quote` («Presupuesto» o «Cotización»,
// con mayúscula), y el resto del rótulo no concuerda con ella. Cambiar la palabra a mano rompería
// México, Colombia, Perú y Chile, que sí dicen «Cotización».
//
// Se EJECUTA la ficha en el banco con el locale de cada caso; no se lee el fuente.
//
// LO QUE NO ENTRA: «Sin gastos asignados a esta cotización.», de la misma ficha. El demostrativo
// concuerda con la palabra («este presupuesto» / «esta cotización») y el locale no lo trae: no se
// compone, se pide (SCRUM-1476: frases enteras por país).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 206;
const CUANDO = '2026-10-14T16:00:00.000Z';

const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});
const vueltas = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const LOCALE_ES = { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteVerb: 'presupuesto', currency: 'EUR' };
const LOCALE_MX = { quote: 'Cotización', quotePlural: 'Cotizaciones', quoteVerb: 'cotización', currency: 'MXN' };

const presupuesto = (tiers) => ({
  id: ID, number: 5, quoteNumber: 5, revision: 0, numeroConRevision: 'P5', revisiones: [], vigenteId: ID,
  status: 'sent', total: '300.00', currency: 'EUR', payToken: 'tok1487b',
  lines: [{ concept: 'Punto de luz', qty: 1, price: 100, tax: 0 }],
  tiers, selectedTierId: null,
  createdAt: CUANDO, updatedAt: CUANDO,
  customer: { id: 3, name: 'Ana Ruiz', phone: null, email: null, notes: null },
  merchant: { id: 7, name: 'QA 1487b', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: null, evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});
const TRES = [
  { id: 'good', label: 'Básico', total: '100.00' },
  { id: 'better', label: 'Estándar', total: '200.00', recommended: true },
  { id: 'best', label: 'Premium', total: '300.00' },
];

// Los textos de la ficha CARGADA que hablan de «opciones».
async function rotulosDeOpciones(locale, tiers) {
  let pedidas = 0;
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'GET' && new RegExp(`/admin/quotes/${ID}$`).test(String(url))) { pedidas++; return respuesta(200, presupuesto(tiers)); }
    return respuesta(200, []);
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  banco.ctx.appLocale = locale;
  const v = await pintarVista(banco, 'renderQuoteDetailView', ID);
  assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
  await vueltas();
  assert.equal(pedidas, 1, '🔴 CIEGO: la ficha no ha pedido el presupuesto.');
  const h2 = todos(v.contenedor).filter((n) => n.tagName === 'H2').map((n) => n.textContent);
  assert.deepEqual(h2, [locale.quote + ' #5'], 'SUELO: la ficha no ha llegado a cargar');
  return todos(v.contenedor)
    .filter((n) => n.tagName === 'DIV' && !n.children?.length && /opciones/.test(n.textContent || ''))
    .map((n) => n.textContent.trim());
}

test('SCRUM-1487b · 🔴 en España, el rótulo de las tres opciones dice «Presupuesto», como la cabecera de la ficha', async () => {
  const r = await rotulosDeOpciones(LOCALE_ES, TRES);
  assert.deepEqual(r, ['Presupuesto con 3 opciones'],
    '🔴 con el locale de España, el rótulo de las opciones no dice «Presupuesto con 3 opciones»: la palabra está escrita a mano.');
});

test('SCRUM-1487b · CONTROL: en un país de «cotización» el rótulo sigue diciendo «Cotización con 3 opciones», igual que hoy', async () => {
  const r = await rotulosDeOpciones(LOCALE_MX, TRES);
  assert.deepEqual(r, ['Cotización con 3 opciones']);
});

test('SCRUM-1487b · CONTROL: sin opciones no hay rótulo (el instrumento no lo encuentra en cualquier ficha)', async () => {
  assert.deepEqual(await rotulosDeOpciones(LOCALE_ES, []), []);
});
