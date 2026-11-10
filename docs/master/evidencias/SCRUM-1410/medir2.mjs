// SCRUM-1410 ① — segunda pasada: qué pasó en el PR alrededor de cada empujón del bot.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(DIR, 'pr.git');
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const esAnc = (a, b) => { try { execFileSync('git', ['-C', REPO, 'merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } };
const filas = JSON.parse(fs.readFileSync(path.join(DIR, 'filas.json'), 'utf8'));
const prCommits = JSON.parse(fs.readFileSync(path.join(DIR, 'pr-commits.json'), 'utf8'));
const MAIN = execFileSync('git', ['-C', REPO, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim();
const cache = path.join(DIR, 'pr-info.json');
const info = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : {};
const T1263 = Date.parse('2026-09-29T09:44:12Z'); // merge de #1951 (SCRUM-1263), leído de origin/main
const HUMANO = /^(Javierpf28|lwislg99)$/;
const W = 6 * 3600e3;

// Los tres que el primer pase dejó sin PR por ir en main: su PR, de /commits/{sha}/pulls.
for (const f of filas) if (f.pr == null && !f.ramas.every(r => r.startsWith('claude/pr-')) && f.ramas.length) {
  const n = JSON.parse(gh('api', `repos/lwislg99/cobroflash-backend/commits/${f.sha}/pulls`, '-q', '[.[].number]'))[0];
  if (n) {
    f.pr = n; f.recuperado = true;
    prCommits[n] ??= JSON.parse(gh('api', '--paginate', `repos/lwislg99/cobroflash-backend/pulls/${n}/commits?per_page=100`,
      '-q', '[.[] | {sha, an: .commit.author.name, ad: .commit.author.date, p: [.parents[].sha]}]').replace(/\]\s*\[/g, ','));
    const t = Date.parse(f.fecha);
    f.paralelos = prCommits[n].filter(c => !/\[bot\]$/.test(c.an) && !esAnc(c.sha, f.sha) && !esAnc(f.sha, c.sha))
      .map(c => ({ sha: c.sha.slice(0, 8), an: c.an, ad: c.ad }));
    f.enListaDelPR = prCommits[n].some(c => c.sha === f.sha);
  }
}
for (const f of filas) {
  if (f.pr == null) continue;
  const n = f.pr;
  if (!info[n]) {
    const pr = JSON.parse(gh('api', `repos/lwislg99/cobroflash-backend/pulls/${n}`, '-q', '{merged_at, closed_at, state, ref: .head.ref}'));
    const com = JSON.parse(gh('api', '--paginate', `repos/lwislg99/cobroflash-backend/issues/${n}/comments?per_page=100`, '-q', '[.[] | {u: .user.login, t: .created_at}]').replace(/\]\s*\[/g, ','));
    const ev = JSON.parse(gh('api', '--paginate', `repos/lwislg99/cobroflash-backend/issues/${n}/events?per_page=100`, '-q', '[.[] | {u: .actor.login, e: .event, t: .created_at}]').replace(/\]\s*\[/g, ','));
    info[n] = { ...pr, com, ev };
    fs.writeFileSync(cache, JSON.stringify(info));
  }
  const I = info[n], t = Date.parse(f.fecha);
  f.ref = I.ref; f.merged = !!I.merged_at; f.estado = I.state;
  f.enMain = esAnc(f.sha, MAIN);
  f.tras1263 = t >= T1263;
  const humanoDespues = [...I.com.map(c => ({ ...c, e: 'comentario' })), ...I.ev]
    .filter(x => HUMANO.test(x.u ?? '') && Date.parse(x.t) > t && Date.parse(x.t) - t <= W);
  f.humanoDespues = humanoDespues.map(x => `${x.e}@${x.t.slice(5, 16)}`);
  const sesDesp = (prCommits[n] || []).filter(c => !/\[bot\]$/.test(c.an) && Date.parse(c.ad) > t && Date.parse(c.ad) - t <= W);
  f.sesionDespuesW = sesDesp.length;
  f.cat = f.paralelos?.length ? (Date.parse(f.paralelos[0].ad) - t <= W ? 'A-PARALELO' : 'A2-PARALELO-TARDIO')
    : (sesDesp.length ? 'B-SESION-SIGUIO' : (humanoDespues.length ? 'C-HUMANO-ACTUO' : 'D-NADIE-EN-6H'));
}
fs.writeFileSync(path.join(DIR, 'filas2.json'), JSON.stringify(filas, null, 1));
const tab = {};
for (const f of filas) {
  const k = f.pr == null ? 'Z-SIN-PR (claude/pr-*)' : f.cat;
  const e = f.pr == null ? '-' : (f.tras1263 ? 'tras-1263' : 'antes-1263');
  tab[k] ??= { 'antes-1263': 0, 'tras-1263': 0, '-': 0, enMain: 0, prsCerradosSinMerge: 0 };
  tab[k][e]++; if (f.enMain) tab[k].enMain++; if (f.pr != null && !f.merged) tab[k].prsCerradosSinMerge++;
}
console.log(`poblacion ${filas.length} · recuperados por /commits/pulls ${filas.filter(f => f.recuperado).length}`);
console.table(tab);
for (const f of filas.filter(f => f.pr != null && f.tras1263)) console.log(f.cat, '#' + f.pr, f.sha.slice(0, 8), f.fecha, 'merged=' + f.merged, 'enMain=' + f.enMain, 'humano=' + f.humanoDespues.join(','));
