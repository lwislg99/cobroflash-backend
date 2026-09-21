// Arranca el servidor del worktree contra el banco desechable, con el login de QA activado.
// Uso: node servidor.mjs <raiz-del-worktree> <puerto>
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { urlDeBanco } from './conn.mjs';

const raiz = process.argv[2];
const puerto = process.argv[3] || '3980';
const aqui = process.env.SONDA_TMP; // directorio de trabajo FUERA del arbol: aqui van el secreto y la siembra, nunca al repo
if (!aqui) { console.error('falta SONDA_TMP'); process.exit(2); }
const secreto = crypto.randomBytes(24).toString('hex');
fs.writeFileSync(path.join(aqui, 'secreto.txt'), secreto);

process.env.DATABASE_URL = urlDeBanco();
process.env.PORT = puerto;
process.env.PUBLIC_BASE_URL = 'http://localhost:' + puerto;
process.env.DISABLE_CRONS = 'true';
process.env.E2E_TEST_LOGIN_ENABLED = 'true';
process.env.E2E_TEST_LOGIN_SECRET = secreto;
process.env.E2E_TEST_LOGIN_EMAILS = 'qa-980b@example.test';
process.chdir(raiz);
console.log('TESTIGO · servidor de ' + raiz + ' en el puerto ' + puerto + ' contra la base ' + process.env.PGDATABASE);
await import(pathToFileURL(path.join(raiz, 'dist/index.js')).href);
