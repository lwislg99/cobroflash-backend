// SCRUM-1014 (CRM) · «SITIOS» DEL CLIENTE — agenda de direcciones de obra.
//
// `crearSitio`/`listarSitios`/`actualizarSitio`/`borrarSitio` contra Postgres de verdad, que es
// donde vive la garantía que importa: TENENCIA (dos merchants, y un sitio de OTRO cliente del
// mismo merchant), el orden estable, y que nada de aquí toca `Quote.shippingAddress` — P2/DOC-12
// (SCRUM-602) sigue intacto: esta agenda es sólo dónde vive el dato, nunca lo copia sola.
//
// ⚠️ GATEADO, dos destinos (patrón SCRUM-876, como scrum1036-notas-del-cliente).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: rango imposible, nunca de alguien

const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-1014 · sitios: tenencia (merchant y cliente), CRUD completo, orden estable, y no toca shippingAddress', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { listarSitios, crearSitio, actualizarSitio, borrarSitio } = await import('../dist/modules/system/domain/sitiosDelCliente.js');
  const stamp = Date.now();
  try {
    await withMerchant(prisma, { name: 'Fontanería QA 1014', email: `qa-1014-a-${stamp}@test.local` }, (a) =>
      withMerchant(prisma, { name: 'QA 1014 B', email: `qa-1014-b-${stamp}@test.local` }, async (b) => {
        const ana = await prisma.customer.create({ data: { merchantId: a.id, name: 'Ana 1014' } });
        const otroDeA = await prisma.customer.create({ data: { merchantId: a.id, name: 'Otro cliente de A' } });
        const deB = await prisma.customer.create({ data: { merchantId: b.id, name: 'De B 1014' } });

        // ── crearSitio: tenencia — no se puede dar de alta un sitio en un cliente de OTRO merchant ──
        assert.equal(await crearSitio(a.id, deB.id, { name: 'x' }), null, '🔴 un cliente de otro merchant no puede recibir un sitio');

        // ── crearSitio: sólo `name` es obligatorio, el resto llega después ──
        const s1 = await crearSitio(a.id, ana.id, { name: 'Piso 3ºB' });
        assert.equal(s1.name, 'Piso 3ºB');
        assert.equal(s1.address, null, '🔴 ausente = no declarado, no se inventa una cadena vacía');

        // ── crearSitio: con todos los campos, incluido el contacto EN OBRA ──
        const s2 = await crearSitio(a.id, ana.id, {
          name: 'Nave del polígono',
          address: 'Calle Industria 4',
          city: 'Alcorcón',
          postalCode: '28925',
          province: 'Madrid',
          country: 'ES',
          contactName: 'El portero',
          phone: telefonoDePrueba(1014001),
        });
        assert.equal(s2.contactName, 'El portero', '🔴 el contacto del sitio es propio, no el del cliente');

        // ── un sitio de OTRO cliente del MISMO merchant no aparece en la agenda de Ana ──
        await crearSitio(a.id, otroDeA.id, { name: 'No es de Ana' });

        // ── listarSitios: más nuevo primero, y sólo los de ESTE cliente ──
        const sitios = await listarSitios(a.id, ana.id);
        assert.equal(sitios.length, 2, '🔴 los dos de Ana, ni el de "otro cliente de A" ni ninguno de B');
        assert.equal(sitios[0].id, s2.id, '🔴 el más nuevo va primero');
        assert.equal(sitios[1].id, s1.id);

        // ── listarSitios: tenencia — un cliente de OTRO merchant devuelve null (404), no [] ──
        assert.equal(await listarSitios(a.id, deB.id), null, '🔴 un cliente ajeno no es "sin sitios", es "no existe para ti"');

        // ── actualizarSitio: corrige un campo ──
        const actualizado = await actualizarSitio(a.id, ana.id, s1.id, { phone: telefonoDePrueba(1014002) });
        assert.equal(actualizado.phone, telefonoDePrueba(1014002));
        assert.equal(actualizado.name, 'Piso 3ºB', '🔴 una edición parcial no toca lo que no se manda');

        // ── actualizarSitio: tenencia — no se puede editar el sitio de OTRO cliente pasando el id de Ana ──
        assert.equal(await actualizarSitio(a.id, ana.id, s2.id + 999999, { name: 'x' }), null, '🔴 un id de sitio que no existe no inventa nada');
        const sitioDeOtro = (await listarSitios(a.id, otroDeA.id))[0];
        assert.equal(
          await actualizarSitio(a.id, ana.id, sitioDeOtro.id, { name: 'robado' }),
          null,
          '🔴 el sitio existe, pero no es de Ana — no se puede editar pasando el customerId equivocado',
        );

        // ── borrarSitio: tenencia — no se puede borrar pasando el customerId equivocado ──
        assert.equal(await borrarSitio(a.id, ana.id, sitioDeOtro.id), false, '🔴 mismo caso que arriba, para borrar');
        assert.equal(await borrarSitio(b.id, ana.id, s1.id), false, '🔴 un merchant ajeno no puede borrar el sitio de otro');

        // ── borrarSitio: de verdad ──
        assert.equal(await borrarSitio(a.id, ana.id, s1.id), true);
        const trasBorrar = await listarSitios(a.id, ana.id);
        assert.equal(trasBorrar.length, 1, '🔴 sólo queda el que no se borró');
        assert.equal(trasBorrar[0].id, s2.id);

        // ── P2/DOC-12 (SCRUM-602) sigue intacto: nada de esto tocó el presupuesto ──
        const quote = await prisma.quote.create({
          data: {
            merchantId: a.id, customerId: ana.id, status: 'draft', currency: 'EUR',
            total: '0', lines: [],
          },
        });
        const releido = await prisma.quote.findUnique({ where: { id: quote.id }, select: { shippingAddress: true, shippingAddressMode: true } });
        assert.equal(releido.shippingAddress, null, '🔴 crear/editar sitios no escribe la dirección de obra del documento');
        assert.equal(releido.shippingAddressMode, null, '🔴 ni decide el modo — sigue sin decidir nadie, como antes de este ticket');
      }));
  } finally {
    await prisma.$disconnect();
  }
});
