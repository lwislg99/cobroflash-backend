// tests/scrum1163-whatsapp-cliente-solo-movil.test.mjs — SCRUM-1163
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN CLIENTE CON SÓLO MÓVIL PUEDE RECIBIR EL PRESUPUESTO POR WHATSAPP
//
// La ficha decidía con `!!quote.customer.phone`, y el móvil no viajaba: un cliente con sólo móvil
// salía con «📤 Enviar por WhatsApp» desactivado y «El cliente no tiene teléfono de WhatsApp
// configurado.» — falso. El envío ya resolvía el número (`canalDeWhatsApp`: móvil, y si no el fijo;
// `sendQuote.service.ts`). SCRUM-1166 hizo que el detalle diga `customer.tieneNumeroDeContacto`,
// calculado con la MISMA función que usa el envío; la pantalla lo usa y no decide por su cuenta.
//
// Contrato con los tres clientes de la aceptación, ficha MONTADA en el banco.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MENSAJE = 'El cliente no tiene teléfono de WhatsApp configurado.';

/** Un presupuesto en BORRADOR (el caso de «📤 Enviar por WhatsApp»), con el cliente que se diga. */
const presupuesto = (customer) => ({
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'draft', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer,
  merchant: { id: 7, name: 'QA 1163', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: null, evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});

// Lo que manda el servidor desde SCRUM-1166 (`quoteAdmin.ts`): `phone` y el booleano; el móvil NO
// viaja, a propósito. Números del rango IMPOSIBLE (34 + 0 + 8 dígitos): ningún envío llega a nadie.
const SOLO_MOVIL = { id: 3, name: 'Ana Ruiz', phone: null, email: null, notes: null, tieneNumeroDeContacto: true };
const SOLO_FIJO = { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null, tieneNumeroDeContacto: true };
const NINGUNO = { id: 3, name: 'Ana Ruiz', phone: null, email: null, notes: null, tieneNumeroDeContacto: false };

async function botonEnviar(customer) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? presupuesto(customer) : []),
  });
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const nodos = r.contenedor ? todos(r.contenedor) : [];
  assert.ok(nodos.length > 40, `🔴 CIEGO: la ficha montó ${nodos.length} nodos; no es la pantalla entera`);
  const b = nodos.filter((n) => n.tagName === 'BUTTON' && String(n.textContent || '').includes('Enviar por WhatsApp'));
  assert.equal(b.length, 1, `🔴 SUELO: esperaba un «📤 Enviar por WhatsApp» y hay ${b.length}.`);
  return b[0];
}

test('SCRUM-1163 · 🔴 cliente con SÓLO MÓVIL: el botón de WhatsApp está HABILITADO y sin el mensaje falso', async () => {
  const b = await botonEnviar(SOLO_MOVIL);
  assert.equal(Boolean(b.disabled), false, '🔴 un cliente con móvil sale como «sin teléfono»: el botón está desactivado.');
  assert.notEqual(b.title, MENSAJE, '🔴 el título afirma que no hay teléfono, y lo hay.');
});

test('SCRUM-1163 · cliente con SÓLO FIJO: el botón está habilitado (control positivo: como hoy)', async () => {
  const b = await botonEnviar(SOLO_FIJO);
  assert.equal(Boolean(b.disabled), false);
});

test('SCRUM-1163 · cliente SIN NINGÚN número: el botón está desactivado con su mensaje (control negativo: entonces es verdad)', async () => {
  const b = await botonEnviar(NINGUNO);
  assert.equal(Boolean(b.disabled), true, '🔴 sin ningún número el botón no debe poder pulsarse.');
  assert.equal(b.title, MENSAJE);
});
