// SCRUM-58 — GET /admin/jobs no hace N+1: el número de consultas NO crece con el número de
// Trabajos. Antes, `serializeJob` resolvía quote + customer + operario con una consulta POR
// FILA (3N); ahora se cargan en lote (3 fijas) y el serializer lee del mapa.
//
// El assert que importa NO es "son pocas consultas" (un umbral se elige a ojo y envejece),
// sino que **el conteo con 12 jobs es IGUAL que con 3**. Eso es lo que distingue un lote de
// un bucle, y es lo que se rompe el día que alguien vuelva a meter un `await prisma...`
// dentro del map — con umbral fijo podría colarse; con esta igualdad, no.
//
// ⚠️ GATEADO (crea/BORRA merchant + jobs efímeros; levanta la app):
//   QA_DB_TEST=1 npm run test:staging
process.env.QA_QUERY_LOG = '1'; // SCRUM-58: ANTES de cargar dist — el cliente Prisma decide
// al construirse si emite eventos de consulta; sin esto el contador engancha en el vacío (y el
// propio test lo caza con el assert de "no se enganchó", que es como se descubrió).
import './_staging-db.mjs'; // SCRUM-60
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-58: la lista de Trabajos no hace N+1 (las consultas no crecen con el nº de jobs)', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  try {
    await withMerchant(
      prisma,
      { name: 'QA S58', email: `qa-s58-${stamp}@test.local` },
      async (merchant) => {
        const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S58' } });
        const operario = await prisma.teamMember.create({
          data: { merchantId: merchant.id, name: 'Op S58', email: `qa-s58-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });

        const token = 'qa58-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: merchant.id, teamMemberId: null, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const cookie = ((await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' }))
          .headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

        // Cada job con quote propio: es el caso PEOR (ids distintos → el lote no puede
        // "hacer trampa" deduplicando). Con quote compartido el N+1 se notaría menos.
        const crearJobs = async (n) => {
          for (let i = 0; i < n; i++) {
            const quote = await prisma.quote.create({
              data: {
                merchantId: merchant.id, customerId: cliente.id, status: 'accepted',
                total: '100.00', currency: 'EUR', lines: [{ concept: `L${i}`, qty: 1, price: 100 }],
              },
            });
            await prisma.job.create({
              data: {
                merchantId: merchant.id, customerId: cliente.id, quoteId: quote.id,
                status: 'pendiente_agendar', titulo: `Trabajo S58 ${i}`, operarioId: operario.id,
              },
            });
          }
        };

        const contarConsultasDeLaLista = async () => {
          let n = 0;
          const contador = () => { n++; };
          prisma.$on('query', contador);
          const res = await fetch(`${base}/admin/jobs`, { headers: { cookie } });
          assert.equal(res.status, 200, 'la lista debe responder 200');
          const filas = await res.json();
          // margen para que el listener se vacíe antes de leer el contador
          await new Promise((r) => setTimeout(r, 300));
          return { consultas: n, filas: filas.length };
        };

        await crearJobs(3);
        const pocos = await contarConsultasDeLaLista();

        await crearJobs(9); // 12 en total
        const muchos = await contarConsultasDeLaLista();

        assert.equal(pocos.filas, 3, 'la primera medición debe ver 3 Trabajos');
        assert.equal(muchos.filas, 12, 'la segunda debe ver 12');
        assert.ok(pocos.consultas > 0, `el contador de consultas no se enganchó (${pocos.consultas}) — sin él este test no mide nada`);

        assert.equal(
          muchos.consultas, pocos.consultas,
          `🔴 N+1: 3 Trabajos → ${pocos.consultas} consultas, 12 Trabajos → ${muchos.consultas}. ` +
          `El coste debe ser CONSTANTE: si crece con las filas, alguien volvió a consultar dentro del bucle.`,
        );

        // Y el contenido sigue completo: el lote no puede "ahorrar" perdiendo datos.
        const res = await fetch(`${base}/admin/jobs`, { headers: { cookie } });
        const filas = await res.json();
        for (const f of filas) {
          assert.ok(f.customer && f.customer.name === 'Cliente S58', 'cada fila conserva su cliente');
          assert.ok(f.operario && f.operario.name === 'Op S58', 'cada fila conserva su operario');
          assert.ok(f.quote && f.quote.total === 100, 'cada fila conserva su presupuesto');
        }

        t.diagnostic(`SCRUM-58: 3 jobs → ${pocos.consultas} consultas · 12 jobs → ${muchos.consultas} (constante) ✓`);
      },
    );
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});
