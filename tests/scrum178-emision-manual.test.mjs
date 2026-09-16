// SCRUM-178 — la vía de emisión MANUAL: un documento por el total, para los presupuestos que
// no generan tramos (MANUAL/SIN_CONDICIONES).
//
// ZONA FISCAL. Lo que se protege aquí no es una ruta: es que una factura EMITIDA sea correcta y
// única. Una factura no se edita ni se borra (regla 29), así que todo lo que este test comprueba
// solo se puede comprobar ANTES de emitirla — después ya no hay marcha atrás.
//
// El test tiene dos mitades a propósito:
//   · la ARITMÉTICA, sin BD y sin gate: que el plan sintético de un solo tramo al 100 % dé
//     EXACTAMENTE las líneas del presupuesto y su importe, sin deriva de céntimos. Es lo que
//     acaba sellado en la huella VeriFactu (SCRUM-141), así que se prueba aparte y siempre.
//   · las PUERTAS, gateadas: los cuatro rechazos que impiden emitir de más.
import './_staging-db.mjs'; // SCRUM-60: fuerza staging (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';
const PLAN_MANUAL = [{ index: 0, percentage: 1, label: 'manual_total' }];

test('SCRUM-178 (aritmética, sin BD): el tramo único al 100 % reproduce las líneas y el total EXACTOS', async () => {
  const { stageLinesReconciled, grossOfLines } = await import('../dist/modules/invoicing/domain/invoiceLines.service.js');
  const { distributeStageAmounts } = await import('../dist/modules/quotes/domain/billingPlan.js');

  // Importes elegidos para que el redondeo duela: 3 × 33,33 con IVA 21 % no reparte limpio.
  const lineas = [
    { concept: 'Mano de obra', qty: 3, price: 33.33, tax: 0.21 },
    { concept: 'Material', qty: 1, price: 12.07, tax: 0.10 },
    { concept: 'Desplazamiento', qty: 1, price: 0.01, tax: 0.21 },
  ];
  const totalPresupuesto = grossOfLines(lineas);

  const objetivo = distributeStageAmounts(totalPresupuesto, PLAN_MANUAL)[0];
  assert.equal(objetivo, totalPresupuesto, 'un tramo al 100 % debe repartir el total entero, sin recorte');

  const emitidas = stageLinesReconciled(lineas, PLAN_MANUAL, 0, objetivo);
  assert.equal(emitidas.length, lineas.length, 'no se pierde ni se inventa ninguna línea');
  assert.equal(grossOfLines(emitidas), totalPresupuesto,
    '🔴 DERIVA DE CÉNTIMOS: el importe emitido no coincide con el del presupuesto. Esa diferencia ' +
    'queda SELLADA en la huella VeriFactu y solo se corrige con una R1 (SCRUM-141, regla 29).');
  for (let i = 0; i < lineas.length; i++) {
    assert.equal(emitidas[i].concept, lineas[i].concept, 'el orden y el concepto de cada línea se conservan');
    assert.equal(Number(emitidas[i].tax), Number(lineas[i].tax), `el IVA de "${lineas[i].concept}" no puede cambiar al emitir`);
  }
});

test('SCRUM-178: emisión manual — emite UNA vez, con líneas, y cierra las cuatro puertas', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { grossOfLines } = await import('../dist/modules/invoicing/domain/invoiceLines.service.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  try {
    await withMerchant(
      prisma,
      { name: 'QA S178', email: `qa-s178-${stamp}@test.local`, country: 'ES', taxId: 'B12345678' },
      async (merchant) => {
        const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S178' } });
        const LINEAS = [
          { concept: 'Mano de obra S178', qty: 3, price: 33.33, tax: 0.21 },
          { concept: 'Material S178', qty: 1, price: 12.07, tax: 0.10 },
        ];
        const total = grossOfLines(LINEAS);

        const mkQuote = (extra = {}) => prisma.quote.create({
          data: {
            merchantId: merchant.id, customerId: customer.id, status: 'accepted', currency: 'EUR',
            total: total.toFixed(2), lines: LINEAS, paymentTerms: 'MANUAL', ...extra,
          },
        });

        const token = 'qa178-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const verify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
        const cookie = (verify.headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

        const emitirManual = (quoteId) => fetch(`${base}/admin/quotes/${quoteId}/invoice-manual`, {
          method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
        });

        // ── EL CAMINO BUENO ────────────────────────────────────────────────
        const quote = await mkQuote();
        const res = await emitirManual(quote.id);
        const cuerpo = await res.json();
        assert.equal(res.status, 201, `debía emitir; devolvió ${res.status} ${JSON.stringify(cuerpo)}`);

        const factura = await prisma.invoice.findUnique({ where: { id: cuerpo.id } });
        assert.equal(factura.quoteId, quote.id, 'la factura queda ligada a su presupuesto');
        assert.equal(factura.stageLabel, null, 'no es un tramo: no lleva etiqueta de tramo');
        assert.equal(Number(factura.total), total, 'el importe emitido es el del presupuesto, al céntimo');
        assert.ok(Array.isArray(factura.lines) && factura.lines.length === LINEAS.length,
          '🔴 FACTURA SIN LÍNEAS: el guard de SCRUM-149 no la sellaría, y una factura sin líneas ' +
          'declara CERO IVA repercutido sobre un importe que sí lo lleva.');
        assert.equal(grossOfLines(factura.lines), Number(factura.total),
          'el total guardado tiene que ser CONSECUENCIA de las líneas guardadas (SCRUM-141)');
        // SELLADO — la regla, no la suposición. El primer intento de este test daba por hecho que
        // un merchant ES con NIF sella siempre, y falló: con `INVOICING_ES_ENABLED` OFF (regla 24)
        // el documento sale JUSTIFICANTE, y sellar un justificante sería precisamente el fallo
        // (V0-0). Así que se comprueba la implicación en los dos sentidos, y el test vale igual
        // el día que se encienda la facturación fiscal — que es cuando más va a hacer falta.
        const { isReceiptNumber } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');
        if (isReceiptNumber(factura.number)) {
          assert.equal(factura.type, 'JUST', 'un número de justificante tiene que dar tipo JUST');
          assert.equal(factura.vfHash, null,
            `🔴 JUSTIFICANTE SELLADO: ${factura.number} no es una factura fiscal y no puede entrar ` +
            'en la cadena VeriFactu (V0-0, regla 24). Una huella de más no se retira: se encadena.');
          assert.equal(cuerpo.veriFactu, false, 'y la respuesta no debe afirmar que se selló');
        } else {
          assert.equal(factura.type, 'F1', 'un número de factura tiene que dar tipo F1');
          assert.ok(factura.vfHash,
            '🔴 FACTURA FISCAL SIN SELLAR: merchant ES con NIF y número F1 — tiene que entrar en la cadena VeriFactu.');
        }
        t.diagnostic(`documento ${factura.number} (${factura.type}) · VeriFactu: ${cuerpo.veriFactu}`);

        // ── EL IMPORTE SALE DE LAS LÍNEAS, aunque el `total` guardado diga otra cosa ────────
        // Un presupuesto cuyo campo `total` no cuadra con sus líneas no es una hipótesis de
        // laboratorio: basta con que se editen las líneas por una vía que no recalcule el campo.
        // Si la emisión tomase ese número como objetivo, `reconcileToTarget` TOCARÍA el precio de
        // la última línea para cuadrar con él — y eso queda sellado en la huella (SCRUM-141).
        //
        // EL DESFASE ES DE 3 CÉNTIMOS, Y ESO ES LO IMPORTANTE. La primera versión de este assert
        // usaba 5 € y NO cazaba nada: `reconcileToTarget` solo busca dentro de una ventana de
        // ±0,05 € de base, así que un hueco grande es inalcanzable, devuelve las líneas intactas
        // y el fallo se tapa solo. El peligro real vive DENTRO de la ventana, que es justo donde
        // el ajuste sí ocurre y nadie lo nota. Se descubrió probando el guard en rojo y viéndolo
        // no fallar: un assert que no distingue no es un assert, es decoración.
        const desfasado = await mkQuote({ total: (total + 0.03).toFixed(2) });
        const rDesf = await emitirManual(desfasado.id);
        assert.equal(rDesf.status, 201, 'debía emitir');
        const facturaDesf = await prisma.invoice.findUnique({ where: { id: (await rDesf.json()).id } });
        assert.equal(Number(facturaDesf.total), total,
          '🔴 EL TOTAL GUARDADO GANÓ A LAS LÍNEAS: se ha emitido por el campo `total` del ' +
          'presupuesto en vez de por el bruto de sus líneas. Eso escala precios de línea para ' +
          'cuadrar con una cifra que puede estar vieja, y la huella VeriFactu lo sella (SCRUM-141).');
        assert.equal(grossOfLines(facturaDesf.lines), Number(facturaDesf.total),
          'y las líneas emitidas tienen que sumar exactamente ese importe');

        // ── PUERTA 1 · una sola vez (regla 29: lo emitido no se edita ni se duplica) ──
        const repe = await emitirManual(quote.id);
        assert.equal(repe.status, 409, 'un segundo documento por el mismo presupuesto sería un DUPLICADO');
        assert.equal((await repe.json()).error, 'already_invoiced');
        assert.equal(await prisma.invoice.count({ where: { quoteId: quote.id } }), 1,
          '🔴 tras el rechazo NO puede haber quedado una segunda factura');

        // ── PUERTA 2 · con plan de tramos, esta vía no compite ──
        const conPlan = await mkQuote({ paymentTerms: 'FIFTY_FIFTY' });
        const rPlan = await emitirManual(conPlan.id);
        assert.equal(rPlan.status, 409, 'con plan de tramos la factura sale por su cadena, no a mano');
        assert.equal((await rPlan.json()).error, 'has_billing_plan');
        assert.equal(await prisma.invoice.count({ where: { quoteId: conPlan.id } }), 0, 'y no emite nada');

        // ── PUERTA 3 · sin aceptar no hay factura ──
        const sinAceptar = await mkQuote({ status: 'draft' });
        const rDraft = await emitirManual(sinAceptar.id);
        assert.equal(rDraft.status, 409, 'un presupuesto no aceptado no se factura');
        assert.equal((await rDraft.json()).error, 'quote_not_accepted');

        // ── PUERTA 4 · sin líneas no se emite, y NO se gasta número de serie ──
        const sinLineas = await mkQuote({ lines: [] });
        const numerosAntes = await prisma.invoice.count({ where: { merchantId: merchant.id } });
        const rVacio = await emitirManual(sinLineas.id);
        assert.equal(rVacio.status, 409, 'sin líneas no se puede emitir (el sellado la rechazaría después)');
        assert.equal((await rVacio.json()).error, 'quote_without_lines');
        assert.equal(await prisma.invoice.count({ where: { merchantId: merchant.id } }), numerosAntes,
          '🔴 se creó una factura antes de rechazar: eso consume número de serie y deja un hueco ' +
          'en la numeración que no se puede reparar (regla 29).');

        t.diagnostic(`emitida ${factura.number} por ${factura.total} € · 4 puertas cerradas`);
      },
    );

    // ── TENANCY (regla 2): el presupuesto de otro merchant no existe para mí ──
    await withMerchant(prisma, { name: 'QA S178 A', email: `qa-s178a-${stamp}@test.local` }, async (mA) => {
      await withMerchant(prisma, { name: 'QA S178 B', email: `qa-s178b-${stamp}@test.local` }, async (mB) => {
        const cB = await prisma.customer.create({ data: { merchantId: mB.id, name: 'Cliente B' } });
        const quoteB = await prisma.quote.create({
          data: {
            merchantId: mB.id, customerId: cB.id, status: 'accepted', currency: 'EUR', total: '100.00',
            lines: [{ concept: 'X', qty: 1, price: 100, tax: 0 }], paymentTerms: 'MANUAL',
          },
        });
        const token = 'qa178a-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: mA.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const verify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
        const cookieA = (verify.headers.get('set-cookie') || '').split(';')[0];

        const res = await fetch(`${base}/admin/quotes/${quoteB.id}/invoice-manual`, {
          method: 'POST', headers: { cookie: cookieA, 'Content-Type': 'application/json' },
        });
        assert.equal(res.status, 404,
          '🔴 FUGA MULTI-TENANT: el merchant A ha podido emitir sobre un presupuesto del B.');
        assert.equal(await prisma.invoice.count({ where: { quoteId: quoteB.id } }), 0, 'y no emitió nada');
      });
    });
  } finally {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});
