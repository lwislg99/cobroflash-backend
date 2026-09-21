// SCRUM-992 · UN TÉCNICO NO VE, NO EDITA Y NO FIRMA LOS PARTES DE OTRO TÉCNICO.
//
// `GET /admin/partes` era `findMany({merchantId})` y todo `:id` pasaba por `findParte`, que solo miraba
// el merchant: un técnico listaba los partes de toda la empresa y abría, editaba y firmaba el de una
// obra ajena. Es el mismo olvido que SCRUM-301/467 cerraron en los albaranes (lectura) y SCRUM-849 en
// sus escrituras. Decisión del orquestador: los TRES ejes de «es suyo» (`operarioId`, `assignedUserId`,
// tabla de asignados) y NINGÚN parte suelto para el técnico — no hay a quién atribuirlo.
//
// Dos mitades:
//   · la RED ESTRUCTURAL, por AST y sin banco: corre en cada `npm test` y no deja que una ruta nueva de
//     partes lea `parteTrabajo` sin mirar el rol;
//   · el COMPORTAMIENTO, contra Postgres de verdad (`LIBRO_PG_URL`, o `QA_DB_TEST=1`): la app real, tres
//     sesiones (dos técnicos y el propietario) y las nueve rutas.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'partes.routes.ts');

// ── LA RED ESTRUCTURAL ────────────────────────────────────────────────────────────────────
// POBLACIÓN DECLARADA: los `router.<verbo>(…)` de UN fichero (`partes.routes.ts`). Son nueve hoy; si el
// censo ve menos, no ha mirado (SUELO), y si ve más, alguien añadió una ruta y tiene que decidir aquí.
const HANDLERS_ESPERADOS = 9;

function censo() {
  const src = fs.readFileSync(RUTAS, 'utf8');
  const sf = ts.createSourceFile(RUTAS, src, ts.ScriptTarget.Latest, true);
  const nombreDe = (n) => (ts.isIdentifier(n) ? n.text : null);
  const rutas = [];
  let findParteNode = null;
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'findParte') findParteNode = n;
    if (!ts.isExpressionStatement(n) || !ts.isCallExpression(n.expression)) return;
    const c = n.expression;
    if (!ts.isPropertyAccessExpression(c.expression) || nombreDe(c.expression.expression) !== 'router') return;
    const verbo = c.expression.name.text;
    if (!['get', 'post', 'patch', 'put', 'delete'].includes(verbo)) return;
    const ruta = ts.isStringLiteralLike(c.arguments[0]) ? c.arguments[0].text : '?';
    const soloAdmin = c.arguments.slice(1, -1).some((a) =>
      ts.isCallExpression(a) && nombreDe(a.expression) === 'requireRole'
      && a.arguments.some((x) => ts.isStringLiteralLike(x) && x.text === 'admin'));
    rutas.push({ verbo, ruta, soloAdmin, cuerpo: c.arguments[c.arguments.length - 1] });
  });
  const miraElRol = (nodo) => {
    let si = false;
    (function anda(x) { if (ts.isIdentifier(x) && x.text === 'seesOnlyOwnJobs') si = true; x.forEachChild(anda); })(nodo);
    return si;
  };
  const llama = (nodo, nombre) => {
    let si = false;
    (function anda(x) {
      if (ts.isCallExpression(x) && nombreDe(x.expression) === nombre) si = true;
      x.forEachChild(anda);
    })(nodo);
    return si;
  };
  // Lecturas DIRECTAS de la tabla (`prisma.parteTrabajo.findMany`, `tx.parteTrabajo.findFirst`…).
  const leeDirecto = (nodo) => {
    let si = false;
    (function anda(x) {
      if (ts.isPropertyAccessExpression(x) && /^(find\w*|count|aggregate|groupBy)$/.test(x.name.text)
        && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === 'parteTrabajo') si = true;
      x.forEachChild(anda);
    })(nodo);
    return si;
  };
  return { rutas, findParteNode, miraElRol, llama, leeDirecto };
}

test('SCRUM-992 · la población: el censo ve las nueve rutas de partes (y sabe leerlas)', () => {
  const { rutas, findParteNode } = censo();
  assert.equal(rutas.length, HANDLERS_ESPERADOS,
    `el censo ve ${rutas.length} rutas y esperaba ${HANDLERS_ESPERADOS}: o no ha mirado, o hay una ruta nueva de partes — decide aquí su rol`);
  assert.ok(findParteNode, 'no se encontró `findParte`');
  // Control positivo: el instrumento ve lo que SABEMOS que hay.
  assert.ok(rutas.some((r) => r.verbo === 'get' && r.ruta === '/'), 'no ve `GET /`');
  assert.equal(rutas.filter((r) => r.soloAdmin).length, 2, 'las dos rutas de oficina son de admin');
});

test('SCRUM-992 · `findParte` mira el rol y la pertenencia (los tres ejes viven en `esSuyoElTrabajo`)', () => {
  const { findParteNode, miraElRol, llama } = censo();
  assert.ok(miraElRol(findParteNode), '🔴 `findParte` no pregunta por el rol: el técnico abre el parte que sea');
  assert.ok(llama(findParteNode, 'esSuyoElTrabajo'), '🔴 `findParte` no comprueba de quién es el trabajo');
});

test('SCRUM-992 · toda ruta de partes que no es de admin o pasa por `findParte`, o lee la tabla mirando el rol', () => {
  const { rutas, miraElRol, llama, leeDirecto } = censo();
  const culpables = [];
  for (const r of rutas) {
    if (r.soloAdmin) continue; // la puerta de admin ya recorta por rol
    const id = r.ruta.includes(':id');
    if (id && !llama(r.cuerpo, 'findParte')) culpables.push(`${r.verbo.toUpperCase()} ${r.ruta}: va por :id sin pasar por findParte`);
    if (leeDirecto(r.cuerpo) && !miraElRol(r.cuerpo)) culpables.push(`${r.verbo.toUpperCase()} ${r.ruta}: lee partes sin mirar el rol`);
  }
  assert.deepEqual(culpables, [], `🔴 rutas de partes que el técnico puede usar sobre partes ajenas:\n  ${culpables.join('\n  ')}`);
});

// ── EL COMPORTAMIENTO ─────────────────────────────────────────────────────────────────────
const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

const FIRMA = 'data:image/png;base64,iVBORw0KGgo=';
const LINEAS = [{ bloque: 'mano_obra', unds: 1, descripcion: 'Cambio de grifo' }];

test('SCRUM-992 · el técnico ve, edita y firma SOLO los partes de sus trabajos (tres ejes) y ninguno suelto',
  { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { app } = await import('../dist/app.js');
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const stamp = Date.now();
    try {
      await withMerchant(prisma, { name: 'QA 992', email: `qa-992-${stamp}@test.local` }, async (m) => {
        const tec = (tag) => prisma.teamMember.create({
          data: { merchantId: m.id, name: `Técnico ${tag}`, email: `tec-992-${tag}-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const tecA = await tec('A');
        const tecB = await tec('B');
        const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente 992' } });
        const job = (titulo, extra = {}) => prisma.job.create({
          data: { merchantId: m.id, customerId: cliente.id, status: 'en_curso', titulo, ...extra },
        });
        // Los tres ejes de tecA, uno por trabajo: autoría, ejecutor y tabla de asignados.
        const jEje1 = await job('Eje 1 · operarioId', { operarioId: tecA.id });
        const jEje2 = await job('Eje 2 · assignedUserId', { assignedUserId: tecA.id });
        const jEje3 = await job('Eje 3 · assignees');
        await prisma.jobAssignee.create({ data: { jobId: jEje3.id, teamMemberId: tecA.id } });
        const jDeB = await job('De B', { operarioId: tecB.id, assignedUserId: tecB.id });
        const jDeNadie = await job('De nadie'); // sin operario, sin ejecutor, sin asignados

        let n = 0;
        const parte = (jobId, extra = {}) => prisma.parteTrabajo.create({
          data: {
            merchantId: m.id, jobId, customerId: cliente.id, numero: `T992-${++n}`, fecha: new Date(),
            lineas: LINEAS, tecnicos: [], estado: 'borrador', ...extra,
          },
        });
        const pEje1 = await parte(jEje1.id);
        const pEje2 = await parte(jEje2.id);
        const pEje3 = await parte(jEje3.id);
        const pDeB = await parte(jDeB.id, { notas: 'de B' });
        const pDeNadie = await parte(jDeNadie.id, { notas: 'de nadie' });
        const pSuelto = await parte(null, { notas: 'suelto' });
        const suyos = [pEje1.id, pEje2.id, pEje3.id];
        const ajenos = [pDeB.id, pDeNadie.id, pSuelto.id];

        const mkCookie = async (teamMemberId) => {
          const token = 'qa992-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: m.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
          const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
          assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
          return cookie;
        };
        const cookieA = await mkCookie(tecA.id);
        const cookieAdmin = await mkCookie(null); // propietario = admin implícito
        const llamar = (cookie, metodo, ruta, cuerpo) => fetch(`${base}${ruta}`, {
          method: metodo,
          headers: { cookie, 'content-type': 'application/json' },
          ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
        });
        const idsDe = async (cookie) => (await (await llamar(cookie, 'GET', '/admin/partes')).json()).partes.map((p) => p.id).sort((a, b) => a - b);
        const estado = async (id) => prisma.parteTrabajo.findUnique({ where: { id } });

        // Las comprobaciones de FUGA (🔴) son BLANDAS: un rojo tiene que enseñar TODOS los agujeros de
        // una vez, no solo el primero. Los CONTROLES (que el propietario y el técnico siguen pudiendo lo
        // suyo) son duros: si caen, el fixture no ejercita nada y lo demás no vale.
        const fallos = [];
        const fuga = (fn) => { try { fn(); } catch (e) { fallos.push(String(e.message).split('\n')[0]); } };
        const ordenados = (l) => [...l].sort((a, b) => a - b);

        // ── LEER: la lista ────────────────────────────────────────────────────────────────
        assert.deepEqual(await idsDe(cookieAdmin), ordenados([...suyos, ...ajenos]),
          'control: el propietario sigue viéndolo TODO (si esto cae, el fixture no ejercita nada)');
        const listaDeA = await idsDe(cookieA);
        fuga(() => assert.deepEqual(listaDeA, ordenados(suyos),
          '🔴 lista del técnico A: solo los partes de sus trabajos por los TRES ejes, y ninguno de B, de nadie ni suelto'));

        // ── LEER: el detalle ──────────────────────────────────────────────────────────────
        for (const id of suyos) {
          assert.equal((await llamar(cookieA, 'GET', `/admin/partes/${id}`)).status, 200, `A debe abrir su parte ${id}`);
        }
        for (const id of ajenos) {
          const r = await llamar(cookieA, 'GET', `/admin/partes/${id}`);
          fuga(() => assert.equal(r.status, 404, `🔴 A abre el parte ajeno ${id}`));
          assert.equal((await llamar(cookieAdmin, 'GET', `/admin/partes/${id}`)).status, 200, `control: el propietario abre ${id}`);
        }

        // ── EDITAR ────────────────────────────────────────────────────────────────────────
        for (const id of ajenos) {
          const antes = (await estado(id)).notas;
          const r = await llamar(cookieA, 'PATCH', `/admin/partes/${id}`, { notas: 'pisado por A' });
          const despues = (await estado(id)).notas;
          fuga(() => assert.equal(r.status, 404, `🔴 A edita el parte ajeno ${id}`));
          fuga(() => assert.equal(despues, antes, `🔴 el PATCH de A escribió en el parte ajeno ${id}`));
        }
        assert.equal((await llamar(cookieA, 'PATCH', `/admin/partes/${pEje2.id}`, { notas: 'mío' })).status, 200);
        assert.equal((await estado(pEje2.id)).notas, 'mío');

        // ── FIRMAR (las dos firmas) y DICTAR ─────────────────────────────────────────────
        for (const id of ajenos) {
          const rt = await llamar(cookieA, 'POST', `/admin/partes/${id}/firmar-tecnico`, { signatureData: FIRMA, firmadoTecnicoNombre: 'Técnico A' });
          const rc = await llamar(cookieA, 'POST', `/admin/partes/${id}/firmar`, { signatureData: FIRMA, firmadoPorNombre: 'Ana Pérez' });
          const rd = await llamar(cookieA, 'POST', `/admin/partes/${id}/dictado`, { dictado: 'cambié un grifo' });
          const despues = await estado(id);
          fuga(() => assert.equal(rt.status, 404, `🔴 A firma como técnico el parte ajeno ${id}`));
          fuga(() => assert.equal(rc.status, 404, `🔴 A firma por el cliente el parte ajeno ${id}`));
          fuga(() => assert.equal(rd.status, 404, `🔴 A dicta sobre el parte ajeno ${id}`));
          fuga(() => assert.equal(despues.estado, 'borrador', `🔴 el parte ajeno ${id} quedó FIRMADO por A`));
        }
        const propia = await llamar(cookieA, 'POST', `/admin/partes/${pEje3.id}/firmar-tecnico`, { signatureData: FIRMA, firmadoTecnicoNombre: 'Técnico A' });
        assert.equal(propia.status, 200, 'control: A firma SU parte (eje 3, tabla de asignados)');
        assert.notEqual((await llamar(cookieA, 'POST', `/admin/partes/${pEje1.id}/dictado`, { dictado: 'cambié un grifo' })).status, 404, 'control: A dicta sobre el suyo');

        // ── CREAR ─────────────────────────────────────────────────────────────────────────
        const cuantos = () => prisma.parteTrabajo.count({ where: { merchantId: m.id } });
        const antes = await cuantos();
        const sobreAjeno = await llamar(cookieA, 'POST', '/admin/partes', { jobId: jDeB.id });
        const sobreNadie = await llamar(cookieA, 'POST', '/admin/partes', { jobId: jDeNadie.id });
        const suelto = await llamar(cookieA, 'POST', '/admin/partes', {});
        const cuerpoSuelto = await suelto.json().catch(() => ({}));
        const despuesDeAltas = await cuantos();
        fuga(() => assert.equal(sobreAjeno.status, 404, '🔴 A abre un parte colgado del trabajo de B'));
        fuga(() => assert.equal(sobreNadie.status, 404, '🔴 A abre un parte colgado de un trabajo sin dueño'));
        fuga(() => assert.equal(suelto.status, 400, '🔴 A abre un parte SIN trabajo: después no podría volver a abrirlo'));
        fuga(() => assert.equal(cuerpoSuelto.error, 'job_required', '🔴 el rechazo del parte suelto no dice `job_required`'));
        fuga(() => assert.equal(despuesDeAltas, antes, `🔴 las altas rechazadas dejaron ${despuesDeAltas - antes} fila(s)`));
        const propio = await llamar(cookieA, 'POST', '/admin/partes', { jobId: jEje1.id });
        assert.equal(propio.status, 201, 'control: A abre un parte de su trabajo');
        const creado = await propio.json();
        assert.equal((await llamar(cookieA, 'GET', `/admin/partes/${creado.id}`)).status, 200, 'control: y lo puede reabrir');
        assert.equal((await llamar(cookieAdmin, 'POST', '/admin/partes', {})).status, 201, 'control: el propietario SÍ puede abrir un parte suelto');

        assert.deepEqual(fallos, [], `🔴 ${fallos.length} fuga(s) del técnico A:\n  ${fallos.join('\n  ')}`);
      });
    } finally {
      server.closeAllConnections?.();
      server.close();
      await prisma.$disconnect().catch(() => {});
    }
  });
