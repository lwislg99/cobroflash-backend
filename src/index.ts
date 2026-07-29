import './core/config/loadEnv'; // PRIMERO: carga .env.local (prioridad) y .env
import { app } from './app';
import { config, warnMissingWebhookSecrets, warnEmptyOwnerEmails, assertPublicBaseUrl, assertVerifactuIdSistema } from './core/config/env';
import { startCronJobs } from './core/cron/cron';

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

app.listen(config.PORT, () => {
  console.log(`YaQu API listening on ${config.PUBLIC_BASE_URL}`);
  if (config.DISABLE_CRONS) {
    console.log('[cron] desactivados (DISABLE_CRONS=true)');
  } else {
    startCronJobs();
  }
});
