// SCRUM-82 — GET /admin/exports/datos.zip incluye el XML VeriFactu cuando
// INVOICING_ES_ENABLED está ON, reutilizando el MISMO constructor RRSIF que
// GET /admin/exports/verifactu.xml (SCRUM-73) — sin duplicar el generador fiscal.
//
// Lo que este test fija, además de "hay un XML":
//   1. Flag OFF (default): el ZIP se genera igual, SIN XML, y el LEEME avisa de la ausencia
//      (comportamiento ya existente de SCRUM-25/73, no debe romperse).
//   2. Flag ON: un archivo POR AÑO NATURAL que toque el rango pedido — no por el rango en
//      sí (el registro RRSIF es por ejercicio; la cadena de huellas es anual). Se fuerza el
//      caso de DOS años para blindar justo esa decisión (SCRUM-82, fundador).
//   3. IDÉNTICO (salvo `fechaGeneracion`): el XML de cada año dentro del ZIP es el mismo
//      texto que devuelve GET /verifactu.xml?year=N suelto — misma fuente, cero divergencia
//      posible en los REGISTROS. `fechaGeneracion` es "cuándo se generó ESTA respuesta", no
//      un dato de la factura, así que dos llamadas HTTP distintas siempre lo llevan
//      distinto — se normaliza antes de comparar (confirmado en la primera corrida: sin
//      normalizar, esa era la ÚNICA diferencia, y habría hecho el assert imposible de pasar
//      por construcción, no por un bug real).
//   4. El LEEME describe el contenido REAL (nombra cada archivo), no un booleano genérico.
//
// El camino "falla la generación → aborta el ZIP entero" (fail-closed, decisión explícita
// del fundador: mejor un error que un LEEME que dice de más) NO se fuerza aquí — no hay
// forma de provocar un fallo real de BD de manera fiable sin mockear producción. Queda
// cubierto por revisión de código: la generación ocurre en la Fase 1 (antes de
// `res.headersSent`), exactamente el mismo mecanismo que ya prueba SCRUM-25 para el
// "paquete incompleto" de PDFs — la diferencia es que un PDF fallido se ANOTA y el XML
// fallido ABORTA, ver el comentario en exports.routes.ts.
//
// ⚠️ GATEADO (crea/BORRA un merchant efímero; levanta la app in-process):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';

// Mismos parsers de ZIP que scrum25-export-zip.test.mjs (central directory; el contenido
// va deflatado con archiver, así que hay que descomprimir para comparar texto).
function listarEntradasZip(buf) {
  const nombres = [];
  const SIG = 0x04034b50;
  for (let i = 0; i + 30 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== SIG) continue;
    const lenNombre = buf.readUInt16LE(i + 26);
    const lenExtra = buf.readUInt16LE(i + 28);
    if (lenNombre === 0 || i + 30 + lenNombre > buf.length) continue;
    nombres.push(buf.toString('utf8', i + 30, i + 30 + lenNombre));
    i += 29 + lenNombre + lenExtra;
  }
  return nombres;
}

function contenidoEntradasZip(buf) {
  const out = {};
  const SIG_CD = 0x02014b50;
  for (let i = 0; i + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== SIG_CD) continue;
    const metodo = buf.readUInt16LE(i + 10);
    const compSize = buf.readUInt32LE(i + 20);
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const cmtLen = buf.readUInt16LE(i + 32);
    const lho = buf.readUInt32LE(i + 42);
    const nombre = buf.toString('utf8', i + 46, i + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const ini = lho + 30 + lNameLen + lExtraLen;
    const datos = buf.subarray(ini, ini + compSize);
    try {
      out[nombre] = metodo === 0 ? datos.toString('utf8') : zlib.inflateRawSync(datos).toString('utf8');
    } catch {
      out[nombre] = '';
    }
    i += 45 + nameLen + extraLen + cmtLen;
  }
  return out;
}

test('SCRUM-82: datos.zip incluye el XML VeriFactu por año, byte-idéntico al endpoint suelto', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  try {
    await withMerchant(prisma, {
      name: 'QA S82 ZIP VeriFactu', taxId: `B${String(stamp).slice(-8)}`,
      email: `qa-s82-${stamp}@test.local`,
    }, async (merchant) => {
      const customer = await prisma.customer.create({
        data: { merchantId: merchant.id, name: 'Cliente QA S82', phone: `34603${stamp % 1000000}` },
      });

      const currentYear = new Date().getFullYear();
      const prevYear = currentYear - 1;

      const invoiceThisYear = await prisma.invoice.create({
        data: {
          merchantId: merchant.id, customerId: customer.id,
          number: `${currentYear}-QA-${stamp % 1000}`,
          total: '121.00', currency: 'EUR', type: 'F1', status: 'paid',
          lines: [{ concept: 'Servicio QA S82 A', qty: 1, price: 100, tax: 0.21 }],
          // SCRUM-205: `sellado` porque ya escribe `vfHash`. Este test necesita registros que
          // exportar: una factura sin sellar no entra en el XML.
          vfHash: 'HASH_QA_S82_A', vfPrevHash: '', vfEstado: 'sellado',
          pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
        },
      });
      // Factura del año ANTERIOR — fuerza el caso multi-año (SCRUM-82: un XML por
      // ejercicio, no uno solo por el rango pedido).
      const invoicePrevYear = await prisma.invoice.create({
        data: {
          merchantId: merchant.id, customerId: customer.id,
          number: `${prevYear}-QA-${stamp % 1000}`,
          // SCRUM-209: esta factura existe para forzar el caso MULTI-AÑO, no para probar un
          // tipo de IVA. Llevaba `tax: 0`, y desde SCRUM-209 un tramo al 0 % ya no se emite
          // con un código inventado: bloquea la exportación (no se puede saber si es sujeta
          // al 0 %, exenta o no sujeta). Pasa a 21 % — el caso multi-año se prueba igual, y
          // el total se ajusta para que cuadre con las líneas (50 + 21 % = 60,50).
          total: '60.50', currency: 'EUR', type: 'F1', status: 'paid',
          createdAt: new Date(prevYear, 5, 15),
          lines: [{ concept: 'Servicio QA S82 B', qty: 1, price: 50, tax: 0.21 }],
          // SCRUM-205: ídem, y esta es la del año ANTERIOR — el test comprueba que el ZIP
          // separa los XML por año natural, así que las dos tienen que estar en la cadena.
          vfHash: 'HASH_QA_S82_B', vfPrevHash: '', vfEstado: 'sellado',
          pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
        },
      });

      const token = 'qa82-' + crypto.randomBytes(12).toString('hex');
      await prisma.authSession.create({
        data: { merchantId: merchant.id, teamMemberId: null, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
      });
      const rVerify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
      const cookie = (rVerify.headers.get('set-cookie') || '').split(';')[0];
      assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

      const getZip = () => fetch(`${base}/admin/exports/datos.zip`, { headers: { cookie } });
      const getXml = (year) => fetch(`${base}/admin/exports/verifactu.xml?year=${year}`, { headers: { cookie } });

      // ── FLAG OFF (default): sin XML, LEEME avisa de la ausencia ────────────
      const rOff = await getZip();
      assert.equal(rOff.status, 200, 'flag OFF: el ZIP debe generarse igual');
      const bufOff = Buffer.from(await rOff.arrayBuffer());
      const entradasOff = listarEntradasZip(bufOff);
      assert.ok(!entradasOff.some((n) => n.endsWith('.xml')), `flag OFF: sin XML en el paquete (vino: ${entradasOff.join(', ')})`);
      const leemeOff = contenidoEntradasZip(bufOff)['LEEME.txt'];
      assert.ok(leemeOff.includes('no incluye el XML'), 'flag OFF: el LEEME debe avisar de la ausencia');

      // ── FLAG ON (override por merchant, no toca el env global) ─────────────
      await prisma.merchant.update({ where: { id: merchant.id }, data: { flags: { INVOICING_ES_ENABLED: true } } });

      const rOn = await getZip();
      assert.equal(rOn.status, 200, 'flag ON: el ZIP debe generarse (200), no fallar');
      const bufOn = Buffer.from(await rOn.arrayBuffer());
      const entradasOn = listarEntradasZip(bufOn);
      assert.ok(entradasOn.includes(`facturas/verifactu_${currentYear}.xml`),
        `falta el XML de ${currentYear}. Entradas: ${entradasOn.join(', ')}`);
      assert.ok(entradasOn.includes(`facturas/verifactu_${prevYear}.xml`),
        `falta el XML de ${prevYear} (caso multi-año). Entradas: ${entradasOn.join(', ')}`);

      const contenidoOn = contenidoEntradasZip(bufOn);
      assert.ok(!contenidoOn['LEEME.txt'].includes('no incluye el XML'), 'flag ON: no debe decir que falta el XML');
      assert.match(contenidoOn['LEEME.txt'], /RRSIF/, 'flag ON: el LEEME debe describir QUÉ es el archivo, no solo que existe');
      assert.ok(
        contenidoOn['LEEME.txt'].includes(`verifactu_${currentYear}.xml`) && contenidoOn['LEEME.txt'].includes(`verifactu_${prevYear}.xml`),
        'flag ON con 2 ejercicios: el LEEME debe nombrar CADA archivo, no un resumen genérico',
      );

      // ── BYTE-IDÉNTICO al endpoint suelto — misma fuente, sin divergencia ────
      // NORMALIZADO: `fechaGeneracion` es "cuándo se generó ESTA respuesta", no un dato de
      // la factura — dos llamadas HTTP separadas (una para el ZIP, otra para el endpoint
      // suelto) siempre lo llevan distinto, aunque el resto del documento sea idéntico.
      // Confirmado en la primera corrida de este test: la ÚNICA diferencia real era ese
      // timestamp — comparar sin normalizar habría hecho el assert imposible de pasar por
      // construcción, no por una divergencia real del constructor.
      const sinFechaGeneracion = (xml) => xml.replace(/fechaGeneracion="[^"]*"/, 'fechaGeneracion="NORMALIZADO"');

      const rXmlCurrent = await getXml(currentYear);
      assert.equal(rXmlCurrent.status, 200);
      const xmlCurrentSuelto = await rXmlCurrent.text();
      assert.equal(
        sinFechaGeneracion(contenidoOn[`facturas/verifactu_${currentYear}.xml`]), sinFechaGeneracion(xmlCurrentSuelto),
        `el XML de ${currentYear} dentro del ZIP debe ser IDÉNTICO a GET /verifactu.xml?year=${currentYear} (salvo fechaGeneracion)`,
      );

      const rXmlPrev = await getXml(prevYear);
      assert.equal(rXmlPrev.status, 200);
      const xmlPrevSuelto = await rXmlPrev.text();
      assert.equal(
        sinFechaGeneracion(contenidoOn[`facturas/verifactu_${prevYear}.xml`]), sinFechaGeneracion(xmlPrevSuelto),
        `el XML de ${prevYear} dentro del ZIP debe ser IDÉNTICO a GET /verifactu.xml?year=${prevYear} (salvo fechaGeneracion)`,
      );

      // Y cada XML lleva SOLO las facturas de SU año — no mezcla ejercicios.
      assert.match(xmlCurrentSuelto, new RegExp(invoiceThisYear.number));
      assert.doesNotMatch(xmlCurrentSuelto, new RegExp(invoicePrevYear.number), `el XML de ${currentYear} no debe llevar facturas de ${prevYear}`);
      assert.match(xmlPrevSuelto, new RegExp(invoicePrevYear.number));
      assert.doesNotMatch(xmlPrevSuelto, new RegExp(invoiceThisYear.number), `el XML de ${prevYear} no debe llevar facturas de ${currentYear}`);

      t.diagnostic('SCRUM-82: flag OFF sin XML (LEEME avisa) ✓ · flag ON 2 ejercicios, byte-idéntico al endpoint suelto, sin mezclar años ✓');
    });
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});
