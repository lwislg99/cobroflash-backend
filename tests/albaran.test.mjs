// SCRUM-14 (ALBARAN-1) — numeración ALB, validación de líneas, FSM/lock y tenancy.
// Parte pura SIEMPRE corre (contra dist/); la parte de BD+HTTP va gateada como
// tenancy-permisos.test.mjs:  QA_DB_TEST=1 npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  formatAlbaranNumber,
  resolveAlbaranSeq,
  allocateAlbaranNumber,
  isAlbaranNumber,
} from '../dist/modules/jobs/domain/albaranNumber.service.js';
import {
  canTransitionAlbaran,
  validarLineas,
} from '../dist/modules/jobs/domain/albaran.service.js';

// ── Numeración (pura) ────────────────────────────────────────────────────────
test('formatAlbaranNumber: ALB-2026-001 y sin truncar >999', () => {
  assert.equal(formatAlbaranNumber(2026, 1), 'ALB-2026-001');
  assert.equal(formatAlbaranNumber(2026, 42), 'ALB-2026-042');
  assert.equal(formatAlbaranNumber(2026, 1234), 'ALB-2026-1234');
});

test('isAlbaranNumber distingue la serie ALB de la fiscal y la J-', () => {
  assert.equal(isAlbaranNumber('ALB-2026-001'), true);
  assert.equal(isAlbaranNumber('2026-CF-001'), false);
  assert.equal(isAlbaranNumber('J-20260713-ABCD'), false);
  assert.equal(isAlbaranNumber(null), false);
});

test('resolveAlbaranSeq: continúa en el mismo año, resetea al cambiar y con serie nueva', () => {
  assert.equal(resolveAlbaranSeq({ albaranSeriesYear: 2026, nextAlbaranNumber: 8 }, 2026), 8);
  assert.equal(resolveAlbaranSeq({ albaranSeriesYear: 2026, nextAlbaranNumber: 8 }, 2027), 1);
  assert.equal(resolveAlbaranSeq({ albaranSeriesYear: null, nextAlbaranNumber: 5 }, 2026), 1);
});

test('allocateAlbaranNumber: correlativo y avanza el contador (tx mock)', async () => {
  const updates = [];
  const state = { nextAlbaranNumber: 1, albaranSeriesYear: null };
  const tx = {
    merchant: {
      findUnique: async () => ({ id: 7, ...state }),
      update: async ({ data }) => { Object.assign(state, data); updates.push(data); return state; },
    },
  };
  const now = new Date('2026-07-13T12:00:00Z');
  assert.equal(await allocateAlbaranNumber(tx, 7, now), 'ALB-2026-001');
  assert.equal(await allocateAlbaranNumber(tx, 7, now), 'ALB-2026-002');
  assert.equal(state.nextAlbaranNumber, 3);
  assert.equal(state.albaranSeriesYear, 2026);
  // Cambio de año → serie nueva desde 1
  assert.equal(await allocateAlbaranNumber(tx, 7, new Date('2027-01-02T09:00:00Z')), 'ALB-2027-001');
  assert.equal(updates.length, 3);
});

test('allocateAlbaranNumber: merchant inexistente lanza', async () => {
  const tx = { merchant: { findUnique: async () => null, update: async () => { throw new Error('no'); } } };
  await assert.rejects(() => allocateAlbaranNumber(tx, 999), /merchant_not_found/);
});

// ── FSM / lock (Parte L) ─────────────────────────────────────────────────────
test('canTransitionAlbaran: borrador→emitido→firmado y nada más', () => {
  assert.equal(canTransitionAlbaran('borrador', 'emitido'), true);
  assert.equal(canTransitionAlbaran('emitido', 'firmado'), true);
  assert.equal(canTransitionAlbaran('borrador', 'firmado'), false); // firmar exige emitido
  assert.equal(canTransitionAlbaran('firmado', 'emitido'), false);  // firmado es terminal
  assert.equal(canTransitionAlbaran('firmado', 'borrador'), false);
  assert.equal(canTransitionAlbaran('emitido', 'borrador'), false);
});

// ── Validación de líneas (condición 4 del OK del fundador) ──────────────────
test('validarLineas: shape correcto pasa y se normaliza (trim)', () => {
  const r = validarLineas([{ concepto: '  Tubo PVC 32mm ', cantidad: '2', unidad: ' m ' }]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.lineas, [{ concepto: 'Tubo PVC 32mm', cantidad: 2, unidad: 'm' }]);
});

test('validarLineas: rechaza concepto vacío, cantidad <=0 o no numérica y unidad no-string', () => {
  assert.equal(validarLineas([{ concepto: '', cantidad: 1, unidad: 'ud' }]).ok, false);
  assert.equal(validarLineas([{ concepto: 'X', cantidad: 0, unidad: 'ud' }]).ok, false);
  assert.equal(validarLineas([{ concepto: 'X', cantidad: -3, unidad: 'ud' }]).ok, false);
  assert.equal(validarLineas([{ concepto: 'X', cantidad: 'tres', unidad: 'ud' }]).ok, false);
  assert.equal(validarLineas([{ concepto: 'X', cantidad: 1, unidad: 7 }]).ok, false);
  assert.equal(validarLineas('no-array').ok, false);
});

test('validarLineas: unidad vacía es válida (string) y array vacío también', () => {
  assert.equal(validarLineas([{ concepto: 'X', cantidad: 1, unidad: '' }]).ok, true);
  assert.equal(validarLineas([]).ok, true);
});

// ── Tenancy + flujo HTTP real (gateado, patrón tenancy-permisos.test.mjs) ───
const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-14: tenancy del albarán + lock de firmado end-to-end', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const mkMerchant = (tag) =>
    prisma.merchant.create({
      data: { name: `QA Alb ${tag}`, country: 'ES', email: `qa-alb-${tag}-${stamp}@test.local`, onboardingCompleted: true },
    });

  const merchantA = await mkMerchant('A');
  const merchantB = await mkMerchant('B');
  const customerA = await prisma.customer.create({
    data: { merchantId: merchantA.id, name: 'Cliente Alb A', phone: `34600${stamp % 1000000}` },
  });
  const jobA = await prisma.job.create({
    data: { merchantId: merchantA.id, customerId: customerA.id, status: 'pendiente_agendar', titulo: 'Trabajo QA Alb' },
  });

  const mkCookie = async (merchantId) => {
    const token = 'qa14-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  try {
    const cookieA = await mkCookie(merchantA.id);
    const cookieB = await mkCookie(merchantB.id);
    const jsonReq = (url, cookie, method = 'GET', body) =>
      fetch(`${base}${url}`, {
        method,
        headers: { cookie, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

    // A crea 2 albaranes → correlativos en SU serie
    const r1 = await jsonReq(`/admin/jobs/${jobA.id}/albaranes`, cookieA, 'POST', {});
    assert.equal(r1.status, 201);
    const alb1 = await r1.json();
    assert.match(alb1.numero, /^ALB-\d{4}-001$/);
    const r2 = await jsonReq(`/admin/jobs/${jobA.id}/albaranes`, cookieA, 'POST', {});
    const alb2 = await r2.json();
    assert.match(alb2.numero, /^ALB-\d{4}-002$/);

    // Validación de líneas → 400
    const rBad = await jsonReq(`/admin/albaranes/${alb1.id}`, cookieA, 'PATCH', { lineas: [{ concepto: '', cantidad: 1, unidad: 'ud' }] });
    assert.equal(rBad.status, 400);

    // Edición válida → version 2
    const rEdit = await jsonReq(`/admin/albaranes/${alb1.id}`, cookieA, 'PATCH', { lineas: [{ concepto: 'Mano de obra', cantidad: 3, unidad: 'h' }] });
    assert.equal(rEdit.status, 200);
    assert.equal((await rEdit.json()).version, 2);

    // TENANCY: B no ve ni toca el albarán de A → 404 SIEMPRE, jamás datos
    for (const [m, url, body] of [
      ['PATCH', `/admin/albaranes/${alb1.id}`, { notas: 'intruso' }],
      ['POST', `/admin/albaranes/${alb1.id}/emitir`, undefined],
      ['POST', `/admin/albaranes/${alb1.id}/firmar`, { signatureData: 'data:image/png;base64,aaaa' }],
      ['GET', `/admin/albaranes/${alb1.id}/pdf`, undefined],
      ['GET', `/admin/albaranes/${alb1.id}/fotos`, undefined],
      ['POST', `/admin/jobs/${jobA.id}/albaranes`, {}],
    ]) {
      const rB = await jsonReq(url, cookieB, m, body);
      assert.equal(rB.status, 404, `${m} ${url} con sesión B debería ser 404 y fue ${rB.status}`);
    }

    // Firmar exige emitido → 409; emitir → firmar → congelado (PATCH 409 albaran_locked)
    const rSignEarly = await jsonReq(`/admin/albaranes/${alb1.id}/firmar`, cookieA, 'POST', { signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' });
    assert.equal(rSignEarly.status, 409);
    assert.equal((await jsonReq(`/admin/albaranes/${alb1.id}/emitir`, cookieA, 'POST')).status, 200);
    const rSign = await jsonReq(`/admin/albaranes/${alb1.id}/firmar`, cookieA, 'POST', { signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' });
    assert.equal(rSign.status, 200);
    const rLocked = await jsonReq(`/admin/albaranes/${alb1.id}`, cookieA, 'PATCH', { notas: 'tarde' });
    assert.equal(rLocked.status, 409);
    assert.equal((await rLocked.json()).error, 'albaran_locked');
  } finally {
    // Limpieza efímera (orden: hijos → padres)
    await prisma.albaran.deleteMany({ where: { merchantId: merchantA.id } });
    await prisma.job.deleteMany({ where: { merchantId: merchantA.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchantA.id } });
    await prisma.authSession.deleteMany({ where: { merchantId: { in: [merchantA.id, merchantB.id] } } });
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantA.id, merchantB.id] } } });
    server.close();
  }
});
