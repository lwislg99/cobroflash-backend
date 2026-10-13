// sonda-revision.mjs — SCRUM-1188d, de paso · ¿«Crear revisión» copia un NULL de SQL como JSON `null`?
//
// Uso:  node sonda-revision.mjs <raíz ABSOLUTA del árbol> <url del banco>
// Corre la función REAL de `dist/` (`crearRevisionDeQuote`) contra Postgres, y relee por SQL crudo
// las cinco columnas `Json?` que `REVISION_HEREDA` copia.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [raiz, url] = process.argv.slice(2);
const u = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(u.hostname) || !u.pathname.endsWith('_test')) {
  console.error('🔴 la URL no es un banco desechable. No se toca nada.'); process.exit(2);
}
process.env.DATABASE_URL = url;
const de = (rel) => import(pathToFileURL(path.join(raiz, rel)).href);
const { prisma } = await de('dist/core/db/prisma.js');
const { crearRevisionDeQuote } = await de('dist/modules/system/quoteAdmin.js');
const { withMerchant } = await de('tests/_merchant-fixture.mjs');

const crudo = async (id) => (await prisma.$queryRaw`
  SELECT revision,
         doc_fields IS NULL AS doc_fields_vacia,                   jsonb_typeof(doc_fields) AS doc_fields_tipo,
         pay_methods IS NULL AS pay_methods_vacia,                 jsonb_typeof(pay_methods) AS pay_methods_tipo,
         custom_billing_plan IS NULL AS plan_vacia,                jsonb_typeof(custom_billing_plan) AS plan_tipo,
         tiers IS NULL AS tiers_vacia,                             jsonb_typeof(tiers) AS tiers_tipo,
         clausulas_excluidas IS NULL AS clausulas_vacia,           jsonb_typeof(clausulas_excluidas) AS clausulas_tipo
  FROM quotes WHERE id = ${id}`)[0];

let salida = 1;
try {
  await withMerchant(prisma, { name: 'Sonda revision', email: `sonda-rev-${Date.now()}@test.local` }, async (m) => {
    const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente sonda' } });
    const original = await prisma.quote.create({
      data: { merchantId: m.id, customerId: cliente.id, total: '100', currency: 'EUR', quoteNumber: 1, status: 'sent',
        lines: [{ concept: 'x', qty: 1, price: 100 }] },
    });
    console.log('POBLACIÓN · 1 presupuesto sin ninguna columna Json? escrita, y su revisión creada por crearRevisionDeQuote');
    console.log('ORIGINAL ', JSON.stringify(await crudo(original.id)));
    const r = await crearRevisionDeQuote(m.id, original.id);
    console.log('REVISIÓN ', JSON.stringify(await crudo(r.id)), '· numero', r.numero);
    await prisma.quote.deleteMany({ where: { merchantId: m.id } });
    await prisma.customer.deleteMany({ where: { merchantId: m.id } });
  }, { after: () => {} });
  salida = 0;
} catch (e) { console.error('🔴 la sonda no llegó al final:', e); }
finally { await prisma.$disconnect(); console.log(`EXIT=${salida}`); process.exit(salida); }
