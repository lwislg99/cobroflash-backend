#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/e-exp1384.mjs — SCRUM-1339e · SÓLO LECTURA.
//
// Lee lo que dejó un experimento AJENO: el del equipo de Luis para SCRUM-1384 (rama
// `exp-1384-informe-truncado`, workflow propio, run 36873018664 del 1-oct-2026). Doce tandas
// ENTERAS del mismo árbol en Linux: seis con `--test-force-exit` y seis sin. Sus doce TAP
// (`exp-tap-<brazo>-<tirada>`) caducan a los 3 días, y su resultado no está escrito en el ticket.
//
// Aquí sólo se pasan esos TAP por la señal de nombres contra el árbol de SU commit. No se toca
// su rama, ni su workflow, ni su ticket. Lo que salga se REPORTA: la conclusión es suya.
//
//   node e-exp1384.mjs <carpeta fuera del árbol> <raíz del repo> [<tsv de «quién pierde» (e-por-fichero.tsv)>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [carpeta, raiz, tsvDeLos18 = null] = process.argv.slice(2);
if (!carpeta || !raiz) { console.error('uso: node e-exp1384.mjs <carpeta> <raíz del repo> [<e-por-fichero.tsv>]'); process.exit(2); }
const m = await import(pathToFileURL(path.join(raiz, 'scripts', '_senal-de-nombres.mjs')).href);

const REPO = 'lwislg99/cobroflash-backend';
const RUN = '36873018664';
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const gh = (args, opts = {}) => execFileSync('gh', args, { env, maxBuffer: 1024 * 1024 * 256, ...opts });
const git = (args, input) => execFileSync('git', args, { cwd: raiz, input, maxBuffer: 1024 * 1024 * 1024 });

const run = JSON.parse(gh(['api', `repos/${REPO}/actions/runs/${RUN}`], { encoding: 'utf8' }));
const jobs = JSON.parse(gh(['api', `repos/${REPO}/actions/runs/${RUN}/jobs?per_page=100`], { encoding: 'utf8' })).jobs;
const arts = JSON.parse(gh(['api', `repos/${REPO}/actions/runs/${RUN}/artifacts?per_page=100`], { encoding: 'utf8' })).artifacts;
console.log(`RUN ${RUN} · ${run.name} · rama ${run.head_branch} · sha ${run.head_sha} · ${run.event} · ${run.conclusion} · ${run.created_at}`);
console.log(`POBLACIÓN: ${jobs.length} jobs · ${arts.length} artefactos · caducados ${arts.filter((a) => a.expired).length}`);
if (git(['cat-file', '-t', run.head_sha]).toString().trim() !== 'commit') { console.log('no tengo ese commit en local: git fetch origin exp-1384-informe-truncado'); console.log('EXIT=3'); process.exit(3); }

// las fuentes del árbol que probó (el mismo para los doce)
const rutas = git(['ls-tree', '-r', '--name-only', run.head_sha, 'tests/']).toString('utf8').split('\n').filter((r) => /^tests\/[^/]+\.test\.mjs$/.test(r));
const bruto = git(['cat-file', '--batch'], rutas.map((r) => `${run.head_sha}:${r}`).join('\n') + '\n');
const fuentes = []; let p = 0;
for (const r of rutas) {
  const fin = bruto.indexOf(10, p);
  const cab = bruto.subarray(p, fin).toString('utf8').split(' ');
  const n = Number(cab[2]);
  if (cab[1] !== 'blob' || !Number.isFinite(n)) throw new Error(`cat-file: cabecera inesperada para ${r}`);
  fuentes.push({ fichero: path.basename(r), codigo: bruto.subarray(fin + 1, fin + 1 + n).toString('utf8') });
  p = fin + 1 + n + 1;
}
console.log(`  árbol probado: ${fuentes.length} ficheros de tests/ en ${run.head_sha.slice(0, 8)}`);

fs.mkdirSync(path.join(carpeta, 'exp1384'), { recursive: true });
const filas = [];
for (const a of arts.sort((x, y) => x.name.localeCompare(y.name))) {
  const mm = /^exp-tap-(con|sin)-(\d+)$/.exec(a.name);
  if (!mm) { console.log(`  artefacto que no esperaba: ${a.name}`); continue; }
  const [, brazo, tirada] = mm;
  const job = jobs.find((j) => j.name === `${brazo} force-exit · tirada ${tirada}`);
  const fila = { brazo, tirada, artefacto: a.id, bytes: a.size_in_bytes, job: job?.id ?? '', conclusion: job?.conclusion ?? '?', segundos: job ? Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000) : '' };
  // lo que dijo el paso «La tanda» (lleva `continue-on-error`: el job sale success aunque la tanda caiga)
  const paso = job?.steps?.find((s) => s.name === 'La tanda');
  fila.paso_tanda = paso ? paso.conclusion : '?';
  const tap = path.join(carpeta, 'exp1384', `${a.name}.tap`);
  if (!fs.existsSync(tap)) {
    const zip = tap + '.zip';
    fs.writeFileSync(zip, gh(['api', `repos/${REPO}/actions/artifacts/${a.id}/zip`]));
    fs.writeFileSync(tap, execFileSync('unzip', ['-p', zip], { maxBuffer: 1024 * 1024 * 256 }));
    fs.unlinkSync(zip);
  }
  const r = m.senalDeNombres({ fuentes, tap: fs.readFileSync(tap, 'utf8') });
  Object.assign(fila, {
    medible: r.medible ? 'sí' : 'NO', motivo: r.motivo ?? '', declarados: r.poblacion.llamadas, tap_tests: r.tap.tests ?? '', tap_fail: r.tap.fail ?? '',
    ausentes: r.ausentes ?? '', dudosos: r.dudosos ?? '', ficheros: r.bloques.map((b) => b.fichero), donde: r.bloques.map((b) => m.describirBloque(b)).join(' | '),
  });
  filas.push(fila);
}
const cab = ['brazo', 'tirada', 'artefacto', 'bytes', 'job', 'conclusion', 'paso_tanda', 'segundos', 'medible', 'declarados', 'tap_tests', 'tap_fail', 'ausentes', 'dudosos', 'motivo', 'donde'];
fs.writeFileSync(path.join(carpeta, 'e-exp1384.tsv'), cab.join('\t') + '\n' + filas.map((f) => cab.map((k) => f[k] ?? '').join('\t')).join('\n') + '\n');

for (const f of filas) console.log(`  ${f.brazo} ${f.tirada} · job ${f.conclusion} (${f.segundos} s) · medible ${f.medible}${f.motivo ? ` (${f.motivo})` : ''} · tap_tests ${f.tap_tests} · fail ${f.tap_fail} · ausentes ${f.ausentes} · dudosos ${f.dudosos}${f.donde ? ' → ' + f.donde : ''}`);
const los18 = tsvDeLos18 ? new Set(fs.readFileSync(tsvDeLos18, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')[0])) : null;
for (const brazo of ['con', 'sin']) {
  const g = filas.filter((f) => f.brazo === brazo);
  const med = g.filter((f) => f.medible === 'sí');
  const malos = med.filter((f) => f.ausentes > 0);
  const tests = med.map((f) => f.tap_tests).sort((a, b) => a - b);
  console.log(`BRAZO «${brazo} --test-force-exit»: ${g.length} tandas · medibles ${med.length} · CON AUSENTES ${malos.length} de ${med.length}`
    + ` · casos ausentes en total ${malos.reduce((a, f) => a + f.ausentes, 0)} · tap_tests de ${tests[0] ?? '?'} a ${tests.at(-1) ?? '?'} · con algún fallo ${med.filter((f) => f.tap_fail > 0).length}`);
  const fich = [...new Set(malos.flatMap((f) => f.ficheros))].sort();
  if (fich.length) console.log(`   ficheros que pierden: ${fich.join(', ')}`);
  if (los18 && fich.length) console.log(`   de ellos, entre los ${los18.size} que pierden en el CI de cada día (${path.basename(tsvDeLos18)}): ${fich.filter((x) => los18.has(x)).length} de ${fich.length}`);
}
console.log('EXIT=0');
