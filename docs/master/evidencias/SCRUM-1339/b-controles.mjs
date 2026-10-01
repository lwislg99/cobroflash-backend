#!/usr/bin/env node
// Controles del instrumento de analizar.mjs, contra una fuente que no es el TAP: el log `spec`.
//   node controles.mjs <carpeta>
import fs from 'node:fs';
import path from 'node:path';
const carpeta = process.argv[2];
const leeTsv = (f) => { const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); const c = L.shift().split('\t'); return L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [c[i], v]))); };
const A = leeTsv(path.join(carpeta, 'analisis.tsv'));
const B = new Map(leeTsv(path.join(carpeta, 'bajados.tsv')).map((f) => [f.id, f]));

let conLog = 0; let declIgual = 0; let declDist = []; let testsIgual = 0; let testsDist = []; let sueloOk = 0; let sueloRojo = 0; let sueloOtro = 0; const sueloDe = new Map();
for (const f of A) {
  const b = B.get(f.id);
  const log = path.join(carpeta, 'logs', `${f.id}.log`);
  if (!fs.existsSync(log)) continue;
  if (b.intento !== b.intentos) continue; // el log es del último intento
  const txt = fs.readFileSync(log, 'utf8');
  const s = txt.match(/\[suelo de la tanda\] ([^\n]*)/);
  if (s) { sueloDe.set(f.id, s[1].slice(0, 160)); if (s[1].startsWith('✅')) sueloOk++; else if (s[1].startsWith('🔴')) sueloRojo++; else sueloOtro++; }
  if (f.entero !== 'sí' || f.declaradas === '') continue;
  conLog++;
  const d = txt.match(/declara (\d+) tests/);
  if (d) { if (Number(d[1]) === Number(f.declaradas)) declIgual++; else declDist.push(`${f.id}: suelo ${d[1]} vs mío ${f.declaradas}`); }
  const t = [...txt.matchAll(/ℹ tests (\d+)/g)].map((m) => Number(m[1]));
  if (t.length) { if (t.includes(Number(f.tests))) testsIgual++; else testsDist.push(`${f.id}: spec ${t.join('/')} vs TAP ${f.tests}`); }
}
console.log(`CONTROL ① árbol: «declara N» que imprime el suelo DENTRO del job == llamadas que yo cuento en el árbol reconstruido: ${declIgual} de ${conLog}` + (declDist.length ? ` · distintos: ${declDist.join(' | ')}` : ''));
console.log(`CONTROL ② mismo run: «ℹ tests N» del log spec == «# tests N» del TAP: ${testsIgual} de ${conLog}` + (testsDist.length ? ` · distintos: ${testsDist.join(' | ')}` : ''));

const med = A.filter((f) => f.entero === 'sí' && f.faltan !== '');
const conF = med.filter((f) => Number(f.faltan) > 0);
const tot = (xs, k) => xs.reduce((a, f) => a + Number(f[k]), 0);
console.log(`\nPOBLACIÓN medida: ${med.length} jobs con TAP entero y árbol resuelto · creados ${med.map((f) => f.creado).sort()[0]} → ${med.map((f) => f.creado).sort().at(-1)}`);
const por = (xs, k) => { const m = {}; for (const f of xs) m[f[k]] = (m[f[k]] || 0) + 1; return JSON.stringify(m); };
console.log(`  por conclusión del job: ${por(med, 'conclusion')} · por evento: ${por(med, 'evento')}`);
console.log(`CON NOMBRES AUSENTES: ${conF.length} de ${med.length} (${Math.round(100 * conF.length / med.length)} %) · nombres ausentes en total ${tot(conF, 'faltan')}`);
console.log(`  por conclusión: ${por(conF, 'conclusion')} · por evento: ${por(conF, 'evento')}`);
const verdes = med.filter((f) => f.conclusion === 'success');
console.log(`  de los ${verdes.length} jobs VERDES: con pérdida ${conF.filter((f) => f.conclusion === 'success').length}`);
const push = med.filter((f) => f.evento === 'push');
console.log(`  de los ${push.length} de push a main: con pérdida ${conF.filter((f) => f.evento === 'push').length} (${por(conF.filter((f) => f.evento === 'push'), 'conclusion')})`);

const D = leeTsv(path.join(carpeta, 'faltan-por-fichero.tsv'));
console.log(`\nBLOQUES (fichero × job): ${D.length} · por forma: ${por(D, 'forma')} · por entrada: ${por(D, 'entrada')}`);
const pf = new Map(); for (const d of D) { const k = d.fichero; if (!pf.has(k)) pf.set(k, { jobs: 0, casos: 0, formas: new Set() }); const x = pf.get(k); x.jobs++; x.casos += Number(d.faltan); x.formas.add(d.forma); }
for (const [k, x] of [...pf.entries()].sort((a, b) => b[1].jobs - a[1].jobs)) console.log(`  ${String(x.jobs).padStart(3)} jobs · ${String(x.casos).padStart(4)} nombres · ${[...x.formas].join('+')} · ${k}`);
const con237 = new Set(D.filter((d) => d.forma === 'entero').map((d) => d.artefacto));
console.log(`\nLO QUE VE EL SUELO DE HOY (SCRUM-702 + 1380): jobs con una entrada de fichero: ${con237.size} de ${conF.length} con pérdida`);
console.log(`  nombres ausentes dentro de un fichero ENTERO: ${D.filter((d) => d.forma === 'entero').reduce((a, d) => a + Number(d.faltan), 0)} de ${tot(conF, 'faltan')}`);
console.log(`  jobs con pérdida y SIN ninguna entrada de fichero (el suelo no puede verlos): ${conF.filter((f) => !con237.has(f.id)).length} · de ellos verdes ${conF.filter((f) => !con237.has(f.id) && f.conclusion === 'success').length}`);
console.log(`  jobs con entrada de fichero que ADEMÁS perdieron la cola de otro fichero: ${[...con237].filter((id) => D.some((d) => d.artefacto === id && d.forma !== 'entero')).length}`);
console.log(`\nVEREDICTO DEL SUELO en los logs (último intento): ✅ ${sueloOk} · 🔴 ${sueloRojo} · otro ${sueloOtro}`);
for (const f of conF) if (sueloDe.has(f.id) && !sueloDe.get(f.id).startsWith('✅')) console.log(`  ${f.id} → ${sueloDe.get(f.id)}`);
const rotos = A.filter((f) => f.entero !== 'sí');
console.log(`\nTAP NO ENTEROS: ${rotos.length} · con NUL ${rotos.filter((f) => Number(f.nul) > 0).length} (último ${rotos.filter((f) => Number(f.nul) > 0).map((f) => f.creado).sort().at(-1)}) · cancelados sin resumen ${rotos.filter((f) => Number(f.nul) === 0).length}`);
const tras = A.filter((f) => f.creado > '2026-10-01T11:44:39Z');
console.log(`  desde el merge de #1990 a main (artefacto de main de 11:44:39Z): ${tras.length} artefactos · enteros ${tras.filter((f) => f.entero === 'sí').length} · con NUL ${tras.filter((f) => Number(f.nul) > 0).length} · cancelados sin resumen ${tras.filter((f) => f.entero !== 'sí' && Number(f.nul) === 0).length}`);
console.log('EXIT=0');
