// sonda-tiers.mjs — SCRUM-1188d · ¿qué hace Prisma con un `null` de JS en una columna `Json?`
//
// Uso:  node sonda-tiers.mjs <raíz ABSOLUTA del árbol> <url del banco>
// Fail-closed: sólo loopback y base terminada en `_test`.
//
// Lo que mide, contra Postgres de verdad (no un doble):
//   · CONTROL NEGATIVO  · un argumento que no existe: tiene que dar un error de VALIDACIÓN, y
//                         distinto del de los casos. Si diera el mismo, la sonda es CIEGA.
//   · CONTROL POSITIVO  · `paymentTerms: null` vacía la columna de texto (lo que ya está en main).
//   · los casos         · `tiers` en `create` y en `update`, con `null`, `DbNull`, `JsonNull` y ausente.
// Cada caso se RELEE por SQL crudo, que es lo único que distingue un NULL de SQL del valor JSON `null`:
// por la API de Prisma los dos se leen `null`.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [raiz, url] = process.argv.slice(2);
if (!raiz || !url) { console.error('uso: node sonda-tiers.mjs <raíz del árbol> <url>'); process.exit(2); }
const u = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(u.hostname) || !u.pathname.endsWith('_test')) {
  console.error('🔴 la URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  process.exit(2);
}
const require = createRequire(path.join(raiz, 'package.json'));
const { PrismaClient, Prisma } = require('@prisma/client');
const { withMerchant } = await import(pathToFileURL(path.join(raiz, 'tests', '_merchant-fixture.mjs')).href);

const prisma = new PrismaClient({ datasourceUrl: url });
const TRES = [{ id: 'good' }, { id: 'better' }, { id: 'best' }];

async function crudo(id) {
  const f = await prisma.$queryRaw`
    SELECT tiers IS NULL AS null_de_sql, tiers::text AS texto, jsonb_typeof(tiers) AS tipo_json,
           payment_terms IS NULL AS cobro_null, payment_terms AS cobro
    FROM quote_templates WHERE id = ${id}`;
  return f[0];
}
async function intento(fn) {
  try { return { ok: true, valor: await fn() }; }
  catch (e) {
    const lineas = String(e.message).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return { ok: false, clase: e.constructor.name, codigo: e.code ?? null, ultima: lineas[lineas.length - 1] };
  }
}

const filas = [];
const apunta = (caso, r, leido) => filas.push({ caso, ok: r.ok, ...(r.ok ? {} : { clase: r.clase, codigo: r.codigo, ultima: r.ultima }), leido });

let salida = 1;
try {
  const [{ base, version }] = await prisma.$queryRaw`SELECT current_database() AS base, version() AS version`;
  console.log(`POBLACIÓN · base=${base} · ${String(version).split(',')[0]} · @prisma/client ${Prisma.prismaVersion.client}`);

  await withMerchant(prisma, { name: 'Sonda 1188d', email: `sonda-1188d-${Date.now()}@test.local` }, async (m) => {
    const nueva = (extra) => prisma.quoteTemplate.create({
      data: { merchantId: m.id, name: 'P', currency: 'EUR', lines: [{ concept: 'x', qty: 1, price: 1 }], ...extra },
    });
    const sujeto = await nueva({ tiers: TRES, paymentTerms: 'FIFTY_FIFTY' });
    apunta('SUELO · alta con tiers=[3] y cobro 50/50', { ok: true }, await crudo(sujeto.id));

    // ── control negativo: ¿la sonda distingue un error de validación de cualquier otro? ──
    const neg = await intento(() => prisma.quoteTemplate.update({ where: { id: sujeto.id }, data: { columnaQueNoExiste: 1 } }));
    apunta('CONTROL NEGATIVO · update con una columna que no existe', neg, await crudo(sujeto.id));

    // ── control positivo: lo que ya está en main ──
    const pos = await intento(() => prisma.quoteTemplate.update({ where: { id: sujeto.id }, data: { paymentTerms: null } }));
    apunta('CONTROL POSITIVO · update paymentTerms: null (texto anulable)', pos, await crudo(sujeto.id));

    // ── los casos ──
    const u1 = await intento(() => prisma.quoteTemplate.update({ where: { id: sujeto.id }, data: { tiers: null } }));
    apunta('update tiers: null (el `null` de JS, lo que llega del cable)', u1, await crudo(sujeto.id));

    const u2 = await intento(() => prisma.quoteTemplate.update({ where: { id: sujeto.id }, data: { tiers: Prisma.JsonNull } }));
    apunta('update tiers: Prisma.JsonNull', u2, await crudo(sujeto.id));

    await prisma.quoteTemplate.update({ where: { id: sujeto.id }, data: { tiers: TRES } });
    const u3 = await intento(() => prisma.quoteTemplate.update({ where: { id: sujeto.id }, data: { tiers: Prisma.DbNull } }));
    apunta('update tiers: Prisma.DbNull (tras reponer [3])', u3, await crudo(sujeto.id));

    const c1 = await intento(() => nueva({ tiers: null, paymentTerms: null }));
    apunta('create tiers: null (lo que hace hoy el POST sin niveles)', c1, c1.ok ? await crudo(c1.valor.id) : null);

    const c2 = await intento(() => nueva({}));
    apunta('create sin la clave tiers', c2, c2.ok ? await crudo(c2.valor.id) : null);

    const c3 = await intento(() => nueva({ tiers: Prisma.DbNull }));
    apunta('create tiers: Prisma.DbNull', c3, c3.ok ? await crudo(c3.valor.id) : null);

    await prisma.quoteTemplate.deleteMany({ where: { merchantId: m.id } });
  }, { after: () => {} });

  for (const f of filas) console.log(JSON.stringify(f));
  console.log(`TESTIGO · ${filas.length} casos corridos`);
  salida = 0;
} catch (e) {
  console.error('🔴 la sonda no llegó al final:', e);
} finally {
  await prisma.$disconnect();
  console.log(`EXIT=${salida}`);
  process.exit(salida);
}
