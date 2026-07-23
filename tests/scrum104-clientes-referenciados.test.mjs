// SCRUM-104 (fase 2) — clientes.csv del PAQUETE: los clientes REFERENCIADOS por los
// documentos del rango. Ni uno más, ni uno menos.
//
// ⚠️ EL TEST QUE IMPORTA es el SIMÉTRICO (el segundo): un cliente dado de alta DENTRO del
// rango pero SIN ningún documento en él NO debe aparecer. Sin ese assert, "incluir todos
// los clientes" —la opción descartada por RGPD/S4— también pasaría el caso principal.
// Un assert que no distingue entre lo correcto y lo excesivo no verifica nada.
//
// Datos EFÍMEROS propios con limpieza en el finally — nunca el seed demo (SCRUM-63).
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-104 (fase 2): clientes.csv del paquete = los referenciados, ni más ni menos', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { construirCsvsDelPaquete, buildClientes } =
    await import('../dist/modules/exports/domain/exportData.js');

  const stamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: {
      name: `QA S104 ${stamp}`, country: 'ES', email: `qa-s104-${stamp}@test.local`,
      onboardingCompleted: true, invoiceSeriesPrefix: 'CF',
    },
  });

  // El rango pedido: JULIO de 2026.
  const RANGO = { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-07-31T23:59:59Z') };
  const ANTIGUO = new Date('2024-03-14T10:00:00Z'); // muy anterior al rango
  const DENTRO  = new Date('2026-07-15T10:00:00Z');

  try {
    // (A) ANTIGUO: alta FUERA del rango, pero con factura DENTRO → debe aparecer.
    const antiguo = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `ANTIGUO-CON-FACTURA-${stamp}`, phone: '34600001041', createdAt: ANTIGUO },
    });
    // (B) NUEVO SIN DOCUMENTOS: alta DENTRO del rango, ningún documento → NO debe aparecer.
    const nuevoSinDocs = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `NUEVO-SIN-DOCUMENTOS-${stamp}`, phone: '34600001042', createdAt: DENTRO },
    });
    // (C) Cliente de un COBRO del rango: comprueba que cobros también aporta referencias.
    const deCobro = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `SOLO-COBRO-${stamp}`, phone: '34600001043', createdAt: ANTIGUO },
    });
    // (D) FUERA DEL TODO: alta antigua y su factura también antigua → NO debe aparecer.
    const fueraDelTodo = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `FUERA-DEL-TODO-${stamp}`, phone: '34600001044', createdAt: ANTIGUO },
    });

    await prisma.invoice.create({
      data: {
        merchantId: merchant.id, customerId: antiguo.id, number: `2026-CF-${900 + (stamp % 90)}`,
        total: '121.00', currency: 'EUR', type: 'F1', pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
        lines: [{ concept: 'Obra QA S104', qty: 1, price: 100, tax: 0.21 }],
        createdAt: DENTRO,
      },
    });
    await prisma.invoice.create({
      data: {
        merchantId: merchant.id, customerId: fueraDelTodo.id, number: `2024-CF-${900 + (stamp % 90)}`,
        total: '50.00', currency: 'EUR', type: 'F1', pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
        lines: [], createdAt: ANTIGUO,
      },
    });
    await prisma.charge.create({
      data: {
        merchantId: merchant.id, customerId: deCobro.id, concept: 'Cobro QA S104',
        amount: '80.00', currency: 'EUR', method: 'bizum_manual', status: 'paid', createdAt: DENTRO,
      },
    });
    // ⚠️ Charge.customerId es NULLABLE: un cobro sin cliente no puede romper la recolección.
    await prisma.charge.create({
      data: {
        merchantId: merchant.id, customerId: null, concept: 'Cobro SIN CLIENTE QA S104',
        amount: '10.00', currency: 'EUR', method: 'card', status: 'paid', createdAt: DENTRO,
      },
    });

    // ── El paquete ────────────────────────────────────────────────────────
    const paquete = await construirCsvsDelPaquete(merchant.id, RANGO);
    const clientes = paquete.find((p) => p.nombre === 'clientes.csv');
    assert.ok(clientes, 'el paquete debe seguir trayendo clientes.csv');
    const csv = [clientes.data.header.join(';'), ...clientes.data.rows].join('\n');

    // (A) EL CASO DEL TICKET: no más facturas huérfanas.
    assert.ok(csv.includes(antiguo.name),
      `el cliente con factura en el rango DEBE salir aunque su alta sea de 2024:\n${csv}`);

    // (B) EL SIMÉTRICO — el que evita pasarse. Si esto falla, se está exportando de más:
    // datos personales de clientes ajenos a los documentos del periodo (S4/RGPD).
    assert.ok(!csv.includes(nuevoSinDocs.name),
      `EXCESO: un cliente sin ningún documento en el rango NO debe salir (S4/RGPD):\n${csv}`);

    // (C) Los cobros también aportan referencias, no solo las facturas.
    assert.ok(csv.includes(deCobro.name), `el cliente de un cobro del rango debe salir:\n${csv}`);

    // (D) Un cliente cuyos documentos están TODOS fuera del rango tampoco entra.
    assert.ok(!csv.includes(fueraDelTodo.name),
      `EXCESO: sus documentos son de 2024, no del rango pedido:\n${csv}`);

    // (D3) La columna de fecha de alta, con el valor REAL — es lo que hace que el asesor
    // entienda solo por qué hay un cliente de 2024 en un paquete de julio de 2026.
    assert.ok(clientes.data.header.includes('Fecha de alta'), 'debe existir la columna Fecha de alta');
    const filaAntiguo = clientes.data.rows.find((r) => r.includes(antiguo.name));
    assert.ok(filaAntiguo.includes('2024-03-14'), `la fecha de alta real, no la del rango: ${filaAntiguo}`);

    // ── (D2) LA DIVERGENCIA: el CSV SUELTO sigue con el criterio de alta ──
    const suelto = await buildClientes(merchant.id, RANGO);
    const csvSuelto = suelto.rows.join('\n');
    assert.ok(csvSuelto.includes(nuevoSinDocs.name),
      'el CSV suelto SÍ lista al cliente dado de alta en el rango (R11: es tu cartera)');
    assert.ok(!csvSuelto.includes(antiguo.name),
      'y NO lista al de alta antigua — es el comportamiento de siempre, no se ha tocado');

    t.diagnostic('referenciados ✓ · sin exceso ✓ · cobro null ✓ · fecha de alta ✓ · divergencia con el suelto ✓');
  } finally {
    await prisma.invoice.deleteMany({ where: { merchantId: merchant.id } }).catch(() => {});
    await prisma.charge.deleteMany({ where: { merchantId: merchant.id } }).catch(() => {});
    await prisma.quote.deleteMany({ where: { merchantId: merchant.id } }).catch(() => {});
    await prisma.job.deleteMany({ where: { merchantId: merchant.id } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } }).catch(() => {});
    await prisma.merchant.deleteMany({ where: { id: merchant.id } }).catch(() => {});
    await prisma.$disconnect();
  }
});
