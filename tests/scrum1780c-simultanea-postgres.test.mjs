// tests/scrum1780c-simultanea-postgres.test.mjs — SCRUM-1780c (J1), relevo jv-j1gh
//
// FACTURA DESDE EL PARTE · DOS PETICIONES SIMULTÁNEAS CONTRA POSTGRES DE VERDAD.
//
// Forma B1 (decisión del fundador, SCRUM-1780 c.22252): `facturarParteDeMerchant` EMITE primero y
// ENLAZA después, con `updateMany` sobre `{ id, merchantId, estado: 'firmado', invoiceId: null }`. Si
// no toca exactamente una fila, lanza y la transacción deshace la factura Y el número. Que eso pase
// de verdad depende de dos cosas que sólo tiene el motor: que la tx se deshaga entera, y que el
// segundo UPDATE espere al bloqueo de la fila y vuelva a evaluar su WHERE (READ COMMITTED). El banco
// en memoria de `scrum1780c-factura-desde-parte.test.mjs` no hace ninguna de las dos (lo dice él).
//
// GATEADO por `LIBRO_PG_URL`: un Postgres DESECHABLE (loopback, base terminada en `_test`; receta en
// `docs/RUNBOOKS.md`). CI lo pone en el paso de tests del check obligatorio (`ci.yml`). Sin la
// variable, el caso se SALTA con su motivo declarado; con una variable que no sea un banco
// desechable, el fichero LANZA y no toca nada (este test EMITE FACTURAS).
//
// 🔴 LA CARRERA SE PROVOCA, NO SE ESPERA (la lección de `scrum814`). Una tercera transacción
// (`retén`) bloquea la fila del parte con `FOR UPDATE` ANTES de lanzar las dos peticiones; las dos
// leen el parte sin factura, pasan la precomprobación y entran en su tx. El test NO suelta el retén
// hasta ver en `pg_blocking_pids` que las DOS están esperando detrás de él (una en la fila del parte,
// la otra en el cerrojo de serie detrás de la primera). Si no llegan a esperar las dos, el caso CAE
// diciendo que no hubo carrera: un «no se reproduce» ahí sería un falso negativo del banco.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  // Retén + dos peticiones + la sonda de bloqueos: cuatro conexiones como mínimo a la vez.
  process.env.DATABASE_URL = URL_BANCO + (URL_BANCO.includes('?') ? '&' : '?') + 'connection_limit=8';
}
const CON_BASE = URL_BANCO !== '';

const ACTOR = { tipo: 'pro_propietario', teamMemberId: null, ref: null };
const LINEAS = [
  { bloque: 'Material', unds: 2, descripcion: 'Tubo multicapa 16mm', precioUnitario: 12.5, tipoIva: 21 },
  { bloque: 'Mano de obra', unds: 1, descripcion: 'Cambio de grifo', precioUnitario: 80, tipoIva: 10 },
];
// Como scrum814: el interruptor POR MERCHANT, para que se mida el camino de emisión real y no un 409
// de `facturacion_no_disponible` en las dos (que daría «una factura» sobre cero, CIEGO).
const FISCAL_ON = { flags: { INVOICING_ES_ENABLED: true }, llevaLibrosPorSii: false };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

/** Cuántas sesiones esperan detrás del retén: directamente, o detrás de una que espera por él. */
async function esperandoDetrasDe(prisma, pidReten) {
  const [{ directas, indirectas }] = await prisma.$queryRaw`
    WITH d AS (
      SELECT pid FROM pg_stat_activity WHERE ${pidReten}::int = ANY(pg_blocking_pids(pid))
    )
    SELECT (SELECT count(*) FROM d)::int AS directas,
           (SELECT count(*) FROM pg_stat_activity s
             WHERE s.pid NOT IN (SELECT pid FROM d)
               AND pg_blocking_pids(s.pid) && ARRAY(SELECT pid FROM d))::int AS indirectas`;
  return { directas, indirectas };
}

test('SCRUM-1780c · POSTGRES · doble facturación simultánea → un 201 y un 409, UNA factura, contador +1',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { facturarParteDeMerchant } = await import('../dist/modules/invoicing/domain/facturaDesdeParte.js');
    const { resolveSeriesSeq } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

    await withMerchant(prisma, { name: 'QA SCRUM-1780c carrera', email: `qa-1780c-${Date.now()}@test.local`, ...FISCAL_ON }, async (m) => {
      const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Clienta de Lugo' } });
      const parte = await prisma.parteTrabajo.create({
        data: {
          merchantId: m.id, customerId: cliente.id, numero: 'PT-1780c', fecha: new Date('2026-11-20T10:00:00Z'),
          lineas: LINEAS, estado: 'firmado',
        },
      });
      const serieAntes = await prisma.merchant.findUnique({
        where: { id: m.id }, select: { nextInvoiceNumber: true, invoiceSeriesYear: true },
      });

      // ── El retén: bloquea la fila del parte hasta que las dos peticiones estén esperando ──────
      let soltar; const suelto = new Promise((r) => { soltar = r; });
      let enPosicion; const pidListo = new Promise((r) => { enPosicion = r; });
      const reten = prisma.$transaction(async (h) => {
        const [{ pid }] = await h.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
        await h.$queryRaw`SELECT id FROM partes_trabajo WHERE id = ${parte.id} FOR UPDATE`;
        enPosicion(pid);
        await suelto;
      }, { timeout: 30000, maxWait: 10000 });
      const pidReten = await pidListo;

      const llamar = () => facturarParteDeMerchant({ merchantId: m.id, parteId: parte.id, actor: ACTOR });
      const peticiones = [llamar(), llamar()];

      // 🔴 EL SUELO DE LA CARRERA: las dos dentro de su tx y esperando, o no se ha medido nada.
      let visto = { directas: 0, indirectas: 0 };
      const limite = Date.now() + 20000;
      while (Date.now() < limite) {
        visto = await esperandoDetrasDe(prisma, pidReten);
        if (visto.directas + visto.indirectas >= 2) break;
        await esperar(25);
      }
      soltar();
      await reten;
      const rs = await Promise.all(peticiones);
      assert.ok(visto.directas + visto.indirectas >= 2,
        `🔴 NO HA HABIDO CARRERA: detrás del retén esperaban ${JSON.stringify(visto)} (hacen falta 2). `
        + `Respuestas: ${JSON.stringify(rs)}. Un «una factura» aquí no mediría la concurrencia.`);

      // ── Lo que el fundador decidió (c.22252) ─────────────────────────────────────────────────
      const codigos = rs.map((r) => (r.ok ? 201 : r.status)).sort();
      assert.deepEqual(codigos, [201, 409], `respuestas: ${JSON.stringify(rs)}`);
      assert.deepEqual(rs.find((r) => !r.ok), { ok: false, status: 409, error: 'parte_ya_facturado' });

      const facturas = await prisma.invoice.findMany({ where: { merchantId: m.id }, select: { id: true, number: true } });
      assert.equal(facturas.length, 1, `🔴 la carrera ha dejado ${facturas.length} facturas de UN parte: ${JSON.stringify(facturas)}`);
      const ganadora = rs.find((r) => r.ok);
      assert.equal(facturas[0].id, ganadora.factura.id);

      const enlazado = await prisma.parteTrabajo.findUnique({ where: { id: parte.id }, select: { invoiceId: true, estado: true } });
      assert.deepEqual(enlazado, { invoiceId: facturas[0].id, estado: 'firmado' },
        'B1: el parte se queda firmado y lo marca su invoiceId (la Parte L no tiene `facturado`)');

      // El contador sube UNO: la tx perdedora deshizo también su número.
      const serieDespues = await prisma.merchant.findUnique({
        where: { id: m.id }, select: { nextInvoiceNumber: true, invoiceSeriesYear: true },
      });
      assert.equal(serieDespues.nextInvoiceNumber, resolveSeriesSeq(serieAntes, serieDespues.invoiceSeriesYear) + 1,
        `🔴 el contador no subió exactamente uno: antes ${JSON.stringify(serieAntes)}, después ${JSON.stringify(serieDespues)}`);
    });
  });
