// tests/scrum1285-guardado-en-vuelo.test.mjs — SCRUM-1285
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SE TECLEA MIENTRAS VUELVE UN GUARDADO NO PUEDE PERDERSE, NI DISPARAR UN SEGUNDO GUARDADO
//
// Medido por S4 ejecutando: en «Partes por valorar» lo tecleado con el PATCH en vuelo lo pisaba el
// repintado; en el plan de cobro, además, teclear rehabilitaba «Guardar plan», salía un segundo
// PATCH y, con la latencia invertida, la base se quedaba con el plan VIEJO.
//
// El arreglo es UN patrón (`congelarMientrasGuarda`, api.js): con un guardado en vuelo, ningún
// control de su zona se puede tocar. Aquí se mide PULSANDO las dos pantallas reales en el banco,
// con la red retenida a mano para que el PATCH se quede en vuelo el tiempo que haga falta.
//
// 🔴 CONTROL POSITIVO DE LA SONDA: cada caso se corre también con el patrón QUITADO (el helper
// cambiado por uno que no congela). Con él, la sonda TIENE que ver el defecto — si no lo viera,
// su verde no significaría nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});

/** Una red donde los GET contestan al momento y cada escritura se queda EN VUELO hasta soltarla. */
function redRetenida(datosGet) {
  const envios = [];
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'GET') return respuesta(200, datosGet(String(url)));
    let soltar;
    const p = new Promise((res) => { soltar = res; });
    envios.push({ url: String(url), cuerpo: JSON.parse(opts.body), responder: (st, c) => soltar(respuesta(st, c)) });
    return p;
  };
  return { envios, red: { fetch } };
}

const vueltas = async (n = 25) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

/** Teclear como un navegador: en un control apagado no entra nada y no salta ningún evento. */
function teclear(el, valor) {
  if (el.disabled) return false;
  el.value = valor;
  el.disparar('input');
  return true;
}

/**
 * Pulsar como un navegador: un botón apagado no hace nada, y uno vivo corre su `onclick` Y sus
 * oyentes. El banco sólo dispara los oyentes, y «Guardar precios» va por `onclick`.
 */
function pulsar(el) {
  if (el.disabled) return false;
  const ev = { type: 'click', target: el, preventDefault() {}, stopPropagation() {} };
  if (typeof el.onclick === 'function') el.onclick.call(el, ev);
  el.disparar('click');
  return true;
}

const QUITAR_PATRON = (banco) => { banco.ctx.congelarMientrasGuarda = (_zona, guardar) => Promise.resolve(guardar()); };

// ── PRECIOS DE LA OFICINA ────────────────────────────────────────────────────────────────────

const parte = (precio) => ({
  id: 5, numero: 'PT-2026-005', clienteNombre: 'Ana Ruiz', obra: 'Baño',
  puedeEditarPrecios: { ok: true },
  lineas: [{ id: 11, descripcion: 'Tubo', unds: 2, precioUnitario: precio, importe: precio === null ? null : precio * 2, bloque: 'materiales' }],
});

async function montarParte({ sinPatron = false } = {}) {
  const r = redRetenida((url) => {
    if (/\/oficina\/pendientes$/.test(url)) return { pendientes: [{ id: 5, numero: 'PT-2026-005', lineas: [{}] }], firmadosLeidos: 1 };
    if (/\/admin\/partes\/5\/oficina$/.test(url)) return parte(null);
    return [];
  });
  const banco = cargarDashboard(RAIZ, { red: r.red });
  if (sinPatron) QUITAR_PATRON(banco);
  const v = await pintarVista(banco, 'renderPartesOficinaView');
  assert.equal(v.error, null, `🔴 la pantalla revienta: ${v.error && v.error.message}`);
  // La fila es la tarjeta que se PULSA: la única `customers-card` con oyente de clic.
  const fila = todos(v.contenedor).find((n) => n.className === 'customers-card' && (n._oyentes.click || []).length > 0);
  assert.ok(fila, '🔴 CIEGO: no sale el parte en la lista');
  fila.disparar('click');
  await vueltas();
  const precio = () => todos(v.contenedor).find((n) => n.tagName === 'INPUT');
  const guardar = () => todos(v.contenedor).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Guardar precios');
  assert.ok(precio() && guardar(), '🔴 CIEGO: el parte no pintó su casilla de precio y su botón');
  return { envios: r.envios, precio, guardar, raiz: v.contenedor };
}

test('SCRUM-1285 · oficina · CONTROL POSITIVO: guardar sin teclear en vuelo sigue guardando y repinta', async () => {
  const p = await montarParte();
  assert.ok(teclear(p.precio(), '12'));
  assert.ok(pulsar(p.guardar()));
  assert.equal(p.envios.length, 1, '🔴 pulsar «Guardar precios» no mandó nada');
  assert.equal(p.envios[0].cuerpo.precios[0].precioUnitario, 12);
  p.envios[0].responder(200, parte(12));
  await vueltas();
  assert.equal(p.precio().value, '12', '🔴 tras guardar, la casilla no enseña lo guardado');
  assert.equal(p.precio().disabled, false, '🔴 tras guardar, la casilla se quedó apagada');
  assert.equal(p.guardar().disabled, false, '🔴 tras guardar, el botón se quedó apagado');
});

test('SCRUM-1285 · oficina · 🔴 con el PATCH en vuelo no se puede teclear: nada que perder', async () => {
  const p = await montarParte();
  teclear(p.precio(), '12');
  pulsar(p.guardar());
  assert.equal(p.precio().disabled, true, '🔴 la casilla sigue viva con el guardado en vuelo');
  assert.equal(teclear(p.precio(), '15'), false);
  p.envios[0].responder(200, parte(12));
  await vueltas();
  assert.equal(p.precio().value, '12');
});

test('SCRUM-1285 · oficina · control positivo de la SONDA: sin el patrón, lo tecleado en vuelo desaparece', async () => {
  const p = await montarParte({ sinPatron: true });
  teclear(p.precio(), '12');
  pulsar(p.guardar());
  assert.equal(teclear(p.precio(), '15'), true, 'la sonda no llega a teclear en vuelo: no mediría nada');
  p.envios[0].responder(200, parte(12));
  await vueltas();
  assert.equal(p.precio().value, '12', 'la sonda no ve el defecto que existe sin el patrón: su verde no vale');
});

test('SCRUM-1285 · oficina · si el guardado falla, la pantalla no se queda congelada', async () => {
  const p = await montarParte();
  teclear(p.precio(), '12');
  pulsar(p.guardar());
  p.envios[0].responder(500, { message: 'x' });
  await vueltas();
  // El error repinta el hueco con su estado de error y su «reintentar»: ningún control apagado.
  const apagados = todos(p.raiz).filter((n) => (n.tagName === 'BUTTON' || n.tagName === 'INPUT') && n.disabled);
  assert.equal(apagados.length, 0, '🔴 tras un guardado fallido quedan controles congelados');
  assert.match(todos(p.raiz).map((n) => String(n.textContent || '')).join(' | '), /No se han podido guardar los precios/);
});

// ── PLAN DE COBRO DEL PRESUPUESTO ────────────────────────────────────────────────────────────

const presupuesto = (plan, invoices = []) => ({
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'accepted', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  // Rango IMPOSIBLE (34 + 0 + 8 dígitos): ningún envío puede llegar a nadie (SCRUM-262).
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1285', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices,
  decision: { acceptedAt: '2026-09-20T10:00:00.000Z', rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'CUSTOM', evidence: null },
  billingPlan: plan, nextStage: null, hasCustomPlan: true,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});
const PLAN = [{ label: 'Señal', percent: 0.3 }, { label: 'Final', percent: 0.7 }];
const FACTURA = { id: 9, number: 'F-2026-0009', total: '30.00', currency: 'EUR', status: 'paid', createdAt: '2026-09-21T10:00:00.000Z' };

async function montarPlan({ sinPatron = false, invoices = [] } = {}) {
  const r = redRetenida((url) => (/\/admin\/quotes\/1$/.test(url) ? presupuesto(PLAN, invoices) : []));
  const banco = cargarDashboard(RAIZ, { red: r.red });
  banco.ctx.appModoEmision = 'fiscal';
  let repintados = 0;
  banco.ctx.renderAppView = () => { repintados++; };
  if (sinPatron) QUITAR_PATRON(banco);
  const v = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
  const guardar = todos(v.contenedor).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Guardar plan');
  assert.ok(guardar, '🔴 CIEGO: la ficha no pintó el plan de cobro');
  const seccion = guardar._padre._padre;
  const pcts = () => todos(seccion).filter((n) => n.tagName === 'INPUT' && n.type === 'number');
  assert.equal(pcts().length, 2, '🔴 CIEGO: no salen los dos tramos');
  // La base del servidor: la escritura que LLEGA la última es la que queda (reemplazo a ciegas, :483).
  const base = { plan: null };
  const responder = (i) => { base.plan = r.envios[i].cuerpo.customBillingPlan.map((t) => t.percentage); r.envios[i].responder(200, { ok: true }); };
  return { envios: r.envios, guardar, pcts, base, responder, repintados: () => repintados };
}

test('SCRUM-1285 · plan · CONTROL POSITIVO: guardar sin teclear en vuelo sigue guardando', async () => {
  const p = await montarPlan();
  teclear(p.pcts()[0], '40'); teclear(p.pcts()[1], '60');
  assert.ok(pulsar(p.guardar), '🔴 «Guardar plan» apagado con un plan que suma 100');
  assert.equal(p.envios.length, 1);
  p.responder(0);
  await vueltas();
  assert.deepEqual(p.base.plan, [0.4, 0.6]);
  assert.equal(p.repintados(), 1, '🔴 tras guardar no se repinta la ficha');
});

test('SCRUM-1285 · plan · 🔴 con el PATCH en vuelo no se teclea ni se rehabilita «Guardar plan»: un solo PATCH', async () => {
  const p = await montarPlan();
  teclear(p.pcts()[0], '40'); teclear(p.pcts()[1], '60');
  pulsar(p.guardar);
  assert.ok(p.pcts().every((i) => i.disabled), '🔴 los tramos siguen vivos con el guardado en vuelo');
  assert.equal(teclear(p.pcts()[0], '50'), false);
  assert.equal(p.guardar.disabled, true, '🔴 «Guardar plan» se rehabilitó con un PATCH en vuelo');
  assert.equal(pulsar(p.guardar), false);
  assert.equal(p.envios.length, 1, '🔴 salió un SEGUNDO PATCH con el primero en vuelo');
});

test('SCRUM-1285 · plan · 🔴 la base se queda con el ÚLTIMO plan que pidió la persona', async () => {
  const p = await montarPlan();
  teclear(p.pcts()[0], '40'); teclear(p.pcts()[1], '60');
  pulsar(p.guardar);
  p.responder(0);
  await vueltas();
  teclear(p.pcts()[0], '50'); teclear(p.pcts()[1], '50');
  assert.ok(pulsar(p.guardar), '🔴 tras volver el primero, no se puede guardar otra vez');
  p.responder(1);
  await vueltas();
  assert.deepEqual(p.base.plan, [0.5, 0.5]);
});

test('SCRUM-1285 · plan · control positivo de la SONDA: sin el patrón, sale un 2.º PATCH y la base REVIERTE', async () => {
  const p = await montarPlan({ sinPatron: true });
  teclear(p.pcts()[0], '40'); teclear(p.pcts()[1], '60');
  pulsar(p.guardar);
  assert.equal(teclear(p.pcts()[0], '50'), true, 'la sonda no llega a teclear en vuelo');
  teclear(p.pcts()[1], '50');
  assert.equal(pulsar(p.guardar), true, 'la sonda no ve «Guardar plan» rehabilitado: no mide el defecto');
  assert.equal(p.envios.length, 2);
  // Latencia invertida: llega antes la respuesta del SEGUNDO, y después la del primero.
  p.responder(1); p.responder(0);
  await vueltas();
  assert.deepEqual(p.base.plan, [0.4, 0.6], 'la sonda no reproduce la reversión: su verde no vale');
});

test('SCRUM-1285 · plan · al fallar, cada control vuelve a su estado: un tramo YA FACTURADO sigue bloqueado', async () => {
  const p = await montarPlan({ invoices: [FACTURA] });
  const [emitido, libre] = p.pcts();
  assert.equal(emitido.disabled, true, '🔴 CIEGO: el tramo facturado no salió bloqueado de partida');
  teclear(libre, '70');
  pulsar(p.guardar);
  p.envios[0].responder(409, { message: 'x' });
  await vueltas();
  assert.equal(p.pcts()[0].disabled, true, '🔴 un tramo YA FACTURADO se desbloqueó al pasar por un guardado fallido');
  assert.equal(p.pcts()[1].disabled, false, '🔴 tras el fallo el tramo libre se quedó congelado');
  assert.equal(p.guardar.disabled, false, '🔴 tras el fallo no se puede reintentar');
});
