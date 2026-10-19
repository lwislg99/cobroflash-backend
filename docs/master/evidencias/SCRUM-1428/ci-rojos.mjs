// Censo de los rojos del obligatorio («build + tests») en los últimos N runs de ci.yml.
// SCRUM-1428 (§26.1 de para-javier.md). Uso: node ci-rojos.mjs <N> <dirLogs>, con <dirLogs> FUERA del árbol
// (cada log del obligatorio pesa ~1,8 MB, y un temporal dentro del repo es el rojo intermitente de SCRUM-824).
// Por cada run con el job obligatorio en failure baja su log y saca los ✖ con nombre.
// Declara población: runs mirados, con job obligatorio, verdes, rojos, cancelados, logs bajados / no bajados.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const [, , N = '100', dir = '.'] = process.argv;
fs.mkdirSync(dir, { recursive: true });
const gh = (args, opts = {}) => execFileSync(GH, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
const runs = [];
for (let page = 1; runs.length < +N; page++) {
  const r = JSON.parse(gh(['api', `repos/${REPO}/actions/workflows/ci.yml/runs?per_page=100&page=${page}&status=completed`]));
  if (!r.workflow_runs.length) break;
  runs.push(...r.workflow_runs);
}
const muestra = runs.slice(0, +N);
const pob = { runs: muestra.length, conObligatorio: 0, verde: 0, rojo: 0, cancelado: 0, otro: 0, logOk: 0, logNo: 0 };
const filas = [];
for (const run of muestra) {
  const jobs = JSON.parse(gh(['api', `repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`])).jobs;
  const ob = jobs.find((j) => j.name.startsWith('build + tests'));
  const meta = jobs.find((j) => j.name.startsWith('meta-guard'));
  if (!ob) continue;
  pob.conObligatorio++;
  const fila = { run: run.id, rama: run.head_branch, evento: run.event, cuando: run.created_at, ob: ob.conclusion, meta: meta?.conclusion ?? '-', caidos: [] };
  if (ob.conclusion === 'success') pob.verde++;
  else if (ob.conclusion === 'failure') {
    pob.rojo++;
    const f = path.join(dir, `${ob.id}.log`);
    try {
      if (!fs.existsSync(f)) fs.writeFileSync(f, gh(['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${ob.id}/logs`], { stdio: ['ignore', 'pipe', 'pipe'] }));
      const txt = fs.readFileSync(f, 'utf8');
      pob.logOk++;
      fila.bytes = txt.length;
      const m = txt.match(/ℹ fail (\d+)/g);
      fila.fail = m ? m[m.length - 1] : 'SIN ℹ fail';
      const i = txt.indexOf('✖ failing tests:');
      const tramo = i >= 0 ? txt.slice(i) : '';
      fila.caidos = [...new Set([...tramo.matchAll(/✖ (.+?)(?: \(\d[\d.]*ms\))?\r?$/gm)].map((x) => x[1].replace(/^\S+Z /, '').trim()).filter((s) => s !== 'failing tests:'))];
      if (i < 0) fila.caidos = ['(sin bloque «✖ failing tests:»)'];
    } catch (e) { pob.logNo++; fila.caidos = [`LOG NO BAJADO: ${String(e.message).slice(0, 80)}`]; }
  } else if (ob.conclusion === 'cancelled') pob.cancelado++;
  else pob.otro++;
  filas.push(fila);
}
console.log('POBLACIÓN', JSON.stringify(pob));
console.log('ventana', muestra.at(-1)?.created_at, '→', muestra[0]?.created_at);
for (const f of filas.filter((x) => x.ob === 'failure')) {
  console.log(`\n${f.cuando} run ${f.run} ${f.evento} ${f.rama} · ${f.fail} · meta ${f.meta}`);
  for (const c of f.caidos.slice(0, 12)) console.log('   ✖', c.slice(0, 200));
}
const metaRojo = filas.filter((x) => x.meta === 'failure').length;
const metaVerde = filas.filter((x) => x.meta === 'success').length;
console.log(`\nMETA-GUARD: rojo ${metaRojo} · verde ${metaVerde} · otros ${filas.length - metaRojo - metaVerde}`);
