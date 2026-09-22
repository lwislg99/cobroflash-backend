// SCRUM-1059 (CRM-17) · ACCIONES MASIVAS SOBRE CLIENTES — la mitad con BASE.
//
// `etiquetarSeleccion` contra Postgres de verdad, que es donde viven las garantías:
//   · TENENCIA: un id de OTRO merchant en la selección no se toca y se declara «No encontrado»,
//     sin decir que existe en otro sitio;
//   · un cliente que no se puede actualizar (ya tiene 20 etiquetas) NO tumba a los demás de la
//     misma selección — se escriben los que SÍ cambian;
//   · lo escrito se RELEE igual (quinto eslabón, SCRUM-580).
//
// La mitad PURA (`aplicarEtiquetaMasiva`) vive en `scrum1059-etiquetado-masivo.test.mjs` y corre
// en cada `npm test`, sin base.
//
// ⚠️ GATEADO, dos destinos (patrón SCRUM-876).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-1059 · etiquetarSeleccion: tenencia, uno lleno no tumba a los demás, y se relee igual', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { etiquetarSeleccion } = await import('../dist/modules/system/domain/etiquetadoMasivo.js');
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'QA 1059 A', email: `qa-1059-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 1059 B', email: `qa-1059-b-${stamp}@test.local` }, async (b) => {
        const libre1 = await prisma.customer.create({ data: { merchantId: a.id, name: 'Libre 1' } });
        const libre2 = await prisma.customer.create({ data: { merchantId: a.id, name: 'Libre 2', tags: ['moroso'] } });
        const veinte = Array.from({ length: 20 }, (_, i) => `tag${i}`);
        const lleno = await prisma.customer.create({ data: { merchantId: a.id, name: 'Lleno 20', tags: veinte } });
        const deB = await prisma.customer.create({ data: { merchantId: b.id, name: 'De B 1059' } });

        // ── add sobre una selección mixta: dos libres, uno lleno, uno de OTRO merchant ──
        const r = await etiquetarSeleccion(a.id, [libre1.id, libre2.id, lleno.id, deB.id], 'add', 'revisión');
        assert.equal(r.actualizados, 2, '🔴 solo los dos libres debían escribirse');

        const porId = new Map(r.resultados.map((x) => [x.id, x]));
        assert.equal(porId.get(libre1.id).actualizado, true);
        assert.equal(porId.get(libre2.id).actualizado, true);
        assert.equal(porId.get(lleno.id).actualizado, false, '🔴 el lleno debía declararse, no tumbar la tanda');
        assert.equal(porId.get(lleno.id).motivo, 'Ya tiene 20 etiquetas');
        assert.equal(porId.get(deB.id).actualizado, false, '🔴 un id de OTRO merchant no puede escribirse');
        assert.equal(porId.get(deB.id).motivo, 'No encontrado', '🔴 no debe decir que el cliente existe en otro merchant');

        // ── se RELEE igual (quinto eslabón, SCRUM-580) ──
        const [releido1, releido2, releidoLleno, releidoDeB] = await Promise.all([
          prisma.customer.findUnique({ where: { id: libre1.id }, select: { tags: true } }),
          prisma.customer.findUnique({ where: { id: libre2.id }, select: { tags: true } }),
          prisma.customer.findUnique({ where: { id: lleno.id }, select: { tags: true } }),
          prisma.customer.findUnique({ where: { id: deB.id }, select: { tags: true } }),
        ]);
        assert.deepEqual(releido1.tags, ['revisión']);
        assert.deepEqual(releido2.tags, ['moroso', 'revisión']);
        assert.equal(releidoLleno.tags.length, 20, '🔴 el lleno no debía cambiar de tamaño');
        assert.deepEqual(releidoDeB.tags, null, '🔴 el cliente de OTRO merchant no puede haber cambiado');

        // ── remove: quitar de los dos que la tienen ──
        const r2 = await etiquetarSeleccion(a.id, [libre1.id, libre2.id], 'remove', 'revisión');
        assert.equal(r2.actualizados, 2);
        const releido1b = await prisma.customer.findUnique({ where: { id: libre1.id }, select: { tags: true } });
        assert.deepEqual(releido1b.tags, null, '🔴 quitar la única etiqueta debe dejar NULL, no `[]`');

        // ── selección vacía: no revienta, no escribe nada ──
        const vacio = await etiquetarSeleccion(a.id, [], 'add', 'x');
        assert.deepEqual(vacio, { actualizados: 0, resultados: [] });
      }));
  } finally {
    await prisma.$disconnect();
  }
});
