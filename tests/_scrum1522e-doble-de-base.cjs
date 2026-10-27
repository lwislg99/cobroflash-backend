// tests/_scrum1522e-doble-de-base.cjs — SCRUM-1522e
//
// Una base en memoria para ver QUÉ se le pide a `merchant.create` en un alta, sin ninguna base de
// verdad. Se pone en el sitio de `dist/core/db/prisma.js` ANTES de que nadie lo cargue, así que el
// alta que corre detrás es la real: `registerMerchant` y, por delante, la consola del equipo.
//
// Dos usos, el mismo fichero:
//   · dentro del test:        require('./_scrum1522e-doble-de-base.cjs')  → { db, altas }
//   · delante de la consola:  node --require <este fichero> dist/.../altaDeMerchant.js …
//     Al acabar el proceso deja en el fichero de `SCRUM1522E_ALTAS_EN` lo que se pidió crear.
//
// Lo que NO es: Postgres. No sabe de tipos, de columnas ni de valores por defecto de la base. Que
// la columna reciba de verdad el valor lo mide `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`
// en el banco desechable.
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const altas = []; // el `data` de cada `merchant.create`, tal cual llegó
const filas = []; // lo que «quedó guardado»: el data más un id
const sinDoble = []; // lo que se pidió y este doble no sabe contestar

const comercio = {
  findUnique: async (a) => {
    const w = (a && a.where) || {};
    const fila = filas.find((f) => (w.email !== undefined && f.email === w.email)
      || (w.id !== undefined && f.id === w.id)
      || (w.referralCode !== undefined && f.referralCode === w.referralCode));
    return fila ? { ...fila } : null;
  },
  findFirst: async () => null,
  create: async (a) => {
    altas.push({ ...a.data });
    const fila = { id: filas.length + 1, lifecycleEmailsSent: null, createdAt: new Date(), ...a.data };
    filas.push(fila);
    return { ...fila };
  },
  update: async (a) => {
    const fila = filas.find((f) => f.id === a.where.id || f.email === a.where.email);
    if (fila) Object.assign(fila, a.data);
    return fila ? { ...fila } : {};
  },
  count: async () => filas.length,
};

// Cualquier otra tabla: no hay nadie, y lo que se cree se da por creado. Se apunta su nombre para
// que el test pueda decir sobre qué tablas se apoyó el alta además de `merchant`.
const otraTabla = (nombre) => new Proxy({}, {
  get: (_t, metodo) => async (a) => {
    sinDoble.push(`${nombre}.${String(metodo)}`);
    if (metodo === 'create') return { id: 1, ...((a && a.data) || {}) };
    if (metodo === 'count') return 0;
    if (metodo === 'findMany') return [];
    if (metodo === 'deleteMany' || metodo === 'updateMany') return { count: 0 };
    return null;
  },
});

const tablas = { merchant: comercio };
const db = new Proxy({}, {
  get: (_t, nombre) => {
    if (nombre === 'then') return undefined; // que nadie lo tome por una promesa
    if (nombre === '$disconnect' || nombre === '$connect') return async () => {};
    if (nombre === '$transaction') return async (cb) => (typeof cb === 'function' ? cb(db) : Promise.all(cb));
    if (typeof nombre !== 'string') return undefined;
    if (!tablas[nombre]) tablas[nombre] = otraTabla(nombre);
    return tablas[nombre];
  },
});

const fP = require.resolve(path.join(RAIZ, 'dist', 'core', 'db', 'prisma.js'));
require.cache[fP] = { id: fP, filename: fP, loaded: true, exports: { prisma: db } };

// Delante de la consola: lo visto se deja en un fichero al salir (lo nombra quien lanza, fuera del
// árbol). A fichero y no a la salida: escribir en una tubería al morir el proceso no es fiable igual
// en Windows que en Linux, y una línea perdida se leería como «no se creó nada».
if (process.env.SCRUM1522E_ALTAS_EN) {
  process.on('exit', () => {
    require('node:fs').writeFileSync(process.env.SCRUM1522E_ALTAS_EN, JSON.stringify({ altas, sinDoble }));
  });
}

module.exports = { db, altas, filas, sinDoble };
