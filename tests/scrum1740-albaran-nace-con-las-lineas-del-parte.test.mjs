// SCRUM-1740 · EL ALBARÁN QUE NACE DE UN TRABAJO CON PARTE FIRMADO TRAE LAS LÍNEAS DEL PARTE.
//
// Forma decidida en SCRUM-1740 c.21982 (delegación general del fundador, SCRUM-1656 c.21978):
//   · al crear un albarán desde un trabajo cuyo ÚLTIMO parte está FIRMADO, el borrador nace
//     PRE-CARGADO con las líneas de ese parte: concepto y cantidad, SIN precios (nace sin valorar);
//   · las líneas son editables en el borrador;
//   · sin parte firmado, todo como hoy (albarán vacío);
//   · nada se escribe en el parte; sin esquema; sin textos;
//   · la misma puerta por rol que ya tiene el alta.
//
// ① SIN BANCO: la traducción línea de parte → línea de albarán (pura). Control: CERO precios.
// ② CON BANCO (LIBRO_PG_URL desechable, o QA_DB_TEST=1): por la RUTA real con sesiones de jefa,
//    técnico asignado y técnico ajeno.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// `node:http` sin agente y no `fetch` (SCRUM-1218d).
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

// Las líneas del parte, tal y como las guarda `ParteTrabajo.lineas`, CON precios de oficina puestos:
// son el control de que ningún precio viaja al albarán.
const LINEAS_PARTE = [
  { id: 'l1', bloque: 'mano_obra', unds: 1.5, descripcion: 'Mano de obra fontanero', precioUnitario: 38, tipoIva: 21 },
  { id: 'l2', bloque: 'materiales', unds: 2, descripcion: '  Latiguillo 30 cm  ', precioUnitario: 4.75, tipoIva: 21 },
  { id: 'l3', bloque: 'materiales', unds: 1, descripcion: 'Grifo monomando', precioUnitario: null, tipoIva: null },
];
const ESPERADAS = [
  { concepto: 'Mano de obra fontanero', cantidad: 1.5, unidad: '' },
  { concepto: 'Latiguillo 30 cm', cantidad: 2, unidad: '' },
  { concepto: 'Grifo monomando', cantidad: 1, unidad: '' },
];
const CLAVES_DE_PRECIO = ['precioUnitario', 'tipoIva', 'importe', 'precio', 'total'];
const sinPrecios = (lineas) => (lineas || []).every((l) => CLAVES_DE_PRECIO.every((k) => !(k in l)));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① SIN BANCO · la traducción
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const PARTE = (estado, lineas = LINEAS_PARTE) => ({ id: 22, numero: 'PT-2026-014', estado, lineas });

test('SCRUM-1740 ① · 🔴 las líneas del parte FIRMADO pasan al albarán con concepto y cantidad, en su orden y SIN precios', async () => {
  const { precargaDelParte } = await import('../dist/modules/jobs/domain/albaranDesdeParte.js');
  const r = precargaDelParte(PARTE('firmado'));
  assert.deepEqual(r.lineas, ESPERADAS, '🔴 concepto (= descripción), cantidad (= unds), unidad vacía, en el orden del parte');
  assert.equal(r.omitidas, 0);
  assert.equal(r.parteId, 22);
  assert.equal(r.numero, 'PT-2026-014');
  assert.ok(sinPrecios(r.lineas), '🔴 control: ningún precio ni IVA del parte viaja al albarán');
});

test('SCRUM-1740 ① · 🔴 sin parte, o con el último en borrador o facturado, no hay precarga (vacío, como hoy)', async () => {
  const { precargaDelParte } = await import('../dist/modules/jobs/domain/albaranDesdeParte.js');
  assert.equal(precargaDelParte(null), null, 'sin parte');
  for (const estado of ['borrador', 'facturado', 'otro']) {
    assert.equal(precargaDelParte(PARTE(estado)), null, `🔴 último parte en «${estado}»`);
  }
});

test('SCRUM-1740 ① · una línea del parte que no cabe en un albarán no rompe la precarga: se omite y se CUENTA', async () => {
  const { precargaDelParte } = await import('../dist/modules/jobs/domain/albaranDesdeParte.js');
  const lineasDelParteParaAlbaran = (lineas) => {
    const p = precargaDelParte({ id: 22, numero: 'PT-2026-014', estado: 'firmado', lineas });
    return { lineas: p.lineas, omitidas: p.omitidas };
  };
  const r = lineasDelParteParaAlbaran([
    LINEAS_PARTE[0],
    { bloque: 'materiales', unds: 0, descripcion: 'Cero unidades' },
    { bloque: 'materiales', unds: 3, descripcion: '   ' },
    { bloque: 'materiales', unds: 'x', descripcion: 'Ilegible' },
    LINEAS_PARTE[2],
  ]);
  assert.deepEqual(r.lineas, [ESPERADAS[0], ESPERADAS[2]]);
  assert.equal(r.omitidas, 3, 'lo omitido no pasa en silencio: se cuenta');
  // Lo que no es una lista no precarga nada (y tampoco revienta).
  for (const raro of [null, undefined, {}, 'texto', 7]) {
    assert.deepEqual(lineasDelParteParaAlbaran(raro), { lineas: [], omitidas: 0 }, `entrada ${JSON.stringify(raro)}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② CON BANCO · por la ruta real
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1740 ② · 🔴 POST /admin/jobs/:id/albaranes: con parte firmado nace con sus líneas y sin precios; sin parte firmado, vacío; tras la puerta por rol',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1740', email: `qa-1740-${stamp}@test.local` }, async (m) => {
        const tecnico = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1740', email: `qa-1740-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const ajeno = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Otro operario 1740', email: `qa-1740-otro-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const jefa = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Jefa 1740', email: `qa-1740-jefa-${stamp}@test.local`, role: 'admin', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1740' } });
        const trabajo = async (titulo) => {
          const j = await prisma.job.create({ data: { merchantId: m.id, customerId: cliente.id, titulo } });
          await prisma.jobAssignee.create({ data: { jobId: j.id, teamMemberId: tecnico.id } });
          return j;
        };
        let n = 0;
        const parte = (jobId, estado, lineas = LINEAS_PARTE) => prisma.parteTrabajo.create({
          data: {
            merchantId: m.id, customerId: cliente.id, jobId, numero: `PT-1740-${++n}-${stamp}`,
            fecha: new Date('2026-11-17T08:00:00Z'), lineas, estado,
            ...(estado === 'firmado' ? { firmadoAt: new Date(), firmadoPorNombre: 'Cliente 1740' } : {}),
          },
        });

        const conFirmado = await trabajo('Con parte firmado');
        const pFirmado = await parte(conFirmado.id, 'firmado');
        const conBorrador = await trabajo('Con parte en borrador');
        await parte(conBorrador.id, 'borrador');
        const sinParte = await trabajo('Sin parte');
        const ultimoBorrador = await trabajo('Firmado y después otro en borrador');
        await parte(ultimoBorrador.id, 'firmado');
        await parte(ultimoBorrador.id, 'borrador', [{ bloque: 'materiales', unds: 9, descripcion: 'Del borrador' }]);
        const filaParteAntes = await prisma.parteTrabajo.findUnique({ where: { id: pFirmado.id } });

        const sesion = async (teamMemberId) => {
          const token = 'qa1740-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const v = await pedir(`${base}/auth/verify?token=${token}`);
          const c = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
          assert.ok(c.startsWith('pf_session='), 'control: no se obtuvo la cookie de sesión');
          return c;
        };
        const [cTec, cAjeno, cJefa] = [await sesion(tecnico.id), await sesion(ajeno.id), await sesion(jefa.id)];
        const escribir = (cookie, metodo, ruta, cuerpo) => pedir(`${base}${ruta}`, {
          method: metodo, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
        });
        const crear = (cookie, job, cuerpo = {}) => escribir(cookie, 'POST', `/admin/jobs/${job.id}/albaranes`, cuerpo);
        const fila = (id) => prisma.albaran.findUnique({ where: { id }, select: { lineas: true, modoValoracion: true, version: true, estado: true } });

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
        const creado = (r, caso) => {
          assert.equal(r.status, 201, `control: ${caso} crea el albarán (${r.status} ${r.text.slice(0, 200)})`);
          return JSON.parse(r.text);
        };

        // ① EL TÉCNICO, en obra, sobre el trabajo con parte firmado: nace con las líneas del parte.
        const a1 = creado(await crear(cTec, conFirmado), 'el técnico asignado');
        const f1 = await fila(a1.id);
        blando(() => assert.deepEqual(f1.lineas, ESPERADAS, '🔴 ① el borrador del técnico nace con las líneas del parte firmado'));
        blando(() => assert.deepEqual(a1.lineas, ESPERADAS, '🔴 ① la respuesta trae esas líneas'));
        blando(() => assert.equal(f1.modoValoracion, 'SIN_VALORAR', '🔴 ① nace sin valorar'));
        blando(() => assert.equal(f1.estado, 'borrador', '① nace en borrador'));
        // CONTROL: cero precios, ni en la fila ni en la respuesta.
        blando(() => assert.ok(sinPrecios(f1.lineas), '🔴 ① control: ningún precio del parte en la fila del albarán'));
        blando(() => assert.ok(sinPrecios(a1.lineas), '🔴 ① control: ningún precio del parte en la respuesta'));
        blando(() => assert.ok(!a1.lineas || !JSON.stringify(a1.lineas).includes('38'), '🔴 ① control: el 38 € de la oficina no viaja'));
        blando(() => assert.deepEqual(a1.precargaDelParte, { parteId: pFirmado.id, numero: pFirmado.numero, lineas: 3, omitidas: 0 },
          '① la respuesta dice de qué parte salieron las líneas'));

        // ② LA JEFA, mismo trabajo: también nace precargado (sin valorar, sin precios).
        const a2 = creado(await crear(cJefa, conFirmado), 'la jefa');
        const f2 = await fila(a2.id);
        blando(() => assert.deepEqual(f2.lineas, ESPERADAS, '🔴 ② el borrador de la jefa nace con las líneas del parte'));
        blando(() => assert.ok(sinPrecios(f2.lineas), '🔴 ② control: sin precios también para la jefa'));

        // ③ SIN PARTE FIRMADO: vacío, como hoy — con parte en borrador, sin parte, y con el último en borrador.
        for (const [job, caso] of [[conBorrador, 'parte en borrador'], [sinParte, 'sin parte'], [ultimoBorrador, 'el último parte en borrador']]) {
          const a = creado(await crear(cTec, job), `el técnico (${caso})`);
          const f = await fila(a.id);
          blando(() => assert.deepEqual(f.lineas, [], `🔴 ③ ${caso}: el albarán nace vacío, como hoy`));
          blando(() => assert.equal(a.precargaDelParte, null, `③ ${caso}: no dice que precargó`));
        }

        // ④ QUIEN MANDA LÍNEAS, MANDA: unas `lineas` explícitas (aunque vacías) no se pisan con el parte.
        const a4 = creado(await crear(cTec, conFirmado, { lineas: [] }), 'el técnico con lineas: []');
        blando(() => assert.deepEqual(a4.lineas, [], '🔴 ④ lineas: [] explícito no se rellena con el parte'));
        const a4b = creado(await crear(cTec, conFirmado, { lineas: [{ concepto: 'Mía', cantidad: 1, unidad: 'ud' }] }), 'el técnico con su línea');
        blando(() => assert.deepEqual(a4b.lineas, [{ concepto: 'Mía', cantidad: 1, unidad: 'ud' }], '🔴 ④ sus líneas, no las del parte'));

        // ⑤ EDITABLE: el borrador precargado se cambia con el PATCH de siempre.
        const editadas = [ESPERADAS[0], { ...ESPERADAS[1], cantidad: 1 }];
        const r5 = await escribir(cTec, 'PATCH', `/admin/albaranes/${a1.id}`, { version: f1.version, lineas: editadas });
        blando(() => assert.equal(r5.status, 200, `🔴 ⑤ el técnico edita el borrador precargado (${r5.status} ${r5.text.slice(0, 160)})`));
        const f5 = await fila(a1.id);
        blando(() => assert.deepEqual(f5.lineas, editadas, '🔴 ⑤ quedan las líneas editadas'));

        // ⑥ LA PUERTA POR ROL: el técnico ajeno no crea en ese trabajo, y no se lleva las líneas.
        const antes = await prisma.albaran.count({ where: { jobId: conFirmado.id } });
        // Control positivo de la negación de abajo: al técnico ASIGNADO la línea sí le llegó (①).
        blando(() => assert.ok(JSON.stringify(a1).includes('Latiguillo'), 'control: el asignado sí recibió «Latiguillo»'));
        const r6 = await crear(cAjeno, conFirmado);
        blando(() => assert.equal(r6.status, 404, `🔴 ⑥ el técnico ajeno recibe 404 (${r6.status})`));
        blando(() => assert.ok(!r6.text.includes('Latiguillo'), '🔴 ⑥ las líneas del parte no viajan al ajeno'));
        const despues = await prisma.albaran.count({ where: { jobId: conFirmado.id } });
        blando(() => assert.equal(despues, antes, '🔴 ⑥ no se creó nada'));

        // ⑦ NADA SE ESCRIBE EN EL PARTE.
        const filaParteDespues = await prisma.parteTrabajo.findUnique({ where: { id: pFirmado.id } });
        blando(() => assert.deepEqual(filaParteDespues, filaParteAntes, '🔴 ⑦ la fila del parte queda idéntica'));

        assert.deepEqual(fallos, [], `🔴 ${fallos.length} fallo(s):\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.closeAllConnections?.();
      server.close();
      try { await prisma.$disconnect(); } catch { /* nada que cerrar */ }
    }
  });
