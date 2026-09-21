// SCRUM-980 · EL HISTORIAL DE TRABAJO EN LA FICHA DEL CLIENTE — la ruta (primera mitad).
//
// `historialDelCliente` contra Postgres de verdad, que es donde viven las dos garantías:
//   · TENENCIA: cliente de otro merchant → null (la ruta da 404), y nada de otro merchant se cuela;
//   · el TÉCNICO ve solo sus trabajos (tres ejes de SCRUM-650) y los partes de ESOS trabajos — un
//     parte suelto no tiene autor en el esquema y no se le atribuye.
// Y lo que la pantalla va a pintar: título por `tituloDeTrabajo`, fotos contadas por albarán, próxima
// visita ausente cuando no la hay (ausente no es cero), y páginas de 20 con cursor.
//
// ⚠️ GATEADO, dos destinos (patrón SCRUM-876).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-980 · historialDelCliente: tenencia, técnico, fotos, próxima visita y páginas', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { historialDelCliente } = await import('../dist/modules/system/domain/historialDelCliente.js');
  // No se importa de dentro (SCRUM-411: `TRABAJOS_POR_PAGINA` no tiene consumidor fuera de este
  // fichero y el `export` quedaba huérfano). Se prueba por la SUPERFICIE PÚBLICA: 20 es el tamaño
  // de página documentado en `historialDelCliente.ts`.
  const TRABAJOS_POR_PAGINA = 20;
  const stamp = Date.now();
  const AHORA = new Date('2026-09-21T10:00:00Z');
  try {
    await withMerchant(prisma, { name: 'QA 980 A', email: `qa-980-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 980 B', email: `qa-980-b-${stamp}@test.local` }, async (b) => {
        const tec = await prisma.teamMember.create({ data: { merchantId: a.id, name: 'Téc 980', email: `tec-980-${stamp}@test.local`, role: 'tecnico', status: 'active' } });
        const ana = await prisma.customer.create({ data: { merchantId: a.id, name: 'Ana 980' } });
        const job = (data) => prisma.job.create({ data: { merchantId: a.id, customerId: ana.id, status: 'terminado', ...data } });
        const parte = (data) => prisma.parteTrabajo.create({ data: { merchantId: a.id, numero: `PT-980-${stamp}-${Math.random()}`, fecha: new Date('2026-03-01T09:00:00Z'), tecnicos: [], lineas: [], ...data } });

        const q = await prisma.quote.create({ data: { merchantId: a.id, customerId: ana.id, total: '10.00', currency: 'EUR', lines: [], status: 'accepted', quoteNumber: 77 } });
        const jDelPresupuesto = await job({ quoteId: q.id, titulo: null });                    // título del presupuesto
        const jDelTecnico = await job({ titulo: 'Caldera', assignedUserId: tec.id });
        const jAgendadoFuturo = await job({ titulo: 'Revisión', status: 'agendado', scheduledAt: new Date('2026-10-05T08:00:00Z') });
        await job({ titulo: 'Olvidado', status: 'agendado', scheduledAt: new Date('2026-08-01T08:00:00Z') }); // pasado: no es «próxima»
        const alb = await prisma.albaran.create({ data: { merchantId: a.id, jobId: jDelTecnico.id, numero: `ALB-980-${stamp}`, estado: 'firmado', lineas: [] } });
        for (let i = 0; i < 3; i++) {
          await prisma.attachment.create({ data: { merchantId: a.id, entityType: 'albaran', entityId: alb.id, url: `/x/${i}`, kind: 'photo' } });
        }
        const pDelTecnico = await parte({ jobId: jDelTecnico.id, customerId: ana.id });
        const pSuelto = await parte({ jobId: null, customerId: ana.id });

        // Otro merchant: un cliente suyo y un trabajo que apunta —mal— al id de Ana. No puede colarse.
        const deB = await prisma.customer.create({ data: { merchantId: b.id, name: 'De B 980' } });
        await prisma.job.create({ data: { merchantId: b.id, customerId: ana.id, status: 'terminado', titulo: 'INTRUSO' } });

        // ── Tenencia ──
        assert.equal(await historialDelCliente(a.id, deB.id, {}), null, '🔴 un cliente de OTRO merchant devuelve historial (debía ser 404)');

        // ── Admin ──
        const h = await historialDelCliente(a.id, ana.id, { ahora: AHORA });
        const titulos = h.trabajos.map((t) => t.titulo);
        // SUELO: vienen los cuatro de Ana; así un «no está» de abajo es del dato, no del lector.
        assert.equal(h.trabajos.length, 4, `SUELO: el admin debía ver 4 trabajos y ve ${h.trabajos.length}: ${titulos}`);
        assert.ok(!titulos.includes('INTRUSO'), '🔴 se cuela un trabajo de OTRO merchant');
        assert.ok(titulos.includes('Presupuesto #77 · Ana 980'), `🔴 el título no sale de tituloDeTrabajo: ${titulos}`);
        const caldera = h.trabajos.find((t) => t.id === jDelTecnico.id);
        assert.equal(caldera.albaranes.length, 1);
        assert.equal(caldera.albaranes[0].fotos, 3, '🔴 el albarán no cuenta sus fotos');
        assert.deepEqual(caldera.partes.map((p) => p.id), [pDelTecnico.id]);
        assert.deepEqual(h.partesSueltos.map((p) => p.id), [pSuelto.id], 'el admin ve el parte suelto del cliente');
        assert.equal(h.proximaVisita?.trabajoId, jAgendadoFuturo.id, '🔴 la próxima visita no es el agendado futuro más cercano');
        assert.ok(!('siguiente' in h), 'con 4 trabajos no hay página siguiente');

        // ── Técnico ──
        const t = await historialDelCliente(a.id, ana.id, { soloTrabajosDe: tec.id, ahora: AHORA });
        assert.deepEqual(t.trabajos.map((x) => x.id), [jDelTecnico.id], '🔴 el técnico ve trabajos que no son suyos');
        assert.deepEqual(t.partesSueltos, [], '🔴 al técnico le sale un parte suelto, que no tiene autor');
        assert.ok(!('proximaVisita' in t), '🔴 al técnico le sale la próxima visita de un trabajo que no es suyo (ausente no es cero)');

        // ── Páginas de 20 con cursor ──
        for (let i = 0; i < TRABAJOS_POR_PAGINA; i++) await job({ titulo: `Relleno ${i}` });
        const p1 = await historialDelCliente(a.id, ana.id, { ahora: AHORA });
        assert.equal(p1.trabajos.length, TRABAJOS_POR_PAGINA);
        assert.ok(p1.siguiente, '🔴 con 24 trabajos no se ofrece página siguiente');
        const p2 = await historialDelCliente(a.id, ana.id, { ahora: AHORA, despuesDe: p1.siguiente });
        const todos = [...p1.trabajos, ...p2.trabajos].map((x) => x.id);
        assert.equal(todos.length, 24, `🔴 entre las dos páginas faltan o sobran trabajos: ${todos.length}`);
        assert.equal(new Set(todos).size, 24, '🔴 un trabajo sale en las dos páginas');
        assert.ok(!('siguiente' in p2), 'la segunda es la última');
      }));
  } finally {
    await prisma.$disconnect();
  }
});
