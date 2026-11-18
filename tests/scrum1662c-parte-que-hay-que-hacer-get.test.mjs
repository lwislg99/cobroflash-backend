// SCRUM-1662 (c) · «QUÉ HAY QUE HACER» LLEGA AL PARTE EN SU GET, LEÍDO DEL TRABAJO EN VIVO.
//
// Decisión del orquestador en SCRUM-1662 c.21964 (opción A, precedente 1697 (b)): la pantalla del parte
// no puede pedir `GET /admin/jobs/:id` (guards de SCRUM-366 y SCRUM-1697 ①bis, choque medido por S4 en
// c.21962), así que es el SERVIDOR quien lee `Job.queHayQueHacer` y lo añade a la respuesta de
// `GET /admin/partes/:id`. La forma de fondo es la de c.21892: se LEE del trabajo en cada GET, no se
// copia al parte, no lleva esquema y no entra en lo que firma el cliente.
//
// Y va tras la MISMA puerta por rol que la visita: el técnico sólo la recibe de un trabajo que es suyo.
//
// Con banco desechable (LIBRO_PG_URL, loopback y base «*_test») o QA_DB_TEST=1; sin ninguno, salta
// declarando su motivo.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// `node:http` sin agente y no `fetch` (SCRUM-1218d).
const pedir = (url, { method = 'GET', headers = {} } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => ok({ status: r.statusCode, headers: r.headers, text: d }));
  });
  req.on('error', mal);
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

test('SCRUM-1662c · 🔴 GET /admin/partes/:id trae queHayQueHacer leído del trabajo: con tarea, sin tarea, en vivo y tras la puerta por rol',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    const TAREA = `QA 1662c: revisar la caldera ${stamp}`;
    const TAREA_NUEVA = `QA 1662c: cambiar el termostato ${stamp}`;
    try {
      await withMerchant(prisma, { name: 'QA 1662c', email: `qa-1662c-${stamp}@test.local` }, async (m) => {
        const asignado = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1662c', email: `qa-1662c-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const otro = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Otro operario 1662c', email: `qa-1662c-otro-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1662c' } });
        const conTarea = await prisma.job.create({ data: { merchantId: m.id, customerId: cliente.id, titulo: 'Con tarea', queHayQueHacer: TAREA } });
        await prisma.jobAssignee.create({ data: { jobId: conTarea.id, teamMemberId: asignado.id } });
        const sinTarea = await prisma.job.create({ data: { merchantId: m.id, customerId: cliente.id, titulo: 'Sin tarea' } });
        const parte = (data) => prisma.parteTrabajo.create({ data: { merchantId: m.id, customerId: cliente.id, lineas: [], fecha: new Date('2026-11-17T08:00:00Z'), ...data } });
        const pCon = await parte({ jobId: conTarea.id, numero: `PT-1662c-1-${stamp}` });
        const pSin = await parte({ jobId: sinTarea.id, numero: `PT-1662c-2-${stamp}` });
        const pSuelto = await parte({ jobId: null, numero: `PT-1662c-3-${stamp}` });

        const sesion = async (teamMemberId) => {
          const token = 'qa1662c-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const v = await pedir(`${base}/auth/verify?token=${token}`);
          const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
          assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo cookie de sesión');
          return cookie;
        };
        const jefe = await sesion(null);
        const tecnico = await sesion(asignado.id);
        const ajeno = await sesion(otro.id);

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
        const leer = async (cookie, p, caso) => {
          const r = await pedir(`${base}/admin/partes/${p.id}`, { headers: { cookie } });
          assert.equal(r.status, 200, `control: ${caso} abre el parte ${p.id} (${r.status} ${r.text.slice(0, 120)})`);
          const j = JSON.parse(r.text);
          // Control positivo: el GET es el del parte y trae ya la visita (1697 b). Si esto falla, el
          // rojo de abajo no diría nada de queHayQueHacer.
          assert.equal(j.id, p.id, `control: ${caso} recibe el parte ${p.id}`);
          return j;
        };

        // ① El jefe, parte de un trabajo CON tarea: la clave llega con el texto del trabajo.
        const j1 = await leer(jefe, pCon, 'el jefe');
        blando(() => assert.equal(j1.queHayQueHacer, TAREA, '🔴 ① el jefe recibe la tarea del trabajo en el parte'));
        // ② Parte de un trabajo SIN tarea: null (la pantalla no pinta la línea).
        const j2 = await leer(jefe, pSin, 'el jefe');
        blando(() => assert.equal(j2.queHayQueHacer ?? null, null, '🔴 ② sin tarea en el trabajo, queHayQueHacer es null'));
        // ③ Parte suelto: no hay trabajo del que leer.
        const j3 = await leer(jefe, pSuelto, 'el jefe');
        blando(() => assert.equal(j3.queHayQueHacer ?? null, null, '🔴 ③ el parte suelto no trae tarea'));
        // ④ El técnico asignado la recibe, sin leer la ficha del trabajo.
        const j4 = await leer(tecnico, pCon, 'el técnico asignado');
        blando(() => assert.equal(j4.queHayQueHacer, TAREA, '🔴 ④ el técnico asignado recibe la tarea en su parte'));
        // ⑤ EN VIVO: se cambia la tarea en el trabajo y el siguiente GET del parte trae la nueva. Nada se
        //    copió al parte: no hay columna donde copiarlo, y la fila del parte no lleva el texto.
        await prisma.job.update({ where: { id: conTarea.id }, data: { queHayQueHacer: TAREA_NUEVA } });
        const j5 = await leer(jefe, pCon, 'el jefe');
        blando(() => assert.equal(j5.queHayQueHacer, TAREA_NUEVA, '🔴 ⑤ el GET lee el trabajo en vivo, no una copia'));
        const fila = await prisma.parteTrabajo.findUnique({ where: { id: pCon.id } });
        const textoFila = JSON.stringify(fila);
        blando(() => assert.ok(!textoFila.includes('caldera') && !textoFila.includes('termostato'), '🔴 ⑤ la fila del parte no guarda la tarea'));
        // ⑥ PUERTA POR ROL: un técnico que no es del trabajo no abre el parte y la tarea no viaja.
        const r6 = await pedir(`${base}/admin/partes/${pCon.id}`, { headers: { cookie: ajeno } });
        blando(() => assert.equal(r6.status, 404, `🔴 ⑥ el técnico ajeno no abre el parte (${r6.status})`));
        blando(() => assert.ok(!r6.text.includes('termostato') && !r6.text.includes('caldera'), '🔴 ⑥ la tarea no viaja al técnico ajeno'));

        assert.deepEqual(fallos, [], `🔴 ${fallos.length} fallo(s):\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.closeAllConnections?.();
      server.close();
      try { await prisma.$disconnect(); } catch { /* nada que cerrar */ }
    }
  });
