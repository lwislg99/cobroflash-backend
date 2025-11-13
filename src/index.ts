import 'dotenv/config';
import { app } from './app';
import { config } from './config/env';

app.listen(config.PORT, () => {
  console.log(`CobroFlash API listening on ${config.PUBLIC_BASE_URL}`);
});
