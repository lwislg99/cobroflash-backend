// Clasifica las trazas de cada guard: ¿toca algo que un PR de sólo docs puede cambiar?
//   node clasificar.mjs <raiz> <dirTrazas>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [raiz, dirTrazas] = process.argv.slice(2);
const { esDocumentacion } = await import(pathToFileURL(path.join(raiz, 'scripts/equipo/solo-docs.mjs')).href);
const porGuard = JSON.parse(fs.readFileSync(path.join(path.dirname(dirTrazas), 'porguard.json'), 'utf8'));
const tiempos = JSON.parse(fs.readFileSync(path.join(dirTrazas, '_tiempos.json'), 'utf8'));
const CODIGO = /^(public|src|scripts|tests|prisma|\.github|\.claude|node_modules|dist|\.git)(\/|$)/;
const LISTADO = /(^|\.)(readdir|readdirSync|opendir|opendirSync|glob|globSync|watch)$/;
const R = path.resolve(raiz).toLowerCase();
const rel = (abs) => {
  const a = path.resolve(abs);
  if (!a.toLowerCase().startsWith(R)) return null;
  return a.slice(R.length).replace(/\\/g, '/').replace(/^\//, '');
};
export function tocaDocs(r, ops) {
  if (r === null) return false;
  if (r === 'docs' || r.startsWith('docs/') || esDocumentacion(r)) return 'lee';
  if (ops.some((o) => LISTADO.test(o)) && !CODIGO.test(r)) return 'lista';
  return false;
}
const filas = [];
for (const { guard, n, docs } of porGuard) {
  const dir = path.join(dirTrazas, guard);
  const trazas = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : [];
  const motivos = [];
  if (!trazas.length) motivos.push('SIN TRAZA');
  // Un `git` lanzado sin shell, con cwd, argumentos y GIT_DIR/GIT_WORK_TREE FUERA del árbol, no
  // puede leer el árbol: git sólo abre el repositorio que le dicen. Todo lo demás (node, bash,
  // shell, git dentro del árbol, o una traza vieja sin cwd) cuenta como dependiente.
  const dentro = (p, base) => { if (!p) return false; const a = path.resolve(base || '', String(p)).toLowerCase(); return a === R || a.startsWith(R + path.sep); };
  const gitFuera = (p) => p.cwd !== undefined && /^git(\.exe)?$/i.test(path.basename(p.cmd))
    && ['spawn', 'spawnSync', 'execFile', 'execFileSync'].includes(p.op)
    && !dentro(p.cwd) && !p.args.some((a) => dentro(a, p.cwd) || a.toLowerCase().includes(R) || a.toLowerCase().includes(R.replace(/\\/g, '/')))
    && !dentro(p.gitDir, p.cwd) && !dentro(p.gitWorkTree, p.cwd);
  const procs = trazas.flatMap((t) => t.procesos).filter((p) => !(process.argv.includes('--git-fino') && gitFuera(p)));
  if (procs.length) motivos.push(`subproceso: ${[...new Set(procs.map((p) => `${p.cmd.split(/[\\/]/).pop()} ${p.args.slice(0, 2).join(' ')}`))].slice(0, 3).join(' | ')}`);
  const toques = new Set();
  for (const t of trazas) {
    for (const [abs, ops] of t.rutas) { const r = rel(abs); const k = tocaDocs(r, ops); if (k) toques.add(`${k}:${r || '(raíz)'}`); }
    for (const abs of t.cargados) { const r = rel(abs); if (r !== null && tocaDocs(r, [])) toques.add(`import:${r}`); }
  }
  if (toques.size) motivos.push(`docs: ${[...toques].slice(0, 3).join(', ')}${toques.size > 3 ? ` (+${toques.size - 3})` : ''}`);
  const tm = tiempos[guard] || {};
  filas.push({ guard, n, mutDocs: docs.length, depende: motivos.length > 0, motivos, ms: tm.ms, verde: tm.caidos === 0 });
}
const dep = filas.filter((f) => f.depende);
const indep = filas.filter((f) => !f.depende);
const coste = (fs_) => fs_.reduce((s, f) => s + (f.ms || 0) * f.n, 0) / 1000;
console.log(`guards ${filas.length} · DEPENDEN ${dep.length} (${dep.reduce((s, f) => s + f.n, 0)} mut.) · NO ${indep.length} (${indep.reduce((s, f) => s + f.n, 0)} mut.)`);
console.log(`coste local estimado de mutaciones (n × línea base): dependen ${coste(dep).toFixed(0)} s · no dependen ${coste(indep).toFixed(0)} s · líneas base ${(filas.reduce((s, f) => s + (f.ms || 0), 0) / 1000).toFixed(0)} s`);
const porMotivo = { 'SIN TRAZA': 0, subproceso: 0, docs: 0 };
for (const f of dep) for (const m of f.motivos) porMotivo[m.split(':')[0].replace('SIN TRAZA', 'SIN TRAZA')] += 1;
console.log('motivos:', porMotivo);
console.log('\n── los que mutan documentación (tienen que estar en DEPENDEN):');
for (const f of filas.filter((x) => x.mutDocs)) console.log(`  ${f.depende ? '✔ DEPENDE' : '🔴 FUERA '} ${f.guard} · ${f.motivos.join(' · ')}`);
if (process.argv.includes('--todo')) {
  console.log('\n── DEPENDEN');
  for (const f of dep) console.log(`  ${f.guard} (${f.n}) · ${f.motivos.join(' · ')}`);
  console.log('\n── NO DEPENDEN');
  for (const f of indep) console.log(`  ${f.guard} (${f.n}) ${(f.ms / 1000).toFixed(1)} s`);
}
fs.writeFileSync(path.join(dirTrazas, '_clasificacion.json'), JSON.stringify(filas, null, 1));
