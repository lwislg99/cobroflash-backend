// tests/scrum1662-que-hay-que-hacer.test.mjs — SCRUM-1662 (PILOTO-1)
//
// 🔴 EL DEFECTO: la descripción del alta de un trabajo («Qué hay que hacer») se guardaba en
// `Job.notes`, que la ficha pinta como «Notas internas · Solo tú las ves». La tarea acababa en las
// notas privadas del jefe, y el operario no sabía qué tenía que hacer.
//
// FIRMADO «columna nueva» (SCRUM-1662 c.21548): campo propio `Job.queHayQueHacer`
// (`que_hay_que_hacer`, TEXT nullable), que el operario SÍ ve; las notas internas siguen privadas.
//
// Se mide:
//   ① SIN BD · la fila que escribe el alta lleva la descripción en `queHayQueHacer` y NO en `notes`.
//   ② CON BANCO · por comportamiento, con sesiones de verdad:
//      · el dueño crea el trabajo con `descripcion` → la fila tiene la tarea en su campo y `notes` null;
//        el POST y el GET la devuelven;
//      · el PATCH la edita, vacía → null, y no toca `notes` (control: `notes` se edita aparte y sigue);
//      · el operario asignado la LEE en su GET y la puede EDITAR (no es campo de dinero: SCRUM-120/164).
//   ③ CON BANCO · firma c.21555: las notas internas son SOLO del jefe — el operario no las recibe en
//      la lista, el detalle ni la respuesta del PATCH, no las edita (403 `notes`, nada aplicado) y su
//      `.ics` lleva «Qué hay que hacer» en vez de ellas. Control en cada puerta: el jefe SÍ las tiene.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { datosDeTrabajoDirecto, filaDeTrabajoDirecto } from '../dist/modules/jobs/domain/trabajoDirecto.js';

test('SCRUM-1662 · ① la descripción del alta va a queHayQueHacer y las notas internas nacen vacías', () => {
  const r = datosDeTrabajoDirecto({ customerId: 7, descripcion: '  Cambiar el diferencial del cuadro  ' });
  assert.ok(r.ok);
  const fila = filaDeTrabajoDirecto(9, r.datos, null);
  assert.equal(fila.queHayQueHacer, 'Cambiar el diferencial del cuadro',
    '🔴 la tarea del alta no llega a su campo propio');
  assert.equal(fila.notes ?? null, null,
    '🔴 la tarea del alta sigue cayendo en `notes` («Notas internas · Solo tú las ves»)');
  // Control: sin descripción, el campo es null (un solo «no consta»), no cadena vacía.
  const vacio = filaDeTrabajoDirecto(9, datosDeTrabajoDirecto({ customerId: 7, descripcion: '   ' }).datos, null);
  assert.equal(vacio.queHayQueHacer, null);
});

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

test('SCRUM-1662 · ② POST guarda «Qué hay que hacer», GET la devuelve (también al operario) y PATCH la edita',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1662', email: `qa-1662-${stamp}@test.local` }, async (m) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1662', email: `qa-1662-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1662' } });

        const sesion = async (teamMemberId) => {
          const token = 'qa1662-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const v = await pedir(`${base}/auth/verify?token=${token}`);
          const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
          assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo la cookie de sesión');
          return cookie;
        };
        const conCookie = (cookie) => ({
          get: (ruta) => pedir(`${base}${ruta}`, { headers: { cookie } }),
          escribir: (metodo, ruta, cuerpo) => pedir(`${base}${ruta}`, {
            method: metodo, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
          }),
        });
        const dueno = conCookie(await sesion(null));
        const op = conCookie(await sesion(operario.id));
        const fila = (id) => prisma.job.findFirst({ where: { id, merchantId: m.id }, select: { queHayQueHacer: true, notes: true } });

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };

        // ── El alta: la tarea va a su campo y las notas internas nacen vacías.
        const tarea = 'Cambiar el diferencial del cuadro';
        const alta = await dueno.escribir('POST', '/admin/jobs', { customerId: cliente.id, descripcion: tarea });
        assert.equal(alta.status, 201, `control: el alta responde 201 (${alta.status}: ${alta.text.slice(0, 200)})`);
        const creado = JSON.parse(alta.text);
        blando(() => assert.equal(creado.queHayQueHacer, tarea, '🔴 la respuesta del POST no trae queHayQueHacer'));
        let f = await fila(creado.id);
        blando(() => assert.equal(f.queHayQueHacer, tarea, '🔴 la fila no guarda la tarea en que_hay_que_hacer'));
        blando(() => assert.equal(f.notes, null, '🔴 la tarea sigue cayendo en `notes` (Notas internas · Solo tú las ves)'));

        // ── El GET del detalle la devuelve.
        const det = await dueno.get(`/admin/jobs/${creado.id}`);
        assert.equal(det.status, 200, `control: el detalle responde (${det.status})`);
        blando(() => assert.equal(JSON.parse(det.text).queHayQueHacer, tarea, '🔴 GET /admin/jobs/:id no devuelve queHayQueHacer'));

        // ── El PATCH la edita y no toca las notas internas.
        await prisma.job.update({ where: { id: creado.id }, data: { notes: 'nota privada del jefe' } });
        const p1 = await dueno.escribir('PATCH', `/admin/jobs/${creado.id}`, { queHayQueHacer: '  Revisar también la toma de tierra  ' });
        blando(() => assert.equal(p1.status, 200, `🔴 PATCH queHayQueHacer → ${p1.status}`));
        f = await fila(creado.id);
        blando(() => assert.equal(f.queHayQueHacer, 'Revisar también la toma de tierra', '🔴 el PATCH no edita queHayQueHacer (o no recorta)'));
        blando(() => assert.equal(f.notes, 'nota privada del jefe', '🔴 editar la tarea tocó las notas internas'));
        const p2 = await dueno.escribir('PATCH', `/admin/jobs/${creado.id}`, { queHayQueHacer: '   ' });
        blando(() => assert.equal(p2.status, 200));
        f = await fila(creado.id);
        blando(() => assert.equal(f.queHayQueHacer, null, '🔴 vaciar la tarea deja cadena vacía y no null'));

        // ── El operario asignado: la LEE y la puede EDITAR.
        const suyo = await prisma.job.create({
          data: { merchantId: m.id, customerId: cliente.id, assignedUserId: operario.id, queHayQueHacer: 'Sustituir el enchufe del baño' },
        });
        const detOp = await op.get(`/admin/jobs/${suyo.id}`);
        assert.equal(detOp.status, 200, `control: el operario abre su trabajo (${detOp.status})`);
        blando(() => assert.equal(JSON.parse(detOp.text).queHayQueHacer, 'Sustituir el enchufe del baño',
          '🔴 el operario no ve «Qué hay que hacer» en su trabajo'));
        const pOp = await op.escribir('PATCH', `/admin/jobs/${suyo.id}`, { queHayQueHacer: 'Sustituir el enchufe y el interruptor' });
        blando(() => assert.equal(pOp.status, 200, `🔴 el operario no puede editar la tarea de su trabajo (${pOp.status})`));
        const fOp = await fila(suyo.id);
        blando(() => assert.equal(fOp.queHayQueHacer, 'Sustituir el enchufe y el interruptor'));

        assert.deepEqual(fallos, [], `\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });

// ── ③ LAS NOTAS INTERNAS SON SOLO DEL JEFE ─────────────────────────────────────────────────────
// FIRMADO por el fundador (SCRUM-1662 c.21555, literal): «Ocultarlas al operario — Las notas pasan a
// ser SOLO del jefe, como promete el rótulo: el operario deja de verlas y de poder editarlas, y
// tampoco van en el archivo de calendario. La tarea del operario vive en "Qué hay que hacer". Sin
// textos nuevos.» Supera la regla de SCRUM-120 (23-jul: «Técnico ✅: status, scheduledAt, notes»).
//
// Por comportamiento, las TRES puertas por las que `notes` le llegaba al operario —lista, detalle
// (y respuesta del PATCH), `.ics`— más la escritura. CONTROL en cada una: el jefe SÍ la ve, así que
// un `null` para el operario no puede ser «el campo no viaja para nadie».
test('SCRUM-1662 · ③ (c.21555) el operario no ve ni edita las notas internas, y el .ics le lleva la tarea',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1662n', email: `qa-1662n-${stamp}@test.local` }, async (m) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1662n', email: `qa-1662n-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1662n' } });
        const sesion = async (teamMemberId) => {
          const token = 'qa1662n-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const v = await pedir(`${base}/auth/verify?token=${token}`);
          const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
          assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo la cookie de sesión');
          return cookie;
        };
        const conCookie = (cookie) => ({
          get: (ruta) => pedir(`${base}${ruta}`, { headers: { cookie } }),
          escribir: (metodo, ruta, cuerpo) => pedir(`${base}${ruta}`, {
            method: metodo, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
          }),
        });
        const jefe = conCookie(await sesion(null));
        const op = conCookie(await sesion(operario.id));

        const NOTA = 'NOTA-PRIVADA-DEL-JEFE-1662';
        const TAREA = 'Cambiar el grifo de la cocina';
        const suyo = await prisma.job.create({
          data: {
            merchantId: m.id, customerId: cliente.id, assignedUserId: operario.id, status: 'agendado',
            scheduledAt: new Date('2026-11-20T09:00:00Z'), notes: NOTA, queHayQueHacer: TAREA,
          },
        });

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };

        // ── Detalle.
        const detJefe = await jefe.get(`/admin/jobs/${suyo.id}`);
        assert.equal(detJefe.status, 200, `control: el jefe abre el trabajo (${detJefe.status})`);
        assert.equal(JSON.parse(detJefe.text).notes, NOTA, 'control: el jefe SÍ ve sus notas internas');
        const detOp = await op.get(`/admin/jobs/${suyo.id}`);
        assert.equal(detOp.status, 200, `control: el operario abre su trabajo (${detOp.status})`);
        blando(() => assert.equal(JSON.parse(detOp.text).notes, null, '🔴 el DETALLE le da al operario las notas internas'));
        blando(() => assert.ok(!detOp.text.includes(NOTA), '🔴 la nota interna viaja en alguna parte del detalle del operario'));
        blando(() => assert.equal(JSON.parse(detOp.text).queHayQueHacer, TAREA, '🔴 el operario se quedó sin «Qué hay que hacer»'));

        // ── Lista.
        const lisJefe = JSON.parse((await jefe.get('/admin/jobs')).text);
        assert.equal(lisJefe.find((j) => j.id === suyo.id)?.notes, NOTA, 'control: la lista del jefe trae sus notas');
        const lisOp = await op.get('/admin/jobs');
        const filaOp = JSON.parse(lisOp.text).find((j) => j.id === suyo.id);
        assert.ok(filaOp, 'control: el trabajo está en la lista del operario');
        blando(() => assert.equal(filaOp.notes, null, '🔴 la LISTA le da al operario las notas internas'));
        blando(() => assert.ok(!lisOp.text.includes(NOTA), '🔴 la nota interna viaja en la lista del operario'));

        // ── Escritura: 403 con el campo, y la fila intacta (fail-closed, nada se aplica).
        const pNotas = await op.escribir('PATCH', `/admin/jobs/${suyo.id}`, { notes: 'lo-escribe-el-operario' });
        blando(() => assert.equal(pNotas.status, 403, `🔴 el operario puede EDITAR las notas internas (${pNotas.status})`));
        blando(() => assert.equal(JSON.parse(pNotas.text).field, 'notes', '🔴 el 403 no nombra el campo `notes`'));
        const pMezcla = await op.escribir('PATCH', `/admin/jobs/${suyo.id}`, { notes: 'mezcla', queHayQueHacer: 'mezcla' });
        blando(() => assert.equal(pMezcla.status, 403, '🔴 `notes` mezclado con un campo legítimo no se rechaza entero'));
        const tras = await prisma.job.findFirst({ where: { id: suyo.id, merchantId: m.id }, select: { notes: true, queHayQueHacer: true } });
        blando(() => assert.equal(tras.notes, NOTA, '🔴 la escritura del operario cambió las notas internas'));
        blando(() => assert.equal(tras.queHayQueHacer, TAREA, '🔴 un PATCH rechazado aplicó la parte inocente'));
        // La respuesta del PATCH legítimo del operario tampoco las devuelve.
        const pOk = await op.escribir('PATCH', `/admin/jobs/${suyo.id}`, { queHayQueHacer: TAREA });
        assert.equal(pOk.status, 200, `control: el operario sigue editando la tarea (${pOk.status})`);
        blando(() => assert.ok(!pOk.text.includes(NOTA), '🔴 la respuesta del PATCH le devuelve al operario las notas internas'));
        // Control: el jefe SÍ las edita.
        const pJefe = await jefe.escribir('PATCH', `/admin/jobs/${suyo.id}`, { notes: NOTA });
        blando(() => assert.equal(pJefe.status, 200, `🔴 el jefe ya no puede editar sus notas (${pJefe.status})`));

        // ── Calendario.
        const icsJefe = await jefe.get(`/admin/jobs/${suyo.id}/ics`);
        assert.equal(icsJefe.status, 200, `control: el .ics del jefe responde (${icsJefe.status})`);
        assert.ok(icsJefe.text.includes(NOTA), 'control: el .ics del jefe lleva sus notas');
        const icsOp = await op.get(`/admin/jobs/${suyo.id}/ics`);
        assert.equal(icsOp.status, 200, `control: el .ics del operario responde (${icsOp.status})`);
        blando(() => assert.ok(!icsOp.text.includes(NOTA), '🔴 el .ics del operario lleva las notas internas'));
        blando(() => assert.match(icsOp.text, /DESCRIPTION:Cambiar el grifo de la cocina/, '🔴 el .ics del operario no lleva «Qué hay que hacer»'));

        assert.deepEqual(fallos, [], `\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });
