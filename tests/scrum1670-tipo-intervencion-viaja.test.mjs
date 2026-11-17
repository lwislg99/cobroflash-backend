// SCRUM-1670 · EL TIPO DE INTERVENCIÓN QUE SE ELIGE AL CREAR, TAMBIÉN SE DEVUELVE.
//
// Medido dos veces antes de este ticket (J4 en código, S4 en navegador): `POST /admin/jobs` contestaba
// 201 SIN la clave `tipoIntervencion`, y la ficha del trabajo #84 —creado como «Reparación / Asistencia
// técnica»— no podía enseñarlo porque no le llegaba.
//
// 🔴 NO SE PERDÍA: SE CALLABA. `filaDeTrabajoDirecto` lo escribe en `jobs.tipo_intervencion` desde
// SCRUM-651, y en producción el parte abierto desde el trabajo #81 heredó «mantenimiento» leyéndolo de
// esa fila (docs/master/SCRUM-1674.md, banco `evidencias/SCRUM-1674/prod/verificar.mjs`). Lo que
// faltaba era UNA clave en `serializeJob`, el serializador que comparten POST, la lista y el detalle.
//
// Este test mide las dos mitades, porque la segunda sin la primera es justo el fallo mudo que
// SCRUM-651 dejó escrito: la fila (lo GUARDA) y las tres respuestas (lo DEVUELVE).
// Control: sin tipo → la fila y las respuestas dicen `null`, no un valor por defecto.
//
// Necesita banco porque lo que mide es la fila que crea `POST /admin/jobs` de verdad.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// `node:http` sin agente y no `fetch` (SCRUM-1218d): `fetch` contra un servidor propio puede abortar
// el proceso al salir (SCRUM-560).
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

test('SCRUM-1670 · 🔴 crear con tipo X → la fila guarda X y POST, la lista y la ficha devuelven X; sin tipo → null',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    // El vocabulario NO se re-lista aquí: se lee de su única fuente (SCRUM-651). Se toma uno que no
    // sea el primero, para que un «siempre el primero» por defecto no pase en verde.
    const { TIPOS_INTERVENCION } = await import('../dist/modules/jobs/domain/tipoIntervencion.js');
    assert.ok(Array.isArray(TIPOS_INTERVENCION) && TIPOS_INTERVENCION.length >= 2, 'control: el vocabulario cerrado tiene al menos dos valores');
    const X = TIPOS_INTERVENCION[TIPOS_INTERVENCION.length - 1];

    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1670', email: `qa-1670-${stamp}@test.local` }, async (m) => {
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1670' } });

        const token = 'qa1670-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: m.id, teamMemberId: null, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const v = await pedir(`${base}/auth/verify?token=${token}`);
        const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo cookie de sesión');

        const crear = async (cuerpo) => {
          const r = await pedir(`${base}/admin/jobs`, {
            method: 'POST', headers: { cookie, 'content-type': 'application/json' },
            body: JSON.stringify({ customerId: cliente.id, ...cuerpo }),
          });
          assert.equal(r.status, 201, `control: el propietario abre el trabajo (${r.status} ${r.text})`);
          const json = JSON.parse(r.text);
          const fila = await prisma.job.findUnique({ where: { id: json.id } });
          return { json, fila };
        };
        const ficha = async (id) => {
          const r = await pedir(`${base}/admin/jobs/${id}`, { headers: { cookie } });
          assert.equal(r.status, 200, `control: el propietario abre la ficha (${r.status})`);
          return JSON.parse(r.text);
        };

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };

        // ① Con tipo X.
        const a = await crear({ titulo: '[QA-1670] con tipo', tipoIntervencion: X });
        blando(() => assert.equal(a.fila.tipoIntervencion, X, `🔴 ① la fila debe GUARDAR «${X}»`));
        blando(() => assert.equal(a.json.tipoIntervencion, X, `🔴 ① la respuesta del POST debe DEVOLVER «${X}»`));
        const fa = await ficha(a.json.id);
        blando(() => assert.equal(fa.tipoIntervencion, X, `🔴 ① la ficha (GET /admin/jobs/:id) debe devolver «${X}»`));

        // ② Sin tipo (control): no hay valor por defecto; «no consta» es null en la fila y en las respuestas.
        const b = await crear({ titulo: '[QA-1670] sin tipo' });
        assert.equal(b.fila.tipoIntervencion, null, 'control ②: sin tipo, la fila sigue en null');
        blando(() => assert.equal(b.json.tipoIntervencion, null, '🔴 ② sin tipo, el POST devuelve null (no un valor por defecto)'));
        const fb = await ficha(b.json.id);
        blando(() => assert.equal(fb.tipoIntervencion, null, '🔴 ② sin tipo, la ficha devuelve null'));

        // ③ La lista (GET /admin/jobs) — la tarjeta de Trabajos lee de aquí.
        const l = await pedir(`${base}/admin/jobs`, { headers: { cookie } });
        assert.equal(l.status, 200, 'control: el propietario lee su lista');
        const lista = JSON.parse(l.text);
        const enLista = (id) => lista.find((j) => j.id === id);
        assert.ok(enLista(a.json.id) && enLista(b.json.id), 'control: los dos trabajos salen en la lista');
        blando(() => assert.equal(enLista(a.json.id).tipoIntervencion, X, `🔴 ③ la lista debe devolver «${X}»`));
        blando(() => assert.equal(enLista(b.json.id).tipoIntervencion, null, '🔴 ③ la lista, sin tipo, devuelve null'));

        // ④ Un valor de fuera del vocabulario se sigue rechazando por su nombre (SCRUM-651, intacto).
        const malo = await pedir(`${base}/admin/jobs`, {
          method: 'POST', headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ customerId: cliente.id, tipoIntervencion: 'NO_EXISTE' }),
        });
        assert.equal(malo.status, 400, 'control ④: un tipo fuera del vocabulario no entra');

        assert.deepEqual(fallos, [], `🔴 ${fallos.length} fallo(s):\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.closeAllConnections?.();
      server.close();
      try { await prisma.$disconnect(); } catch { /* nada que cerrar */ }
    }
  });

// La proyección por rol NO cambia: el tipo no es dinero ni nota interna, así que el operario lo ve
// (es lo que hereda su parte, SCRUM-1674); y lo que el rol oculta sigue oculto. Sin banco.
test('SCRUM-1670 · la proyección por rol deja pasar el tipo y sigue ocultando lo de siempre', async () => {
  const { trabajoParaElRol } = await import('../dist/modules/jobs/domain/trabajoParaElRol.js');
  const trabajo = {
    id: 1, tipoIntervencion: 'MANTENIMIENTO', notes: 'nota del jefe', totalCobrado: 50, estadoCobro: 'parcial',
    remaining: { amount: 10, currency: 'EUR' }, nextStage: null, pendingStagesCount: 1, hasCustomPlan: false, invoices: [{ id: 9 }],
  };
  const tecnico = trabajoParaElRol(trabajo, 'tecnico');
  assert.equal(tecnico.tipoIntervencion, 'MANTENIMIENTO', 'el operario ve el tipo del trabajo');
  assert.equal(tecnico.notes, null, 'control: las notas internas siguen ocultas al operario');
  assert.equal(tecnico.totalCobrado, null, 'control: el dinero sigue oculto al operario');
  assert.equal(trabajoParaElRol(trabajo, 'admin').tipoIntervencion, 'MANTENIMIENTO', 'el jefe ve el tipo');
});
