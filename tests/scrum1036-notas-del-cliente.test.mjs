// SCRUM-1036 (CRM-08) · LAS NOTAS DEL CLIENTE, CON FECHA Y AUTOR.
//
// `crearNota`/`listarNotas`/`resolverAutor` contra Postgres de verdad, que es donde viven las
// garantías: TENENCIA (dos merchants), el autor CONGELADO como texto (un miembro borrado después
// no deja huérfana la nota vieja), el orden estable, y la «Nota fija» sintetizada desde
// `Customer.notes` sin copiarla a `CustomerEvent` (nunca se inventa fecha ni autor de un texto que
// nunca los tuvo).
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

test('SCRUM-1036 · notas: tenencia, autor congelado, orden estable, Nota fija y texto vacío', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { crearNota, listarNotas, resolverAutor } = await import('../dist/modules/system/domain/notasDelCliente.js');
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'Fontanería QA 1036', email: `qa-1036-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 1036 B', email: `qa-1036-b-${stamp}@test.local` }, async (b) => {
        const tec = await prisma.teamMember.create({ data: { merchantId: a.id, name: 'Marta 1036', email: `tec-1036-${stamp}@test.local`, role: 'tecnico', status: 'active' } });
        const ana = await prisma.customer.create({ data: { merchantId: a.id, name: 'Ana 1036', notes: 'Cliente de toda la vida, prefiere WhatsApp' } });
        const sinNotaFija = await prisma.customer.create({ data: { merchantId: a.id, name: 'Sin fija 1036', notes: null } });
        const deB = await prisma.customer.create({ data: { merchantId: b.id, name: 'De B 1036' } });

        // ── resolverAutor ──
        const autorPropietario = await resolverAutor(a.id, null);
        assert.equal(autorPropietario.authorName, 'Fontanería QA 1036', '🔴 el propietario se congela con el nombre del NEGOCIO');
        const autorTecnico = await resolverAutor(a.id, tec.id);
        assert.equal(autorTecnico.authorName, 'Marta 1036');
        const autorFantasma = await resolverAutor(a.id, 999999);
        assert.equal(autorFantasma.authorName, 'Desconocido', '🔴 un id que no existe no puede inventar un nombre');

        // ── crearNota: texto vacío rechazado ──
        await assert.rejects(() => crearNota(a.id, ana.id, '   ', autorPropietario), /nota_vacia/);

        // ── crearNota: tenencia — no se puede anotar un cliente de otro merchant ──
        await assert.rejects(() => crearNota(a.id, deB.id, 'x', autorPropietario), /customer_not_found/);

        // ── crearNota: dos notas, la segunda del técnico ──
        const n1 = await crearNota(a.id, ana.id, '  Pide presupuesto de caldera  ', autorPropietario);
        const n2 = await crearNota(a.id, ana.id, 'Confirmado por WhatsApp', autorTecnico);
        assert.equal(n1.title, 'Pide presupuesto de caldera', '🔴 el texto se recorta pero no se toca de más');

        // ── listarNotas: más nueva primero, autor congelado, Nota fija al final ──
        const notas = await listarNotas(a.id, ana.id);
        assert.equal(notas.length, 3, '🔴 dos notas + la Nota fija');
        assert.equal(notas[0].id, n2.id, '🔴 la más nueva va primero');
        assert.equal(notas[0].autor, 'Marta 1036');
        assert.equal(notas[1].id, n1.id);
        assert.equal(notas[1].autor, 'Fontanería QA 1036');
        const fija = notas[notas.length - 1];
        assert.equal(fija.esFija, true, '🔴 la Nota fija tiene que ir la ÚLTIMA (la más antigua por construcción)');
        assert.equal(fija.texto, 'Cliente de toda la vida, prefiere WhatsApp');
        assert.equal(fija.fecha, null, '🔴 ausente ≠ vacío: no se inventa una fecha que nunca existió');
        assert.equal(fija.autor, null, '🔴 no se inventa un autor que nunca se declaró');

        // ── el texto viejo NO se borra de Customer.notes ──
        const releido = await prisma.customer.findUnique({ where: { id: ana.id }, select: { notes: true } });
        assert.equal(releido.notes, 'Cliente de toda la vida, prefiere WhatsApp', '🔴 el campo legado no se toca');

        // ── un `notes` vacío no sintetiza «Nota fija» ──
        const notasSinFija = await listarNotas(a.id, sinNotaFija.id);
        assert.equal(notasSinFija.length, 0);
        assert.ok(!notasSinFija.some((n) => n.esFija), '🔴 un notes vacío no puede sintetizar una Nota fija');

        // ── tenencia: un cliente de OTRO merchant no se ve ──
        assert.equal(await listarNotas(a.id, deB.id), null, '🔴 un cliente de OTRO merchant devuelve notas (debía ser 404)');

        // ── el autor de una nota vieja se conserva aunque el técnico se borre ──
        await prisma.teamMember.delete({ where: { id: tec.id } });
        const trasBorrar = await listarNotas(a.id, ana.id);
        const deLaTecnicaBorrada = trasBorrar.find((n) => n.id === n2.id);
        assert.equal(deLaTecnicaBorrada.autor, 'Marta 1036', '🔴 el autor se CONGELÓ al escribir: borrar al técnico no puede dejar la nota sin autor');
      }));
  } finally {
    await prisma.$disconnect();
  }
});
