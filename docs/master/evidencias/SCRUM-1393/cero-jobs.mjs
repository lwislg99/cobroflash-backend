// cero-jobs.mjs <runs.json> [...] — cuenta, por fichero, las corridas por (conclusion, tiene jobs o no).
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const { runs, evento, desde, hasta } = JSON.parse(fs.readFileSync(f, 'utf8'));
  const m = {};
  for (const r of runs) { const k = `${r.estado}/${r.fin} · jobs ${r.jobs === 0 ? '0' : r.jobs === null ? '?' : '>0'}`; m[k] = (m[k] || 0) + 1; }
  console.log(`POBLACION ${f.split(/[\\/]/).pop()} · evento ${evento} · ${desde}..${hasta} · corridas=${runs.length}`);
  for (const [k, n] of Object.entries(m).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
  const f0 = runs.filter((r) => r.fin === 'failure' && r.jobs === 0);
  console.log(`  failure con 0 jobs: ${f0.length}${f0.map((r) => ` · ${r.creado} run ${r.id} ${r.sha.slice(0, 8)} ${r.rama}`).join('')}`);
  console.log(`  control a cero (conclusion «zzz-no-existe»): ${runs.filter((r) => r.fin === 'zzz-no-existe').length}`);
}
