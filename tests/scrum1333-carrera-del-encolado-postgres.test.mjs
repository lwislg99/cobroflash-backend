// SCRUM-1333 · LA MISMA FACTURA NO SE ENCOLA DOS VECES — la mitad con POSTGRES DE VERDAD.
//
// `tests/scrum1333-una-factura-se-encola-una-vez.test.mjs` corre en cada `npm test` sobre un banco
// en memoria, que modela el cerrojo consultivo como una exclusión por clave. Eso NO es Postgres:
// no prueba que `pg_advisory_xact_lock` haga esperar de verdad al segundo encolado, ni que su
// recuento —lanzado después de conseguir el cerrojo, en READ COMMITTED— vea la fila que acaba de
// confirmar el primero. Las dos cosas son del motor, y sólo las contesta el motor.
//
// De paso mide lo que SCRUM-1330 dejó dicho como «sin medir»: una segunda pasada por
// `sellarTrasEmision` sobre una factura ya sellada, contra una base real (la rama de
// `applyVeriFactu` que devuelve el sello persistido).
//
// GATEADO por `LIBRO_PG_URL`: un Postgres DESECHABLE (loopback, base terminada en `_test`). CI lo
// levanta solo. Crea un comercio de usar y tirar con `withMerchant`, que lo barre al terminar.
//
// 🔴 SU LÍMITE, DICHO: se escribió en una máquina SIN Postgres. Su primera ejecución es la de CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = URL_BANCO !== '';

const NIF = 'B12345678';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function cargar() {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { applyVeriFactu } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  const { sellarTrasEmision } = await import('../dist/modules/invoicing/domain/selladoEstado.js');
  const { encolarAltaTrasSellado, ENCOLADO_LOCK_NS } = await import('../dist/modules/invoicing/domain/encolarRemision.js');
  assert.equal(typeof ENCOLADO_LOCK_NS, 'number', '🔴 CIEGO: no encuentro la clave del cerrojo del encolado');
  return { prisma, applyVeriFactu, sellarTrasEmision, encolarAltaTrasSellado, ENCOLADO_LOCK_NS };
}

/** Una factura DECLARABLE (cliente con NIF, línea al 21 %), sin sellar. */
async function nuevaFactura(prisma, merchant, sufijo) {
  const cliente = await prisma.customer.create({
    data: { merchantId: merchant.id, name: 'Clienta 1333', legalName: 'Clienta 1333 SL', taxId: '12345678Z' },
  });
  return prisma.invoice.create({
    data: {
      merchantId: merchant.id, customerId: cliente.id, number: `QA1333${sufijo}-${Date.now()}`, status: 'pending',
      total: '121.00', currency: 'EUR', type: 'F1',
      lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
      pdfUrl: '', qrData: '',
    },
  });
}

/** La misma, ya SELLADA y sin pasar por el encolado: la cola empieza vacía para ella. */
async function facturaSelladaSinEncolar(prisma, applyVeriFactu, merchant, sufijo) {
  const inv = await nuevaFactura(prisma, merchant, sufijo);
  const sello = await applyVeriFactu(inv, NIF, prisma);
  assert.match(String(sello.vfHash), /^[0-9A-F]{64}$/, '🔴 CIEGO: la factura no se selló');
  await prisma.invoice.update({ where: { id: inv.id }, data: { vfEstado: 'sellado' } });
  return inv;
}

const colaDe = (prisma, inv) => prisma.vfSubmission.findMany({ where: { invoiceId: inv.id }, orderBy: { id: 'asc' } });
const fiscalDe = (merchant) => ({ country: 'ES', taxId: NIF, email: merchant.email });

test('SCRUM-1333 · POSTGRES · ✅ una pasada encola UNA fila, y una SEGUNDA pasada por `sellarTrasEmision` ni encola otra ni toca la huella',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' }, async () => {
    const { prisma, sellarTrasEmision } = await cargar();
    await withMerchant(prisma, { name: 'QA 1333 a', taxId: NIF, email: `qa-1333-a-${Date.now()}@test.local` }, async (merchant) => {
      const inv = await nuevaFactura(prisma, merchant, 'A');

      const primera = await sellarTrasEmision(inv, fiscalDe(merchant), prisma);
      assert.equal(primera.estado, 'sellado', `🔴 CIEGO: la primera pasada no selló (${JSON.stringify(primera)})`);
      const cola1 = await colaDe(prisma, inv);
      assert.equal(cola1.length, 1,
        '🔴 CIEGO: la primera pasada no dejó su fila en la cola (¿la factura no es declarable?): lo de abajo no mediría nada');
      assert.equal(cola1[0].tipoOperacion, 'Alta');
      assert.equal(cola1[0].merchantId, merchant.id);
      const sellada = await prisma.invoice.findUnique({ where: { id: inv.id }, select: { vfHash: true, vfPrevHash: true, vfTimestamp: true, qrData: true, vfEstado: true } });
      assert.ok(cola1[0].registroXml.includes(sellada.vfHash), 'el registro encolado lleva la huella sellada');

      const segunda = await sellarTrasEmision(inv, fiscalDe(merchant), prisma);
      assert.equal(segunda.estado, 'sellado', 'la segunda pasada termina como sellada: la huella se conserva (SCRUM-1330, guarda B)');

      const cola2 = await colaDe(prisma, inv);
      assert.equal(cola2.length, 1, `🔴 LA MISMA FACTURA ESTÁ ${cola2.length} VECES EN LA COLA DE LA AEAT tras una segunda pasada.`);
      assert.equal(cola2[0].id, cola1[0].id, 'y es la misma fila, sin tocar');
      const despues = await prisma.invoice.findUnique({ where: { id: inv.id }, select: { vfHash: true, vfPrevHash: true, vfTimestamp: true, qrData: true, vfEstado: true } });
      assert.deepEqual(despues, sellada, '⛔ la segunda pasada ha cambiado lo sellado: huella, anterior, sello o QR');
    });
  });

test('SCRUM-1333 · POSTGRES · 🔴 seis encolados A LA VEZ de la misma factura → UNA fila',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' }, async () => {
    const { prisma, applyVeriFactu, encolarAltaTrasSellado } = await cargar();
    await withMerchant(prisma, { name: 'QA 1333 b', taxId: NIF, email: `qa-1333-b-${Date.now()}@test.local` }, async (merchant) => {
      const inv = await facturaSelladaSinEncolar(prisma, applyVeriFactu, merchant, 'B');
      assert.equal((await colaDe(prisma, inv)).length, 0, 'SUELO: la cola empieza vacía para esta factura');

      const resultados = await Promise.all(
        Array.from({ length: 6 }, () => encolarAltaTrasSellado(inv, fiscalDe(merchant), prisma)),
      );

      const cola = await colaDe(prisma, inv);
      assert.equal(cola.length, 1,
        `🔴 SEIS ENCOLADOS A LA VEZ HAN DEJADO ${cola.length} FILAS para una factura. Resultados: ${JSON.stringify(resultados)}`);
      assert.equal(resultados.filter((r) => r.encolado === true).length, 1, `uno encola: ${JSON.stringify(resultados)}`);
      assert.equal(resultados.filter((r) => r.encolado === false && r.motivo === 'ya_encolada').length, 5,
        `y los otros cinco dicen que ya estaba, sin fallar: ${JSON.stringify(resultados)}`);
    });
  });

test('SCRUM-1333 · POSTGRES · 🔴 el encolado ESPERA al cerrojo de su factura, y pregunta DESPUÉS de conseguirlo',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' }, async () => {
    // Sin carrera y sin ventanas: otro tiene el cerrojo de la factura, y se mira en `pg_locks` que
    // el encolado está ESPERÁNDOLO. Mientras espera no ha escrito nada. Entonces el titular deja
    // su fila y suelta; el encolado entra, cuenta, la ve, y no escribe otra.
    const { prisma, applyVeriFactu, encolarAltaTrasSellado, ENCOLADO_LOCK_NS } = await cargar();
    await withMerchant(prisma, { name: 'QA 1333 c', taxId: NIF, email: `qa-1333-c-${Date.now()}@test.local` }, async (merchant) => {
      const inv = await facturaSelladaSinEncolar(prisma, applyVeriFactu, merchant, 'C');

      let soltar; const puerta = new Promise((r) => { soltar = r; });
      let avisar; const cerrojoTomado = new Promise((r) => { avisar = r; });
      const titular = prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ENCOLADO_LOCK_NS}::int, ${inv.id}::int)`;
        avisar();
        await puerta;
        await tx.vfSubmission.create({
          data: { merchantId: merchant.id, invoiceId: inv.id, obligadoNif: NIF, tipoOperacion: 'Alta', registroXml: '<fila-del-titular/>' },
        });
      }, { timeout: 30_000, maxWait: 10_000 });
      titular.catch(() => {}); // su error, si lo hay, se lee abajo con `await`
      let encolado;
      try {
        await cerrojoTomado;
        encolado = encolarAltaTrasSellado(inv, fiscalDe(merchant), prisma);

        let esperando = 0;
        for (let i = 0; i < 100 && esperando === 0; i += 1) {
          const filas = await prisma.$queryRaw`
            SELECT count(*)::int AS n FROM pg_locks
            WHERE locktype = 'advisory' AND classid::bigint = ${ENCOLADO_LOCK_NS}::bigint
              AND objid::bigint = ${inv.id}::bigint AND NOT granted`;
          esperando = Number(filas[0].n);
          if (esperando === 0) await esperar(50);
        }
        assert.equal(esperando, 1,
          '🔴 EL ENCOLADO NO ESPERA AL CERROJO DE SU FACTURA: en 5 s no ha aparecido en `pg_locks` como pendiente de '
          + `(${ENCOLADO_LOCK_NS}, ${inv.id}). Preguntar y escribir no van bajo ese cerrojo.`);
        assert.equal((await colaDe(prisma, inv)).length, 0, '🔴 el encolado ha escrito SIN tener el cerrojo');
      } finally {
        soltar();
        await titular.catch(() => {});
      }
      await titular; // si el titular falló, que se vea

      const r = await encolado;
      assert.deepEqual(r, { encolado: false, motivo: 'ya_encolada' },
        '🔴 el encolado que esperó no ha visto la fila que dejó el titular: su pregunta es anterior al cerrojo');
      const cola = await colaDe(prisma, inv);
      assert.equal(cola.length, 1, `🔴 ${cola.length} filas en la cola para una factura`);
      assert.equal(cola[0].registroXml, '<fila-del-titular/>', 'y la que queda es la del titular');
    });
  });
