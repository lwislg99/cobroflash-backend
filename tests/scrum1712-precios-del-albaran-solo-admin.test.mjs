// tests/scrum1712-precios-del-albaran-solo-admin.test.mjs — SCRUM-1712 (PILOTO-1)
//
// 🔴 EL DEFECTO: un operario (rol `tecnico`) podía ESCRIBIR precios en un albarán por la API. El parte
// tiene su puerta por campo (`adminOnlyParteField`, SCRUM-1078); el albarán no tenía ninguna. Las dos
// puertas que escriben `lineas`/`modoValoracion` desde el cuerpo —`POST /admin/jobs/:id/albaranes` y
// `PATCH /admin/albaranes/:id`— dejaban al técnico:
//   · crear un albarán VALORADO con sus precios;
//   · valorar un borrador SIN_VALORAR (pasarlo a VALORADO con precios);
//   · cambiar los precios de un borrador VALORADO de la oficina;
//   · DESVALORARLO (pasarlo a SIN_VALORAR con líneas sin precio), que borra la valoración de la oficina.
//
// Regla: `roleCapabilities.adminOnlyAlbaranField` — para quien no `seesAllJobs`, un `modoValoracion`
// que no sea quedarse en SIN_VALORAR, o una línea con `precioUnitario`/`tipoIva`, rechaza la petición
// ENTERA con 403 `{error:'forbidden', required_role:'admin', field}` y no escribe nada (como SCRUM-1078).
//
// Dos mitades:
//   ① SIN BANCO: la regla (función pura) y su DECLARACIÓN como gate por campo.
//   ② CON BANCO (`LIBRO_PG_URL`, desechable; corre en el check obligatorio): por la ruta real, con
//      sesiones de verdad. Control positivo DOBLE: el admin SÍ escribe precios, y el técnico SIGUE
//      creando y editando su albarán sin precios (su día a día no se cierra).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

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

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

const { adminOnlyAlbaranField, seesAllJobs } = await import('../dist/core/http/roleCapabilities.js');
const { FIELD_LEVEL_ROLE_GATES } = await import('../dist/core/http/adminRouteDeclarations.js');

// Lo aplica el meta-guard (SCRUM-745). Todas caen en casos SIN banco: el de banco se salta en local y el
// meta-guard daría CIEGO. Con banco, las mismas tres de la ruta se midieron además por comportamiento
// (`docs/master/SCRUM-1712.md` ③).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/jobs/app/routes/albaranes.routes.ts',
    de: "const campoAdmin = adminOnlyAlbaranField(\n        { modoValoracion: req.body?.modoValoracion, lineas: req.body?.lineas },\n        albaran.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR',\n      );",
    a: 'const campoAdmin = null;',
    cae: 'SCRUM-1712 · el CABLEADO',
  },
  {
    fichero: 'src/modules/jobs/app/routes/albaranes.routes.ts',
    de: "lineas: req.body?.lineas },\n        albaran.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR',\n",
    a: 'lineas: req.body?.lineas },\n',
    cae: 'SCRUM-1712 · el CABLEADO',
  },
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: 'const campoAdmin = adminOnlyAlbaranField({ modoValoracion: req.body?.modoValoracion, lineas: req.body?.lineas });',
    a: 'const campoAdmin = null;',
    cae: 'SCRUM-1712 · el CABLEADO',
  },
  {
    fichero: 'src/core/http/roleCapabilities.ts',
    de: "&& (String(body.modoValoracion) !== 'SIN_VALORAR' || modoActual !== 'SIN_VALORAR')) {",
    a: ') {',
    cae: 'SCRUM-1712 · el día a día del técnico sigue libre',
  },
  {
    fichero: 'src/core/http/roleCapabilities.ts',
    de: " || modoActual !== 'SIN_VALORAR'",
    a: '',
    cae: 'SCRUM-1712 · la regla: DESVALORAR también es valorar',
  },
  {
    fichero: 'src/core/http/roleCapabilities.ts',
    de: "      if (presente((l as any).precioUnitario)) return 'precioUnitario';\n",
    a: '',
    cae: 'SCRUM-1712 · la regla: valorar es del admin',
  },
];

const SIN = { concepto: 'Cambio de grifo', cantidad: 1, unidad: 'ud' };
const CON = { ...SIN, precioUnitario: 40, tipoIva: 21 };

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① LA REGLA, SIN BANCO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1712 · la regla: valorar es del admin, y basta un campo para contaminar la petición', () => {
  assert.equal(adminOnlyAlbaranField({ modoValoracion: 'VALORADO' }), 'modoValoracion');
  assert.equal(adminOnlyAlbaranField({ lineas: [SIN, { ...SIN, precioUnitario: 5 }] }), 'precioUnitario', 'una sola línea con precio basta');
  assert.equal(adminOnlyAlbaranField({ lineas: [{ ...SIN, tipoIva: 21 }] }), 'tipoIva');
  assert.equal(adminOnlyAlbaranField({ lineas: [{ ...SIN, precioUnitario: 0 }] }), 'precioUnitario', 'un 0 es un precio');
  assert.equal(adminOnlyAlbaranField({ notas: 'ok', modoValoracion: 'VALORADO', lineas: [CON] }), 'modoValoracion', 'mezclado con lo legítimo también');
  // FAIL-CLOSED: un modo que no es SIN_VALORAR, aunque sea inválido, no lo decide el técnico.
  assert.equal(adminOnlyAlbaranField({ modoValoracion: 'valorado' }), 'modoValoracion');
  assert.equal(adminOnlyAlbaranField({ modoValoracion: null }), 'modoValoracion');
});

test('SCRUM-1712 · la regla: DESVALORAR también es valorar (borraría los precios de la oficina)', () => {
  assert.equal(adminOnlyAlbaranField({ modoValoracion: 'SIN_VALORAR', lineas: [SIN] }, 'VALORADO'), 'modoValoracion');
  assert.equal(adminOnlyAlbaranField({ modoValoracion: 'VALORADO' }, 'VALORADO'), 'modoValoracion', 'el técnico no reafirma el modo de un VALORADO');
});

test('SCRUM-1712 · el día a día del técnico sigue libre (lo que manda su pantalla al crear y editar sin precios)', () => {
  assert.equal(adminOnlyAlbaranField({ modoValoracion: 'SIN_VALORAR', lineas: [SIN], notas: 'hecho' }), null);
  assert.equal(adminOnlyAlbaranField({ modoValoracion: 'SIN_VALORAR', notas: 'x' }, 'SIN_VALORAR'), null);
  assert.equal(adminOnlyAlbaranField({ lineas: [{ ...SIN, precioUnitario: null, tipoIva: '' }] }), null, 'vacío no es precio (misma noción que validarLineas)');
  assert.equal(adminOnlyAlbaranField({ notas: 'el cliente no estaba', version: 3 }, 'VALORADO'), null, 'notas de un VALORADO: no toca el importe');
  assert.equal(adminOnlyAlbaranField({ ocultarPreciosEnDocumento: true }), null, 'qué imprime el papel no es escribir precios');
  for (const b of [null, undefined, 'x', 7, { lineas: 'no-array' }]) assert.equal(adminOnlyAlbaranField(b), null, `cuerpo ${JSON.stringify(b)}`);
});

test('SCRUM-1712 · control positivo de la frontera: el admin pasa por `seesAllJobs`, el técnico no', () => {
  assert.equal(seesAllJobs('admin'), true);
  assert.equal(seesAllJobs('tecnico'), false);
  assert.equal(seesAllJobs('comercial'), false, 'un rol desconocido cae del lado cerrado');
});

test('SCRUM-1712 · la regla está DECLARADA como gate por campo en las dos puertas', () => {
  for (const [method, p] of [['POST', '/admin/jobs/:id/albaranes'], ['PATCH', '/admin/albaranes/:id']]) {
    const d = FIELD_LEVEL_ROLE_GATES.find((g) => g.method === method && g.path === p);
    assert.ok(d, `falta la declaración de ${method} ${p}`);
    assert.deepEqual([...d.campos], ['modoValoracion', 'precioUnitario', 'tipoIva']);
  }
});

test('SCRUM-1712 · el CABLEADO: las dos puertas aplican la regla, con 403, a quien no ve todo (AST)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const ts = (await import('typescript')).default;
  const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const R = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes');
  const casos = [['jobs.routes.ts', 'post', '/:id/albaranes'], ['albaranes.routes.ts', 'patch', '/:id']];
  for (const [fichero, metodo, ruta] of casos) {
    const f = path.join(R, fichero);
    const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
    let handler = null;
    sf.forEachChild((n) => {
      if (!ts.isExpressionStatement(n) || !ts.isCallExpression(n.expression)) return;
      const c = n.expression;
      if (ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === metodo
        && ts.isStringLiteralLike(c.arguments[0]) && c.arguments[0].text === ruta) handler = c.arguments[c.arguments.length - 1];
    });
    assert.ok(handler, `población: no encuentro router.${metodo}("${ruta}") en ${fichero}`);
    let gate = null;
    (function anda(x) {
      if (ts.isIfStatement(x) && ts.isPrefixUnaryExpression(x.expression)
        && x.expression.operator === ts.SyntaxKind.ExclamationToken
        && ts.isCallExpression(x.expression.operand) && x.expression.operand.expression.getText() === 'seesAllJobs'
        && /status\(403\)/.test(x.thenStatement.getText())) {
        (function busca(y) {
          if (ts.isCallExpression(y) && y.expression.getText() === 'adminOnlyAlbaranField') gate = y;
          y.forEachChild(busca);
        })(x.thenStatement);
      }
      x.forEachChild(anda);
    })(handler);
    assert.ok(gate, `🔴 ${fichero} ${metodo.toUpperCase()} ${ruta}: no rechaza con 403 los precios a quien no ve todo`);
    // En el PATCH la regla va contra el modo ACTUAL del albarán: sin él, desvalorar deja de contar.
    if (metodo === 'patch') {
      assert.equal(gate.arguments.length, 2, '🔴 el PATCH no pasa el modo actual del albarán: desvalorar un VALORADO pasaría');
      assert.match(gate.arguments[1].getText(), /albaran\.modoValoracion/, '🔴 el segundo argumento no sale del albarán');
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② POR LA RUTA REAL, CON BANCO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1712 · 🔴 CON BASE: el técnico no escribe precios por ninguna de las dos puertas; el admin sí; su albarán sin precios sigue',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 1712', email: `qa-1712-${stamp}@test.local` }, async (m) => {
        const operario = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Operario 1712', email: `qa-1712-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const jefa = await prisma.teamMember.create({
          data: { merchantId: m.id, name: 'Jefa 1712', email: `qa-1712-jefa-${stamp}@test.local`, role: 'admin', status: 'active' },
        });
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 1712' } });
        const job = await prisma.job.create({
          data: { merchantId: m.id, customerId: cliente.id, titulo: 'Trabajo 1712', assignedUserId: operario.id },
        });

        const sesion = async (teamMemberId) => {
          const token = 'qa1712-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const v = await pedir(`${base}/auth/verify?token=${token}`);
          const c = String([].concat(v.headers['set-cookie'] || [])[0] || '').split(';')[0];
          assert.ok(c.startsWith('pf_session='), 'control: no se obtuvo la cookie de sesión');
          return c;
        };
        const [cOp, cJefa] = [await sesion(operario.id), await sesion(jefa.id)];
        const escribir = (cookie, metodo, ruta, cuerpo) => pedir(`${base}${ruta}`, {
          method: metodo, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
        });
        const leerFila = (id) => prisma.albaran.findUnique({ where: { id }, select: { modoValoracion: true, lineas: true, version: true } });
        const cuantos = () => prisma.albaran.count({ where: { jobId: job.id } });

        const fallos = [];
        const blando = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
        const esperaPuerta = (r, campo, caso) => {
          blando(() => assert.equal(r.status, 403, `🔴 ${caso}: ${r.status} ${r.text.slice(0, 160)}`));
          if (r.status === 403) {
            const j = JSON.parse(r.text);
            blando(() => assert.deepEqual(j, { error: 'forbidden', required_role: 'admin', field: campo }, `🔴 ${caso}: cuerpo del 403`));
          }
        };

        // ── CONTROL POSITIVO del admin: crea un VALORADO con precio y un SIN_VALORAR (los usará el técnico).
        const aVal = await escribir(cJefa, 'POST', `/admin/jobs/${job.id}/albaranes`, { modoValoracion: 'VALORADO', lineas: [CON] });
        assert.equal(aVal.status, 201, `control: la jefa crea un VALORADO con precios (${aVal.status} ${aVal.text.slice(0, 200)})`);
        const valorado = JSON.parse(aVal.text);
        const aSin = await escribir(cJefa, 'POST', `/admin/jobs/${job.id}/albaranes`, { modoValoracion: 'SIN_VALORAR', lineas: [SIN] });
        assert.equal(aSin.status, 201, `control: la jefa crea un SIN_VALORAR (${aSin.status})`);
        const sinValorar = JSON.parse(aSin.text);
        const idVal = valorado.id ?? valorado.albaran?.id;
        const idSin = sinValorar.id ?? sinValorar.albaran?.id;
        assert.ok(Number.isInteger(idVal) && Number.isInteger(idSin), 'control: el alta devuelve el id');

        // ── EL TÉCNICO, por el POST.
        const antes = await cuantos();
        esperaPuerta(await escribir(cOp, 'POST', `/admin/jobs/${job.id}/albaranes`, { modoValoracion: 'VALORADO', lineas: [CON] }),
          'modoValoracion', 'POST VALORADO con precios');
        esperaPuerta(await escribir(cOp, 'POST', `/admin/jobs/${job.id}/albaranes`, { lineas: [CON] }),
          'precioUnitario', 'POST con una línea con precio');
        assert.equal(antes, 2, 'población: los dos albaranes de la jefa');
        const despues = await cuantos();
        blando(() => assert.equal(despues, antes, `🔴 el técnico creó ${despues - antes} albarán(es) con precio`));

        // ── EL TÉCNICO, por el PATCH: valorar el SIN_VALORAR.
        const fSin0 = await leerFila(idSin);
        esperaPuerta(await escribir(cOp, 'PATCH', `/admin/albaranes/${idSin}`, { version: fSin0.version, modoValoracion: 'VALORADO', lineas: [CON] }),
          'modoValoracion', 'PATCH valorar un SIN_VALORAR');
        const fSin1 = await leerFila(idSin);
        blando(() => assert.equal(fSin1.modoValoracion, 'SIN_VALORAR', '🔴 el técnico VALORÓ el albarán'));

        // ── cambiar el precio de la oficina.
        const fVal0 = await leerFila(idVal);
        esperaPuerta(await escribir(cOp, 'PATCH', `/admin/albaranes/${idVal}`, { version: fVal0.version, lineas: [{ ...CON, precioUnitario: 1 }] }),
          'precioUnitario', 'PATCH cambiar el precio de un VALORADO');
        const fValA = await leerFila(idVal);
        blando(() => assert.equal(fValA.lineas?.[0]?.precioUnitario, 40, `🔴 el precio de la oficina cambió a ${fValA.lineas?.[0]?.precioUnitario}`));
        // ── desvalorar: SIN_VALORAR con líneas sin precio (hoy borraba la valoración). Con la versión
        // QUE HAYA AHORA: si el intento anterior escribió, éste no debe caer en el 409 de versión.
        esperaPuerta(await escribir(cOp, 'PATCH', `/admin/albaranes/${idVal}`, { version: fValA.version, modoValoracion: 'SIN_VALORAR', lineas: [SIN] }),
          'modoValoracion', 'PATCH desvalorar un VALORADO');
        const fVal1 = await leerFila(idVal);
        blando(() => assert.equal(fVal1.modoValoracion, 'VALORADO', '🔴 el técnico DESVALORÓ el albarán de la oficina'));
        blando(() => assert.equal(fVal1.version, fVal0.version, '🔴 el VALORADO cambió de versión: algo se escribió'));

        // ── CONTROL POSITIVO del técnico: su día a día sin precios sigue (lo que manda su pantalla).
        const tSin = await escribir(cOp, 'POST', `/admin/jobs/${job.id}/albaranes`, { modoValoracion: 'SIN_VALORAR', lineas: [SIN], notas: 'hecho' });
        blando(() => assert.equal(tSin.status, 201, `🔴 control: el técnico ya no puede crear su albarán SIN precios (${tSin.status} ${tSin.text.slice(0, 160)})`));
        const fSin2 = await leerFila(idSin);
        const tPatch = await escribir(cOp, 'PATCH', `/admin/albaranes/${idSin}`, { version: fSin2.version, modoValoracion: 'SIN_VALORAR', lineas: [SIN, { ...SIN, concepto: 'Junta' }], notas: 'añadida la junta' });
        blando(() => assert.equal(tPatch.status, 200, `🔴 control: el técnico ya no puede editar su albarán SIN precios (${tPatch.status} ${tPatch.text.slice(0, 160)})`));

        // ── CONTROL POSITIVO del admin por el PATCH: SÍ cambia el precio.
        const fVal2 = await leerFila(idVal);
        const jPatch = await escribir(cJefa, 'PATCH', `/admin/albaranes/${idVal}`, { version: fVal2.version, lineas: [{ ...CON, precioUnitario: 55 }] });
        blando(() => assert.equal(jPatch.status, 200, `🔴 control: la jefa ya no puede cambiar el precio (${jPatch.status})`));
        const fVal3 = await leerFila(idVal);
        blando(() => assert.equal(fVal3.lineas?.[0]?.precioUnitario, 55, 'control: el precio de la jefa se guardó'));

        assert.deepEqual(fallos, [], `\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });
