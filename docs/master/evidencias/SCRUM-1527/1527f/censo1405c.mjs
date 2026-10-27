// ¿Cuántos obligatorios en rojo caen en SCRUM-1405c ④? Población: jobs «build + tests» de ci.yml
// en failure desde DESDE. Controles: positivo = el job de #2629 (118717000197); cero = un verde.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const DESDE = process.argv[2] || '2026-10-17T00:00:00Z';
const OUT = process.argv[3];
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const runs = [];
for (let p = 1; p <= 10; p++) {
  const j = JSON.parse(gh(['api', `repos/lwislg99/cobroflash-backend/actions/workflows/ci.yml/runs?per_page=100&page=${p}&created=>=${DESDE}`]));
  runs.push(...j.workflow_runs);
  if (j.workflow_runs.length < 100) break;
}
const jobs = [];
for (const r of runs) {
  const j = JSON.parse(gh(['api', `repos/lwislg99/cobroflash-backend/actions/runs/${r.id}/jobs?filter=all&per_page=100`]));
  for (const x of j.jobs) if (x.name === 'build + tests (con banco desechable)') jobs.push({ id: x.id, concl: x.conclusion, rama: r.head_branch, sha: r.head_sha, ev: r.event, creado: r.created_at });
}
const cuenta = {};
for (const x of jobs) cuenta[x.concl] = (cuenta[x.concl] || 0) + 1;
console.log(`runs=${runs.length} jobs=${jobs.length}`, JSON.stringify(cuenta));
const MARCA = /^\S+ ✖ SCRUM-1405c · ④/m;
const verde = jobs.find((x) => x.concl === 'success');
const leer = (id) => { const f = `${OUT}/j${id}.log`; if (!fs.existsSync(f)) fs.writeFileSync(f, gh(['api', '--allow-escape-sequences', `repos/lwislg99/cobroflash-backend/actions/jobs/${id}/logs`])); return fs.readFileSync(f, 'utf8'); };
const filas = [];
for (const x of jobs.filter((x) => x.concl === 'failure')) {
  const t = leer(x.id);
  const fails = [...t.matchAll(/^\S+ ✖ (.+?) \(\d/gm)].map((m) => m[1]);
  const uniq = [...new Set(fails)].filter((n) => n !== 'failing tests:');
  filas.push({ ...x, bytes: t.length, tsv: /TANDA SIN VEREDICTO/.test(t), c1405: MARCA.test(t), caidos: uniq });
}
for (const f of filas) console.log(f.id, f.creado, f.rama.slice(0, 40), f.ev, 'B=' + f.bytes, f.tsv ? 'COLGADA' : '', f.c1405 ? '1405c④' : '', '|', f.caidos.slice(0, 3).map((s) => s.slice(0, 60)).join(' ; '));
const pos = filas.find((f) => f.id === 118717000197);
console.log('POSITIVO (118717000197 en población y marcado):', pos ? pos.c1405 : 'FUERA DE LA POBLACIÓN');
if (verde) console.log('CERO (verde', verde.id, ') marcado:', MARCA.test(leer(verde.id)));
console.log('rojos con 1405c④:', filas.filter((f) => f.c1405).length, 'de', filas.length, '· colgadas:', filas.filter((f) => f.tsv).length);
