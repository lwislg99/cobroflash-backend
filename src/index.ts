import './core/config/loadEnv'; // PRIMERO: carga .env.local (prioridad) y .env
import { app } from './app';
import { config } from './core/config/env';
import { startCronJobs } from './core/cron/cron';

app.listen(config.PORT, () => {
  console.log(`YaQu API listening on ${config.PUBLIC_BASE_URL}`);
  if (config.DISABLE_CRONS) {
    console.log('[cron] desactivados (DISABLE_CRONS=true)');
  } else {
    startCronJobs();
  }
});
