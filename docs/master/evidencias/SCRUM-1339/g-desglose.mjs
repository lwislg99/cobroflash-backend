#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/g-desglose.mjs — SCRUM-1339g · SÓLO LECTURA.
//
// Desglose del TSV que escribe `e-tasa-de-main.mjs`: la conclusión de cada job medido, el reparto
// por día, los ficheros que pierden, y POR QUÉ un commit de main no tiene job obligatorio (se le
// pregunta a `gh` por cada uno de esos runs: dos llamadas por run).
//
//   node docs/master/evidencias/SCRUM-1339/g-desglose.mjs [<ruta del tsv>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tsv = process.argv[2] ?? path.join(import.meta.dirname, 'g-tasa-de-main.tsv');
const [cab, ...lineas] = fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean);
const k = cab.split('\t');
const filas = lineas.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [k[i], v])));
console.log(`POBLACIÓN: ${filas.length} filas del TSV (una por commit de main recorrido)`);
if (!filas.length) { console.log('SIN FILAS: no se mide nada.'); console.log('EXIT=3'); process.exit(3); }
const cuenta = (xs, f) => { const o = {}; for (const x of xs) o[f(x)] = (o[f(x)] ?? 0) + 1; return o; };
const medidos = filas.filter((f) => f.estado === 'CON AUSENTES' || f.estado === 'completo' || f.estado === 'sólo dudosos');
console.log(`medidos: ${medidos.length} · ${JSON.stringify(cuenta(medidos, (f) => `${f.estado} · job ${f.conclusion}`))}`);
const verdes = medidos.filter((f) => f.conclusion === 'success');
console.log(`jobs VERDES medidos: ${verdes.length}; de ellos con ausentes: ${verdes.filter((f) => f.estado === 'CON AUSENTES').length}`);
console.log(`por día: ${JSON.stringify(cuenta(medidos, (f) => f.fecha.slice(0, 10) + (f.estado === 'CON AUSENTES' ? ' con' : ' sin')))}`);
const aus = medidos.filter((f) => f.estado === 'CON AUSENTES').map((f) => Number(f.ausentes)).sort((a, b) => a - b);
if (aus.length) console.log(`ausentes por run afectado: mín ${aus[0]} · mediana ${aus[Math.floor(aus.length / 2)]} · máx ${aus.at(-1)} · suma ${aus.reduce((a, b) => a + b, 0)}`);
// un fichero cuenta UNA vez por run, aunque el aviso lo nombre dos
const fich = {};
for (const f of medidos) for (const n of new Set([...f.avisos.matchAll(/tests\/([\w.-]+\.test\.mjs)/g)].map((m) => m[1]))) fich[n] = (fich[n] ?? 0) + 1;
const orden = Object.entries(fich).sort((a, b) => b[1] - a[1]);
console.log(`ficheros distintos que pierden: ${orden.length} · ${orden.map(([n, c]) => `${n.replace('.test.mjs', '')} ${c}`).join(' · ')}`);

const sin = filas.filter((f) => f.estado === 'sin job obligatorio');
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const gh = (ruta) => JSON.parse(execFileSync('gh', ['api', ruta], { env, encoding: 'utf8' }));
const res = {};
let fallos = 0;
for (const f of sin) {
  try {
    const r = gh(`repos/lwislg99/cobroflash-backend/actions/runs/${f.run}`);
    const j = gh(`repos/lwislg99/cobroflash-backend/actions/runs/${f.run}/jobs?per_page=100`);
    const clave = `run ${r.status}/${r.conclusion} · ${j.jobs.length} jobs`;
    res[clave] = (res[clave] ?? 0) + 1;
  } catch { fallos++; }
}
console.log(`«sin job obligatorio»: ${sin.length} · no pude preguntar ${fallos} · ${JSON.stringify(res)}`);
console.log('EXIT=0');
