// Sólo lectura: lo que dijo la señal de nombres (su ::notice / ::warning) en los últimos jobs obligatorios.
import { execFileSync } from 'node:child_process';
const R = 'lwislg99/cobroflash-backend';
const gh = (p) => JSON.parse(execFileSync('gh', ['api', p], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const wf = gh(`repos/${R}/actions/workflows?per_page=100`).workflows.find((w) => w.name === 'CI');
const runs = gh(`repos/${R}/actions/workflows/${wf.id}/runs?per_page=${process.argv[2] || 40}&status=completed`).workflow_runs;
const OB = 'build + tests (con banco desechable)';
let conJob = 0; const filas = [];
for (const r of runs) {
  const jobs = gh(`repos/${R}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`).jobs;
  const j = jobs.find((x) => x.name === OB);
  if (!j || !['success', 'failure'].includes(j.conclusion)) continue;
  conJob++;
  const an = gh(`repos/${R}/check-runs/${j.id}/annotations?per_page=100`);
  const s = an.filter((a) => /señal de nombres/i.test(`${a.title} ${a.message}`));
  const linea = s.map((a) => `${a.annotation_level}:${a.title}:${a.message.split('\n')[0].slice(0, 160)}`).join(' || ');
  const m = linea.match(/ausentes[=: ]+(\d+)/);
  filas.push({ run: r.id, ev: r.event, concl: j.conclusion, ausentes: m ? Number(m[1]) : null, linea: linea || 'SIN ANOTACION DE LA SEÑAL' });
}
for (const f of filas) console.log(JSON.stringify(f));
const conDato = filas.filter((f) => f.ausentes !== null);
console.log(`POBLACION runs=${runs.length} · con obligatorio juzgado=${conJob} · con cifra de la señal=${conDato.length}`);
const a = conDato.map((f) => f.ausentes).sort((x, y) => x - y);
console.log('ausentes ordenados:', a.join(','));
console.log('jobs con ausentes>0:', a.filter((x) => x > 0).length, '· >15:', a.filter((x) => x > 15).length);
