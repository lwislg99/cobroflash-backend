// c-hueco.mjs <dir> <repo> — para cada lectura del vigia con hueco: la cifra del vigia (min %ct de
// TODO prod..main) contra la hora en que el commit mas antiguo que falta ENTRO en main (min %ct de
// la cadena de primer padre), y contra el despliegue que Railway conto a GitHub.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [dir, repo, despl] = process.argv.slice(2);
const git = (...a) => { try { return execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim(); } catch { return null; } };
const leido = JSON.parse(fs.readFileSync(path.join(dir, 'leido.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(despl, 'utf8')).despliegues;
const iso = (e) => new Date(e * 1000).toISOString().replace('.000Z', 'Z');
const exito = (sha) => {
  const d = D.filter((x) => x.sha === sha);
  const t = d.flatMap((x) => x.estados.filter((s) => s.e === 'SUCCESS').map((s) => s.t)).sort()[0];
  return { n: d.length, creado: d.map((x) => x.creado).sort()[0] || null, exito: t || null, estados: d.flatMap((x) => x.estados.map((s) => s.e)).join(',') };
};
let n = 0; let control0 = 0;
const filas = [];
for (const o of leido.sort((a, b) => (a.inicio < b.inicio ? -1 : 1))) {
  const m = /vigía · (\S+) · (\S+) · prod=(\S+) · main=(\S+) · hueco=(\S+)h · commits=(\S+)/.exec(o.renglon || '');
  if (!m) continue;
  const [, cuando, ver, p8, m8, hueco, commits] = m;
  if (commits === '0') { control0++; continue; }
  n++;
  const P = git('rev-parse', p8); const M = git('rev-parse', m8);
  const ahora = Date.parse(cuando) / 1000;
  const todos = git('log', '--format=%ct %h %s', P + '..' + M).split('\n').map((l) => ({ ct: Number(l.split(' ')[0]), h: l.split(' ')[1], s: l.split(' ').slice(2).join(' ') }));
  const fp = git('log', '--first-parent', '--format=%ct %H %s', P + '..' + M).split('\n').map((l) => ({ ct: Number(l.split(' ')[0]), H: l.split(' ')[1], s: l.split(' ').slice(2).join(' ') }));
  const viejo = todos.reduce((a, b) => (b.ct < a.ct ? b : a));
  const viejoFp = fp.reduce((a, b) => (b.ct < a.ct ? b : a));
  const hVig = (ahora - viejo.ct) / 3600; const hFp = (ahora - viejoFp.ct) / 3600;
  const eP = exito(P); const eM = exito(M); const eV = exito(viejoFp.H);
  filas.push({ cuando, ver, p8, m8, hueco: Number(hueco), commits: Number(commits), recalculo: hVig, nTodos: todos.length, nFp: fp.length, hFp, viejo, viejoFp, eP, eM, eV, ritmo: o.ritmo.some((l) => /RETRASADO/.test(l)) ? 'DESPLIEGA' : o.ritmo.some((l) => /CONGELADA/.test(l)) ? 'CONGELADO' : '-', concl: o.concl });
  console.log(`${cuando} ${ver} prod=${p8} main=${m8} | vigia: ${hueco}h c=${commits} | recalculo: ${hVig.toFixed(1)}h c=${todos.length} | PRIMER PADRE: ${fp.length} merges, el mas viejo entro ${iso(viejoFp.ct)} = ${(hFp * 60).toFixed(1)} min | prod desplegado OK ${eP.exito} (n=${eP.n}) | despl. del mas viejo que falta: creado ${eV.creado} ok ${eV.exito} [${eV.estados}] | ${filas.at(-1).ritmo} ${o.concl}`);
}
console.log(`POBLACION con-hueco=${n} sin-hueco(no entran)=${control0} total=${n + control0}`);
console.log(`recalculo == vigia (a 0,1 h): ${filas.filter((f) => Math.abs(f.recalculo - f.hueco) <= 0.1 && f.nTodos === f.commits).length} de ${filas.length}`);
console.log(`vigia infla mas de 1 h sobre primer padre: ${filas.filter((f) => f.hueco - f.hFp > 1).length} de ${filas.length}`);
console.log(`primer padre > 6 h (hueco REAL fuera de margen): ${filas.filter((f) => f.hFp > 6).length} de ${filas.length}`);
fs.writeFileSync(path.join(dir, 'hueco.json'), JSON.stringify(filas, null, 1));
