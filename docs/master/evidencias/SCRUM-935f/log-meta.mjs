import { execFileSync } from 'node:child_process';
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const [prefijo, ...runs] = process.argv.slice(2);
for (const r of runs) {
  const jobs = JSON.parse(execFileSync(GH, ['api', `repos/lwislg99/cobroflash-backend/actions/runs/${r}/jobs?per_page=50`], { encoding: 'utf8' })).jobs;
  const j = jobs.find((x) => x.name.startsWith(prefijo));
  console.log(`== run ${r} · ${j?.name} · ${j?.conclusion} · ${j?.head_sha?.slice(0, 9)}`);
  if (!j) continue;
  let log = '';
  try { log = execFileSync(GH, ['api', `repos/lwislg99/cobroflash-backend/actions/jobs/${j.id}/logs`, '--allow-escape-sequences'], { encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { log = String(e.stdout || ''); }
  const lin = log.split('\n').map((l) => l.slice(29)).filter((l) => /MUDO|CIEGO|vivas \d|☠|GUARDS MUDOS|^\s+· |NUEVA|HABLA|TRINQUETE|APAGADA/.test(l));
  console.log(lin.slice(0, 25).join('\n'));
}
