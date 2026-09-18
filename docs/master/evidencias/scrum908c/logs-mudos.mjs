// Baja el log de cada job meta-guard en failure y extrae el veredicto y los guards mudos.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const GH = process.env.GH || 'gh';
const T = process.env.J6_908C_DIR || '.'; // directorio de trabajo del banco (fuera del árbol)
mkdirSync(`${T}/logs`, { recursive: true });
const filas = JSON.parse(readFileSync(`${T}/censo-meta-ci.json`, 'utf8'));
const objetivo = filas.filter((f) => f.mg_concl === 'failure');
console.log(`POBLACION jobs meta-guard failure=${objetivo.length} de runs=${filas.length}`);
const ESC = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const res = [];
for (const f of objetivo) {
  const ruta = `${T}/logs/${f.mg_job}.txt`;
  let txt;
  try {
    if (!existsSync(ruta)) {
      const raw = execFileSync(GH, ['api', '--allow-escape-sequences', `repos/lwislg99/cobroflash-backend/actions/jobs/${f.mg_job}/logs`], { encoding: 'utf8', maxBuffer: 64 << 20 });
      writeFileSync(ruta, raw);
    }
    txt = readFileSync(ruta, 'utf8').replace(ESC, '');
  } catch (e) { res.push({ ...f, ciego: String(e.message).slice(0, 120) }); continue; }
  const lineas = txt.split(/\r?\n/).map((l) => l.replace(/^\S+Z /, ''));
  const resumen = lineas.find((l) => /^vivas \d+ · mudas \d+/.test(l)) || null;
  const exitL = lineas.find((l) => /Process completed with exit code/.test(l)) || null;
  const mudos = [];
  const i = lineas.findIndex((l) => /GUARDS MUDOS/.test(l));
  if (i >= 0) for (let k = i + 1; k < lineas.length && /^\s+(·|→)/.test(lineas[k]); k++) mudos.push(lineas[k].trim());
  res.push({ run: f.run, job: f.mg_job, creado: f.creado, rama: f.rama, head: f.head, resumen, exit: exitL, mudos });
}
for (const r of res) {
  console.log(`\n== ${r.run} job ${r.job} ${r.creado} ${r.rama} ${String(r.head).slice(0, 10)}`);
  if (r.ciego) { console.log('  CIEGO:', r.ciego); continue; }
  console.log('  ', r.resumen, '|', r.exit);
  for (const m of r.mudos) console.log('   ', m);
}
writeFileSync(`${T}/logs-mudos.json`, JSON.stringify(res, null, 1));
console.log('\nEXIT=0');
