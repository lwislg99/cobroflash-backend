// tests/_staging-db.mjs — SCRUM-60, endurecido en SCRUM-118
// Los tests GATEADOS (QA_DB_TEST=1) corren contra la BD de STAGING, JAMÁS producción.
// Se importa el PRIMERO en cada test gateado, ANTES de `dist/core/db/prisma.js`: fija
// process.env.DATABASE_URL = DATABASE_URL_STAGING para que el PrismaClient de dist/ la lea
// al construirse.
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

const MARCADOR = 'YAQU_STAGING';
const GATES = ['QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST'];
const gate = GATES.find((g) => process.env[g] === '1');

if (gate) {
  const staging = process.env.DATABASE_URL_STAGING;
  if (!staging) {
    console.error(`❌ ${gate}=1 exige DATABASE_URL_STAGING (BD de staging) en .env. Abortado: no se corre contra prod.`);
    process.exit(1);
  }

  // ── BARRERA 1 · pertenencia de la URL, antes de abrir ninguna conexión ──────
  // Incluye el chequeo de SCRUM-60 «staging === la DATABASE_URL del entorno».
  const check = assertSafeStagingUrl(staging, process.env.DATABASE_URL);
  if (!check.safe) {
    console.error(`❌ ${gate}=1: DATABASE_URL_STAGING no es una URL de staging segura (${check.reason}) — abortado.`);
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
  try {
    const filas = await sonda.$queryRaw`
      SELECT current_database() AS db, shobj_description(oid, 'pg_database') AS marca
      FROM pg_database WHERE datname = current_database()`;
    marca = filas[0]?.marca ?? null;
    nombreBd = filas[0]?.db ?? nombreBd;
  } catch (err) {
    // Fail-closed: si no se puede COMPROBAR, no se corre. Una BD inalcanzable o sin
    // permisos de catálogo no es una BD verificada.
    console.error(`\n❌ ${gate}=1: no se pudo comprobar si la BD es de staging (${err?.message || err}).`);
    console.error('   Abortado: si no se puede verificar, no se corre.\n');
    await sonda.$disconnect().catch(() => {});
    process.exit(1);
  }
  await sonda.$disconnect().catch(() => {});

  if (marca !== MARCADOR) {
    // El mensaje nombra la PROPIEDAD, no el mecanismo: quien se lo encuentre a las once de
    // la noche tiene que entender qué pasa, no qué fila le falta a un catálogo.
    console.error(`\n❌ ${gate}=1: ESTA BD NO ES STAGING — abortado antes de tocar nada.`);
    console.error(`   Base "${nombreBd}": no lleva el marcador de staging.`);
    console.error('   Si ES una BD de staging legítima, márcala una vez:');
    console.error('     DATABASE_URL="<su url>" node scripts/marcar-staging.mjs');
    console.error('   Si NO lo es, revisa DATABASE_URL_STAGING en tu .env: los tests gateados');
    console.error('   CREAN Y BORRAN merchants, y eso contra producción es irreversible.\n');
    process.exit(1);
  }
}
