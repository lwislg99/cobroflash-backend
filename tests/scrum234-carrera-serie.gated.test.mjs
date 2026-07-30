// SCRUM-234 · LA CARRERA, OBSERVADA. Test GATEADO: exige PostgreSQL real y dos conexiones.
//
// ⚠️ ESTE TEST NO SE HA EJECUTADO NUNCA. Se escribió sin turno de staging y se deja declarado
// a propósito, porque la alternativa era afirmar el comportamiento de READ COMMITTED por
// razonamiento y llamarlo medición. Hasta que corra, lo que hay aquí es una HIPÓTESIS escrita
// en forma de test — no una garantía. Quien le dé el primer turno debe leer esto antes.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ TIENE QUE DEMOSTRAR, Y EN LAS DOS DIRECCIONES
//
// SIN el cerrojo (revirtiendo `allocateInvoiceNumber` al read-then-write desnudo):
//   dos reservas concurrentes leen el MISMO `nextInvoiceNumber`, las dos formatean el mismo
//   número, y la segunda muere con `P2002` contra `@@unique([merchantId, number])`. O sea que
//   el índice único no previene la carrera: la convierte en una emisión fallida.
//
// CON el cerrojo:
//   la segunda espera a que la primera commitee, lee el contador YA avanzado, y las dos
//   facturas salen con números CONSECUTIVOS. Nadie falla.
//
// El valor de este test no es el verde: es el ROJO. Sin verlo fallar sin cerrojo, «la carrera
// existía» sigue siendo una afirmación sobre el aislamiento de PostgreSQL y no un hecho medido
// de este código.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NECESITA DOS CONEXIONES DE VERDAD
//
// La carrera vive entre dos transacciones concurrentes. Un cliente Prisma con pool sirve: dos
// `$transaction` lanzadas en paralelo salen por conexiones distintas. Lo que NO sirve es
// simularlo: un mock no tiene niveles de aislamiento, y lo que se está midiendo es justamente
// el comportamiento del motor.
import './_staging-db.mjs'; // PRIMERO: fija la BD de staging. Es código de seguridad (SCRUM-118).
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-234 · dos reservas concurrentes NO colisionan: números consecutivos', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { allocateInvoiceNumber } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

  await withMerchant(
    prisma,
    {
      name: 'QA S234 carrera',
      email: `qa-s234-${Date.now()}@test.local`,
      // Merchant ES con NIF: el camino fiscal, que es el que tiene serie correlativa.
      country: 'ES',
      taxId: 'B12345678',
      // El flag ON para que `getEmissionMode` no devuelva 'receipt' y se reserve serie de
      // verdad en vez de un `J-…` con sufijo aleatorio (que no tiene carrera que medir).
      flags: { INVOICING_ES_ENABLED: true },
    },
    async (merchant) => {
      const emitir = () =>
        prisma.$transaction(async (tx) => {
          const numero = await allocateInvoiceNumber(tx, merchant.id, {
            camino: 'C6',
            actor: { tipo: 'sistema', ref: 'qa_scrum234' },
          });
          const inv = await tx.invoice.create({
            data: {
              merchantId: merchant.id,
              customerId: merchant.__customerId ?? undefined,
              number: numero,
              type: 'F1',
              total: '100.00',
              currency: 'EUR',
              pdfUrl: 'PENDING_PDF',
              qrData: 'PENDING_QR',
            },
          });
          return inv.number;
        });

      // `allSettled` y no `all`: si una revienta con P2002 queremos VER el error, no perderlo
      // detrás del fallo de la otra promesa.
      const [a, b] = await Promise.allSettled([emitir(), emitir()]);

      const fallidas = [a, b].filter((r) => r.status === 'rejected');
      assert.deepEqual(
        fallidas.map((r) => r.reason?.code || r.reason?.message),
        [],
        '🔴 UNA DE LAS DOS EMISIONES CONCURRENTES FALLÓ. Si el código es `P2002`, es exactamente la ' +
          'carrera de SCRUM-234: las dos reservas leyeron el mismo `nextInvoiceNumber` y el índice ' +
          '`@@unique([merchantId, number])` mató la segunda. El índice no previene la carrera, la ' +
          'convierte en una factura que el profesional no pudo emitir.',
      );

      const numeros = [a.value, b.value].sort();
      assert.notEqual(numeros[0], numeros[1], '🔴 las dos facturas salieron con el MISMO número');

      // Consecutivos: el sufijo de la serie es `-NNN` al final del número.
      const seq = (n) => Number(String(n).split('-').pop());
      assert.equal(
        seq(numeros[1]) - seq(numeros[0]), 1,
        `🔴 los números no son consecutivos (${numeros.join(' y ')}). Un salto aquí significa que ` +
          'el contador avanzó más de una vez por factura, y un salto en la serie hay que poder ' +
          'justificarlo ante Hacienda.',
      );

      // Y el contador queda donde debe: exactamente 2 por delante del primer número usado.
      const m = await prisma.merchant.findUnique({
        where: { id: merchant.id },
        select: { nextInvoiceNumber: true },
      });
      assert.equal(
        m.nextInvoiceNumber, seq(numeros[1]) + 1,
        '🔴 el contador no cuadra con los números emitidos: o se avanzó de más (hueco futuro) o de ' +
          'menos (la próxima emisión choca).',
      );
    },
  );
});
