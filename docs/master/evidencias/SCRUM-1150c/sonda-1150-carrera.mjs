// sonda-1150-carrera.mjs — SCRUM-1150 · ¿dos «Crear revisión» a la vez crean el empate («dos vigentes»)?
//
// Uso:  node sonda-1150-carrera.mjs <raíz ABSOLUTA del árbol> <url del banco>
// `dist/app.js` por HTTP contra Postgres. Por cada intento: un presupuesto sano, DOS `POST
// /admin/quotes/:id/revisiones` lanzados a la vez (dos conexiones HTTP al mismo proceso, que es
// como corre producción: lo que se cruza son las esperas a la base, no dos hilos), y se cuentan las
// filas por revisión. CONTROL: los mismos dos POST uno DETRÁS de otro tienen que dar .1 y .2.
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

const INTENTOS = 10;
let salida = 1;
const callar = console.error; console.error = () => {};
try {
  await withMerchant(prisma, { name: 'Sonda 1150 carrera', email: `sonda-1150c-${Date.now()}@test.local` }, async (m) => {
    const jefa = await prisma.teamMember.create({ data: { merchantId: m.id, name: 'Jefa', email: `sonda-1150c-jefa-${Date.now()}@test.local`, role: 'admin', status: 'active' } });
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.authSession.create({ data: { merchantId: m.id, teamMemberId: jefa.id, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) } });
    const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente sonda' } });
    const sano = (n) => prisma.quote.create({ data: { merchantId: m.id, customerId: cliente.id, total: '100', currency: 'EUR', status: 'sent', quoteNumber: n, revision: 0, lines: [{ concept: 'x', qty: 1, price: 100 }] } });
    const server = http.createServer(app).listen(0);
    await new Promise((r) => server.once('listening', r));
    const pedir = async (metodo, ruta) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${ruta}`, { method: metodo, headers: { cookie: `pf_session=${token}`, 'content-type': 'application/json' }, body: metodo === 'GET' ? undefined : '{}' });
      const c = await r.json().catch(() => null);
      return `${r.status}${c?.error ? ' ' + c.error : ''}${c?.revision != null ? ' .' + c.revision : ''}`;
    };
    const revisionesDe = async (n) => (await prisma.quote.findMany({ where: { merchantId: m.id, quoteNumber: n }, select: { revision: true }, orderBy: { revision: 'asc' } })).map((x) => x.revision).join(',');
    try {
      const c = await sano(1);
      const c1 = await pedir('POST', `/admin/quotes/${c.id}/revisiones`);
      const c2 = await pedir('POST', `/admin/quotes/${c.id}/revisiones`);
      console.log(`POBLACIÓN · ${INTENTOS} intentos de dos POST a la vez, y un control en serie`);
      console.log(`CONTROL en serie · respuestas [${c1}] [${c2}] · revisiones en la base: ${await revisionesDe(1)}`);

      let empates = 0;
      for (let i = 0; i < INTENTOS; i++) {
        const n = 100 + i;
        const q = await sano(n);
        const [a, b] = await Promise.all([pedir('POST', `/admin/quotes/${q.id}/revisiones`), pedir('POST', `/admin/quotes/${q.id}/revisiones`)]);
        const revs = await revisionesDe(n);
        const empate = revs === '0,1,1';
        if (empate) empates++;
        const ficha = await pedir('GET', `/admin/quotes/${q.id}`);
        const tercero = await pedir('POST', `/admin/quotes/${q.id}/revisiones`);
        console.log(`intento ${i + 1} · a la vez [${a}] [${b}] · en la base: ${revs} · ${empate ? 'EMPATE' : 'sin empate'} · ficha después: ${ficha} · otro «Crear revisión» después: [${tercero}]`);
      }
      console.log(`TESTIGO · ${empates} empates de ${INTENTOS} intentos`);
    } finally {
      await new Promise((r) => server.close(r));
      await prisma.quote.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    }
  }, { after: () => {} });
  salida = 0;
} catch (e) { callar('🔴 la sonda no llegó al final:', e); }
finally { console.error = callar; await prisma.$disconnect(); console.log(`EXIT=${salida}`); process.exit(salida); }
