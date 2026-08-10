// SCRUM-207 · «si no consta, no se emite» — el DoD del ticket, probado en rojo.
//
// LA AFIRMACIÓN QUE HAY QUE DEMOSTRAR: una factura NO PUEDE EXISTIR sin su fila de
// auditoría. No «no debería»: no puede. `factura_emitida` se escribe DENTRO de la
// transacción de `allocateInvoiceNumber` (el embudo por el que pasan los 7 caminos,
// SCRUM-203), así que si el registro falla la transacción se deshace y no queda ni número
// consumido, ni factura, ni hueco en la serie.
//
// Antes de SCRUM-207 esto era IMPOSIBLE de garantizar: `recordAudit` devolvía `void`, se
// tragaba los fallos con `.catch(console.error)` y usaba el cliente global, o sea que no
// podía ni esperarse ni participar en la transacción de quien la llamaba.
//
// DOS NIVELES, a propósito:
//   · PURO (siempre corre) — `allocateInvoiceNumber` recibe `tx` como PARÁMETRO, así que se
//     le puede inyectar un doble cuyo `auditLog.create` falle. Demuestra que el fallo SUBE
//     en vez de tragarse. Sin BD, sin gate, en cada tanda.
//   · GATEADO (QA_DB_TEST=1) — la misma escena contra PostgreSQL de verdad, con un Proxy que
//     envenena el escritor de auditoría dentro de una `$transaction` real. Demuestra lo que
//     el doble NO puede demostrar: que la BD **deshace** la emisión.
import './_staging-db.mjs'; // fail-closed anti-prod, SIEMPRE el primer import
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateInvoiceNumber } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';

const ACTOR = { tipo: 'pro_propietario', teamMemberId: null };

// ⚠️ NUNCA `id: 1` aquí: ese es el merchant DEMO (regla 8) y `getEmissionMode` le devuelve
// 'demo', no 'receipt' — con lo que el caso del justificante no se ejercitaría y el test
// pasaría por el camino equivocado. Lo destapó el propio test al salir en rojo.
const MERCHANT_ID = 42;

/** Doble de `Prisma.TransactionClient` con lo justo que toca `allocateInvoiceNumber`. */
function txFalso({ auditFalla = false, merchant = {} } = {}) {
  const escrito = [];
  return {
    escrito,
    // SCRUM-234: la reserva toma un advisory lock antes de leer, asi que el doble de
    // TransactionClient necesita $executeRaw. No-op: lo que mide este fichero es la
    // AUDITORIA, y el cerrojo tiene su comprobacion propia en tests/albaran.test.mjs.
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async () => ({
        id: MERCHANT_ID, email: 'pro@x.es', country: 'ES', flags: { INVOICING_ES_ENABLED: true },
        invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 7, nextRectInvoiceNumber: 1,
        invoiceSeriesYear: new Date().getFullYear(), ...merchant,
      }),
      update: async () => ({}),
    },
    // SCRUM-396: el camino del justificante comprueba que la referencia este libre contra el
    // indice `[merchantId, number]`. `null` = libre. Lo que mide este fichero es la AUDITORIA.
    invoice: { findUnique: async () => null },
    auditLog: {
      create: async (args) => {
        if (auditFalla) throw new Error('audit_write_failed');
        escrito.push(args.data);
        return args.data;
      },
    },
  };
}

test('SCRUM-207 · camino feliz: emitir escribe UNA fila factura_emitida con su sobre', async () => {
  const tx = txFalso();
  const numero = await allocateInvoiceNumber(tx, MERCHANT_ID, { camino: 'C3', actor: ACTOR });

  assert.equal(tx.escrito.length, 1, 'exactamente una fila de auditoría por emisión');
  const fila = tx.escrito[0];
  assert.equal(fila.action, 'factura_emitida');
  assert.equal(fila.entityType, 'invoice');
  assert.equal(fila.entityId, null, 'la factura aún no existe: la identidad es meta.numero');
  assert.equal(fila.meta.numero, numero, 'el número queda CONGELADO en el registro');
  assert.equal(fila.meta.camino, 'C3');
  assert.equal(fila.meta.esJustificante, false);
  assert.equal(fila.meta.tipoFactura, 'F1');
  assert.equal(fila.meta.v, 1, 'el sobre lleva su versión');
  assert.equal(fila.meta.actor.tipo, 'pro_propietario');
  // El modo fiscal del MOMENTO, congelado — no se deduce del flag de mañana.
  assert.equal(fila.meta.flagsFiscales.INVOICING_ES_ENABLED, true);
});

test('SCRUM-207 · EL ROJO: si el registro falla, allocateInvoiceNumber LANZA (no se lo traga)', async () => {
  const tx = txFalso({ auditFalla: true });
  await assert.rejects(
    () => allocateInvoiceNumber(tx, MERCHANT_ID, { camino: 'C3', actor: ACTOR }),
    /audit_write_failed/,
    'el fallo del log tiene que SUBIR: es lo que hace que la transacción se deshaga',
  );
});

test('SCRUM-207 · el justificante también se audita, y se marca como tal', async () => {
  // Merchant ES sin INVOICING_ES_ENABLED → J-…, fuera de la serie fiscal. Sigue siendo un
  // documento con referencia que se le manda a un cliente: tiene que constar.
  const tx = txFalso({ merchant: { flags: { INVOICING_ES_ENABLED: false } } });
  const numero = await allocateInvoiceNumber(tx, MERCHANT_ID, { camino: 'C1', actor: { tipo: 'cliente_final', ref: 'quote_token' } });

  assert.ok(numero.startsWith('J-'), 'sale justificante');
  assert.equal(tx.escrito.length, 1);
  assert.equal(tx.escrito[0].meta.esJustificante, true);
  assert.equal(tx.escrito[0].meta.tipoFactura, 'JUST');
  assert.equal(tx.escrito[0].meta.camino, 'C1');
  assert.equal(tx.escrito[0].meta.actor.tipo, 'cliente_final', 'C1 lo dispara el CLIENTE, no el propietario');
  assert.equal(tx.escrito[0].meta.actor.ref, 'quote_token', 'la vía, nunca el token en claro');
});

test('SCRUM-207 · y también falla el justificante si su registro falla', async () => {
  const tx = txFalso({ auditFalla: true, merchant: { flags: { INVOICING_ES_ENABLED: false } } });
  await assert.rejects(
    () => allocateInvoiceNumber(tx, MERCHANT_ID, { camino: 'C1', actor: ACTOR }),
    /audit_write_failed/,
  );
});

// ── GATEADO · la garantía de verdad, contra PostgreSQL ────────────────────────────────
const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-207 · GATEADO: si el registro falla, la EMISIÓN NO OCURRE (rollback real)', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { withMerchant } = await import('./_merchant-fixture.mjs');

  await withMerchant(prisma, {
    name: 'SCRUM-207 rollback', email: `s207-${Date.now()}@test.local`,
    country: 'ES', taxId: 'B12345678', invoiceSeriesPrefix: 'S207',
    flags: { INVOICING_ES_ENABLED: true },
  }, async (merchant) => {
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'Cliente 207', phone: `+34600${String(merchant.id).padStart(6, '0')}` },
    });

    const antes = await prisma.merchant.findUnique({
      where: { id: merchant.id }, select: { nextInvoiceNumber: true },
    });

    // La MISMA escena que una emisión real (allocate + create dentro de una tx), pero con
    // el escritor de auditoría envenenado. No hace falta ningún hook en producción: basta
    // con envolver el `tx` que la transacción entrega.
    await assert.rejects(
      () => prisma.$transaction(async (tx) => {
        const txEnvenenado = new Proxy(tx, {
          get(obj, prop) {
            if (prop === 'auditLog') {
              return { create: async () => { throw new Error('audit_write_failed'); } };
            }
            return Reflect.get(obj, prop);
          },
        });
        const numero = await allocateInvoiceNumber(txEnvenenado, merchant.id, {
          camino: 'C3', actor: ACTOR,
        });
        return tx.invoice.create({
          data: {
            merchantId: merchant.id, customerId: customer.id, number: numero,
            total: '100.00', currency: 'EUR', pdfUrl: 'PENDING', qrData: 'PENDING',
            lines: [{ concept: 'x', qty: 1, price: 100, tax: 0.21 }],
          },
        });
      }),
      /audit_write_failed/,
    );

    // LO QUE DE VERDAD SE AFIRMA: no queda NADA.
    const facturas = await prisma.invoice.count({ where: { merchantId: merchant.id } });
    assert.equal(facturas, 0, 'sin registro de auditoría NO puede quedar factura');

    const despues = await prisma.merchant.findUnique({
      where: { id: merchant.id }, select: { nextInvoiceNumber: true },
    });
    assert.equal(
      despues.nextInvoiceNumber, antes.nextInvoiceNumber,
      'el contador de la serie NO avanza: un hueco en la numeración no se repara',
    );

    const filas = await prisma.auditLog.count({
      where: { merchantId: merchant.id, action: 'factura_emitida' },
    });
    assert.equal(filas, 0, 'la fila de auditoría también se deshizo — se confirman o caen juntos');
  });
});

test('SCRUM-207 · GATEADO: camino feliz — la factura y su registro se confirman JUNTOS', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { withMerchant } = await import('./_merchant-fixture.mjs');

  await withMerchant(prisma, {
    name: 'SCRUM-207 ok', email: `s207ok-${Date.now()}@test.local`,
    country: 'ES', taxId: 'B12345678', invoiceSeriesPrefix: 'S207',
    flags: { INVOICING_ES_ENABLED: true },
  }, async (merchant) => {
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'Cliente 207', phone: `+34601${String(merchant.id).padStart(6, '0')}` },
    });

    const inv = await prisma.$transaction(async (tx) => {
      const numero = await allocateInvoiceNumber(tx, merchant.id, { camino: 'C3', actor: ACTOR });
      return tx.invoice.create({
        data: {
          merchantId: merchant.id, customerId: customer.id, number: numero,
          total: '100.00', currency: 'EUR', pdfUrl: 'PENDING', qrData: 'PENDING',
          lines: [{ concept: 'x', qty: 1, price: 100, tax: 0.21 }],
        },
      });
    });

    const fila = await prisma.auditLog.findFirst({
      where: { merchantId: merchant.id, action: 'factura_emitida' },
    });
    assert.ok(fila, 'toda factura emitida deja su fila');
    assert.equal(fila.meta.numero, inv.number, 'el registro apunta al número realmente emitido');
    assert.equal(fila.meta.camino, 'C3');
  });
});
