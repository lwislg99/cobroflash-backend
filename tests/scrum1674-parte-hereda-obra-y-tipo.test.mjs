// SCRUM-1674 · EL PARTE NACE CON LA OBRA Y EL TIPO DEL TRABAJO, Y CON NADA MÁS.
//
// Al abrir un parte desde un Trabajo, el técnico tecleaba de pie la dirección de la obra y marcaba el
// tipo de intervención, dos datos que el jefe ya había escrito en el Trabajo. Decisión del
// orquestador (encargo del 11-nov-2026, bajo la delegación): se COPIAN al CREAR, igual que los
// técnicos asignados (SCRUM-818) y que el albarán hereda `Job.direccion` como `obra`
// (`albaran.service.ts`, `jobDireccion`).
//
// 🔴 LOS DOS VETOS DE DOC-12 (docs/master/SCRUM-602.md, «El suelo, adoptado literal») siguen en pie y
// este test los vigila en los dos sentidos:
//   1. la dirección de FACTURACIÓN del cliente JAMÁS llega al parte, ni aunque el trabajo no tenga obra;
//   2. lo vacío se queda VACÍO: sin dirección de obra en el trabajo, el parte nace sin obra.
//
// Necesita banco porque lo que mide es la fila que crea `POST /admin/partes` de verdad.
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

const FACTURACION = 'Calle de la Facturación 99';
const SITIO = 'Nave del polígono 7';
const OBRA = 'Calle de la Obra 12, 3ºB';

test('SCRUM-1674 · 🔴 el parte copia la obra y el tipo del TRABAJO; vacío se queda vacío y la facturación JAMÁS entra',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1674', email: `qa-1674-${stamp}@test.local` }, async (m) => {
        // El cliente tiene dirección de FACTURACIÓN y un sitio guardado: ninguna de las dos es la obra.
        const cliente = await prisma.customer.create({
          data: { merchantId: m.id, name: 'Cliente 1674', billingAddress: FACTURACION, billingCity: 'Valencia' },
        });
        await prisma.customerSite.create({ data: { merchantId: m.id, customerId: cliente.id, name: 'Nave', address: SITIO } });
        const job = (extra) => prisma.job.create({
          data: { merchantId: m.id, customerId: cliente.id, status: 'en_curso', titulo: 'Trabajo 1674', ...extra },
        });
        const conTodo = await job({ direccion: OBRA, tipoIntervencion: 'MANTENIMIENTO' });
        const sinNada = await job({});
        const enBlanco = await job({ direccion: '   ', tipoIntervencion: 'INSTALACION' });
        const conTipo = await job({ direccion: OBRA, tipoIntervencion: 'REPARACION_ASISTENCIA' });

        const token = 'qa1674-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: m.id, teamMemberId: null, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const v = await pedir(`${base}/auth/verify?token=${token}`);
        const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo cookie de sesión');

        const abrir = async (cuerpo) => {
          const r = await pedir(`${base}/admin/partes`, {
            method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
          });
          assert.equal(r.status, 201, `control: el propietario abre el parte (${r.status} ${r.text})`);
          const json = JSON.parse(r.text);
          const fila = await prisma.parteTrabajo.findUnique({ where: { id: json.id } });
          return { json, fila, crudo: r.text + JSON.stringify(fila) };
        };

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
        const nuncaFacturacion = (caso, p) => blando(() => assert.ok(
          !p.crudo.includes(FACTURACION) && !p.crudo.includes(SITIO),
          `🔴 ${caso}: la dirección de facturación o el sitio guardado entraron en el parte (DOC-12)`));

        // ① Trabajo CON obra y tipo → el parte los trae.
        const a = await abrir({ jobId: conTodo.id });
        blando(() => assert.equal(a.fila.obra, OBRA, '🔴 ① con obra en el trabajo: el parte debe nacer con ESA obra'));
        blando(() => assert.equal(a.json.obra, OBRA, '🔴 ① la respuesta debe traer la obra copiada'));
        blando(() => assert.equal(a.fila.tipo, 'mantenimiento', '🔴 ① el tipo del trabajo (MANTENIMIENTO) debe llegar como «mantenimiento»'));
        nuncaFacturacion('①', a);

        // ② Trabajo SIN obra ni tipo → el parte nace vacío. Ni la facturación ni el sitio rellenan el hueco.
        const b = await abrir({ jobId: sinNada.id });
        blando(() => assert.equal(b.fila.obra, null, '🔴 ② sin obra en el trabajo, el parte nace SIN obra'));
        blando(() => assert.equal(b.fila.tipo, null, '🔴 ② sin tipo en el trabajo, el parte nace sin tipo'));
        nuncaFacturacion('②', b);

        // ③ Obra en BLANCO → vacío (un espacio no es una dirección). El tipo sí viaja.
        const c = await abrir({ jobId: enBlanco.id });
        blando(() => assert.equal(c.fila.obra, null, '🔴 ③ una obra de solo espacios es vacía: el parte nace sin obra'));
        blando(() => assert.equal(c.fila.tipo, 'instalacion', '🔴 ③ INSTALACION debe llegar como «instalacion»'));
        nuncaFacturacion('③', c);

        // ④ Un tipo ELEGIDO al abrir manda sobre el del trabajo: es la decisión de quien lo abre.
        const d = await abrir({ jobId: conTipo.id, tipo: 'mantenimiento' });
        blando(() => assert.equal(d.fila.tipo, 'mantenimiento', '🔴 ④ el tipo elegido al abrir no se pisa con el del trabajo'));
        blando(() => assert.equal(d.fila.obra, OBRA, '🔴 ④ y la obra se copia igual'));
        const d2 = await abrir({ jobId: conTipo.id });
        blando(() => assert.equal(d2.fila.tipo, 'reparacion_asistencia', '🔴 ④ REPARACION_ASISTENCIA debe llegar como «reparacion_asistencia»'));

        // ⑤ Parte SUELTO (sin trabajo) → nada que heredar.
        const e = await abrir({});
        assert.equal(e.fila.jobId, null, 'control: el parte suelto no cuelga de ningún trabajo');
        blando(() => assert.equal(e.fila.obra, null, '🔴 ⑤ el parte suelto nace sin obra'));
        nuncaFacturacion('⑤', e);

        // ⑥ Se copia UNA vez: cambiar luego la obra del trabajo no reescribe el parte ya abierto.
        await prisma.job.update({ where: { id: conTodo.id }, data: { direccion: 'Otra dirección' } });
        const releido = await pedir(`${base}/admin/partes/${a.fila.id}`, { headers: { cookie } });
        assert.equal(releido.status, 200, 'control: el propietario relee su parte');
        blando(() => assert.equal(JSON.parse(releido.text).obra, OBRA, '🔴 ⑥ el parte guarda su copia: no sigue al trabajo'));

        assert.deepEqual(fallos, [], `🔴 ${fallos.length} fallo(s):\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.closeAllConnections?.();
      server.close();
      await prisma_desconectar();
    }
  });

async function prisma_desconectar() {
  try {
    const { prisma } = await import('../dist/core/db/prisma.js');
    await prisma.$disconnect();
  } catch { /* nada que cerrar */ }
}
