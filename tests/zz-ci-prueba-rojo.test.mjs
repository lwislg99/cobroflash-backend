// ⚠️ FICHERO DE PRUEBA — NO MERGEAR. Existe solo para verificar EN ROJO el CI de SCRUM-154.
//
// Reproduce EXACTAMENTE la rotura que dejó `main` en rojo el 27-jul-2026: un test que crea
// un merchant A MANO, sin `withMerchant`. Eso dispara el ratchet de SCRUM-113 ("ningún
// fichero NUEVO nace con el patrón viejo"), que es un guard SIN gate y por tanto corre en
// el CI.
//
// Se eligió este fallo y no un `assert.fail()` cualquiera a propósito: lo que hay que
// demostrar no es "el CI ejecuta tests", sino "el CI caza la clase de rotura que nos dejó
// main en rojo y que nadie vio hasta después del merge".
//
// El test está en `skip` y aun así el guard debe cazarlo: el ratchet LEE el fichero, no lo
// ejecuta. Por eso tampoco toca ninguna BD.
//
// Si el check de este PR NO sale rojo, el CI no sirve: sería un semáforo que solo sabe
// ponerse en verde. Se borra en cuanto se compruebe, y la rama entera detrás.
import test from 'node:test';

test('prueba del CI: este fichero crea un merchant a mano a propósito', { skip: true }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.merchant.create({ data: { name: 'no se ejecuta', email: 'no@ejecuta.test' } });
});
