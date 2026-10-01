#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/comparar-mismo-arbol.mjs
//
// LA PREGUNTA DEL TICKET: con el MISMO árbol, ¿da «build + tests» siempre los mismos casos?
//
// Agrupa los jobs de medidos.tsv por ÁRBOL probado (no por cabeza de rama: un PR prueba la fusión
// con main, y dos runs de la misma cabeza pueden ser árboles distintos) y, dentro de cada grupo,
// compara CONJUNTOS de casos (nombre con su multiplicidad), no recuentos.
//
//   node comparar-mismo-arbol.mjs <carpeta> [--detalle]
//
// Un caso «perdido» es un nombre que está en otro job del MISMO árbol y no en éste. Si a la vez
// este job trae un nombre que el otro no tiene, puede ser un nombre que cambia solo (lleva una
// cifra dentro): se cuenta APARTE como «renombrado», no como pérdida.
import fs from 'node:fs';
import path from 'node:path';

const carpeta = process.argv[2];
const detalle = process.argv.includes('--detalle');
if (!carpeta) { console.error('uso: node comparar-mismo-arbol.mjs <carpeta> [--detalle]'); process.exit(2); }

const L = fs.readFileSync(path.join(carpeta, 'medidos.tsv'), 'utf8').split('\n').filter(Boolean);
const cab = L.shift().split('\t');
const jobs = L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const conResumen = jobs.filter((j) => j.tests !== '');

const casosDe = (job) => {
  const m = new Map(); const estado = new Map();
  for (const l of fs.readFileSync(path.join(carpeta, 'casos', `${job}.txt`), 'utf8').split('\n')) {
    if (!l) continue;
    const [est, , ...resto] = l.split('\t'); const nombre = resto.join('\t');
    m.set(nombre, (m.get(nombre) || 0) + 1); estado.set(nombre, est);
  }
  return { m, estado };
};

const grupos = new Map();
for (const j of conResumen) { if (!grupos.has(j.arbol)) grupos.set(j.arbol, []); grupos.get(j.arbol).push(j); }
const repetidos = [...grupos.entries()].filter(([, g]) => g.length > 1).sort((a, b) => a[1][0].empezo.localeCompare(b[1][0].empezo));

console.log(`POBLACION: ${jobs.length} jobs · con resumen ${conResumen.length} · árboles distintos ${grupos.size}`);
console.log(`  árboles probados MÁS DE UNA VEZ: ${repetidos.length} (suman ${repetidos.reduce((s, [, g]) => s + g.length, 0)} jobs)\n`);

let gruposDistintos = 0; let gruposDistintosVerdes = 0; let gruposTodosVerdes = 0; let jobsConPerdida = 0; let jobsVerdesConPerdida = 0;
const filas = [];
for (const [arbol, g] of repetidos) {
  const cs = g.map((j) => casosDe(j.job));
  const union = new Map();
  for (const c of cs) for (const [k, v] of c.m) union.set(k, Math.max(union.get(k) || 0, v));
  const totalUnion = [...union.values()].reduce((s, v) => s + v, 0);
  const verdes = g.filter((j) => j.fail === '0' && j.cancelled === '0');
  if (verdes.length === g.length) gruposTodosVerdes++;
  let distinto = false; let distintoVerde = false;
  const lineas = [];
  g.forEach((j, i) => {
    const faltan = [];
    for (const [k, v] of union) { const tengo = cs[i].m.get(k) || 0; if (tengo < v) faltan.push([k, v - tengo]); }
    const nFaltan = faltan.reduce((s, [, n]) => s + n, 0);
    const verde = j.fail === '0' && j.cancelled === '0';
    if (nFaltan > 0) { distinto = true; jobsConPerdida++; if (verde) { distintoVerde = true; jobsVerdesConPerdida++; } }
    lineas.push(`   job ${j.job} · run ${j.run}#${j.intento} · ${j.evento} · ${j.conclusion} · ${j.empezo} · tests ${j.tests} pass ${j.pass} fail ${j.fail} skip ${j.skipped} · le FALTAN ${nFaltan} de ${totalUnion}`);
    if (detalle || nFaltan > 0) for (const [k, n] of faltan.slice(0, detalle ? 400 : 6)) lineas.push(`        − ${n > 1 ? `(×${n}) ` : ''}${k.slice(0, 130)}`);
    if (!detalle && faltan.length > 6) lineas.push(`        … y ${faltan.length - 6} nombres más`);
    filas.push([arbol, j.job, j.run, j.intento, j.evento, j.conclusion, j.empezo, j.tests, j.pass, j.fail, j.skipped, totalUnion, nFaltan].join('\t'));
  });
  if (distinto) gruposDistintos++;
  if (distintoVerde) gruposDistintosVerdes++;
  if (distinto || detalle) { console.log(`── árbol ${arbol.slice(0, 12)} · ${g.length} jobs ${distinto ? '🔴 NO DAN LOS MISMOS CASOS' : 'iguales'}`); console.log(lineas.join('\n')); }
}
fs.writeFileSync(path.join(carpeta, 'mismo-arbol.tsv'), ['arbol\tjob\trun\tintento\tevento\tconclusion\tempezo\ttests\tpass\tfail\tskipped\tunion\tfaltan', ...filas].join('\n') + '\n');

console.log(`\nRESUMEN`);
console.log(`  árboles probados más de una vez: ${repetidos.length}`);
console.log(`  · en los que algún job NO trae todos los casos que trae otro del mismo árbol: ${gruposDistintos}`);
console.log(`  · de ésos, con la pérdida en un job VERDE (fail 0): ${gruposDistintosVerdes}`);
console.log(`  · grupos con todos sus jobs verdes: ${gruposTodosVerdes}`);
console.log(`  jobs con casos perdidos respecto a su grupo: ${jobsConPerdida} · de ellos verdes: ${jobsVerdesConPerdida}`);
console.log('EXIT=0');
