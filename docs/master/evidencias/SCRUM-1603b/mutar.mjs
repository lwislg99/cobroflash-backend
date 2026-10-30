// Aplica cada mutación del catálogo de un test, corre el test y comprueba que cae el caso nombrado.
// uso: node mutar.mjs <raiz> <test relativo>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [raiz, rel] = process.argv.slice(2);
const fuente = fs.readFileSync(path.join(raiz, rel), 'utf8');
// El catálogo se lee del fichero sin ejecutar sus tests: se recorta el literal y se evalúa.
const ini = fuente.indexOf('export const MUTACIONES_QUE_ME_TUMBAN = [');
const fin = fuente.indexOf('\n];', ini);
const catalogo = (0, eval)(fuente.slice(ini + 'export const MUTACIONES_QUE_ME_TUMBAN = '.length, fin + 2));
console.log(`POBLACIÓN: ${catalogo.length} mutaciones de ${rel} · HEAD ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: raiz, encoding: 'utf8' }).trim()}`);
const correr = () => spawnSync('node', ['--test', '--test-force-exit', '--test-reporter=tap', rel], { cwd: raiz, encoding: 'utf8', timeout: 300000 });
const base = correr();
const fallosBase = (base.stdout.match(/^not ok \d+ - .*/gm) || []);
console.log(`BASE sin mutar: exit=${base.status} · not ok=${fallosBase.length}`);
if (base.status !== 0) { console.log('🔴 la base no está verde: no se juzga ninguna mutación'); process.exit(2); }
let vivas = 0, mudas = 0, noAplicadas = 0;
for (const [i, m] of catalogo.entries()) {
  const abs = path.join(raiz, m.fichero);
  const orig = fs.readFileSync(abs, 'utf8');
  const veces = orig.split(m.de).length - 1;
  if (veces !== 1) { console.log(`#${i + 1} 🔴 NO APLICADA (${veces} apariciones) en ${m.fichero}`); noAplicadas++; continue; }
  fs.writeFileSync(abs, orig.replace(m.de, m.a));
  const numstat = execFileSync('git', ['diff', '--numstat', '--', m.fichero], { cwd: raiz, encoding: 'utf8' }).trim();
  const r = correr();
  const caidos = (r.stdout.match(/^not ok \d+ - .*/gm) || []).map((l) => l.replace(/^not ok \d+ - /, ''));
  const cae = caidos.some((n) => n.startsWith(m.cae));
  execFileSync('git', ['restore', '--source=HEAD', '--', m.fichero], { cwd: raiz });
  const limpio = execFileSync('git', ['status', '--porcelain', '--', m.fichero], { cwd: raiz, encoding: 'utf8' }).trim() === '';
  if (cae) vivas++; else mudas++;
  console.log(`#${i + 1} ${cae ? 'VIVA' : '🔴 MUDA'} · ${m.fichero} · numstat «${numstat}» · exit=${r.status} · caen: ${caidos.join(' | ') || '(ninguno)'} · restaurado=${limpio}`);
}
console.log(`RESULTADO: vivas ${vivas} · mudas ${mudas} · no aplicadas ${noAplicadas} · de ${catalogo.length}`);
console.log(`EXIT=${mudas || noAplicadas ? 1 : 0}`);
process.exit(mudas || noAplicadas ? 1 : 0);
