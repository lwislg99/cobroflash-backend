// ¿Qué dijeron el trinquete y el meta-guard en los PR de sólo docs? Población: los últimos N runs
// de ci.yml por pull_request que llegaron a terminar esos jobs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const [raiz, paginas = '4'] = process.argv.slice(2);
const { soloDocs } = await import(pathToFileURL(path.join(raiz, 'scripts/equipo/solo-docs.mjs')).href);
const api = (p) => JSON.parse(execFileSync(GH, ['api', p], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const runs = [];
for (let p = 1; p <= Number(paginas); p++) {
  const r = api(`repos/lwislg99/cobroflash-backend/actions/workflows/ci.yml/runs?event=pull_request&per_page=100&page=${p}`);
  runs.push(...r.workflow_runs);
}
const prDeRama = new Map();
for (let p = 1; p <= 6; p++) {
  for (const x of api(`repos/lwislg99/cobroflash-backend/pulls?state=all&per_page=100&page=${p}`)) {
    if (!prDeRama.has(x.head.ref)) prDeRama.set(x.head.ref, x.number);
  }
}
const ficherosDe = new Map();
const filas = [];
for (const run of runs) {
  const pr = run.pull_requests?.[0]?.number || prDeRama.get(run.head_branch);
  if (!pr) continue;
  const jobs = api(`repos/lwislg99/cobroflash-backend/actions/runs/${run.id}/jobs?per_page=50`).jobs;
  const j = (pref) => jobs.find((x) => x.name.startsWith(pref));
  const tri = j('trinquete'); const meta = j('meta-guard'); const tests = j('build + tests');
  // los ficheros del PR AHORA (no en ese run): sirve para saber si el PR es de sólo docs, que es
  // una propiedad que casi nunca cambia a mitad de PR; se declara así en el resultado.
  if (!ficherosDe.has(pr)) {
    try {
      const fs_ = api(`repos/lwislg99/cobroflash-backend/pulls/${pr}/files?per_page=100`).map((f) => f.filename);
      ficherosDe.set(pr, fs_);
    } catch { ficherosDe.set(pr, null); }
  }
  const f = ficherosDe.get(pr);
  filas.push({ run: run.id, pr, rama: run.head_branch, creado: run.created_at, soloDocs: f ? soloDocs(f) : null, nFich: f?.length,
    tri: tri?.conclusion, triMin: tri?.completed_at ? (new Date(tri.completed_at) - new Date(tri.started_at)) / 60000 : null,
    meta: meta?.conclusion, metaMin: meta?.completed_at ? (new Date(meta.completed_at) - new Date(meta.started_at)) / 60000 : null,
    tests: tests?.conclusion });
}
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'historia.json'), JSON.stringify(filas, null, 1));
const docs = filas.filter((x) => x.soloDocs === true);
const cuenta = (xs, k) => xs.reduce((m, x) => ({ ...m, [x[k]]: (m[x[k]] || 0) + 1 }), {});
console.log(`runs ${filas.length} (de ${runs.length}) · ${filas[filas.length - 1]?.creado} → ${filas[0]?.creado}`);
console.log(`sólo docs: ${docs.length} · PR ${new Set(docs.map((x) => x.pr)).size}`);
console.log('  trinquete:', cuenta(docs, 'tri'), ' meta:', cuenta(docs, 'meta'));
const resto = filas.filter((x) => x.soloDocs === false);
console.log(`con código: ${resto.length}`);
console.log('  trinquete:', cuenta(resto, 'tri'), ' meta:', cuenta(resto, 'meta'));
for (const x of docs.filter((y) => y.tri === 'failure' || y.meta === 'failure')) console.log(`  ROJO en sólo docs: run ${x.run} PR #${x.pr} ${x.rama} tri=${x.tri} meta=${x.meta}`);
