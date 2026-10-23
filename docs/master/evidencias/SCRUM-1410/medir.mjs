// SCRUM-1410 ① — sonda de un solo uso. Lee un repo desnudo con refs/pr/* y la API de PR.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(DIR, 'pr.git');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const esAnc = (a, b) => { try { execFileSync('git', ['-C', REPO, 'merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } };
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 1 << 28 });

const BOT = /^claude\[bot\]$/;
const MAQUINA = /\[bot\]$/;
const bots = fs.readFileSync(path.join(DIR, 'bot-commits.txt'), 'utf8').trim().split('\n')
  .map(l => { const [sha, fecha, ...s] = l.split(' '); return { sha, fecha, asunto: s.join(' ') }; });

const cache = path.join(DIR, 'pr-commits.json');
const prCommits = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : {};
const filas = [];
for (const b of bots) {
  const prs = git('for-each-ref', '--contains', b.sha, '--format=%(refname:short)', 'refs/pr')
    .split('\n').filter(Boolean).map(r => Number(r.replace('pr/', ''))).sort((x, y) => x - y);
  const ramas = git('for-each-ref', '--contains', b.sha, '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean);
  b.parent = git('rev-parse', `${b.sha}^`);
  // El PR propio: el de número más bajo cuya lista de commits (API) lo contiene.
  let pr = null;
  for (const n of prs.slice(0, 6)) {
    if (!prCommits[n]) {
      prCommits[n] = JSON.parse(gh('api', '--paginate', `repos/lwislg99/cobroflash-backend/pulls/${n}/commits?per_page=100`,
        '-q', '[.[] | {sha, an: .commit.author.name, ad: .commit.author.date, cd: .commit.committer.date, p: [.parents[].sha]}]')
        .replace(/\]\s*\[/g, ','));
      fs.writeFileSync(cache, JSON.stringify(prCommits));
    }
    if (prCommits[n].some(c => c.sha === b.sha)) { pr = n; break; }
  }
  filas.push({ ...b, prs: prs.length, prMin: prs[0] ?? null, pr, ramas });
}

// Análisis por commit del bot
const H = 3600e3;
for (const f of filas) {
  if (f.pr == null) { f.veredicto = 'SIN-PR'; continue; }
  const cs = prCommits[f.pr];
  const t = Date.parse(f.fecha);
  const sesion = cs.filter(c => !MAQUINA.test(c.an));
  const antes = sesion.filter(c => Date.parse(c.ad) <= t).map(c => Date.parse(c.ad));
  const despues = sesion.filter(c => Date.parse(c.ad) > t);
  f.ultimaSesionAntes_min = antes.length ? Math.round((t - Math.max(...antes)) / 60e3) : null;
  f.sesionDespues = despues.length;
  f.primeraSesionDespues_min = despues.length ? Math.round((Math.min(...despues.map(c => Date.parse(c.ad))) - t) / 60e3) : null;
  // Paralelo: commit de sesión que no es antepasado del bot ni descendiente suyo => escrito sobre una base sin el bot
  f.paralelos = sesion.filter(c => c.sha !== f.sha && !esAnc(c.sha, f.sha) && !esAnc(f.sha, c.sha))
    .map(c => ({ sha: c.sha.slice(0, 8), an: c.an, ad: c.ad }));
  // Merge de sesión que junta al bot con trabajo paralelo
  f.mergeJunta = sesion.filter(c => c.p.length > 1 && c.p.some(p => esAnc(f.sha, p)) && c.p.some(p => !esAnc(f.sha, p) && f.paralelos.some(x => p.startsWith(x.sha))))
    .map(c => c.sha.slice(0, 8));
  f.otrosBotDelPR = cs.filter(c => BOT.test(c.an)).length;
}
fs.writeFileSync(path.join(DIR, 'filas.json'), JSON.stringify(filas, null, 1));
const n = filas.length;
const conPR = filas.filter(f => f.pr != null);
console.log(`poblacion: ${n} commits claude[bot] · con PR propio ${conPR.length} · SIN-PR ${n - conPR.length} · PR distintos ${new Set(conPR.map(f => f.pr)).size}`);
console.log(`con commit de sesion PARALELO (escrito sin el del bot): ${conPR.filter(f => f.paralelos.length).length} commits en ${new Set(conPR.filter(f => f.paralelos.length).map(f => f.pr)).size} PR`);
console.log(`con merge de sesion que junta bot + paralelo: ${conPR.filter(f => f.mergeJunta.length).length}`);
console.log(`con commit de sesion DESPUES del bot: ${conPR.filter(f => f.sesionDespues).length}`);
