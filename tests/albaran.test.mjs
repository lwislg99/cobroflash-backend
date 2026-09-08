// SCRUM-14 (ALBARAN-1) — numeración ALB, validación de líneas, FSM/lock y tenancy.
// Parte pura SIEMPRE corre (contra dist/); la parte de BD+HTTP va gateada como
// tenancy-permisos.test.mjs:  QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import fs from 'node:fs';
import path from 'node:path';
import {
  formatAlbaranNumber,
  resolveAlbaranSeq,
  allocateAlbaranNumber,
  isAlbaranNumber,
} from '../dist/modules/jobs/domain/albaranNumber.service.js';
import {
  canTransitionAlbaran,
  validarLineas,
  calcAlbaranTotales,
} from '../dist/modules/jobs/domain/albaran.service.js';

// ── Numeración (pura) ────────────────────────────────────────────────────────
// 🔴 SCRUM-592 (DOC-02) · el formato pasa a `AB260001`. El de antes —`ALB-2026-001`— sigue
// RECONOCIÉNDOSE mientras haya bases sin renumerar (lo fija el test de `isAlbaranNumber` justo
// debajo), pero ya no se emite: una sola numeración, no dos formatos conviviendo.
test('formatAlbaranNumber: AB260001, y al desbordar CRECE en vez de truncarse', () => {
  assert.equal(formatAlbaranNumber(2026, 1), 'AB260001');
  assert.equal(formatAlbaranNumber(2026, 42), 'AB260042');
  assert.equal(formatAlbaranNumber(2026, 1234), 'AB261234');
  // Truncar daría dos albaranes con el mismo número, y ese número se cita en la recapitulativa.
  assert.equal(formatAlbaranNumber(2026, 12345), 'AB2612345');
});

test('isAlbaranNumber distingue LAS DOS formas de la serie, de la fiscal y de la J-', () => {
  assert.equal(isAlbaranNumber('AB260001'), true);
  // 🔴 EL VIEJO SIGUE RECONOCIÉNDOSE, y este caso casi se pierde: al sustituir el formato en los
  // asserts se cambió también éste, que es justo el que vigila la transición. Mientras haya bases
  // sin renumerar —producción espera a que el fundador decida—, un lector que sólo conozca la
  // forma nueva daría por «no es un albarán» a documentos que sí lo son.
  assert.equal(isAlbaranNumber('ALB-2026-001'), true);
  assert.equal(isAlbaranNumber('2026-CF-001'), false);
  assert.equal(isAlbaranNumber('J-20260713-ABCD'), false);
  assert.equal(isAlbaranNumber('P260001'), false, '🔴 confunde un PRESUPUESTO con un albarán');
  assert.equal(isAlbaranNumber(null), false);
});

test('resolveAlbaranSeq: continúa en el mismo año, resetea al cambiar y con serie nueva', () => {
  assert.equal(resolveAlbaranSeq({ albaranSeriesYear: 2026, nextAlbaranNumber: 8 }, 2026), 8);
  assert.equal(resolveAlbaranSeq({ albaranSeriesYear: 2026, nextAlbaranNumber: 8 }, 2027), 1);

  // ⚠️ SCRUM-306 (C7) · ESTE CASO ESTABA MAL Y FIJABA LA TRAMPA COMO COMPORTAMIENTO ESPERADO.
  //
  // Decía `{ albaranSeriesYear: null, nextAlbaranNumber: 5 }` → 1, bajo el rótulo «con serie
  // nueva». Pero un contador en 5 NO es una serie nueva: es una serie a la que alguien le movió el
  // número sin fijar el año. Este assert hacía que el reinicio silencioso pareciera deliberado — y
  // un test que dice lo que no es cuesta más que no tenerlo, porque el siguiente que lo lea creerá
  // que está decidido.
  //
  // La serie NUEVA de verdad es el merchant recién creado: año nulo y contador en 1.
  assert.equal(resolveAlbaranSeq({ albaranSeriesYear: null, nextAlbaranNumber: 1 }, 2026), 1);
  // Y el contador movido sin año falla en vez de reiniciar (detalle en scrum306-serie-albaranes).
  assert.throws(() => resolveAlbaranSeq({ albaranSeriesYear: null, nextAlbaranNumber: 5 }, 2026));
});

test('allocateAlbaranNumber: correlativo y avanza el contador (tx mock)', async () => {
  const updates = [];
  const state = { nextAlbaranNumber: 1, albaranSeriesYear: null };
  // SCRUM-234: el mock tiene que modelar `$executeRaw` porque la reserva ahora toma un
  // advisory lock ANTES de leer. Y en vez de un no-op, lo REGISTRA: así este test pasa a
  // comprobar también que el cerrojo se toma, que es lo que impide la carrera de serie.
  const cerrojos = [];
  const tx = {
    $executeRaw: async (plantilla) => { cerrojos.push(String(plantilla?.strings?.join('?') ?? plantilla)); return 0; },
    merchant: {
      findUnique: async () => ({ id: 7, ...state }),
      update: async ({ data }) => { Object.assign(state, data); updates.push(data); return state; },
    },
  };
  const now = new Date('2026-07-13T12:00:00Z');
  // SCRUM-592 (DOC-02): mismo comportamiento —correlativo y con cerrojo—, formato nuevo.
  assert.equal(await allocateAlbaranNumber(tx, 7, now), 'AB260001');
  assert.equal(await allocateAlbaranNumber(tx, 7, now), 'AB260002');
  assert.equal(state.nextAlbaranNumber, 3);
  // SCRUM-234: una reserva, un cerrojo. Si esto baja a 0, la carrera está de vuelta.
  assert.equal(cerrojos.length, 2, 'cada reserva de serie toma su advisory lock');
  assert.ok(
    cerrojos.every((c) => /pg_advisory_xact_lock/.test(c)),
    'el cerrojo tiene que ser pg_advisory_xact_lock, no otra sentencia cualquiera',
  );
  assert.equal(state.albaranSeriesYear, 2026);
  // Cambio de año → serie nueva desde 1
  assert.equal(await allocateAlbaranNumber(tx, 7, new Date('2027-01-02T09:00:00Z')), 'AB270001');
  assert.equal(updates.length, 3);
});

test('allocateAlbaranNumber: merchant inexistente lanza', async () => {
  // SCRUM-234: `$executeRaw` hace falta porque el cerrojo se toma ANTES del findUnique; sin él
  // este test fallaría por el mock y no por el merchant inexistente, que es lo que mide.
  const tx = { $executeRaw: async () => 0, merchant: { findUnique: async () => null, update: async () => { throw new Error('no'); } } };
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

// ── SCRUM-65: albarán VALORADO (precios e IVA opcionales) ───────────────────
test('validarLineas SIN_VALORAR (default): rechaza precio o IVA si llegan', () => {
  const conPrecio = validarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud', precioUnitario: 10 }]);
  assert.equal(conPrecio.ok, false);
  const conIva = validarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud', tipoIva: 21 }], 'SIN_VALORAR');
  assert.equal(conIva.ok, false);
  // Sin precio/IVA sigue pasando igual que siempre (comportamiento intacto)
  assert.equal(validarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud' }], 'SIN_VALORAR').ok, true);
});

test('validarLineas VALORADO: exige precioUnitario y tipoIva en TODAS las líneas', () => {
  const faltaPrecio = validarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud', tipoIva: 21 }], 'VALORADO');
  assert.equal(faltaPrecio.ok, false);
  const faltaIva = validarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud', precioUnitario: 10 }], 'VALORADO');
  assert.equal(faltaIva.ok, false);
  const precioNegativo = validarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud', precioUnitario: -5, tipoIva: 21 }], 'VALORADO');
  assert.equal(precioNegativo.ok, false);
  const ivaFueraDeRango = validarLineas([{ concepto: 'X', cantidad: 1, unidad: 'ud', precioUnitario: 10, tipoIva: 101 }], 'VALORADO');
  assert.equal(ivaFueraDeRango.ok, false);

  const ok = validarLineas([{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precioUnitario: 45, tipoIva: 21 }], 'VALORADO');
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.lineas, [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precioUnitario: 45, tipoIva: 21 }]);
});

test('validarLineas VALORADO: dos líneas, una sin precio → rechaza con el nº de línea exacto', () => {
  const r = validarLineas([
    { concepto: 'Con precio', cantidad: 1, unidad: 'ud', precioUnitario: 10, tipoIva: 21 },
    { concepto: 'Sin precio', cantidad: 1, unidad: 'ud' },
  ], 'VALORADO');
  assert.equal(r.ok, false);
  assert.match(r.error, /línea 2/);
});

test('calcAlbaranTotales: aritmética en céntimos enteros, sin desglose por tipo de IVA', () => {
  // 2h a 45€ (21% IVA) + 1 material a 100€ (10% IVA) — caso del brief (verificación con caso 50/50 análogo)
  const t = calcAlbaranTotales([
    { concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precioUnitario: 45, tipoIva: 21 },
    { concepto: 'Material', cantidad: 1, unidad: 'ud', precioUnitario: 100, tipoIva: 10 },
  ]);
  // base: 90 + 100 = 190 · cuota: 18.90 + 10.00 = 28.90 · total: 218.90
  assert.equal(t.base, 190);
  assert.equal(t.cuota, 28.9);
  assert.equal(t.total, 218.9);
  assert.equal(t.baseCents, 19000);
  assert.equal(t.totalCents, 21890);
});

test('calcAlbaranTotales: céntimo impar no se pierde por redondeo de floats (0.1+0.2 clásico)', () => {
  // 3 líneas de cantidad fraccionaria que en float puro arrastran error de redondeo
  const t = calcAlbaranTotales([
    { concepto: 'A', cantidad: 1.1, unidad: 'h', precioUnitario: 10, tipoIva: 0 },
    { concepto: 'B', cantidad: 1.1, unidad: 'h', precioUnitario: 10, tipoIva: 0 },
    { concepto: 'C', cantidad: 1.1, unidad: 'h', precioUnitario: 10, tipoIva: 0 },
  ]);
  assert.equal(t.total, 33); // 1.1*10*3 = 33.00 exacto en céntimos, no 32.99999...
});

test('calcAlbaranTotales: SIN_VALORAR (líneas sin precioUnitario) da 0, no NaN', () => {
  const t = calcAlbaranTotales([{ concepto: 'X', cantidad: 3, unidad: 'ud' }]);
  assert.deepEqual(t, { baseCents: 0, cuotaCents: 0, totalCents: 0, base: 0, cuota: 0, total: 0 });
  assert.deepEqual(calcAlbaranTotales(null), { baseCents: 0, cuotaCents: 0, totalCents: 0, base: 0, cuota: 0, total: 0 });
});

// ── Tenancy + flujo HTTP real (gateado, patrón tenancy-permisos.test.mjs) ───
const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-14: tenancy del albarán + lock de firmado end-to-end', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  // SCRUM-113: sin `planExpiresAt` a propósito — este test NO llama a ninguna de las cuatro
  // rutas con requireActivePlan (emitir NO está gateada; enviar-whatsapp y
  // enviar-para-firmar sí, y aquí no se usan).
  const datosMerchant = (tag) => ({
    name: `QA Alb ${tag}`, email: `qa-alb-${tag}-${stamp}@test.local`,
  });

  // Los merchants y TODO su montaje dentro de withMerchant; antes nacían fuera del try.
  try {
    await withMerchant(prisma, datosMerchant('A'), (merchantA) =>
      withMerchant(prisma, datosMerchant('B'), async (merchantB) => {
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
    // SCRUM-300: al firmar se puede declarar QUIÉN firma, y ese nombre entra en el contenido
    // SELLADO (v:2). Es OPCIONAL —los albaranes ya firmados no lo tienen y siguen siendo
    // válidos—; aquí se manda a propósito para ejercitar el camino con dato.
    const rSign = await jsonReq(`/admin/albaranes/${alb1.id}/firmar`, cookieA, 'POST', { signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', firmadoPorNombre: 'Ana Pérez' });
    assert.equal(rSign.status, 200);
    const albSigned = await rSign.json(); // serializado con pdfUrl al endpoint auth
    const rLocked = await jsonReq(`/admin/albaranes/${alb1.id}`, cookieA, 'PATCH', { notas: 'tarde' });
    assert.equal(rLocked.status, 409);
    assert.equal((await rLocked.json()).error, 'albaran_locked');

    // ── SCRUM-48: seguridad del PDF ──────────────────────────────────────────
    const { albaranesDir } = await import('../dist/core/storage/dirs.js');

    // pdfUrl serializado apunta al endpoint AUTH, no al viejo estático.
    assert.equal(albSigned.pdfUrl, `/admin/albaranes/${alb1.id}/pdf`);

    // Nombre en disco: prefijar con merchantId mata la colisión entre merchants.
    // Partimos de disco LIMPIO (borramos artefactos de corridas previas, incluido el
    // nombre viejo sin prefijo) para probar SOLO lo que escribe el código actual: el
    // GET /pdf regenera bajo demanda (ensureAlbaranPdf) con el nombre nuevo.
    const oldName = path.join(albaranesDir, `${alb1.numero}.pdf`);
    const newName = path.join(albaranesDir, `${merchantA.id}-${alb1.numero}.pdf`);
    fs.rmSync(oldName, { force: true });
    fs.rmSync(newName, { force: true });
    const rPdf = await jsonReq(`/admin/albaranes/${alb1.id}/pdf`, cookieA, 'GET');
    assert.equal(rPdf.status, 200);
    assert.match(rPdf.headers.get('content-type') || '', /application\/pdf/);
    assert.ok(fs.existsSync(newName), 'el PDF debe regenerarse como <merchantId>-ALB-....pdf');
    assert.ok(!fs.existsSync(oldName), 'el código actual NO debe escribir el nombre viejo sin merchantId');

    // Acceso PÚBLICO al estático eliminado (nombre nuevo y viejo) → 404, JAMÁS un PDF.
    for (const p of [`/albaranes/${merchantA.id}-${alb1.numero}.pdf`, `/albaranes/${alb1.numero}.pdf`]) {
      const rPub = await fetch(`${base}${p}`); // sin cookie: superficie pública
      assert.equal(rPub.status, 404, `${p} público debería ser 404 y fue ${rPub.status}`);
      assert.doesNotMatch(rPub.headers.get('content-type') || '', /application\/pdf/, `${p} no debe servir un PDF`);
    }
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
  }
});

// ── SCRUM-65: albarán VALORADO end-to-end (gateado) ──────────────────────────
// El contenido VISUAL del PDF (precios/leyendas en pantalla) se verifica con el
// Playwright MCP contra staging (no hay librería de parseo de PDF en el repo);
// aquí se blinda la MECÁNICA: validación 400, candado del modo tras emitir 409,
// y que el PDF se sigue generando (200 + application/pdf) en ambos modos.
test('SCRUM-65: albarán VALORADO — validación, candado de modo y PDF en ambos modos', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: SEGUNDO merchant de este fichero — cada test gateado monta el suyo, así que
  // la migración es por BLOQUE `test()`, no por fichero. Igual que arriba, va dentro de
  // withMerchant; antes nacía fuera del try.
  try {
    await withMerchant(prisma, {
      name: 'QA Alb Valorado', email: `qa-alb-val-${stamp}@test.local`,
    }, async (merchant) => {
  const customer = await prisma.customer.create({
    data: { merchantId: merchant.id, name: 'Cliente Alb Valorado', phone: `34601${stamp % 1000000}` },
  });
  const job = await prisma.job.create({
    data: { merchantId: merchant.id, customerId: customer.id, status: 'pendiente_agendar', titulo: 'Trabajo QA Alb Valorado' },
  });

    const token = 'qa65-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const resAuth = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (resAuth.headers.get('set-cookie') || '').split(';')[0];
    const jsonReq = (url, method = 'GET', body) =>
      fetch(`${base}${url}`, {
        method,
        headers: { cookie, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

    // Legacy: crear SIN indicar modoValoracion → sigue comportándose como siempre (SIN_VALORAR).
    const rLegacy = await jsonReq(`/admin/jobs/${job.id}/albaranes`, 'POST', {});
    const legacy = await rLegacy.json();
    assert.equal(legacy.modoValoracion, 'SIN_VALORAR');
    assert.equal(legacy.totales, null);
    // Intentar colarle un precio en modo SIN_VALORAR → 400
    const rColado = await jsonReq(`/admin/albaranes/${legacy.id}`, 'PATCH', {
      lineas: [{ concepto: 'X', cantidad: 1, unidad: 'ud', precioUnitario: 10 }],
    });
    assert.equal(rColado.status, 400);
    assert.equal((await rColado.json()).error, 'lineas_invalidas');

    // VALORADO: crear + líneas con precio/IVA
    const rVal = await jsonReq(`/admin/jobs/${job.id}/albaranes`, 'POST', { modoValoracion: 'VALORADO' });
    const val = await rVal.json();
    assert.equal(val.modoValoracion, 'VALORADO');
    // Línea sin precio en modo VALORADO → 400
    const rFalta = await jsonReq(`/admin/albaranes/${val.id}`, 'PATCH', {
      lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }],
    });
    assert.equal(rFalta.status, 400);
    // Líneas válidas → 200, totales calculados
    const rOk = await jsonReq(`/admin/albaranes/${val.id}`, 'PATCH', {
      lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h', precioUnitario: 45, tipoIva: 21 }],
    });
    assert.equal(rOk.status, 200);
    const valConLineas = await rOk.json();
    assert.equal(valConLineas.totales.total, 108.9); // 90 base + 18.90 IVA

    // Emitir → el modo queda CONGELADO: cambiarlo ahora → 409 albaran_locked
    assert.equal((await jsonReq(`/admin/albaranes/${val.id}/emitir`, 'POST')).status, 200);
    const rCandado = await jsonReq(`/admin/albaranes/${val.id}`, 'PATCH', { modoValoracion: 'SIN_VALORAR' });
    assert.equal(rCandado.status, 409);
    assert.equal((await rCandado.json()).error, 'albaran_locked');

    // El PDF se genera igual en los dos modos (contenido visual → Playwright MCP).
    for (const id of [legacy.id, val.id]) {
      const rPdf = await jsonReq(`/admin/albaranes/${id}/pdf`, 'GET');
      assert.equal(rPdf.status, 200);
      assert.match(rPdf.headers.get('content-type') || '', /application\/pdf/);
    }
    });
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
  }
});
