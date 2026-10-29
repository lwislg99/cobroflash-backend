// tests/scrum1622-zona-del-comercio.test.mjs — SCRUM-1622, pieza 2 (de SCRUM-1522)
//
// `Europe/Madrid` estaba escrito a mano en tres sitios en lugar de la zona del comercio
// (`core/zonaDelMerchant.ts`): el «hoy» de la lectura de tickets, las horas tranquilas del ciclo
// de mantenimientos y el «¿cruza días?» de la ventana de firma. Un comercio canario vivía con el
// reloj de la península en los tres.
//
// Los instantes se eligen donde Madrid y Canarias marcan DISTINTO (Canarias va una hora detrás
// todo el año), así que cada caso «rojo» cae con la zona fija y pasa con la del comercio. Los
// casos de Madrid son el control: con Madrid, el resultado no cambia.
//
// Sin base y sin red: el ciclo corre con el doble mínimo de `scrum929`.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../dist/modules/expenses/domain/lecturaTicket.js';
import * as M from '../dist/modules/maintenance/domain/maintenance.service.js';
import { cruzaDias } from '../dist/modules/jobs/domain/ventanaDeFirma.js';

const CANARIAS = 'Atlantic/Canary';
const MADRID = 'Europe/Madrid';

// ── ① La lectura del ticket: «hoy» es el día del comercio ──────────────────────────────────
// 18-sep 22:30Z: en Madrid ya es 19 (00:30); en Canarias todavía es 18 (23:30).
const NOCHE = new Date('2026-09-18T22:30:00Z');

test('SCRUM-1622 · ① el «hoy» de la lectura es el del comercio, no el de Madrid', () => {
  assert.equal(L.hoyDelComercio(NOCHE, CANARIAS), '2026-09-18');
  assert.equal(L.hoyDelComercio(NOCHE, MADRID), '2026-09-19');
  assert.equal(L.hoyDelComercio(NOCHE, 'UTC'), '2026-09-18');
});

test('SCRUM-1622 · ① un ticket del 19 es FUTURO para un canario a las 23:30 del 18', () => {
  assert.deepEqual(L.sanearLectura({ fecha: '2026-09-19' }, NOCHE, CANARIAS).descartados,
    [{ campo: 'date', motivo: 'fecha_futura' }],
    '🔴 en Canarias aún es 18: un ticket del 19 no puede existir todavía.');
  // Control: en Madrid ya es 19, y el mismo ticket vale.
  assert.deepEqual(L.sanearLectura({ fecha: '2026-09-19' }, NOCHE, MADRID).descartados, []);
});

test('SCRUM-1622 · ① sin zona no se cae al reloj del proceso: se rechaza', () => {
  assert.throws(() => L.sanearLectura({ fecha: '2026-09-01' }, NOCHE), /zona_requerida/);
  assert.throws(() => L.hoyDelComercio(NOCHE, undefined), /zona_requerida/);
});

// ── ② Horas tranquilas del ciclo de mantenimientos: 9-21 h del comercio ────────────────────
// 17-sep 19:30Z: en Madrid son las 21:30 (tranquila); en Canarias las 20:30 (no).
const TARDE = new Date('2026-09-17T19:30:00Z');

test('SCRUM-1622 · ② las horas tranquilas son las del comercio', () => {
  assert.equal(M.isQuietHours(TARDE, MADRID), true);
  assert.equal(M.isQuietHours(TARDE, CANARIAS), false);
  assert.throws(() => M.isQuietHours(TARDE, undefined), /zona_requerida/);
});

const PLAN = {
  id: 7, merchantId: 2, customerId: 30, quoteId: null,
  title: 'Revisión de termo/calentador', intervalMonths: 12,
  nextDueAt: new Date('2026-09-16T00:00:00Z'), active: true,
  lastProposedAt: null, rejectedStreak: 0,
};

/** El doble de `scrum929`, con la zona del comercio y, si se pide, el cliente sin canal. */
function base(zona, { sinCanal = false } = {}) {
  const quotesCreadas = [];
  const eventos = [];
  const tx = {
    $executeRaw: async () => 1,
    merchant: {
      findUnique: async () => ({ id: 2, nextQuoteNumber: 7, quoteSeriesYear: 2026 }),
      update: async () => ({}),
    },
    quote: { create: async ({ data }) => { quotesCreadas.push(data); return { id: 991, ...data }; } },
  };
  const db = {
    customer: {
      findMany: async () => (sinCanal ? [{ id: 30, merchantId: 2 }] : []),
      findUnique: async () => ({ id: 30, name: 'Cliente QA', phone: '34000000030', waOptOut: false, merchantId: 2 }),
    },
    maintenancePlan: {
      findMany: async ({ where }) => (sinCanal === Boolean(where?.customerId?.in) ? [PLAN] : []),
      aggregate: async () => ({ _max: { lastProposedAt: null } }),
      update: async () => ({}),
    },
    merchant: {
      findUnique: async () => ({
        id: 2, name: 'QA', country: 'ES', flags: { MAINTENANCE_ENABLED: true },
        whatsappPhone: null, trade: 'fontanero', timezone: zona,
      }),
    },
    quote: { findUnique: async () => ({ lines: [] }) },
    $transaction: async (fn) => fn(tx),
  };
  const deps = { prisma: db, recordCustomerEvent: async (e) => { eventos.push(e); } };
  return { deps, quotesCreadas, eventos };
}

test('SCRUM-1622 · ② a las 20:30 de Canarias el ciclo SÍ propone al comercio canario', async () => {
  const { deps, quotesCreadas } = base(CANARIAS);
  const r = await M.runMaintenanceProposals(TARDE, deps);
  assert.equal(r.proposed, 1, `🔴 se trató como hora tranquila de Madrid: ${JSON.stringify(r)}`);
  assert.equal(quotesCreadas.length, 1);
});

test('SCRUM-1622 · ② a las 21:30 de Madrid el comercio peninsular sigue en hora tranquila (control)', async () => {
  const { deps, quotesCreadas } = base(MADRID);
  const r = await M.runMaintenanceProposals(TARDE, deps);
  assert.equal(r.proposed, 0);
  assert.equal(quotesCreadas.length, 0);
  assert.ok(r.skipped.some((s) => /quiet_hours/.test(s)), JSON.stringify(r));
});

// La mitad canaria de este caso (el aviso SÍ se registra) no se mira aquí: `avisarPlanSinCanal`
// corre con sus dependencias reales —el bucle no le pasa las suyas— y eso pide base.
test('SCRUM-1622 · ② el aviso de «sin canal» se salta plan a plan en la hora tranquila de SU comercio', async () => {
  const madrid = base(MADRID, { sinCanal: true });
  const r = await M.runMaintenanceProposals(TARDE, madrid.deps);
  assert.equal(madrid.eventos.length, 0, 'en hora tranquila de Madrid no se registra el aviso');
  assert.deepEqual(r.skipped, ['plan 7: quiet_hours'], JSON.stringify(r));
});

// ── ③ ¿La ventana de firma cruza días? En el calendario del comercio ───────────────────────
// 22:30Z → 23:30Z: en Madrid, 00:30 y 01:30 del 19 (mismo día); en Canarias, 23:30 del 18 y
// 00:30 del 19 (cruza).
const VENTANA = {
  suelo: new Date('2026-09-18T22:30:00Z'), fuenteSuelo: 'albaran_creado',
  techo: new Date('2026-09-18T23:30:00Z'), anchoMs: 3_600_000,
};

test('SCRUM-1622 · ③ cruzaDias no supone Madrid: sin zona se rechaza', () => {
  assert.throws(() => cruzaDias(VENTANA), /zona_requerida/,
    '🔴 sin zona contestó con el calendario de Madrid, que nadie ha declarado.');
  assert.equal(cruzaDias(VENTANA, CANARIAS), true);
  assert.equal(cruzaDias(VENTANA, MADRID), false);
});
