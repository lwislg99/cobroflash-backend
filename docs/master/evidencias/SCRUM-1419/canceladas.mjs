#!/usr/bin/env node
// SCRUM-1419 · ¿por qué se cancela una corrida del CI de un PR?
//
//   node docs/master/evidencias/SCRUM-1419/canceladas.mjs <desde ISO> [<hasta ISO>] [--tsv <fichero>]
//
// SÓLO LEE (la API de GitHub, con `gh`). No toca `ci.yml` ni relanza nada.
//
// Población: las corridas de `ci.yml` con `event=pull_request` creadas en la ventana. De cada una
// CANCELADA se pregunta por sus jobs y se clasifica mirando las demás corridas de la MISMA rama.
//
// Lo que la API NO da, y aquí no se estima: QUIÉN canceló una corrida. «Sustituida» se deduce de que
// exista otra corrida de la misma rama creada entre el nacimiento y la muerte de la cancelada (con una
// holgura declarada); es lo que hace `concurrency: cancel-in-progress` de `ci.yml`.
//
// Salida: 0 = medido · 2 = NO PUDE MEDIR (lista cortada, jobs ilegibles…). Nunca una lista corta.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = 'lwislg99/cobroflash-backend';
const WORKFLOW = 'ci.yml';
const OBLIGATORIO = 'build + tests';
/** Segundos de holgura entre que nace la sustituta y GitHub da por muerta a la sustituida. */
export const HOLGURA_S = 120;

const GH = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const gh = (ruta) => JSON.parse(execFileSync(GH, ['api', ruta], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60000 }).replace(/^\uFEFF/, ''));
const noPude = (que) => { console.log(`🔴 NO PUDE MEDIR: ${que}\n   Esto NO es «no hay canceladas».`); process.exit(2); };

/**
 * Pura. `corridas`: las de la ventana, todas las ramas. `jobsDe(id)`: los jobs de una corrida.
 * @returns {{filas:object[], reparto:Record<string,number>}}
 */
export function clasificar(corridas, jobsDe, { holguraS = HOLGURA_S } = {}) {
  const porRama = new Map();
  for (const c of corridas) { if (!porRama.has(c.head_branch)) porRama.set(c.head_branch, []); porRama.get(c.head_branch).push(c); }
  const filas = [];
  for (const c of corridas) {
    if (c.conclusion !== 'cancelled') continue;
    const nace = Date.parse(c.created_at); const muere = Date.parse(c.updated_at);
    const jobs = jobsDe(c.id);
    if (!Array.isArray(jobs)) return { error: `no se pudieron leer los jobs de la corrida ${c.id}` };
    const oblig = jobs.find((j) => String(j.name).startsWith(OBLIGATORIO));
    const arrancaron = jobs.filter((j) => j.started_at && j.steps && j.steps.length > 0).length;
    // La sustituta: otra corrida de la misma rama nacida después de ésta y antes de (su muerte + holgura).
    const sustituta = porRama.get(c.head_branch)
      .filter((o) => o.id !== c.id && Date.parse(o.created_at) > nace && Date.parse(o.created_at) <= muere + holguraS * 1000)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
    // Un job que agota su plazo sale `cancelled` con la corrida entera: se distingue por la duración.
    const durMin = (muere - nace) / 60000;
    let causa;
    if (sustituta) causa = sustituta.head_sha === c.head_sha ? 'sustituida por otra corrida del MISMO commit' : 'sustituida por un empujón posterior a la misma rama';
    else if (jobs.some((j) => j.conclusion === 'cancelled' && j.started_at && j.completed_at && (Date.parse(j.completed_at) - Date.parse(j.started_at)) / 60000 >= 19.5)) causa = 'sin sustituta: algún job agotó su plazo (≥ 20 min corriendo)';
    else causa = 'sin sustituta y sin plazo agotado: a mano, PR cerrado u otra cosa (la API no dice quién)';
    filas.push({
      id: c.id, rama: c.head_branch, sha: c.head_sha.slice(0, 8), creada: c.created_at, minutos: +durMin.toFixed(1), intento: c.run_attempt,
      jobs: jobs.length, arrancaron, obligatorio: oblig ? `${oblig.status}/${oblig.conclusion}` : 'sin job',
      causa, sustituta: sustituta ? sustituta.id : '', sustitutaConclusion: sustituta ? `${sustituta.status}/${sustituta.conclusion}` : '',
      segundosHastaSustituta: sustituta ? Math.round((Date.parse(sustituta.created_at) - nace) / 1000) : '',
    });
  }
  const reparto = {};
  for (const f of filas) reparto[f.causa] = (reparto[f.causa] || 0) + 1;
  return { filas, reparto };
}

/**
 * Pura. De cada (rama, commit) la ÚLTIMA corrida; y de cada rama, su último commit con corrida.
 * Un commit cuya última corrida es `cancelled` no tiene veredicto y nada lo va a traer.
 */
export function sinVeredicto(corridas) {
  const ultimaPorCommit = new Map();
  for (const c of [...corridas].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) ultimaPorCommit.set(`${c.head_branch}\t${c.head_sha}`, c);
  const puntaPorRama = new Map();
  for (const c of [...corridas].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) puntaPorRama.set(c.head_branch, c.head_sha);
  const commits = [...ultimaPorCommit.values()];
  const canceladoFinal = commits.filter((c) => c.conclusion === 'cancelled');
  const puntas = canceladoFinal.filter((c) => puntaPorRama.get(c.head_branch) === c.head_sha);
  return { commits: commits.length, canceladoFinal, puntas, ramas: puntaPorRama.size };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('SCRUM-1419/canceladas.mjs')) {
  const args = process.argv.slice(2);
  const iTsv = args.indexOf('--tsv');
  const tsv = iTsv >= 0 ? args.splice(iTsv, 2)[1] : null;
  const [desde, hasta = new Date().toISOString()] = args;
  if (!desde || !Number.isFinite(Date.parse(desde)) || !Number.isFinite(Date.parse(hasta))) noPude('uso: canceladas.mjs <desde ISO> [<hasta ISO>] [--tsv <fichero>]');

  // La lista, paginada. `created=a..b` filtra en el servidor; el total declarado se compara con lo que llega.
  const filtro = `event=pull_request&created=${encodeURIComponent(`${desde}..${hasta}`)}&per_page=100`;
  let total = null; const corridas = [];
  for (let pagina = 1; pagina <= 30; pagina++) {
    let j; try { j = gh(`repos/${REPO}/actions/workflows/${WORKFLOW}/runs?${filtro}&page=${pagina}`); } catch (e) { noPude(`la página ${pagina} de corridas no llegó: ${String(e.message).split('\n')[0]}`); }
    total = j.total_count;
    corridas.push(...j.workflow_runs);
    if (j.workflow_runs.length < 100) break;
  }
  if (!Number.isFinite(total) || corridas.length !== total) noPude(`la API declara ${total} corridas y llegaron ${corridas.length}: la lista está cortada`);
  if (new Set(corridas.map((c) => c.id)).size !== corridas.length) noPude('hay corridas repetidas entre páginas: la lista se movió mientras se leía');
  if (corridas.length === 0) noPude('la ventana no tiene NINGUNA corrida de PR: o la ventana está mal, o la API devolvió vacío');

  const terminadas = corridas.filter((c) => c.status === 'completed');
  const porConclusion = {};
  for (const c of terminadas) porConclusion[c.conclusion] = (porConclusion[c.conclusion] || 0) + 1;

  const r = clasificar(corridas, (id) => { try { const j = gh(`repos/${REPO}/actions/runs/${id}/jobs?per_page=100&filter=latest`); return j.total_count > j.jobs.length ? undefined : j.jobs; } catch { return undefined; } });
  if (r.error) noPude(r.error);
  const sv = sinVeredicto(corridas);

  const pct = (n, d) => (d ? `${(100 * n / d).toFixed(0)} %` : 'sin base');
  const canceladas = r.filas.length;
  console.log(`CANCELADAS DE PR · ${WORKFLOW} · event=pull_request · ventana ${desde} → ${hasta}`);
  console.log(`POBLACIÓN: ${corridas.length} corridas (${terminadas.length} terminadas, ${corridas.length - terminadas.length} aún en curso) · ${sv.ramas} ramas · ${sv.commits} pares rama+commit`);
  console.log(`CONCLUSIONES de las ${terminadas.length} terminadas: ${Object.entries(porConclusion).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`\nCANCELADAS: ${canceladas} de ${terminadas.length} terminadas (${pct(canceladas, terminadas.length)})`);
  for (const [causa, n] of Object.entries(r.reparto).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)} de ${canceladas} (${pct(n, canceladas)}) · ${causa}`);
  const conJobs = r.filas.filter((f) => f.arrancaron > 0).length;
  console.log(`\n¿LLEGARON A ARRANCAR? ${conJobs} de ${canceladas} tenían algún job con pasos ejecutados · ${canceladas - conJobs} no arrancaron ninguno`);
  const min = r.filas.map((f) => f.minutos).sort((a, b) => a - b);
  if (min.length) console.log(`MINUTOS DE VIDA de una cancelada: mín ${min[0]} · mediana ${min[Math.floor(min.length / 2)]} · máx ${min[min.length - 1]}`);
  const sust = r.filas.filter((f) => f.sustituta);
  const sustConc = {};
  for (const f of sust) sustConc[f.sustitutaConclusion] = (sustConc[f.sustitutaConclusion] || 0) + 1;
  console.log(`LA SUSTITUTA de las ${sust.length} sustituidas acabó: ${Object.entries(sustConc).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);

  console.log(`\nLA CONSECUENCIA · commits cuya ÚLTIMA corrida es «cancelled» (no tienen veredicto y nada lo trae): ${sv.canceladoFinal.length} de ${sv.commits}`);
  console.log(`   de ellos, son la PUNTA de su rama (el último commit con corrida en la ventana): ${sv.puntas.length} de ${sv.ramas} ramas`);
  for (const c of sv.puntas) console.log(`   · ${c.head_branch} · ${c.head_sha.slice(0, 8)} · corrida ${c.id} · ${c.created_at}`);
  console.log('\nLO QUE LA API NO DA: quién canceló cada corrida. «A mano» no se puede afirmar; sólo que no hubo sustituta ni plazo agotado.');

  if (tsv) {
    const cols = ['id', 'rama', 'sha', 'creada', 'minutos', 'intento', 'jobs', 'arrancaron', 'obligatorio', 'causa', 'sustituta', 'sustitutaConclusion', 'segundosHastaSustituta'];
    fs.writeFileSync(tsv, `${cols.join('\t')}\n${r.filas.map((f) => cols.map((k) => f[k]).join('\t')).join('\n')}\n`);
    console.log(`\nfilas escritas en ${tsv}: ${r.filas.length}`);
  }
}
