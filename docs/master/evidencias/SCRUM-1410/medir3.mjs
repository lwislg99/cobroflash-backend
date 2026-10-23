// SCRUM-1410 ① — sonda 2: las ejecuciones de claude.yml, y su cruce con los commits del bot por hora.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const runs = fs.readFileSync(path.join(DIR, 'runs.tsv'), 'utf8').trim().split('\n').map(l => {
  const [id, creado, evento, conclusion, estado, actor] = l.split('\t'); return { id, creado, evento, conclusion, estado, actor };
});
const cache = path.join(DIR, 'run-jobs.json');
const J = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : {};
const vivos = runs.filter(r => r.conclusion !== 'skipped');
let i = 0;
for (const r of vivos) {
  if (!J[r.id]) {
    J[r.id] = JSON.parse(gh('api', `repos/lwislg99/cobroflash-backend/actions/runs/${r.id}/jobs`, '-q',
      '[.jobs[] | {ini: .started_at, fin: .completed_at, pasos: [.steps[] | {n: .name, c: .conclusion}]}]'));
    if (++i % 25 === 0) fs.writeFileSync(cache, JSON.stringify(J));
  }
}
fs.writeFileSync(cache, JSON.stringify(J));
const filas = JSON.parse(fs.readFileSync(path.join(DIR, 'filas2.json'), 'utf8'));
const paso = (r, re) => (J[r.id]?.[0]?.pasos || []).find(p => re.test(p.n));
const res = { vivos: vivos.length, sinJobs: 0, accionCorrio: 0, puertaNo: 0, avisador: 0, empujeWorkflow: 0 };
for (const r of vivos) {
  const j = J[r.id]?.[0]; if (!j) { res.sinJobs++; continue; }
  r.ini = Date.parse(j.ini); r.fin = Date.parse(j.fin || j.ini);
  const acc = paso(r, /claude-code-action|^Run anthropics/); if (acc && acc.c === 'success' || acc?.c === 'failure') res.accionCorrio++;
  const cont = paso(r, /^Contestar sin arrancar/); if (cont && cont.c !== 'skipped') res.puertaNo++;
  const ori = paso(r, /Lo despertó el avisador/); if (ori && ori.c !== 'skipped') res.avisador++;
  const disp = paso(r, /Disparó CI el push/); if (disp && disp.c !== 'skipped') { res.empujeWorkflow++; r.empujoWorkflow = true; }
}
// Cruce: cada commit del bot, ¿cae dentro de UNA ejecución?
let dentro = 0, fuera = [], runsConCommit = new Set();
for (const f of filas) {
  const t = Date.parse(f.fecha);
  const r = vivos.find(r => r.ini && t >= r.ini - 5e3 && t <= r.fin + 5e3);
  if (r) { dentro++; runsConCommit.add(r.id); f.run = r.id; } else fuera.push(f.sha.slice(0, 8) + '@' + f.fecha);
}
const empujaron = vivos.filter(r => r.empujoWorkflow);
console.log(`runs claude.yml: ${runs.length} (skipped ${runs.length - vivos.length}) · vivos ${vivos.length}`, JSON.stringify(res));
console.log(`commits bot ${filas.length}: dentro de un run ${dentro} · fuera ${fuera.length} ${fuera.slice(0, 8).join(' ')}`);
console.log(`runs con >=1 commit del bot dentro: ${runsConCommit.size}`);
console.log(`runs con paso «Disparó CI el push» ejecutado: ${empujaron.length} · de esos con commit del bot dentro: ${empujaron.filter(r => runsConCommit.has(r.id)).length}`);
const tras = filas.filter(f => f.pr != null && f.tras1263);
console.log(`commits bot tras-1263 con PR: ${tras.length} · dentro de run que pasó por «Disparó CI»: ${tras.filter(f => empujaron.some(r => r.id === f.run)).length}`);
fs.writeFileSync(path.join(DIR, 'filas3.json'), JSON.stringify(filas, null, 1));
