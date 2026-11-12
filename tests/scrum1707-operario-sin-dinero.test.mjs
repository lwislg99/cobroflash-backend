// tests/scrum1707-operario-sin-dinero.test.mjs — SCRUM-1707 (PILOTO-1)
//
// 🔴 EL DEFECTO (captura del fundador, 11-nov): logueado como operario, su lista de Trabajos le
// enseñaba el DINERO del negocio — «POR COBRAR», el estado de cobro y los filtros Pendiente/Parcial/
// Pagado— y la API del albarán le servía los precios.
//
// FIRMADO por el fundador (c.21547, literal):
//   Q1 «Importe de SUS trabajos: ve el importe de los trabajos suyos (igual que ya ve sus
//       presupuestos), pero SIN la tarjeta "Por cobrar" ni los filtros de cobro del negocio.»
//   Q2 «No: se recortan — el servidor recorta los precios del albarán para el rol operario, igual
//       que ya hace con el parte.»
// ALCANCE (c.21556): ① `invoices` (lleva status 'paid') NO sale para el operario: ve el IMPORTE, no su
// estado de cobro. ② El PDF del albarán queda FUERA del recorte por rol; Q2 cubre la API JSON.
//
// Se mide:
//   ① SIN BD · `trabajoParaElRol`: al operario le llega el importe (totalAceptado, importeReferencia,
//      quote.total) y NO el estado de cobro (totalCobrado, estadoCobro, remaining, nextStage,
//      pendingStagesCount, hasCustomPlan, invoices, charge). Control: el jefe lo recibe intacto, y un
//      rol desconocido cae del lado restringido.
//   ② SIN BD · `albaranParaElRol`: líneas sin precioUnitario/tipoIva, totales a null, y el CENSO de
//      claves de una línea — una clave nueva en la línea no cruza sin que alguien la decida aquí.
//   ③ CON BANCO · por comportamiento, cada puerta JSON del albarán y del trabajo, con control del jefe.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { trabajoParaElRol } from '../dist/modules/jobs/domain/trabajoParaElRol.js';
import { albaranParaElRol, filaDeAlbaranParaElRol, grupoPendienteParaElRol } from '../dist/modules/jobs/domain/albaranParaElRol.js';

// Lo que devuelve `serializeJobDetail` en un trabajo con dinero, con las claves que importan.
const TRABAJO = () => ({
  id: 1, notes: null, status: 'terminado',
  totalAceptado: 1.21, importeReferencia: 1.21,
  quote: { id: 9, number: 9, total: 1.21, currency: 'EUR', paymentTerms: null },
  totalCobrado: 0.5, estadoCobro: 'Parcial',
  remaining: { amount: 0.71, currency: 'EUR' },
  nextStage: { label: 'Resto', amount: 0.71, currency: 'EUR' },
  pendingStagesCount: 1, hasCustomPlan: true,
  invoices: [{ id: 3, status: 'paid', createdAt: '2026-11-01' }],
  charge: { id: 4, status: 'paid', method: 'bizum', amount: 0.5, currency: 'EUR' },
  albaranes: [{ id: 5, lineas: [{ concepto: 'Grifo', cantidad: 1, unidad: 'ud', precioUnitario: 1, tipoIva: 21 }],
    totales: { total: 1.21 }, importePendienteDeFacturar: 1.21 }],
});

test('SCRUM-1707 · ① (Q1 + c.21556 ①) el operario recibe el importe de su trabajo, no su estado de cobro', () => {
  const op = trabajoParaElRol(TRABAJO(), 'tecnico');
  const fallos = [];
  const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
  // Lo que SÍ ve: el importe de SUS trabajos.
  blando(() => assert.equal(op.totalAceptado, 1.21, '🔴 el operario perdió el importe de su trabajo'));
  blando(() => assert.equal(op.importeReferencia, 1.21, '🔴 el operario perdió el importe de referencia'));
  blando(() => assert.equal(op.quote?.total, 1.21, '🔴 el operario perdió el total de su presupuesto'));
  // Lo que NO: el estado de cobro. La clave se conserva con su valor «vacío».
  blando(() => assert.equal(op.totalCobrado, null, '🔴 `totalCobrado` le llega al operario'));
  blando(() => assert.equal(op.estadoCobro, null, '🔴 `estadoCobro` (Pendiente/Parcial/Pagado) le llega al operario'));
  blando(() => assert.equal(op.remaining, null, '🔴 `remaining` (lo pendiente) le llega al operario'));
  blando(() => assert.equal(op.nextStage, null, '🔴 `nextStage` le llega al operario'));
  blando(() => assert.equal(op.pendingStagesCount, 0, '🔴 `pendingStagesCount` le llega al operario'));
  blando(() => assert.equal(op.hasCustomPlan, false, '🔴 `hasCustomPlan` le llega al operario'));
  blando(() => assert.deepEqual(op.invoices, [], '🔴 `invoices` (con status paid) le llega al operario (c.21556 ①)'));
  blando(() => assert.equal(op.charge, null, '🔴 el cobro (`charge`) le llega al operario'));
  // Los albaranes que viajan DENTRO del trabajo pasan por el mismo recorte que su API (Q2).
  blando(() => assert.ok(!('precioUnitario' in (op.albaranes?.[0]?.lineas?.[0] ?? {})), '🔴 el detalle del trabajo le da al operario los precios del albarán'));
  blando(() => assert.equal(op.albaranes?.[0]?.importePendienteDeFacturar, null, '🔴 el importe pendiente del albarán le llega al operario'));
  // La forma no cambia: ninguna clave desaparece (nadie distingue «no viaja» de «vacío»).
  blando(() => assert.deepEqual(Object.keys(op).sort(), Object.keys(TRABAJO()).sort(), '🔴 la forma del trabajo cambia para el operario'));
  // Control: el jefe, intacto. Y un rol desconocido cae del lado restringido (SCRUM-147).
  blando(() => assert.deepEqual(trabajoParaElRol(TRABAJO(), 'admin'), TRABAJO(), '🔴 el recorte le quita algo al jefe'));
  blando(() => assert.equal(trabajoParaElRol(TRABAJO(), 'comercial').totalCobrado, null, '🔴 un rol desconocido ve el cobro (fail-open)'));
  // Sin `charge` ni `albaranes` (la LISTA), no se inventan claves.
  const lista = { ...TRABAJO() }; delete lista.charge;
  blando(() => assert.ok(!('charge' in trabajoParaElRol(lista, 'tecnico')), '🔴 el recorte AÑADE `charge` a la lista'));
  assert.deepEqual(fallos, [], `\n  ${fallos.join('\n  ')}`);
});

test('SCRUM-1707 · ② (Q2) la API del albarán le llega al operario sin precios — campo a campo', () => {
  const ALB = () => ({
    id: 5, modoValoracion: 'VALORADO', ocultarPreciosEnDocumento: false, estado: 'emitido',
    lineas: [
      { concepto: 'Grifo', cantidad: 2, unidad: 'ud', precioUnitario: 987.65, tipoIva: 21, quoteLineIndex: 0 },
      // Una clave que la línea ganara mañana: NO cruza sin que alguien la nombre aquí.
      { concepto: 'Latiguillo', cantidad: 1, unidad: 'ud', precioUnitario: 3, tipoIva: 21, costeInterno: 1 },
    ],
    totales: { base: 1978.3, cuota: 415.44, total: 2393.74 },
    // `pendientePorLinea` (detalle): lleva precio e IVA por línea.
    pendientes: [{ index: 0, concepto: 'Grifo', unidad: 'ud', servida: 2, facturada: 0, pendiente: 2, precioUnitario: 987.65, tipoIva: 21 }],
  });
  const op = albaranParaElRol(ALB(), 'tecnico');
  assert.deepEqual(op.pendientes, [{ index: 0, concepto: 'Grifo', unidad: 'ud', servida: 2, facturada: 0, pendiente: 2 }],
    '🔴 los `pendientes` del albarán le llevan al operario el precio o el IVA');
  assert.deepEqual(op.lineas, [
    { concepto: 'Grifo', cantidad: 2, unidad: 'ud', quoteLineIndex: 0 },
    { concepto: 'Latiguillo', cantidad: 1, unidad: 'ud' },
  ], '🔴 las líneas del albarán le llevan al operario algo más que concepto, cantidad, unidad y origen');
  assert.equal(op.totales, null, '🔴 los totales del albarán le llegan al operario');
  assert.equal(op.modoValoracion, 'VALORADO', 'el modo del documento no es dinero: se queda');
  assert.ok(!('importePendienteDeFacturar' in op), 'no se inventa una clave que no viajaba');
  // Control: el jefe, intacto; y un rol desconocido, restringido.
  assert.deepEqual(albaranParaElRol(ALB(), 'admin'), ALB(), '🔴 el recorte le quita algo al jefe');
  assert.equal(albaranParaElRol(ALB(), undefined).totales, null, '🔴 un rol ausente ve los totales (fail-open)');
  // El listado y la bandeja «pendientes de facturar»: sus sumas son los precios.
  assert.equal(filaDeAlbaranParaElRol({ id: 5, total: 2393.74 }, 'tecnico').total, null);
  assert.equal(filaDeAlbaranParaElRol({ id: 5, total: 2393.74 }, 'admin').total, 2393.74);
  assert.equal(grupoPendienteParaElRol({ importePotencial: { total: 1 } }, 'tecnico').importePotencial, null);
  assert.deepEqual(grupoPendienteParaElRol({ importePotencial: { total: 1 } }, 'admin').importePotencial, { total: 1 });
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

// ── ③ POR COMPORTAMIENTO ─────────────────────────────────────────────────────────────────────
// Cada puerta JSON por la que el dinero le llegaba al operario. CONTROL en cada una: el jefe SÍ lo
// recibe, así que un `null` para el operario no puede ser «el campo no viaja para nadie». El precio
// es un número que no sale por casualidad (987.65): si aparece en el texto, cruzó.
test('SCRUM-1707 · ③ (c.21547) por la API, el operario no recibe ni el cobro de su trabajo ni los precios del albarán',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1707', email: `qa-1707-${stamp}@test.local` }, async (m) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1707', email: `qa-1707-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1707' } });
        const sesion = async (teamMemberId) => {
          const token = 'qa1707-' + crypto.randomBytes(12).toString('hex');
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
            method: metodo, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo ?? {}),
          }),
        });
        const jefe = conCookie(await sesion(null));
        const op = conCookie(await sesion(operario.id));

        const PRECIO = 987.65;
        const suyo = await prisma.job.create({
          data: {
            merchantId: m.id, customerId: cliente.id, assignedUserId: operario.id, status: 'en_curso',
            totalAceptado: 100, totalCobrado: 50,
            // La bandeja «pendientes de facturar» sólo agrupa operaciones sueltas (no TRABAJO_UNICO).
            tipoOperacion: 'OPERACIONES_SUELTAS',
          },
        });
        const alb = await prisma.albaran.create({
          data: {
            merchantId: m.id, jobId: suyo.id, numero: `ALB-QA-1707-${stamp}`, modoValoracion: 'VALORADO',
            lineas: [{ concepto: 'Grifo monomando', cantidad: 1, unidad: 'ud', precioUnitario: PRECIO, tipoIva: 21 }],
          },
        });

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
        const sinPrecios = (txt, puerta) => {
          blando(() => assert.ok(!txt.includes(String(PRECIO)), `🔴 ${puerta}: el precio del albarán le llega al operario`));
          blando(() => assert.ok(!/"precioUnitario"|"tipoIva"/.test(txt), `🔴 ${puerta}: las líneas llevan precioUnitario/tipoIva`));
        };
        const conPrecios = (txt, puerta) => assert.ok(txt.includes(String(PRECIO)), `control: ${puerta} del jefe lleva el precio`);

        // ── Trabajo: detalle y lista.
        const detJefe = await jefe.get(`/admin/jobs/${suyo.id}`);
        assert.equal(detJefe.status, 200, `control: el jefe abre el trabajo (${detJefe.status})`);
        const dJ = JSON.parse(detJefe.text);
        assert.equal(dJ.totalCobrado, 50, 'control: el jefe ve lo cobrado');
        assert.notEqual(dJ.estadoCobro, null, 'control: el jefe ve el estado de cobro');
        conPrecios(detJefe.text, 'el detalle del trabajo');
        const detOp = await op.get(`/admin/jobs/${suyo.id}`);
        assert.equal(detOp.status, 200, `control: el operario abre su trabajo (${detOp.status})`);
        const dO = JSON.parse(detOp.text);
        blando(() => assert.equal(dO.totalAceptado, dJ.totalAceptado, '🔴 el operario perdió el importe de su trabajo'));
        blando(() => assert.equal(dO.totalCobrado, null, '🔴 el DETALLE le da al operario lo cobrado'));
        blando(() => assert.equal(dO.estadoCobro, null, '🔴 el DETALLE le da al operario el estado de cobro'));
        blando(() => assert.deepEqual(dO.invoices, [], '🔴 el DETALLE le da al operario las facturas'));
        blando(() => assert.equal(dO.charge, null, '🔴 el DETALLE le da al operario el cobro'));
        sinPrecios(detOp.text, 'el detalle del trabajo');

        const lisJefe = JSON.parse((await jefe.get('/admin/jobs')).text).find((j) => j.id === suyo.id);
        assert.equal(lisJefe?.totalCobrado, 50, 'control: la lista del jefe trae lo cobrado');
        const lisOp = JSON.parse((await op.get('/admin/jobs')).text).find((j) => j.id === suyo.id);
        assert.ok(lisOp, 'control: el trabajo está en la lista del operario');
        blando(() => assert.equal(lisOp.totalCobrado, null, '🔴 la LISTA le da al operario lo cobrado'));
        blando(() => assert.equal(lisOp.estadoCobro, null, '🔴 la LISTA le da al operario el estado de cobro (los filtros Pendiente/Parcial/Pagado)'));
        blando(() => assert.equal(lisOp.totalAceptado, lisJefe.totalAceptado, '🔴 la LISTA le quitó al operario el importe de su trabajo'));

        // ── Albarán: listado y detalle.
        const filaJ = JSON.parse((await jefe.get('/admin/albaranes')).text).filas.find((f) => f.id === alb.id);
        assert.ok(typeof filaJ?.total === 'number', 'control: el listado del jefe trae el total del albarán');
        const lisAlbOp = await op.get('/admin/albaranes');
        const filaO = JSON.parse(lisAlbOp.text).filas.find((f) => f.id === alb.id);
        assert.ok(filaO, 'control: el albarán está en el listado del operario');
        blando(() => assert.equal(filaO.total, null, '🔴 el LISTADO de albaranes le da al operario el total'));

        conPrecios((await jefe.get(`/admin/albaranes/${alb.id}`)).text, 'el detalle del albarán');
        const dAlbOp = await op.get(`/admin/albaranes/${alb.id}`);
        assert.equal(dAlbOp.status, 200, `control: el operario abre el albarán de su trabajo (${dAlbOp.status})`);
        sinPrecios(dAlbOp.text, 'GET /admin/albaranes/:id');
        blando(() => assert.equal(JSON.parse(dAlbOp.text).totales, null, '🔴 GET /admin/albaranes/:id: los totales le llegan al operario'));

        // ── Las respuestas de las escrituras del operario.
        const pOp = await op.escribir('PATCH', `/admin/albaranes/${alb.id}`, { version: alb.version, notas: 'Probado sin fugas' });
        assert.equal(pOp.status, 200, `control: el operario edita la nota de su albarán (${pOp.status}: ${pOp.text.slice(0, 160)})`);
        sinPrecios(pOp.text, 'PATCH /admin/albaranes/:id');
        const e1 = await op.escribir('POST', `/admin/albaranes/${alb.id}/emitir`);
        assert.equal(e1.status, 200, `control: el operario emite (${e1.status}: ${e1.text.slice(0, 160)})`);
        sinPrecios(e1.text, 'POST /:id/emitir');
        const e2 = await op.escribir('POST', `/admin/albaranes/${alb.id}/emitir`);
        assert.equal(e2.status, 200, `control: emitir es idempotente (${e2.status})`);
        sinPrecios(e2.text, 'POST /:id/emitir (idempotente)');
        const dup = await op.escribir('POST', `/admin/albaranes/${alb.id}/duplicar`);
        assert.equal(dup.status, 201, `control: el operario duplica (${dup.status}: ${dup.text.slice(0, 160)})`);
        sinPrecios(dup.text, 'POST /:id/duplicar');
        const firma = await op.escribir('POST', `/admin/albaranes/${alb.id}/firmar`, {
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          firmadoPorNombre: 'Cliente 1707',
        });
        assert.equal(firma.status, 200, `control: el operario hace firmar (${firma.status}: ${firma.text.slice(0, 160)})`);
        sinPrecios(firma.text, 'POST /:id/firmar');
        const nuevo = await op.escribir('POST', `/admin/jobs/${suyo.id}/albaranes`, {
          modoValoracion: 'VALORADO',
          lineas: [{ concepto: 'Otro grifo', cantidad: 1, unidad: 'ud', precioUnitario: PRECIO, tipoIva: 21 }],
        });
        assert.ok([200, 201].includes(nuevo.status), `control: el operario crea un albarán (${nuevo.status}: ${nuevo.text.slice(0, 160)})`);
        sinPrecios(nuevo.text, 'POST /admin/jobs/:id/albaranes');

        // ── La bandeja «pendientes de facturar»: la suma de los precios.
        const grupoDe = (txt) => JSON.parse(txt).clientes.flatMap((c) => c.grupos ?? []).find((g) => (g.albaranes ?? []).some((a) => a.id === alb.id));
        const gJ = grupoDe((await jefe.get('/admin/albaranes/pendientes-facturar')).text);
        assert.ok(gJ && gJ.importePotencial != null, 'control: el jefe ve el albarán firmado en «pendientes de facturar» con su importe');
        const gO = grupoDe((await op.get('/admin/albaranes/pendientes-facturar')).text);
        assert.ok(gO, 'control: el operario ve su albarán en «pendientes de facturar»');
        blando(() => assert.equal(gO.importePotencial, null, '🔴 «pendientes de facturar» le da al operario el importe'));

        assert.deepEqual(fallos, [], `\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });
