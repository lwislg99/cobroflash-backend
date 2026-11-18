// docs/evidencias/scrum1747/sonda-firma-token-operario.mjs — SCRUM-1747 · SONDA, no test
//
// SOLO CONFIRMA, no arregla (encargo del orquestador, 17-nov-2026). Dos preguntas, por comportamiento:
//   A. ¿`GET /admin/albaranes/:id` le da el `firmaToken` a una sesión de OPERARIO (rol `tecnico`)?
//   B. ¿la página pública `/albaran/<ese token>` enseña los PRECIOS de un albarán VALORADO?
// Controles: el admin recibe el mismo token (la sonda sabe leerlo); con `ocultarPreciosEnDocumento`
// la página NO enseña el precio (la sonda distingue «sale» de «no sale»); el concepto sale siempre.
//
// Uso (banco DESECHABLE, loopback y base «*_test»; la sonda lo exige antes de tocar nada):
//   LIBRO_PG_URL=<url del banco> node docs/evidencias/scrum1747/sonda-firma-token-operario.mjs
// Corre contra `dist/` de la raíz del repo (`npm run build` antes).
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { parseBDSegura } = await imp('scripts/_db-guard.mjs');
const { withMerchant } = await imp('tests/_merchant-fixture.mjs');

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const p = URL_BANCO && parseBDSegura(URL_BANCO);
if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
  console.error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  process.exit(2);
}
process.env.DATABASE_URL = URL_BANCO;
process.env.DISABLE_CRONS = 'true';

const pedir = (url, { headers = {} } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers, agent: false }, (r) => {
    const t = []; r.on('data', (c) => t.push(c)); r.on('end', () => ok({ status: r.statusCode, body: Buffer.concat(t).toString('utf8'), headers: r.headers }));
  });
  req.on('error', mal); req.end();
});

const { prisma } = await imp('dist/core/db/prisma.js');
const { app } = await imp('dist/app.js');
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const stamp = Date.now();
const out = {};
let codigo = 0;
try {
  await withMerchant(prisma, { name: 'QA 1747', email: `qa-1747-${stamp}@test.local` }, async (m) => {
    const operario = await prisma.teamMember.create({
      data: { merchantId: m.id, name: 'Operario 1747', email: `qa-1747-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
    });
    const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1747' } });
    const sesion = async (teamMemberId) => {
      const token = 'qa1747-' + crypto.randomBytes(12).toString('hex');
      await prisma.authSession.create({ data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
      const v = await pedir(`${base}/auth/verify?token=${token}`);
      const cookie = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
      if (!cookie.startsWith('pf_session=')) throw new Error('control: no se obtuvo la cookie de sesión');
      return cookie;
    };
    const cJefe = await sesion(null);
    const cOp = await sesion(operario.id);

    const PRECIO_PAPEL = '987,65';
    const CONCEPTO = 'Grifo monomando 1747';
    const job = await prisma.job.create({ data: { merchantId: m.id, customerId: cliente.id, assignedUserId: operario.id, status: 'en_curso' } });
    const mkAlb = (ocultar) => prisma.albaran.create({
      data: {
        merchantId: m.id, jobId: job.id, numero: `ALB-QA-1747-${ocultar ? 'O' : 'V'}-${stamp}`, modoValoracion: 'VALORADO',
        estado: 'emitido', firmaToken: crypto.randomBytes(24).toString('hex'), enviadoParaFirmaAt: new Date(),
        ocultarPreciosEnDocumento: ocultar,
        lineas: [{ concepto: CONCEPTO, cantidad: 1, unidad: 'ud', precioUnitario: 987.65, tipoIva: 21 }],
      },
    });
    const alb = await mkAlb(false);
    const albOculto = await mkAlb(true);

    // A · la ficha, por sesión
    const fichaOp = await pedir(`${base}/admin/albaranes/${alb.id}`, { headers: { cookie: cOp } });
    const fichaJefe = await pedir(`${base}/admin/albaranes/${alb.id}`, { headers: { cookie: cJefe } });
    const jOp = fichaOp.status === 200 ? JSON.parse(fichaOp.body) : null;
    const jJefe = fichaJefe.status === 200 ? JSON.parse(fichaJefe.body) : null;
    out.A = {
      operario_status: fichaOp.status,
      operario_tiene_firmaToken: !!jOp && 'firmaToken' in jOp,
      operario_firmaToken_es_el_del_albaran: !!jOp && jOp.firmaToken === alb.firmaToken,
      operario_ve_precioUnitario_en_la_ficha: !!jOp && JSON.stringify(jOp.lineas ?? []).includes('987.65'),
      control_admin_status: fichaJefe.status,
      control_admin_firmaToken_es_el_del_albaran: !!jJefe && jJefe.firmaToken === alb.firmaToken,
    };

    // B · la página pública con ESE token (la que el operario recibió)
    const tok = jOp?.firmaToken || alb.firmaToken;
    const pub = await pedir(`${base}/albaran/${tok}`);
    const pubOculto = await pedir(`${base}/albaran/${albOculto.firmaToken}`);
    out.B = {
      publica_status: pub.status,
      control_concepto_sale: pub.body.includes(CONCEPTO),
      publica_ensena_precio: pub.body.includes(PRECIO_PAPEL),
      control_oculto_status: pubOculto.status,
      control_oculto_concepto_sale: pubOculto.body.includes(CONCEPTO),
      control_oculto_ensena_precio: pubOculto.body.includes(PRECIO_PAPEL),
    };
    const controles = out.A.control_admin_status === 200 && out.A.control_admin_firmaToken_es_el_del_albaran
      && out.B.control_concepto_sale && out.B.control_oculto_concepto_sale && !out.B.control_oculto_ensena_precio;
    out.controles_ok = controles;
    if (!controles) codigo = 3;
  });
} catch (e) {
  out.error = String(e?.stack || e);
  codigo = 1;
} finally {
  server.close();
  await prisma.$disconnect();
}
console.log(JSON.stringify(out, null, 2));
console.log(`sonda1747 · ${new Date().toISOString()} (reloj LOCAL) · EXIT=${codigo}`);
process.exit(codigo);
