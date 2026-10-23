// Bordes de la ventana y huecos históricos con commits de main sin desplegar. Uso: node bordes.mjs <deploys-all.txt> <repo>
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [fich, repo] = process.argv.slice(2);
const dep = readFileSync(fich, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
  .map((l) => { const [t, sha] = l.split(' '); return { t: new Date(t), sha }; }).sort((a, b) => a.t - b.t);
const conDep = new Map(dep.map((d) => [d.sha, d.t]));
const log = execFileSync('git', ['-C', repo, 'log', '--first-parent', '--format=%H %cI %s', 'origin/main', '--since=2026-05-15'], { maxBuffer: 1 << 28 }).toString().trim().split('\n')
  .map((l) => { const [h, t, ...s] = l.split(' '); return { h: h.slice(0, 9), t: new Date(t), s: s.join(' ').slice(0, 70) }; }).sort((a, b) => a.t - b.t);
const fila = (c) => `${c.t.toISOString()} ${c.h} ${conDep.has(c.h) ? 'DESPLEGADO ' + conDep.get(c.h).toISOString() : 'sin despliegue'} · ${c.s}`;
console.log('— borde de entrada (20-oct 15:00Z → 21-oct 06:00Z):');
for (const c of log.filter((c) => c.t > new Date('2026-10-20T15:00Z') && c.t < new Date('2026-10-21T06:00Z'))) console.log('  ' + fila(c));
console.log('— borde de salida (22-oct 20:00Z → 23-oct 03:00Z):');
for (const c of log.filter((c) => c.t > new Date('2026-10-22T20:00Z') && c.t < new Date('2026-10-23T03:00Z'))) console.log('  ' + fila(c));
// rachas de commits de main SIN despliegue, en toda la historia
const rachas = []; let r = null;
for (const c of log) {
  if (!conDep.has(c.h)) { if (!r) r = { desde: c.t, n: 0, primero: c.h }; r.n++; r.hasta = c.t; r.ultimo = c.h; }
  else if (r) { rachas.push(r); r = null; }
}
if (r) rachas.push(r);
rachas.sort((a, b) => b.n - a.n);
console.log(`— población: ${log.length} commits de main (primer padre) desde el 15-may; sin despliegue: ${log.filter((c) => !conDep.has(c.h)).length}`);
console.log('— las 8 rachas más largas de commits de main seguidos SIN despliegue:');
for (const x of rachas.slice(0, 8)) console.log(`  ${x.n} commits · ${x.desde.toISOString()} → ${x.hasta.toISOString()} (${x.primero} … ${x.ultimo})`);
