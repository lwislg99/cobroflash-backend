// tests/_staging-db.mjs — SCRUM-60, endurecido en SCRUM-118, renombrada la clave en SCRUM-383
// Los tests GATEADOS (QA_DB_TEST=1) corren contra la BASE DE PRUEBAS DE SU CARRIL, JAMÁS
// producción. Se importa el PRIMERO en cada test gateado, ANTES de `dist/core/db/prisma.js`:
// fija process.env.DATABASE_URL = DATABASE_URL_TESTS para que el PrismaClient de dist/ la lea
// al construirse.
//
// SCRUM-383 · POR QUÉ `_TESTS` Y NO `_STAGING`: la clave se llamaba `DATABASE_URL_STAGING` y en
// `cobroflash-backend` apuntaba a `yaqu_dev_javier` (DESARROLLO), mientras que en b1/b2/b3
// apuntaba a `railway` (STAGING). Un solo nombre, dos bases, y cuál te tocaba dependía del
// directorio. El reparto por carril es DELIBERADO y se conserva; lo que se arregla es el nombre,
// que prometía una base concreta cuando lo que designa es «la de pruebas de este carril».
//
// ⚠️ ESTO ES CÓDIGO DE SEGURIDAD, no una utilidad de tests. Lo que hay al otro lado de un
// fallo aquí es `QA_DB_TEST=1` contra producción, y los gateados CREAN Y BORRAN merchants:
// datos de clientes reales. No lo relajes para desatascar una tanda.
//
// ── QUÉ CAMBIÓ EN SCRUM-118, y por qué ────────────────────────────────────────
// Antes esto abortaba solo si la URL CONTENÍA la cadena `autorack` — el host de producción
// de entonces. Eso no comprueba ninguna propiedad: deja pasar cualquier otra cosa. Una
// rotación de host en Railway, un pooler, una IP o un alias, y una URL de PRODUCCIÓN habría
// pasado el guard sin rechistar. Lo que impedía el desastre no era este fichero: era que
// nadie había tenido a mano una URL de prod con otro host.
//
// El ticket se resolvió en DOS PR en paralelo y se reconcilió a propósito, porque cada uno
// ataca una mitad distinta del problema:
//   1) PERTENENCIA DE LA URL (`scripts/_db-guard.mjs`, allowlist de host exacto) — barata y
//      PREVIA, antes de abrir ninguna conexión. Fail-closed: pasa lo conocido en vez de
//      prohibir lo de ayer.
//   2) PROPIEDAD DE LA BD (el MARCADOR) — se le pregunta a la propia base. Lleva un
//      comentario que SOLO se pone en staging (`COMMENT ON DATABASE … IS 'YAQU_STAGING'`,
//      vía `scripts/marcar-staging.mjs` o el seed). Producción no lo tiene ni puede tenerlo
//      por accidente: no viaja en `schema.prisma`, y prod se aprovisiona con el mismo
//      `db push` que staging, o sea que recibe EXACTAMENTE el schema y nada más.
//
// ── QUÉ CAMBIÓ EN SCRUM-188 ───────────────────────────────────────────────────
// El marcador puede llevar ahora un SUFIJO con el turno de staging
// (`YAQU_STAGING lock:<dueño>@<ISO>`), porque el lock vive donde ya vivía el marcador y así
// no hace falta ni tabla ni `db push`. Eso obliga a un criterio duro: el PREFIJO se lee con
// la misma exactitud de antes, y un sufijo ilegible se IGNORA — jamás invalida esta barrera.
// Si un lock mal escrito pudiera tumbarla, NADIE podría correr tests contra staging hasta que
// alguien reparase el catálogo a mano. Por eso la decisión usa `esMarcaDeStaging()`, que no
// mira el sufijo, y el turno se parsea aparte y solo para AVISAR.
//
// ── ORDEN DE LAS DOS BARRERAS ─────────────────────────────────────────────────
//   1) allowlist de HOST  → antes de conectar. Barata, fail-closed.
//   2) MARCADOR de la BD  → tras conectar. **Esta es la garantía.**
// La 1 no verifica que una BD sea staging: solo evita conectar a lo desconocido. Un host de
// la allowlist con una BD sin marcar SIGUE abortando. Si alguna vez hay que elegir, manda la 2.
//
// ── TOP-LEVEL AWAIT ───────────────────────────────────────────────────────────
// Leer el marcador exige conectarse, así que este módulo pasa a ser asíncrono. El orden
// se mantiene porque en ESM un módulo con TLA bloquea la evaluación de lo que viene
// después, y los 35 ficheros que lo importan lo hacen como PRIMER import, antes de
// `node:test` y de cualquier `dist/`. Además el acceso a `dist/core/db/prisma.js` es
// siempre `await import(...)` dinámico DENTRO del test, o sea posterior por construcción.
// ⚠️ Si algún fichero futuro importara este guard DESPUÉS de un módulo que ya conecte, ese
// orden dejaría de estar garantizado. La convención (importarlo el primero) es lo que lo
// sostiene hoy.
//
// La conexión de comprobación es de SOLO LECTURA y ocurre antes de cualquier escritura.
//
// Cubre los TRES gates que tocan la BD: QA_DB_TEST, A55_DB_TEST y BOT_SUITE_TEST.
// Sin gate activo no hace nada. No es *.test.mjs → node --test no lo ejecuta como test.
import 'dotenv/config'; // carga .env (dotenv NO sobrescribe vars ya presentes en el entorno)
import { PrismaClient } from '@prisma/client';
import { assertSafeStagingUrl } from '../scripts/_db-guard.mjs';
// SCRUM-188: el marcador puede llevar detrás el TURNO de staging (`YAQU_STAGING lock:…`).
// `esMarcaDeStaging` conserva EXACTAMENTE la exactitud de antes sobre el prefijo; el sufijo
// se lee aparte y solo para AVISAR. El detalle de por qué son dos funciones, en el módulo.
import {
  esMarcaDeStaging, parsearLock, parsearContexto, leerComentarioSchema,
  decidirVigencia, esMiTurno, formatearDuracion,
} from '../scripts/_staging-lock.mjs';
// SCRUM-253 · quién soy yo, derivado del árbol de trabajo. Los hijos de una tanda heredan el
// `cwd` del padre, así que calculan lo mismo que él sin que nadie exporte nada.
import { dueñoActual } from '../scripts/_identidad-sesion.mjs';

const GATES = ['QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST'];
const gate = GATES.find((g) => process.env[g] === '1');

if (gate) {
  const staging = process.env.DATABASE_URL_TESTS;
  if (!staging) {
    console.error(`❌ ${gate}=1 exige DATABASE_URL_TESTS (BD de pruebas de este carril) en .env. Abortado: no se corre contra prod.`);
    process.exit(1);
  }

  // ── BARRERA 1 · pertenencia de la URL, antes de abrir ninguna conexión ──────
  // Incluye el chequeo de SCRUM-60 «la BD de pruebas === la DATABASE_URL del entorno».
  const check = assertSafeStagingUrl(staging, process.env.DATABASE_URL);
  if (!check.safe) {
    console.error(`❌ ${gate}=1: DATABASE_URL_TESTS no es una URL de pruebas segura (${check.reason}) — abortado.`);
    process.exit(1);
  }

  // ── SCRUM-165 · asignación SÍNCRONA, antes del primer `await` del módulo ─────
  // Va AQUÍ, no al final, A PROPÓSITO. Antes se asignaba tras la sonda (barrera 2), que
  // lleva un `await`: durante esa suspensión un import HERMANO del test podía construir el
  // cliente de `dist` (resuelve DATABASE_URL AL CONSTRUIRSE) ANTES de que se asignara →
  // nacía sin variable, «Environment variable not found: DATABASE_URL» en 5 tests gateados
  // (el TLA de un módulo NO serializa sus imports hermanos). Asignando aquí, síncrono y antes
  // de cualquier `await`, la variable ya está cuando el hermano evalúe.
  //
  // ⚠️ RIESGO RESIDUAL ACEPTADO: entre esta línea y el `process.exit` de la barrera 2 hay una
  // ventana en la que un import podría construir un cliente con esta URL. Es inherente a
  // «asignar y luego verificar» — el único orden que arregla el bug. Consecuencia: la
  // ALLOWLIST (barrera 1, arriba) es ahora la ÚNICA barrera que actúa ANTES de que la URL sea
  // utilizable; el marcador (barrera 2) sigue abortando si la BD no es staging, pero DESPUÉS
  // de esa ventana. POR ESO la allowlist no se toca.
  process.env.DATABASE_URL = staging;

  // ── BARRERA 2 · el MARCADOR: la propiedad. Solo lectura ─────────────────────
  const sonda = new PrismaClient({ datasources: { db: { url: staging } } });
  let marca = null;
  let nombreBd = '(desconocida)';
  let ahoraMs = Date.now(); // se sustituye por el reloj de la BD si la sonda responde
  let contextoTurno = null;  // SCRUM-266 · el compromiso del dueño, si lo publicó
  try {
    // SCRUM-188: `now()` viaja en ESTA misma consulta. El aviso de turno ajeno (abajo) compara
    // fechas, y compararlas con el reloj del portátil metería el sesgo entre máquinas justo en
    // la decisión de «¿está rancio?». El reloj de la base es uno para todas las sesiones.
    const filas = await sonda.$queryRaw`
      SELECT current_database() AS db, shobj_description(oid, 'pg_database') AS marca, now() AS ahora
      FROM pg_database WHERE datname = current_database()`;
    marca = filas[0]?.marca ?? null;
    nombreBd = filas[0]?.db ?? nombreBd;
    if (filas[0]?.ahora instanceof Date) ahoraMs = filas[0].ahora.getTime();

    // SCRUM-266 (resto) · el compromiso publicado por el dueño del turno, para poder JUZGARLO
    // con un dato en vez de con un TTL supuesto (ver el aviso, abajo). Va aquí dentro y no en
    // otra llamada porque `sonda` se desconecta en cuanto acaba este bloque.
    //
    // BEST-EFFORT A PROPÓSITO, con su propio `catch`: esto es un AVISO. Si la lectura falla,
    // `contextoTurno` se queda en null, `decidirVigencia` cae al TTL supuesto y el aviso se
    // comporta EXACTAMENTE como antes de este arreglo. Lo que no puede pasar es que un
    // comentario de schema ilegible tumbe la barrera que impide correr contra producción —
    // es la misma razón por la que un sufijo raro del marcador tampoco puede (ver abajo).
    try {
      contextoTurno = parsearContexto(await leerComentarioSchema(sonda), parsearLock(marca)?.dueño);
    } catch { /* advisory: el aviso se degrada, la barrera no se toca */ }
  } catch (err) {
    // Fail-closed: si no se puede COMPROBAR, no se corre. Una BD inalcanzable o sin
    // permisos de catálogo no es una BD verificada.
    console.error(`\n❌ ${gate}=1: no se pudo comprobar si la BD es de staging (${err?.message || err}).`);
    console.error('   Abortado: si no se puede verificar, no se corre.\n');
    await sonda.$disconnect().catch(() => {});
    process.exit(1);
  }
  await sonda.$disconnect().catch(() => {});

  // SCRUM-188 · LA DECISIÓN DE LA BARRERA NO PASA POR EL PARSER DEL TURNO. `esMarcaDeStaging`
  // solo mira el prefijo, con la misma exactitud que el `marca !== MARCADOR` de antes: acepta
  // `YAQU_STAGING` a secas y `YAQU_STAGING ` + sufijo, y nada más. Un sufijo que no se entienda
  // NO puede tumbar esto — si pudiera, un lock mal escrito dejaría a TODAS las sesiones sin
  // poder correr la tanda hasta que un humano reparase el catálogo a mano.
  if (!esMarcaDeStaging(marca)) {
    // El mensaje nombra la PROPIEDAD, no el mecanismo: quien se lo encuentre a las once de
    // la noche tiene que entender qué pasa, no qué fila le falta a un catálogo.
    console.error(`\n❌ ${gate}=1: ESTA BD NO ES STAGING — abortado antes de tocar nada.`);
    console.error(`   Base "${nombreBd}": no lleva el marcador de staging.`);
    console.error('   Si ES una BD de staging legítima, márcala una vez:');
    console.error('     DATABASE_URL="<su url>" node scripts/marcar-staging.mjs');
    console.error('   Si NO lo es, revisa DATABASE_URL_TESTS en tu .env: los tests gateados');
    console.error('   CREAN Y BORRAN merchants, y eso contra producción es irreversible.\n');
    process.exit(1);
  }

  // ── SCRUM-188 · AVISO (nunca bloqueo) de turno ajeno ─────────────────────────
  // Quien lanza la tanda por `npm run test:staging` ya pasa por el runner, que TOMA el turno y
  // aborta si está ocupado. Esto es para el otro camino: el gateado suelto a mano
  // (`QA_DB_TEST=1 node --test tests/loquesea.test.mjs`), que no pasa por el runner y hoy no se
  // entera de nada. AVISA, no aborta — esta barrera existe para impedir correr contra PROD, y
  // convertirla también en un gate de coordinación la haría capaz de bloquear a todo el mundo
  // por un turno rancio. Ese trabajo es del runner, que sí sabe reclamarlo.
  // El runner exporta YAQU_LOCK_DUENO a sus hijos: así el turno del propio padre no se avisa
  // como ajeno en cada uno de los tres procesos.
  // SCRUM-266 (resto) · QUIÉN decide que ese turno sigue vivo. Antes decidía aquí `estaRancio`
  // con el TTL POR DEFECTO —45 minutos SUPUESTOS—, mientras el runner sostiene el suyo con un
  // TTL DERIVADO (`ttlParaTanda`), que con `GATED_CHILD_TIMEOUT_MS=60` son 70. En esa ventana
  // este aviso hacía lo contrario de aquello para lo que existe: daba por rancio un turno VIVO
  // y se CALLABA, dejando que el gateado suelto escribiera sobre la base de una tanda en marcha
  // sin decir una palabra. Es el defecto de SCRUM-266 con el signo invertido — allí `tomar`
  // reclamaba de más, aquí el aviso avisa de menos.
  //
  // `decidirVigencia` compara contra el compromiso que el dueño PUBLICÓ (SCRUM-249); el TTL solo
  // decide cuando no hay compromiso, que es el peor caso y no el normal.
  //
  // SCRUM-253 · y de QUIÉN es, que es la OTRA pregunta. Antes se comparaba contra
  // `process.env.YAQU_LOCK_DUENO`, que solo existía porque el runner se la exportaba a sus
  // hijos: o sea que este aviso únicamente sabía callarse cuando el turno venía de una tanda.
  // Quien lo tomaba A MANO con `turno:tomar` y lanzaba luego un gateado suelto **se avisaba a
  // sí mismo de su propio turno** — ruido justo en el sitio donde el ruido acaba ignorándose, y
  // el aviso deja de servir para el caso que importa. Ahora la identidad se deriva del árbol.
  const lockVivo = parsearLock(marca);
  const vigencia = decidirVigencia({ lock: lockVivo, contexto: contextoTurno, ahoraMs });
  if (vigencia.vigente && !esMiTurno(lockVivo, dueñoActual())) {
    console.warn(
      `\n⚠️  SCRUM-188: el turno de staging lo tiene «${lockVivo.dueño}» desde ${lockVivo.desdeIso} ` +
      `(hace ${formatearDuracion(ahoraMs - lockVivo.desdeMs)}).\n` +
      `    Base "${nombreBd}". Sigo porque esto es un test suelto, no la tanda — pero si esa\n` +
      '    sesión está viva, los dos estáis creando y borrando merchants sobre la misma base.\n',
    );
  }
}
