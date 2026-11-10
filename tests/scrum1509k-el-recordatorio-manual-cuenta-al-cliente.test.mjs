// tests/scrum1509k-el-recordatorio-manual-cuenta-al-cliente.test.mjs — SCRUM-1509k (J1, 23-oct)
//
// 🔴 EL «ENVIAR RECORDATORIO» MANUAL DE UNA FACTURA NO LE DECÍA AL TOPE A QUÉ CLIENTE IBA.
// `POST /admin/invoices/:id/send-reminder` llamaba a `sendWhatsAppTemplate` sin `log`, así que
// `reservarPlantilla` recibía `customerId = null` y el tope por cliente y día
// (`WA_CUSTOMER_DAILY_CAP`) no se le preguntaba nunca: era uno de los «cuatro llamadores sin
// cliente» de SCRUM-1509d (Jira c.18907). Decisión del fundador, SCRUM-1509 c.20569: «Pasar el
// cliente». Se pasa por el MISMO parámetro que ya usan los demás (`log: { customerId, … }`; la
// rama de texto libre de esta misma ruta ya lo llevaba).
//
// 🔵 LO QUE LEE EL PROFESIONAL AL BLOQUEAR NO ES TEXTO NUEVO (regla 39): la ruta ya contestaba con
// `falloDeEnvioDeFactura`, y la frase de `customer_daily_cap` es la firmada de SCRUM-1465/1478
// (`envioQueNoSale.ts`), la misma que ya pinta el reenvío de la factura. El caso del bloqueo lo
// compara con lo que esa función devuelve.
//
// ── EL BANCO ── la app REAL (`dist/app.js`) por HTTP, con su `requireAuth` y su `requireRole`
// (`_banco-camino-real.mjs`): no se saca el handler de su ruta (A10, SCRUM-1344). La base es el
// doble de la casa, con un registro de WhatsApp CON ESTADO que cuenta como `reservarPlantilla`
// (por comercio, y por cliente sólo si la pregunta lo lleva). WhatsApp por el dry-run de la casa,
// que pasa todos los guards (baja, topes) y sólo se salta la llamada a Meta.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 15090;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const merchant = { ...ses.merchant, country: 'ES', timezone: 'Europe/Madrid', flags: null };
const { config } = require('../dist/core/config/env.js');
const { falloDeEnvioDeFactura } = require('../dist/modules/invoicing/domain/envioQueNoSale.js');
const TOPE = Number(config.WA_CUSTOMER_DAILY_CAP);

const cliente = (id, n) => ({ id, merchantId: MIO, name: `Cliente ${n}`, phone: telefonoDePrueba(n), mobile: null, email: null });
const LLENO = cliente(501, 15093);  // el cliente con el tope del día gastado
const LIBRE = cliente(502, 15094);  // otro cliente del mismo comercio, sin nada hoy

const factura = (id, c) => ({
  id, merchantId: MIO, customerId: c ? c.id : null, number: `F26${String(id).padStart(4, '0')}`, status: 'pending',
  total: '419.87', currency: 'EUR', chargeId: 90 + id, reminder7SentAt: null, reminder14SentAt: null,
  merchant: { id: MIO, name: 'Taller 1509k', legalName: null, country: 'ES' },
  customer: c,
});
const FACTURAS = { 1: factura(1, LLENO), 2: factura(2, LIBRE), 3: factura(3, null) };

/**
 * Programa la base y manda `veces` recordatorios de la factura `id`. `previas` son las plantillas
 * que cada cliente ya recibió hoy por otros caminos (filas del registro, como las deja la reserva).
 */
async function recordar(id, { veces = 1, previas = {} } = {}) {
  const filas = [];
  for (const [cid, n] of Object.entries(previas)) {
    for (let i = 0; i < n; i += 1) filas.push({ merchantId: MIO, customerId: Number(cid), type: 'template', status: 'sent' });
  }
  const preguntas = { comercio: 0, cliente: [] };
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => merchant },
    invoice: { findFirst: async (a) => (a?.where?.merchantId === MIO ? FACTURAS[a?.where?.id] ?? null : null) },
    charge: { findUnique: async (a) => ({ id: a?.where?.id ?? 0, receiptToken: `tok-1509k-${a?.where?.id ?? 0}` }) },
    whatsAppMessage: {
      count: async (a) => {
        const w = a?.where ?? {};
        if ('customerId' in w) preguntas.cliente.push(w.customerId); else preguntas.comercio += 1;
        return filas.filter((f) => f.merchantId === w.merchantId && (!('customerId' in w) || f.customerId === w.customerId)).length;
      },
      create: async (a) => { filas.push({ ...a.data }); return { id: filas.length }; },
    },
  });
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const anterior = process.env.WHATSAPP_DRY_RUN;
  process.env.WHATSAPP_DRY_RUN = '1';
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  const respuestas = [];
  try {
    for (let i = 0; i < veces; i += 1) {
      respuestas.push(await app.pedir(`/admin/invoices/${id}/send-reminder`, { token: ses.PROPIETARIO, metodo: 'POST', cuerpo: {} }));
    }
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
    if (anterior === undefined) delete process.env.WHATSAPP_DRY_RUN; else process.env.WHATSAPP_DRY_RUN = anterior;
  }
  return { salieron: buzon.length, respuestas, ultima: respuestas[respuestas.length - 1], preguntas, filas };
}

test('SCRUM-1509k · SUELO: el tope por cliente leído de dist es un número ≥ 1, y con todo libre el recordatorio sale por la app', async () => {
  assert.ok(Number.isInteger(TOPE) && TOPE >= 1, `🔴 CIEGO: WA_CUSTOMER_DAILY_CAP = ${config.WA_CUSTOMER_DAILY_CAP}`);
  const r = await recordar(1);
  assert.equal(r.ultima.status, 200, `suelo: ${r.ultima.status} ${String(r.ultima.texto).slice(0, 200)}`);
  assert.equal(r.salieron, 1, '🔴 CIEGO: con todo libre no ha salido nada; ningún bloqueo de abajo diría algo');
  assert.equal(r.ultima.json.sent, true);
  assert.equal(r.ultima.json.via, 'template', 'suelo: es la rama de PLANTILLA la que se mide (la factura tiene cobro)');
  assert.equal(r.preguntas.comercio, 1, '🔴 CIEGO: al tope del comercio no se le ha preguntado; el doble no ve la reserva');
});

test('SCRUM-1509k · 🔴 EL ROJO DE 1509d: con el tope del cliente gastado, el recordatorio manual NO sale y la ruta dice por qué', async () => {
  const r = await recordar(1, { previas: { [LLENO.id]: TOPE } });
  assert.deepEqual(r.preguntas.cliente, [LLENO.id],
    `🔴 al tope por cliente se le ha preguntado por ${JSON.stringify(r.preguntas.cliente)}: la llamada no lleva el cliente de la factura`);
  assert.equal(r.salieron, 0, `🔴 con ${TOPE} plantillas ya hoy a este cliente, el recordatorio manual ha salido igual`);
  assert.equal(r.ultima.status, 200);
  assert.deepEqual(r.ultima.json, falloDeEnvioDeFactura('customer_daily_cap', { via: 'template', phone: LLENO.phone }),
    'lo que lee el profesional es la frase que ya existe para este motivo (envioQueNoSale.ts), no un texto nuevo');
});

test('SCRUM-1509k · 🔴 pulsando seguido sobre la misma factura salen tantas como el tope, y la siguiente se bloquea', async () => {
  const r = await recordar(1, { veces: TOPE + 2 });
  assert.equal(r.salieron, TOPE, `🔴 ${TOPE + 2} pulsaciones han dado ${r.salieron} plantillas al mismo cliente el mismo día (tope ${TOPE})`);
  assert.deepEqual(r.respuestas.map((x) => x.json.sent), [...Array(TOPE).fill(true), false, false]);
  assert.equal(r.ultima.json.error, 'customer_daily_cap');
  assert.ok(r.filas.slice(-TOPE).every((f) => f.customerId === LLENO.id), 'la reserva de cada envío queda a nombre del cliente de la factura');
});

test('SCRUM-1509k · CONTROL NEGATIVO: otro cliente del mismo comercio, con el tope libre, sigue recibiendo su recordatorio', async () => {
  const r = await recordar(2, { previas: { [LLENO.id]: TOPE } });
  assert.equal(r.salieron, 1, '🔴 el tope de un cliente ha bloqueado el recordatorio de otro');
  assert.equal(r.ultima.json.sent, true);
  assert.deepEqual(r.preguntas.cliente, [LIBRE.id], 'se pregunta por SU cliente, no por el otro');
});

test('SCRUM-1509k · factura SIN cliente: la ruta contesta 400 customer_missing_phone antes de enviar, como antes', async () => {
  const r = await recordar(3);
  assert.equal(r.ultima.status, 400);
  assert.equal(r.ultima.json.error, 'customer_missing_phone');
  assert.equal(r.salieron, 0);
  assert.equal(r.preguntas.comercio + r.preguntas.cliente.length, 0, 'no llega al tope: se para antes');
});
