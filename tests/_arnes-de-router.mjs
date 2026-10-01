// tests/_arnes-de-router.mjs — SCRUM-1344
//
// EL ÚNICO SITIO DONDE SE CONSTRUYE UN `req` CON FORMA DE SESIÓN PARA UN TEST.
//
// En producción, todo lo que cuelga de `/admin` pasa antes por `requireAuth`
// (`src/core/http/authMiddleware.ts`), que escribe `req.merchantId` y `req.userRole` juntos: el
// propietario es `admin`, y un miembro del equipo lleva el rol de su ficha. NO EXISTE un `req` con
// comercio y sin rol.
//
// Un arnés que arma `{ merchantId: 7, params: … }` a mano describe a ese llamante imposible, y pasa
// dos cosas, las dos medidas en SCRUM-1344:
//
//   · si llama al handler sacándolo de `route.stack`, se salta el `requireRole` de la ruta y el del
//     montaje, y el test sale verde sobre una ruta que en producción le contestaría 403;
//   · si pasa por el router, el día que alguien declara un rol en esa ruta el test cae con un
//     `403 !== 200` que parece culpa del que cerró la ruta (así cayó `scrum960` en SCRUM-1317).
//
// Por eso el rol NO tiene valor por defecto: quien escribe el arnés dice a quién describe.
//
//     import { reqDeSesion } from './_arnes-de-router.mjs';
//     await handler(reqDeSesion({ rol: 'admin', merchantId: 7, params: { id: '3' } }), res);
//
// Lo que hace cumplir que se use: `tests/scrum1344-arnes-de-prueba-con-rol.test.mjs`.

/** Los roles que `requireAuth` puede poner hoy en una sesión. */
export const ROLES_DE_SESION = Object.freeze(['admin', 'tecnico']);

/**
 * Un `req` de sesión: lo que se le pase, más `userRole`.
 *
 * No inventa nada más (ni `headers`, ni `query`, ni `teamMemberId`): un arnés que antes no los
 * llevaba sigue sin llevarlos, y así cambiar a este constructor no cambia lo que el test mide.
 *
 * @param {{ rol: 'admin' | 'tecnico', merchantId: number | string } & Record<string, unknown>} datos
 */
export function reqDeSesion(datos) {
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new TypeError('reqDeSesion: se llama con un objeto — reqDeSesion({ rol: \'admin\', merchantId: 7, … })');
  }
  const { rol, ...resto } = datos;
  if (!ROLES_DE_SESION.includes(rol)) {
    throw new Error(
      `reqDeSesion: falta el rol (recibido: ${JSON.stringify(rol)}). Una sesión de /admin lleva SIEMPRE `
      + `merchantId y userRole juntos — los pone requireAuth —, así que di a quién describes: `
      + `rol: 'admin' (el propietario) o rol: 'tecnico' (el operario). No hay valor por defecto a propósito.`,
    );
  }
  if (resto.merchantId === undefined || resto.merchantId === null) {
    throw new Error(
      'reqDeSesion: falta merchantId. Un `req` sin comercio no es de sesión: si la ruta es pública '
      + '(un webhook, la página del cliente), su `req` se arma a mano y sin rol.',
    );
  }
  if ('userRole' in resto) {
    throw new Error('reqDeSesion: el rol se declara UNA vez, con `rol`. Quita `userRole` del objeto.');
  }
  return { ...resto, userRole: rol };
}
