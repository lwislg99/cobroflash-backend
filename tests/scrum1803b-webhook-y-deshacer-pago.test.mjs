// tests/scrum1803b-webhook-y-deshacer-pago.test.mjs — SCRUM-1803b (J1, 24-nov-2026)
//
// Decisiones del fundador en SCRUM-1803 c.22506 b) y c) (sobre el plan de jv-j1jd, c.22499):
//   b) `POST /invoice/:id/paid-webhook` también cierra el cobro `pending` enlazado por
//      `Invoice.chargeId`, con la MISMA fecha que la factura; el `method` se conserva (el webhook
//      no trae medio).
//   c) `deshacer_pago` (`PUT /admin/invoices/:id/status` con `pending`, solo justificantes) devuelve
//      a `pending` el cobro que el marcado manual había pasado a `paid` (`paidAt` null, evento
//      `unpaid`), y SOLO si sus eventos `paid` los escribió el marcado manual de ESA factura. Si lo
//      pagó una pasarela, no se toca.
//
// 🔴 POR LA RUTA MONTADA, NO POR EL HANDLER (A10, SCRUM-1344): `dist/app.js` entero con el banco de
// SCRUM-597, como `scrum1803-pago-manual-cierra-el-cobro`. El doble de `charge.update` HACE CUMPLIR
// el `where` (estado y «ningún evento `paid` fuera de los leídos»): si la fila no casa, P2025 y nada
// cambia. El webhook va tras `requireInternalSecret`: la cabecera sale de `internalHeaders()` del
// MISMO `dist/` que monta la app (mismo módulo, mismo secreto).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

/** Mutaciones que este fichero tiene que tumbar (A3, SCRUM-1731). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/system/invoiceAdmin.ts',
    de: "  return p?.origen === 'marcar_pagado_manual' && p?.invoiceId === invoiceId;",
    a: '  return true;',
    cae: 'deshacer_pago con el cobro pagado por una pasarela',
  },
];

const app = await montarAppReal();
after(() => app.cerrar());
const require = createRequire(import.meta.url);
const { internalHeaders } = require('../dist/core/http/internalAuth.js');

const MIO = 18032;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const FACTURA = 71;
const COBRO = 890;
const ANTES = new Date('2026-11-01T10:00:00.000Z');

/** El `where` de Prisma que usa este código: igualdades y `events.none` con `type` + `id.notIn`. */
function cumple(fila, where) {
  return Object.entries(where || {}).every(([k, v]) => {
    if (k === 'events' && v && typeof v === 'object' && v.none) {
      const { type, id } = v.none;
      return !(fila.eventos || []).some((e) => (type == null || e.type === type) && !(id?.notIn || []).includes(e.id));
    }
    return fila[k] === v;
  });
}

/** Programa la factura y (si `cobro`) su cobro enlazado; devuelve las dos filas, vivas. */
function programar({ factura = {}, chargeId = COBRO, cobro = { status: 'pending', method: 'bizum', paidAt: null, eventos: [] } } = {}) {
  const fila = cobro ? { id: COBRO, merchantId: MIO, ...cobro } : null;
  const fac = {
    id: FACTURA, merchantId: MIO, status: 'pending', paidAt: null, type: 'FACT', number: 'F-2026-0002',
    lines: [], total: 121, currency: 'EUR', chargeId, createdAt: ANTES, ...factura,
  };
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', flags: null, timezone: 'Europe/Madrid' }) },
    invoice: {
      findUnique: async (a) => (a?.where?.id === fac.id ? { ...fac, quote: null } : null),
      findFirst: async (a) => (cumple(fac, a?.where) ? { ...fac } : null),
      update: async (a) => ({ ...Object.assign(fac, a?.data), quote: null }),
    },
    charge: {
      findFirst: async (a) => {
        if (!fila) return null;
        if (!cumple(fila, a?.where)) return null;
        const tipo = a?.include?.events?.where?.type;
        return { ...fila, events: (fila.eventos || []).filter((e) => !tipo || e.type === tipo) };
      },
      update: async (a) => {
        if (!fila || !cumple(fila, a?.where)) throw Object.assign(new Error('no casa'), { code: 'P2025' });
        const { events, ...resto } = a.data;
        Object.assign(fila, resto, { evento: events?.create });
        return { ...fila };
      },
    },
  });
  return { cobro: fila, factura: fac };
}

const escriturasDeCobro = () => bancoDePrisma().escrituras.filter((e) => e.modelo === 'charge');

/** El webhook interno, con la cabecera del secreto (el arnés `pedir` no manda cabeceras propias). */
function avisoDePago(id) {
  return new Promise((resolver, rechazar) => {
    const p = http.request(`${app.base}/invoice/${id}/paid-webhook`, {
      method: 'POST', agent: false, headers: { ...internalHeaders(), 'content-length': 0 },
    }, (res) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('end', () => {
        const texto = Buffer.concat(trozos).toString('utf8');
        let json = null;
        try { json = JSON.parse(texto); } catch { /* texto */ }
        resolver({ status: res.statusCode, json, texto });
      });
    });
    p.on('error', rechazar);
    p.end();
  });
}
const deshacer = () => app.pedir(`/admin/invoices/${FACTURA}/status`, { token: ses.PROPIETARIO, metodo: 'PUT', cuerpo: { status: 'pending' } });

// ── b) el webhook ───────────────────────────────────────────────────────────────────────────

test('SCRUM-1803b · paid-webhook → el cobro pending pasa a paid con la MISMA fecha que la factura, evento paid y method intacto', async () => {
  const { cobro } = programar();
  const r = await avisoDePago(FACTURA);
  assert.equal(r.status, 200, `suelo: ${r.status} ${String(r.texto).slice(0, 200)}`);
  const fechaFactura = new Date(r.json?.invoice?.paidAt).getTime();
  assert.ok(Number.isFinite(fechaFactura), 'la factura no devolvió paidAt');
  assert.equal(cobro.status, 'paid', 'el webhook marcó la factura y dejó el cobro pending');
  assert.equal(new Date(cobro.paidAt).getTime(), fechaFactura, 'el cobro no lleva la fecha de la factura');
  assert.equal(cobro.evento?.type, 'paid');
  assert.equal(new Date(cobro.evento?.ts).getTime(), fechaFactura);
  assert.equal(cobro.method, 'bizum');
  assert.equal('method' in escriturasDeCobro()[0].args.data, false, 'el webhook no trae medio y escribió method');
});

test('SCRUM-1803b · paid-webhook · control: factura sin chargeId → ningún cobro se escribe', async () => {
  programar({ chargeId: null, cobro: null });
  const r = await avisoDePago(FACTURA);
  assert.equal(r.status, 200, `${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.deepEqual(escriturasDeCobro(), []);
});

test('SCRUM-1803b · paid-webhook · un cobro ya `cancelled` queda intacto', async () => {
  const { cobro } = programar({ cobro: { status: 'cancelled', method: 'card', paidAt: null, eventos: [] } });
  const r = await avisoDePago(FACTURA);
  assert.equal(r.status, 200);
  assert.equal(cobro.status, 'cancelled');
  assert.equal(cobro.evento, undefined);
});

// ── c) deshacer_pago ────────────────────────────────────────────────────────────────────────

const JUSTIFICANTE_PAGADO = { status: 'paid', paidAt: ANTES, type: 'JUST', number: 'J-2026-0001' };
const PAGO_MANUAL = { id: 501, type: 'paid', ts: ANTES, payload: { origen: 'marcar_pagado_manual', via: 'status', invoiceId: FACTURA } };
const PAGO_PSP = { id: 502, type: 'paid', ts: ANTES, payload: { event: 'payment.confirmed', chargeId: COBRO } };

test('SCRUM-1803b · deshacer_pago tras el marcado manual → el cobro vuelve a pending, paidAt null, evento unpaid', async () => {
  const { cobro } = programar({ factura: JUSTIFICANTE_PAGADO, cobro: { status: 'paid', method: 'transfer', paidAt: ANTES, eventos: [PAGO_MANUAL] } });
  const r = await deshacer();
  assert.equal(r.status, 200, `suelo: ${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.equal(cobro.status, 'pending', 'deshacer el pago dejó el cobro paid');
  assert.equal(cobro.paidAt, null);
  assert.equal(cobro.evento?.type, 'unpaid');
  assert.equal(cobro.evento?.payload?.invoiceId, FACTURA);
});

test('SCRUM-1803b · deshacer_pago con el cobro pagado por una pasarela → el cobro queda intacto', async () => {
  const { cobro, factura } = programar({ factura: JUSTIFICANTE_PAGADO, cobro: { status: 'paid', method: 'card', paidAt: ANTES, eventos: [PAGO_PSP] } });
  const r = await deshacer();
  assert.equal(r.status, 200, `el justificante no se des-pagó: ${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.equal(factura.status, 'pending', 'suelo: el justificante tenía que des-pagarse');
  assert.equal(cobro.status, 'paid');
  assert.equal(cobro.paidAt, ANTES);
  assert.equal(cobro.evento, undefined);
  assert.deepEqual(escriturasDeCobro(), []);
});

test('SCRUM-1803b · deshacer_pago con un pago manual Y otro de pasarela → el cobro queda intacto', async () => {
  const { cobro } = programar({ factura: JUSTIFICANTE_PAGADO, cobro: { status: 'paid', method: 'card', paidAt: ANTES, eventos: [PAGO_MANUAL, PAGO_PSP] } });
  const r = await deshacer();
  assert.equal(r.status, 200);
  assert.equal(cobro.status, 'paid');
  assert.deepEqual(escriturasDeCobro(), []);
});

test('SCRUM-1803b · deshacer_pago · control: justificante sin chargeId → ningún cobro se lee ni se escribe', async () => {
  programar({ factura: JUSTIFICANTE_PAGADO, chargeId: null, cobro: null });
  const r = await deshacer();
  assert.equal(r.status, 200, `${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.deepEqual(escriturasDeCobro(), []);
});
