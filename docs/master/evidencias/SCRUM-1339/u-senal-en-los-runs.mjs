// SCRUM-1339u · ¿Cuántas veces NO PUDO MEDIR la señal de nombres? Sólo lectura.
// Lee las ANOTACIONES del job «build + tests» de los últimos N runs del CI (todos los eventos) y las
// pasa por `lecturaDeLaSenal` y `ciegoDeLaSenal`, las MISMAS funciones del vigía: se mide con la lente
// que se va a usar. Segunda sonda, independiente: el título crudo de la `::notice` de la señal.
//   uso: node u-senal-en-los-runs.mjs <N> > u-salida-senal-en-los-runs.txt
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lecturaDeLaSenal, ciegoDeLaSenal, JOB_DE_LA_SENAL } from '../../../../scripts/vigia-silencio-de-main.mjs';

const ej = promisify(execFile);
const GH = 'C:/Program Files/GitHub CLI/gh.exe';
const REPO = 'repos/lwislg99/cobroflash-backend';
const N = Number(process.argv[2] ?? 100);
const gh = async (ruta) => JSON.parse((await ej(GH, ['api', ruta], { maxBuffer: 64 << 20 })).stdout);

const wf = (await gh(`${REPO}/actions/workflows?per_page=100`)).workflows.find((w) => w.name === 'CI');
const runs = [];
for (let p = 1; runs.length < N; p++) {
  const pag = (await gh(`${REPO}/actions/workflows/${wf.id}/runs?per_page=100&page=${p}`)).workflow_runs;
  if (!pag.length) break;
  runs.push(...pag.filter((r) => r.status === 'completed'));
}
const filas = [];
const cola = runs.slice(0, N);
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let r = cola.shift(); r; r = cola.shift()) {
    const f = { run: r.id, sha: r.head_sha.slice(0, 9), ev: r.event, rama: r.head_branch, creado: r.created_at };
    try {
      const jobs = (await gh(`${REPO}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`)).jobs;
      const j = jobs.find((x) => x.name === JOB_DE_LA_SENAL);
      if (!j) { filas.push({ ...f, clase: `sin-job (${jobs.length} jobs)` }); continue; }
      f.job = j.id; f.concl = j.conclusion;
      if (!['success', 'failure'].includes(j.conclusion)) { filas.push({ ...f, clase: `job-${j.conclusion}` }); continue; }
      let anot;
      try { anot = await gh(`${REPO}/check-runs/${j.id}/annotations?per_page=100`); } catch { anot = null; }
      j.senal = lecturaDeLaSenal(anot);
      const ciego = ciegoDeLaSenal([j]);
      const crudo = (anot ?? []).filter((a) => String(a.title ?? '').startsWith('señal de nombres')).map((a) => `${a.annotation_level}:${a.title}`);
      filas.push({ ...f, clase: ciego ? 'CIEGO-senal' : `midio-${j.senal.ausentes}`, lectura: j.senal, crudo, anotaciones: anot ? anot.length : null });
    } catch (e) { filas.push({ ...f, clase: `CIEGO-lectura: ${String(e.message).split('\n')[0]}` }); }
  }
}));
filas.sort((a, b) => b.creado.localeCompare(a.creado));
for (const f of filas) console.log(JSON.stringify(f));
const cuenta = (pred) => filas.filter(pred).length;
const resumen = (sub, nombre) => {
  const por = {};
  for (const f of sub) { const k = f.clase.replace(/ \(\d+ jobs\)/, ''); por[k] = (por[k] ?? 0) + 1; }
  console.log(`${nombre}: runs=${sub.length} · ${Object.entries(por).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
};
console.log(`POBLACION runs=${filas.length} (pedidos ${N}) · de ${filas.at(-1)?.creado} a ${filas[0]?.creado}`);
resumen(filas, 'todos');
resumen(filas.filter((f) => f.ev === 'push' && f.rama === 'main'), 'push a main');
// Control de la segunda sonda: toda fila «midio» tiene UNA notice cruda de la señal; toda «CIEGO-senal», ninguna o una con NO PUDE MEDIR.
const discrepan = filas.filter((f) => f.crudo && ((f.clase.startsWith('midio') && !(f.crudo.length === 1 && !f.crudo[0].includes('NO PUDE MEDIR')))
  || (f.clase === 'CIEGO-senal' && f.crudo.length === 1 && !f.crudo[0].includes('NO PUDE MEDIR'))));
console.log(`SEGUNDA SONDA: discrepan=${discrepan.length}${discrepan.length ? ' · ' + discrepan.map((f) => f.run).join(',') : ''}`);
console.log(`EXIT=${cuenta((f) => f.clase.startsWith('CIEGO-lectura'))}`);
