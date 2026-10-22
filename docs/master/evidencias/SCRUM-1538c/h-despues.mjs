#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538c/h-despues.mjs — SCRUM-1538c · SÓLO LECTURA (gh api, GET).
//
// ¿Qué pasó DESPUÉS de cada corte? Sobre `e-runs.json` + `e-jobs.tsv` (de `e-listar.mjs`):
//   ① cuántos `build + tests` y cuántos trinquetes ACABARON después de un instante dado, y cuántos de
//     ellos se colgaron (los de un run verde limpio cuentan como `success`: su run lo dice);
//   ② de los `build + tests` verdes posteriores al arreglo de A8.4 (SCRUM-1543, 14-oct 07:19:47Z), baja
//     los 15 últimos y mira si A8.4 CORRIÓ: un verde con A8.4 saltado no dice nada de A8.4.
//     La marca se cuenta ANCLADA al inicio de la línea del caso, con su «(N ms)» detrás.
//
//   node h-despues.mjs <carpeta de e-listar>
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [carpeta] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node h-despues.mjs <carpeta>'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const ARREGLO_A84 = '2026-10-14T07:19:47Z';     // b010b6a71, merge de #2426 (SCRUM-1543b)
const ULTIMA_COLGADA = '2026-10-14T09:00:00Z';  // la última colgada de las dos familias es de las 08:57:18Z
const runs = JSON.parse(fs.readFileSync(path.join(carpeta, 'e-runs.json'), 'utf8'));
const L = fs.readFileSync(path.join(carpeta, 'e-jobs.tsv'), 'utf8').trim().split('\n');
const cab = L[0].split('\t');
const jobs = L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const limpios = runs.filter((r) => r.status === 'completed' && r.conclusion === 'success' && r.intento === 1);
const salida = [];
const p = (s) => { salida.push(s); console.log(s); };

p(`POBLACIÓN · runs de CI ${runs.length} · verdes limpios (todos sus jobs en success, sin pedir) ${limpios.length} · ejecuciones de job pedidas ${jobs.length}`);
const despues = (pre, desde, techo) => {
  const pedidos = jobs.filter((j) => j.nombre.startsWith(pre) && j.creado >= desde && j.status === 'completed' && ['success', 'failure', 'cancelled'].includes(j.conclusion));
  const limp = limpios.filter((r) => r.creado >= desde).length;
  const colg = pedidos.filter((j) => j.conclusion === 'cancelled' && Number(j.segundos) >= techo).length;
  const corto = pedidos.filter((j) => j.conclusion === 'cancelled' && Number(j.segundos) < techo).length;
  return { acabados: pedidos.length - corto + limp, colg, corto, limp };
};
const t = despues('trinquete', ULTIMA_COLGADA, 2400);
p(`① trinquete creado desde ${ULTIMA_COLGADA}: ${t.acabados} acabados (${t.limp} de runs limpios) · cortados a ≥ 40 min ${t.colg} · cortados antes (empujón nuevo) ${t.corto}, no cuentan`);
const bf = jobs.filter((j) => j.nombre.startsWith('build + tests') && j.creado >= ULTIMA_COLGADA && j.status === 'completed' && ['success', 'failure'].includes(j.conclusion));
p(`① build + tests creado desde ${ULTIMA_COLGADA}: ${bf.length + limpios.filter((r) => r.creado >= ULTIMA_COLGADA).length} con veredicto (success o failure; ${limpios.filter((r) => r.creado >= ULTIMA_COLGADA).length} de runs limpios) · de ellos en failure ${bf.filter((j) => j.conclusion === 'failure').length} — las colgadas de la tanda salen en failure: el desglose está en g-salida.txt`);

const verdes = jobs.filter((j) => j.nombre.startsWith('build + tests') && j.conclusion === 'success' && j.creado >= ARREGLO_A84).sort((a, b) => Number(a.job) - Number(b.job)).slice(-15);
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const dir = path.join(carpeta, 'logs');
fs.mkdirSync(dir, { recursive: true });
const bajar = (id) => new Promise((ok) => {
  const destino = path.join(dir, `${id}.log`);
  if (fs.existsSync(destino) && fs.statSync(destino).size >= 1000) return ok(fs.readFileSync(destino, 'utf8'));
  execFile('gh', ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${id}/logs`], { env, encoding: 'buffer', maxBuffer: 1024 * 1024 * 64 }, (e, out) => {
    if (e) return ok('');
    fs.writeFileSync(destino, out); ok(out.toString('utf8'));
  });
});
const ESC = /\x1b\[[0-9;]*[A-Za-z]/g;
const NOMBRE = 'A8.4: suite completa del bot (webhook + dry-run)';
const marca = (texto, m) => texto.split(/\r?\n/).some((l) => { const s = l.slice(29).replace(ESC, '').trimStart(); return s.startsWith(`${m} ${NOMBRE} (`) && /\([\d.]+ms\)( # .*)?$/.test(s); });
// SIEMBRA: el lector, sobre texto fabricado, antes de leer un log real.
const H = '2026-01-01T00:00:00.0000000Z ';
const sem = [[`${H}✔ ${NOMBRE} (12ms)`, '✔', true], [`${H}﹣ ${NOMBRE} (0ms) # sin banco`, '﹣', true], [`${H}✔ otro que nombra ${NOMBRE} (1ms)`, '✔', false]];
const semOk = sem.filter(([t, m, esp]) => marca(t, m) === esp).length;
p(`② siembra del lector de A8.4: ${semOk} de ${sem.length}`);
if (semOk !== sem.length) { p('CIEGO · el lector no ve lo sembrado'); p('EXIT=3'); fs.writeFileSync(path.join(carpeta, 'h-salida.txt'), salida.join('\n') + '\n'); process.exit(3); }
let corrio = 0, salto = 0, ninguno = 0, sinLog = 0;
for (const j of verdes) {
  const txt = await bajar(j.job);
  if (txt.length < 1000) { sinLog++; continue; }
  if (marca(txt, '✔')) corrio++; else if (marca(txt, '﹣')) salto++; else ninguno++;
}
p(`② build + tests en success desde ${ARREGLO_A84} (los ${verdes.length} últimos de la población pedida): A8.4 pasó ${corrio} · saltó ${salto} · no aparece ${ninguno} · sin log ${sinLog}`);
fs.writeFileSync(path.join(carpeta, 'h-salida.txt'), salida.join('\n') + '\n');
p(`EXIT=${corrio > 0 ? 0 : 3}`);
process.exit(corrio > 0 ? 0 : 3);
