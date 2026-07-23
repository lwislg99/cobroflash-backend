// SCRUM-49 (ALBARAN-3): firma REMOTA del albarán. Flujo completo:
//   (a) admin POST /admin/albaranes/:id/enviar-para-firmar (emitido) → 200 + firmaToken/enviadoParaFirmaAt
//   (b) GET público /albaran/:token → 200 HTML (nº + obra + líneas; SIN teléfono ni email del cliente)
//   (c) GET /albaran/<token-malo> → 404
//   (d) POST público /albaran/:token/firmar (firma) → 200 → estado firmado + signatureUrl
//   (e) auto-envío de la copia firmada → WA-0b registra 'albaran_firmado_es' (relatedType albaran)
//   (f) re-enviar-para-firmar (ya firmado) → 409 albaran_no_emitido
//   (g) tenancy: merchant B sobre el albarán de A → 404
//
// ⚠️ GATEADO (crea/BORRA merchants efímeros; genera PDF real; levanta la app). Requiere el schema
// de la 49 aplicado (firma_token, enviado_para_firma_at):
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function waitForWaTemplate(prisma, albaranId, templateName, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await prisma.whatsAppMessage
      .findFirst({ where: { relatedType: 'albaran', relatedId: albaranId, templateName }, select: { id: true } })
      .catch(() => null);
    if (row) return row;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

test('SCRUM-49: firma remota — enviar-para-firmar, página pública, firmar, auto-envío, tenancy', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const phone = `34600${stamp % 1000000}`;
  const email = `cliente-s49-${stamp}@test.local`;
  // SCRUM-113: los merchants y TODO su montaje dentro de withMerchant. `planExpiresAt` se
  // conserva a propósito: sin él, requireActivePlan corta enviar-para-firmar con el paywall
  // y el test fallaría por un motivo que no es el suyo.
  const datosMerchant = (tag) => ({
    name: `QA S49 ${tag}`, email: `qa-s49-${tag}-${stamp}@test.local`,
    planExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  });

  try {
    await withMerchant(prisma, datosMerchant('A'), (merchantA) =>
      withMerchant(prisma, datosMerchant('B'), async (merchantB) => {
  const customer = await prisma.customer.create({ data: { merchantId: merchantA.id, name: 'Cliente 49', phone, email } });
  const job = await prisma.job.create({ data: { merchantId: merchantA.id, customerId: customer.id, status: 'terminado', titulo: 'C/ Mayor 12' } });
  const albaran = await prisma.albaran.create({
    data: { merchantId: merchantA.id, jobId: job.id, numero: `ALB-QA49-${stamp}`, lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }], estado: 'emitido' },
  });

  const mkCookie = async (merchantId) => {
    const token = 'qa49-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

    const cookieA = await mkCookie(merchantA.id);
    const cookieB = await mkCookie(merchantB.id);

    // (a) enviar-para-firmar (emitido) → 200 + token generado
    const rSend = await fetch(`${base}/admin/albaranes/${albaran.id}/enviar-para-firmar`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' } });
    assert.equal(rSend.status, 200, `enviar-para-firmar debe ser 200 y fue ${rSend.status}`);
    assert.equal((await rSend.json()).ok, true);
    let row = await prisma.albaran.findUnique({ where: { id: albaran.id }, select: { firmaToken: true, enviadoParaFirmaAt: true } });
    assert.ok(row.firmaToken && row.firmaToken.length >= 24, 'firmaToken opaco generado');
    assert.ok(row.enviadoParaFirmaAt, 'enviadoParaFirmaAt marcado');
    const token = row.firmaToken;
    assert.ok(await waitForWaTemplate(prisma, albaran.id, 'albaran_para_firmar_es'), 'WA-0b: albaran_para_firmar_es registrado');

    // (b) GET público /albaran/:token → 200, con nº, SIN teléfono ni email del cliente
    const rPage = await fetch(`${base}/albaran/${token}`); // sin cookie: superficie pública
    assert.equal(rPage.status, 200, 'la página pública responde 200 con token válido');
    const html = await rPage.text();
    assert.ok(html.includes(albaran.numero), 'la página muestra el nº de albarán');
    // SCRUM-108 — guarda: el assert de arriba (`albaran.numero`) prueba que la página
    // RENDERIZA, pero no que `phone`/`email` serían encontrables si se filtraran. Se
    // comprueba contra la ficha AUTENTICADA del cliente, donde sí deben salir: si ahí
    // tampoco aparecen, el canario está roto y estos dos asserts pasan en vacío.
    const fichaCliente = await (await fetch(`${base}/admin/customers/${customer.id}`, { headers: { cookie: cookieA } })).text();
    assert.ok(fichaCliente.includes(phone) && fichaCliente.includes(email),
      `🔴 CANARIO ROTO (no es un pase): ni el teléfono ni el email del cliente aparecen en la\n` +
      `vista autenticada, así que comprobar su AUSENCIA en la pública no verifica nada.\n` +
      `Arregla el canario antes de fiarte de los dos asserts siguientes. (SCRUM-108)`);
    assert.ok(!html.includes(phone), 'la página pública NO incluye el teléfono del cliente');
    assert.ok(!html.includes(email), 'la página pública NO incluye el email del cliente');

    // (c) token inválido → 404
    assert.equal((await fetch(`${base}/albaran/token-que-no-existe-xyz`)).status, 404, 'token inválido → 404');

    // (d) POST público /albaran/:token/firmar → 200 → firmado
    const rFirmar = await fetch(`${base}/albaran/${token}/firmar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signatureData: SIG }) });
    assert.equal(rFirmar.status, 200, `firmar público debe ser 200 y fue ${rFirmar.status}`);
    row = await prisma.albaran.findUnique({ where: { id: albaran.id }, select: { estado: true, signatureUrl: true, firmadoAt: true } });
    assert.equal(row.estado, 'firmado', 'la firma remota transiciona a firmado');
    assert.ok(row.signatureUrl && row.firmadoAt, 'guarda firma + timestamp (evidencia)');

    // (e) auto-envío de la copia firmada → WA-0b albaran_firmado_es
    assert.ok(await waitForWaTemplate(prisma, albaran.id, 'albaran_firmado_es'), 'auto-envío: WA-0b albaran_firmado_es registrado');

    // (f) re-enviar-para-firmar ya firmado → 409 albaran_no_emitido (la firma no se rehace)
    const rAgain = await fetch(`${base}/admin/albaranes/${albaran.id}/enviar-para-firmar`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' } });
    assert.equal(rAgain.status, 409);
    assert.equal((await rAgain.json()).error, 'albaran_no_emitido');

    // (g) tenancy: B no ve el albarán de A → 404
    const rB = await fetch(`${base}/admin/albaranes/${albaran.id}/enviar-para-firmar`, { method: 'POST', headers: { cookie: cookieB, 'content-type': 'application/json' } });
    assert.equal(rB.status, 404, 'merchant B no accede al albarán de A');

    console.log('✔ SCRUM-49: enviar-para-firmar → página pública (sin contacto) → firma remota → auto-envío → 409 no-emitido → tenancy 404.');
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
