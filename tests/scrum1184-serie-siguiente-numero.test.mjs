// tests/scrum1184-serie-siguiente-numero.test.mjs — SCRUM-1184 (trozo 1, servidor)
//
// `GET /admin/albaranes/serie` → `{ siguiente: 'AB260005' }`, para «Siguiente número: AB260005.»
// (firmado en SCRUM-1184 c.17342). El contrato lo consume la pantalla de S2 en el MISMO PR.
//
// Lo que se mide:
//   · 🔴 el AÑO sale de la zona del MERCHANT, no del reloj del proceso: en Nochevieja, a las 23:30
//     UTC, en Madrid ya es el año siguiente y el alta emitiría AB270001, no AB260005;
//   · con el contador movido sin año, 409 `serie_sin_anio` y NINGÚN número (falla cerrado);
//   · la ruta real responde exactamente `{ siguiente }`, y NO escribe (no reserva número).
import test from 'node:test';
import assert from 'node:assert/strict';

const { siguienteNumeroDeAlbaran } = await import('../dist/modules/jobs/domain/albaranSerie.js');
const { AlbaranSerieSinAnioError } = await import('../dist/modules/jobs/domain/albaranNumber.service.js');
const moduloPrisma = await import('../dist/core/db/prisma.js');
const modRutas = await import('../dist/modules/jobs/app/routes/albaranes.routes.js');
const router = modRutas.default?.default ?? modRutas.default;

const base = (m) => ({ merchant: { findUnique: async () => m } });
const NOCHEVIEJA = new Date('2026-12-31T23:30:00Z');

test('SCRUM-1184 · el siguiente número del año en curso (control positivo)', async () => {
  const m = { nextAlbaranNumber: 5, albaranSeriesYear: 2026, timezone: 'Europe/Madrid' };
  assert.equal(await siguienteNumeroDeAlbaran(base(m), 7, new Date('2026-09-28T10:00:00Z')), 'AB260005');
});

test('🔴 SCRUM-1184 · Nochevieja: el año es el de la ZONA del merchant, como en el alta', async () => {
  const m = { nextAlbaranNumber: 5, albaranSeriesYear: 2026, timezone: 'Europe/Madrid' };
  assert.equal(await siguienteNumeroDeAlbaran(base(m), 7, NOCHEVIEJA), 'AB270001',
    '🔴 la vista previa usa el reloj del proceso: enseña el número de un año que en Madrid ya acabó');
  // Y sin zona declarada cae a UTC, igual que `allocateAlbaranNumber` (SCRUM-1093).
  assert.equal(await siguienteNumeroDeAlbaran(base({ ...m, timezone: null }), 7, NOCHEVIEJA), 'AB260005');
});

test('SCRUM-1184 · contador movido sin año → propaga el error, nunca un número', async () => {
  const m = { nextAlbaranNumber: 50, albaranSeriesYear: null, timezone: null };
  await assert.rejects(() => siguienteNumeroDeAlbaran(base(m), 7), AlbaranSerieSinAnioError);
});

async function llamarRuta(merchant) {
  const escrituras = [];
  const original = moduloPrisma.prisma.merchant;
  moduloPrisma.prisma.merchant = {
    findUnique: async () => merchant,
    update: async (a) => { escrituras.push(a); return merchant; },
  };
  try {
    const capa = router.stack.find((l) => l.route?.path === '/serie' && l.route?.methods?.get);
    assert.ok(capa, '🔴 GET /serie no está en el router de albaranes');
    // Tiene que ir ANTES de `GET /:id`, o `/serie` lo captura la ficha de un albarán.
    const iSerie = router.stack.indexOf(capa);
    const iId = router.stack.findIndex((l) => l.route?.path === '/:id' && l.route?.methods?.get);
    assert.ok(iId === -1 || iSerie < iId, '🔴 `/serie` va detrás de `/:id`: nunca se alcanzaría');
    let salida = null;
    const res = {
      status(c) { this._c = c; return this; },
      json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    };
    const h = capa.route.stack;
    await h[h.length - 1].handle({ merchantId: 7, query: {}, params: {} }, res, () => {});
    return { salida, escrituras };
  } finally {
    moduloPrisma.prisma.merchant = original;
  }
}

test('SCRUM-1184 · la ruta real: 200 { siguiente } y no escribe nada', async () => {
  const { salida, escrituras } = await llamarRuta({ nextAlbaranNumber: 12, albaranSeriesYear: new Date().getUTCFullYear(), timezone: null });
  assert.equal(salida.code, 200);
  assert.deepEqual(Object.keys(salida.body), ['siguiente'], '🔴 la forma cambió: la pantalla de S2 lee SOLO `siguiente`');
  assert.match(salida.body.siguiente, /^AB\d{6}$/);
  assert.deepEqual(escrituras, [], '🔴 la vista previa ha avanzado el contador');
});

test('SCRUM-1184 · la ruta real: contador sin año → 409 serie_sin_anio, sin número ni texto', async () => {
  const { salida } = await llamarRuta({ nextAlbaranNumber: 50, albaranSeriesYear: null, timezone: null });
  assert.equal(salida.code, 409);
  assert.deepEqual(salida.body, { error: 'serie_sin_anio' });
});
