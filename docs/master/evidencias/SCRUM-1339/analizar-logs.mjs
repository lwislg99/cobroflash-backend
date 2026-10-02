#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/analizar-logs.mjs
//
// De cada log de «build + tests» (bajar-logs.mjs) saca:
//   · QUÉ commit se probó de verdad (la salida de `git log -1 --format=%H` del checkout: en un PR
//     es el commit de la FUSIÓN con main, no la cabeza de la rama) y, de él, su ÁRBOL;
//   · el resumen de la tanda (`ℹ tests/pass/fail/skipped/cancelled`) del paso `npm test`;
//   · cada línea de resultado de ese paso (`✔` / `✖` / `﹣`), con su nombre: la lista de casos;
//   · la línea del «suelo de la tanda» (suelo, total, margen, declarados por el árbol).
//
//   node analizar-logs.mjs <carpeta> [--sin-arboles]
//     → <carpeta>/medidos.tsv   una fila por job
//     → <carpeta>/casos/<job>.txt   un caso por línea: «estado<TAB>nivel<TAB>nombre»
//     → <carpeta>/arboles.tsv   caché commit → árbol (API de GitHub; solo lectura)
//
// 🔴 CONTROL DEL INSTRUMENTO, impreso al final: en cuántos jobs el número de líneas de resultado
// que he sabido leer es IGUAL al `ℹ tests` que imprime el corredor. Si no cuadran, mi lista de
// casos no vale para comparar conjuntos, y se dice.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const REPO = 'lwislg99/cobroflash-backend';
const carpeta = process.argv[2];
const sinArboles = process.argv.includes('--sin-arboles');
if (!carpeta) { console.error('uso: node analizar-logs.mjs <carpeta> [--sin-arboles]'); process.exit(2); }
const dirCasos = path.join(carpeta, 'casos');
fs.mkdirSync(dirCasos, { recursive: true });

const CSI = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;
const SELLO = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;

const jobs = fs.readFileSync(path.join(carpeta, 'jobs.tsv'), 'utf8').split('\n').filter(Boolean);
const cab = jobs.shift().split('\t');
const filasJobs = jobs.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));

// ── caché commit → árbol ────────────────────────────────────────────────────────────────────
const rutaArboles = path.join(carpeta, 'arboles.tsv');
const arboles = new Map();
if (fs.existsSync(rutaArboles)) for (const l of fs.readFileSync(rutaArboles, 'utf8').split('\n')) { const [c, a] = l.split('\t'); if (c && a) arboles.set(c, a); }
function arbolDe(commit) {
  if (!commit) return '';
  if (arboles.has(commit)) return arboles.get(commit);
  if (sinArboles) return '';
  let arbol = '';
  try { arbol = execFileSync('git', ['rev-parse', '--verify', '--quiet', `${commit}^{tree}`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* no está en local */ }
  if (!arbol) {
    try { arbol = execFileSync('gh', ['api', `repos/${REPO}/git/commits/${commit}`, '--jq', '.tree.sha'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { arbol = 'DESCONOCIDO'; }
  }
  arboles.set(commit, arbol);
  fs.appendFileSync(rutaArboles, `${commit}\t${arbol}\n`);
  return arbol;
}

const filas = []; let sinLog = 0;
for (const j of filasJobs) {
  const ruta = path.join(carpeta, 'logs', `${j.job}.log.gz`);
  if (!fs.existsSync(ruta)) { sinLog++; continue; }
  const lineas = zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8').split('\n').map((l) => l.replace(/\r$/, '').replace(SELLO, '').replace(CSI, ''));
  const f = { job: j.job, run: j.run, intento: j.intento, conclusion: j.conclusion, empezo: j.empezo, cabeza: j.sha };

  // el commit probado: la línea SIGUIENTE a `git log -1 --format=%H`
  let k = lineas.findIndex((l) => /git log -1 --format=%H/.test(l));
  f.probado = k >= 0 && /^'?[0-9a-f]{40}'?$/.test(lineas[k + 1].trim()) ? lineas[k + 1].trim().replace(/'/g, '') : '';
  f.evento = lineas.some((l) => /refs\/remotes\/pull\/\d+\/merge/.test(l)) ? 'pr' : 'push';
  const nodo = lineas.find((l) => /^Found in cache @ .*node\/(\d+\.\d+\.\d+)/.test(l));
  f.node = nodo ? nodo.match(/node\/(\d+\.\d+\.\d+)/)[1] : '';

  // el paso `npm test`: desde su cabecera hasta el primer `ℹ tests`
  const ini = lineas.findIndex((l) => /^##\[group\]Run npm test\s*$/.test(l));
  let fin = -1;
  if (ini >= 0) for (let i = ini; i < lineas.length; i++) if (/^ℹ tests \d+/.test(lineas[i])) { fin = i; break; }
  const casos = [];
  const hasta = fin >= 0 ? fin : lineas.length;
  if (ini >= 0) {
    for (let i = ini; i < hasta; i++) {
      // sin resumen (tanda cortada) no se sabe dónde acaba el paso: se para en el siguiente
      if (fin < 0 && i > ini && /^##\[group\]Run /.test(lineas[i])) break;
      const m = lineas[i].match(/^(\s*)(✔|✖|﹣) (.*) \(\d+(?:\.\d+)?ms\)(?: # .*)?$/);
      if (m) casos.push(`${m[2] === '✔' ? 'pass' : m[2] === '✖' ? 'fail' : 'skip'}\t${m[1].length / 2}\t${m[3]}`);
    }
  }
  const resumen = {};
  if (fin >= 0) for (let i = fin; i < Math.min(fin + 8, lineas.length); i++) { const m = lineas[i].match(/^ℹ (tests|pass|fail|cancelled|skipped) (\d+)/); if (m) resumen[m[1]] = Number(m[2]); }
  Object.assign(f, { tests: resumen.tests ?? '', pass: resumen.pass ?? '', fail: resumen.fail ?? '', skipped: resumen.skipped ?? '', cancelled: resumen.cancelled ?? '', lineas: casos.length });

  const s = lineas.findIndex((l) => /^\[suelo de la tanda\]/.test(l));
  const ms = s >= 0 ? lineas[s].match(/suelo (\d+) · total actual (\d+) · margen (-?\d+) · (\w+)/) : null;
  const md = s >= 0 ? (lineas[s + 1] || '').match(/declara (\d+) tests/) : null;
  Object.assign(f, { suelo: ms ? ms[1] : '', total_suelo: ms ? ms[2] : '', margen: ms ? ms[3] : '', declarados: md ? md[1] : '', suelo_dijo: s >= 0 ? lineas[s].slice(0, 60) : '' });

  f.arbol = arbolDe(f.probado);
  fs.writeFileSync(path.join(dirCasos, `${j.job}.txt`), casos.join('\n') + '\n');
  filas.push(f);
}

const columnas = ['job', 'run', 'intento', 'conclusion', 'empezo', 'evento', 'cabeza', 'probado', 'arbol', 'node', 'tests', 'pass', 'fail', 'skipped', 'cancelled', 'lineas', 'suelo', 'total_suelo', 'margen', 'declarados', 'suelo_dijo'];
fs.writeFileSync(path.join(carpeta, 'medidos.tsv'), [columnas.join('\t'), ...filas.map((r) => columnas.map((c) => r[c]).join('\t'))].join('\n') + '\n');

const conResumen = filas.filter((r) => r.tests !== '');
const cuadran = conResumen.filter((r) => r.lineas === r.tests);
console.log(`POBLACION: ${filasJobs.length} jobs en jobs.tsv · sin log: ${sinLog} · leídos: ${filas.length}`);
console.log(`  con resumen «ℹ tests»: ${conResumen.length} · sin resumen (tanda cortada o cancelada): ${filas.length - conResumen.length}`);
console.log(`  CONTROL DEL INSTRUMENTO: líneas de resultado leídas == «ℹ tests» en ${cuadran.length} de ${conResumen.length}`);
for (const r of conResumen.filter((x) => x.lineas !== x.tests).slice(0, 15)) console.log(`     ✗ job ${r.job}: leí ${r.lineas}, el corredor dice ${r.tests} (fail ${r.fail})`);
console.log(`  commit probado leído: ${filas.filter((r) => r.probado).length} · con árbol: ${filas.filter((r) => r.arbol && r.arbol !== 'DESCONOCIDO').length}`);
console.log(`  «total actual» del suelo == «ℹ tests»: ${conResumen.filter((r) => String(r.total_suelo) === String(r.tests)).length} de ${conResumen.length}`);
console.log('EXIT=0');
