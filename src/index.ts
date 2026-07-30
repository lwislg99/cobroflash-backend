import './core/config/loadEnv'; // PRIMERO: carga .env.local (prioridad) y .env
import { app } from './app';
import { config, warnMissingWebhookSecrets, warnEmptyOwnerEmails, assertPublicBaseUrl, assertVerifactuIdSistema } from './core/config/env';
import { startCronJobs } from './core/cron/cron';
import { prisma } from './core/db/prisma';
import { comprobarSchemaEnArranque } from './core/db/schemaDrift';

// El arranque va en un `async` porque el guard de schema (SCRUM-222) hace UNA consulta a la BD antes
// de escuchar. Los asserts REVIENTAN el arranque (exit ≠ 0 → Railway no promueve el deploy y mantiene
// el anterior); los warns solo avisan.
async function arrancar() {
  // SCRUM-163: PRIMERO y REVIENTA (los dos de abajo solo avisan). Una PUBLIC_BASE_URL
  // invalida envenena en silencio todo enlace que se manda al cliente final; arrancar asi es
  // peor que no arrancar.
  assertPublicBaseUrl();
  // SCRUM-217: revienta si VERIFACTU_ID_SISTEMA esta PRESENTE Y MAL (error 1177 de la AEAT, que el
  // emisor no puede detectar porque solo mira que no este vacio); si falta, solo avisa — hoy las
  // VERIFACTU_* van vacias a proposito y reventar por eso tumbaria produccion.
  assertVerifactuIdSistema();
  warnMissingWebhookSecrets(); // SCRUM-99: aviso ruidoso ANTES de escuchar, no tras el primer webhook
  warnEmptyOwnerEmails(); // SCRUM-102: mismo motivo, para OWNER_EMAILS

  // SCRUM-222 · DERIVA-PROD: fail-closed ANTES de escuchar. Compara las columnas que el codigo EXIGE
  // (prisma/schema-manifest.json) contra la BD viva. Columna ausente → falla inmediato (aplica el
  // schema, db push); BD inalcanzable → reintenta con backoff y luego falla (¿red?). Sale ≠ 0 y el
  // deploy no se promueve. Ver src/core/db/schemaDrift.ts.
  await comprobarSchemaEnArranque(prisma);

  app.listen(config.PORT, () => {
    console.log(`YaQu API listening on ${config.PUBLIC_BASE_URL}`);
    if (config.DISABLE_CRONS) {
      console.log('[cron] desactivados (DISABLE_CRONS=true)');
    } else {
      startCronJobs();
    }
  });
}

arrancar().catch((e) => {
  // Cualquier assert de arranque que reviente cae aqui: exit ≠ 0 antes de escuchar.
  console.error('[arranque] ABORTADO:', (e as { message?: string })?.message ?? e);
  process.exit(1);
});
