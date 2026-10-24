// SCRUM-1346 · EL TÉCNICO VE DOCUMENTOS QUE NO SON SUYOS — el rojo, entrando por la RUTA.
//
// LA DECISIÓN (fundador, 1-oct-2026; SCRUM-1346 c.17952 «1-Para los dos», SCRUM-1390 c.17962 «1-Sí»;
// máster, Parte S1, nota «Autor o asignado»): el Técnico ve un presupuesto o una factura si es su
// AUTOR, si tiene el TRABAJO asignado o si está ASIGNADO AL DOCUMENTO. Y la regla va en TODOS los
// sitios donde recibe uno, no en uno: filtrar sólo Inicio «esconde, no cierra».
//
// Del censo de SCRUM-1390, SCRUM-1397, 1403 y 1489 ya cerraron las lecturas de factura, la lista y la
// ficha de presupuesto, la ficha de cliente y el buscador. Lo que queda ABIERTO es `FUGAS_CONOCIDAS`, y
// la medición, con su fecha y su sha, está en docs/master/SCRUM-1346.md.
//
// ── POR QUÉ ES UN TRINQUETE Y NO UN `todo` ───────────────────────────────────────────────────
//
// Un caso que cae a propósito tumba el check obligatorio de todos, y un `todo` que cae sale como
// `not ok … # TODO`, que los instrumentos de la casa cuentan como rojo a cualquier profundidad
// (`scripts/_tanda-por-tramos.mjs:31`). Así que cada fuga conocida se afirma como TESTIGO: el caso
// está verde MIENTRAS la fuga existe, y cae el día que alguien la cierra sin quitarla de la lista.
// La lista sólo puede encoger. Una ruta que no está en ella tiene que cumplir la decisión YA.
//
// EL ROJO, a la vista: `SCRUM1346_SIN_TRINQUETE=1` trata la lista como vacía, y cada fuga conocida
// cae con su ruta y lo que vio. Es lo que se entregó como prueba (docs/master/SCRUM-1346.md).
//
// ── LAS DOS MITADES QUE NO SE PUEDEN FALSEAR ─────────────────────────────────────────────────
//
//   · la ADMINISTRADORA sigue viéndolo TODO, por las mismas rutas: un filtro que también le corte a
//     ella rompe el producto en vez de arreglarlo;
//   · el Técnico sigue viendo LO SUYO («mejor ser más laxo al principio y evitar errores»,
//     SCRUM-1346 c.17932): un filtro que lo deja ciego también pasaría la mitad de arriba.
//
// SE HABLA POR HTTP CON LA APP REAL (`dist/app.js`, su `requireAuth`, sus rutas, sesiones creadas
// en la base). Un test que saca el manejador de su ruta prueba el manejador, no la ruta (SCRUM-1344).
// La base es el banco DESECHABLE (`LIBRO_PG_URL`: loopback y nombre acabado en `_test`). Sin él, los
// casos SALTAN diciendo por qué; en el check obligatorio del CI corren.
//
// 🔴 ENVÍOS: las rutas de enviar por WhatsApp y por correo se llaman sobre un cliente SIN teléfono y
// SIN correo, y eso se COMPRUEBA antes de llamarlas. Así la ruta enseña si encontró el documento
// (contesta «falta el teléfono») o no (404) sin que pueda salir nada, haya o no credenciales.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

/**
 * Las fugas que HOY siguen abiertas. Cada una, con el sitio donde se cierra. Quien la cierre QUITA
 * su clave en el mismo PR: si no, su caso cae y se lo dice.
 *
 * VACÍA desde SCRUM-1555 (S1, 14-oct-2026): las ocho medidas aquí el 14-oct se cerraron en el mismo
 * PR, con `puedeVerElPresupuesto` en las seis rutas por id y `wherePresupuestosVisibles` en Inicio y
 * en el buscador del albarán. Antes de vaciarla, con el arreglo puesto y la lista llena, el caso ①
 * cayó con las ocho en NO-VE: ése es el control de que se cerraron todas y no sólo una.
 */
const FUGAS_CONOCIDAS = new Map([]);
const fugas = process.env.SCRUM1346_SIN_TRINQUETE === '1' ? new Map() : FUGAS_CONOCIDAS;

after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

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

// `node:http` sin agente y no `fetch` (SCRUM-1218c): `fetch` contra un servidor propio puede
// abortar el proceso al salir (SCRUM-560). Un JSON que no se lee da `null`, como el `.catch` de antes.
const pedir = (port, token, metodo, ruta, cuerpo) => new Promise((ok, mal) => {
  const carga = cuerpo ? JSON.stringify(cuerpo) : null;
  const cabeceras = { cookie: `pf_session=${token}` };
  if (carga) Object.assign(cabeceras, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(carga) });
  const req = http.request({ host: '127.0.0.1', port, path: ruta, method: metodo, headers: cabeceras, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => {
      const tipo = r.headers['content-type'] || '';
      let datos = null;
      if (tipo.includes('json')) { try { datos = JSON.parse(d); } catch { datos = null; } }
      ok({ status: r.statusCode, tipo, datos });
    });
  });
  req.on('error', mal);
  req.end(carga ?? undefined);
});

/**
 * El negocio: dos Técnicos (Ana, la que pregunta; Blas, el compañero) y una administradora. Cada uno
 * con su presupuesto y su factura. El cliente no tiene teléfono ni correo, a propósito (ver arriba).
 */
async function negocio(prisma, merchant) {
  const marca = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const miembro = (name, role) => prisma.teamMember.create({
    data: { merchantId: merchant.id, name, email: `qa1346-${name.toLowerCase()}-${marca}@test.local`, role, status: 'active' },
  });
  const ana = await miembro('Ana', 'tecnico');
  const blas = await miembro('Blas', 'tecnico');
  const jefa = await miembro('Jefa', 'admin');
  const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 1346' } });
  assert.ok(!cliente.phone && !cliente.mobile && !cliente.email, 'el cliente del banco no puede tener teléfono ni correo: las rutas de envío no deben poder enviar');

  let n = 0;
  const presupuesto = (autor, status, nota) => prisma.quote.create({
    data: {
      merchantId: merchant.id, customerId: cliente.id, total: '100', currency: 'EUR', lines: [],
      quoteNumber: ++n, status, teamMemberId: autor.id, internalNotes: nota,
    },
  });
  const factura = (numero, quote) => prisma.invoice.create({
    data: {
      merchantId: merchant.id, customerId: cliente.id, number: numero, total: '100', currency: 'EUR',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING', status: 'pending', type: 'F1', quoteId: quote.id,
      vfEstado: 'no_aplica',
    },
  });

  const deAna = await presupuesto(ana, 'sent', 'de Ana');
  const deBlas = await presupuesto(blas, 'sent', 'de Blas');
  const deBlasAceptar = await presupuesto(blas, 'sent', 'de Blas, para aceptar');
  const deBlasRechazar = await presupuesto(blas, 'sent', 'de Blas, para rechazar');
  const facturaDeAna = await factura(`QA1346-A-${marca}`, deAna);
  const facturaDeBlas = await factura(`QA1346-B-${marca}`, deBlas);
  return { ana, blas, jefa, cliente, deAna, deBlas, deBlasAceptar, deBlasRechazar, facturaDeAna, facturaDeBlas };
}

/**
 * Cada sonda contesta UNA de tres: 'VE' (la ruta le dio el documento o actuó sobre él), 'NO-VE' (lo
 * trató como inexistente) o 'CIEGO:<status>' (no llegó a decidir nada). CIEGO cae SIEMPRE: un 500 no
 * es una ruta cerrada, es una medición que no se hizo.
 */
const contiene = (lista, id, campo = 'id') => (Array.isArray(lista) ? lista : []).some((x) => Number(x?.[campo]) === Number(id));

function sondas(e) {
  return {
    // ── Lectura de presupuestos ──────────────────────────────────────────────────────────
    'lista-presupuestos': { doc: 'presupuesto', ruta: () => ['GET', '/admin/quotes'],
      lee: (r, id) => (r.status === 200 ? (contiene(r.datos?.quotes ?? r.datos, id) ? 'VE' : 'NO-VE') : `CIEGO:${r.status}`) },
    'ficha-presupuesto': { doc: 'presupuesto', ruta: (id) => ['GET', `/admin/quotes/${id}`],
      lee: (r) => (r.status === 200 ? 'VE' : r.status === 404 ? 'NO-VE' : `CIEGO:${r.status}`) },
    'pdf-presupuesto': { doc: 'presupuesto', ruta: (id) => ['GET', `/admin/quotes/${id}/pdf`],
      lee: (r) => (r.status === 200 && /application\/pdf/.test(r.tipo) ? 'VE' : r.status === 404 ? 'NO-VE' : `CIEGO:${r.status}`) },
    'inicio': { doc: 'presupuesto', ruta: () => ['GET', '/admin/metrics/inicio'],
      lee: (r, id) => (r.status === 200 && Array.isArray(r.datos?.recentActivity) ? (contiene(r.datos.recentActivity, id) ? 'VE' : 'NO-VE') : `CIEGO:${r.status}`) },
    'albaran-buscador': { doc: 'presupuesto', ruta: () => ['GET', '/admin/albaranes/presupuestos'],
      lee: (r, id) => (r.status === 200 && Array.isArray(r.datos?.presupuestos) ? (contiene(r.datos.presupuestos, id, 'quoteId') ? 'VE' : 'NO-VE') : `CIEGO:${r.status}`) },
    // ── Lectura de facturas ──────────────────────────────────────────────────────────────
    'lista-facturas': { doc: 'factura', ruta: () => ['GET', '/admin/invoices'],
      lee: (r, id) => (r.status === 200 ? (contiene(r.datos?.invoices ?? r.datos, id) ? 'VE' : 'NO-VE') : `CIEGO:${r.status}`) },
    'ficha-factura': { doc: 'factura', ruta: (id) => ['GET', `/admin/invoices/${id}`],
      lee: (r) => (r.status === 200 ? 'VE' : r.status === 404 ? 'NO-VE' : `CIEGO:${r.status}`) },
    // ── Acciones sobre un presupuesto ────────────────────────────────────────────────────
    'notas': { doc: 'presupuesto', ruta: (id) => ['PUT', `/admin/quotes/${id}/notes`, { notes: 'escrita por quien pregunta' }],
      // `updateMany` contesta 200 aunque no toque nada: lo que decide es si la nota CAMBIÓ.
      lee: async (r, id, prisma) => {
        if (r.status === 404) return 'NO-VE';
        if (r.status !== 200) return `CIEGO:${r.status}`;
        const q = await prisma.quote.findUnique({ where: { id }, select: { internalNotes: true } });
        return q?.internalNotes === 'escrita por quien pregunta' ? 'VE' : 'NO-VE';
      } },
    'aceptar': { doc: 'presupuesto', ruta: (id) => ['POST', `/admin/quotes/${id}/accept`, { channel: 'in_person' }],
      lee: (r) => (r.status === 200 ? 'VE' : r.status === 404 ? 'NO-VE' : `CIEGO:${r.status}`) },
    'rechazar': { doc: 'presupuesto', ruta: (id) => ['POST', `/admin/quotes/${id}/reject`, { channel: 'in_person' }],
      lee: (r) => (r.status === 200 ? 'VE' : r.status === 404 ? 'NO-VE' : `CIEGO:${r.status}`) },
    // Sin teléfono: si encuentra el documento contesta `customer_missing_phone`, y no envía.
    'enviar-whatsapp': { doc: 'presupuesto', ruta: (id) => ['POST', `/admin/quotes/${id}/send-whatsapp`],
      lee: (r) => (r.status === 400 && r.datos?.error === 'customer_missing_phone' ? 'VE' : r.status === 404 ? 'NO-VE' : `CIEGO:${r.status}`) },
    // Sin correo: si encuentra el documento contesta `customer_missing_email`, y no envía.
    'enviar-correo': { doc: 'presupuesto', ruta: (id) => ['POST', `/admin/quotes/${id}/send-email`],
      lee: (r) => (r.status === 400 && r.datos?.error === 'customer_missing_email' ? 'VE' : r.status === 404 ? 'NO-VE' : `CIEGO:${r.status}`) },
  };
}

// El documento AJENO sobre el que actúa cada sonda (las acciones que cambian el estado van sobre su
// propia fila, para que una no le quite a la siguiente lo que mide).
const ajeno = (clave, e) => ({ aceptar: e.deBlasAceptar, rechazar: e.deBlasRechazar })[clave]
  ?? (sondas(e)[clave].doc === 'factura' ? e.facturaDeBlas : e.deBlas);
const propio = (clave, e) => (sondas(e)[clave].doc === 'factura' ? e.facturaDeAna : e.deAna);

async function medir(port, token, prisma, sonda, doc) {
  const [metodo, ruta, cuerpo] = sonda.ruta(doc.id);
  const r = await pedir(port, token, metodo, ruta, cuerpo);
  return { ruta: `${metodo} ${ruta}`, veredicto: await sonda.lee(r, doc.id, prisma), status: r.status };
}

async function conElNegocio(fn) {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  await withMerchant(prisma, { name: 'QA SCRUM-1346', email: `qa-1346-${Date.now()}@test.local` }, async (merchant) => {
    const e = await negocio(prisma, merchant);
    const srv = await montar(app);
    try {
      const token = {
        ana: await sesionDe(prisma, merchant.id, e.ana.id),
        jefa: await sesionDe(prisma, merchant.id, e.jefa.id),
      };
      await fn({ prisma, port: srv.port, e, token });
    } finally {
      await srv.cerrar();
    }
  });
}

// Las lecturas van ANTES que las acciones: aceptar y rechazar cambian el estado de una fila.
const LECTURAS = ['lista-presupuestos', 'ficha-presupuesto', 'pdf-presupuesto', 'inicio', 'albaran-buscador', 'lista-facturas', 'ficha-factura'];
const ACCIONES = ['notas', 'aceptar', 'rechazar', 'enviar-whatsapp', 'enviar-correo'];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① · EL TÉCNICO Y EL DOCUMENTO DE SU COMPAÑERO — presupuestos Y facturas
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1346 · ① el Técnico y los documentos de su COMPAÑERO, ruta a ruta: lo cerrado sigue cerrado y cada fuga conocida sigue donde se midió', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  await conElNegocio(async ({ prisma, port, e, token }) => {
    const filas = [];
    for (const clave of [...LECTURAS, ...ACCIONES]) {
      const m = await medir(port, token.ana, prisma, sondas(e)[clave], ajeno(clave, e));
      filas.push({ clave, ...m });
    }
    console.log(filas.map((f) => `  ${f.veredicto.padEnd(9)} ${f.clave.padEnd(19)} ${f.ruta} → ${f.status}`).join('\n'));

    const fallos = [];
    for (const f of filas) {
      if (f.veredicto.startsWith('CIEGO')) { fallos.push(`🔴 ${f.ruta}: CIEGO (${f.status}) — la sonda no llegó a decidir; no es una ruta cerrada`); continue; }
      if (fugas.has(f.clave)) {
        if (f.veredicto !== 'VE') fallos.push(`🟢 ${f.ruta}: la fuga «${f.clave}» ya NO está — quita su clave de FUGAS_CONOCIDAS en este mismo PR (era: ${fugas.get(f.clave)})`);
      } else if (f.veredicto === 'VE') {
        fallos.push(`🔴 FUGA ${f.ruta}: el Técnico recibe o toca un documento de su COMPAÑERO (decisión SCRUM-1346 c.17952: sólo autor, Trabajo asignado o asignado al documento)`);
      }
    }
    assert.deepEqual(fallos, [], fallos.join('\n'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② · LO SUYO lo sigue viendo — por las mismas rutas
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1346 · ② el Técnico sigue viendo y tocando SUS documentos por las mismas rutas (un filtro que lo deje ciego no arregla nada)', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  await conElNegocio(async ({ prisma, port, e, token }) => {
    const fallos = [];
    // aceptar y rechazar sobre lo suyo cambiarían su presupuesto antes de las demás: se miden en ④.
    for (const clave of [...LECTURAS, 'notas', 'enviar-whatsapp', 'enviar-correo']) {
      const m = await medir(port, token.ana, prisma, sondas(e)[clave], propio(clave, e));
      if (m.veredicto !== 'VE') fallos.push(`🔴 ${m.ruta}: ${m.veredicto} (${m.status}) — el Técnico no alcanza un documento SUYO (autor)`);
    }
    assert.deepEqual(fallos, [], fallos.join('\n'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ · LA ADMINISTRADORA lo sigue viendo TODO — el control que no se puede falsear
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1346 · ③ la ADMINISTRADORA sigue viendo y tocando los documentos de TODOS, por las mismas rutas', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  await conElNegocio(async ({ prisma, port, e, token }) => {
    const fallos = [];
    for (const clave of [...LECTURAS, ...ACCIONES]) {
      for (const doc of [ajeno(clave, e), propio(clave, e)]) {
        if (['aceptar', 'rechazar'].includes(clave) && doc === propio(clave, e)) continue; // lo suyo, en ④
        const m = await medir(port, token.jefa, prisma, sondas(e)[clave], doc);
        if (m.veredicto !== 'VE') fallos.push(`🔴 ${m.ruta}: ${m.veredicto} (${m.status}) — la administradora ha perdido un documento del negocio`);
      }
    }
    assert.deepEqual(fallos, [], fallos.join('\n'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ · ACEPTAR y RECHAZAR lo suyo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1346 · ④ el Técnico sigue pudiendo registrar la aceptación y el rechazo de un presupuesto SUYO', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  await conElNegocio(async ({ prisma, port, e, token }) => {
    const otro = await prisma.quote.create({
      data: { merchantId: e.deAna.merchantId, customerId: e.cliente.id, total: '100', currency: 'EUR', lines: [], quoteNumber: 99, status: 'sent', teamMemberId: e.ana.id },
    });
    const a = await medir(port, token.ana, prisma, sondas(e).aceptar, e.deAna);
    const r = await medir(port, token.ana, prisma, sondas(e).rechazar, otro);
    assert.equal(a.veredicto, 'VE', `🔴 ${a.ruta}: ${a.veredicto} (${a.status}) — no puede aceptar uno suyo`);
    assert.equal(r.veredicto, 'VE', `🔴 ${r.ruta}: ${r.veredicto} (${r.status}) — no puede rechazar uno suyo`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Sin base: la lista del trinquete sólo nombra sondas que existen
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1346 · cada clave de FUGAS_CONOCIDAS nombra una sonda que se mide (una clave sin sonda sería un testigo que nunca cae)', () => {
  const medidas = new Set([...LECTURAS, ...ACCIONES]);
  const huerfanas = [...FUGAS_CONOCIDAS.keys()].filter((k) => !medidas.has(k));
  assert.deepEqual(huerfanas, [], `claves sin sonda: ${huerfanas.join(', ')}`);
});
