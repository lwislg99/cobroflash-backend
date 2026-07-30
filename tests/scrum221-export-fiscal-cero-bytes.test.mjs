// SCRUM-221 (A9) · SI LA FILA NO SE PUEDE ESCRIBIR, NO SALE NI UN BYTE DEL PACK.
//
// Este es EL test del ticket, y es de COMPORTAMIENTO, no de forma. El guard AST hermano
// (`scrum221-export-fiscal-auditado.test.mjs`) comprueba que la llamada existe y que precede a
// los bytes leyendo el árbol; eso protege contra el refactor descuidado. Pero «precede en el
// código» no es «bloquea de verdad»: entre las dos cosas están el `catch`, el `headersSent` y
// el streaming del ZIP, que solo se comprueban ejecutando.
//
// Así que aquí se hace lo único que lo demuestra: **se rompe la escritura del registro y se
// mira si salen bytes.** En las DOS rutas por separado, porque son dos mecanismos distintos —
// una responde con `res.send`, la otra abre un pipe de streaming.
//
// CÓMO SE ROMPE, y por qué así: se sustituye `recordAuditOrThrow` en el módulo YA CARGADO. El
// `dist` es CommonJS y las rutas llaman `audit_service_1.recordAuditOrThrow(...)`, o sea que la
// propiedad se resuelve EN CADA LLAMADA — envenenarla afecta a la ruta real, sin tocar
// producción ni añadir un hook «para poder testear». Es el mismo criterio que SCRUM-207 usó con
// su `Proxy` sobre `tx.auditLog` (regla 38: el test no deforma el código que prueba).
//
// ⚠️ GATEADO (crea/BORRA un merchant efímero y levanta la app in-process):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { crearFactura } from './_factura-fixture.mjs';

const require = createRequire(import.meta.url);
const ENABLED = process.env.QA_DB_TEST === '1';

/** ¿Es esto un ZIP de verdad? Los ZIP empiezan por la firma local `PK\x03\x04`. */
const pareceZip = (buf) => buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
/** ¿Lleva esto registros RRSIF dentro? */
const pareceRegistroFiscal = (txt) => /RegistroAlta|RegFactuSistemaFacturacion/.test(txt);

test('SCRUM-221 · el registro BLOQUEA: sin fila no salen bytes (XML y ZIP por separado)',
  { skip: !ENABLED }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const auditMod = require('../dist/modules/system/audit.service.js');

    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    const original = auditMod.recordAuditOrThrow;

    try {
      await withMerchant(prisma, {
        name: 'QA S221 export fiscal', taxId: `B${String(stamp).slice(-8)}`,
        email: `qa-s221-${stamp}@test.local`,
      }, async (merchant) => {
        // El pack fiscal solo se entrega a un merchant ES con NIF y con el flag encendido
        // (SCRUM-73). Override POR MERCHANT, sin tocar el env global.
        await prisma.merchant.update({
          where: { id: merchant.id },
          data: { country: 'ES', flags: { INVOICING_ES_ENABLED: true } },
        });

        const customer = await prisma.customer.create({
          data: { merchantId: merchant.id, name: 'Cliente QA S221', phone: `34604${stamp % 1000000}` },
        });
        const year = new Date().getFullYear();
        await crearFactura(prisma, {
          merchantId: merchant.id, customerId: customer.id,
          number: `${year}-QA221-${stamp % 1000}`,
          total: '121.00', currency: 'EUR', type: 'F1', status: 'paid',
          lines: [{ concept: 'Servicio QA S221', qty: 1, price: 100, tax: 0.21 }],
          vfHash: 'HASH_QA_S221', vfPrevHash: '',
          pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
          vfEstado: 'sellado', // fiscal (ES + NIF + flag, con huella)
        });

        const token = 'qa221-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: merchant.id, teamMemberId: null, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const rVerify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
        const cookie = (rVerify.headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

        const getXml = () => fetch(`${base}/admin/exports/verifactu.xml?year=${year}`, { headers: { cookie } });
        const getZip = () => fetch(`${base}/admin/exports/datos.zip`, { headers: { cookie } });
        const filasA9 = () => prisma.auditLog.count({
          where: { merchantId: merchant.id, action: 'exportacion_fiscal' },
        });

        // ── CONTROL · sin envenenar, las dos rutas entregan Y dejan su fila ──────────────
        // Sin esto, los asserts de abajo podrían pasar porque la ruta está rota por otro
        // motivo (gate, permisos, fixture). Un rojo que no distingue «bloqueó» de «nunca
        // funcionó» no prueba nada.
        const okXml = await getXml();
        assert.equal(okXml.status, 200, 'control: el XML debe entregarse con todo en orden');
        assert.ok(pareceRegistroFiscal(await okXml.text()), 'control: el XML debe traer registros');
        assert.equal(await filasA9(), 1, 'control: el XML debe dejar UNA fila exportacion_fiscal');

        const okZip = await getZip();
        assert.equal(okZip.status, 200, 'control: el ZIP debe entregarse');
        assert.ok(pareceZip(Buffer.from(await okZip.arrayBuffer())), 'control: debe ser un ZIP real');
        assert.equal(await filasA9(), 2, 'control: el ZIP con XML dentro deja su propia fila');

        // ── SE ROMPE LA ESCRITURA DEL REGISTRO ──────────────────────────────────────────
        auditMod.recordAuditOrThrow = async () => { throw new Error('audit_indisponible_QA'); };
        const filasAntes = await filasA9();

        // ── RUTA 1 · XML suelto ─────────────────────────────────────────────────────────
        const rXml = await getXml();
        const cuerpoXml = await rXml.text();
        assert.equal(rXml.status, 500,
          '🔴 el XML respondió 200 con la auditoría caída: el registro NO está bloqueando');
        assert.ok(!pareceRegistroFiscal(cuerpoXml),
          '🔴 HAN SALIDO REGISTROS FISCALES SIN FILA. Es exactamente lo que el ticket impide:\n' +
          '   un pack de inspección que se descargó y del que no consta ni quién ni cuándo.');
        assert.ok(!/attachment/i.test(rXml.headers.get('content-disposition') || ''),
          '🔴 se envió cabecera de descarga: los headers salieron antes que el registro');

        // ── RUTA 2 · ZIP (mecanismo distinto: streaming) ────────────────────────────────
        const rZip = await getZip();
        const bufZip = Buffer.from(await rZip.arrayBuffer());
        assert.equal(rZip.status, 500,
          '🔴 el ZIP respondió 200 con la auditoría caída: el registro NO está bloqueando');
        assert.ok(!pareceZip(bufZip),
          '🔴 SALIÓ UN ZIP SIN FILA. Con streaming esto significa que `archive.pipe(res)` se\n' +
          '   abrió antes del registro: una vez abierto el pipe, «bloquear» ya no existe.');

        assert.equal(await filasA9(), filasAntes,
          'con la escritura rota no puede haber aparecido ninguna fila nueva');

        // ── SE RESTAURA · y vuelve a entregar ───────────────────────────────────────────
        // Cierra la pinza: demuestra que los 500 de arriba los causó la auditoría caída y no
        // un efecto lateral del test (sesión caducada, merchant borrado, servidor tocado).
        auditMod.recordAuditOrThrow = original;
        const otraVez = await getXml();
        assert.equal(otraVez.status, 200, 'restaurada la auditoría, el XML debe volver a salir');
        assert.equal(await filasA9(), filasAntes + 1, 'y debe volver a dejar su fila');
      });
    } finally {
      auditMod.recordAuditOrThrow = original;
      await new Promise((r) => server.close(r));
    }
  });
