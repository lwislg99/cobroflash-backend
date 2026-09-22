// tests/_banco-camino-real.mjs — SCRUM-597 (DOC-07)
//
// EL BANCO QUE EJERCITA LA APP DE VERDAD, SIN NINGUNA BASE DE DATOS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, Y POR QUÉ NO SE LEE EL FUENTE
//
// Un permiso comprobado sobre el fuente responde «el filtro está escrito», no «el dato no sale».
// Son distintas: `SCRUM-467` lo dice en su propia cabecera y se conforma con la primera porque
// montar Express + Prisma «exigiría base, y el gate la dejaría fuera de la tanda normal — un
// permiso que solo se comprueba cuando alguien se acuerda de correr el gate no está comprobado».
//
// Este banco quita esa disyuntiva. Arranca **la app real** —el mismo `dist/app.js` de producción,
// con su `requireAuth`, su `requireRole` y sus handlers— y le habla por HTTP de verdad. Lo único
// que se sustituye es el ORIGEN DE LOS DATOS.
//
// EL MECANISMO, y no es un truco: `dist/core/db/prisma.js` construye el cliente como
// `globalForPrisma.prisma ?? new PrismaClient()`. Poniendo `globalThis.prisma` ANTES del primer
// require, la app adopta el doble y **no se llega a construir ningún PrismaClient**: cero
// conexiones, cero credenciales, cero staging (el encargo de SCRUM-597 lo prohíbe expresamente).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UN SOLO DOBLE POR PROCESO, Y NO ES UNA COMODIDAD: ES LA CORRECCIÓN DE UN VERDE FALSO
//
// La primera versión creaba un doble por test. El segundo NO se adoptaba —`prisma.js` ya estaba
// en la caché de módulos con el primero dentro— así que del test 2 en adelante la app hablaba con
// un doble que nadie había programado. Lo cazó el suelo de `montarAppReal`, que compara la
// identidad; sin esa comprobación habrían salido siete verdes que no medían nada.
//
// Por eso el doble es ÚNICO y se REPROGRAMA: `programar()` cambia lo que devuelve cada tabla y
// `reiniciar()` vacía el registro de escrituras entre casos.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const OPS_DE_ESCRITURA = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];

/** Una tabla del doble: todo devuelve vacío salvo lo que el test programe. */
function tablaVacia() {
  return {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    count: async () => 0,
    create: async (a) => a?.data ?? null,
    createMany: async () => ({ count: 0 }),
    update: async (a) => a?.data ?? null,
    updateMany: async () => ({ count: 0 }),
    upsert: async (a) => a?.create ?? null,
    delete: async () => null,
    deleteMany: async () => ({ count: 0 }),
    aggregate: async () => ({}),
    groupBy: async () => [],
  };
}

/**
 * EL DOBLE. `escrituras` guarda TODA escritura que reciba, que es lo que permite afirmar la
 * regla 29: no que «no se quiso» tocar la factura, sino que NO SE TOCÓ.
 */
function crearDoble() {
  const estado = { escrituras: [], programadas: {} };
  const cache = new Map();

  const tablaDe = (modelo) => {
    if (!cache.has(modelo)) {
      const t = {};
      // Las lecturas delegan en lo PROGRAMADO en cada momento — por eso se resuelven en la
      // llamada y no al construir: reprogramar entre tests tiene que verse desde el mismo objeto.
      for (const op of Object.keys(tablaVacia())) {
        t[op] = async (args) => {
          const prog = estado.programadas[modelo] || {};
          const fn = prog[op] || tablaVacia()[op];
          if (OPS_DE_ESCRITURA.includes(op)) estado.escrituras.push({ modelo, op, args });
          return fn(args);
        };
      }
      cache.set(modelo, t);
    }
    return cache.get(modelo);
  };

  const base = {
    $connect: async () => {}, $disconnect: async () => {}, $on: () => {},
    $queryRaw: async () => [], $executeRaw: async () => 0,
    get escrituras() { return estado.escrituras; },
    /** Cambia lo que devuelven las tablas y vacía el registro de escrituras. */
    programar(tablas) { estado.programadas = tablas || {}; estado.escrituras = []; return this; },
    reiniciar() { estado.escrituras = []; return this; },
  };

  const proxy = new Proxy(base, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop !== 'string') return undefined;
      // La transacción entrega EL MISMO doble, para que lo que se escriba dentro quede anotado
      // en el mismo registro: si entregara otra cosa, la regla 29 se comprobaría sobre un objeto
      // que no es el que la app usó.
      if (prop === '$transaction') {
        return async (x) => (typeof x === 'function' ? x(proxy) : Promise.all(x));
      }
      return tablaDe(prop);
    },
  });
  return proxy;
}

const doble = crearDoble();
let montada = null;

/** El doble único del proceso. Se programa con `programar(tablas)`. */
export function bancoDePrisma() { return doble; }

/**
 * Arranca la app REAL con el doble puesto. Idempotente: una sola app y un solo doble por proceso.
 *
 * ⚠️ El doble se pone ANTES de requerir nada de `dist/`, y se comprueba que la app lo haya
 * adoptado. Sin esa comprobación, un cambio en `prisma.ts` dejaría este banco hablando con una
 * base real sin que nadie se enterase — y eso, en un test de permisos, es lo peor que puede pasar.
 */
export async function montarAppReal() {
  if (montada) return montada;

  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.DISABLE_CRONS = 'true';
  globalThis.prisma = doble;

  const { prisma } = require('../dist/core/db/prisma.js');
  assert.equal(prisma, doble,
    '🔴 SUELO: la app NO ha adoptado el doble — está hablando con otro cliente de Prisma. Todo lo '
    + 'que midiera este banco a partir de aquí sería falso, y encima contra una base de verdad.');

  const { app } = require('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  montada = {
    base,
    doble,
    cerrar: () => new Promise((r) => server.close(r)),
    /** Una petición como la haría el navegador del profesional. */
    async pedir(ruta, { token, metodo = 'GET', cuerpo } = {}) {
      const res = await fetch(`${base}${ruta}`, {
        method: metodo,
        headers: {
          ...(token ? { cookie: `pf_session=${token}` } : {}),
          ...(cuerpo ? { 'content-type': 'application/json' } : {}),
        },
        ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
      });
      const texto = await res.text();
      let json = null;
      try { json = JSON.parse(texto); } catch { /* no era JSON: se devuelve el texto */ }
      return { status: res.status, json, texto };
    },
  };
  return montada;
}

/**
 * Las sesiones del banco. `authSession.findUnique` resuelve por token, igual que `getSession`.
 *
 * 🔴 EL PROPIETARIO SE MODELA COMO LO QUE ES: una sesión con `teamMemberId = null`. No tiene fila
 * en `team_members` y `requireAuth` le sintetiza el rol `admin`. Inventarle un TeamMember con
 * `role: 'admin'` mediría OTRA COSA —un administrador— y dejaría al propietario sin probar, que
 * es justo el caso que la firma P-DOC-3 nombra primero.
 */
export function sesionesDe(merchantId, tecnico) {
  const merchant = {
    id: merchantId, name: 'QA 597', email: 'qa597@test.local',
    plan: 'pro', planExpiresAt: null, onboardingCompleted: true, isPlatformOwner: false,
  };
  const dentroDeUnaHora = new Date(Date.now() + 3600_000);
  const porToken = {
    'TOKEN-PROPIETARIO': { id: 1, merchantId, teamMemberId: null, type: 'session', expiresAt: dentroDeUnaHora, merchant, teamMember: null },
    'TOKEN-TECNICO': { id: 2, merchantId, teamMemberId: tecnico.id, type: 'session', expiresAt: dentroDeUnaHora, merchant, teamMember: tecnico },
  };
  return {
    merchant,
    tabla: { findUnique: async (a) => porToken[a?.where?.token] ?? null },
    PROPIETARIO: 'TOKEN-PROPIETARIO',
    TECNICO: 'TOKEN-TECNICO',
  };
}
