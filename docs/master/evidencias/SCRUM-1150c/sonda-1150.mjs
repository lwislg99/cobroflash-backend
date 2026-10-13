// sonda-1150.mjs — SCRUM-1150 · ¿qué le pasa DE VERDAD al profesional con «dos vigentes» en la base?
//
// Uso:  node sonda-1150.mjs <raíz ABSOLUTA del árbol> <url del banco>
// `dist/app.js` por HTTP, con sesión de administradora, contra Postgres. Fabrica los DOS orígenes
// de `revisiones_dos_vigentes` (c.19090) con filas de verdad y mira: la ficha (GET), la lista (GET)
// y «Crear revisión» (POST). CONTROL: un presupuesto sano, que tiene que dar 200 y 201.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

const [raiz, url] = process.argv.slice(2);
const u = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(u.hostname) || !u.pathname.endsWith('_test')) {
  console.error('🔴 la URL no es un banco desechable. No se toca nada.'); process.exit(2);
}
process.env.DATABASE_URL = url;
const de = (rel) => import(pathToFileURL(path.join(raiz, rel)).href);
const { prisma } = await de('dist/core/db/prisma.js');
const { app } = await de('dist/app.js');
const { withMerchant } = await de('tests/_merchant-fixture.mjs');

let salida = 1;
const callar = console.error; const log = [];
console.error = (...a) => log.push(a.map(String).join(' ').split('\n')[0].slice(0, 160));
try {
  await withMerchant(prisma, { name: 'Sonda 1150', email: `sonda-1150-${Date.now()}@test.local` }, async (m) => {
    const jefa = await prisma.teamMember.create({ data: { merchantId: m.id, name: 'Jefa', email: `sonda-1150-jefa-${Date.now()}@test.local`, role: 'admin', status: 'active' } });
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.authSession.create({ data: { merchantId: m.id, teamMemberId: jefa.id, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) } });
    const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente sonda' } });
    const q = (quoteNumber, revision, extra = {}) => prisma.quote.create({
      data: { merchantId: m.id, customerId: cliente.id, total: '100', currency: 'EUR', status: 'sent', quoteNumber, revision,
        lines: [{ concept: 'x', qty: 1, price: 100 }], ...extra },
    });
    const server = http.createServer(app).listen(0);
    await new Promise((r) => server.once('listening', r));
    const pedir = async (metodo, ruta) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${ruta}`, { method: metodo, headers: { cookie: `pf_session=${token}`, 'content-type': 'application/json' }, body: metodo === 'GET' ? undefined : '{}' });
      const cuerpo = await r.json().catch(() => null);
      return { status: r.status, error: cuerpo?.error ?? null, message: cuerpo?.message ?? null, claves: cuerpo && !Array.isArray(cuerpo) ? Object.keys(cuerpo).slice(0, 6) : null, n: Array.isArray(cuerpo) ? cuerpo.length : (Array.isArray(cuerpo?.quotes) ? cuerpo.quotes.length : (Array.isArray(cuerpo?.items) ? cuerpo.items.length : null)) };
    };
    const corto = (r) => JSON.stringify({ status: r.status, error: r.error, message: r.message ? r.message.slice(0, 70) : null });
    try {
      // ── CONTROL: un presupuesto sano ──
      const sano = await q(1, 0);
      console.log('CONTROL sano        · ficha', corto(await pedir('GET', `/admin/quotes/${sano.id}`)), '· crear revisión', corto(await pedir('POST', `/admin/quotes/${sano.id}/revisiones`)));

      // ── origen 1: el año de la serie (dos presupuestos DISTINTOS con el mismo número, revisión 0) ──
      const a26 = await q(12, 0, { createdAt: new Date('2026-03-01T10:00:00Z') });
      const a27 = await q(12, 0, { createdAt: new Date('2027-01-05T10:00:00Z') });
      for (const [nombre, x] of [['el de 2026', a26], ['el de 2027', a27]]) {
        console.log(`AÑO DE LA SERIE · ${nombre} · ficha`, corto(await pedir('GET', `/admin/quotes/${x.id}`)), '· crear revisión', corto(await pedir('POST', `/admin/quotes/${x.id}/revisiones`)));
      }

      // ── origen 2: una revisión repetida (.0, .1 y otra .1) ──
      const r0 = await q(13, 0); const r1a = await q(13, 1); const r1b = await q(13, 1);
      for (const [nombre, x] of [['la .0', r0], ['una .1', r1a], ['la otra .1', r1b]]) {
        console.log(`REVISIÓN REPETIDA · ${nombre} · ficha`, corto(await pedir('GET', `/admin/quotes/${x.id}`)), '· crear revisión', corto(await pedir('POST', `/admin/quotes/${x.id}/revisiones`)));
      }

      // ── la lista: ¿sigue saliendo? ──
      const lista = await pedir('GET', '/admin/quotes');
      console.log('LISTA /admin/quotes ·', JSON.stringify({ status: lista.status, error: lista.error, claves: lista.claves, n: lista.n }));
      const filas = await prisma.quote.count({ where: { merchantId: m.id } });
      console.log(`TESTIGO · filas de presupuesto en la base al acabar: ${filas} (7 fabricadas + las revisiones que se hayan creado)`);
    } finally {
      await new Promise((r) => server.close(r));
      await prisma.quote.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    }
  }, { after: () => {} });
  salida = 0;
} catch (e) { callar('🔴 la sonda no llegó al final:', e); }
finally {
  console.error = callar;
  console.log('LOG DEL SERVIDOR (primera línea de cada error):'); for (const l of log) console.log('  ·', l);
  await prisma.$disconnect(); console.log(`EXIT=${salida}`); process.exit(salida);
}
