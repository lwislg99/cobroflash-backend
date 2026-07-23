import './core/config/loadEnv'; // PRIMERO: carga .env.local (prioridad) y .env
import { app } from './app';
import { config, warnMissingWebhookSecrets, warnEmptyOwnerEmails } from './core/config/env';
import { startCronJobs } from './core/cron/cron';

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
