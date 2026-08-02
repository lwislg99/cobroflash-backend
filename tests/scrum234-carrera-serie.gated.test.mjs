// SCRUM-234 · LA CARRERA, OBSERVADA. Test GATEADO: exige PostgreSQL real y dos conexiones.
//
// ✅ EJECUTADO EL 02-AGO-2026 contra staging (acela/railway), en los DOS sentidos y tres veces
// cada uno: SIN cerrojo 3/3 ROJO con `P2002`; CON cerrojo 3/3 VERDE, números consecutivos.
// Nació declarado como hipótesis sin ejecutar; ya no lo es. Lo que sigue es lo medido.
//
// Y HUBO QUE ARREGLARLO DOS VECES ANTES DE QUE MIDIERA NADA. Las dos son la misma lección
// —la herramienta funciona sobre el objeto equivocado— y por eso quedan escritas:
//   1) `customerId` salía de `merchant.__customerId`, un campo que `withMerchant` NO crea.
//      Las dos transacciones morían en la VALIDACIÓN de `invoice.create`, sin insertar: rojo
//      abundante y ni un P2002 posible. Un rojo que no probaba nada.
//   2) Ya con cliente, salía VERDE 4 de 4 SIN cerrojo. No porque no hubiera carrera: porque
//      las dos emisiones entran con ~1,3 s de desfase y la ventana de la carrera es ~0,7 s a
//      esta latencia — el caso caía FUERA del mecanismo (ERRORES_ASESOR #12). De ahí la
//      barrera de fila que hay más abajo, que fuerza el entrelazado en vez de esperarlo.
// Ojo con la trampa que casi cuela: en (1) las dos reservas devolvieron `2026-CF-001`, y eso
// se lee como «carrera confirmada» — pero una serialización perfecta con rollback da EXACTAMENTE
// la misma salida. Lo que lo desempató fue medir dos `pg_backend_pid` distintos, no el número.
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
      // `Invoice.customerId` es OBLIGATORIO en el schema (no `Int?`). Esto era
      // `merchant.__customerId ?? undefined`, un campo que `withMerchant` NO crea nunca: las dos
      // transacciones morían en la VALIDACIÓN de `invoice.create` («Argument `merchant` is
      // missing») sin llegar a insertar nada, así que el P2002 no podía aparecer y el test medía
      // otra cosa con total confianza. Se crea DENTRO de `withMerchant`, o sea cubierto por su
      // limpieza (`customer` está en MODELOS_POR_MERCHANT).
      const cliente = await prisma.customer.create({
        data: { merchantId: merchant.id, name: 'QA S234 cliente' },
      });

      const emitir = () =>
        prisma.$transaction(async (tx) => {
          const numero = await allocateInvoiceNumber(tx, merchant.id, {
            camino: 'C6',
            actor: { tipo: 'sistema', ref: 'qa_scrum234' },
          });
          const inv = await tx.invoice.create({
            data: {
              merchantId: merchant.id,
              customerId: cliente.id,
              number: numero,
              type: 'F1',
              total: '100.00',
              currency: 'EUR',
              pdfUrl: 'PENDING_PDF',
              qrData: 'PENDING_QR',
            },
          });
          return inv.number;
        }, { timeout: 30_000, maxWait: 30_000 });

      // ── LA BARRERA · por qué no basta con lanzar las dos y esperar ───────────────────────
      //
      // MEDIDO contra staging (02-ago-2026), no razonado: dos `$transaction` lanzadas a la vez
      // SÍ salen por conexiones distintas (dos `pg_backend_pid` distintos), pero entran con
      // ~1,3 s de DESFASE, y la ventana de la carrera —entre el `findUnique` del contador y el
      // `merchant.update` que lo avanza— es de ~0,7 s a esta latencia. O sea que la segunda
      // reserva empieza cuando la primera YA escribió: sin cerrojo, el test salía VERDE 4 de 4
      // veces. Un verde que no probaba nada — el caso caía FUERA del mecanismo que vigila
      // (docs/ERRORES_ASESOR.md, incidente #12).
      //
      // Esta transacción de barrera toma el candado de FILA del merchant desde una TERCERA
      // conexión. Con él tomado, las dos emisiones pueden LEER el contador (el `findUnique` no
      // bloquea) pero ninguna puede ESCRIBIRLO. Se sueltan a la vez al liberar la barrera, y el
      // entrelazado que la carrera necesita deja de depender del reloj.
      //
      // NO toca el camino de emisión (regla 38): es orquestación desde fuera, sobre una fila.
      let liberarBarrera;
      const barreraSoltada = new Promise((r) => { liberarBarrera = r; });
      const barrera = prisma.$transaction(async (t) => {
        await t.$queryRaw`SELECT id FROM merchants WHERE id = ${merchant.id} FOR UPDATE`;
        await barreraSoltada;
      }, { timeout: 30_000, maxWait: 30_000 });

      // `allSettled` y no `all`: si una revienta con P2002 queremos VER el error, no perderlo
      // detrás del fallo de la otra promesa.
      const enCurso = Promise.allSettled([emitir(), emitir()]);
      // Margen para que las DOS hayan leído el contador y estén paradas en su `update`.
      await new Promise((r) => setTimeout(r, 5_000));
      liberarBarrera();
      await barrera;
      const [a, b] = await enCurso;

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
