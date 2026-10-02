// SCRUM-1403 · CON LAS TRES RUTAS DE FACTURA CERRADAS, LAS OTRAS DOS PUERTAS — fichas de presupuesto
// y ficha de cliente.
//
// SCRUM-1397 cerró la lista, la ficha y el PDF de factura, y J2a comprobó DESPUÉS de ver su control
// en verde si el resultado seguía al alcance: lo estaba. El mismo Técnico sacaba 900 de 900 de un
// compañero por las fichas de presupuesto y 1.050 de 1.050 del negocio por las fichas de cliente
// (`docs/evidencias/scrum1397/sonda-otras-puertas.*`).
//
// Qué construye este ticket, y qué NO:
//   · PRESUPUESTOS (lista y ficha): la regla «autor o asignado», ya firmada para los dos documentos
//     (SCRUM-1346 c.17952, SCRUM-1390 c.17962), por una puerta hermana de la de las facturas;
//   · FICHA DE CLIENTE, pestaña de documentos: los presupuestos y las facturas que trae pasan por
//     esas mismas dos puertas;
//   · 🔴 NO las CIFRAS de la ficha (`stats`: cobrado, facturado, pendiente, gastos, beneficio) ni
//     sus EVENTOS: qué recibe de ellos un Técnico es decisión del fundador y está PEDIDA, sin
//     contestar. Por eso el primer caso de abajo dice las dos frases enfrentadas y sujeta la que
//     todavía no se puede decir.
//
// Como en SCRUM-1397, la mitad que manda es «sigue viendo lo suyo» («mejor ser más laxo al
// principio y evitar errores», SCRUM-1346 c.17932): cada camino por el que un presupuesto es suyo
// tiene su caso CON SU NOMBRE, y la ficha del cliente se le sigue abriendo aunque no tenga en ella
// ni un documento.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE HABLA POR HTTP CON LA APP REAL Y CONTRA PRISMA DE VERDAD (`dist/app.js`, su `requireAuth` y
// sus rutas; sesiones creadas en la base). La base es el banco DESECHABLE (`LIBRO_PG_URL`: loopback
// y nombre acabado en `_test`). Nace de `prisma/schema.prisma`: dice QUÉ HACE este `where`, no cómo
// son los datos de ninguna cuenta real. Sin `LIBRO_PG_URL` los casos con base SALTAN diciendo por
// qué; la mitad sin base (abajo del todo) corre siempre.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import ts from 'typescript';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: rango imposible, nunca de alguien

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
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
};

/** Un negocio con dos Técnicos y una administradora, y los creadores que usan los casos. */
async function equipoDe(prisma, merchant, marca) {
  const miembro = (name, role) => prisma.teamMember.create({
    data: { merchantId: merchant.id, name, email: `qa1403-${marca}-${name.toLowerCase()}-${Date.now()}@test.local`, role, status: 'active' },
  });
  const ana = await miembro('Ana', 'tecnico');
  const blas = await miembro('Blas', 'tecnico');
  const jefa = await miembro('Jefa', 'admin');
  const cliente = (nombre) => prisma.customer.create({ data: { merchantId: merchant.id, name: nombre } });

  let n = 0;
  // `internalNotes` hace de NOMBRE del presupuesto: la lista lo devuelve y dice por qué camino es suyo.
  const presupuesto = (c, autorId, total, extra = {}) => prisma.quote.create({
    data: {
      merchantId: merchant.id, customerId: c.id, total: String(total), currency: 'EUR', lines: [],
      quoteNumber: ++n, status: 'accepted', teamMemberId: autorId, ...extra,
    },
  });
  const factura = (c, numero, total, extra = {}) => prisma.invoice.create({
    data: {
      merchantId: merchant.id, customerId: c.id, number: numero, total: String(total), currency: 'EUR',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING', status: 'pending', type: 'F1', quoteId: null,
      vfEstado: 'no_aplica', ...extra,
    },
  });
  const trabajo = (c, extra = {}) => prisma.job.create({ data: { merchantId: merchant.id, customerId: c.id, ...extra } });
  return { ana, blas, jefa, cliente, presupuesto, factura, trabajo };
}

const pagadas = (facturas) => (facturas ?? []).filter((f) => f.status === 'paid').reduce((a, f) => a + Number(f.total), 0);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ · LA SONDA DE J2a, COMPLETA: las TRES puertas a la vez, con su mismo negocio y sus cifras
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1403 · 🔴 las tres puertas A LA VEZ: ni las facturas ni las fichas de presupuesto dan ya la cifra; las CIFRAS de la ficha de cliente siguen dándola', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1403 negocio', email: `qa-1403-negocio-${Date.now()}@test.local` }, async (merchant) => {
    const e = await equipoDe(prisma, merchant, 'negocio');
    const ahora = new Date();

    // El negocio que fabricó J2i, fila a fila: 4 clientes, 4 presupuestos, 4 facturas.
    const c = [];
    for (const nombre of ['C1', 'C2', 'C3', 'C4']) c.push(await e.cliente(nombre));
    const pAna = await e.presupuesto(c[0], e.ana.id, 100);
    const pBlas1 = await e.presupuesto(c[1], e.blas.id, 900);
    const pBlas2 = await e.presupuesto(c[2], e.blas.id, 400, { status: 'sent' });
    await e.presupuesto(c[3], null, 300);
    await e.factura(c[0], 'A-1', 100, { quoteId: pAna.id, status: 'paid', paidAt: ahora });
    await e.factura(c[1], 'A-2', 900, { quoteId: pBlas1.id, status: 'paid', paidAt: ahora });
    await e.factura(c[2], 'A-3', 400, { quoteId: pBlas2.id });
    await e.factura(c[3], 'A-4', 50, { status: 'paid', paidAt: ahora });

    const { port, cerrar } = await montar(app);
    try {
      const tokenAna = await sesionDe(prisma, merchant.id, e.ana.id);
      const tokenJefa = await sesionDe(prisma, merchant.id, e.jefa.id);

      // El patrón: lo que el panel de administración dice, por su ruta real.
      const panel = await pedir(port, tokenJefa, '/admin/metrics/team');
      assert.equal(panel.status, 200, `el panel de admin no contesta (${panel.status}): sin patrón no hay nada que comparar`);
      const TOTAL = panel.cuerpo.totalCollected;
      const DE_BLAS = panel.cuerpo.members.find((m) => m.id === e.blas.id)?.collected;
      assert.equal(TOTAL, 1050, 'SUELO: el panel tiene que decir 1.050 de total cobrado');
      assert.equal(DE_BLAS, 900, 'SUELO: el panel tiene que decir 900 cobrados por Blas');

      // ── PUERTA A · la lista de facturas (la que cerró SCRUM-1397) ──────────────────────────
      const lista = await pedir(port, tokenAna, '/admin/invoices');
      assert.equal(lista.status, 200);
      const porFacturas = pagadas(lista.cuerpo);

      // ── PUERTA C · las fichas de presupuesto del compañero ─────────────────────────────────
      // Primero como lo hacía la sonda: la lista filtrada por autor es el primer paso del cálculo.
      const deBlas = await pedir(port, tokenAna, `/admin/quotes?teamMemberId=${e.blas.id}`);
      assert.equal(deBlas.status, 200);
      assert.deepEqual(deBlas.cuerpo.map((q) => q.id), [], '🔴 el Técnico lista por autor los presupuestos de un compañero');
      // Y después SABIENDO los ids, que son enteros correlativos: la lista vacía no basta si la
      // ficha se abre por URL.
      let porPresupuestos = 0;
      for (const q of [pBlas1, pBlas2]) {
        const ficha = await pedir(port, tokenAna, `/admin/quotes/${q.id}`);
        assert.equal(ficha.status, 404, `🔴 el Técnico abre por URL la ficha del presupuesto de un compañero (id ${q.id})`);
        porPresupuestos += pagadas(ficha.cuerpo?.Invoice ?? ficha.cuerpo?.invoices);
      }
      // El positivo de las mismas dos preguntas: la jefa sí los lista y sí los abre, con su factura.
      const deBlasJefa = await pedir(port, tokenJefa, `/admin/quotes?teamMemberId=${e.blas.id}`);
      assert.deepEqual(deBlasJefa.cuerpo.map((q) => q.id).sort(), [pBlas1.id, pBlas2.id].sort(), 'la administradora no lista los presupuestos de Blas');
      const fichaJefa = await pedir(port, tokenJefa, `/admin/quotes/${pBlas1.id}`);
      assert.equal(pagadas(fichaJefa.cuerpo.Invoice ?? fichaJefa.cuerpo.invoices), 900, 'SUELO: la ficha del presupuesto ya no trae sus facturas con total y estado; re-mide qué prueba este caso');

      // ── PUERTA B · las fichas de cliente ───────────────────────────────────────────────────
      const cartera = await pedir(port, tokenAna, '/admin/customers');
      assert.equal(cartera.status, 200);
      assert.equal(cartera.cuerpo.length, 4, 'SUELO: la Técnica ya no ve la cartera entera');
      let porPestana = 0;
      let porCifras = 0;
      for (const fila of cartera.cuerpo) {
        const ficha = await pedir(port, tokenAna, `/admin/customers/${fila.id}/detail`);
        assert.equal(ficha.status, 200, `🔴 la Técnica no abre la ficha de un cliente (${fila.name})`);
        porPestana += pagadas(ficha.cuerpo.invoices);
        porCifras += Number(ficha.cuerpo.stats.totalPaid);
      }

      // ── LAS TRES, JUNTAS. Un verde por puerta no vale: el defecto es que el resultado se
      //    alcanza por varios caminos. ──────────────────────────────────────────────────────────
      assert.notEqual(porFacturas, TOTAL, `🔴 la lista de facturas da el total del negocio (${porFacturas} = ${TOTAL})`);
      assert.notEqual(porPresupuestos, DE_BLAS, `🔴 las fichas de presupuesto dan lo cobrado por un compañero (${porPresupuestos} = ${DE_BLAS})`);
      assert.notEqual(porPestana, TOTAL, `🔴 las facturas de las fichas de cliente dan el total del negocio (${porPestana} = ${TOTAL})`);
      // Lo que SÍ sigue pudiendo sumar es lo suyo: 100 de 1.050.
      assert.equal(porFacturas, 100);
      assert.equal(porPresupuestos, 0);
      assert.equal(porPestana, 100);

      // 🔴 Y LO QUE SIGUE ABIERTO, dicho donde no se puede leer mal. `stats.totalPaid` es un agregado
      // sin tope sobre TODAS las facturas del cliente, y este ticket no lo toca: qué recibe de él
      // un Técnico lo decide el fundador (pedido el 2-oct-2026, sin contestar). Mientras este aserto
      // esté así, la frase «el Técnico ya no reconstruye el total» es FALSA; la verdadera es «ya no
      // lo reconstruye por las rutas de factura, ni por las fichas de presupuesto, ni por la pestaña
      // de documentos de la ficha de cliente». Cuando se decida, este aserto pasa a `notEqual`.
      assert.equal(porCifras, TOTAL, 'SUELO: las cifras de la ficha de cliente ya no dan el total; alguien ha tocado `stats`: re-mide y cambia la frase de este caso');
    } finally {
      await cerrar();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ · EL QUE MANDA: SIGUE VIENDO CADA PRESUPUESTO SUYO, POR CADA CAMINO — y el admin, todos
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1403 · ✅ el Técnico SIGUE viendo cada presupuesto suyo (autor · asignado · Trabajo · revisión), y sólo ésos; el admin los ve todos', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1403 ejes', email: `qa-1403-ejes-${Date.now()}@test.local` }, async (merchant) => {
    const e = await equipoDe(prisma, merchant, 'ejes');
    const ana = e.ana.id;
    const blas = e.blas.id;
    const cli = await e.cliente('Cliente QA 1403 ejes');
    const p = (autorId, nombre, extra = {}) => e.presupuesto(cli, autorId, 10, { internalNotes: nombre, ...extra });

    // ── SUYOS DE ANA. El nombre DICE por qué camino es suyo. ───────────────────────────────
    // 1 · autora, en borrador: antes de que exista nada más.
    await p(ana, 'SUYO-AUTORA', { status: 'draft' });
    // 2 · de la oficina, asignado a ella COMO DOCUMENTO y sin aceptar: no hay Trabajo todavía. Es
    //     el eje sin el que no podría abrir el presupuesto que va a enseñar en la visita (máster S1).
    const q2 = await p(null, 'SUYO-ASIGNADO-AL-DOCUMENTO', { status: 'sent' });
    await prisma.quoteAssignee.create({ data: { quoteId: q2.id, teamMemberId: ana } });
    // 3, 4 y 5 · de la oficina; el Trabajo es suyo por cada uno de los tres ejes del Trabajo.
    const q3 = await p(null, 'SUYO-TRABAJO-OPERARIO');
    await e.trabajo(cli, { quoteId: q3.id, operarioId: ana });
    const q4 = await p(null, 'SUYO-TRABAJO-ASIGNADO');
    await e.trabajo(cli, { quoteId: q4.id, assignedUserId: ana });
    const q5 = await p(null, 'SUYO-TRABAJO-TABLA');
    const j5 = await e.trabajo(cli, { quoteId: q5.id });
    await prisma.jobAssignee.create({ data: { jobId: j5.id, teamMemberId: ana } });
    // 6 · un ADICIONAL de su Trabajo: cuelga por `Quote.jobId`; `Job.quoteId` apunta al original.
    const q6orig = await p(null, 'SUYO-TRABAJO-ORIGINAL-DEL-ADICIONAL');
    const j6 = await e.trabajo(cli, { quoteId: q6orig.id, operarioId: ana });
    await p(null, 'SUYO-TRABAJO-ADICIONAL', { jobId: j6.id, esAdicional: true });
    // 7 · la REVISIÓN de uno que lleva por asignación: al revisar no se copian los asignados, y la
    //     versión vigente es justo la que tiene que poder abrir.
    const q7 = await p(null, 'SUYO-REVISADO-LA-ORIGINAL', { status: 'sent' });
    await prisma.quoteAssignee.create({ data: { quoteId: q7.id, teamMemberId: ana } });
    await p(null, 'SUYO-REVISADO-LA-VIGENTE', { status: 'sent', quoteNumber: q7.quoteNumber, revision: 1 });
    // Y una factura en el asignado al documento: la ficha de un presupuesto SUYO enseña sus facturas.
    await e.factura(cli, 'F-DEL-ASIGNADO', 10, { quoteId: q2.id });

    // ── AJENOS. Uno por cada forma de NO ser suyo. ─────────────────────────────────────────
    await p(blas, 'AJENO-AUTOR-BLAS');
    const qb2 = await p(null, 'AJENO-ASIGNADO-A-BLAS', { status: 'sent' });
    await prisma.quoteAssignee.create({ data: { quoteId: qb2.id, teamMemberId: blas } });
    const qb3 = await p(null, 'AJENO-TRABAJO-DE-BLAS');
    await e.trabajo(cli, { quoteId: qb3.id, operarioId: blas });
    await p(null, 'AJENO-DE-LA-OFICINA', { status: 'sent' });

    const SUYOS = [
      'SUYO-AUTORA', 'SUYO-ASIGNADO-AL-DOCUMENTO', 'SUYO-TRABAJO-OPERARIO', 'SUYO-TRABAJO-ASIGNADO',
      'SUYO-TRABAJO-TABLA', 'SUYO-TRABAJO-ORIGINAL-DEL-ADICIONAL', 'SUYO-TRABAJO-ADICIONAL',
      'SUYO-REVISADO-LA-ORIGINAL', 'SUYO-REVISADO-LA-VIGENTE',
    ];
    const AJENOS = ['AJENO-AUTOR-BLAS', 'AJENO-ASIGNADO-A-BLAS', 'AJENO-TRABAJO-DE-BLAS', 'AJENO-DE-LA-OFICINA'];
    const DE_BLAS = ['AJENO-AUTOR-BLAS', 'AJENO-ASIGNADO-A-BLAS', 'AJENO-TRABAJO-DE-BLAS'];

    const todos = await prisma.quote.findMany({ where: { merchantId: merchant.id }, select: { id: true, internalNotes: true } });
    const idDe = Object.fromEntries(todos.map((q) => [q.internalNotes, q.id]));
    // SUELO: lo sembrado está todo. Si falta uno, los «no lo ve» de abajo pasarían en vacío.
    assert.equal(todos.length, SUYOS.length + AJENOS.length, 'SUELO: no están todos los presupuestos sembrados');

    const { port, cerrar } = await montar(app);
    try {
      const tokenAna = await sesionDe(prisma, merchant.id, ana);
      const tokenBlas = await sesionDe(prisma, merchant.id, blas);
      const tokenJefa = await sesionDe(prisma, merchant.id, e.jefa.id);
      const tokenDuena = await sesionDe(prisma, merchant.id, null);
      const nombresDe = async (token, consulta = '') => {
        const r = await pedir(port, token, `/admin/quotes${consulta}`);
        assert.equal(r.status, 200, `GET /admin/quotes${consulta} contesta ${r.status}`);
        return r.cuerpo.map((q) => q.internalNotes).sort();
      };

      // ── LA LISTA DE ANA: exactamente los suyos. Conjuntos, no cuentas. ────────────────────
      const vistos = await nombresDe(tokenAna);
      for (const nombre of SUYOS) {
        assert.ok(vistos.includes(nombre), `🔴 el operario ha dejado de ver un presupuesto SUYO en la lista: ${nombre}`);
      }
      for (const nombre of AJENOS) {
        assert.ok(!vistos.includes(nombre), `🔴 el Técnico ve en la lista un presupuesto que no es suyo: ${nombre}`);
      }
      assert.deepEqual(vistos, [...SUYOS].sort(), 'la lista de Ana no es exactamente el conjunto de los suyos');

      // ── NI BUSCAR NI FILTRAR ABREN LA PUERTA: el recorte va en AND con los dos ────────────
      assert.deepEqual(await nombresDe(tokenAna, `?search=${encodeURIComponent('Cliente QA 1403')}`), [...SUYOS].sort(),
        '🔴 buscando por cliente, la lista del Técnico deja de ser la de los suyos');
      assert.deepEqual(await nombresDe(tokenAna, `?teamMemberId=${blas}`), [], '🔴 filtrando por autor, el Técnico lista los presupuestos de un compañero');
      assert.deepEqual(await nombresDe(tokenAna, '?status=sent'),
        ['SUYO-ASIGNADO-AL-DOCUMENTO', 'SUYO-REVISADO-LA-ORIGINAL', 'SUYO-REVISADO-LA-VIGENTE'],
        '🔴 filtrando por estado, la lista del Técnico deja de ser la de los suyos');
      // El positivo de los mismos filtros: el suyo por autor lo encuentra, y la administradora ve lo de Blas.
      assert.deepEqual(await nombresDe(tokenAna, `?teamMemberId=${ana}`), ['SUYO-AUTORA']);
      assert.deepEqual(await nombresDe(tokenJefa, `?teamMemberId=${blas}`), ['AJENO-AUTOR-BLAS']);

      // ── LA FICHA, una a una, por la misma puerta ──────────────────────────────────────────
      for (const nombre of SUYOS) {
        const ficha = await pedir(port, tokenAna, `/admin/quotes/${idDe[nombre]}`);
        assert.equal(ficha.status, 200, `🔴 el operario no puede abrir la FICHA de un presupuesto suyo: ${nombre}`);
        assert.equal(ficha.cuerpo.id, idDe[nombre]);
      }
      for (const nombre of AJENOS) {
        const ficha = await pedir(port, tokenAna, `/admin/quotes/${idDe[nombre]}`);
        assert.equal(ficha.status, 404, `🔴 el Técnico abre por URL la FICHA de un presupuesto ajeno: ${nombre}`);
      }
      // La ficha de uno SUYO trae sus facturas (lado laxo, c.17932): es su presupuesto.
      const conFactura = await pedir(port, tokenAna, `/admin/quotes/${q2.id}`);
      assert.deepEqual((conFactura.cuerpo.Invoice ?? conFactura.cuerpo.invoices ?? []).map((f) => f.number), ['F-DEL-ASIGNADO'],
        '🔴 la ficha de un presupuesto suyo ya no le enseña la factura de ese presupuesto');

      // ── BLAS: la puerta contesta por PERSONA, no «un conjunto fijo para todo Técnico» ─────
      assert.deepEqual(await nombresDe(tokenBlas), [...DE_BLAS].sort(), 'la lista de Blas no es exactamente el conjunto de los suyos');
      assert.equal((await pedir(port, tokenBlas, `/admin/quotes/${idDe['SUYO-AUTORA']}`)).status, 404, '🔴 Blas abre un presupuesto de Ana');

      // ── ADMIN: la administradora y la dueña (sesión sin miembro) los ven TODOS ────────────
      const TODOS = [...SUYOS, ...AJENOS].sort();
      for (const [quien, token] of [['la administradora', tokenJefa], ['la dueña', tokenDuena]]) {
        assert.deepEqual(await nombresDe(token), TODOS, `🔴 ${quien} ya no ve todos los presupuestos del negocio`);
        for (const q of todos) {
          assert.equal((await pedir(port, token, `/admin/quotes/${q.id}`)).status, 200, `🔴 ${quien} no abre la ficha de ${q.internalNotes}`);
        }
      }
    } finally {
      await cerrar();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ · Y LA FICHA DEL CLIENTE: se le abre ENTERA aunque no tenga en ella ni un documento
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1403 · ✅ la ficha del cliente se le sigue abriendo al Técnico, con sus datos; de los documentos trae sólo los suyos, y al admin todos', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1403 ficha', email: `qa-1403-ficha-${Date.now()}@test.local` }, async (merchant) => {
    const e = await equipoDe(prisma, merchant, 'ficha');
    // Un cliente con documentos de los dos, y otro en el que Ana no tiene NADA: el que la oficina
    // da de alta para la visita de mañana.
    const mixto = await e.cliente('Cliente mixto');
    const ajeno = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente de la visita', phone: telefonoDePrueba(1403), billingAddress: 'Calle de la obra, 3' } });
    const pSuyo = await e.presupuesto(mixto, e.ana.id, 100, { internalNotes: 'P-SUYO' });
    const pAjeno = await e.presupuesto(mixto, e.blas.id, 900, { internalNotes: 'P-AJENO' });
    await e.factura(mixto, 'F-SUYA', 100, { quoteId: pSuyo.id });
    await e.factura(mixto, 'F-AJENA', 900, { quoteId: pAjeno.id });
    await e.presupuesto(ajeno, null, 300, { internalNotes: 'P-OFICINA' });
    await e.factura(ajeno, 'F-OFICINA', 300);

    const { port, cerrar } = await montar(app);
    try {
      const tokenAna = await sesionDe(prisma, merchant.id, e.ana.id);
      const tokenJefa = await sesionDe(prisma, merchant.id, e.jefa.id);
      const pestana = (ficha) => ({
        presupuestos: ficha.cuerpo.quotes.map((q) => q.id).sort(),
        facturas: ficha.cuerpo.invoices.map((f) => f.number).sort(),
      });

      // La cartera, entera (SCRUM-979): los dos clientes.
      const cartera = await pedir(port, tokenAna, '/admin/customers');
      assert.deepEqual(cartera.cuerpo.map((x) => x.name).sort(), ['Cliente de la visita', 'Cliente mixto'], '🔴 la Técnica ya no ve la cartera entera');

      // El cliente en el que no tiene nada: la ficha se abre, con lo que necesita para ir.
      const visita = await pedir(port, tokenAna, `/admin/customers/${ajeno.id}/detail`);
      assert.equal(visita.status, 200, '🔴 el operario no puede abrir la ficha del cliente al que va a visitar');
      assert.equal(visita.cuerpo.customer.name, 'Cliente de la visita');
      assert.equal(visita.cuerpo.customer.phone, telefonoDePrueba(1403), '🔴 la ficha del cliente ya no le da el teléfono');
      assert.equal(visita.cuerpo.customer.billingAddress, 'Calle de la obra, 3', '🔴 la ficha del cliente ya no le da la dirección');
      assert.deepEqual(pestana(visita), { presupuestos: [], facturas: [] }, '🔴 la ficha de un cliente ajeno le trae documentos que no son suyos');

      // El cliente mixto: de la pestaña, exactamente lo suyo.
      const suya = await pedir(port, tokenAna, `/admin/customers/${mixto.id}/detail`);
      assert.equal(suya.status, 200);
      assert.deepEqual(pestana(suya), { presupuestos: [pSuyo.id], facturas: ['F-SUYA'] }, '🔴 la pestaña de documentos de la Técnica no es exactamente lo suyo');

      // La administradora: las mismas dos fichas, con todo.
      const jefaMixto = await pedir(port, tokenJefa, `/admin/customers/${mixto.id}/detail`);
      assert.deepEqual(pestana(jefaMixto), { presupuestos: [pSuyo.id, pAjeno.id].sort(), facturas: ['F-AJENA', 'F-SUYA'] }, '🔴 la administradora ya no ve todos los documentos del cliente');
      const jefaVisita = await pedir(port, tokenJefa, `/admin/customers/${ajeno.id}/detail`);
      assert.deepEqual(jefaVisita.cuerpo.invoices.map((f) => f.number), ['F-OFICINA'], '🔴 la administradora ya no ve la factura de la oficina');
      assert.equal(jefaVisita.cuerpo.quotes.length, 1);
    } finally {
      await cerrar();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SIN BASE · corre siempre. Lo que avisa aunque los casos de arriba salten.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const RUTAS_PRESUPUESTO = 'src/modules/system/app/routes/quotesAdmin.routes.ts';
const RUTAS_CLIENTE = 'src/modules/system/app/routes/customersAdmin.routes.ts';
const PUERTA = 'src/core/documentos/accesoAlPresupuesto.ts';
const PUERTA_FACTURAS = 'src/core/documentos/accesoALaFactura.ts';

const arbolDe = (rel) => ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ts.ScriptTarget.Latest, true);

/** Los manejadores `router.get(<ruta>, …)` de un fichero de rutas, por su ruta. AST, no texto. */
function manejadoresGet(rel) {
  const sf = arbolDe(rel);
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
  return out;
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

test('SCRUM-1403 · la lista y la ficha de presupuesto pasan por la puerta ANTES de leer, y la ficha de cliente pide las dos', () => {
  const presupuestos = manejadoresGet(RUTAS_PRESUPUESTO);
  for (const ruta of ['/', '/:id']) {
    assert.ok(presupuestos.has(ruta), `🔴 CIEGO: no encuentro router.get('${ruta}') en ${RUTAS_PRESUPUESTO}`);
  }
  for (const [ruta, puerta, lectura] of [['/', 'wherePresupuestosVisibles', 'listQuotesAdmin'], ['/:id', 'puedeVerElPresupuesto', 'getQuoteDetailAdmin']]) {
    const manejador = presupuestos.get(ruta);
    const pregunta = llamadasA(manejador, puerta);
    const lee = llamadasA(manejador, lectura);
    assert.equal(lee.length, 1, `🔴 CIEGO: GET /admin/quotes${ruta} ya no llama a ${lectura}; re-mide qué es «leer» aquí`);
    assert.equal(pregunta.length, 1, `🔴 GET /admin/quotes${ruta} no pregunta a la puerta (${puerta})`);
    assert.ok(pregunta[0] < lee[0], `🔴 GET /admin/quotes${ruta} pregunta a la puerta DESPUÉS de ${lectura}`);
  }

  const ficha = manejadoresGet(RUTAS_CLIENTE).get('/:id/detail');
  assert.ok(ficha, `🔴 CIEGO: no encuentro router.get('/:id/detail') en ${RUTAS_CLIENTE}`);
  assert.equal(llamadasA(ficha, 'wherePresupuestosVisibles').length, 1, '🔴 la ficha de cliente no pide el recorte de presupuestos a la puerta');
  assert.equal(llamadasA(ficha, 'whereFacturasVisibles').length, 1, '🔴 la ficha de cliente no pide el recorte de facturas a la puerta');
});

test('SCRUM-1403 · la puerta de presupuestos no recorta a quien ve todo el negocio, y sin identidad no casa nada', async () => {
  const { wherePresupuestosVisibles, puedeVerElPresupuesto } = await import('../dist/core/documentos/accesoAlPresupuesto.js');
  // Ninguno de estos llega a consultar: por eso corren sin base.
  assert.equal(await wherePresupuestosVisibles({ merchantId: 73, userRole: 'admin', teamMemberId: null }), null, 'la dueña (sesión sin miembro) no lleva recorte');
  assert.equal(await wherePresupuestosVisibles({ merchantId: 73, userRole: 'admin', teamMemberId: 7 }), null, 'un miembro admin no lleva recorte');
  assert.equal(await puedeVerElPresupuesto({ merchantId: 73, userRole: 'admin', teamMemberId: 7 }, 123), true);
  // Un rol que no es «admin» y no trae identidad: el conjunto VACÍO, nunca «los del propietario».
  assert.deepEqual(await wherePresupuestosVisibles({ merchantId: 73, userRole: 'tecnico', teamMemberId: null }), { id: { in: [] } });
  // Un rol desconocido queda recortado (allowlist): no se le devuelve «sin recorte».
  assert.deepEqual(await wherePresupuestosVisibles({ merchantId: 73, userRole: 'otro', teamMemberId: undefined }), { id: { in: [] } });
});

test('SCRUM-1403 · las dos puertas comparten criterio: los Trabajos de la persona se leen en UN sitio, y quién ve todo lo dice `seesAllJobs`', () => {
  const presupuestos = arbolDe(PUERTA);
  const facturas = arbolDe(PUERTA_FACTURAS);
  // La de presupuestos PIDE los Trabajos; no los lee por su cuenta ni escribe sus ejes.
  assert.equal(llamadasA(presupuestos, 'trabajosDeLaPersona').length, 1, '🔴 la puerta de presupuestos ya no pide los Trabajos a la de facturas');
  assert.equal(llamadasA(presupuestos, 'whereSuyoElTrabajo').length, 0, '🔴 la puerta de presupuestos lee los Trabajos por su cuenta: es la segunda copia');
  const propias = [];
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && ['operarioId', 'assignedUserId', 'assignees'].includes(n.name.text)) propias.push(n.name.text);
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'job' && n.expression.getText(presupuestos) === 'prisma') propias.push('prisma.job');
    ts.forEachChild(n, visita);
  };
  visita(presupuestos);
  assert.deepEqual(propias, [], `🔴 la puerta de presupuestos escribe por su cuenta el eje del Trabajo: ${propias.join(', ')}`);
  // La de facturas usa ESA misma lectura (una llamada, además de la declaración), y sigue
  // pidiendo los tres ejes a la casa en un solo sitio.
  assert.equal(llamadasA(facturas, 'trabajosDeLaPersona').length, 1, '🔴 la puerta de facturas ya no lee los Trabajos por la función compartida');
  assert.equal(llamadasA(facturas, 'whereSuyoElTrabajo').length, 1, '🔴 los ejes del Trabajo ya no se piden en un solo sitio');
  // Quién ve todo: las dos preguntan lo mismo a la misma función.
  assert.equal(llamadasA(presupuestos, 'seesAllJobs').length, 1, '🔴 la puerta de presupuestos no pregunta a `seesAllJobs` quién ve todo');
  assert.equal(llamadasA(facturas, 'seesAllJobs').length, 1, '🔴 la puerta de facturas no pregunta a `seesAllJobs` quién ve todo');
});
