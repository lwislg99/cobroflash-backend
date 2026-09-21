// Clasifica cada job meta-guard «cancelled» por su anotación: timeout (10m) o cancelación por concurrencia.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const T = process.env.J6_908C_DIR || '.'; // directorio de trabajo del banco (fuera del árbol)
const GH = process.env.GH || 'gh';
const f = JSON.parse(readFileSync(`${T}/censo-meta-ci.json`, 'utf8'));
const c = f.filter((x) => x.mg_concl === 'cancelled');
console.log(`POBLACION cancelled=${c.length} de runs=${f.length}`);
const cuenta = { timeout: 0, concurrencia: 0, otra: 0, ciego: 0 };
const filas = [];
for (const x of c) {
  let msgs;
  try { msgs = JSON.parse(execFileSync(GH, ['api', `repos/lwislg99/cobroflash-backend/check-runs/${x.mg_job}/annotations`], { encoding: 'utf8' })).map((a) => a.message); }
  catch (e) { cuenta.ciego++; filas.push({ job: x.mg_job, clase: 'ciego' }); continue; }
  const clase = msgs.some((m) => /exceeded the maximum execution time/.test(m)) ? 'timeout'
    : msgs.some((m) => /higher priority waiting request/.test(m)) ? 'concurrencia' : 'otra';
  cuenta[clase]++;
  filas.push({ job: x.mg_job, run: x.run, creado: x.creado, rama: x.rama, clase, s: (Date.parse(x.mg_fin) - Date.parse(x.mg_ini)) / 1000, msgs: clase === 'otra' ? msgs : undefined });
}
console.log(JSON.stringify(cuenta));
for (const r of filas.filter((r) => r.clase === 'otra')) console.log('OTRA', r.job, r.s, JSON.stringify(r.msgs).slice(0, 200));
const t = filas.filter((r) => r.clase === 'timeout').map((r) => r.s).sort((a, b) => a - b);
const k = filas.filter((r) => r.clase === 'concurrencia').map((r) => r.s).sort((a, b) => a - b);
console.log('timeout s: min', t[0], 'max', t[t.length - 1], '| concurrencia s: min', k[0], 'max', k[k.length - 1]);
writeFileSync(`${T}/cancel-clasif.json`, JSON.stringify(filas, null, 1));
console.log('EXIT=0');
