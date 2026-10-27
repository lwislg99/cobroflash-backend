// d-real.mjs <repo> <despl.json> <desdeSha> — el retraso REAL de produccion, sin el vigia:
// para cada commit de la cadena de primer padre de main, cuanto tardo en estar vivo (primer
// despliegue SUCCESS de ese commit o de uno posterior de la cadena). Y los despliegues fallidos.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [repo, despl, desde] = process.argv.slice(2);
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const D = JSON.parse(fs.readFileSync(despl, 'utf8')).despliegues;
const fp = git('log', '--first-parent', '--reverse', '--format=%H %ct', desde + '..origin/main').split('\n').map((l, i) => ({ H: l.split(' ')[0], ct: Number(l.split(' ')[1]), i }));
const idx = new Map(fp.map((c) => [c.H, c.i]));
const ok = []; let fuera = 0; const finales = {};
for (const d of D) {
  const est = d.estados.slice().sort((a, b) => (a.t < b.t ? -1 : 1));
  const s = est.find((e) => e.e === 'SUCCESS');
  const fin = est.some((e) => e.e === 'SUCCESS') ? 'SUCCESS' : est.some((e) => e.e === 'FAILURE' || e.e === 'ERROR') ? 'FAILURE' : (est.at(-1) || {}).e || 'SIN-ESTADO';
  finales[fin] = (finales[fin] || 0) + 1;
  d.fin = fin;
  if (!idx.has(d.sha)) { fuera++; continue; }
  if (s) ok.push({ i: idx.get(d.sha), t: Date.parse(s.t) / 1000 });
}
console.log(`POBLACION primer-padre=${fp.length} despliegues=${D.length} fuera-de-la-cadena=${fuera} por-final=${JSON.stringify(finales)}`);
let sinDesp = 0; const lags = [];
for (const c of fp) {
  const t = Math.min(...ok.filter((o) => o.i >= c.i).map((o) => o.t));
  if (!Number.isFinite(t)) { sinDesp++; continue; }
  lags.push({ H: c.H.slice(0, 8), entro: new Date(c.ct * 1000).toISOString(), min: (t - c.ct) / 60, propio: ok.some((o) => o.i === c.i) });
}
lags.sort((a, b) => b.min - a.min);
const q = (p) => lags[Math.floor((1 - p) * (lags.length - 1))].min.toFixed(1);
console.log(`commits con vivo medido=${lags.length} sin despliegue OK posterior (los de la punta)=${sinDesp}`);
console.log(`retraso REAL en minutos: mediana=${q(0.5)} p90=${q(0.9)} max=${lags[0].min.toFixed(1)} | mas de 6 h: ${lags.filter((l) => l.min > 360).length} | mas de 30 min: ${lags.filter((l) => l.min > 30).length}`);
console.log('los 6 peores:'); for (const l of lags.slice(0, 6)) console.log('  ', l.H, l.entro, l.min.toFixed(1) + ' min', l.propio ? 'desplegado el mismo' : 'cubierto por uno posterior');
console.log('despliegues que NO llegaron a SUCCESS:');
for (const d of D.filter((x) => x.fin !== 'SUCCESS')) console.log('  ', d.sha.slice(0, 8), d.creado, d.fin, d.estados.map((e) => e.e + '@' + e.t.slice(11, 19)).join(' '));
// CONTROL POSITIVO SEMBRADO: una produccion fabricada, parada en el commit de hace N merges.
const viejo = fp[0]; const punta = fp.at(-1);
const n = Number(git('rev-list', '--count', '--first-parent', viejo.H + '..' + punta.H));
const masViejoFp = Math.min(...git('log', '--first-parent', '--format=%ct', viejo.H + '..' + punta.H).split('\n').map(Number));
console.log(`CONTROL SEMBRADO: prod fabricada=${viejo.H.slice(0, 8)} main=${punta.H.slice(0, 8)} -> primer padre: ${n} merges, hueco ${((punta.ct - masViejoFp) / 3600).toFixed(1)} h (tiene que ser MUCHO mas de 6)`);
