// SCRUM-911 · envoltorio del turno de staging: carga DATABASE_URL_TESTS del secreto EN RUNTIME
// y llama a scripts/turno-staging.mjs. Nunca imprime la URL (regla 9).
//   node turno.mjs estado
//   node turno.mjs tomar --ref scrum-911-mant-staging --minutos 90
//   node turno.mjs soltar
import { spawnSync } from 'node:child_process';
import { cargarSecretos, WT } from './_entorno.mjs';

const s = cargarSecretos();
if (!s.DATABASE_URL_STAGING) throw new Error('falta DATABASE_URL_STAGING en el fichero de secretos');

const r = spawnSync(process.execPath, [`${WT}/scripts/turno-staging.mjs`, ...process.argv.slice(2)], {
  cwd: WT,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL_TESTS: s.DATABASE_URL_STAGING, FORCE_COLOR: '0' },
});
process.exit(r.status ?? 1);
