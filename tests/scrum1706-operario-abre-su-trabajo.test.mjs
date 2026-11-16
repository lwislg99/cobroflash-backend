// tests/scrum1706-operario-abre-su-trabajo.test.mjs — SCRUM-1706 (PILOTO-1, paso 1 del flujo)
//
// 🔴 EL DEFECTO: un operario (rol `tecnico`) ve su trabajo en la LISTA y, al abrirlo, «No pudimos
// cargar el trabajo». La lista (`GET /admin/jobs`) filtra por los TRES ejes de pertenencia
// (SCRUM-467 + SCRUM-650: autoría `operarioId`, asignación `assignedUserId` y la tabla
// `assignees`); el detalle y sus hermanas de `/:id` miraban SOLO `operarioId`. Un trabajo que se le
// ASIGNA al operario —que es como llega el trabajo al piloto— se lista y se le niega con 404.
//
// Se mide POR COMPORTAMIENTO contra un banco desechable, con una sesión de técnico de verdad:
//   ① asignado por el CAMPO  → 2xx en las puertas de `/:id`
//   ② asignado por la TABLA  → igual
//   ③ CONTROL NEGATIVO: el trabajo de OTRO sigue dando 404 (si esto cae, el arreglo abrió de más)
//   ④ CONTROL POSITIVO: el que él ORIGINÓ ya funcionaba y sigue funcionando
//
// Las escrituras (`PATCH /:id`, `POST /:id/albaranes`) se miden con «no es 404»: lo que se prueba es
// la PUERTA de pertenencia, no la regla de negocio que viene detrás (FSM, validación del cuerpo).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// `node:http` sin agente y no `fetch` (SCRUM-1218d / SCRUM-560).
const pedir = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const cabeceras = { ...headers };
  if (body !== undefined) cabeceras['content-length'] = Buffer.byteLength(body);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: cabeceras, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => ok({ status: r.statusCode, text: d, headers: r.headers }));
  });
  req.on('error', mal);
  if (body !== undefined) req.write(body);
  req.end();
});

const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-1706 · 🔴 el operario abre el trabajo que le ASIGNARON (campo o tabla); el ajeno sigue en 404',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1706', email: `qa-1706-${stamp}@test.local` }, async (m) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1706', email: `qa-1706-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const otro = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Otro 1706', email: `qa-1706-otro-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1706' } });
        const job = (extra) => prisma.job.create({
          data: { merchantId: m.id, customerId: cliente.id, titulo: 'Trabajo 1706', ...extra },
        });
        const porCampo = await job({ assignedUserId: operario.id });
        const porTabla = await job({});
        await prisma.jobAssignee.create({ data: { jobId: porTabla.id, teamMemberId: operario.id } });
        const ajeno = await job({ operarioId: otro.id, assignedUserId: otro.id });
        const suyoDeAutor = await job({ operarioId: operario.id });

        const token = 'qa1706-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: m.id, teamMemberId: operario.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const v = await pedir(`${base}/auth/verify?token=${token}`);
        const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo la cookie de sesión del operario');

        const get = (ruta) => pedir(`${base}${ruta}`, { headers: { cookie } });
        const escribir = (metodo, ruta, cuerpo) => pedir(`${base}${ruta}`, {
          method: metodo, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
        });

        // Control: la LISTA ya le enseña los dos asignados (es la mitad que sí funcionaba).
        const lista = await get('/admin/jobs');
        assert.equal(lista.status, 200, `control: la lista del operario responde (${lista.status})`);
        for (const j of [porCampo, porTabla]) {
          assert.ok(lista.text.includes(`"id":${j.id}`), `control: la lista del operario incluye el trabajo #${j.id}`);
        }

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };

        for (const [caso, j] of [['① por el campo', porCampo], ['② por la tabla', porTabla], ['④ de autor', suyoDeAutor]]) {
          const det = await get(`/admin/jobs/${j.id}`);
          blando(() => assert.equal(det.status, 200, `🔴 ${caso}: GET /admin/jobs/${j.id} → ${det.status} (la ficha dice «No pudimos cargar el trabajo»)`));
          const gastos = await get(`/admin/jobs/${j.id}/gastos`);
          blando(() => assert.equal(gastos.status, 200, `🔴 ${caso}: GET /:id/gastos → ${gastos.status}`));
          const ics = await get(`/admin/jobs/${j.id}/ics`);
          blando(() => assert.notEqual(ics.status, 404, `🔴 ${caso}: GET /:id/ics → 404`));
          const patch = await escribir('PATCH', `/admin/jobs/${j.id}`, { status: 'en_curso' });
          blando(() => assert.notEqual(patch.status, 404, `🔴 ${caso}: PATCH /:id → 404 (no puede «Empezar» su trabajo)`));
          const alb = await escribir('POST', `/admin/jobs/${j.id}/albaranes`, {});
          blando(() => assert.notEqual(alb.status, 404, `🔴 ${caso}: POST /:id/albaranes → 404`));
        }

        // ③ El ajeno: TODAS las puertas siguen cerradas.
        for (const [metodo, ruta] of [['GET', ''], ['GET', '/gastos'], ['GET', '/ics'], ['PATCH', ''], ['POST', '/albaranes']]) {
          const r = metodo === 'GET'
            ? await get(`/admin/jobs/${ajeno.id}${ruta}`)
            : await escribir(metodo, `/admin/jobs/${ajeno.id}${ruta}`, metodo === 'PATCH' ? { status: 'en_curso' } : {});
          blando(() => assert.equal(r.status, 404, `🔴 ③ ${metodo} /admin/jobs/:id${ruta} del trabajo AJENO → ${r.status}: el arreglo abrió de más`));
        }

        assert.deepEqual(fallos, [], `\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });
