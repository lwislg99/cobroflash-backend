// tests/scrum1744-pdf-del-albaran-sin-precios-operario.test.mjs — SCRUM-1744 (P1 · PILOTO-1)
//
// 🔴 EL DEFECTO (S4, recorrido H6, 16-nov-2026, yaqu.app): la PANTALLA del operario ya no enseña los
// precios del albarán (SCRUM-1707), pero el detalle le ofrece «Descargar PDF», y
// `GET /admin/albaranes/:id/pdf` —en TECNICO_ALLOWED— servía el papel entero: PRECIO UD., IMPORTE,
// Base y Total. El manejador no miraba el rol.
//
// FIRMADO por el fundador (SCRUM-1707 c.21547, Q2, literal): «No: se recortan — el servidor recorta
// los precios del albarán para el rol operario, igual que ya hace con el parte.» El PDF lo había
// dejado FUERA el orquestador como ejecución (c.21556 ②); SCRUM-1744 lo reabre y deja elegir el
// arreglo sin textos nuevos.
//
// ARREGLO ELEGIDO: el operario recibe el MISMO papel que imprime el interruptor que ya existe
// (`ocultarPreciosEnDocumento`, SCRUM-607), en un fichero APARTE. Ni un rótulo nuevo, el botón del
// front sigue sirviendo, y el albarán NO se toca (el interruptor sigue diciendo lo que diga).
//
// Se mide:
//   ① SIN BD · la decisión, por CAPACIDAD (`seesOnlyOwnJobs`): técnico → sin precios; admin → con
//      ellos; un rol desconocido o ausente cae del lado restringido (SCRUM-147).
//   ② CON BANCO · por comportamiento, el PDF que baja cada sesión. CONTROL: el admin sí lleva el
//      precio (un «no aparece» no puede ser «no lo sé leer»). Y en los DOS órdenes: el papel recortado
//      no envenena el del admin ni el del admin se le sirve al operario por la caché de disco.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';
import { pdfDelAlbaranSinPrecios } from '../dist/modules/jobs/domain/albaranParaElRol.js';

test('SCRUM-1744 · ① quién recibe el PDF del albarán sin precios, por capacidad', () => {
  assert.equal(pdfDelAlbaranSinPrecios('tecnico'), true, '🔴 el operario recibe el PDF con precios');
  assert.equal(pdfDelAlbaranSinPrecios('admin'), false, '🔴 el admin pierde los precios de su PDF');
  assert.equal(pdfDelAlbaranSinPrecios('comercial'), true, '🔴 un rol desconocido ve los precios (fail-open)');
  assert.equal(pdfDelAlbaranSinPrecios(undefined), true, '🔴 un rol ausente ve los precios (fail-open)');
});

// `node:http` sin agente y no `fetch` (SCRUM-1218d / SCRUM-560). El cuerpo, en BYTES: es un PDF.
const pedir = (url, { method = 'GET', headers = {} } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers, agent: false }, (r) => {
    const trozos = [];
    r.on('data', (t) => trozos.push(t));
    r.on('end', () => ok({ status: r.statusCode, buf: Buffer.concat(trozos), headers: r.headers }));
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

test('SCRUM-1744 · ② el PDF del albarán VALORADO le llega al operario sin precios, y al admin entero',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1744', email: `qa-1744-${stamp}@test.local` }, async (m) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1744', email: `qa-1744-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1744' } });
        const sesion = async (teamMemberId) => {
          const token = 'qa1744-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const v = await pedir(`${base}/auth/verify?token=${token}`);
          const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
          assert.ok(cookie.startsWith('pf_session='), 'control: no se obtuvo la cookie de sesión');
          return cookie;
        };
        const cJefe = await sesion(null);
        const cOp = await sesion(operario.id);

        // Un precio que no sale por casualidad: si «987,65» aparece en el papel, cruzó.
        const PRECIO = 987.65;
        const PRECIO_PAPEL = '987,65';
        const CONCEPTO = 'Grifo monomando';
        const suyo = await prisma.job.create({
          data: { merchantId: m.id, customerId: cliente.id, assignedUserId: operario.id, status: 'en_curso' },
        });
        const alb = await prisma.albaran.create({
          data: {
            merchantId: m.id, jobId: suyo.id, numero: `ALB-QA-1744-${stamp}`, modoValoracion: 'VALORADO',
            lineas: [{ concepto: CONCEPTO, cantidad: 1, unidad: 'ud', precioUnitario: PRECIO, tipoIva: 21 }],
          },
        });

        const papel = async (cookie, quien) => {
          const r = await pedir(`${base}/admin/albaranes/${alb.id}/pdf`, { headers: { cookie } });
          assert.equal(r.status, 200, `control: ${quien} baja el PDF (${r.status}: ${r.buf.toString('utf8').slice(0, 160)})`);
          assert.match(String(r.headers['content-type']), /application\/pdf/, `control: a ${quien} le llega un PDF`);
          const t = extraerTextoPdf(r.buf);
          assert.ok(t.ok, `control: el PDF de ${quien} se deja leer (${t.motivo})`);
          // Anclaje que NO depende del dato medido: es el albarán, y sus líneas están.
          assert.ok(vecesEnPdf(t.texto, CONCEPTO) >= 1, `control: el PDF de ${quien} imprime la línea del albarán`);
          return t.texto;
        };

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };

        // Orden A · el operario PRIMERO (caché fría), luego el admin.
        const op1 = await papel(cOp, 'el operario');
        blando(() => assert.equal(vecesEnPdf(op1, PRECIO_PAPEL), 0, '🔴 el PDF del operario lleva el PRECIO UD. del albarán'));
        const jefe1 = await papel(cJefe, 'el admin');
        blando(() => assert.ok(vecesEnPdf(jefe1, PRECIO_PAPEL) >= 1, '🔴 el admin perdió el precio de su PDF (el papel del operario envenenó la caché)'));
        // Orden B · el admin ya dejó su papel en disco; el operario NO se lo puede llevar.
        const op2 = await papel(cOp, 'el operario (con el papel del admin en disco)');
        blando(() => assert.equal(vecesEnPdf(op2, PRECIO_PAPEL), 0, '🔴 al operario se le sirve el PDF del admin desde la caché'));
        const jefe2 = await papel(cJefe, 'el admin (otra vez)');
        blando(() => assert.ok(vecesEnPdf(jefe2, PRECIO_PAPEL) >= 1, '🔴 el admin perdió el precio en la segunda bajada'));

        // El albarán NO se toca: el interruptor del papel del cliente sigue diciendo lo mismo.
        const despues = await prisma.albaran.findUnique({ where: { id: alb.id }, select: { ocultarPreciosEnDocumento: true } });
        blando(() => assert.equal(despues.ocultarPreciosEnDocumento, false, '🔴 bajar el PDF del operario cambió el interruptor del albarán'));

        assert.deepEqual(fallos, [], `\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });
