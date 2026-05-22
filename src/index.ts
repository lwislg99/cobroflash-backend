import 'dotenv/config';
import { app } from './app';
import { config } from './core/config/env';
import { startCronJobs } from './core/cron/cron';

app.listen(config.PORT, () => {
  console.log(`CobroFlash API listening on ${config.PUBLIC_BASE_URL}`);
  startCronJobs();
});
