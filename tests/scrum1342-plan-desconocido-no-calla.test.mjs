// SCRUM-1342 · UN PLAN MAL ESCRITO DEJA LA CUENTA EN 1 USUARIO Y NO LO DICE — medido por EFECTO y SIN BASE.
//
// `src/core/entitlements.ts` es el único sitio donde el plan se traduce a límites (regla 34). Tres
// cosas estaban mal a la vez, y las tres se miden aquí ejecutando el código de producción:
//
//   ① `prisma/schema.prisma` documentaba en el campo `plan` otra lista (`trial | basic | pro |
//      empresa`): dos nombres que no existen y ninguno de los dos que faltan. El plan Equipo es
//      «oferta manual» (W1): se pone a mano, y quien lo pone lee el nombre en ese comentario.
//   ② un plan PRESENTE y desconocido caía a `trial` sin decir nada: el nombre más grande daba el
//      límite más pequeño, en silencio.
//   ③ y lo que el ticket daba por hecho no era verdad entera: `BY_PLAN[plan] ?? BY_PLAN.trial`
//      NO era fail-closed. `BY_PLAN` es un objeto literal, así que `BY_PLAN['constructor']`,
//      `['toString']` o `['__proto__']` no son `undefined` (se heredan de Object.prototype), el `??`
//      no saltaba y salía algo SIN `maxUsers`. En la ruta, `1 + activos >= undefined` es `false`:
//      una cuenta con ese plan no tenía límite de usuarios. Medido sobre `d2ed6c8a` antes de tocar.
//
// 🔴 LO QUE DECIDE SI EL ARREGLO SOBREVIVE: `null` y `undefined` NO son un error — es un merchant que
//    la ruta no encontró, o un llamante sin dato — y tienen que seguir dando `trial` SIN RUIDO. Un
//    aviso que salta también ahí llena los logs y alguien lo quita en un mes. Por eso cada caso de
//    «no avisa» va con su caso de «sí avisa» sobre la MISMA escucha: un cero de una escucha sorda se
//    lee igual que un cero de verdad.
//
// ⛔ LO QUE ESTE FICHERO FIJA Y NO DECIDE: los límites de los cuatro planes son decisión de producto
//    del fundador (Parte W3). Si este test cae porque alguien cambió un número, no se arregla el
//    test: se enseña la decisión.
//
// QUÉ SE DOBLA Y QUÉ NO. Se dobla la base. La ruta `POST /admin/team`, su `requireRole` y
// `getEntitlements` son el código de producción; la petición entra por el ROUTER, no por el handler
// sacado de `route.stack`, así que cruza el gate de rol como en producción.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4342;
const CORREO_DEL_DUENO = 'duena@example.invalid';

// ── LA BASE DOBLADA ──────────────────────────────────────────────────────────────────────
// `merchant.findFirst` es la PRIMERA consulta de `createTeamMember`: si se llega a ella, el límite
// de usuarios se ha cruzado. Contesta que el correo es del propietario, así que la ruta responde
// 409 `email_is_owner` sin crear nada. Ése es el testigo de «pasó la puerta».
const estado = { plan: undefined, hayMerchant: true, activos: 0, cruzoLaPuerta: 0 };

const doble = dobleDeLaBase({
  'merchant.findUnique': () => (estado.hayMerchant ? { name: 'Reformas de prueba', plan: estado.plan } : null),
  'teamMember.count': () => estado.activos,
  'merchant.findFirst': () => { estado.cruzoLaPuerta += 1; return { id: M, email: CORREO_DEL_DUENO }; },
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

const ent = requiere(rutaDe('dist/core/entitlements.js'));
const { getEntitlements } = ent;
const m = requiere(rutaDe('dist/modules/team/app/routes/team.routes.js'));
const router = m.default || m;

// ── LA ESCUCHA ───────────────────────────────────────────────────────────────────────────
/** Ejecuta `fn` y devuelve lo que devolvió más los avisos (`console.warn`) que salieron mientras. */
async function escuchando(fn) {
  const original = console.warn;
  const avisos = [];
  console.warn = (...a) => { avisos.push(a.map(String).join(' ')); };
  try {
    return { valor: await fn(), avisos };
  } finally {
    console.warn = original;
  }
}

/** `POST /admin/team` por el router de producción, con sesión de propietario. */
function invitar({ plan, activos, hayMerchant = true }) {
  Object.assign(estado, { plan, activos, hayMerchant, cruzoLaPuerta: 0 });
  return escuchando(() => new Promise((resolve, reject) => {
    const r = { statusCode: 200, cuerpo: undefined };
    const res = {
      status(c) { r.statusCode = c; return res; },
      json(x) { r.cuerpo = x; resolve(r); return res; },
    };
    const req = reqDeSesion({
      rol: 'admin', merchantId: M, method: 'POST', url: '/', headers: {},
      body: { name: 'Operaria de prueba', email: CORREO_DEL_DUENO },
    });
    const errores = console.error;
    console.error = () => {}; // la ruta imprime el `email_is_owner` que provocamos a propósito
    Promise.resolve()
      .then(() => router.handle(req, res, (e) => reject(e || new Error('🔴 CIEGO: el router no encontró POST / en team.routes'))))
      .catch(reject)
      .finally(() => { setImmediate(() => { console.error = errores; }); });
  }));
}

const LIMITES_DE_TRIAL = { maxUsers: 1, waFairUseMonthly: 300 };

// Lo que el fundador firmó en `docs/YAQU_MASTER.md`, Parte W (SCRUM-1342): W3, 1 usuario Pro y 5
// Equipo; W2, fair use 300 y 1.000; W1, Founding es Pro con otro precio. `trial` NO tiene número
// propio en la Parte W: se fija el que `entitlements.ts` ya daba («prueba = como Pro»).
// NO se deriva del código: si se derivara, no fijaría nada.
const LIMITES_FIRMADOS = {
  trial: { maxUsers: 1, waFairUseMonthly: 300 },
  pro: { maxUsers: 1, waFairUseMonthly: 300 },
  founding: { maxUsers: 1, waFairUseMonthly: 300 },
  equipo: { maxUsers: 5, waFairUseMonthly: 1000 },
};

// ── LOS CUATRO PLANES CONOCIDOS NO SE MUEVEN ─────────────────────────────────────────────

test('SCRUM-1342 · ✅ los CUATRO planes conocidos dan exactamente sus límites, y sin un solo aviso', async () => {
  const nombres = Object.keys(LIMITES_FIRMADOS);
  assert.equal(nombres.length, 4, 'población: cuatro planes');
  const { valor, avisos } = await escuchando(() => nombres.map((p) => [p, getEntitlements(p)]));
  for (const [plan, limites] of valor) {
    assert.deepEqual({ ...limites }, LIMITES_FIRMADOS[plan],
      `🔴 EL PLAN «${plan}» HA CAMBIADO DE LÍMITES. SCRUM-1342 no cambia ninguno: es decisión del fundador (W3, regla 34).`);
  }
  assert.deepEqual(avisos, [], '🔴 un plan CONOCIDO no avisa: si avisa, los logs se llenan y el aviso se acaba quitando');
});

test('SCRUM-1342 · ✅ la lista de planes que existen se exporta y es la de entitlements, ni uno más ni uno menos', () => {
  assert.ok(Array.isArray(ent.PLANES_CONOCIDOS),
    '🔴 `entitlements.ts` no exporta `PLANES_CONOCIDOS`: sin eso, quien quiera saber qué planes existen vuelve a escribir su propia lista');
  assert.deepEqual([...ent.PLANES_CONOCIDOS].sort(), Object.keys(LIMITES_FIRMADOS).sort());
  assert.ok(Object.isFrozen(ent.PLANES_CONOCIDOS), 'y no se puede alargar desde fuera');
});

// ── PRESENTE Y DESCONOCIDO: CAE A TRIAL (COMO ANTES) Y AHORA LO DICE ─────────────────────

const DESCONOCIDOS = ['empresa', 'basic', 'Equipo', 'equipo ', 'EQUIPO', ''];

test('SCRUM-1342 · 🔴 un plan PRESENTE y desconocido sigue cayendo a trial, y deja UN aviso con el valor recibido', async () => {
  assert.equal(DESCONOCIDOS.length, 6, 'población: seis valores, entre ellos los dos que documentaba el esquema');
  for (const plan of DESCONOCIDOS) {
    const { valor, avisos } = await escuchando(() => getEntitlements(plan));
    assert.deepEqual({ ...valor }, LIMITES_DE_TRIAL, `«${plan}» no abre ningún límite: cae a trial (fail-closed, no se toca)`);
    assert.equal(avisos.length, 1,
      `🔴 «${plan}» HA CAÍDO A TRIAL EN SILENCIO. Es el defecto de SCRUM-1342: quien lo escribió a mano ve `
      + `«Tu plan incluye 1 usuario» y nada le dice que el nombre del plan no existe. Avisos: ${JSON.stringify(avisos)}`);
    assert.ok(avisos[0].includes(JSON.stringify(plan)),
      `el aviso trae el valor RECIBIDO, entre comillas (se ve un espacio de más): ${avisos[0]}`);
    for (const conocido of Object.keys(LIMITES_FIRMADOS)) {
      assert.ok(avisos[0].includes(conocido), `y dice los que SÍ existen (falta «${conocido}»): ${avisos[0]}`);
    }
  }
});

test('SCRUM-1342 · ✅ el aviso dice de QUIÉN es el plan cuando el llamante lo sabe, y no se rompe cuando no', async () => {
  const con = await escuchando(() => getEntitlements('empresa', { merchantId: M }));
  assert.equal(con.avisos.length, 1);
  assert.ok(con.avisos[0].includes(`merchant ${M}`), `un rastro que no identifica el caso es ruido: ${con.avisos[0]}`);
  const sin = await escuchando(() => getEntitlements('empresa'));
  assert.equal(sin.avisos.length, 1);
  assert.deepEqual({ ...sin.valor }, LIMITES_DE_TRIAL);
});

// ── AUSENTE NO ES DESCONOCIDO ────────────────────────────────────────────────────────────

test('SCRUM-1342 · 🔴 AUSENTE NO ES DESCONOCIDO: null y undefined dan trial SIN aviso (y la escucha oye)', async () => {
  const { valor, avisos } = await escuchando(() => [getEntitlements(null), getEntitlements(undefined), getEntitlements()]);
  assert.equal(valor.length, 3, 'población: tres formas de no traer plan');
  for (const limites of valor) assert.deepEqual({ ...limites }, LIMITES_DE_TRIAL);
  assert.equal(avisos.length, 0,
    `🔴 EL AVISO SALTA SIN PLAN. Un merchant sin dato no es un error; así se llenan los logs y el aviso `
    + `acaba quitado. Avisos: ${JSON.stringify(avisos)}`);
  // La MISMA escucha, en la misma prueba, sobre el caso que sí avisa: el cero de arriba no es sordera.
  const control = await escuchando(() => [getEntitlements(null), getEntitlements('empresa'), getEntitlements(undefined)]);
  assert.equal(control.avisos.length, 1, 'control positivo: mezclado con dos ausentes, el desconocido se oye, y solo él');
});

// ── EL AGUJERO: UN NOMBRE HEREDADO DE Object NO ES UN PLAN ───────────────────────────────

const HEREDADOS = [...new Set([...Object.getOwnPropertyNames(Object.prototype), '__proto__'])];

test('SCRUM-1342 · 🔴 un plan con nombre heredado de Object (constructor, toString, __proto__…) NO abre el límite', async () => {
  for (const obligado of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.ok(HEREDADOS.includes(obligado), `🔴 CIEGO: la población no trae «${obligado}»`);
  }
  assert.ok(HEREDADOS.length >= 12, `población: ${HEREDADOS.length} nombres propios de Object.prototype`);
  const abiertos = [];
  for (const plan of HEREDADOS) {
    const { valor, avisos } = await escuchando(() => getEntitlements(plan));
    if (!(valor && valor.maxUsers === 1 && valor.waFairUseMonthly === 300)) abiertos.push(`${plan} → ${typeof valor}, maxUsers=${valor?.maxUsers}`);
    else assert.equal(avisos.length, 1, `«${plan}» es un valor presente y desconocido: avisa`);
  }
  assert.deepEqual(abiertos, [],
    `\n🔴 EL FALLBACK NO ES FAIL-CLOSED. ${abiertos.length} de ${HEREDADOS.length} nombres devuelven algo sin límite de usuarios:\n`
    + abiertos.map((a) => `   · ${a}`).join('\n')
    + '\n`BY_PLAN[plan]` encuentra lo que el objeto HEREDA. Se pregunta solo por claves PROPIAS.\n');
});

// ── POR LA RUTA: LO QUE VE QUIEN INVITA ──────────────────────────────────────────────────

test('SCRUM-1342 · ✅ CONTROL POSITIVO de la ruta: con plan `equipo` y 3 miembros, la puerta SE CRUZA y nadie avisa', async () => {
  const { valor, avisos } = await invitar({ plan: 'equipo', activos: 3 });
  assert.equal(estado.cruzoLaPuerta, 1, '🔴 MUDO: con sitio libre no se llegó a createTeamMember; el banco no sabe ver una puerta cruzada');
  assert.equal(valor.statusCode, 409);
  assert.equal(valor.cuerpo.error, 'email_is_owner', 'el testigo: se paró DESPUÉS del límite, en la primera consulta del alta');
  assert.deepEqual(avisos, []);
});

test('SCRUM-1342 · ✅ con plan `equipo` y la cuenta llena, 409 `user_limit` con sus 5', async () => {
  const { valor, avisos } = await invitar({ plan: 'equipo', activos: 4 });
  assert.equal(estado.cruzoLaPuerta, 0);
  assert.equal(valor.statusCode, 409);
  assert.equal(valor.cuerpo.error, 'user_limit');
  assert.equal(valor.cuerpo.maxUsers, 5);
  assert.deepEqual(avisos, []);
});

test('SCRUM-1342 · 🔴 con plan `empresa`, la ruta sigue contestando 1 usuario — y AHORA queda escrito por qué, con el merchant', async () => {
  const { valor, avisos } = await invitar({ plan: 'empresa', activos: 0 });
  assert.equal(estado.cruzoLaPuerta, 0, 'fail-closed: no se toca');
  assert.equal(valor.statusCode, 409);
  assert.equal(valor.cuerpo.error, 'user_limit');
  assert.equal(valor.cuerpo.maxUsers, 1);
  assert.equal(avisos.length, 1,
    `🔴 LA RUTA HA NEGADO EL SEGUNDO USUARIO POR UN PLAN QUE NO EXISTE Y NO HA DEJADO RASTRO. Avisos: ${JSON.stringify(avisos)}`);
  assert.ok(avisos[0].includes('"empresa"'), avisos[0]);
  assert.ok(avisos[0].includes(`merchant ${M}`), `la ruta sabe de quién es el plan y lo dice: ${avisos[0]}`);
});

test('SCRUM-1342 · 🔴 con plan `constructor` y 3 miembros, la ruta NO deja entrar al quinto usuario', async () => {
  const { valor } = await invitar({ plan: 'constructor', activos: 3 });
  assert.equal(estado.cruzoLaPuerta, 0,
    '🔴 UNA CUENTA CON UN PLAN DESCONOCIDO HA CRUZADO EL LÍMITE DE USUARIOS. `maxUsers` salió undefined y '
    + '`1 + activos >= undefined` es false: sin límite. El fallback tiene que caer a trial de verdad.');
  assert.equal(valor.statusCode, 409);
  assert.equal(valor.cuerpo.error, 'user_limit');
  assert.equal(valor.cuerpo.maxUsers, 1);
});

test('SCRUM-1342 · ✅ si la ruta no encuentra el merchant, cae a trial SIN aviso (ausente, no desconocido)', async () => {
  const { valor, avisos } = await invitar({ plan: 'equipo', activos: 0, hayMerchant: false });
  assert.equal(valor.statusCode, 409);
  assert.equal(valor.cuerpo.maxUsers, 1);
  assert.deepEqual(avisos, []);
  const control = await invitar({ plan: 'empresa', activos: 0 });
  assert.equal(control.avisos.length, 1, 'control positivo: la misma llamada, con un plan desconocido, sí se oye');
});

// ── EL ESQUEMA NO LLEVA UNA SEGUNDA LISTA ────────────────────────────────────────────────

/** El comentario de la línea del campo `plan` del modelo `Merchant`, o lanza si no hay exactamente una. */
function comentarioDelCampoPlan(esquema) {
  const lineas = esquema.split(/\r?\n/);
  const desde = lineas.findIndex((l) => /^model\s+Merchant\s*\{/.test(l));
  assert.ok(desde >= 0, '🔴 CIEGO: no encuentro `model Merchant {` en el esquema');
  const hasta = lineas.findIndex((l, i) => i > desde && /^\}/.test(l));
  assert.ok(hasta > desde, '🔴 CIEGO: el modelo Merchant no cierra');
  const campos = lineas.slice(desde + 1, hasta).filter((l) => /^\s+plan\s+String\b/.test(l));
  assert.equal(campos.length, 1, `🔴 CIEGO: esperaba UN campo \`plan String\` en Merchant y hay ${campos.length}`);
  const corte = campos[0].indexOf('//');
  return corte < 0 ? '' : campos[0].slice(corte + 2);
}

/** Los nombres de plan —existan o no— que un texto trae como palabra suelta. */
function planesNombradosEn(texto) {
  const candidatos = [...Object.keys(LIMITES_FIRMADOS), 'basic', 'empresa'];
  const palabras = new Set(texto.toLowerCase().split(/[^a-záéíóúñ_]+/));
  return candidatos.filter((c) => palabras.has(c));
}

const LINEA_VIEJA = '  plan                 String    @default("trial") // trial | basic | pro | empresa';

test('SCRUM-1342 · ✅ CONTROL: el lector del esquema VE la lista que había (la línea de antes nombra cuatro planes)', () => {
  const viejo = comentarioDelCampoPlan(`model Merchant {\n${LINEA_VIEJA}\n}\n`);
  assert.deepEqual(planesNombradosEn(viejo), ['trial', 'pro', 'basic', 'empresa']);
});

test('SCRUM-1342 · 🔴 el comentario de `Merchant.plan` no enumera planes: remite a entitlements.ts', () => {
  const comentario = comentarioDelCampoPlan(fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8'));
  assert.deepEqual(planesNombradosEn(comentario), [],
    `🔴 EL ESQUEMA VUELVE A LLEVAR UNA LISTA DE PLANES: «${comentario.trim()}». Es una segunda lista y `
    + 'divergirá de `src/core/entitlements.ts`, que es quien decide. Quita los nombres y remite allí.');
  assert.ok(comentario.includes('src/core/entitlements.ts'),
    `y dice DÓNDE están los que valen, porque quien pone un plan a mano mira aquí: «${comentario.trim()}»`);
});

// ── LO QUE TIENE QUE TUMBAR ESTE FICHERO (lo ejecuta `npm run meta:mutaciones`) ──────────
// La línea del esquema NO se declara aquí: nadie en la casa muta `prisma/schema.prisma` desde un
// instrumento y este ticket no lo estrena. Su rojo se vio sobre el fichero real antes del arreglo
// (`docs/master/evidencias/scrum1342/rojo-antes.txt`) y su lector lleva el control de arriba.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El agujero: se vuelve a preguntar por lo que el objeto HEREDA.
    fichero: 'src/core/entitlements.ts',
    de: "  if (typeof plan === 'string' && Object.prototype.hasOwnProperty.call(BY_PLAN, plan)) return BY_PLAN[plan];",
    a: "  if (typeof plan === 'string' && BY_PLAN[plan]) return BY_PLAN[plan];",
    cae: 'NO abre el límite',
  },
  {
    // El defecto del ticket: el plan desconocido vuelve a caer en silencio.
    fichero: 'src/core/entitlements.ts',
    de: '  console.warn(',
    // `String(` y no `void (`: la llamada acaba en coma colgante, que `void (…,)` no admite — el
    // fichero entero dejaba de cargar y el test nombrado no llegaba a correr (mutación CIEGA).
    a: '  String(',
    cae: 'deja UN aviso con el valor recibido',
  },
  {
    // El fallo que haría que alguien quitara el aviso en un mes: salta también sin plan.
    fichero: 'src/core/entitlements.ts',
    de: '  if (plan === null || plan === undefined) return BY_PLAN.trial;',
    a: '  if (false) return BY_PLAN.trial;',
    cae: 'AUSENTE NO ES DESCONOCIDO',
  },
  {
    // Un límite que se mueve «de paso». No es de este ticket ni de ninguna sesión: es del fundador.
    fichero: 'src/core/entitlements.ts',
    de: '  equipo:   { maxUsers: 5, waFairUseMonthly: 1000 },  // oferta manual W1',
    a: '  equipo:   { maxUsers: 10, waFairUseMonthly: 1000 },  // oferta manual W1',
    cae: 'los CUATRO planes conocidos dan exactamente sus límites',
  },
  {
    // El fail-closed, del revés: lo desconocido cae al plan MÁS grande.
    fichero: 'src/core/entitlements.ts',
    de: '  );\n  return BY_PLAN.trial;',
    a: '  );\n  return BY_PLAN.equipo;',
    cae: 'la ruta sigue contestando 1 usuario',
  },
  {
    // La ruta deja de decir de quién es el plan: el aviso vuelve a ser un rastro sin dueño.
    fichero: 'src/modules/team/app/routes/team.routes.ts',
    de: 'getEntitlements(merchant?.plan, { merchantId: req.merchantId });',
    a: 'getEntitlements(merchant?.plan);',
    cae: 'la ruta sigue contestando 1 usuario',
  },
];
