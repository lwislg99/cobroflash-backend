// Para TODOS los jobs meta-guard del censo (no sólo los failure), extrae el veredicto de las dos
// mutaciones de scrum859 que llegó a imprimirse antes del final, del timeout o de la cancelación.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const T = process.env.J6_908C_DIR || '.'; // directorio de trabajo del banco (fuera del árbol)
const GH = process.env.GH || 'gh';
mkdirSync(`${T}/logs`, { recursive: true });
const f = JSON.parse(readFileSync(`${T}/censo-meta-ci.json`, 'utf8')).filter((x) => x.mg_job);
const clasif = new Map(JSON.parse(readFileSync(`${T}/cancel-clasif.json`, 'utf8')).map((r) => [r.job, r.clase]));
console.log(`POBLACION jobs meta-guard con job=${f.length}`);
const ESC = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const res = [];
for (const x of f) {
  const ruta = `${T}/logs/${x.mg_job}.txt`;
  let raw;
  try {
    if (existsSync(ruta)) raw = readFileSync(ruta, 'utf8');
    else if (existsSync(`${T}/logs/cancel-${x.mg_job}.txt`)) raw = readFileSync(`${T}/logs/cancel-${x.mg_job}.txt`, 'utf8');
    else { raw = execFileSync(GH, ['api', '--allow-escape-sequences', `repos/lwislg99/cobroflash-backend/actions/jobs/${x.mg_job}/logs`], { encoding: 'utf8', maxBuffer: 64 << 20 }); writeFileSync(ruta, raw); }
  } catch (e) { res.push({ job: x.mg_job, ciego: true }); continue; }
  const ls = raw.replace(ESC, '').split(/\r?\n/).map((l) => l.replace(/^\S+Z /, ''));
  const l859 = ls.filter((l) => /^\s+[✔✖] scrum859-identidad-y-motivo-cerrado\.test\.mjs · /.test(l)).map((l) => l.trim());
  const m2 = l859.length >= 2 ? (l859[1].startsWith('✖') ? 'MUDA' : 'VIVA') : null;
  const m1 = l859.length >= 1 ? (l859[0].startsWith('✖') ? 'MUDA' : 'VIVA') : null;
  const clase = x.mg_concl === 'cancelled' ? clasif.get(x.mg_job) : x.mg_concl;
  res.push({ job: x.mg_job, run: x.run, creado: x.creado, rama: x.rama, head: x.head, clase, n859: l859.length, m1, m2, l859 });
}
const t = {};
for (const r of res) { const k = `${r.clase ?? 'ciego'} m2=${r.m2}`; t[k] = (t[k] || 0) + 1; }
console.log(JSON.stringify(t, null, 1));
const m2 = res.filter((r) => r.m2);
console.log(`mut2 medida en ${m2.length} jobs: VIVA=${m2.filter((r) => r.m2 === 'VIVA').length} MUDA=${m2.filter((r) => r.m2 === 'MUDA').length}`);
console.log(`mut1 medida en ${res.filter((r) => r.m1).length} jobs: MUDA=${res.filter((r) => r.m1 === 'MUDA').length}`);
const firmas = {};
for (const r of m2) { const k = r.l859[1].replace(/^✔ /, 'VIVA ').slice(0, 140); firmas[k] = (firmas[k] || 0) + 1; }
console.log(JSON.stringify(firmas, null, 1));
for (const r of m2.filter((r) => r.m2 === 'MUDA')) console.log('MUDA', r.creado, r.run, r.rama, r.head.slice(0, 10), r.clase);
writeFileSync(`${T}/mut2-todos.json`, JSON.stringify(res, null, 1));
console.log('EXIT=0');
