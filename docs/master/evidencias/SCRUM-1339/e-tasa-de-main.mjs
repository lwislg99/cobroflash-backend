#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/e-tasa-de-main.mjs — SCRUM-1339e · SÓLO LECTURA.
//
// LA TASA QUE PIDE c.17935, POR EL CAMINO BARATO: sin bajar ni un TAP. Es lo que se corre el
// 15-oct-2026 (o antes, cuando se quiera saber si ya se puede bloquear).
//
//   node docs/master/evidencias/SCRUM-1339/e-tasa-de-main.mjs [<sha o ref de main> [<carpeta de salida>]]
//
// Recorre los commits de la línea principal (primer padre) DE MÁS NUEVO A MÁS VIEJO y, de cada
// uno, lee la anotación `::notice` que dejó el paso «¿Faltan casos declarados en el TAP?» en el
// job obligatorio de SU run de push. Para cuando junta 50 runs MEDIDOS (la ventana de la
// decisión) o cuando llega a un commit cuyo árbol aún no tenía el paso.
//
// Se va POR COMMIT y no por el listado de runs: medido el 2-oct-2026, `actions/runs` con
// `branch=main&event=push` devuelve como «últimos» runs del 17 y 18 de septiembre. Un commit se
// pide por su sha, que es identidad.
//
// Lo que NO es un run medido se CUENTA aparte y no baja la tasa: commit sin run de CI, job
// obligatorio saltado, job que corrió y no dejó línea de registro, línea que dice «medible=no».
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const [refDeMain = 'origin/main', salida = null] = process.argv.slice(2);
const m = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_senal-de-nombres.mjs')).href);

const REPO = 'lwislg99/cobroflash-backend';
const GUION = 'scripts/senal-de-nombres.mjs';
const OBLIGATORIO = 'build + tests';
const TOPE_DE_COMMITS = 400;
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const git = (args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
const gitOk = (args) => { try { execFileSync('git', args, { cwd: RAIZ, stdio: 'ignore' }); return true; } catch { return false; } };
/** `null` si la llamada falla: «no pude preguntar» no es «no hay». */
const gh = (ruta) => { try { return JSON.parse(execFileSync('gh', ['api', ruta], { env, encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 })); } catch { return null; } };

// CONTROL POSITIVO del lector: el check-run 110514502040 (run 36905130761, la punta de #2118)
// lleva la `::notice` del paso (leída por la API el 1-oct, c.17978). Si aquí no se ve, no se mide.
const testigo = gh(`repos/${REPO}/check-runs/110514502040/annotations?per_page=100`);
const veElTestigo = Array.isArray(testigo) && testigo.some((a) => m.registroDesdeLinea(a.message) !== null);
console.log(`CONTROL POSITIVO del lector de anotaciones: check-run 110514502040 → ${Array.isArray(testigo) ? `${testigo.length} anotaciones, con línea de registro: ${veElTestigo ? 'sí' : 'NO'}` : 'NO SE PUDO PEDIR'}`);
if (!veElTestigo) { console.log('EL LECTOR NO VE UNA ANOTACIÓN QUE EXISTE: no se mide nada.'); console.log('EXIT=3'); process.exit(3); }

const punta = git(['rev-parse', refDeMain]);
const commits = git(['log', '--first-parent', '--format=%H %cI', `-${TOPE_DE_COMMITS}`, punta]).split('\n').filter(Boolean)
  .map((l) => { const [sha, fecha] = l.split(' '); return { sha, fecha: new Date(fecha).toISOString() }; });

const filas = [];
let medidos = 0;
let paro = `se recorrieron los ${TOPE_DE_COMMITS} commits del tope sin juntar la ventana`;
for (const c of commits) {
  if (!gitOk(['cat-file', '-e', `${c.sha}:${GUION}`])) { paro = `${c.sha.slice(0, 8)} (${c.fecha}) es el primer commit SIN el paso en su árbol: de ahí hacia atrás no hay anotación que leer`; break; }
  const fila = { sha: c.sha, fecha: c.fecha, estado: '', run: '', intento: '', job: '', conclusion: '', ausentes: '', dudosos: '', avisos: '', titulo: '', linea: '' };
  filas.push(fila);
  const runs = gh(`repos/${REPO}/actions/runs?head_sha=${c.sha}&event=push&per_page=50`);
  if (runs === null) { fila.estado = 'no pude preguntar por sus runs'; continue; }
  const ci = runs.workflow_runs.filter((r) => r.path === '.github/workflows/ci.yml');
  if (!ci.length) { fila.estado = 'sin run de CI'; continue; }
  const run = ci.sort((a, b) => b.id - a.id)[0];
  Object.assign(fila, { run: run.id, intento: run.run_attempt });
  if (run.status !== 'completed') { fila.estado = `run ${run.status}`; continue; }
  const jobs = gh(`repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`);
  if (jobs === null) { fila.estado = 'no pude preguntar por sus jobs'; continue; }
  const job = jobs.jobs.find((j) => j.name.startsWith(OBLIGATORIO));
  if (!job) { fila.estado = 'sin job obligatorio'; continue; }
  Object.assign(fila, { job: job.id, conclusion: job.conclusion });
  if (job.conclusion === 'skipped') { fila.estado = 'job obligatorio saltado'; continue; }
  const an = gh(`repos/${REPO}/check-runs/${job.id}/annotations?per_page=100`);
  if (an === null) { fila.estado = 'no pude pedir las anotaciones'; continue; }
  const con = an.map((a) => ({ a, r: m.registroDesdeLinea(a.message) })).filter((x) => x.r !== null);
  if (con.length !== 1) { fila.estado = con.length ? `${con.length} líneas de registro` : 'el job corrió y NO dejó línea de registro'; continue; }
  const { a, r } = con[0];
  fila.registro = r;
  Object.assign(fila, {
    estado: r.medible ? (r.ausentes > 0 ? 'CON AUSENTES' : r.dudosos > 0 ? 'sólo dudosos' : 'completo') : 'el paso dijo NO PUDE MEDIR',
    ausentes: r.ausentes ?? '', dudosos: r.dudosos ?? '', titulo: a.title ?? '', linea: a.message.split('\n')[0],
    avisos: an.filter((x) => x.annotation_level === 'warning' && String(x.title ?? '').startsWith(m.TITULO)).map((x) => x.message.split('\n')[0]).join(' | '),
  });
  if (r.medible) medidos++;
  if (medidos >= m.VENTANA_DE_RUNS) { paro = `ventana completa: ${m.VENTANA_DE_RUNS} runs medidos`; break; }
}

const n = (f) => filas.filter(f).length;
const estados = {};
for (const f of filas) estados[f.estado] = (estados[f.estado] ?? 0) + 1;
console.log(`POBLACIÓN: commits de la línea principal con el paso en su árbol, desde ${punta.slice(0, 8)} hacia atrás: ${filas.length}`
  + (filas.length ? ` (${filas.at(-1).fecha} → ${filas[0].fecha})` : ''));
console.log(`  por qué paré: ${paro}`);
for (const [k, v] of Object.entries(estados).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)} × ${k}`);
// Sólo entran en la tasa los commits cuyo job obligatorio CORRIÓ; el que corrió y no dejó registro entra como «sin medir».
const corrieron = filas.filter((f) => f.job && f.conclusion !== 'skipped' && !f.estado.startsWith('no pude'));
console.log(`  el job obligatorio corrió en ${corrieron.length} de ${filas.length} commits (${n((f) => f.estado === 'job obligatorio saltado')} saltado, ${n((f) => f.estado === 'sin run de CI')} sin run de CI, ${n((f) => f.estado.startsWith('run '))} con el run sin acabar, ${n((f) => f.estado.startsWith('no pude'))} que no pude preguntar)`);
console.log('LA TASA (runs del obligatorio en main, de más nuevo a más viejo):');
console.log('  ' + m.lineaDeTasa(m.tasaDeRegistros(corrieron.map((f) => f.registro ?? null))));
for (const f of filas.filter((x) => x.estado === 'CON AUSENTES')) console.log(`  ${f.sha.slice(0, 8)} ${f.fecha} run ${f.run} job ${f.conclusion} ausentes=${f.ausentes} → ${f.avisos}`);
// «avisar, no sólo contar»: cada run con ausentes lleva su `::warning`, y ninguno completo lo lleva
console.log(`  con ausentes y SIN ::warning de la señal: ${n((f) => f.estado === 'CON AUSENTES' && !f.avisos)} de ${n((f) => f.estado === 'CON AUSENTES')} · completos y CON ::warning: ${n((f) => f.estado === 'completo' && f.avisos)} de ${n((f) => f.estado === 'completo')} (las dos tienen que ser 0)`);

if (salida) {
  const cab = ['sha', 'fecha', 'estado', 'run', 'intento', 'job', 'conclusion', 'ausentes', 'dudosos', 'titulo', 'linea', 'avisos'];
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, 'e-tasa-de-main.tsv'), cab.join('\t') + '\n' + filas.map((f) => cab.map((k) => f[k] ?? '').join('\t')).join('\n') + '\n');
  fs.writeFileSync(path.join(salida, 'e-registros-de-main.json'), JSON.stringify(corrieron.map((f) => f.linea || null), null, 1) + '\n');
  console.log(`  escrito e-tasa-de-main.tsv y e-registros-de-main.json (${corrieron.length} entradas; «null» = corrió y no dejó registro) → node scripts/senal-de-nombres.mjs --tasa <ese json>`);
}
console.log('EXIT=0');
