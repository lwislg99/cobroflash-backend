// Juzga las declaraciones de UN test con las funciones del propio meta-guard (correr + aplicarUna).
// Uso, desde la raíz del worktree: node <este> tests/<fichero>.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.cwd();
const guard = path.basename(process.argv[2]);
const mg = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const muts = mg.mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, 'tests', guard), 'utf8'), guard);
console.log(`${guard}: ${muts.length} declaraciones`);
const limpia = await mg.correr(guard);
console.log(`limpia: ${limpia.pasados.length} pasados · ${limpia.caidos.length} caídos · movidos ${limpia.movidos.length}`);
let malas = 0;
for (const m of muts) {
  const r = await mg.aplicarUna(m, guard, limpia);
  const v = r.ok ? 'VIVA' : r.mudo ? 'MUDA' : r.ciego ? 'CIEGA' : r.muerto ? 'MUERTA' : JSON.stringify(Object.keys(r));
  if (!r.ok) malas += 1;
  console.log(`  ${r.ok ? '✔' : '✖'} ${v} · ${m.cae}${r.ok ? ` · colaterales ${r.colaterales}` : ` · ${String(r.ciego || r.mudo || r.muerto || '').slice(0, 300)}`}`);
}
const limpioDespues = fs.readFileSync(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs'), 'utf8').includes('  if (esGuardDeNavegador(guard)) {');
console.log(`restaurado: ${limpioDespues}`);
process.exit(malas ? 1 : 0);
