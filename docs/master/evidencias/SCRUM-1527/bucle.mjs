// SCRUM-1527 · N pasadas de scrum446 + scrum447 en paralelo, con tope por pasada. uso: node bucle.mjs <raizDelArbol> <N>
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const [raiz, N] = process.argv.slice(2);
const env = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
const ficheros = ['tests/scrum446-cabecera-modal.test.mjs', 'tests/scrum447-byte-invisible-en-patrones.test.mjs'];
let ok = 0, rojo = 0, colgada = 0, sinRecuento = 0; const ms = [];
for (let i = 0; i < Number(N); i++) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', ...ficheros], { cwd: raiz, env, encoding: 'utf8', timeout: 60000 });
  ms.push(Date.now() - t0);
  if (r.error && r.error.code === 'ETIMEDOUT') { colgada++; continue; }
  const m = (r.stdout || '').match(/tests (\d+)/);
  if (!m || Number(m[1]) !== 10) { sinRecuento++; continue; }
  if (r.status === 0) ok++; else rojo++;
}
ms.sort((a, b) => a - b);
console.log(`POBLACION pasadas=${N} ok(10 casos, salida 0)=${ok} rojo=${rojo} colgada(>60s)=${colgada} sinRecuentoDe10=${sinRecuento} ms min=${ms[0]} p50=${ms[ms.length >> 1]} max=${ms[ms.length - 1]}`);
