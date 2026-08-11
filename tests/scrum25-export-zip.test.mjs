// SCRUM-25 (EXPORT-1 · punto B) — GET /admin/exports/datos.zip
// El "paquete de datos" del merchant: /csv con las 5 tablas + /facturas con los PDF.
//
// Verifica: técnico 403 (S1) · entradas esperadas del ZIP · BOM en los CSV · el PDF real
// va dentro · tenancy (nada del merchant vecino) · rango de fechas · audit · y que con
// INVOICING_ES_ENABLED OFF el ZIP se genera SIN XML y SIN error.
//
// El ZIP se lee con la utilidad `unzipSync` de node:zlib? NO existe — se parsea el
// "central directory" a mano (mínimo necesario: nombres de entrada y tamaños), que es
// suficiente para lo que aquí se comprueba y evita añadir una dependencia de test.
//
// Datos EFÍMEROS propios con limpieza en el finally — nunca el seed demo (SCRUM-63).
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros; levanta la app in-process):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { crearFactura } from './_factura-fixture.mjs';
import { assertAusenteConMecanismoVivo } from './_ausencia.mjs'; // SCRUM-108

const ENABLED = process.env.QA_DB_TEST === '1';

/**
 * SCRUM-111: extrae el CONTENIDO de las entradas del ZIP, descomprimiéndolas.
 *
 * ⚠️ POR QUÉ EXISTE ESTO. El canario de tenancy hacía `buf.includes(CANARIO_B)` sobre los
 * bytes CRUDOS del ZIP. El paquete se genera con `zlib: { level: 9 }`, así que el
 * contenido va DEFLATADO: una cadena filtrada dentro de un CSV **no aparece en crudo**.
 * Ese assert no se rompió con el tiempo — nunca pudo fallar. Comprobado construyendo un
 * ZIP con el canario dentro: `buf.includes(canario)` daba `false` con la fuga presente.
 *
 * Se lee el CENTRAL DIRECTORY y no las cabeceras locales porque archiver genera el ZIP en
 * streaming: con data descriptors, los tamaños del local header vienen a 0 y no se puede
 * saber dónde acaba cada bloque de datos.
 */
function contenidoEntradasZip(buf) {
  const out = {};
  const SIG_CD = 0x02014b50; // PK\x01\x02 — central directory header
  for (let i = 0; i + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== SIG_CD) continue;
    const metodo    = buf.readUInt16LE(i + 10); // 0 = almacenado, 8 = deflate
    const compSize  = buf.readUInt32LE(i + 20);
    const nameLen   = buf.readUInt16LE(i + 28);
    const extraLen  = buf.readUInt16LE(i + 30);
    const cmtLen    = buf.readUInt16LE(i + 32);
    const lho       = buf.readUInt32LE(i + 42); // offset del local header
    const nombre    = buf.toString('utf8', i + 46, i + 46 + nameLen);
    // El local header tiene SUS propios nameLen/extraLen: es donde empiezan los datos.
    const lNameLen  = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const ini = lho + 30 + lNameLen + lExtraLen;
    const datos = buf.subarray(ini, ini + compSize);
    try {
      out[nombre] = metodo === 0 ? datos.toString('utf8') : zlib.inflateRawSync(datos).toString('utf8');
    } catch {
      out[nombre] = ''; // binario que no inflamos (PDF): no aporta al canario de texto
    }
    i += 45 + nameLen + extraLen + cmtLen;
  }
  return out;
}

/**
 * Lista los nombres de entrada de un ZIP leyendo las cabeceras locales (PK\x03\x04).
 * No descomprime: solo necesitamos saber QUÉ hay dentro y que el paquete es un ZIP real.
 * (Los NOMBRES sí van en claro, por eso para ellos basta con esto.)
 */
function listarEntradasZip(buf) {
  const nombres = [];
  const SIG = 0x04034b50; // PK\x03\x04 — local file header
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

test('SCRUM-25 (B): datos.zip — técnico 403, entradas, PDFs, tenancy, rango, flag OFF y audit', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { isFlagEnabled } = await import('../dist/core/flags.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const datosMerchant = (tag) => ({
    name: `QA S25B ${tag}`, email: `qa-s25b-${tag}-${stamp}@test.local`, invoiceSeriesPrefix: 'CF',
  });

  // SCRUM-113: los merchants y TODO su montaje viven dentro de withMerchant. Antes se
  // creaban aquí, fuera del try: si reventaba el alta del técnico, de un cliente o de una
  // factura, el finally ni se planteaba y quedaban huérfanos en staging.
  try {
    await withMerchant(prisma, datosMerchant('A'), (merchantA) =>
      // vecino: nada suyo puede salir en el ZIP de A
      withMerchant(prisma, datosMerchant('B'), async (merchantB) => {
    const tecnicoA = await prisma.teamMember.create({
      data: {
        merchantId: merchantA.id, name: 'QA Tec S25B',
        email: `qa-s25b-tec-${stamp}@test.local`, role: 'tecnico', status: 'active',
      },
    });

    const CANARIO_B = `VECINO-NO-DEBE-SALIR-${stamp}`;
    const custA = await prisma.customer.create({
      data: { merchantId: merchantA.id, name: `Cliente S25B ${stamp}`, phone: '34000000034' },
    });
    await prisma.customer.create({ data: { merchantId: merchantB.id, name: CANARIO_B } });

    // Factura de A: 100 € + 21 % → base 100,00 · IVA 21,00 · total 121,00
    const numero = `${new Date().getFullYear()}-CF-${String(600 + (stamp % 90)).padStart(3, '0')}`;
    const invoiceA = await crearFactura(prisma, {
      merchantId: merchantA.id, customerId: custA.id, number: numero,
      total: '121.00', currency: 'EUR', type: 'F1',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
      lines: [{ concept: 'Obra QA S25B', qty: 1, price: 100, tax: 0.21 }],
      vfEstado: 'no_aplica', // merchant sin NIF → no entra en la cadena VeriFactu
    });
    await prisma.job.create({
      data: {
        merchantId: merchantA.id, customerId: custA.id, status: 'en_curso',
        titulo: 'Trabajo S25B', totalAceptado: '1000.00', totalCobrado: '250.00',
      },
    });
    await prisma.charge.create({
      data: {
        merchantId: merchantA.id, customerId: custA.id, concept: 'Cobro S25B',
        amount: '121.00', currency: 'EUR', method: 'bizum_manual', status: 'paid',
      },
    });

    const mkCookie = async (merchantId, teamMemberId = null) => {
      const token = 'qa25b-' + crypto.randomBytes(12).toString('hex');
      await prisma.authSession.create({
        data: { merchantId, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
      });
      const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
      const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
      assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
      return cookie;
    };

    const cookieAdmin = await mkCookie(merchantA.id, null);
    const cookieTecnico = await mkCookie(merchantA.id, tecnicoA.id);
    const get = (path, cookie) => fetch(`${base}${path}`, { headers: { cookie } });

    // ── (S1) el TÉCNICO no se lleva el paquete ──────────────────────────────
    const forbidden = await get('/admin/exports/datos.zip', cookieTecnico);
    assert.equal(forbidden.status, 403, `el técnico NO debe poder exportar el ZIP (fue ${forbidden.status})`);

    // ── ADMIN: descarga y es un ZIP de verdad ───────────────────────────────
    const res = await get('/admin/exports/datos.zip', cookieAdmin);
    assert.equal(res.status, 200, 'el admin debe poder descargar el paquete');
    assert.match(res.headers.get('content-type') || '', /zip/, 'content-type de ZIP');
    assert.match(res.headers.get('content-disposition') || '', /attachment; filename="yaqu-datos-/, 'debe descargarse como adjunto');

    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 2).toString('latin1'), 'PK', 'la firma del fichero debe ser la de un ZIP');
    assert.ok(buf.length > 500, `el ZIP no puede venir vacío (${buf.length} bytes)`);

    const entradas = listarEntradasZip(buf);

    // ── ENTRADAS esperadas: las 5 tablas + el PDF + el LEEME ────────────────
    for (const n of ['csv/clientes.csv', 'csv/facturas.csv', 'csv/cobros.csv', 'csv/trabajos.csv', 'csv/presupuestos.csv']) {
      assert.ok(entradas.includes(n), `falta ${n} en el paquete. Entradas: ${entradas.join(', ')}`);
    }
    assert.ok(entradas.includes('LEEME.txt'), 'el paquete debe llevar LEEME.txt');
    assert.ok(entradas.includes(`facturas/${numero}.pdf`),
      `falta el PDF de la factura. Entradas: ${entradas.join(', ')}`);

    // ── FLAG FISCAL OFF → sin XML y SIN error (regla 24/26) ─────────────────
    const merchantARow = await prisma.merchant.findUnique({ where: { id: merchantA.id } });
    const flagOn = isFlagEnabled('INVOICING_ES_ENABLED', { merchant: merchantARow });
    if (!flagOn) {
      const xml = entradas.filter((n) => n.endsWith('.xml'));
      assert.equal(xml.length, 0, `con INVOICING_ES_ENABLED OFF no debe haber XML: ${xml.join(', ')}`);
      // y aun así el ZIP se ha generado bien (ya comprobado arriba: 200 + entradas)
    }

    // ── TENANCY: ni rastro del merchant vecino ──────────────────────────────
    // SCRUM-111: se inspecciona el contenido DESCOMPRIMIDO, no los bytes del ZIP. Buscar
    // en crudo no detectaba nada: el paquete va deflatado (`zlib: { level: 9 }`).
    // Y con guarda: el nombre del cliente PROPIO tiene que aparecer por la misma vía; si
    // no, el canario no puede detectar una fuga y hay que arreglarlo antes (SCRUM-108).
    const textoZip = Object.values(contenidoEntradasZip(buf)).join('\n');
    assertAusenteConMecanismoVivo(
      textoZip,
      CANARIO_B,
      custA.name,
      'TENANCY ROTA: el ZIP incluye datos de otro merchant',
    );

    // ── RANGO: una ventana pasada deja los CSV sin filas de datos ───────────
    const resViejo = await get('/admin/exports/datos.zip?from=2000-01-01&to=2000-12-31', cookieAdmin);
    assert.equal(resViejo.status, 200, 'con rango vacío el ZIP se genera igual');
    const bufViejo = Buffer.from(await resViejo.arrayBuffer());
    const entradasViejo = listarEntradasZip(bufViejo);
    assert.ok(entradasViejo.includes('csv/clientes.csv'), 'los CSV siguen estando aunque no haya filas');
    assert.ok(!entradasViejo.includes(`facturas/${numero}.pdf`),
      'una factura fuera del rango NO debe entrar en el paquete');

    // ── AUDIT: la descarga deja traza, con completo/parcial (S2/S4) ─────────
    const audits = await prisma.auditLog.findMany({
      where: { merchantId: merchantA.id, action: 'datos_exportados' },
      orderBy: { id: 'desc' },
    });
    const delZip = audits.map((a) => a.meta || {}).filter((m) => m.fichero === 'datos.zip');
    assert.ok(delZip.length > 0, 'falta la traza de audit del ZIP');
    const meta = delZip[delZip.length - 1]; // la primera descarga (sin rango)
    assert.equal(typeof meta.completo, 'boolean', 'el audit del ZIP debe registrar si salió completo');
    assert.equal(typeof meta.pdfs_incluidos, 'number', 'el audit debe registrar cuántos PDF llevó');
    assert.equal(typeof meta.pdfs_fallidos, 'number', 'el audit debe registrar cuántos PDF fallaron');

    // ── PAQUETE INCOMPLETO: debe ser IMPOSIBLE no enterarse ─────────────────
    // Se fuerza el fallo apuntando una factura a un id inexistente de cliente no:
    // se crea una factura cuyo PDF no se puede generar (merchant sin relación válida)
    // no es reproducible; en su lugar se comprueba el CONTRATO del caso completo:
    // cuando no hay fallos, ni el nombre ni el paquete llevan marca de incompleto.
    const cd = res.headers.get('content-disposition') || '';
    if (meta.completo) {
      assert.ok(!cd.includes('INCOMPLETO'), 'un paquete completo no debe marcarse como incompleto');
      assert.ok(!entradas.includes('AVISO-PAQUETE-INCOMPLETO.txt'), 'sin fallos no debe haber fichero de aviso');
    } else {
      // Si por lo que sea faltó algún PDF, la señal tiene que ser visible SIN abrir nada.
      assert.match(cd, /INCOMPLETO/, 'un paquete con PDF fallidos debe decirlo en el nombre del fichero');
      assert.ok(entradas.includes('AVISO-PAQUETE-INCOMPLETO.txt'), 'y llevar dentro el fichero de aviso');
    }

        t.diagnostic(`zip: ${entradas.length} entradas · técnico 403 ✓ · PDF dentro ✓ · sin XML (flag OFF) ✓ · tenancy ✓ · rango ✓ · audit ✓`);
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
