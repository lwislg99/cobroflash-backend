// tests/scrum1285d-plan-de-cobro-version-pantalla.test.mjs — SCRUM-1285 (mitad de PANTALLA de la versión)
//
// EL PLAN DE COBRO MANDA LA VERSIÓN QUE LEYÓ, Y EL AVISO DEL 409 SÓLO SALE CUANDO ES VERDAD.
//
// El servidor rechaza con 409 `version_superada` un guardado hecho sobre una lectura vieja
// (`scrum1285b`). La versión es el `updatedAt` del PRESUPUESTO ENTERO: guardar una nota interna en
// esta misma ficha también la mueve (medido en yaqu.app el 1-oct-2026). El texto aprobado afirma
// «este plan de cobro ha cambiado»; pintarlo a cada 409 sería mentir cada vez que la persona
// apunta una nota antes de guardar el plan. Así que tras el 409 se MIRA el plan vigente:
//   · es otro  → se descarta lo tecleado, se repinta el vigente y se dice;
//   · es igual → el cambio se guarda sobre la versión nueva, sin decir nada.
//
// Vista real en el banco, red de mentira con las escrituras retenidas. Lo que NO mide: un navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXTO = 'Este plan de cobro ha cambiado desde que lo abriste. Te mostramos cómo está ahora: revísalo y vuelve a hacer tu cambio.';
const V1 = '2026-09-20T10:00:00.000Z';
const V2 = '2026-09-20T10:05:00.000Z';

const respuesta = (status, cuerpo) => ({
  ok: status < 400, status,
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});
const vueltas = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

const presupuesto = (plan, updatedAt, invoices = []) => ({
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'accepted', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: V1, updatedAt,
  // Rango IMPOSIBLE (34 + 0 + 8 dígitos): ningún envío puede llegar a nadie (SCRUM-262).
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1285', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices,
  decision: { acceptedAt: V1, rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'CUSTOM', evidence: null },
  billingPlan: plan, nextStage: null, hasCustomPlan: true,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
});
const PLAN = [{ label: 'Señal', percent: 0.3 }, { label: 'Final', percent: 0.7 }];
const PLAN_DE_OTRO = [{ label: 'Señal', percent: 0.5 }, { label: 'Final', percent: 0.5 }];
const FACTURA = { id: 9, number: 'F-2026-0009', total: '30.00', currency: 'EUR', status: 'paid', createdAt: V1 };

/** La ficha montada. `servidor.ahora` es lo que contesta el GET: se cambia a mano entre pasos. */
async function montar() {
  const servidor = { ahora: presupuesto(PLAN, V1) };
  const envios = [];
  const lecturas = [];
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'GET') {
      if (/\/admin\/quotes\/1$/.test(String(url))) { lecturas.push(String(url)); return respuesta(200, servidor.ahora); }
      return respuesta(200, []);
    }
    let soltar;
    const p = new Promise((res) => { soltar = res; });
    envios.push({ url: String(url), cuerpo: JSON.parse(opts.body), responder: (st, c) => soltar(respuesta(st, c)) });
    return p;
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  banco.ctx.appModoEmision = 'fiscal';
  const avisos = [];
  banco.ctx.showToast = (texto, tipo) => { avisos.push({ texto: String(texto), tipo: tipo || 'ok' }); };
  let repintados = 0;
  banco.ctx.renderAppView = () => { repintados++; };

  const pintar = async () => {
    const v = await pintarVista(banco, 'renderQuoteDetailView', 1);
    assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
    const guardar = todos(v.contenedor).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Guardar plan');
    assert.ok(guardar, '🔴 CIEGO: la ficha no pintó el plan de cobro');
    const seccion = guardar._padre._padre;
    return {
      guardar, seccion,
      pcts: () => todos(seccion).filter((n) => n.tagName === 'INPUT' && n.type === 'number'),
      textos: () => todos(v.contenedor).map((n) => String(n.textContent || '')),
      avisoEnLaSeccion: () => todos(seccion).filter((n) => n.tagName === 'P' && n.textContent === TEXTO),
    };
  };
  const teclear = (el, valor) => { if (el.disabled) return false; el.value = valor; el.disparar('input'); return true; };
  const pulsar = (el) => { if (el.disabled) return false; el.disparar('click'); return true; };
  return { servidor, envios, lecturas, avisos, repintados: () => repintados, pintar, teclear, pulsar };
}

/** Teclea 40/60 y pulsa «Guardar plan»: deja el primer PATCH en vuelo. */
async function guardar4060(m) {
  const f = await m.pintar();
  assert.equal(f.pcts().length, 2, '🔴 CIEGO: no salen los dos tramos');
  m.teclear(f.pcts()[0], '40'); m.teclear(f.pcts()[1], '60');
  assert.ok(m.pulsar(f.guardar), '🔴 «Guardar plan» apagado con un plan que suma 100');
  await vueltas(5);
  assert.equal(m.envios.length, 1, '🔴 CIEGO: no salió el PATCH');
  return f;
}
const pct = (envio) => envio.cuerpo.customBillingPlan.map((t) => t.percentage);

test('SCRUM-1285 · versión · el texto del aviso es el APROBADO, letra por letra', () => {
  const registro = fs.readFileSync(path.join(RAIZ, 'docs/microcopy/2026-10-01-SCRUM-1285-plan-de-cobro-cambiado.md'), 'utf8');
  assert.ok(registro.includes(TEXTO), '🔴 el literal de este test no es el del registro de microcopy.');
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesDetailView.js'), 'utf8');
  assert.ok(vista.includes(TEXTO), '🔴 la vista no lleva el literal aprobado.');
});

test('SCRUM-1285 · versión · CONTROL POSITIVO: el PATCH manda la versión que leyó la ficha, y guardar sigue guardando', async () => {
  const m = await montar();
  await guardar4060(m);
  assert.equal(m.envios[0].cuerpo.version, V1, '🔴 el PATCH no manda `version`: el servidor reemplaza a ciegas (transición).');
  assert.deepEqual(pct(m.envios[0]), [0.4, 0.6]);
  m.envios[0].responder(200, { ok: true, version: V2 });
  await vueltas();
  assert.equal(m.envios.length, 1);
  assert.equal(m.repintados(), 1, '🔴 tras guardar no se repinta la ficha');
  assert.deepEqual(m.avisos.map((a) => a.tipo), ['ok']);
  assert.equal(m.lecturas.length, 1, '🔴 un guardado normal no tiene por qué releer el presupuesto');
});

test('SCRUM-1285 · versión · 🔴 409 y el plan vigente ES OTRO: se descarta, se repinta el vigente y SE DICE', async () => {
  const m = await montar();
  const f = await guardar4060(m);
  m.servidor.ahora = presupuesto(PLAN_DE_OTRO, V2); // otra pestaña guardó 50/50
  m.envios[0].responder(409, { error: 'version_superada' });
  await vueltas();

  assert.equal(m.envios.length, 1, '🔴 SE REENVIÓ el plan viejo encima del de la otra pestaña: es justo lo que la versión impide.');
  assert.equal(m.repintados(), 1, '🔴 no se pidió repintar la ficha con el plan vigente');
  assert.equal(m.avisos.filter((a) => a.tipo === 'ok').length, 0, '🔴 dice «actualizado» y no se ha guardado nada');
  assert.equal(f.guardar.disabled, false, '🔴 la sección se quedó congelada');

  const g = await m.pintar();
  assert.deepEqual(g.pcts().map((i) => i.value), ['50', '50'], '🔴 no se pinta el plan VIGENTE');
  assert.equal(g.avisoEnLaSeccion().length, 1, '🔴 se descartó lo tecleado SIN DECIRLO: el aviso no está en la sección del plan.');
  assert.equal(g.avisoEnLaSeccion()[0].getAttribute('role'), 'status');

  const h = await m.pintar();
  assert.equal(h.avisoEnLaSeccion().length, 0, '🔴 el aviso sale otra vez al repintar: se dice UNA vez.');
});

test('SCRUM-1285 · versión · 🔴 409 porque se guardó una NOTA (el plan es el mismo): se guarda y NO se dice que cambió', async () => {
  const m = await montar();
  await guardar4060(m);
  m.servidor.ahora = presupuesto(PLAN, V2); // mismo plan; la versión la movió la nota interna
  m.envios[0].responder(409, { error: 'version_superada' });
  await vueltas();

  assert.equal(m.envios.length, 2, '🔴 el cambio de la persona se ha perdido por una nota: no se reintentó.');
  assert.equal(m.envios[1].cuerpo.version, V2, '🔴 el reintento no lleva la versión NUEVA.');
  assert.deepEqual(pct(m.envios[1]), [0.4, 0.6], '🔴 el reintento no lleva el plan que pidió la persona.');
  m.envios[1].responder(200, { ok: true, version: '2026-09-20T10:06:00.000Z' });
  await vueltas();

  assert.deepEqual(m.avisos.map((a) => a.tipo), ['ok']);
  assert.equal(m.repintados(), 1);
  m.servidor.ahora = presupuesto([{ label: 'Señal', percent: 0.4 }, { label: 'Final', percent: 0.6 }], '2026-09-20T10:06:00.000Z');
  const g = await m.pintar();
  assert.equal(g.textos().filter((t) => t === TEXTO).length, 0,
    '🔴 TEXTO FALSO: dice «este plan de cobro ha cambiado» y lo único que cambió fue una nota.');
});

test('SCRUM-1285 · versión · 🔴 409 y hay un tramo FACTURADO de más: cuenta como plan cambiado', async () => {
  const m = await montar();
  await guardar4060(m);
  m.servidor.ahora = presupuesto(PLAN, V2, [FACTURA]); // mismos tramos, pero el primero ya tiene factura
  m.envios[0].responder(409, { error: 'version_superada' });
  await vueltas();
  assert.equal(m.envios.length, 1, '🔴 se reenvió un plan que mueve un tramo ya facturado');
  const g = await m.pintar();
  assert.equal(g.avisoEnLaSeccion().length, 1);
  assert.equal(g.pcts()[0].disabled, true, '🔴 el tramo facturado no sale bloqueado en el plan vigente');
});

test('SCRUM-1285 · versión · si el reintento TAMBIÉN choca, no se pinta el identificador interno', async () => {
  const m = await montar();
  const f = await guardar4060(m);
  m.servidor.ahora = presupuesto(PLAN, V2);
  m.envios[0].responder(409, { error: 'version_superada' });
  await vueltas();
  m.envios[1].responder(409, { error: 'version_superada' });
  await vueltas();
  assert.equal(m.envios.length, 2, '🔴 reintenta sin fin');
  assert.deepEqual(m.avisos, [{ texto: 'No se pudo guardar el plan', tipo: 'error' }]);
  assert.equal(f.guardar.disabled, false, '🔴 tras el fallo no se puede reintentar');
  assert.equal(m.repintados(), 0);
});

test('SCRUM-1285 · versión · un 409 que NO es de versión sigue diciendo lo suyo y no relee nada', async () => {
  const m = await montar();
  await guardar4060(m);
  m.envios[0].responder(409, { error: 'tramo_emitido_intocable', message: 'Ese tramo ya está facturado.' });
  await vueltas();
  assert.deepEqual(m.avisos, [{ texto: 'Ese tramo ya está facturado.', tipo: 'error' }]);
  assert.equal(m.envios.length, 1);
  assert.equal(m.lecturas.length, 1);
});
