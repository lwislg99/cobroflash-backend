#!/usr/bin/env node
// SCRUM-1419 · del empujón al veredicto: ¿cuánto es COLA sin ejecutor y cuánto es EJECUCIÓN?
//
//   node docs/master/evidencias/SCRUM-1419/cola.mjs <desde ISO> <hasta ISO> [--tsv <fichero>]
//
// SÓLO LEE. Una llamada por corrida (sus jobs): `gh run list` no trae cuándo cogió ejecutor cada job.
//
// De cada corrida de `ci.yml` por `pull_request`, su job OBLIGATORIO (último intento):
//   · COLA      = desde que arranca el intento (`run_started_at`) hasta el PRIMER PASO del job.
//                 El primer paso («Set up job») lo ejecuta el ejecutor: antes de él no había ninguno.
//   · EJECUCIÓN = desde ese primer paso hasta `completed_at` del job.
// Se da también la cola leída de `started_at` del job, para ver si las dos lecturas coinciden.
//
// Sólo entran los jobs que llegaron a un veredicto (success o failure). Los demás se CUENTAN aparte.
// Salida: 0 = medido · 2 = NO PUDE MEDIR.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = 'lwislg99/cobroflash-backend';
const WORKFLOW = 'ci.yml';
const OBLIGATORIO = 'build + tests';
const GH = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const gh = (ruta) => JSON.parse(execFileSync(GH, ['api', ruta], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60000 }).replace(/^\uFEFF/, ''));
const noPude = (que) => { console.log(`🔴 NO PUDE MEDIR: ${que}\n   Esto NO es «no hay cola».`); process.exit(2); };

/** Pura. @returns {{cola:number, colaPorJob:number, ejecucion:number}|null} en segundos; `null` si el job no llegó a veredicto. */
export function tiemposDelJob(corrida, job) {
  if (!job || job.status !== 'completed' || !/^(success|failure)$/.test(job.conclusion)) return null;
  const pasos = (job.steps || []).filter((p) => p.started_at).sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const inicio = Date.parse(corrida.run_started_at || corrida.created_at);
  const primerPaso = pasos.length ? Date.parse(pasos[0].started_at) : NaN;
  const fin = Date.parse(job.completed_at);
  if (![inicio, primerPaso, fin].every(Number.isFinite)) return null;
  return { cola: (primerPaso - inicio) / 1000, colaPorJob: (Date.parse(job.started_at) - inicio) / 1000, ejecucion: (fin - primerPaso) / 1000 };
}

/** Pura. Percentil por posición sobre una lista ya numérica. */
export function percentil(lista, p) {
  const o = [...lista].sort((a, b) => a - b);
  return o.length ? o[Math.min(o.length - 1, Math.floor(p * o.length))] : NaN;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('SCRUM-1419/cola.mjs')) {
  const args = process.argv.slice(2);
  const iTsv = args.indexOf('--tsv');
  const tsv = iTsv >= 0 ? args.splice(iTsv, 2)[1] : null;
  const [desde, hasta] = args;
  if (!Number.isFinite(Date.parse(desde)) || !Number.isFinite(Date.parse(hasta))) noPude('uso: cola.mjs <desde ISO> <hasta ISO> [--tsv <fichero>]');

  const filtro = `event=pull_request&created=${encodeURIComponent(`${desde}..${hasta}`)}&per_page=100`;
  let total = null; const corridas = [];
  for (let pagina = 1; pagina <= 30; pagina++) {
    let j; try { j = gh(`repos/${REPO}/actions/workflows/${WORKFLOW}/runs?${filtro}&page=${pagina}`); } catch (e) { noPude(`la página ${pagina} de corridas no llegó: ${String(e.message).split('\n')[0]}`); }
    total = j.total_count; corridas.push(...j.workflow_runs);
    if (j.workflow_runs.length < 100) break;
  }
  if (!Number.isFinite(total) || corridas.length !== total) noPude(`la API declara ${total} corridas y llegaron ${corridas.length}: la lista está cortada`);
  if (corridas.length === 0) noPude('la ventana no tiene NINGUNA corrida de PR');

  const filas = []; let sinVeredicto = 0; let sinJob = 0; let reintentadas = 0;
  for (const c of corridas) {
    let j;
    for (let intento = 0; intento < 2 && !j; intento++) { try { j = gh(`repos/${REPO}/actions/runs/${c.id}/jobs?per_page=100&filter=latest`); } catch { j = undefined; } }
    if (!j || j.total_count > j.jobs.length) noPude(`no se pudieron leer enteros los jobs de la corrida ${c.id}`);
    const job = j.jobs.find((x) => String(x.name).startsWith(OBLIGATORIO));
    if (!job) { sinJob++; continue; }
    const t = tiemposDelJob(c, job);
    if (!t) { sinVeredicto++; continue; }
    if (c.run_attempt > 1) reintentadas++;
    filas.push({ id: c.id, rama: c.head_branch, creada: c.created_at, intento: c.run_attempt, conclusion: job.conclusion, cola: Math.round(t.cola), colaPorJob: Math.round(t.colaPorJob), ejecucion: Math.round(t.ejecucion), hora: c.created_at.slice(0, 13) });
  }
  if (filas.length === 0) noPude(`de ${corridas.length} corridas, ninguna tiene el obligatorio con veredicto`);

  const m = (s) => `${(s / 60).toFixed(1)} min`;
  const serie = (nombre, xs) => console.log(`   ${nombre.padEnd(34)} mediana ${m(percentil(xs, 0.5))} · p90 ${m(percentil(xs, 0.9))} · máx ${m(Math.max(...xs))} · suma ${(xs.reduce((a, b) => a + b, 0) / 3600).toFixed(1)} h`);
  const colas = filas.map((f) => f.cola); const ejec = filas.map((f) => f.ejecucion);
  const sumaCola = colas.reduce((a, b) => a + b, 0); const sumaEjec = ejec.reduce((a, b) => a + b, 0);
  console.log(`COLA FRENTE A EJECUCIÓN · job «${OBLIGATORIO}…» de ${WORKFLOW} · event=pull_request · ventana ${desde} → ${hasta}`);
  console.log(`POBLACIÓN: ${corridas.length} corridas · ${filas.length} con el obligatorio en success/failure (MEDIDAS) · ${sinVeredicto} con el obligatorio sin veredicto (cancelado, saltado o en curso) · ${sinJob} sin ese job · ${reintentadas} de las medidas son reintentos (se mide el último intento)`);
  console.log('\nPOR CORRIDA:');
  serie('COLA (hasta el primer paso)', colas);
  serie('EJECUCIÓN (primer paso → fin)', ejec);
  serie('TOTAL (arranque del intento → fin)', filas.map((f) => f.cola + f.ejecucion));
  console.log(`\nLA FRACCIÓN QUE DECIDE: de todo el tiempo del obligatorio, COLA ${(100 * sumaCola / (sumaCola + sumaEjec)).toFixed(1)} % · EJECUCIÓN ${(100 * sumaEjec / (sumaCola + sumaEjec)).toFixed(1)} %`);
  const umbrales = [60, 300, 600];
  console.log(`CORRIDAS CON COLA: ${umbrales.map((u) => `> ${u / 60} min: ${colas.filter((x) => x > u).length} de ${filas.length}`).join(' · ')}`);
  const dif = filas.filter((f) => Math.abs(f.cola - f.colaPorJob) > 30).length;
  console.log(`CONTROL DE LA LECTURA: en ${dif} de ${filas.length} la cola leída del primer paso y la leída de \`started_at\` del job difieren en más de 30 s`);
  console.log('\nPOR HORA (UTC) · corridas medidas · mediana de cola · máxima de cola:');
  const horas = [...new Set(filas.map((f) => f.hora))].sort();
  for (const h of horas) { const xs = filas.filter((f) => f.hora === h).map((f) => f.cola); console.log(`   ${h}h · ${String(xs.length).padStart(3)} · ${m(percentil(xs, 0.5)).padStart(9)} · ${m(Math.max(...xs)).padStart(9)}`); }
  console.log('\nLO QUE ESTO NO MIDE: la cola de los OTROS jobs y workflows (el abridor de PR, los informativos); ni el tiempo del empujón a que la corrida existe.');
  if (tsv) {
    const cols = ['id', 'rama', 'creada', 'intento', 'conclusion', 'cola', 'colaPorJob', 'ejecucion'];
    fs.writeFileSync(tsv, `${cols.join('\t')}\n${filas.map((f) => cols.map((k) => f[k]).join('\t')).join('\n')}\n`);
    console.log(`\nfilas escritas en ${tsv}: ${filas.length}`);
  }
}
