// SCRUM-1697 (b) · «VISITA {n} DE {m}» SALE DEL SERVIDOR, EN EL GET DEL PARTE.
//
// M2 del máster (Parte L, 073c67ade): un trabajo tiene varios partes, uno por visita, y la visita ES su
// parte. «Visita {n} de {m}» cuenta los partes del trabajo por `fecha` y, a igual fecha, por `numero`;
// `m` = todos los partes del trabajo, también los borradores.
//
// Por qué en el servidor: la pantalla del parte lo calculaba pidiendo `GET /admin/jobs/:id` entero
// (PR #3085), una lectura del trabajo desde una vista que no es suya (guard de SCRUM-366), y el técnico
// que abre el parte no tiene por qué poder leer la ficha del trabajo. Con `visitaN`/`visitaM` en el
// GET del parte, la pantalla no pide nada más.
//
// Dos mitades:
//   · la REGLA (orden y recuento), pura, sin banco: corre en `npm test`.
//   · la RUTA, con banco desechable: que el GET la devuelve, que cuenta solo los del merchant y que el
//     técnico asignado también la recibe.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// ── LA REGLA ────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1697b · la visita se cuenta por fecha y, a igual fecha, por número (numérico, no por texto)', async () => {
  const { visitaDelParte } = await import('../dist/modules/jobs/domain/visitaDelParte.js');
  const d1 = new Date('2026-11-10T08:00:00Z');
  const d2 = new Date('2026-11-11T08:00:00Z');
  const partes = [
    { id: 30, fecha: d2, numero: 'PT-2026-10' },
    { id: 10, fecha: d1, numero: 'PT-2026-50' }, // el número más alto, pero la fecha más vieja: va primero
    { id: 20, fecha: d2, numero: 'PT-2026-9' }, // a igual fecha, 9 va antes que 10 (por texto iría después)
  ];
  assert.deepEqual(visitaDelParte(10, partes), { visitaN: 1, visitaM: 3 });
  assert.deepEqual(visitaDelParte(20, partes), { visitaN: 2, visitaM: 3 });
  assert.deepEqual(visitaDelParte(30, partes), { visitaN: 3, visitaM: 3 });
  // Uno solo en el trabajo: es la visita 1 de 1. Si se pinta o no, lo decide la pantalla (N4: «con varios»).
  assert.deepEqual(visitaDelParte(7, [{ id: 7, fecha: d1, numero: 'PT-2026-1' }]), { visitaN: 1, visitaM: 1 });
  // FALLA CERRADO: un parte que no está en la lista no recibe un número inventado.
  assert.deepEqual(visitaDelParte(99, partes), { visitaN: null, visitaM: null });
  assert.deepEqual(visitaDelParte(1, []), { visitaN: null, visitaM: null });
});

// ── LA RUTA ─────────────────────────────────────────────────────────────────────────────────
// `node:http` sin agente y no `fetch` (SCRUM-1218d).
const pedir = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const cabeceras = { ...headers };
  if (body !== undefined) cabeceras['content-length'] = Buffer.byteLength(body);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: cabeceras, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => ok({ status: r.statusCode, headers: r.headers, text: d }));
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

test('SCRUM-1697b · 🔴 GET /admin/partes/:id trae visitaN/visitaM: del merchant, con borradores, y también para el técnico',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    const d1 = new Date('2026-11-10T08:00:00Z');
    const d2 = new Date('2026-11-11T08:00:00Z');
    try {
      await withMerchant(prisma, { name: 'QA 1697b', email: `qa-1697b-${stamp}@test.local` }, async (m) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1697b', email: `qa-1697b-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1697b' } });
        const varios = await prisma.job.create({ data: { merchantId: m.id, customerId: cliente.id, titulo: 'Tres visitas' } });
        await prisma.jobAssignee.create({ data: { jobId: varios.id, teamMemberId: operario.id } });
        const uno = await prisma.job.create({ data: { merchantId: m.id, customerId: cliente.id, titulo: 'Una visita' } });
        const parte = (data) => prisma.parteTrabajo.create({ data: { merchantId: m.id, customerId: cliente.id, lineas: [], ...data } });

        const p10 = await parte({ jobId: varios.id, fecha: d2, numero: `PT-1697-10-${stamp}`, estado: 'borrador' });
        const p50 = await parte({ jobId: varios.id, fecha: d1, numero: `PT-1697-50-${stamp}`, estado: 'firmado' });
        const p9 = await parte({ jobId: varios.id, fecha: d2, numero: `PT-1697-9-${stamp}`, estado: 'firmado' });
        const solo = await parte({ jobId: uno.id, fecha: d1, numero: `PT-1697-1-${stamp}` });
        const suelto = await parte({ jobId: null, fecha: d1, numero: `PT-1697-S-${stamp}` });

        // TENANCY: la columna `jobId` es suelta (sin relación). Un parte de OTRO merchant con el mismo
        // número de trabajo NO puede sumar en la cuenta de éste.
        await withMerchant(prisma, { name: 'QA 1697b ajeno', email: `qa-1697b-ajeno-${stamp}@test.local` }, async (ajeno) => {
          await prisma.parteTrabajo.create({ data: { merchantId: ajeno.id, jobId: varios.id, fecha: d1, numero: `PT-1697-A-${stamp}`, lineas: [] } });

          const sesion = async (teamMemberId) => {
            const token = 'qa1697b-' + crypto.randomBytes(12).toString('hex');
            await prisma.authSession.create({
              data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
            });
            const v = await pedir(`${base}/auth/verify?token=${token}`);
            const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
            assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo cookie de sesión');
            return cookie;
          };
          const jefe = await sesion(null);
          const tecnico = await sesion(operario.id);

          const fallos = [];
          const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
          const leer = async (cookie, p, caso) => {
            const r = await pedir(`${base}/admin/partes/${p.id}`, { headers: { cookie } });
            assert.equal(r.status, 200, `control: ${caso} abre el parte ${p.id} (${r.status} ${r.text.slice(0, 120)})`);
            return JSON.parse(r.text);
          };
          const mide = (j, n, mm, caso) => blando(() => assert.deepEqual(
            { visitaN: j.visitaN, visitaM: j.visitaM }, { visitaN: n, visitaM: mm }, `🔴 ${caso}`));

          // ① El jefe: tres partes en el trabajo, ordenados por fecha y después por número; el borrador cuenta.
          mide(await leer(jefe, p50, 'el jefe'), 1, 3, '① el más viejo es la visita 1 de 3 (el parte ajeno NO suma)');
          mide(await leer(jefe, p9, 'el jefe'), 2, 3, '① a igual fecha, el 9 va antes que el 10');
          mide(await leer(jefe, p10, 'el jefe'), 3, 3, '① el borrador también cuenta: visita 3 de 3');
          // ② Un solo parte en el trabajo: 1 de 1 (la pantalla decide no pintarlo).
          mide(await leer(jefe, solo, 'el jefe'), 1, 1, '② uno solo en el trabajo: visita 1 de 1');
          // ③ Parte suelto: no es visita de ningún trabajo.
          mide(await leer(jefe, suelto, 'el jefe'), null, null, '③ el parte suelto no tiene visita');
          // ④ El técnico asignado recibe lo mismo, sin leer la ficha del trabajo.
          mide(await leer(tecnico, p9, 'el técnico asignado'), 2, 3, '④ el técnico asignado recibe su visita 2 de 3');

          assert.deepEqual(fallos, [], `🔴 ${fallos.length} fallo(s):\n  ${fallos.join('\n  ')}`);
        });
      });
    } finally {
      server.closeAllConnections?.();
      server.close();
      try { await prisma.$disconnect(); } catch { /* nada que cerrar */ }
    }
  });
