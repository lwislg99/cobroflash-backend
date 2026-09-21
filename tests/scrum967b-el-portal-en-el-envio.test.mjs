// SCRUM-967b · EL CLIENTE RECIBE EL ENLACE DE SU PORTAL, y solo por donde no se filtra.
//
// El portal (`/cliente/:token`) estaba construido entero y no salía en NINGÚN envío: solo se
// llegaba copiando el enlace de la ficha del cliente. Esta fase lo pone en dos sitios, con la
// microcopy firmada por el orquestador (docs/microcopy/2026-09-21-SCRUM-967-enlace-del-portal.md):
//
//   ① el CORREO del presupuesto — va al correo del propio cliente;
//   ② la respuesta de UN SOLO USO de `POST /albaran/:token/firmar`, después de sellar.
//
// Y los NEGATIVOS son la mitad del ticket, porque el portal abre TODOS los documentos del cliente:
//   ③ un segundo POST sobre un parte ya firmado NO devuelve el enlace (condición del orquestador:
//      si lo devolviera, cualquiera con el enlace del parte tendría el portal para siempre);
//   ④ ninguna página PERSISTENTE lo lleva: ni la del parte (antes y después de firmar) ni la del
//      presupuesto (enviado y ya aceptado). Un GET contesta siempre a quien tenga el enlace, y un
//      presupuesto se reenvía (el socio, el administrador de la finca).
//
// ⚠️ GATEADO, dos destinos (patrón SCRUM-876):
//   QA_DB_TEST=1 npm run test:staging                     → staging, por `_staging-db.mjs`
//   LIBRO_PG_URL=<banco loopback, base *_test> npm test   → el banco desechable que CI levanta
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

// ANTES de importar dist (la configuración se congela al cargar): el auto-envío de la copia
// firmada va en seco, y el correo NO sale por Resend sino al `.eml` del outbox, que es lo que
// este test lee. Sin borrar la clave, el correo se mandaría de verdad y no habría nada que leer.
process.env.WHATSAPP_DRY_RUN = '1';
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_URL;

const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** SCRUM-560: `node:http` sin pool (`agent: false`), nunca `fetch` sobre el propio `app.listen(0)`
 *  — el patrón que revienta libuv al cerrar (ver `tests/scrum100-webhooks-fail-closed.test.mjs`). */
function pedir(port, method, ruta, json) {
  return new Promise((resolve, reject) => {
    const cuerpo = json === undefined ? null : JSON.stringify(json);
    const req = http.request(
      { host: '127.0.0.1', port, path: ruta, method, agent: false,
        headers: cuerpo ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo) } : {} },
      (res) => {
        let d = '';
        res.setEncoding('utf8');
        res.on('data', (t) => { d += t; });
        res.on('end', () => resolve({ status: res.statusCode, texto: d, json: () => JSON.parse(d) }));
      },
    );
    req.on('error', reject);
    req.end(cuerpo ?? undefined);
  });
}

/** El `.eml` guarda el HTML en quoted-printable: sin decodificar, `=` y los saltos blandos
 *  partirían la URL y la búsqueda saldría vacía aunque el enlace estuviera. */
function decodificarQP(eml) {
  const sinSaltos = eml.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < sinSaltos.length; i++) {
    const m = sinSaltos[i] === '=' && /^[0-9A-F]{2}$/.test(sinSaltos.slice(i + 1, i + 3));
    if (m) { bytes.push(parseInt(sinSaltos.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(...Buffer.from(sinSaltos[i], 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}

test('SCRUM-967b · el portal viaja en el correo del presupuesto y en la firma del parte, y en nada persistente', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { BASE_URL } = await import('../dist/core/config/env.js');
  const { outboxDir } = await import('../dist/core/storage/dirs.js');
  const { sendQuoteEmail } = await import('../dist/modules/messaging/domain/email.service.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const stamp = Date.now();

  try {
    await withMerchant(prisma, { name: 'QA 967b Reformas', email: `qa-967b-${stamp}@test.local` }, async (merchant) => {
      // ── ① EL CORREO DEL PRESUPUESTO ─────────────────────────────────────────────────────────
      // Cliente SIN token, como los de antes de que el alta lo generase: el correo lo crea.
      const clienteCorreo = await prisma.customer.create({
        data: { merchantId: merchant.id, name: 'Marta 967b', email: `marta-967b-${stamp}@test.local` },
      });
      const presupuesto = await prisma.quote.create({
        data: { merchantId: merchant.id, customerId: clienteCorreo.id, total: '250.00', currency: 'EUR', lines: [], status: 'sent' },
      });
      const envio = await sendQuoteEmail({ quoteId: presupuesto.id, prisma });
      assert.ok(envio.eml, `el correo debía ir al outbox (sin Resend) y devolvió ${JSON.stringify(envio)}`);
      const correo = decodificarQP(fs.readFileSync(path.join(outboxDir, path.basename(envio.eml)), 'utf8'));
      // SUELO: el lector ve los enlaces del correo — el de firmar ya estaba antes de este ticket.
      assert.match(correo, /\/pay\/quote\/[A-Za-z0-9_-]{16,}/, 'SUELO: el correo decodificado no enseña ni el enlace de firmar — el lector está ciego');
      const tokCorreo = (await prisma.customer.findUnique({ where: { id: clienteCorreo.id }, select: { portalToken: true } })).portalToken;
      assert.ok(tokCorreo, '① el envío del correo debía dejarle al cliente su token de portal');
      assert.ok(correo.includes(`${BASE_URL}/cliente/${tokCorreo}`),
        '① 🔴 el correo del presupuesto NO lleva el enlace del portal del cliente');
      assert.ok(correo.includes('Todos tus presupuestos y pagos con'), '① falta la frase firmada (L1)');
      assert.ok(correo.includes('>tu portal de cliente</a>'), '① «tu portal de cliente» tiene que ser el enlace (L1)');

      // ── ② / ③ LA FIRMA DEL PARTE ────────────────────────────────────────────────────────────
      const tokParte = crypto.randomBytes(16).toString('hex');
      const clienteParte = await prisma.customer.create({
        data: { merchantId: merchant.id, name: 'Jorge 967b', portalToken: tokParte },
      });
      const job = await prisma.job.create({
        data: { merchantId: merchant.id, customerId: clienteParte.id, status: 'terminado', titulo: 'C/ Mayor 9' },
      });
      const firmaToken = crypto.randomBytes(16).toString('hex');
      const albaran = await prisma.albaran.create({
        data: {
          merchantId: merchant.id, jobId: job.id, numero: `ALB-967b-${stamp}`, estado: 'emitido', firmaToken,
          lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }],
        },
      });

      // ④ antes de firmar: la página se pinta (suelo) y NO lleva el token.
      const antes = (await pedir(port, 'GET', `/albaran/${firmaToken}`)).texto;
      assert.ok(antes.includes(albaran.numero), 'SUELO: la página del parte no se ha pintado');
      assert.ok(!antes.includes(tokParte), '④ 🔴 la página del parte SIN firmar enseña el token del portal');
      assert.ok(antes.includes('Abrir mi portal de cliente'), '② falta el botón firmado (L3) en la pantalla de gracias');

      const firmar = () => pedir(port, 'POST', `/albaran/${firmaToken}/firmar`,
        { signatureData: SIG, version: albaran.version, firmadoPorNombre: 'Jorge 967b' });
      const r1 = await firmar();
      const b1 = r1.json();
      assert.equal(r1.status, 200, `la firma debía entrar y dio ${r1.status} ${JSON.stringify(b1)}`);
      assert.equal(b1.portalUrl, `${BASE_URL}/cliente/${tokParte}`,
        '② 🔴 la respuesta de la firma NO trae el enlace del portal de ESE cliente');

      const r2 = await firmar();
      const b2 = r2.json();
      // SUELO del negativo: el segundo POST llegó a la rama idempotente, no a un error cualquiera.
      assert.equal(b2.already, true, `SUELO: el segundo POST no pasó por «ya firmado» (${JSON.stringify(b2)})`);
      assert.ok(!('portalUrl' in b2), '③ 🔴 un segundo POST sobre un parte YA firmado devuelve el portal');
      assert.ok(!JSON.stringify(b2).includes(tokParte), '③ 🔴 el token del portal sale en la respuesta repetida');

      const despues = (await pedir(port, 'GET', `/albaran/${firmaToken}`)).texto;
      assert.ok(despues.includes('ya está firmado'), 'SUELO: la página del parte firmado no se ha pintado');
      assert.ok(!despues.includes(tokParte), '④ 🔴 la página del parte FIRMADO enseña el token del portal');

      // ── ④ LA PÁGINA DEL PRESUPUESTO, en los dos estados que un tercero puede abrir ──────────
      const tokPres = crypto.randomBytes(16).toString('hex');
      const clientePres = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Lucía 967b', portalToken: tokPres } });
      for (const status of ['sent', 'accepted']) {
        const decisionToken = crypto.randomBytes(16).toString('hex');
        const q = await prisma.quote.create({
          data: {
            merchantId: merchant.id, customerId: clientePres.id, total: '90.00', currency: 'EUR', lines: [], status, decisionToken,
            ...(status === 'accepted' ? { acceptedAt: new Date() } : {}),
          },
        });
        const r = await pedir(port, 'GET', `/pay/quote/${decisionToken}`);
        const html = r.texto;
        assert.equal(r.status, 200, `SUELO: la página del presupuesto ${status} no respondió 200 (${r.status})`);
        assert.ok(html.includes(status === 'accepted' ? 'Ya aceptaste' : 'Firmar y aceptar'), `SUELO: la página del presupuesto ${status} no es la esperada`);
        assert.ok(!html.includes(tokPres), `④ 🔴 la página del presupuesto ${status} enseña el token del portal`);
        assert.ok(!html.includes('/cliente/'), `④ 🔴 la página del presupuesto ${status} enlaza a un portal`);
        void q;
      }
    });
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});
