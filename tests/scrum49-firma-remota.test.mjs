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
import { interceptarWaLog } from './_wa-log-sync.mjs'; // SCRUM-250/255: esperar la escritura, no el reloj

// SCRUM-114 (reaplicado en SCRUM-126: el fix original no llegó a mergear — solo su
// documentación en SUITE_REGRESION.md, "trampa 7"; el código se perdió en el camino).
// Este test depende de dry-run, pero solo lo DOCUMENTABA en el comentario de arriba, sin
// fijarlo. ANTES de importar dist (config se congela al cargar).
process.env.WHATSAPP_DRY_RUN = '1';

const ENABLED = process.env.QA_DB_TEST === '1';
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// SCRUM-255: aqui habia un sondeo de 3 s sobre `whatsAppMessage` -- la forma que SCRUM-250
// retiro de scrum115. El log WA-0b es fire-and-forget A PROPOSITO, asi que bajo contencion del
// pool de staging la fila llega pasada la ventana y el test cae CON EL MISMO CODIGO. Ahora se
// espera a la PROMESA y la consulta se hace UNA vez.
//
// DOS VENTANAS Y NO UNA, a proposito: este test dispara dos envios en momentos distintos
// (enviar-para-firmar y firmar). Con un solo interceptor abierto de principio a fin, el suelo
// `interceptadas === 0` solo protegeria al primero: para el segundo el contador ya no seria
// cero aunque su escritura no hubiera nacido. Una ventana por envio mantiene el suelo vivo en
// los dos.
async function buscarWaTemplate(prisma, albaranId, templateName) {
  return prisma.whatsAppMessage
    .findFirst({ where: { relatedType: 'albaran', relatedId: albaranId, templateName }, select: { id: true } })
    .catch(() => null);
}

/** El objeto `exports` REAL del modulo de log -- el mismo que lee `whatsapp.js` en cada llamada. */
async function moduloDeLog() {
  return (await import('../dist/modules/messaging/domain/whatsappLog.service.js')).default;
}

test('SCRUM-49: firma remota — enviar-para-firmar, página pública, firmar, auto-envío, tenancy', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
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
    // SCRUM-255: el interceptor se instala ANTES de la peticion -- la escritura de WA-0b nace
    // dentro de ella, asi que instalarlo despues no la veria.
    const wa1 = interceptarWaLog({ log: await moduloDeLog(), prisma });
    const rSend = await fetch(`${base}/admin/albaranes/${albaran.id}/enviar-para-firmar`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' } });
    assert.equal(rSend.status, 200, `enviar-para-firmar debe ser 200 y fue ${rSend.status}`);
    const sendBody = await rSend.json();
    assert.equal(sendBody.ok, true);
    assert.equal(sendBody.sent, true, 'SCRUM-126: sent es la verdad del envío, no solo ok');
    let row = await prisma.albaran.findUnique({ where: { id: albaran.id }, select: { firmaToken: true, enviadoParaFirmaAt: true } });
    assert.ok(row.firmaToken && row.firmaToken.length >= 24, 'firmaToken opaco generado');
    assert.ok(row.enviadoParaFirmaAt, 'enviadoParaFirmaAt marcado');
    const token = row.firmaToken;
    let filaWa1 = null;
    try {
      await wa1.esperar(); // resuelve cuando la escritura TERMINA, no cuando lo dice un reloj
      filaWa1 = await buscarWaTemplate(prisma, albaran.id, 'albaran_para_firmar_es');
    } finally {
      wa1.restaurar();
    }
    assert.ok(filaWa1, wa1.explicar('WA-0b: albaran_para_firmar_es registrado'));

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
    const wa2 = interceptarWaLog({ log: await moduloDeLog(), prisma }); // ventana propia: ver arriba
    // SCRUM-300: la firma remota también puede declarar QUIÉN firma (campo OPCIONAL en C5).
    const rFirmar = await fetch(`${base}/albaran/${token}/firmar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signatureData: SIG, firmadoPorNombre: 'Ana Pérez' }) });
    assert.equal(rFirmar.status, 200, `firmar público debe ser 200 y fue ${rFirmar.status}`);
    row = await prisma.albaran.findUnique({ where: { id: albaran.id }, select: { estado: true, signatureUrl: true, firmadoAt: true } });
    assert.equal(row.estado, 'firmado', 'la firma remota transiciona a firmado');
    assert.ok(row.signatureUrl && row.firmadoAt, 'guarda firma + timestamp (evidencia)');

    // (e) auto-envío de la copia firmada → WA-0b albaran_firmado_es
    let filaWa2 = null;
    try {
      // SCRUM-255: `esperarAlMenos(1)` y NO `esperar()`. La ruta pública de firmar lanza el
      // auto-envío SIN await y responde antes (`albaranPublic.routes.ts:240`), así que cuando
      // llega `rFirmar` la escritura de WA-0b ni ha empezado — le falta generar el PDF y hablar
      // con Meta. Con `esperar()` esto salió ROJO en la tanda gateada, y encima con el
      // diagnóstico equivocado: decía «el log ya no pasa por recordWaMessage» cuando la verdad
      // era «aún no ha empezado».
      // La ventana 1 (enviar-para-firmar) NO lo necesita: esa ruta sí espera el envío
      // (`albaranes.routes.ts:592`), y por eso pasó.
      await wa2.esperarAlMenos(1);
      filaWa2 = await buscarWaTemplate(prisma, albaran.id, 'albaran_firmado_es');
    } finally {
      wa2.restaurar();
    }
    assert.ok(filaWa2, wa2.explicar('auto-envío: WA-0b albaran_firmado_es registrado'));

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
