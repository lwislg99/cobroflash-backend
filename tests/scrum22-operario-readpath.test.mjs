// SCRUM-22 (carril B, read-path): serializeJob expone la autoría del operario resuelta
// (operario:{id,name}) + operarioId crudo, en la LISTA y el DETALLE del Trabajo. Resuelve
// el TeamMember (Parte S1) por operarioId SCOPEADO al merchant (regla 2). null = propietario.
// La UI (jobDetailView) la consume aparte (carril de Javier); aquí solo el read-path backend.
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros; levanta la app in-process):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import { URL_BANCO } from './_banco-libro.mjs'; // SCRUM-1599h: segundo destino (LIBRO_PG_URL), inerte con el gate de staging
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import http from 'node:http';

// `node:http` sin agente y no `fetch` (SCRUM-1218d): `fetch` contra un servidor propio puede
// abortar el proceso al salir (SCRUM-560). Devuelve lo que este fichero lee de la respuesta de `fetch`
// (status, headers.get, text, json) y, como el `redirect: 'manual'` de antes, no sigue redirecciones.
const pedirSinAgente = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const cabeceras = { ...headers };
  if (body !== undefined) cabeceras['content-length'] = Buffer.byteLength(body);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: cabeceras, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => ok({
      status: r.statusCode,
      headers: { get: (n) => { const v = r.headers[n.toLowerCase()]; return v === undefined ? null : [].concat(v).join(', '); } },
      text: async () => d,
      json: async () => JSON.parse(d),
    }));
  });
  req.on('error', mal);
  req.end(body);
});

const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-22: serializer expone operario:{id,name} en lista+detalle (null propietario) + tenancy', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: los merchants y TODO su montaje viven dentro de withMerchant. Antes se
  // creaban aquí, fuera del try: si reventaba el alta del operario, del cliente o de un
  // job, el finally ni se planteaba y quedaban huérfanos en staging.
  try {
    await withMerchant(prisma, { name: 'QA S22 A', email: `qa-s22-A-${stamp}@test.local` }, (merchantA) =>
      withMerchant(prisma, { name: 'QA S22 B', email: `qa-s22-B-${stamp}@test.local` }, async (merchantB) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: merchantA.id, name: 'María García', email: `qa-s22-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const customerA = await prisma.customer.create({
          data: { merchantId: merchantA.id, name: 'Cliente S22', phone: `34600${stamp % 1000000}` },
        });
        // Job CON operario (autoría) y Job SIN operario (propietario → null).
        const jobWith = await prisma.job.create({
          data: { merchantId: merchantA.id, customerId: customerA.id, status: 'pendiente_agendar', titulo: 'Con operario', operarioId: operario.id },
        });
        const jobOwner = await prisma.job.create({
          data: { merchantId: merchantA.id, customerId: customerA.id, status: 'pendiente_agendar', titulo: 'Sin operario', operarioId: null },
        });

        const mkCookie = async (merchantId) => {
          const token = 'qa22-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const res = await pedirSinAgente(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
          const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
          assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
          return cookie;
        };
        const getJson = (url, cookie) => pedirSinAgente(`${base}${url}`, { headers: { cookie } });

        const cookieA = await mkCookie(merchantA.id);
        const cookieB = await mkCookie(merchantB.id);

        // ── LISTA: operario resuelto en el job con autoría; null en el del propietario ──
        const list = await (await getJson('/admin/jobs', cookieA)).json();
        const rowWith = list.find((j) => j.id === jobWith.id);
        const rowOwner = list.find((j) => j.id === jobOwner.id);
        assert.ok(rowWith && rowOwner, 'la lista debe traer ambos jobs de A');
        assert.deepEqual(rowWith.operario, { id: operario.id, name: 'María García' }, 'operario resuelto {id,name}');
        assert.equal(rowWith.operarioId, operario.id, 'operarioId crudo expuesto (paridad con assignedUserId)');
        assert.equal(rowOwner.operario, null, 'sin operarioId → operario null (propietario)');
        assert.equal(rowOwner.operarioId, null);

        // ── DETALLE: hereda operario de serializeJob ──
        const detail = await (await getJson(`/admin/jobs/${jobWith.id}`, cookieA)).json();
        assert.deepEqual(detail.operario, { id: operario.id, name: 'María García' }, 'el detalle hereda operario');

        // ── TENANCY (regla 2): B no ve el job de A (404) ni su lista lo incluye ──
        const bDetail = await getJson(`/admin/jobs/${jobWith.id}`, cookieB);
        assert.equal(bDetail.status, 404, 'B no accede al job de A');
        const bList = await (await getJson('/admin/jobs', cookieB)).json();
        assert.ok(!bList.some((j) => j.id === jobWith.id), 'la lista de B no incluye el job de A');

        console.log('✔ SCRUM-22: operario:{id,name} en lista y detalle, null para propietario, tenancy OK.');
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});

// SCRUM-1599h (diseño B de SCRUM-1599) · la mutación que tumba el caso de base, CATALOGADA en SCRUM-1599i.
// Va aparte de `MUTACIONES_QUE_ME_TUMBAN` a propósito: el job del meta-guard corre SIN base, el caso sale
// SALTADO en su pasada limpia y eso es CIEGO (PUERTA 1a), no un veredicto. La ejecuta, con el banco PGlite,
// `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs` (forma de SCRUM-1390e). Cada campo, LITERAL.
export const MUTACIONES_CON_BASE = [
  { fichero: "src/modules/jobs/app/routes/jobs.routes.ts", de: "const operario = job.operarioId", a: "const operario = null && job.operarioId", cae: "SCRUM-22: serializer expone operario:{id,name}" },
];
