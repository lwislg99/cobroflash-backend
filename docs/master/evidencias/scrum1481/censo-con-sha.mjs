#!/usr/bin/env node
// SCRUM-1481 · Corre `scripts/censo-mudez.mjs` ENTERO y compara el CONTENIDO del helper antes y después.
//
// Por qué existe: `tests/_guard-texto.mjs` es el fichero que el censo MUTA. Si el proceso muere,
// se salta su `finally`, y `git status` limpio no basta cuando el fichero ya está editado a
// propósito: lo que se compara es el sha256 de sus bytes, leído aquí y no por el censo.
//
// Uso:  node docs/master/evidencias/scrum1481/censo-con-sha.mjs <fichero de salida, FUERA del árbol>
// No toca nada: lanza el censo de la casa tal cual y escribe su salida con un envoltorio al final.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const HELPER = path.join(RAIZ, 'tests', '_guard-texto.mjs');
const salida = process.argv[2];
if (!salida) {
  console.error('falta el fichero de salida (fuera del árbol)');
  process.exit(2);
}
const sha = () => crypto.createHash('sha256').update(fs.readFileSync(HELPER)).digest('hex');

// El entorno del sujeto se construye a mano (SCRUM-928c, SCRUM-1308): sin el color del chat ni el
// contexto de un `node --test` padre, que harían que los hijos no ejecutaran nada.
const env = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS']) delete env[k];

const antes = sha();
const t0 = Date.now();
const r = spawnSync(process.execPath, [path.join('scripts', 'censo-mudez.mjs')],
  { cwd: RAIZ, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
const despues = sha();

const texto = [
  r.stdout || '',
  '--- stderr ---',
  r.stderr || '',
  '--- envoltorio ---',
  `sha256 helper ANTES   ${antes}`,
  `sha256 helper DESPUES ${despues}`,
  `IDENTICO=${antes === despues}`,
  `segundos=${Math.round((Date.now() - t0) / 1000)}`,
  `EXIT=${r.status} signal=${r.signal}`,
  '',
].join('\n');
fs.writeFileSync(salida, texto, 'utf8');
console.log(texto.split('\n').slice(-7).join('\n'));
process.exit(antes === despues ? (r.status ?? 2) : 3);
