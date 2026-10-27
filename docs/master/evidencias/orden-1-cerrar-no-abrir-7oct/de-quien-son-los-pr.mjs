// Para cada PR mergeado de la lista: ¿su merge es ancestro de origin/main? ¿quién firmó sus commits?
// uso: node autores.mjs <raíz del repo> <pr-mergeados.tsv>
// Población declarada al final. Un PR cuyo merge no se resuelve sale CIEGO, no «0 commits».
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [raiz, lista] = process.argv.slice(2);
const git = (...a) => execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
const punta = git('rev-parse', 'origin/main');
const filas = fs.readFileSync(lista, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
let ciegos = 0, ancestros = 0;
const out = [];
for (const [pr, mergedAt, sha, , rama] of filas) {
  let anc = 'NO';
  try { execFileSync('git', ['-C', raiz, 'merge-base', '--is-ancestor', sha, punta]); anc = 'sí'; ancestros++; } catch { anc = 'NO'; }
  let autores = 'CIEGO', n = 0, rutas = '';
  try {
    const padres = git('rev-list', '--parents', '-n', '1', sha).split(' ');
    if (padres.length < 3) throw new Error('no es un merge de dos padres');
    const log = git('log', '--no-merges', '--format=%an', `${padres[1]}..${padres[2]}`).split('\n').filter(Boolean);
    n = log.length;
    const cuenta = {};
    for (const a of log) cuenta[a] = (cuenta[a] ?? 0) + 1;
    autores = Object.entries(cuenta).map(([a, c]) => `${a}×${c}`).join(' · ') || '(sin commits propios)';
    const fich = git('diff', '--name-only', `${padres[1]}...${padres[2]}`).split('\n').filter(Boolean);
    const zonas = {};
    for (const f of fich) { const z = f.split('/')[0]; zonas[z] = (zonas[z] ?? 0) + 1; }
    rutas = Object.entries(zonas).map(([z, c]) => `${z}:${c}`).join(' ');
  } catch (e) { ciegos++; autores = `CIEGO (${e.message.split('\n')[0].slice(0, 60)})`; }
  const t = (rama.match(/^(?:scrum-|j\w+-)0*(\d+)/i) ?? [])[1] ?? '?';
  out.push([pr, mergedAt, t, anc, autores, rutas, rama].join('\t'));
}
out.sort((a, b) => a.split('\t')[1].localeCompare(b.split('\t')[1]));
console.log(out.join('\n'));
console.error(`# población: ${filas.length} PR · ancestros de origin/main (${punta.slice(0, 8)}): ${ancestros} · ciegos: ${ciegos}`);
