// SCRUM-173 — la cadena de huellas VeriFactu no se puede romper por lote, por orden ni por
// concurrencia. Los TRES peligros, cada uno con su test.
//
// POR QUÉ AHORA: `INVOICING_ES_ENABLED` lleva OFF desde siempre → CERO facturas fiscales
// emitidas → la cadena está VACÍA. Es el único momento en que esto se arregla gratis: una
// cadena rota solo se deshace emitiendo una R1 por cada factura afectada (regla 29).
//
// ⚠️ Toca BD real (staging), gateado:
//   QA_DB_TEST=1 DATABASE_URL_STAGING="..." npm run test:staging
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';
const NIF = 'B12345678';

async function crearFactura(prisma, merchantId, customerId, numero, createdAt) {
  return prisma.invoice.create({
    data: {
      merchantId, customerId, number: numero, status: 'pending',
      total: '121.00', currency: 'EUR',
      lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
      // Obligatorios en el schema; su contenido real no interviene en la cadena de huellas.
      pdfUrl: '',
      qrData: '',
      ...(createdAt ? { createdAt } : {}),
    },
  });
}

test('SCRUM-173 ①: sellar DENTRO de una transacción está prohibido (rompería el lote)', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { applyVeriFactu } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

  await withMerchant(prisma, { name: 'QA S173a', email: `qa-173a-${Date.now()}@test.local`, taxId: NIF }, async (merchant) => {
    const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 173' } });
    const inv = await crearFactura(prisma, merchant.id, cliente.id, `QA173A-${Date.now()}`);

    // GUARDA DE PRESENCIA: con el cliente global SÍ sella. Si esto fallara, el rechazo de
    // abajo no probaría nada — podría estar fallando todo.
    const ok = await applyVeriFactu(inv, NIF, prisma);
    assert.ok(ok.vfHash && ok.vfHash.length === 64, 'con el cliente global debe sellar');

    // EL PELIGRO: dentro de una $transaction, las facturas del lote no se ven entre sí y
    // todas encadenarían al mismo registro anterior. Debe rechazarse, no sellar mal.
    const inv2 = await crearFactura(prisma, merchant.id, cliente.id, `QA173A2-${Date.now()}`);
    await assert.rejects(
      () => prisma.$transaction(async (tx) => applyVeriFactu(inv2, NIF, tx)),
      (err) => {
        assert.match(err.message, /verifactu_seal_inside_transaction/,
          `🔴 sellar dentro de una tx debe rechazarse; llegó: ${err.message}`);
        return true;
      },
    );

    const sinSellar = await prisma.invoice.findUnique({ where: { id: inv2.id }, select: { vfHash: true } });
    assert.equal(sinSellar.vfHash, null, 'y no debe haber sellado nada a medias');
  });
});

test('SCRUM-173 ②: dos facturas con el MISMO createdAt encadenan de forma determinista', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { applyVeriFactu } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

  await withMerchant(prisma, { name: 'QA S173b', email: `qa-173b-${Date.now()}@test.local`, taxId: NIF }, async (merchant) => {
    const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 173b' } });

    // El caso REAL: N facturas creadas en un mismo $transaction comparten `createdAt`, porque
    // en PostgreSQL now() es transaction_timestamp() — constante durante toda la transacción.
    // Aquí se fuerza el empate explícitamente, que es lo mismo y no depende del motor.
    const mismoInstante = new Date();
    const stamp = Date.now();
    const a = await crearFactura(prisma, merchant.id, cliente.id, `QA173B1-${stamp}`, mismoInstante);
    const b = await crearFactura(prisma, merchant.id, cliente.id, `QA173B2-${stamp}`, mismoInstante);
    assert.equal(a.createdAt.getTime(), b.createdAt.getTime(), 'el empate de createdAt es la premisa del test');
    assert.ok(b.id > a.id, 'y el id sí es estrictamente monótono');

    const selloA = await applyVeriFactu(a, NIF, prisma);
    const selloB = await applyVeriFactu(b, NIF, prisma);

    // Con `orderBy: createdAt desc` esto era indeterminado: B podía encadenar a A, o A a B, o
    // ninguno. Con `id desc` la segunda encadena SIEMPRE a la primera.
    assert.equal(selloA.vfPrevHash, '', 'la primera del emisor lleva huella anterior vacía');
    assert.equal(selloB.vfPrevHash, selloA.vfHash,
      '🔴 CADENA ROTA: con createdAt empatado, la segunda no encadenó a la primera');
    assert.notEqual(selloA.vfHash, selloB.vfHash, 'dos facturas distintas no pueden compartir huella');
  });
});

test('SCRUM-173 ③: dos sellados CONCURRENTES se serializan y no comparten prev', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { applyVeriFactu } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

  await withMerchant(prisma, { name: 'QA S173c', email: `qa-173c-${Date.now()}@test.local`, taxId: NIF }, async (merchant) => {
    const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 173c' } });
    const stamp = Date.now();
    const a = await crearFactura(prisma, merchant.id, cliente.id, `QA173C1-${stamp}`);
    const b = await crearFactura(prisma, merchant.id, cliente.id, `QA173C2-${stamp}`);

    // EL PELIGRO: bajo READ COMMITTED (el default de PostgreSQL, que Prisma hereda), dos
    // transacciones simultáneas no se ven entre sí y ambas leerían el mismo `prev`. El
    // cerrojo consultivo por merchant las serializa.
    const [s1, s2] = await Promise.all([
      applyVeriFactu(a, NIF, prisma),
      applyVeriFactu(b, NIF, prisma),
    ]);

    const prevs = [s1.vfPrevHash, s2.vfPrevHash];
    assert.notEqual(prevs[0], prevs[1],
      '🔴 CADENA ROTA: dos sellados concurrentes encadenaron al MISMO registro anterior');

    // Una de las dos es la primera (prev vacío) y la otra encadena a ella: una cadena, no dos.
    const primera = s1.vfPrevHash === '' ? s1 : s2;
    const segunda = s1.vfPrevHash === '' ? s2 : s1;
    assert.equal(primera.vfPrevHash, '', 'exactamente una debe ser la primera del emisor');
    assert.equal(segunda.vfPrevHash, primera.vfHash, 'y la otra debe encadenar a ella');
  });
});

test('SCRUM-173: las cadenas YA PERSISTIDAS siguen siendo válidas tras el cambio', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { computeVeriFactuHash, formatFechaHoraHuso } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

  // Condición del fundador: no romper cadenas persistidas. Se recomputa la huella de las
  // facturas que YA tienen `vfHash` y se comprueba que sale la misma. Si alguna tuviera
  // `vfTimestamp` null (histórico anterior a SCRUM-145) no se puede recomputar — se cuenta
  // aparte en vez de darla por buena o por mala.
  const selladas = await prisma.invoice.findMany({
    where: { vfHash: { not: null } },
    select: { id: true, number: true, total: true, createdAt: true, type: true, lines: true, vfHash: true, vfPrevHash: true, vfTimestamp: true, merchant: { select: { taxId: true } } },
    orderBy: { id: 'desc' },
    take: 25,
  });

  let verificadas = 0;
  let sinTimestamp = 0;
  for (const inv of selladas) {
    if (!inv.vfTimestamp) { sinTimestamp++; continue; }
    const { calcVatCuotaTotal } = await import('../dist/modules/invoicing/domain/vat.service.js');
    const lineas = Array.isArray(inv.lines) ? inv.lines : [];
    if (!lineas.length) { sinTimestamp++; continue; }
    const recomputada = computeVeriFactuHash({
      nif: inv.merchant?.taxId ?? '',
      serie: inv.number,
      fecha: new Date(inv.createdAt).toLocaleDateString('es-ES'),
      tipoFactura: inv.type === 'R1' ? 'R1' : 'F1',
      cuotaTotal: calcVatCuotaTotal(lineas).toFixed(2),
      importeTotal: Number(inv.total.toString()).toFixed(2),
      prevHash: inv.vfPrevHash ?? '',
      timestamp: formatFechaHoraHuso(new Date(inv.vfTimestamp)),
    });
    assert.equal(recomputada, inv.vfHash,
      `🔴 CADENA PERSISTIDA ROTA: la huella de ${inv.number} ya no se reproduce tras el cambio`);
    verificadas++;
  }

  console.log(`[SCRUM-173] cadenas persistidas: ${verificadas} verificadas, ${sinTimestamp} no recomputables (vfTimestamp o líneas ausentes, histórico pre-SCRUM-145)`);
});
