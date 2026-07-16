// tests/_staging-db.mjs — SCRUM-60 (carril Javier)
// Los tests GATEADOS (QA_DB_TEST=1) corren contra la BD de STAGING, JAMÁS producción.
// Se importa el PRIMERO en cada test gateado, ANTES de `dist/core/db/prisma.js`: fija
// process.env.DATABASE_URL = DATABASE_URL_STAGING para que el PrismaClient de dist/ la lea
// al construirse. Fail-closed: si no hay URL de staging o parece prod → aborta (no toca prod).
//
// Marcador de prod = `autorack.proxy.rlwy.net` (mismo guard que scripts/seed-staging.mjs).
// No es un fichero *.test.mjs → node --test no lo ejecuta como test.
import 'dotenv/config'; // carga .env (dotenv NO sobrescribe vars ya presentes en el entorno)

if (process.env.QA_DB_TEST === '1') {
  const staging = process.env.DATABASE_URL_STAGING;
  if (!staging) {
    console.error('❌ QA_DB_TEST=1 exige DATABASE_URL_STAGING (BD de staging) en .env. Abortado: no se corre contra prod.');
    process.exit(1);
  }
  // GUARD anti-producción: nunca contra el host de prod ni contra la misma URL que DATABASE_URL.
  if (staging.includes('autorack.proxy.rlwy.net') || staging === process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL_STAGING apunta a PRODUCCIÓN (autorack o = DATABASE_URL) — abortado.');
    process.exit(1);
  }
  process.env.DATABASE_URL = staging;
}
