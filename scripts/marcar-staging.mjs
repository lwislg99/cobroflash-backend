// scripts/marcar-staging.mjs — SCRUM-118
//
// Pone el MARCADOR de staging en una BD ya existente:
//   COMMENT ON DATABASE <esta> IS 'YAQU_STAGING'
//
// Es lo que `tests/_staging-db.mjs` lee para verificar la PROPIEDAD «estoy conectado a
// staging», en vez del SÍNTOMA «el texto de la URL no dice autorack».
//
// PARA QUÉ EXISTE, si el seed ya lo pone: para BD **ya sembradas** y en uso. Re-correr
// `seed-staging.mjs` en una de ellas NO es inocuo — hace `merchant.update({ nextQuoteNumber })`
// sobre el merchant QA y retrocedería su contador de numeración. Este script no toca ni
// una fila: solo escribe un comentario de catálogo.
//
// USO:
//   DATABASE_URL="<url de TU BD de staging>" node scripts/marcar-staging.mjs
//
// Idempotente: correrlo N veces deja exactamente el mismo estado.
//
// SCRUM-188 · ES TAMBIÉN LA LIBERACIÓN MANUAL DEL TURNO DE STAGING. Deja el marcador LIMPIO,
// o sea que borra cualquier sufijo `lock:<dueño>@<ISO>` que hubiera. Eso es lo que se quiere
// cuando una sesión murió sin soltar y no apetece esperar al TTL — y es exactamente lo que NO
// se quiere si la otra tanda sigue viva: quitarle el turno a una tanda en marcha reproduce el
// problema que SCRUM-188 evita. Úsalo sabiendo cuál de los dos casos es.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🚨 ESTE ES EL ÚNICO TOOL QUE PUEDE CONVERTIR PRODUCCIÓN EN FALSO-STAGING.
//
// Si le pusiera el marcador a la BD de prod, el guard nuevo la aceptaría como staging y
// los tests gateados —que crean y BORRAN merchants— se llevarían por delante datos de
// clientes reales. Sería la catástrofe que SCRUM-118 evita, habilitada por la propia
// herramienta que lo implementa.
//
// Por eso su protección NO puede ser:
//   · el marcador  → imposible, este script ES quien lo pone (pescadilla que se muerde la cola);
//   · la subcadena `autorack` → es justo la comprobación floja que este ticket sustituye.
//
// Es la ALLOWLIST DE HOST POSITIVA y FAIL-CLOSED de `_db-guard.mjs`, aplicada de forma
// INCONDICIONAL: sin gate, sin flag, sin variable que la desactive, porque este script
// escribe pase lo que pase.
//
// ⚠️ `assertSafeStagingUrl` DEVUELVE `{safe, reason}` — no aborta. Un valor de retorno se
// puede ignorar; en una herramienta que ESCRIBE, el fallo tiene que ser imposible de
// ignorar. Por eso aquí va envuelto en un `process.exit(1)` explícito, y por eso está en
// el cuerpo del módulo y no dentro de una función que alguien pueda no llamar.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { assertSafeStagingUrl, STAGING_HOST } from './_db-guard.mjs';
import { MARCADOR } from './_staging-lock.mjs'; // SCRUM-188: fuente única del literal

const url = process.env.DATABASE_URL;

// PRIMERA LÍNEA EJECUTABLE: antes de construir el cliente, antes de conectar, antes de nada.
const check = assertSafeStagingUrl(url);
if (!check.safe) {
  console.error(
    `\n❌ marcar-staging: ABORTADO — ${check.reason}.\n` +
    `   Solo se permite operar contra el host de STAGING: ${STAGING_HOST}\n` +
    '   Esta comprobación es incondicional y no se puede desactivar: este script ESCRIBE.\n',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const [{ db }] = await prisma.$queryRaw`SELECT current_database() AS db`;
  console.log(`Marcando la base "${db}" en ${STAGING_HOST} …`);

  // `COMMENT ON DATABASE` no admite parámetros ni expresiones en el nombre, así que hay que
  // interpolarlo. Se hace con format('%I') DENTRO de Postgres: el nombre nunca sale de la
  // BD, %I lo escapa como identificador, y no hay superficie de inyección desde JS.
  await prisma.$executeRawUnsafe(
    "DO $$ BEGIN EXECUTE format('COMMENT ON DATABASE %I IS %L', current_database(), 'YAQU_STAGING'); END $$;",
  );

  // Releer y comprobar: no se da por hecho que la escritura funcionó.
  const [{ marca }] = await prisma.$queryRaw`
    SELECT shobj_description(oid, 'pg_database') AS marca
    FROM pg_database WHERE datname = current_database()`;

  if (marca !== MARCADOR) {
    console.error(`\n❌ El marcador NO quedó puesto (se leyó ${JSON.stringify(marca)}).`);
    console.error('   ¿Tiene el usuario permiso de COMMENT sobre la base (hace falta ser su dueño)?\n');
    process.exit(1);
  }

  console.log(`✅ "${db}" marcada como STAGING (${MARCADOR}).`);
  console.log('   Los tests gateados ya la aceptan. Ninguna fila ha sido modificada.');
} catch (err) {
  console.error('\n❌ marcar-staging:', err?.message || err, '\n');
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
