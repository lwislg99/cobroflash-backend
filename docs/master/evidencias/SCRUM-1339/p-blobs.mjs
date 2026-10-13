// docs/master/evidencias/SCRUM-1339/p-blobs.mjs — SCRUM-1339p · SÓLO LECTURA (git local y logs).
//
// La pata que decide (ficha común, ④bis): coger el MISMO blob y mirar si sale COMPLETO en otros
// jobs. Para cada guard que alguna vez quedó sin juzgar: qué versión del guard y del instrumento
// corrió en cada ejecución, y con esa MISMA pareja cuántas veces salió entero y cuántas no.
//
//   node p-blobs.mjs <n-datos.json> <carpeta de logs> <repo> <guard,guard,…>
//
// Qué blob corrió. CI no prueba la punta: prueba el MERGE de la punta con `main`. El log lo dice
// («Merge <punta> into <base>»), y de ahí sale por IDENTIDAD, no por la hora:
//   · en `push`, el commit es de `main`: el blob es el suyo;
//   · en `pull_request`, si la rama cambió el fichero respecto a su punto de partida, el de la
//     rama; si no, el de la BASE que nombra el log.
// Lo que NO resuelve: una rama Y `main` tocando el mismo fichero a la vez (sale como «AMBAS» y no
// se cuenta en ningún lado), y los ficheros que el guard LEE del árbol, que no son un blob.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { leerLog } from './p-leer.mjs';

const [fDatos, dir, repo, lista = ''] = process.argv.slice(2);
if (!fDatos || !dir || !repo || !lista) { console.error('uso: node p-blobs.mjs <n-datos.json> <logs> <repo> <guards,por,comas>'); process.exit(2); }
const d = JSON.parse(fs.readFileSync(fDatos, 'utf8'));
const INSTRUMENTO = 'scripts/meta-guard-mutaciones.mjs';
const cache = new Map();
const git = (...a) => { const k = a.join(' '); if (cache.has(k)) return cache.get(k); let v; try { v = execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { v = null; } cache.set(k, v); return v; };
let mal = 0;
const exige = (ok, txt) => { console.log(`${ok ? '✅' : '🔴'} ${txt}`); if (!ok) mal += 1; };

const filas = [];
let conMerge = 0; let prTotal = 0;
for (const p of d.prs) {
  const j = p.runs[0].jobs[0];
  const f = path.join(dir, `${j.id}.log`);
  if (!fs.existsSync(f) || !fs.statSync(f).size) continue;
  const crudo = fs.readFileSync(f, 'utf8');
  const r = leerLog(crudo);
  if (r.estado === 'SIN VEREDICTO') continue;
  const m = /Merge ([0-9a-f]{40}) into ([0-9a-f]{40})/.exec(crudo);
  if (p.evento === 'pull_request') { prTotal += 1; if (m && m[1] === p.sha) conMerge += 1; }
  filas.push({ pr: p.n, job: String(j.id), evento: p.evento, sha: p.sha, base: m ? m[2] : null, puntaLog: m ? m[1] : null, ...r });
}
console.log(`POBLACIÓN: ${filas.length} ejecuciones con veredicto · ${filas.filter((f) => f.evento === 'push').length} de push y ${prTotal} de pull_request`);
exige(conMerge === prTotal, `IDENTIDAD: el log de las ${prTotal} de pull_request nombra «Merge <punta> into <base>» y la punta es la de la lista en ${conMerge}`);

const blobQueCorrio = (f, ruta) => {
  if (f.evento === 'push') return git('rev-parse', `${f.sha}:${ruta}`) ?? 'SIN-OBJETO';
  const mb = git('merge-base', f.sha, f.base);
  const [punta, partida, base] = [git('rev-parse', `${f.sha}:${ruta}`), mb && git('rev-parse', `${mb}:${ruta}`), git('rev-parse', `${f.base}:${ruta}`)];
  if (!punta || !partida || !base) return 'SIN-OBJETO';
  if (punta === partida) return base;      // la rama no lo tocó: corre el de la base
  if (base === partida) return punta;      // sólo lo tocó la rama
  return punta === base ? base : 'AMBAS';
};

// Control positivo del método: un fichero que `main` SÍ ha movido en la ventana tiene que dar más
// de un blob; si diera uno solo, el método no estaría leyendo versiones.
{
  const ruta = 'docs/master/SCRUM-1339.md';
  const n = new Set(filas.map((f) => blobQueCorrio(f, ruta))).size;
  exige(n > 1, `POSITIVO del método: «${ruta}», que se ha movido en la ventana, da ${n} blobs distintos entre las ${filas.length} ejecuciones`);
}
{
  const n = new Set(filas.map((f) => blobQueCorrio(f, INSTRUMENTO)));
  console.log(`  instrumento (${INSTRUMENTO}): ${n.size} blob(s) entre las ${filas.length} → ${[...n].map((b) => b.slice(0, 12)).join(', ')}`);
}

for (const guard of lista.split(',').filter(Boolean)) {
  const ruta = `tests/${guard}`;
  console.log(`\n${guard}`);
  const tabla = {};
  for (const f of filas) {
    const suyas = f.marcas.filter((x) => x.guard === guard);
    const k = `${blobQueCorrio(f, ruta).slice(0, 12)} + instr ${blobQueCorrio(f, INSTRUMENTO).slice(0, 12)}`;
    const o = (tabla[k] ??= { entero: 0, no: 0, ausente: 0, n: new Set() });
    if (!suyas.length) o.ausente += 1; else if (suyas.every((x) => x.marca === '✔')) o.entero += 1; else o.no += 1;
    o.n.add(suyas.length);
  }
  let total = 0; let cortados = 0; let conPata = 0;
  for (const [k, o] of Object.entries(tabla).sort((a, b) => (b[1].entero + b[1].no) - (a[1].entero + a[1].no))) {
    total += o.entero + o.no + o.ausente; cortados += o.no; if (o.no && o.entero) conPata += o.no;
    console.log(`  blob ${k} · mutaciones declaradas ${[...o.n].join('/')} → ENTERO en ${o.entero} · sin juzgar en ${o.no}${o.ausente ? ` · no lo nombra ${o.ausente}` : ''}`);
  }
  exige(total === filas.length, `SUMA: ${total} = ${filas.length} ejecuciones`);
  console.log(`  LA PATA: de las ${cortados} ejecuciones en que quedó sin juzgar, ${conPata} llevan una pareja de blobs que en OTRAS ejecuciones sale entera${cortados - conPata ? ` · ${cortados - conPata} NO tienen esa pata (su blob no se ve entero en ningún otro job)` : ''}`);
}
console.log(mal ? `\n🔴 ${mal} control(es) NO se cumplen: lo de arriba no vale` : '\ncontroles: todos se cumplen');
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
