// docs/master/evidencias/scrum1092/censo-reflog.mjs — SCRUM-1092 punto 2 · SOLO LECTURA
//
// El censo de censo-merges.mjs cruza NOMBRE de rama contra MENSAJE de commit sobre el historial
// COMPLETO (todas las ramas, de todos los worktrees). Este es un cruce distinto y más fuerte,
// pero de alcance MENOR: usa el reflog de HEAD de ESTE checkout (el que da `git rev-parse
// --git-dir` == `.git`, no un worktree con .git puntero) para saber, en cada commit hecho AQUÍ,
// en qué rama estaba de verdad el HEAD de este árbol en ese instante — el dato que
// censo-merges.mjs sólo puede INFERIR a partir del merge.
//
// Alcance: sólo ve lo cometido en ESTE árbol compartido, y sólo hasta donde llega el reflog local
// (`git reflog show HEAD`, que en esta máquina no pasa de 2026-08-17: lo anterior ya no está,
// no es que aquí no pasara nada). Un CERO de este censo no cubre lo cometido en los ~60 worktrees
// dedicados (cada uno tiene su PROPIO reflog de HEAD, no compartido) ni nada anterior a esa fecha.
//
//   node docs/master/evidencias/scrum1092/censo-reflog.mjs
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const numDe = (rama) => { const m = (rama || '').match(/^scrum-0*(\d+)/i); return m ? Number(m[1]) : null; };

const raw = git('reflog', 'show', '--date=iso-strict', 'HEAD');
const lineasCron = raw.split(/\r?\n/).filter(Boolean).reverse(); // el reflog nace mas nuevo primero

let rama = null;
const eventos = [];
for (const l of lineasCron) {
  const m = l.match(/^([0-9a-f]+) HEAD@\{([^}]+)\}: (.+)$/);
  if (!m) continue;
  const [, sha, fecha, resto] = m;
  const co = resto.match(/^checkout: moving from (\S+) to (\S+)/);
  if (co) { rama = co[2]; eventos.push({ fecha, tipo: 'checkout', de: co[1], a: co[2], sha }); continue; }
  const cm = resto.match(/^(commit|commit \(amend\)|cherry-pick): (.+)$/);
  if (cm) { eventos.push({ fecha, tipo: 'commit', rama, msg: cm[2], sha }); continue; }
}
console.log(`ventana del reflog: ${eventos[0]?.fecha ?? '(vacio)'} .. ${eventos[eventos.length - 1]?.fecha ?? '(vacio)'}`);
console.log(`eventos totales: ${eventos.length} · checkouts: ${eventos.filter((e) => e.tipo === 'checkout').length} · commits: ${eventos.filter((e) => e.tipo === 'commit').length}`);

let mismatches = 0;
console.log('\n=== COMMITS HECHOS MIENTRAS HEAD ESTABA EN OTRA RAMA (segun el reflog) ===');
for (const e of eventos) {
  if (e.tipo !== 'commit') continue;
  const tks = [...e.msg.matchAll(/SCRUM[-\s]0*(\d+)/gi)].map((x) => Number(x[1]));
  if (!tks.length) continue;
  const nr = numDe(e.rama);
  if (nr === null) continue;
  if (!tks.includes(nr)) {
    mismatches++;
    console.log(`${e.fecha} | rama(reflog en ese instante)=${e.rama} (ticket ${nr}) | commit tickets=${tks.join(',')} | ${e.msg.slice(0, 100)}`);
  }
}
console.log(`\nMISMATCH via reflog: ${mismatches}`);
