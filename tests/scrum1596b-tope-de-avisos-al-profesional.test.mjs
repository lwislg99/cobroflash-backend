// tests/scrum1596b-tope-de-avisos-al-profesional.test.mjs — SCRUM-1596b (J2, 23-oct)
//
// 🔴 LOS AVISOS AL PROFESIONAL GASTABAN EL CUPO DE LOS CLIENTES, Y NO TENÍAN TOPE PROPIO.
// `notifyMerchantAlert` intenta el texto y, con la ventana del profesional cerrada, manda la plantilla
// `merchant_alert_es`. Medido en SCRUM-1596 c.20601 (caso C5): con 99 de 100 plantillas gastadas en
// el día, el aviso se llevaba la última y la siguiente al cliente ya no salía. Decisión del fundador,
// c.20602, «Tope propio, fuera del cupo»: 30 avisos por comercio y día, que NO gastan el cupo de 100;
// el que no cabe se pierde y queda anotado como `daily_cap`. Sin esquema: se cuenta por el nombre.
//
// ── EL BANCO ── la app REAL (`dist/app.js`) por HTTP (`_banco-camino-real.mjs`), por la ruta pública
// `POST /pay/bizum/:token/claimed`, que es una de las 9 que llaman al aviso. WhatsApp por el dry-run
// de la casa: pasa todos los guards y la reserva del tope, y apunta en un buzón lo que habría salido.
// Lo ÚNICO que se dobla de WhatsApp es la respuesta al TEXTO al profesional: «fuera de ventana», como
// contestaría Meta con su ventana cerrada (el dry-run da por bueno cualquier texto). La base es el
// doble de la casa, con un registro de mensajes CON ESTADO que evalúa el `where` que le piden: lo que
// no sabe evaluar lo apunta, y el caso cae CIEGO en vez de contar mal.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma } from './_banco-camino-real.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

// Las corre el meta-guard. Medidas a mano sobre dist el 23-oct, las cuatro mueren: M1 tumba 4 casos.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Como antes: el aviso entra por el cupo de comercio (y ese cupo ya no lo ve): el 31.º sale.
    fichero: 'src/modules/messaging/domain/whatsappLog.service.ts',
    de: 'if (input.templateName === PLANTILLA_AVISO_AL_PROFESIONAL) {',
    a: 'if (false) {',
    cae: 'el 31.º no sale',
  },
  {
    // El aviso tiene su tope, pero el cupo de comercio lo sigue contando: vuelve el C5 de c.20601.
    fichero: 'src/modules/messaging/domain/whatsappLog.service.ts',
    de: 'AND: [{ OR: [{ templateName: null }, { templateName: { not: PLANTILLA_AVISO_AL_PROFESIONAL } }] }],',
    a: '',
    cae: 'EL C5 DE c.20601',
  },
  {
    // El `not` a secas: en SQL deja fuera las filas sin nombre, y el cupo cuenta de menos.
    fichero: 'src/modules/messaging/domain/whatsappLog.service.ts',
    de: 'AND: [{ OR: [{ templateName: null }, { templateName: { not: PLANTILLA_AVISO_AL_PROFESIONAL } }] }],',
    a: 'templateName: { not: PLANTILLA_AVISO_AL_PROFESIONAL },',
    cae: 'las filas sin nombre',
  },
  {
    // El borde: el aviso 31 cabe.
    fichero: 'src/modules/messaging/domain/whatsappLog.service.ts',
    de: 'if (avisosHoy >= TOPE_AVISOS_AL_PROFESIONAL) {',
    a: 'if (avisosHoy > TOPE_AVISOS_AL_PROFESIONAL) {',
    cae: 'el 31.º no sale',
  },
];

const require = createRequire(import.meta.url);
process.env.WHATSAPP_DRY_RUN = '1';
const app = await montarAppReal();
after(() => app.cerrar());

const { config } = require('../dist/core/config/env.js');
const { normalizePhone } = require('../dist/core/utils/utils.js');
const wa = require('../dist/integrations/whatsapp.js');
const notif = require('../dist/integrations/whatsappNotifications.js');
const { TOPE_AVISOS_AL_PROFESIONAL } = require('../dist/modules/messaging/domain/whatsappLog.service.js');
const AVISO = 'merchant_alert_es';
const D = Number(config.WA_DAILY_TEMPLATE_CAP);
const C = Number(config.WA_CUSTOMER_DAILY_CAP);
const A = TOPE_AVISOS_AL_PROFESIONAL;

const MIO = 15965;
const PROF = normalizePhone(telefonoDePrueba(15965));
const cliente = (id, n) => ({ id, name: `Cliente ${n}`, phone: normalizePhone(telefonoDePrueba(n)) });
const PAGA = cliente(801, 15966);   // el que pulsa «ya he pagado»
const OTRO = cliente(802, 15967);   // otro cliente del mismo comercio
const merchant = { id: MIO, name: 'Taller 1596b', legalName: null, country: 'ES', timezone: 'Europe/Madrid', whatsappPhone: PROF, bizumPhone: PROF, flags: null };

// El texto al profesional sale «fuera de ventana»; todo lo demás, tal cual.
const textoOriginal = wa.sendWhatsAppText;
const ctaOriginal = wa.sendWhatsAppCtaUrl;
const textosAlProfesional = [];
wa.sendWhatsAppText = async (p) => (p.to === PROF ? (textosAlProfesional.push(p.to), { ok: false, reason: 'fuera_de_ventana' }) : textoOriginal(p));
wa.sendWhatsAppCtaUrl = async (p) => (p.to === PROF ? (textosAlProfesional.push(p.to), { ok: false, reason: 'fuera_de_ventana' }) : ctaOriginal(p));

// ── El registro de mensajes: evalúa el filtro que le piden ──────────────────────────────────
const noSabe = [];
function casa(fila, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') { if (!v.some((w) => casa(fila, w))) return false; continue; }
    if (k === 'AND') { if (!v.every((w) => casa(fila, w))) return false; continue; }
    if (k === 'createdAt') { if (!(fila.createdAt.getTime() >= v.gte.getTime())) return false; continue; }
    if (v === null) { if (fila[k] != null) return false; continue; }
    // `{ not: x }` como lo hace SQL: una fila con NULL no casa (NULL <> x no es verdad).
    if (typeof v === 'object' && 'not' in v) { if (fila[k] == null || fila[k] === v.not) return false; continue; }
    if (typeof v === 'object') { noSabe.push(k); return false; }
    if (fila[k] !== v) return false;
  }
  return true;
}

/**
 * Programa la base. `previas`: [plantilla, customerId, cuántas] que el comercio ya mandó hoy.
 * Devuelve el registro, para mirar qué quedó apuntado.
 */
function programar({ previas = [] } = {}) {
  const filas = [];
  const ahora = new Date();
  const apuntar = (data) => { const f = { id: filas.length + 1, createdAt: ahora, waMessageId: null, customerId: null, templateName: null, ...data }; filas.push(f); return f; };
  for (const [templateName, customerId, n] of previas) {
    for (let i = 0; i < n; i += 1) apuntar({ merchantId: MIO, type: 'template', templateName, customerId, status: 'sent', waMessageId: `previa.${filas.length}` });
  }
  const eventos = [];
  const cobro = {
    id: 1596, merchantId: MIO, customerId: PAGA.id, status: 'pending', amount: '50.00', currency: 'EUR',
    receiptToken: 'tok-1596b', concept: 'Reparación', customer: { name: PAGA.name }, merchant,
  };
  bancoDePrisma().programar({
    merchant: { findUnique: async () => merchant },
    charge: { findUnique: async (a) => (a?.where?.receiptToken === 'tok-1596b' ? cobro : null) },
    event: {
      // Cada «ya he pagado» de este test es un cobro nuevo: el freno de 1 por cobro se mira aparte.
      findFirst: async () => null,
      create: async (a) => { eventos.push(a.data); return { id: eventos.length }; },
    },
    whatsAppMessage: {
      count: async (a) => filas.filter((f) => casa(f, a?.where ?? {})).length,
      create: async (a) => apuntar(a.data),
      update: async (a) => { const f = filas.find((x) => x.id === a?.where?.id); if (f) Object.assign(f, a.data); return f ?? null; },
      findFirst: async () => null, // ninguna ventana abierta con ningún cliente
    },
  });
  return filas;
}

const buzon = [];
globalThis.__waDryRunOutbox = buzon;
const [error, aviso] = [console.error, console.warn];
const trazas = [];
console.error = (...a) => trazas.push(a.map(String).join(' '));
console.warn = (...a) => trazas.push(a.map(String).join(' '));
after(() => { console.error = error; console.warn = aviso; delete globalThis.__waDryRunOutbox; });

const asentar = async () => { // el aviso de Bizum sale sin esperar a la respuesta: se espera a que pare
  let antes = -1;
  for (let i = 0; i < 40 && antes !== buzon.length + trazas.length; i += 1) {
    antes = buzon.length + trazas.length;
    await new Promise((r) => setTimeout(r, 25));
  }
};
async function reclamar() {
  buzon.length = 0; textosAlProfesional.length = 0; trazas.length = 0;
  const r = await app.pedir('/pay/bizum/tok-1596b/claimed', { metodo: 'POST' });
  await asentar();
  return { http: r.status, avisos: buzon.filter((b) => b.kind === 'template' && b.to === PROF && b.templateName === AVISO).length };
}
/** Una plantilla a un cliente por el sender de la casa, con su cliente (la hermana de 1596a). */
async function alCliente(c) {
  buzon.length = 0;
  const r = await notif.sendPaymentConfirmationInvoice({
    toPhone: c.phone, customerName: c.name, amount: 50, currency: 'EUR', documentNumber: 'J-1596b',
    businessName: 'Taller 1596b', chargeId: 1596, receiptToken: 'tok-1596b', merchantId: MIO, customerId: c.id,
  });
  return { ok: r.ok, salen: buzon.filter((b) => b.kind === 'template' && b.to === c.phone).length };
}
const bloqueadas = (filas, plantilla) => filas.filter((f) => f.status === 'failed' && f.error === 'daily_cap' && f.templateName === plantilla).length;

test('SCRUM-1596b · SUELO: topes leídos de dist, y con todo libre el aviso sale como plantilla por la ruta real', async () => {
  assert.equal(A, 30, 'el tope de avisos es el de la decisión del fundador (c.20602)');
  assert.ok(D > A && C >= 1, `🔴 CIEGO: topes no leídos (comercio ${D}, cliente ${C})`);
  assert.ok(PROF && PAGA.phone && OTRO.phone && new Set([PROF, PAGA.phone, OTRO.phone]).size === 3);
  programar();
  const r = await reclamar();
  assert.equal(r.http, 303);
  assert.equal(textosAlProfesional.length, 1, '🔴 CIEGO: no se intentó el texto al profesional; el camino no es el del aviso');
  assert.equal(r.avisos, 1, '🔴 CIEGO: con todo libre no ha salido el aviso; ningún bloqueo de abajo diría algo');
  assert.deepEqual(noSabe, [], 'el registro sabe evaluar todo lo que le piden');
});

test('SCRUM-1596b · 🔴 con 30 avisos ya hoy, el 31.º no sale y queda anotado como daily_cap', async () => {
  const filas = programar({ previas: [[AVISO, null, A]] });
  const r = await reclamar();
  assert.equal(r.avisos, 0, `🔴 con ${A} avisos hoy, el aviso ${A + 1} ha salido`);
  assert.equal(bloqueadas(filas, AVISO), 1, 'el que no cabe queda apuntado como bloqueado, igual que un daily_cap');
  assert.equal(filas.filter((f) => f.status === 'queued').length, 0, 'y no ocupa hueco');
  assert.deepEqual(noSabe, []);
});

test('SCRUM-1596b · con 29 avisos ya hoy, el 30.º sale (el borde es el de la decisión)', async () => {
  programar({ previas: [[AVISO, null, A - 1]] });
  assert.equal((await reclamar()).avisos, 1);
});

test('SCRUM-1596b · 🔴 EL C5 DE c.20601, AL REVÉS: con 99 de 100 a clientes, el aviso sale Y la siguiente al cliente también', async () => {
  const filas = programar({ previas: [['quote_decision_es', null, D - 1]] });
  const r = await reclamar();
  assert.equal(r.avisos, 1, 'el aviso sale');
  const c = await alCliente(OTRO);
  assert.equal(c.salen, 1, `🔴 el aviso se ha llevado la plantilla ${D} de los clientes: la del cliente no sale`);
  assert.equal(bloqueadas(filas, 'payment_confirmation_invoice_es'), 0);
  assert.deepEqual(noSabe, []);
});

test('SCRUM-1596b · 🔴 con el cupo de 100 de los clientes lleno, el aviso sale igual (no lo gasta ni lo espera)', async () => {
  programar({ previas: [['quote_decision_es', null, D]] });
  assert.equal((await reclamar()).avisos, 1, `🔴 con ${D} plantillas a clientes, el aviso al profesional no sale`);
});

test('SCRUM-1596b · CONTROL: el cupo de 100 sigue igual para los clientes, y los avisos no le suman ni le restan', async () => {
  const filas = programar({ previas: [['quote_decision_es', null, D], [AVISO, null, A]] });
  const c = await alCliente(OTRO);
  assert.equal(c.salen, 0, `con ${D} a clientes, la siguiente a un cliente no sale`);
  assert.equal(bloqueadas(filas, 'payment_confirmation_invoice_es'), 1, 'y queda como daily_cap');
  programar({ previas: [['quote_decision_es', null, D - 1], [AVISO, null, A]] });
  assert.equal((await alCliente(OTRO)).salen, 1, `con ${D - 1} a clientes y ${A} avisos, la de un cliente sale: los avisos no cuentan`);
});

test('SCRUM-1596b · CONTROL: el tope por cliente sigue igual, y un aviso con su cliente lleno sale', async () => {
  programar({ previas: [['quote_decision_es', OTRO.id, C]] });
  assert.equal((await alCliente(OTRO)).salen, 0, `con ${C} hoy a este cliente, la siguiente no sale`);
  programar({ previas: [['quote_decision_es', OTRO.id, C - 1]] });
  assert.equal((await alCliente(OTRO)).salen, 1, `con ${C - 1}, sale`);
  programar({ previas: [['quote_decision_es', PAGA.id, C]] });
  assert.equal((await reclamar()).avisos, 1, 'el aviso va al profesional: el tope del cliente que paga no lo frena (como en c.20601 C1)');
});

test('SCRUM-1596b · CONTROL: las filas sin nombre de plantilla siguen contando en el cupo de los clientes', async () => {
  programar({ previas: [[null, null, D]] });
  assert.equal((await alCliente(OTRO)).salen, 0, `🔴 ${D} plantillas sin nombre no cuentan: el filtro que aparta los avisos se lleva también los NULL`);
});

test('SCRUM-1596b · CERO: con la ventana del profesional abierta va por texto, 0 plantillas, aunque el tope de avisos esté lleno', async () => {
  programar({ previas: [[AVISO, null, A]] });
  wa.sendWhatsAppText = textoOriginal;
  try {
    const r = await reclamar();
    assert.equal(r.avisos, 0);
    assert.equal(buzon.filter((b) => b.kind === 'text' && b.to === PROF).length, 1, 'sale como texto');
  } finally {
    wa.sendWhatsAppText = async (p) => (p.to === PROF ? (textosAlProfesional.push(p.to), { ok: false, reason: 'fuera_de_ventana' }) : textoOriginal(p));
  }
});
