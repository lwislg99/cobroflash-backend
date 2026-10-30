// SCRUM-1498d · ¿Cuántos commits de main absolvería el vigía con un grupo de concurrencia por job (#2841)?
//
// Entrada: el fichero de datos de S5 (`1498c-datos-2026-10-17..10-24.json`, rama de #2841): los 280
// commits de primer padre de main del 17-oct 12:00Z al 24-oct 12:00Z, con la hora REAL de su run y la
// duración y conclusión REALES de cada job que corrió.
// Modelo, por job (seis grupos, como en el ci.yml de #2841): uno corre, uno espera, el que llega
// sustituye al que espera, y éste queda «cancelled» SIN ARRANCAR (`steps: []`). Duración y conclusión de
// un job: las reales si corrió en ese commit; si no, remuestreo de las reales de ese job (semilla fija).
// Runner libre al instante (S5, c.20793: con el cupo lleno puede ser menos). La forma de cada commit se
// pasa por las funciones del PROPIO motor (`veredictoDeCommit`, `absolucionDeSustituidos`).
//
// Dos variantes: (A) conclusiones reales — lo que diría el vigía; (B) todo en success — aísla la cola.
// Uso: node 1498d-simula-por-job.mjs <datos.json> [réplicas]   (cwd = la raíz del repo)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const motor = await import(pathToFileURL(resolve('scripts/vigia-silencio-de-main.mjs')).href);
const { veredictoDeCommit, absolucionDeSustituidos, JOBS_DEL_CI, JOB_OBLIGATORIO, CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE, CAUSA_OBLIGATORIO_SUSTITUIDO } = motor;

const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const REPLICAS = Number(process.argv[3] ?? 200);
const filas = [...d.filas].reverse(); // del más viejo al más nuevo
const linea = d.filas.map((f) => f.sha); // `git log --first-parent`: la punta primero
const ms = (s) => Date.parse(s);
const real = (f, n) => (f.jobsLargos ?? []).find((j) => j.name === n && j.started && j.completed);
const pool = Object.fromEntries(JOBS_DEL_CI.map((n) => [n, filas.map((f) => real(f, n)).filter(Boolean).map((j) => ({ dur: ms(j.completed) - ms(j.started), conclusion: j.conclusion }))]));

// Controles del instrumento, ANTES de simular: población y pool no vacíos (un cero aquí es CIEGO, no limpio).
const sinPool = JOBS_DEL_CI.filter((n) => !pool[n].length);
if (filas.length !== d.nCommits || sinPool.length) { console.log(`CIEGO · filas=${filas.length} de ${d.nCommits} · jobs sin datos: ${sinPool.join(', ') || '—'}`); process.exit(2); }

let semilla = 1498;
const rnd = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

function replica(todoVerde) {
  const forma = new Map(filas.map((f) => [f.sha, []]));
  for (const n of JOBS_DEL_CI) {
    let finCorriendo = -Infinity; let pendiente = null;
    const arranca = (f, t) => {
      const r = real(f, n); const m = r ? { dur: ms(r.completed) - ms(r.started), conclusion: r.conclusion } : pool[n][Math.floor(rnd() * pool[n].length)];
      const conclusion = todoVerde ? 'success' : m.conclusion;
      forma.get(f.sha).push({ name: n, status: 'completed', conclusion, steps: [{ name: 'paso', status: 'completed', conclusion }] });
      finCorriendo = t + m.dur;
    };
    for (const f of filas) {
      if (!f.runs.length) continue; // sin run en la realidad: sigue sin run (2 commits del 21-oct)
      const t = Math.min(...f.runs.map((r) => ms(r.created)));
      while (pendiente && finCorriendo <= t) { const p = pendiente; pendiente = null; arranca(p, finCorriendo); }
      if (finCorriendo <= t) arranca(f, t);
      else {
        if (pendiente) forma.get(pendiente.sha).push({ name: n, status: 'completed', conclusion: 'cancelled', steps: [] });
        pendiente = f;
      }
    }
    if (pendiente) arranca(pendiente, finCorriendo);
  }
  const ahora = '2026-10-25T00:00:00Z';
  const veredictos = filas.map((f) => {
    const jobs = forma.get(f.sha);
    const run = f.runs.length ? { status: 'completed', conclusion: jobs.some((j) => j.conclusion === 'failure') ? 'failure' : jobs.some((j) => j.conclusion === 'cancelled') ? 'cancelled' : 'success', created_at: f.runs[0].created, html_url: null } : null;
    return veredictoDeCommit({ sha: f.sha, run, jobs: run ? jobs : null, ahora, topeMin: 130 });
  });
  const { absueltos, tapados } = absolucionDeSustituidos(veredictos, linea);
  const clase = (v) => {
    const jobs = forma.get(v.sha);
    const o = jobs.find((j) => j.name === JOB_OBLIGATORIO);
    if (absueltos.has(v.sha)) {
      if (v.causa === CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE) return 'absuelto por su obligatorio (c.20795)';
      if (v.causa === CAUSA_OBLIGATORIO_SUSTITUIDO) return 'absuelto por el siguiente obligatorio en verde (c.20802)';
      return 'absuelto por un verde posterior (1393e/f)';
    }
    if (tapados.has(v.sha)) return 'CIEGO · obligatorio sustituido, el siguiente salió ROJO';
    if (v.estado === 'VERDE') return 'VERDE';
    if (v.estado === 'ROJO') return o?.conclusion === 'failure' ? 'ROJO del obligatorio' : 'ROJO de otro job (obligatorio en verde)';
    if (!v.sinRun && o?.steps?.length === 0) return `CIEGO · obligatorio sustituido, sin la forma de (b): ${v.causa ?? 'sin causa'}`;
    if (v.sinRun) return 'CIEGO · sin run';
    if (v.sha === linea[0] && v.causa === CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE) return 'CIEGO · punta sin meta-guard';
    return `CIEGO · otro (${v.causa ?? 'sin causa'}${o?.conclusion === 'failure' ? ', obligatorio en rojo' : ''})`;
  };
  return veredictos.map(clase);
}

const resumen = (todoVerde) => {
  const porClase = {};
  for (let i = 0; i < REPLICAS; i++) {
    const c = {};
    for (const k of replica(todoVerde)) c[k] = (c[k] ?? 0) + 1;
    for (const k of new Set([...Object.keys(porClase), ...Object.keys(c)])) (porClase[k] ??= []).push(c[k] ?? 0);
  }
  for (const k of Object.keys(porClase)) while (porClase[k].length < REPLICAS) porClase[k].unshift(0);
  return Object.entries(porClase).map(([k, xs]) => { xs.sort((a, b) => a - b); return [k, xs[Math.floor(REPLICAS / 2)], xs[Math.floor(REPLICAS * 0.05)], xs[Math.floor(REPLICAS * 0.95)]]; })
    .sort((a, b) => b[1] - a[1]);
};

console.log(`POBLACION commits=${filas.length} (${filas[0].fecha} → ${filas.at(-1).fecha}) · con run=${filas.filter((f) => f.runs.length).length} · réplicas=${REPLICAS} · pool por job: ${JOBS_DEL_CI.map((n) => `${n.split(' ')[0]}=${pool[n].length}`).join(' ')}`);
for (const [titulo, tv] of [['(A) conclusiones reales', false], ['(B) todo en success', true]]) {
  console.log(`\n${titulo} · mediana [IC90] de commits por clase, sobre ${filas.length}:`);
  let suma = 0;
  for (const [k, m, lo, hi] of resumen(tv)) { console.log(`  ${String(m).padStart(4)} [${lo}-${hi}]  ${(100 * m / filas.length).toFixed(1).padStart(5)} %  ${k}`); suma += m; }
  console.log(`  (suma de medianas: ${suma}; no tiene por qué dar ${filas.length})`);
}
