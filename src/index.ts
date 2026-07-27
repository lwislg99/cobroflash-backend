import './core/config/loadEnv'; // PRIMERO: carga .env.local (prioridad) y .env
import { app } from './app';
import { config, warnMissingWebhookSecrets, warnEmptyOwnerEmails, assertPublicBaseUrl } from './core/config/env';
import { startCronJobs } from './core/cron/cron';

// SCRUM-163: PRIMERO y REVIENTA (los dos de abajo solo avisan). Una PUBLIC_BASE_URL
// invalida envenena en silencio todo enlace que se manda al cliente final; arrancar asi es
// peor que no arrancar.
assertPublicBaseUrl();
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
