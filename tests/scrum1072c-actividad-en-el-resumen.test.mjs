// tests/scrum1072c-actividad-en-el-resumen.test.mjs — SCRUM-1072c (punto 6 de SCRUM-1072)
//
// «Si existe el Resumen del trimestre, la respuesta de tipo de actividad sale allí.» Existe, y lo
// pide Informes a `GET /admin/reports/resumen-trimestre`, así que la actividad viaja en ESA
// respuesta (decisión del orquestador, 17-oct: un campo en una ruta que la vista ya pide, en vez
// de una petición más a `/admin/merchant`). Esta mitad es sólo servidor; pintarla es de S2.
//
// Lo que se ata:
//   ① los CUATRO estados llegan tal cual y no colapsan: `profesional`, `empresarial`,
//      `no_lo_se` y `null` («nunca se le preguntó», que NO es «No lo sé»);
//   ② se lee del merchant de la SESIÓN y sólo esa columna (multi-tenant, sin arrastrar el NIF);
//   ③ no mueve ninguna otra cifra del resumen: la respuesta es la misma salvo ese campo.
//
// Handler REAL, `prisma` SUSTITUIDO (mismo arnés que scrum1151): sin red y sin base.
import test from 'node:test';
import assert from 'node:assert/strict'; import { reqDeSesion } from './_arnes-de-router.mjs';

const DIST = '../dist/';

let router;
test.before(async () => {
  const mod = await import(DIST + 'modules/reports/app/routes/reports.routes.js');
  router = mod.default?.stack ? mod.default : mod.default?.default;
  assert.ok(router?.stack, '🔴 no he podido cargar el router de Informes.');
});

function llamarResumen(merchantId) {
  const capa = router.stack.find((l) => l.route?.path === '/resumen-trimestre');
  assert.ok(capa, '🔴 la ruta /resumen-trimestre ya no existe en el router de Informes.');
  return new Promise((resolve, reject) => {
    capa.route.stack[0].handle(
      reqDeSesion({ rol: 'admin', merchantId, query: { year: 2026, quarter: 3 } }),
      { json: resolve, status: (c) => ({ json: (b) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }) },
      reject,
    );
  });
}

const GASTO = { id: 1, merchantId: 42, date: new Date('2026-08-01'), concept: 'a', amount: '121.00', currency: 'EUR', providerId: null, baseAmount: '100.00', vatRate: 21, vatAmount: '21.00', vatDeducible: true, providerInvoiceNumber: null, providerInvoiceDate: null };

/** Corre el handler con un merchant cuya actividad es `actividad`; devuelve respuesta y llamadas. */
async function conActividad(actividad, merchantId = 42) {
  const moduloPrisma = await import(DIST + 'core/db/prisma.js');
  const p = moduloPrisma.prisma;
  const original = { expense: p.expense, invoice: p.invoice, quote: p.quote, albaran: p.albaran, merchant: p.merchant };
  const llamadas = [];
  p.expense = { findMany: async () => [GASTO] };
  p.invoice = { findMany: async () => [] };
  p.quote = { findMany: async () => [] };
  p.albaran = { findMany: async () => [] };
  p.merchant = {
    findUnique: async (args) => {
      llamadas.push(args);
      // El doble sólo contesta por SU merchant: si la ruta preguntara por otro, saldría null y ① caería.
      return args?.where?.id === merchantId ? { activityKind: actividad } : null;
    },
  };
  try {
    return { r: await llamarResumen(merchantId), llamadas };
  } finally {
    Object.assign(p, original);
  }
}

test('① SCRUM-1072c · los cuatro estados de la actividad llegan tal cual, sin colapsar', async () => {
  const vistos = [];
  for (const actividad of ['profesional', 'empresarial', 'no_lo_se', null]) {
    const { r } = await conActividad(actividad);
    assert.ok(Object.hasOwn(r, 'activityKind'), '🔴 la respuesta no lleva activityKind');
    assert.equal(r.activityKind, actividad);
    vistos.push(r.activityKind);
  }
  assert.equal(new Set(vistos).size, 4, 'SUELO: dos estados distintos han salido iguales');
});

test('② SCRUM-1072c · se lee del merchant de la sesión, y sólo la columna activityKind', async () => {
  const { llamadas } = await conActividad('empresarial', 77);
  assert.equal(llamadas.length, 1, `una lectura del merchant, no ${llamadas.length}`);
  assert.deepEqual(llamadas[0].where, { id: 77 });
  assert.deepEqual(llamadas[0].select, { activityKind: true },
    '🔴 la ruta trae más columnas del merchant de las que devuelve');
});

test('③ SCRUM-1072c · la actividad no mueve ninguna otra cifra del resumen', async () => {
  const { r: a } = await conActividad('profesional');
  const { r: b } = await conActividad(null);
  const { activityKind: ka, ...restoA } = a;
  const { activityKind: kb, ...restoB } = b;
  assert.notEqual(ka, kb, 'SUELO: las dos pasadas tienen que diferir en la actividad');
  assert.deepEqual(restoA, restoB);
  assert.ok(restoA.ivaSoportado, 'SUELO: el resumen no ha llegado a calcularse');
});
