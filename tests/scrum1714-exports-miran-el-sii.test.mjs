// SCRUM-1714 — las dos lecturas del flag en `exports.routes.ts` también miran el SII.
//
// SCRUM-1585 (M) hizo que el modo de emisión mire el SII en cada emisión: quien lleva los libros
// por el SII («Sí») o no lo ha contestado («No consta», NULL) NO emite, aunque tenga
// `INVOICING_ES_ENABLED` encendido (RRSIF art. 3.3). Pero las dos rutas de exportación fiscal leían
// el flag a pelo, sin pasar por el modo:
//   · GET /admin/exports/verifactu.xml  → `if (!isFlagEnabled('INVOICING_ES_ENABLED', …))`
//   · GET /admin/exports/datos.zip      → `const xmlPermitido = isFlagEnabled('INVOICING_ES_ENABLED', …)`
// Con el flag puesto y el SII en «Sí» o «No consta», esas dos rutas servían el registro RRSIF de
// facturas como si el merchant emitiera.
//
// Aceptación (SCRUM-1714): un merchant con el SII en «Sí» o «No consta» recibe en esas rutas LO
// MISMO que un merchant en `receipt` (flag apagado). Se mide así, por la ruta real (app in-process,
// sesión de verdad por /auth/verify), comparando contra el propio merchant con el flag apagado:
//   · verifactu.xml → mismo status y mismo cuerpo que en receipt (404 neutro), y ni rastro del registro.
//   · datos.zip     → mismas entradas que en receipt (sin XML) y el LEEME avisa de la ausencia.
// Y el CONTROL POSITIVO, sin el cual los rojos de arriba no prueban nada: con el SII en «No» y el
// flag puesto, las dos rutas SÍ sirven el XML. Si este caso saliera sin XML, el test estaría
// mirando una puerta cerrada por otra razón.
//
// ⚠️ GATEADO (crea/BORRA un merchant efímero; levanta la app in-process):
//   QA_DB_TEST=1 npm run test:staging:gated   ·   o LIBRO_PG_URL (banco desechable; CI lo levanta)
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import { URL_BANCO } from './_banco-libro.mjs'; // SCRUM-876e: segundo destino (LIBRO_PG_URL), inerte con el gate de staging
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import zlib from 'node:zlib';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// `node:http` sin agente y no `fetch` (SCRUM-1218): `fetch` contra un servidor propio puede abortar
// el proceso al salir (SCRUM-560). El cuerpo se guarda en bytes (el ZIP es binario).
const pedirSinAgente = (url, { headers = {} } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers, agent: false }, (r) => {
    const trozos = [];
    r.on('data', (t) => { trozos.push(t); });
    r.on('end', () => ok({
      status: r.statusCode,
      cabecera: (n) => { const v = r.headers[n.toLowerCase()]; return v === undefined ? null : [].concat(v).join(', '); },
      bytes: Buffer.concat(trozos),
    }));
  });
  req.on('error', mal);
  req.end();
});

// Nombres de las entradas de un ZIP (cabeceras locales), como scrum25/scrum82.
function entradasZip(buf) {
  const nombres = [];
  for (let i = 0; i + 30 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const lenNombre = buf.readUInt16LE(i + 26);
    const lenExtra = buf.readUInt16LE(i + 28);
    if (lenNombre === 0 || i + 30 + lenNombre > buf.length) continue;
    nombres.push(buf.toString('utf8', i + 30, i + 30 + lenNombre));
    i += 29 + lenNombre + lenExtra;
  }
  return nombres.sort();
}

const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-1714: verifactu.xml y datos.zip — SII en «Sí» o «No consta» recibe lo mismo que receipt', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  try {
    await withMerchant(prisma, {
      name: 'QA 1714 Exports SII', taxId: `B${String(stamp).slice(-8)}`,
      email: `qa-1714-${stamp}@test.local`,
    }, async (merchant) => {
      const customer = await prisma.customer.create({
        // SCRUM-248: con NIF, para que la factura sea declarable (sin él SCRUM-215 la excluye).
        data: { merchantId: merchant.id, name: 'Cliente QA 1714', taxId: 'A11111111', phone: `34604${stamp % 1000000}` },
      });
      // Una F1 SELLADA (SCRUM-205): si una puerta se abre de más, esto es lo que se filtra.
      const invoice = await prisma.invoice.create({
        data: {
          merchantId: merchant.id, customerId: customer.id, number: `${new Date().getFullYear()}-QA1714-${stamp % 1000}`,
          total: '121.00', currency: 'EUR', type: 'F1', status: 'paid',
          lines: [{ concept: 'Servicio QA 1714', qty: 1, price: 100, tax: 0.21 }],
          vfHash: 'HASH_QA_1714', vfPrevHash: '', vfEstado: 'sellado',
          pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
        },
      });

      const token = 'qa1714-' + crypto.randomBytes(12).toString('hex');
      await prisma.authSession.create({
        data: { merchantId: merchant.id, teamMemberId: null, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
      });
      const rVerify = await pedirSinAgente(`${base}/auth/verify?token=${token}`);
      const cookie = (rVerify.cabecera('set-cookie') || '').split(';')[0];
      assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

      const ponerEstado = (data) => prisma.merchant.update({ where: { id: merchant.id }, data });
      const pedirXml = () => pedirSinAgente(`${base}/admin/exports/verifactu.xml`, { headers: { cookie } });
      const pedirZip = () => pedirSinAgente(`${base}/admin/exports/datos.zip`, { headers: { cookie } });
      const leemeDe = (buf) => {
        // El LEEME va deflatado; basta con saber si el paquete dice que FALTA el XML. Se lee del
        // directorio central como en scrum82 (contenidoEntradasZip), sólo esa entrada.
        for (let i = 0; i + 46 <= buf.length; i++) {
          if (buf.readUInt32LE(i) !== 0x02014b50) continue;
          const metodo = buf.readUInt16LE(i + 10);
          const compSize = buf.readUInt32LE(i + 20);
          const nameLen = buf.readUInt16LE(i + 28);
          const lho = buf.readUInt32LE(i + 42);
          const nombre = buf.toString('utf8', i + 46, i + 46 + nameLen);
          if (nombre !== 'LEEME.txt') continue;
          const ini = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
          const datos = buf.subarray(ini, ini + compSize);
          return metodo === 0 ? datos.toString('utf8') : zlibInflar(datos);
        }
        return null;
      };

      // ── LA REFERENCIA: el mismo merchant en `receipt` (flag apagado, el SII da igual) ─────────
      await ponerEstado({ flags: {}, llevaLibrosPorSii: true });
      const xmlReceipt = await pedirXml();
      const zipReceipt = await pedirZip();
      assert.equal(xmlReceipt.status, 404, `referencia receipt: verifactu.xml debería ser 404 y fue ${xmlReceipt.status}`);
      assert.equal(zipReceipt.status, 200, `referencia receipt: datos.zip debería ser 200 y fue ${zipReceipt.status}`);
      const entradasReceipt = entradasZip(zipReceipt.bytes);
      assert.ok(!entradasReceipt.some((n) => n.endsWith('.xml')), `referencia receipt: sin XML (vino: ${entradasReceipt.join(', ')})`);
      assert.ok((leemeDe(zipReceipt.bytes) || '').includes('no incluye el XML'), 'referencia receipt: el LEEME avisa de la ausencia');

      // ── LOS DOS ESTADOS DEL SII QUE NO EMITEN, con el flag PUESTO ──────────────────────────────
      for (const [rotulo, sii] of [['«Sí»', true], ['«No consta»', null]]) {
        await ponerEstado({ flags: { INVOICING_ES_ENABLED: true }, llevaLibrosPorSii: sii });

        const rXml = await pedirXml();
        assert.equal(rXml.status, xmlReceipt.status, `SII ${rotulo}: verifactu.xml debería contestar como receipt (${xmlReceipt.status}) y contestó ${rXml.status}`);
        assert.equal(rXml.bytes.toString('utf8'), xmlReceipt.bytes.toString('utf8'), `SII ${rotulo}: verifactu.xml debería devolver el MISMO cuerpo que receipt`);
        assert.doesNotMatch(rXml.bytes.toString('utf8'), new RegExp(invoice.number), `SII ${rotulo}: la factura no debe filtrarse por verifactu.xml`);

        const rZip = await pedirZip();
        assert.equal(rZip.status, zipReceipt.status, `SII ${rotulo}: datos.zip debería contestar como receipt`);
        const entradas = entradasZip(rZip.bytes);
        assert.deepEqual(entradas, entradasReceipt, `SII ${rotulo}: datos.zip debería llevar las MISMAS entradas que receipt (vino: ${entradas.join(', ')})`);
        assert.ok((leemeDe(rZip.bytes) || '').includes('no incluye el XML'), `SII ${rotulo}: el LEEME de datos.zip debería avisar de que no va el XML`);
      }

      // ── CONTROL POSITIVO: SII en «No» y flag puesto → las dos rutas SÍ sirven el registro ────────
      await ponerEstado({ flags: { INVOICING_ES_ENABLED: true }, llevaLibrosPorSii: false });
      const xmlFiscal = await pedirXml();
      assert.equal(xmlFiscal.status, 200, `control: con el SII en «No», verifactu.xml debería ser 200 y fue ${xmlFiscal.status}`);
      assert.match(xmlFiscal.bytes.toString('utf8'), new RegExp(invoice.number), 'control: con el SII en «No», la factura SÍ va en el registro');
      const zipFiscal = await pedirZip();
      assert.ok(entradasZip(zipFiscal.bytes).some((n) => n.endsWith('.xml')), 'control: con el SII en «No», datos.zip SÍ lleva el XML');

      t.diagnostic('SCRUM-1714: SII «Sí» y «No consta» = receipt en las dos rutas ✓ · control «No» sirve el XML ✓');
    });
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});

function zlibInflar(datos) {
  try { return zlib.inflateRawSync(datos).toString('utf8'); } catch { return ''; }
}

// SCRUM-1599m (diseño B) · las mutaciones que tumban este caso de base, LITERALES. Cada una quita UNA
// de las dos lecturas del SII y tiene que tumbar este test; la del flag (scrum73/82) no es de aquí.
export const MUTACIONES_CON_BASE = [
  { fichero: "src/modules/exports/app/routes/exports.routes.ts", de: "      && motivoSiiSinEmision(merchant) === null && merchant.country === 'ES' && !!merchant.taxId;", a: "      && merchant.country === 'ES' && !!merchant.taxId;", cae: "SCRUM-1714: verifactu.xml y datos.zip" },
  { fichero: "src/modules/exports/app/routes/exports.routes.ts", de: "    if (motivoSiiSinEmision(merchant) !== null) {", a: "    if (false) {", cae: "SCRUM-1714: verifactu.xml y datos.zip" },
];
