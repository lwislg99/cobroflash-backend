// SCRUM-1397 · EL TÉCNICO VE SUS FACTURAS, Y SÓLO LAS SUYAS — lista, ficha y PDF, por UNA puerta.
//
// Qué se decidió (fundador, 1-oct-2026): el Técnico ve las facturas de las que es AUTOR, las de
// los TRABAJOS que son suyos y las que tiene ASIGNADAS COMO DOCUMENTO. La unión de las tres, no
// una de las tres (SCRUM-1346 c.17932 y c.17952; SCRUM-1390 c.17962 y c.17964). Y el motivo
// firmado: «mejor ser más laxo al principio y evitar errores».
//
// Por eso este fichero tiene DOS mitades y la que manda es la segunda:
//   · «ya no reconstruye»: el cálculo que hizo J2i el 1-oct (SCRUM-1346) —el total cobrado del
//     negocio y lo cobrado por un compañero, EXACTOS— tiene que dejar de salir;
//   · «sigue viendo lo suyo»: cada camino por el que una factura es suya tiene su caso CON SU
//     NOMBRE. Si la puerta se queda corta en uno, cae ese caso y dice cuál.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE HABLA POR HTTP CON LA APP REAL Y CONTRA PRISMA DE VERDAD
//
// `dist/app.js`, su `requireAuth` y sus rutas, con sesiones creadas en la base. No se saca ningún
// manejador de su ruta: un test que lo saca prueba el manejador, no la ruta. Y el `where` lo
// contesta Postgres, no un doble: la medición de J2i lo declaraba como su límite («el doble
// decide el where»).
//
// ⚠️ La base es el banco DESECHABLE (`LIBRO_PG_URL`: loopback y nombre acabado en `_test`), el
// que levanta el propio job del CI. Nace de `prisma/schema.prisma`, así que sirve para probar QUÉ
// HACE este `where`; no dice nada de cómo son los datos de ninguna cuenta real.
//
// Sin `LIBRO_PG_URL` los casos con base SALTAN diciendo por qué. La mitad sin base (abajo del
// todo) corre siempre: es la que avisa si las tres rutas dejan de pasar por la puerta.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import ts from 'typescript';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

// La conexión se suelta al acabar el fichero, no en cada caso: los dos comparten cliente.
after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

// ── Lo común a los casos con base ────────────────────────────────────────────────────────────

async function montar(app) {
  const server = http.createServer(app).listen(0);
  await new Promise((r) => server.once('listening', r));
  return { port: server.address().port, cerrar: () => new Promise((r) => server.close(r)) };
}

async function sesionDe(prisma, merchantId, teamMemberId) {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.authSession.create({
    data: { merchantId, teamMemberId, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) },
  });
  return token;
}

const pedir = async (port, token, ruta) => {
  const r = await fetch(`http://127.0.0.1:${port}${ruta}`, { headers: { cookie: `pf_session=${token}` } });
  const tipo = r.headers.get('content-type') || '';
  const cuerpo = tipo.includes('json') ? await r.json().catch(() => null) : (await r.arrayBuffer(), null);
  return { status: r.status, cuerpo, tipo };
};

/** Un negocio con dos Técnicos y una administradora. Devuelve los creadores que usan los casos. */
async function equipoDe(prisma, merchant, marca) {
  const miembro = (name, role) => prisma.teamMember.create({
    data: { merchantId: merchant.id, name, email: `qa1397-${marca}-${name.toLowerCase()}-${Date.now()}@test.local`, role, status: 'active' },
  });
  const ana = await miembro('Ana', 'tecnico');
  const blas = await miembro('Blas', 'tecnico');
  const jefa = await miembro('Jefa', 'admin');
  const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: `Cliente QA 1397 ${marca}` } });

  let n = 0;
  const presupuesto = (autorId, total, extra = {}) => prisma.quote.create({
    data: {
      merchantId: merchant.id, customerId: cliente.id, total: String(total), currency: 'EUR', lines: [],
      quoteNumber: ++n, status: 'accepted', teamMemberId: autorId, ...extra,
    },
  });
  const factura = (numero, total, extra = {}) => prisma.invoice.create({
    data: {
      merchantId: merchant.id, customerId: cliente.id, number: numero, total: String(total), currency: 'EUR',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING', status: 'pending', type: 'F1', quoteId: null,
      vfEstado: 'no_aplica', // el negocio sembrado no lleva NIF: sus documentos no entran en la cadena y el PDF sale
      ...extra,
    },
  });
  const trabajo = (extra = {}) => prisma.job.create({ data: { merchantId: merchant.id, customerId: cliente.id, ...extra } });
  const albaran = (jobId, numero, extra = {}) => prisma.albaran.create({
    data: { merchantId: merchant.id, jobId, numero, lineas: [], ...extra },
  });
  return { ana, blas, jefa, cliente, presupuesto, factura, trabajo, albaran };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① y ② · EL CÁLCULO DE J2i TIENE QUE DEJAR DE SALIR — con su mismo negocio y sus mismas cifras
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1397 · 🔴 un Técnico ya NO reconstruye el total cobrado del negocio ni lo cobrado por un compañero', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1397 negocio', email: `qa-1397-negocio-${Date.now()}@test.local` }, async (merchant) => {
    const e = await equipoDe(prisma, merchant, 'negocio');
    const ahora = new Date();

    // El negocio que fabricó J2i (docs/evidencias/scrum1341/sonda-otra-via.mjs.txt), fila a fila.
    const pAna = await e.presupuesto(e.ana.id, 100);
    const pBlas1 = await e.presupuesto(e.blas.id, 900);
    const pBlas2 = await e.presupuesto(e.blas.id, 400, { status: 'sent' });
    await e.presupuesto(null, 300);
    const fAna = await e.factura('A-1', 100, { quoteId: pAna.id, status: 'paid', paidAt: ahora });
    await e.factura('A-2', 900, { quoteId: pBlas1.id, status: 'paid', paidAt: ahora });
    await e.factura('A-3', 400, { quoteId: pBlas2.id });
    await e.factura('A-4', 50, { status: 'paid', paidAt: ahora });

    const { port, cerrar } = await montar(app);
    try {
      const tokenAna = await sesionDe(prisma, merchant.id, e.ana.id);
      const tokenJefa = await sesionDe(prisma, merchant.id, e.jefa.id);

      // El patrón: lo que el panel de administración dice, por su ruta real.
      const panel = await pedir(port, tokenJefa, '/admin/metrics/team');
      assert.equal(panel.status, 200, `el panel de admin no contesta (${panel.status}): sin patrón no hay nada que comparar`);
      const blasEnPanel = panel.cuerpo.members.find((m) => m.id === e.blas.id);
      // SUELO: si el patrón no dice 1.050 y 900, el negocio fabricado no es el de J2i y lo de abajo
      // compararía contra otra cosa.
      assert.equal(panel.cuerpo.totalCollected, 1050, 'SUELO: el panel tiene que decir 1.050 de total cobrado');
      assert.equal(blasEnPanel?.collected, 900, 'SUELO: el panel tiene que decir 900 cobrados por Blas');

      // El cálculo de J2i, tal cual: las dos listas que el Técnico tiene abiertas.
      const deBlas = await pedir(port, tokenAna, `/admin/quotes?teamMemberId=${e.blas.id}`);
      assert.equal(deBlas.status, 200);
      const idsDeBlas = new Set(deBlas.cuerpo.map((q) => q.id));
      // SUELO del cálculo: la otra mitad de la vía sigue abierta (no es de este ticket). Si un día
      // se cierra, este caso pasaría por la razón equivocada: que lo diga.
      assert.equal(idsDeBlas.size, 2, 'SUELO: la lista de presupuestos por autor ya no contesta; re-mide qué prueba este caso');

      const facturas = await pedir(port, tokenAna, '/admin/invoices');
      assert.equal(facturas.status, 200);
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const cobradas = facturas.cuerpo.filter((f) => f.status === 'paid' && f.paidAt && new Date(f.paidAt) >= inicioMes);
      const totalReconstruido = cobradas.reduce((a, f) => a + Number(f.total), 0);
      const blasReconstruido = cobradas.filter((f) => idsDeBlas.has(f.quoteId)).reduce((a, f) => a + Number(f.total), 0);

      assert.notEqual(totalReconstruido, panel.cuerpo.totalCollected,
        `🔴 el Técnico reconstruye el total cobrado del negocio EXACTO (${totalReconstruido} = ${panel.cuerpo.totalCollected}) sumando su lista de facturas`);
      assert.notEqual(blasReconstruido, blasEnPanel.collected,
        `🔴 el Técnico reconstruye lo cobrado por un compañero EXACTO (${blasReconstruido} = ${blasEnPanel.collected})`);

      // Y por qué deja de salir: en su lista está su factura y ninguna otra. Conjuntos, no cuentas.
      assert.deepEqual(facturas.cuerpo.map((f) => f.number), ['A-1'],
        '🔴 la lista de facturas de Ana no es exactamente «la suya»');
      assert.equal(facturas.cuerpo[0].id, fAna.id);
      // Lo que SÍ sigue pudiendo sumar es lo suyo: 100 de 1.050.
      assert.equal(totalReconstruido, 100);
      assert.equal(blasReconstruido, 0);
    } finally {
      await cerrar();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ · EL QUE MANDA: SIGUE VIENDO LO SUYO, POR CADA CAMINO — y ④ el admin, todo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1397 · ✅ el Técnico SIGUE viendo cada factura suya (autor · Trabajo · asignada), y sólo ésas; el admin las ve todas', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1397 ejes', email: `qa-1397-ejes-${Date.now()}@test.local` }, async (merchant) => {
    const e = await equipoDe(prisma, merchant, 'ejes');
    const ana = e.ana.id;
    const blas = e.blas.id;

    // ── SUYAS DE ANA. El número de la factura DICE por qué camino es suya. ──────────────────
    // 1 · autora del presupuesto, sin Trabajo todavía.
    const q1 = await e.presupuesto(ana, 10);
    await e.factura('SUYA-AUTORA', 10, { quoteId: q1.id });
    // 2 · el presupuesto es de la oficina; el Trabajo lo lleva ella por `operarioId`.
    const q2 = await e.presupuesto(null, 20);
    await e.trabajo({ quoteId: q2.id, operarioId: ana });
    await e.factura('SUYA-TRABAJO-OPERARIO', 20, { quoteId: q2.id });
    // 3 · se lo asignaron por la columna `assignedUserId`.
    const q3 = await e.presupuesto(null, 30);
    await e.trabajo({ quoteId: q3.id, assignedUserId: ana });
    await e.factura('SUYA-TRABAJO-ASIGNADO', 30, { quoteId: q3.id });
    // 4 · se lo asignaron por la TABLA de asignados y no por la columna.
    const q4 = await e.presupuesto(null, 40);
    const j4 = await e.trabajo({ quoteId: q4.id });
    await prisma.jobAssignee.create({ data: { jobId: j4.id, teamMemberId: ana } });
    await e.factura('SUYA-TRABAJO-TABLA', 40, { quoteId: q4.id });
    // 5 · un ADICIONAL de su Trabajo: el presupuesto es de la oficina y cuelga del Trabajo por
    //     `Quote.jobId`; `Job.quoteId` apunta al original, no a éste.
    const q5orig = await e.presupuesto(null, 5);
    const j5 = await e.trabajo({ quoteId: q5orig.id, operarioId: ana });
    const q5 = await e.presupuesto(null, 50, { jobId: j5.id, esAdicional: true });
    await e.factura('SUYA-TRABAJO-ADICIONAL', 50, { quoteId: q5.id });
    // 6 · factura PARCIAL de un albarán de su Trabajo: sin presupuesto, el vínculo es el libro de
    //     líneas facturadas.
    const j6 = await e.trabajo({ operarioId: ana });
    const a6 = await e.albaran(j6.id, 'ALB-1397-6');
    const f6 = await e.factura('SUYA-ALBARAN-PARCIAL', 60);
    await prisma.albaranLineaFacturada.create({ data: { merchantId: merchant.id, albaranId: a6.id, lineaIndex: 0, invoiceId: f6.id, cantidad: '1' } });
    // 7 · recapitulativa: sin presupuesto, el vínculo es `Albaran.invoiceId`.
    const j7 = await e.trabajo({ assignedUserId: ana });
    const f7 = await e.factura('SUYA-ALBARAN-ENTERO', 70);
    await e.albaran(j7.id, 'ALB-1397-7', { invoiceId: f7.id });
    // 8 · asignada AL DOCUMENTO: ni autora, ni Trabajo. Es el eje que la decisión añadió.
    const f8 = await e.factura('SUYA-ASIGNADA-AL-DOCUMENTO', 80);
    await prisma.invoiceAssignee.create({ data: { invoiceId: f8.id, teamMemberId: ana } });
    // 9 · la rectificativa de una suya que no lleva presupuesto: sólo la une `rectifiesId`.
    await e.factura('SUYA-RECTIFICATIVA', -60, { type: 'R1', rectifiesId: f6.id });
    // Un justificante suyo: la LISTA de Facturas nunca los ha enseñado (SCRUM-442); la ficha sí.
    const justSuyo = await e.factura('J-SUYO', 11, { type: 'JUST', quoteId: q1.id });

    // ── AJENAS. Una por cada forma de NO ser suya. ─────────────────────────────────────────
    const qb = await e.presupuesto(blas, 100);
    await e.factura('AJENA-AUTOR-BLAS', 100, { quoteId: qb.id });
    const qb2 = await e.presupuesto(null, 200);
    await e.trabajo({ quoteId: qb2.id, operarioId: blas });
    await e.factura('AJENA-TRABAJO-DE-BLAS', 200, { quoteId: qb2.id });
    const fb3 = await e.factura('AJENA-ASIGNADA-A-BLAS', 300);
    await prisma.invoiceAssignee.create({ data: { invoiceId: fb3.id, teamMemberId: blas } });
    const qo = await e.presupuesto(null, 400);
    await e.factura('AJENA-DE-LA-OFICINA', 400, { quoteId: qo.id });
    await e.factura('AJENA-SUELTA-SIN-NADIE', 500);
    const justAjeno = await e.factura('J-AJENO', 12, { type: 'JUST', quoteId: qb.id });

    const SUYAS = [
      'SUYA-AUTORA', 'SUYA-TRABAJO-OPERARIO', 'SUYA-TRABAJO-ASIGNADO', 'SUYA-TRABAJO-TABLA',
      'SUYA-TRABAJO-ADICIONAL', 'SUYA-ALBARAN-PARCIAL', 'SUYA-ALBARAN-ENTERO',
      'SUYA-ASIGNADA-AL-DOCUMENTO', 'SUYA-RECTIFICATIVA',
    ];
    const AJENAS = ['AJENA-AUTOR-BLAS', 'AJENA-TRABAJO-DE-BLAS', 'AJENA-ASIGNADA-A-BLAS', 'AJENA-DE-LA-OFICINA', 'AJENA-SUELTA-SIN-NADIE'];
    const DE_BLAS = ['AJENA-AUTOR-BLAS', 'AJENA-TRABAJO-DE-BLAS', 'AJENA-ASIGNADA-A-BLAS'];

    const todas = await prisma.invoice.findMany({ where: { merchantId: merchant.id }, select: { id: true, number: true } });
    const idDe = Object.fromEntries(todas.map((f) => [f.number, f.id]));
    // SUELO: lo sembrado está todo. Si falta una, los «no la ve» de abajo pasarían en vacío.
    assert.equal(todas.length, SUYAS.length + AJENAS.length + 2, 'SUELO: no están todas las facturas sembradas');

    const { port, cerrar } = await montar(app);
    try {
      const tokenAna = await sesionDe(prisma, merchant.id, ana);
      const tokenBlas = await sesionDe(prisma, merchant.id, blas);
      const tokenJefa = await sesionDe(prisma, merchant.id, e.jefa.id);
      const tokenDuena = await sesionDe(prisma, merchant.id, null);

      // ── LA LISTA DE ANA: exactamente las suyas. Conjuntos, no cuentas. ────────────────────
      const lista = await pedir(port, tokenAna, '/admin/invoices');
      assert.equal(lista.status, 200);
      const vistas = lista.cuerpo.map((f) => f.number).sort();
      for (const numero of SUYAS) {
        assert.ok(vistas.includes(numero), `🔴 el operario ha dejado de ver una factura SUYA en la lista: ${numero}`);
      }
      for (const numero of AJENAS) {
        assert.ok(!vistas.includes(numero), `🔴 el Técnico ve en la lista una factura que no es suya: ${numero}`);
      }
      assert.deepEqual(vistas, [...SUYAS].sort(), 'la lista de Ana no es exactamente el conjunto de las suyas');

      // ── BUSCAR NO ABRE LA PUERTA: el recorte va en AND con la búsqueda, no en OR ──────────
      const numerosDe = async (token, consulta) => (await pedir(port, token, `/admin/invoices?${consulta}`)).cuerpo.map((f) => f.number).sort();
      assert.deepEqual(await numerosDe(tokenAna, 'search=AJENA'), [], '🔴 buscando por número, el Técnico encuentra facturas ajenas');
      assert.deepEqual(await numerosDe(tokenAna, `search=${encodeURIComponent('Cliente QA 1397')}`), [...SUYAS].sort(),
        '🔴 buscando por cliente, la lista del Técnico deja de ser la de las suyas');
      // El positivo del mismo filtro: buscar una suya la encuentra, y la misma búsqueda del admin ve las ajenas.
      assert.deepEqual(await numerosDe(tokenAna, 'search=SUYA-AUTORA'), ['SUYA-AUTORA']);
      assert.deepEqual(await numerosDe(tokenJefa, 'search=AJENA'), [...AJENAS].sort());

      // ── FICHA y PDF, una a una, por la misma puerta ───────────────────────────────────────
      for (const numero of SUYAS) {
        const ficha = await pedir(port, tokenAna, `/admin/invoices/${idDe[numero]}`);
        assert.equal(ficha.status, 200, `🔴 el operario no puede abrir la FICHA de una factura suya: ${numero}`);
        assert.equal(ficha.cuerpo.number, numero);
        // El PDF de una SUYA se genera de verdad y sale: no «no es 404», sino el documento.
        const pdf = await pedir(port, tokenAna, `/admin/invoices/${idDe[numero]}/pdf`);
        assert.equal(pdf.status, 200, `🔴 el operario no puede abrir el PDF de una factura suya (${pdf.status}): ${numero}`);
        assert.match(pdf.tipo, /application\/pdf/, `lo que sale por el PDF de ${numero} no es un PDF`);
      }
      for (const numero of AJENAS) {
        const ficha = await pedir(port, tokenAna, `/admin/invoices/${idDe[numero]}`);
        assert.equal(ficha.status, 404, `🔴 el Técnico abre por URL la FICHA de una factura ajena: ${numero}`);
        const pdf = await pedir(port, tokenAna, `/admin/invoices/${idDe[numero]}/pdf`);
        assert.equal(pdf.status, 404, `🔴 el Técnico abre por URL el PDF de una factura ajena: ${numero}`);
      }
      assert.equal((await pedir(port, tokenAna, `/admin/invoices/${justSuyo.id}`)).status, 200, '🔴 no abre la ficha de un justificante suyo');
      assert.equal((await pedir(port, tokenAna, `/admin/invoices/${justAjeno.id}`)).status, 404, '🔴 abre la ficha de un justificante ajeno');

      // ── BLAS: la puerta contesta por PERSONA, no «un conjunto fijo para todo Técnico» ─────
      const listaBlas = await pedir(port, tokenBlas, '/admin/invoices');
      assert.deepEqual(listaBlas.cuerpo.map((f) => f.number).sort(), [...DE_BLAS].sort(), 'la lista de Blas no es exactamente el conjunto de las suyas');
      assert.equal((await pedir(port, tokenBlas, `/admin/invoices/${idDe['SUYA-AUTORA']}`)).status, 404, '🔴 Blas abre una factura de Ana');

      // ── ④ ADMIN: la administradora y la dueña (sesión sin miembro) las ven TODAS ──────────
      const NO_JUST = [...SUYAS, ...AJENAS].sort();
      for (const [quien, token] of [['la administradora', tokenJefa], ['la dueña', tokenDuena]]) {
        const l = await pedir(port, token, '/admin/invoices');
        assert.deepEqual(l.cuerpo.map((f) => f.number).sort(), NO_JUST, `🔴 ${quien} ya no ve todas las facturas del negocio`);
        for (const f of todas) {
          assert.equal((await pedir(port, token, `/admin/invoices/${f.id}`)).status, 200, `🔴 ${quien} no abre la ficha de ${f.number}`);
          assert.equal((await pedir(port, token, `/admin/invoices/${f.id}/pdf`)).status, 200, `🔴 ${quien} no abre el PDF de ${f.number}`);
        }
      }
    } finally {
      await cerrar();
      // Los PDF generados se quedan en `storage/invoices/`: se quitan los de ESTAS facturas, por su
      // nombre exacto. Nunca por prefijo: el id del merchant de un banco recién creado es un 1 o un 2.
      for (const f of todas) {
        fs.rmSync(path.join(RAIZ, 'storage', 'invoices', `${merchant.id}-${f.number}.pdf`), { force: true });
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SIN BASE · corre siempre. Lo que avisa aunque los casos de arriba salten.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const RUTAS = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';
const PUERTA = 'src/core/documentos/accesoALaFactura.ts';

/** Los manejadores `router.get(<ruta>, …)` del fichero de rutas, por su ruta. AST, no texto. */
function manejadoresGet() {
  const fuente = fs.readFileSync(path.join(RAIZ, RUTAS), 'utf8');
  const sf = ts.createSourceFile(RUTAS, fuente, ts.ScriptTarget.Latest, true);
  const out = new Map();
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.expression.getText(sf) === 'router' && n.expression.name.text === 'get'
      && n.arguments.length >= 2 && ts.isStringLiteral(n.arguments[0])) {
      out.set(n.arguments[0].text, n.arguments[n.arguments.length - 1]);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { sf, out };
}

/** Las LLAMADAS a `nombre` dentro de un nodo, con su posición. Un comentario no es una llamada. */
function llamadasA(nodo, nombre) {
  const out = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) out.push(n.getStart());
    ts.forEachChild(n, visita);
  };
  visita(nodo);
  return out;
}

test('SCRUM-1397 · las TRES rutas de factura pasan por la puerta, y antes de leer la factura', () => {
  const { out } = manejadoresGet();
  // SUELO: el lector encuentra las tres rutas. Si el fichero cambia de forma, que lo diga.
  for (const ruta of ['/', '/:id', '/:id/pdf']) {
    assert.ok(out.has(ruta), `🔴 CIEGO: no encuentro router.get('${ruta}') en ${RUTAS}`);
  }

  const lista = out.get('/');
  assert.equal(llamadasA(lista, 'whereFacturasVisibles').length, 1, '🔴 la LISTA de facturas no pide el recorte a la puerta');
  assert.ok(llamadasA(lista, 'whereFacturasVisibles')[0] < llamadasA(lista, 'listInvoicesAdmin')[0],
    '🔴 la lista pide el recorte DESPUÉS de leer las facturas');

  for (const [ruta, lectura] of [['/:id', 'getInvoiceDetailAdmin'], ['/:id/pdf', 'ensureInvoicePdf']]) {
    const manejador = out.get(ruta);
    const puerta = llamadasA(manejador, 'puedeVerLaFactura');
    const lee = llamadasA(manejador, lectura);
    assert.equal(lee.length, 1, `🔴 CIEGO: GET ${ruta} ya no llama a ${lectura}; re-mide qué es «leer la factura» aquí`);
    assert.equal(puerta.length, 1, `🔴 GET /admin/invoices${ruta} no pregunta a la puerta`);
    assert.ok(puerta[0] < lee[0], `🔴 GET /admin/invoices${ruta} pregunta a la puerta DESPUÉS de ${lectura}`);
  }
});

test('SCRUM-1397 · la puerta no recorta a quien ve todo el negocio, y sin identidad no casa nada', async () => {
  const { whereFacturasVisibles, puedeVerLaFactura } = await import('../dist/core/documentos/accesoALaFactura.js');
  // Ninguno de estos cuatro llega a consultar: por eso corren sin base.
  assert.equal(await whereFacturasVisibles({ merchantId: 71, userRole: 'admin', teamMemberId: null }), null, 'la dueña (sesión sin miembro) no lleva recorte');
  assert.equal(await whereFacturasVisibles({ merchantId: 71, userRole: 'admin', teamMemberId: 7 }), null, 'un miembro admin no lleva recorte');
  assert.equal(await puedeVerLaFactura({ merchantId: 71, userRole: 'admin', teamMemberId: 7 }, 123), true);
  // Un rol que no es «admin» y no trae identidad: el conjunto VACÍO, nunca «las de la oficina».
  assert.deepEqual(await whereFacturasVisibles({ merchantId: 71, userRole: 'tecnico', teamMemberId: null }), { id: { in: [] } });
  // Un rol desconocido queda recortado (allowlist): no se le devuelve «sin recorte».
  assert.deepEqual(await whereFacturasVisibles({ merchantId: 71, userRole: 'otro', teamMemberId: undefined }), { id: { in: [] } });
});

test('SCRUM-1397 · los ejes del Trabajo se le PIDEN a `whereSuyoElTrabajo`, no se copian en la puerta', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, PUERTA), 'utf8');
  const sf = ts.createSourceFile(PUERTA, fuente, ts.ScriptTarget.Latest, true);
  assert.equal(llamadasA(sf, 'whereSuyoElTrabajo').length, 1, '🔴 la puerta ya no reusa los ejes del Trabajo de la casa');
  // Y que no los escriba además por su cuenta: una propiedad `operarioId` o `assignedUserId` en
  // este fichero sería la segunda copia del criterio.
  const propias = [];
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && ['operarioId', 'assignedUserId', 'assignees'].includes(n.name.text)) propias.push(n.name.text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.deepEqual(propias, [], `🔴 la puerta escribe por su cuenta ejes del Trabajo: ${propias.join(', ')}`);
});
