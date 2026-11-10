// Sonda: huecos entre despliegues de Railway (GitHub deployments) y cobertura de los commits de main.
// Uso: node huecos.mjs <deploys-all.txt> <repo>
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [fich, repo] = process.argv.slice(2);
const dep = readFileSync(fich, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
  .map((l) => { const [t, sha] = l.split(' '); return { t: new Date(t), sha }; }).sort((a, b) => a.t - b.t);
const huecos = [];
for (let i = 1; i < dep.length; i++) huecos.push({ desde: dep[i - 1].t.toISOString(), hasta: dep[i].t.toISOString(), h: (dep[i].t - dep[i - 1].t) / 36e5, sha: dep[i - 1].sha });
huecos.sort((a, b) => b.h - a.h);
console.log(`población: ${dep.length} despliegues, de ${dep[0].t.toISOString()} a ${dep.at(-1).t.toISOString()}`);
console.log('los 8 huecos más largos (h):');
for (const x of huecos.slice(0, 8)) console.log(`  ${x.h.toFixed(1)} h · ${x.desde} → ${x.hasta} (último antes: ${x.sha})`);
// commits de main (primer padre) con su hora de COMMIT del merge, y si tienen despliegue
const log = execFileSync('git', ['-C', repo, 'log', '--first-parent', '--format=%H %cI', 'origin/main', '--since=2026-10-15'], { maxBuffer: 1 << 26 }).toString().trim().split('\n')
  .map((l) => { const [h, t] = l.split(' '); return { h, t: new Date(t) }; });
const conDep = new Set(dep.map((d) => d.sha));
const porDia = {};
for (const c of log) {
  const dia = c.t.toISOString().slice(0, 10);
  porDia[dia] ??= { commits: 0, con: 0 };
  porDia[dia].commits++;
  if (conDep.has(c.h.slice(0, 9))) porDia[dia].con++;
}
console.log('commits de main (primer padre) desde el 15-oct, y cuántos tienen despliegue:');
for (const [d, v] of Object.entries(porDia).sort()) console.log(`  ${d}: ${v.con}/${v.commits}`);
const ventana = log.filter((c) => c.t > new Date('2026-10-20T15:35:37Z') && c.t < new Date('2026-10-23T02:49:24Z'));
console.log(`en la ventana 20-oct 15:35:37Z → 23-oct 02:49:24Z: ${ventana.length} commits de main, ${ventana.filter((c) => conDep.has(c.h.slice(0, 9))).length} con despliegue`);
const desde = log.filter((c) => c.t >= new Date('2026-10-23T02:49:00Z'));
const sin = desde.filter((c) => !conDep.has(c.h.slice(0, 9)));
console.log(`desde el 23-oct 02:49Z: ${desde.length} commits de main, ${desde.length - sin.length} con despliegue; sin: ${sin.map((c) => c.h.slice(0, 9) + '@' + c.t.toISOString()).join(', ') || 'ninguno'}`);
