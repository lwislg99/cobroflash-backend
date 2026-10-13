// f-sep.mjs <repo> <despl.json> — los 4 CONGELADO de 24/25-sep: ¿hueco real o edad de rama?
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [repo, despl] = process.argv.slice(2);
const git = (...a) => { try { return execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim(); } catch (e) { return null; } };
const D = JSON.parse(fs.readFileSync(despl, 'utf8')).despliegues;
const iso = (e) => new Date(e * 1000).toISOString().replace('.000Z', 'Z');
const casos = [['2026-09-24T22:47:04Z', 'b77a3cb3', 'db771431', 177.0, 19], ['2026-09-25T02:10:50Z', 'b77a3cb3', 'db771431', 180.4, 19], ['2026-09-25T09:09:13Z', 'b77a3cb3', '639a276f', 187.4, 21], ['2026-09-25T14:49:21Z', 'b77a3cb3', 'c906a53c', 193.0, 35]];
for (const [cuando, p8, m8, hueco, c] of casos) {
  const P = git('rev-parse', p8); const M = git('rev-parse', m8);
  if (!P || !M) { console.log(cuando, 'CIEGO: no resuelve', p8, P, m8, M); continue; }
  const ahora = Date.parse(cuando) / 1000;
  const fp = git('log', '--first-parent', '--format=%ct %H', P + '..' + M).split('\n').map((l) => ({ ct: Number(l.split(' ')[0]), H: l.split(' ')[1] }));
  const todos = git('log', '--format=%ct', P + '..' + M).split('\n').map(Number);
  const v = fp.reduce((a, b) => (b.ct < a.ct ? b : a));
  const dP = D.filter((d) => d.sha === P);
  console.log(`${cuando} vigia ${hueco}h c=${c} | recalculo ${((ahora - Math.min(...todos)) / 3600).toFixed(1)}h c=${todos.length} | PRIMER PADRE ${fp.length} merges; el mas viejo entro ${iso(v.ct)} = ${((ahora - v.ct) / 3600).toFixed(1)} h antes | despliegues de prod(${p8}): ${dP.map((d) => d.creado + ':' + d.estados.map((s) => s.e).join(',')).join(' ; ') || 'ninguno en la ventana'}`);
}
// que paso con los despliegues entre el 24-sep 00:00 y el 26-sep 00:00
const v = D.filter((d) => d.creado >= '2026-09-23' && d.creado < '2026-09-27').sort((a, b) => (a.creado < b.creado ? -1 : 1));
const fin = (d) => (d.estados.some((s) => s.e === 'SUCCESS') ? 'OK' : d.estados.some((s) => s.e === 'FAILURE' || s.e === 'ERROR') ? 'FALLO' : 'OTRO');
console.log(`despliegues 23..26-sep: ${v.length} | OK=${v.filter((d) => fin(d) === 'OK').length} FALLO=${v.filter((d) => fin(d) === 'FALLO').length} OTRO=${v.filter((d) => fin(d) === 'OTRO').length}`);
let racha = null;
for (const d of v) { const f = fin(d); if (f !== racha) { console.log('  desde', d.creado, d.sha.slice(0, 8), f); racha = f; } }
const oks = v.filter((d) => fin(d) === 'OK').map((d) => d.estados.filter((s) => s.e === 'SUCCESS').map((s) => s.t).sort()[0]).sort();
let max = 0; let par = null; for (let i = 1; i < oks.length; i++) { const h = (Date.parse(oks[i]) - Date.parse(oks[i - 1])) / 3600000; if (h > max) { max = h; par = [oks[i - 1], oks[i]]; } }
console.log('  mayor hueco entre dos despliegues OK consecutivos:', max.toFixed(1), 'h', par);
