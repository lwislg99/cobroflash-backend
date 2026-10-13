// SCRUM-94 — registerMerchant (POST /auth/register) solo comprobaba Merchant.email, nunca
// TeamMember.email. Un operario podía registrarse con SU email y crear un merchant nuevo; a
// partir de ahí su magic link daba precedencia a ese merchant (ver requestMagicLink) y perdía
// el acceso como operario, sin que el admin pudiera arreglarlo.
//
// Fix (opción 1): rechazar el alta (409 email_belongs_to_team) si el email es un TeamMember
// activo/invitado (suspended = ya no entra, se permite). Mensaje claro pero GENÉRICO (sin
// revelar la empresa). NO se crea ningún merchant fantasma.
//
// 🔴 8-oct-2026 · SCRUM-1515 (orden del fundador): `POST /auth/register` está CERRADA. Ya no da de
// alta a NADIE y contesta siempre el mismo 409 (`registration_closed`, con la frase firmada en
// SCRUM-1515 c.18971). Este test cambia PORQUE CAMBIA EL COMPORTAMIENTO, no para que pase:
//   · lo que vigilaba sigue vigilado y es más fuerte: el correo de un operario no acaba en un
//     merchant (ahora, ni el suyo ni el de nadie) y la respuesta no depende de la empresa (ahora,
//     ni del correo);
//   · los casos 4 y 5 decían «suspendido y correo nuevo SÍ se registran»: era el alta abierta. Hoy
//     reciben el mismo 409 y no se crea nada.
// El rechazo `email_belongs_to_team` sigue vivo en `registerMerchant` y lo ejercita el guion de
// alta (sale 4) en `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`, que SÍ corre en el
// obligatorio. ⚠️ Esta versión NO se ha ejecutado al escribirla: su gate es staging, y SCRUM-1515
// no tocó staging. Lo ejecutado está en el test de SCRUM-1515.
//
// ⚠️ GATEADO (crea/BORRA merchants + teamMembers efímeros; levanta la app):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-94: /auth/register rechaza el email de un operario (sin merchant fantasma ni fuga de empresa)', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  const reg = (email) => fetch(`${base}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Negocio Nuevo', email, country: 'ES' }) });

  // ⚠️ NO son fixtures nuestras: son los merchants que crearía la APLICACIÓN si la ruta volviera a
  // dar de alta (lo hacía con el operario suspendido y con el email nuevo). `withMerchant` no los
  // conoce ni puede borrarlos — se declaran fuera para que su limpieza sobreviva a todo lo de
  // dentro. Con la ruta cerrada no debería haber nada que borrar; si este test cae porque la ruta
  // dio de alta, esto es lo que impide dejar merchants reales en staging.
  const merchantsToClean = [];

  // SCRUM-113: el merchant de fixture y sus 3 teamMembers se montan DENTRO de withMerchant.
  // Antes se creaban arriba, fuera del try, y los `teamMember.create` SÍ pueden lanzar (un
  // email duplicado, un corte de conexión): cualquiera de los tres dejaba el merchant
  // huérfano en staging. Ahora el borrado está garantizado desde la primera línea.
  try {
    await withMerchant(
      prisma,
      { name: 'QA S94 Empresa SECRETA', email: `qa-s94-owner-${stamp}@test.local` },
      async (merchant) => {
        const activo = await prisma.teamMember.create({ data: { merchantId: merchant.id, name: 'QA S94 Activo', email: `qa-s94-activo-${stamp}@test.local`, role: 'tecnico', status: 'active' } });
        const invitado = await prisma.teamMember.create({ data: { merchantId: merchant.id, name: 'QA S94 Invitado', email: `qa-s94-invitado-${stamp}@test.local`, role: 'tecnico', status: 'invited' } });
        const suspendido = await prisma.teamMember.create({ data: { merchantId: merchant.id, name: 'QA S94 Suspendido', email: `qa-s94-suspendido-${stamp}@test.local`, role: 'tecnico', status: 'suspended' } });

        // 1 · operario ACTIVO → 409 y NO se crea merchant con su email (el bug creaba uno fantasma).
        const rA = await reg(activo.email);
        assert.equal(rA.status, 409, `registrar el email de un operario ACTIVO debe dar 409 y fue ${rA.status}`);
        const bA = await rA.json();
        assert.equal(bA.error, 'registration_closed', 'código de error esperado (la ruta está cerrada: SCRUM-1515)');
        assert.ok(bA.message && bA.message.length > 0, 'debe traer un mensaje claro');

        // 1b · FORMA FIJA (SCRUM-108, vía 1): el 409 no lleva NADA más que estas dos claves.
        // Cubre lo que una búsqueda de literales no puede ver: una clave nueva que alguien
        // añada al error el día de mañana (`merchantId`, `teamMemberId`, un `debug`) y que
        // arrastre datos sin que ningún assert de texto se entere.
        assert.deepEqual(Object.keys(bA).sort(), ['error', 'message'],
          'el 409 debe traer SOLO error y message: cualquier clave de más es una fuga potencial');
        assert.equal(await prisma.merchant.findUnique({ where: { email: activo.email } }), null, 'NO debe crearse un Merchant con el email del operario');

        // 2 · operario INVITADO → también 409 (también quedaría ensombrecido al volver).
        const rI = await reg(invitado.email);
        assert.equal(rI.status, 409, 'un operario INVITED también debe rechazarse');
        assert.equal(await prisma.merchant.findUnique({ where: { email: invitado.email } }), null, 'sin merchant fantasma para el invited');

        // 3 · ANTI-FUGA por INVARIANCIA (SCRUM-108, vía 2).
        //
        // ⚠️ ESTE SEGUNDO MERCHANT **NO SOBRA**. Si lo quitas, este assert deja de probar nada.
        //
        // Lo que hay que garantizar NO es «no aparece el nombre de la empresa» — eso es un
        // SÍNTOMA — sino la propiedad de verdad: **la respuesta NO DEPENDE del merchant**. Es
        // el objetivo anti-enumeración: que un atacante no pueda distinguir una empresa de otra
        // por lo que devuelve el endpoint. Y una propiedad así solo se comprueba CONTRASTANDO
        // dos respuestas de empresas distintas: si difieren en algo, ese algo viene del
        // merchant. Con un solo merchant no hay nada con qué contrastar.
        //
        // Antes esto se comprobaba buscando el literal 'SECRETA' (del nombre de la fixture) y
        // `merchant.name`. Dos problemas: renombrar la fixture dejaba medio assert ciego sin que
        // nada lo dijera, y solo cubría los nombres que alguien previó. La invariancia cubre
        // TODOS —los previstos y los que no— además de ids o tokens interpolados por accidente.
        await withMerchant(
          prisma,
          { name: 'QA S94 Otra Empresa Distinta', email: `qa-s94-owner-b-${stamp}@test.local` },
          async (merchantB) => {
            const activoB = await prisma.teamMember.create({
              data: { merchantId: merchantB.id, name: 'QA S94 Activo B', email: `qa-s94-activo-b-${stamp}@test.local`, role: 'tecnico', status: 'active' },
            });
            const rB = await reg(activoB.email);
            assert.equal(rB.status, 409, 'el operario de la otra empresa también debe dar 409');
            const bB = await rB.json();

            assert.deepEqual(bA, bB,
              'FUGA: el 409 debe ser IDÉNTICO sea cual sea la empresa del operario. Si difiere, ' +
              'algo del merchant se está filtrando en la respuesta y el endpoint permite ' +
              'distinguir unas empresas de otras (anti-enumeración, SCRUM-108).');
          },
        );

        // 4 · operario SUSPENDIDO y 5 · email NUEVO (ni merchant ni teammember): con el alta abierta
        // se registraban (200). Con la ruta CERRADA (SCRUM-1515) reciben EXACTAMENTE lo mismo que el
        // operario activo, y no se crea ningún merchant.
        const nuevoEmail = `qa-s94-nuevo-${stamp}@test.local`;
        merchantsToClean.push(suspendido.email, nuevoEmail);
        for (const email of [suspendido.email, nuevoEmail]) {
          const r = await reg(email);
          assert.equal(r.status, 409, `la ruta está cerrada: ${email} debe recibir 409 y fue ${r.status}`);
          assert.deepEqual(await r.json(), bA, 'la ruta cerrada contesta lo MISMO a un operario, a un suspendido y a un extraño');
          assert.equal(await prisma.merchant.findUnique({ where: { email } }), null, `LA RUTA CERRADA HA DADO DE ALTA a ${email}`);
        }

        t.diagnostic('SCRUM-94 tras SCRUM-1515: operario active/invited/suspended y email nuevo → el mismo 409, sin merchant; respuesta idéntica entre empresas ✓');
      },
    );
  } finally {
    // SOLO los merchants que creó la APP (ver la nota de `merchantsToClean` arriba). La
    // fixture y sus teamMembers los borra `withMerchant`; repetirlo aquí sobraría.
    for (const email of merchantsToClean) {
      const m = await prisma.merchant.findUnique({ where: { email } }).catch(() => null);
      if (m) {
        await prisma.authSession.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
        await prisma.teamMember.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
        await prisma.merchant.delete({ where: { id: m.id } }).catch(() => {});
      }
    }
    server.close();
    await prisma.$disconnect();
  }
});
