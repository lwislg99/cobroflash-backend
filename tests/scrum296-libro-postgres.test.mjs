// tests/scrum296-libro-postgres.test.mjs — SCRUM-296 (A6) · el control negativo CONTRA POSTGRES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO VALE UN DOBLE AQUÍ
//
// El resto de la suite prueba el CONSTRUCTOR con facturas en memoria, y eso comprueba que el
// libro descarta lo ajeno. Lo que no puede comprobar es lo único que separa un libro correcto de
// una fuga: **que la CONSULTA filtre**. Un doble responde lo que se le dice que responda, así
// que un `where` mal escrito da verde igual. Medir con un doble no es medir con la base.
//
// Y lo que está en juego lo dice el propio ticket: colar la factura de otro en un libro de
// registro no es una fuga de datos — es DECLARAR COMO PROPIA LA FACTURACIÓN DE UN TERCERO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE CORRE (banco local, NUNCA una base del proyecto)
//
//   LIBRO_PG_URL="postgresql://postgres@127.0.0.1:55432/yaqu_libro_test" \
//     node --test tests/scrum296-libro-postgres.test.mjs
//
// El banco se levanta con binarios portables de PostgreSQL en el scratchpad (cluster propio,
// puerto raro a propósito) y su esquema sale de `prisma migrate diff --from-empty
// --to-schema-datamodel` con el binario LOCAL 6.18.0 — nunca `npx` (SCRUM-385), nunca `db push`
// contra una base del proyecto (SCRUM-383). El procedimiento entero está en docs/master/SCRUM-296.md.
//
// ⚠️ EL GATE NO ES «SI HAY URL, ADELANTE». Este test CREA Y BORRA filas, así que antes de tocar
// nada comprueba que la URL apunta a un banco desechable: loopback y base terminada en `_test`.
// Cualquier otra cosa NO se salta — FALLA. Un test destructivo que se salta en silencio cuando
// le apuntan a la base equivocada es el que un día la encuentra abierta.
//
// El guard de tenencia que corre SIEMPRE (sin base, en `npm test`) es
// `scrum296-lector-tenencia.test.mjs`, por AST: un ticket cuyo único guard esté detrás de un
// gate es un ticket cuyo guard el CI no ejecuta nunca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
// El merchant lo crea la fixture, no este fichero: SCRUM-113 lo exige y tiene razón incluso en un
// banco desechable — si algo revienta a mitad, `withMerchant` borra igual, y su orden de barrido
// (SCRUM-170/172) sabe de albaranLineaFacturada, que a mano se olvida.
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';

/** Bases que este test NO puede tocar jamás, aunque alguien apunte la variable ahí. */
const PROHIBIDAS = ['railway', 'yaqu_dev', 'yaqu_dev_javier', 'postgres', 'staging', 'prod'];

/**
 * Fail-closed: devuelve la etiqueta segura del banco o LANZA. Nunca imprime la URL — un mensaje
 * de error con la URL dentro lleva la contraseña dentro (SCRUM-226).
 */
function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es una URL legible. No se toca nada.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host),
    `🔴 LIBRO_PG_URL apunta a «${p.host}», que no es loopback. Este test CREA Y BORRA filas: ` +
    'solo puede correr contra un banco local desechable.');
  assert.ok(p.base.endsWith('_test'),
    `🔴 la base «${p.base}» no termina en «_test». Es la única forma de garantizar por la FORMA ` +
    'del nombre —no por la buena intención de quien lanza el test— que no es una base del proyecto.');
  assert.ok(!PROHIBIDAS.includes(p.base),
    `🔴 la base «${p.base}» está en la lista de bases del proyecto. Aquí no se toca.`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

/** Marca única de esta ejecución, para que dos pasadas no se pisen ni dejen restos ambiguos. */
const SELLO = `t${process.pid}`;

async function crearCliente(prisma, merchantId, etiqueta) {
  return prisma.customer.create({
    data: { merchantId, name: `Cliente ${etiqueta}`, phone: `+34600${String(merchantId).padStart(6, '0')}` },
  });
}

async function crearFactura(prisma, { merchantId, customerId, number, total, extra = {} }) {
  return prisma.invoice.create({
    data: {
      merchantId,
      customerId,
      number,
      total,
      currency: 'EUR',
      pdfUrl: `https://qa.invalid/${number}.pdf`,
      qrData: `QR-${number}`,
      lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
      ...extra,
    },
  });
}

test('SCRUM-296 · CONTRA POSTGRES: el libro de un merchant no ve NI UNA factura del otro',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco local); el guard de tenencia por AST corre igual en npm test' },
  async (t) => {
    const donde = exigirBancoDesechable(URL_BANCO);
    t.diagnostic(`banco: ${donde}`);

    const { PrismaClient } = await import('@prisma/client');
    // La URL se pasa EXPLÍCITA. No se toca `process.env.DATABASE_URL`: así este test no puede
    // heredar, ni dejar puesta, la URL de ninguna base del proyecto.
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    const { leerLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.repo.js');

    try {
    // Dos merchants ANIDADOS, los dos por la fixture: al salir, cada uno se barre con su orden
    // (albaranLineaFacturada primero, SCRUM-170) aunque el test reviente en medio.
    await withMerchant(prisma, { name: `QA MIO ${SELLO}`, email: `mio.${SELLO}@qa.invalid` }, async (mioM) => {
    await withMerchant(prisma, { name: `QA OTRO ${SELLO}`, email: `otro.${SELLO}@qa.invalid` }, async (otroM) => {
      const mio  = { merchant: mioM,  customer: await crearCliente(prisma, mioM.id, 'MIO') };
      const otro = { merchant: otroM, customer: await crearCliente(prisma, otroM.id, 'OTRO') };

      // ── El merchant MÍO: un presupuesto FIRMADO, un cobro, un albarán y dos facturas ────────
      const presupuestoFirmado = await prisma.quote.create({
        data: {
          merchantId: mio.merchant.id, customerId: mio.customer.id, total: 121, currency: 'EUR',
          lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
          status: 'accepted', acceptedAt: new Date(),
          // El trazo. Lo que el libro NO se trae: solo el hecho de que existe.
          signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        },
      });
      // ⚠️ Aceptado pero SIN FIRMAR: es el control que distingue `acceptedAt` de `signatureUrl`.
      // Sin él, «firmado» y «aceptado» darían el mismo verde y la decisión no estaría medida.
      const presupuestoSoloAceptado = await prisma.quote.create({
        data: {
          merchantId: mio.merchant.id, customerId: mio.customer.id, total: 60, currency: 'EUR',
          lines: [], status: 'accepted', acceptedAt: new Date(), signatureUrl: null,
        },
      });
      const cobro = await prisma.charge.create({
        data: {
          merchantId: mio.merchant.id, customerId: mio.customer.id, concept: 'Señal',
          amount: 50, currency: 'EUR', method: 'transfer', status: 'paid',
        },
      });
      const trabajo = await prisma.job.create({
        data: { merchantId: mio.merchant.id, customerId: mio.customer.id, titulo: `Obra ${SELLO}` },
      });

      const f1 = await crearFactura(prisma, {
        merchantId: mio.merchant.id, customerId: mio.customer.id,
        number: `2026-CF-${SELLO}-001`, total: 121,
        extra: { quoteId: presupuestoFirmado.id, chargeId: cobro.id },
      });
      const f2 = await crearFactura(prisma, {
        merchantId: mio.merchant.id, customerId: mio.customer.id,
        number: `2026-CF-${SELLO}-002`, total: 60,
        extra: { quoteId: presupuestoSoloAceptado.id },
      });

      const albaran = await prisma.albaran.create({
        data: {
          merchantId: mio.merchant.id, jobId: trabajo.id, numero: `ALB-${SELLO}-1`,
          lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'ud' }],
          estado: 'firmado', invoiceId: f1.id,
        },
      });
      // El sello de la factura: lo que el documento DICE que consolidó (art. 6 Reglamento).
      await prisma.invoice.update({
        where: { id: f1.id },
        data: { albaranRefs: [{ albaranId: albaran.id, numero: albaran.numero, fecha: '2026-03-01' }] },
      });

      // ── El merchant OTRO: tres facturas que NO pueden aparecer jamás ────────────────────────
      for (const n of ['001', '002', '003']) {
        await crearFactura(prisma, {
          merchantId: otro.merchant.id, customerId: otro.customer.id,
          number: `2026-XX-${SELLO}-${n}`, total: 999,
        });
      }

      // ── SUELO: si el libro del MÍO sale vacío, no es que no haya: es que no supe leer ───────
      const libro = await leerLibroRegistro(prisma, { merchantId: mio.merchant.id });

      assert.ok(libro.miradas >= 2,
        `🔴 el lector solo miró ${libro.miradas} facturas habiendo sembrado 2 para este merchant. ` +
        'Un libro vacío no se lee como «no encontré nada»: se lee como «no facturaste nada», y ' +
        'ante Hacienda eso es una afirmación.');
      assert.equal(libro.asientos.length, 2,
        '🔴 el libro no tiene los dos asientos sembrados.');

      // ── EL CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────
      const numeros = libro.asientos.map((a) => a.numero).sort();
      assert.deepEqual(numeros, [`2026-CF-${SELLO}-001`, `2026-CF-${SELLO}-002`],
        '🔴 el libro del merchant MÍO enseña facturas que no son suyas. En un libro de registro ' +
        'eso no es una fuga: es declarar como propia la facturación de un tercero.');
      assert.equal(numeros.filter((n) => n.includes('-XX-')).length, 0,
        '🔴 se ha colado al menos una factura del OTRO merchant.');
      assert.equal(libro.ajenas, 0,
        '🔴 la consulta trajo filas ajenas y las paró el constructor. La segunda cerradura ha ' +
        'funcionado, pero la PRIMERA (el `where` de la consulta) está abierta.');

      // Y el negativo del negativo: el libro del OTRO ve las suyas y ninguna mía.
      const libroOtro = await leerLibroRegistro(prisma, { merchantId: otro.merchant.id });
      assert.equal(libroOtro.asientos.length, 3);
      assert.equal(libroOtro.asientos.filter((a) => a.numero.includes('-CF-')).length, 0,
        '🔴 el merchant OTRO ve facturas del MÍO: la fuga existe en las dos direcciones.');

      // ── LOS ENLACES: lo que hace este libro nuestro y no una tabla ───────────────────────────
      const a1 = libro.asientos.find((a) => a.numero.endsWith('-001'));
      const a2 = libro.asientos.find((a) => a.numero.endsWith('-002'));

      assert.equal(a1.enlaces.presupuestoId, presupuestoFirmado.id,
        '🔴 el asiento no enlaza con su presupuesto: se pierde de dónde viene el euro.');
      assert.equal(a1.enlaces.presupuestoFirmado, true,
        '🔴 el presupuesto tiene firma y el libro no lo dice.');
      assert.equal(a1.enlaces.cobroId, cobro.id,
        '🔴 el asiento no enlaza con su cobro: se pierde dónde acabó el euro.');
      assert.deepEqual(a1.enlaces.albaranes, [{ albaranId: albaran.id, numero: albaran.numero }],
        '🔴 el asiento no enlaza con su albarán: se pierde qué se entregó a cambio.');
      assert.equal(a1.enlaces.albaranesNoSellados, 0,
        '🔴 el albarán está en el sello y aun así cuenta como no sellado.');

      // La distinción que justifica la decisión: aceptado NO es firmado.
      assert.equal(a2.enlaces.presupuestoFirmado, false,
        '🔴 un presupuesto ACEPTADO pero sin firma sale como firmado. `acceptedAt` dice que el ' +
        'cliente le dio a un botón; `signatureUrl` es la prueba el día que diga que no lo pidió.');
      assert.equal(a2.enlaces.cobroId, null);

      // ── EL DESCUADRE QUE UN LIBRO TIENE QUE DEJAR VER ───────────────────────────────────────
      // Un albarán que apunta hoy a la factura y NO estaba en el sello. La factura emitida dice
      // lo que dice (regla 29): no se le añade — se CUENTA.
      const albaranTardio = await prisma.albaran.create({
        data: {
          merchantId: mio.merchant.id, jobId: trabajo.id, numero: `ALB-${SELLO}-2`,
          lineas: [], estado: 'firmado', invoiceId: f1.id,
        },
      });
      const libro2 = await leerLibroRegistro(prisma, { merchantId: mio.merchant.id });
      const a1b = libro2.asientos.find((a) => a.numero.endsWith('-001'));
      assert.equal(a1b.enlaces.albaranes.length, 1,
        '🔴 el asiento ha añadido un albarán que la factura emitida NO sella (regla 29).');
      assert.equal(a1b.enlaces.albaranesNoSellados, 1,
        `🔴 el albarán ${albaranTardio.numero} apunta a la factura y no está en el sello, y el ` +
        'libro no lo declara. Un descuadre que no se cuenta es indistinguible de que no exista.');

      // ── El rango de fechas, también filtrado por merchant ────────────────────────────────────
      const futuro = new Date(Date.now() + 86400000);
      const vacio = await leerLibroRegistro(prisma, { merchantId: mio.merchant.id, desde: futuro });
      assert.equal(vacio.asientos.length, 0);
      assert.equal(vacio.miradas, 0, 'y lo dice: cero miradas, no cero asientos de cuarenta miradas');
    });
    });
    } finally {
      await prisma.$disconnect();
    }
  });
