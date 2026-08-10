// SCRUM-47 (ALBARAN-2): POST /admin/albaranes/:id/enviar-whatsapp envía la copia FIRMADA
// del albarán al WhatsApp del cliente (plantilla albaran_firmado_es con el PDF en cabecera
// de documento). S1: "enviar WA" es capacidad de técnico → requireActivePlan SIN requireRole.
// Verifica: técnico 200 (firmado, dry-run) · 409 no-firmado · 409 sin-teléfono · tenancy 404
// · y que el envío pasó por la cadena (WA-0b registra relatedType:'albaran').
//
// ⚠️ GATEADO (crea/BORRA merchants efímeros; genera el PDF real en disco; levanta la app):
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { interceptarWaLog } from './_wa-log-sync.mjs'; // SCRUM-250/255: esperar la escritura, no el reloj

// SCRUM-114 (reaplicado en SCRUM-126: el fix original no llegó a mergear — solo su
// documentación en SUITE_REGRESION.md, "trampa 7"; el código se perdió en el camino).
// Este test depende de dry-run (el envío real a Meta no debe dispararse), pero solo lo
// DOCUMENTABA en el comentario de arriba — si quien lo invoca olvida el flag, el guard
// not_configured de sendWhatsAppTemplate devuelve `ok:false` y el test falla con un
// mensaje que no dice nada del motivo real. ANTES de importar dist (config se congela
// al cargar).
process.env.WHATSAPP_DRY_RUN = '1';

const ENABLED = process.env.QA_DB_TEST === '1';
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// SCRUM-255: aquí había un sondeo de 3 s sobre `whatsAppMessage` — la misma forma que SCRUM-250
// retiró de scrum115, y por el mismo motivo: el log WA-0b es fire-and-forget A PROPÓSITO
// (registrar telemetría no puede tumbar un envío), así que bajo contención del pool de staging
// la fila llega pasada la ventana y el test cae CON EL MISMO CÓDIGO. El veredicto lo decidía el
// reloj. Ahora se espera a la PROMESA y la consulta se hace UNA vez.
async function buscarWaLog(prisma, merchantId, albaranId) {
  return prisma.whatsAppMessage
    .findFirst({ where: { merchantId, relatedType: 'albaran', relatedId: albaranId }, select: { id: true } })
    .catch(() => null);
}

/** El objeto `exports` REAL del módulo de log — el mismo que lee `whatsapp.js` en cada llamada. */
async function moduloDeLog() {
  return (await import('../dist/modules/messaging/domain/whatsappLog.service.js')).default;
}

test('SCRUM-47: enviar-whatsapp — técnico 200 (firmado), 409 no-firmado/sin-teléfono, tenancy 404', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  // SCRUM-113: `planExpiresAt` es OBLIGATORIO aquí — este test llama a
  // POST /admin/albaranes/:id/enviar-whatsapp, una de las cuatro rutas con
  // requireActivePlan. Sin el campo, el paywall corta y el test falla por un motivo que no
  // es el suyo. (El comentario original ya lo decía: "pasa requireActivePlan".)
  const datosMerchant = (tag) => ({
    name: `QA S47 ${tag}`, email: `qa-s47-${tag}-${stamp}@test.local`,
    planExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  });

  // Los merchants y TODO su montaje dentro de withMerchant; antes nacían fuera del try.
  try {
    await withMerchant(prisma, datosMerchant('A'), (merchantA) =>
      withMerchant(prisma, datosMerchant('B'), async (merchantB) => {
  const tecnico = await prisma.teamMember.create({
    data: { merchantId: merchantA.id, name: 'QA Téc 47', email: `qa-tec47-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });
  const customer = await prisma.customer.create({
    data: { merchantId: merchantA.id, name: 'Cliente 47', phone: `34600${stamp % 1000000}` },
  });
  const customerSinTel = await prisma.customer.create({
    data: { merchantId: merchantA.id, name: 'Sin teléfono', phone: null },
  });
  const job = await prisma.job.create({
    data: { merchantId: merchantA.id, customerId: customer.id, status: 'terminado', titulo: 'C/ Mayor 12' },
  });
  const jobSinTel = await prisma.job.create({
    data: { merchantId: merchantA.id, customerId: customerSinTel.id, status: 'terminado', titulo: 'Sin tel' },
  });
  const mkAlb = (jobId, numero, estado, firmado) =>
    prisma.albaran.create({
      data: {
        merchantId: merchantA.id, jobId, numero,
        lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'h' }],
        estado, ...(firmado ? { signatureUrl: SIG, firmadoAt: new Date() } : {}),
      },
    });
  const albFirmado = await mkAlb(job.id, `ALB-QA47-F-${stamp}`, 'firmado', true);
  const albEmitido = await mkAlb(job.id, `ALB-QA47-E-${stamp}`, 'emitido', false);
  const albSinTel = await mkAlb(jobSinTel.id, `ALB-QA47-N-${stamp}`, 'firmado', true);

  const mkCookie = async (merchantId, teamMemberId = null) => {
    const token = 'qa47-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };
  const post = (albId, cookie) =>
    fetch(`${base}/admin/albaranes/${albId}/enviar-whatsapp`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' } });

    const cookieTecnico = await mkCookie(merchantA.id, tecnico.id); // rol técnico (S1: enviar WA ✅)
    const cookieB = await mkCookie(merchantB.id, null);

    // ── TÉCNICO permitido (S1) + happy path dry-run → 200 ok:true ──
    // SCRUM-255: el interceptor se instala ANTES de la petición — la escritura de WA-0b nace
    // dentro de ella, así que instalarlo después no la vería.
    const wa = interceptarWaLog({ log: await moduloDeLog(), prisma });
    let filaWa = null;
    try {
      const rOk = await post(albFirmado.id, cookieTecnico);
      assert.equal(rOk.status, 200, `técnico debe poder enviar (S1) y fue ${rOk.status}`);
      const okBody = await rOk.json();
      assert.equal(okBody.ok, true, 'envío ok en dry-run');
      assert.equal(okBody.sent, true, 'SCRUM-126: sent es la verdad del envío, no solo ok');

      await wa.esperar(); // resuelve cuando la escritura TERMINA, no cuando lo dice un reloj
      filaWa = await buscarWaLog(prisma, merchantA.id, albFirmado.id);
    } finally {
      wa.restaurar();
    }
    // WA-0b: el envío pasó por la cadena y se registró con relatedType 'albaran'
    assert.ok(filaWa, wa.explicar('debe registrarse WhatsAppMessage relatedType=albaran'));

    // ── No firmado → 409 albaran_no_firmado (no se envía) ──
    const rEmit = await post(albEmitido.id, cookieTecnico);
    assert.equal(rEmit.status, 409, `emitido debe ser 409 y fue ${rEmit.status}`);
    assert.equal((await rEmit.json()).error, 'albaran_no_firmado');

    // ── Cliente sin teléfono → 409 customer_missing_phone (SCRUM-126: antes "sin_telefono") ──
    const rNoTel = await post(albSinTel.id, cookieTecnico);
    assert.equal(rNoTel.status, 409);
    assert.equal((await rNoTel.json()).error, 'customer_missing_phone');

    // ── Tenancy (regla 2): B no ve el albarán de A → 404 ──
    const rB = await post(albFirmado.id, cookieB);
    assert.equal(rB.status, 404, 'merchant B no accede al albarán de A');

    console.log('✔ SCRUM-47: técnico 200 (firmado, dry-run), 409 no-firmado/sin-tel, tenancy 404, WA-0b albaran ✓');
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
