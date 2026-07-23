// SCRUM-68 (ALBARAN-6): evidencias probatorias de la firma.
//   Parte PURA (siempre): computeAlbaranContentHash — determinismo, sensibilidad al contenido,
//   formato hex, y que es hash del CONTENIDO (no del PDF, §1.3).
//   Parte GATEADA (QA_DB_TEST=1 WHATSAPP_DRY_RUN=1): al firmar (remoto e in situ) se sella
//   evidenciaFirma { canal, ip, ua, tokenId, firmante, contentHash } y — CLAVE — ip/ua/hash
//   NUNCA se exponen (ni en la respuesta serializada, ni en la página pública, ni en el JSON).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { computeAlbaranContentHash } from '../dist/modules/jobs/domain/albaran.service.js';

const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const HEX64 = /^[0-9a-f]{64}$/;

const baseContent = {
  numero: 'ALB-2026-001',
  fecha: new Date('2026-07-13T10:00:00Z'),
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }],
  notas: null,
  obra: 'C/ Mayor 12',
  referenciaTrabajo: 'Reparación fuga',
  cliente: 'Ana Pérez',
  emisor: 'Fontanería Torres',
  emisorNif: 'B12345678',
};

// ── Hash del CONTENIDO canónico (puro) ───────────────────────────────────────
test('computeAlbaranContentHash: SHA-256 hex de 64 chars', () => {
  const h = computeAlbaranContentHash(baseContent);
  assert.match(h, HEX64);
});

test('computeAlbaranContentHash: determinista — mismo contenido, mismo hash', () => {
  const a = computeAlbaranContentHash(baseContent);
  const b = computeAlbaranContentHash({ ...baseContent, fecha: new Date('2026-07-13T10:00:00Z') });
  assert.equal(a, b);
});

test('computeAlbaranContentHash: cualquier cambio de contenido cambia el hash', () => {
  const base = computeAlbaranContentHash(baseContent);
  // Cambia una línea
  assert.notEqual(base, computeAlbaranContentHash({ ...baseContent, lineas: [{ concepto: 'Mano de obra', cantidad: 3, unidad: 'h' }] }));
  // Cambia notas
  assert.notEqual(base, computeAlbaranContentHash({ ...baseContent, notas: 'con recargo' }));
  // Cambia número
  assert.notEqual(base, computeAlbaranContentHash({ ...baseContent, numero: 'ALB-2026-002' }));
  // Cambia el precio (modo valorado)
  const valorado = { ...baseContent, modoValoracion: 'VALORADO', lineas: [{ concepto: 'X', cantidad: 1, unidad: 'ud', precioUnitario: 10, tipoIva: 21 }] };
  assert.notEqual(
    computeAlbaranContentHash(valorado),
    computeAlbaranContentHash({ ...valorado, lineas: [{ concepto: 'X', cantidad: 1, unidad: 'ud', precioUnitario: 11, tipoIva: 21 }] }),
  );
});

test('computeAlbaranContentHash: null vs cadena no colisionan (serialización canónica)', () => {
  const conNull = computeAlbaranContentHash({ ...baseContent, notas: null });
  const conVacio = computeAlbaranContentHash({ ...baseContent, notas: '' });
  assert.notEqual(conNull, conVacio);
});

// ── Sellado real + PRIVACIDAD (gateado) ──────────────────────────────────────
const ENABLED = process.env.QA_DB_TEST === '1';
const FWD_IP = '203.0.113.9';   // x-forwarded-for determinista para la aserción de ip
const UA = 'QA-UA-SCRUM68/1.0';

test('SCRUM-68: sella evidencias (remoto + in situ) y NUNCA expone ip/ua/hash', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: el merchant y TODO su montaje dentro de withMerchant; antes nacían fuera del
  // try. `legalName`/`taxId` se conservan (el PDF del albarán los usa).
  //
  // ⚠️ `planExpiresAt` se arrastra TAL CUAL del fixture original, pero este test NO llama a
  // ninguna de las cuatro rutas con requireActivePlan (enviar-whatsapp, enviar-para-firmar,
  // send-whatsapp, quote/create): usa /albaran/:token/firmar, que es pública. O sea que el
  // campo probablemente sobra aquí — copiado de un test hermano. No se quita en esta
  // migración porque cambiar un fixture cuya necesidad no se ha trazado del todo es otro
  // alcance; queda anotado como dato para la decisión de los defaults del helper (SCRUM-113).
  try {
    await withMerchant(prisma, {
      name: 'QA S68', legalName: 'QA S68 SL', taxId: 'B68000000',
      email: `qa-s68-${stamp}@test.local`,
      planExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    }, async (merchant) => {
  const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 68', phone: `34602${stamp % 1000000}`, email: `cli-s68-${stamp}@test.local` } });
  const job = await prisma.job.create({ data: { merchantId: merchant.id, customerId: customer.id, status: 'terminado', titulo: 'C/ Sol 3', direccion: 'C/ Sol 3' } });

  const firmaToken = 'tok68-' + crypto.randomBytes(16).toString('hex');
  const albRemoto = await prisma.albaran.create({
    data: { merchantId: merchant.id, jobId: job.id, numero: `ALB-QA68R-${stamp}`, lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }], estado: 'emitido', firmaToken },
  });
  const albInSitu = await prisma.albaran.create({
    data: { merchantId: merchant.id, jobId: job.id, numero: `ALB-QA68S-${stamp}`, lineas: [{ concepto: 'Material', cantidad: 1, unidad: 'ud' }], estado: 'emitido' },
  });

  const mkCookie = async () => {
    const token = 'qa68-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    return (res.headers.get('set-cookie') || '').split(';')[0];
  };

    // ── (A) FIRMA REMOTA (pública) ───────────────────────────────────────────
    const rFirmar = await fetch(`${base}/albaran/${firmaToken}/firmar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': FWD_IP, 'user-agent': UA },
      body: JSON.stringify({ signatureData: SIG }),
    });
    assert.equal(rFirmar.status, 200, `firmar remoto → 200 (fue ${rFirmar.status})`);
    const firmarBody = await rFirmar.text();

    const evRemoto = (await prisma.albaran.findUnique({ where: { id: albRemoto.id }, select: { evidenciaFirma: true } })).evidenciaFirma;
    assert.ok(evRemoto, 'evidenciaFirma sellada en firma remota');
    assert.equal(evRemoto.canal, 'remoto');
    assert.equal(evRemoto.tokenId, firmaToken, 'tokenId = firmaToken usado');
    assert.equal(evRemoto.ip, FWD_IP, 'ip capturada del x-forwarded-for');
    assert.equal(evRemoto.ua, UA, 'ua capturada');
    assert.equal(evRemoto.hashAlg, 'sha256');
    assert.match(evRemoto.contentHash, HEX64, 'contentHash es SHA-256 hex');
    assert.equal(evRemoto.firmante, 'Cliente 68', 'firmante = nombre del cliente');

    // PRIVACIDAD: la respuesta pública del POST NO filtra ip/ua/hash
    assert.ok(!firmarBody.includes(FWD_IP) && !firmarBody.includes(UA) && !firmarBody.includes(evRemoto.contentHash),
      'la respuesta pública de firmar NO expone ip/ua/hash');

    // PRIVACIDAD: la página pública "ya firmado" tampoco los filtra
    const pageHtml = await (await fetch(`${base}/albaran/${firmaToken}`, { headers: { 'user-agent': UA } })).text();
    assert.ok(!pageHtml.includes(FWD_IP) && !pageHtml.includes(evRemoto.contentHash),
      'la página pública NO expone ip ni hash');

    // ── (B) FIRMA IN SITU (admin) ────────────────────────────────────────────
    const cookie = await mkCookie();
    const rInSitu = await fetch(`${base}/admin/albaranes/${albInSitu.id}/firmar`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'x-forwarded-for': FWD_IP, 'user-agent': UA },
      body: JSON.stringify({ signatureData: SIG }),
    });
    assert.equal(rInSitu.status, 200, `firmar in situ → 200 (fue ${rInSitu.status})`);
    const inSituText = await rInSitu.text();
    const inSituBody = JSON.parse(inSituText);

    const evInSitu = (await prisma.albaran.findUnique({ where: { id: albInSitu.id }, select: { evidenciaFirma: true } })).evidenciaFirma;
    assert.ok(evInSitu, 'evidenciaFirma sellada en firma in situ');
    assert.equal(evInSitu.canal, 'in_situ');
    assert.equal(evInSitu.tokenId, null, 'in situ no lleva token');
    assert.equal(evInSitu.ip, FWD_IP);
    assert.match(evInSitu.contentHash, HEX64);

    // PRIVACIDAD (CLAVE): serializeAlbaran NO incluye evidenciaFirma/ip/ua/signatureUrl/contentHash
    for (const k of ['evidenciaFirma', 'ip', 'ua', 'signatureUrl', 'contentHash', 'firmaToken']) {
      assert.ok(!(k in inSituBody), `la respuesta serializada NO debe incluir '${k}'`);
    }
    assert.ok(!inSituText.includes(FWD_IP) && !inSituText.includes(UA) && !inSituText.includes(evInSitu.contentHash),
      'la respuesta serializada NO expone ip/ua/hash en ningún campo');

    // El PDF se regenera con el certificado (200 + application/pdf) tras firmar
    const rPdf = await fetch(`${base}/admin/albaranes/${albInSitu.id}/pdf`, { headers: { cookie } });
    assert.equal(rPdf.status, 200);
    assert.match(rPdf.headers.get('content-type') || '', /application\/pdf/);

    console.log('✔ SCRUM-68: evidencias selladas (remoto tokenId + in situ) · ip/ua/hash NUNCA expuestos · PDF con certificado.');
    });
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
