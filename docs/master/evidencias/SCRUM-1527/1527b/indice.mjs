import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const repo = process.argv[2];
const runs = JSON.parse(fs.readFileSync('runs.json','utf8'));
const pasos = JSON.parse(fs.readFileSync('pasos.json','utf8'));
const col = JSON.parse(fs.readFileSync(repo+'/docs/master/evidencias/SCRUM-1527/colgados.json','utf8'));
const casos = [
 {job:106973511384, sig:'scrum616-que-guarda-la-factura.test.mjs'},
 {job:107138394330, sig:'scrum616-que-guarda-la-factura.test.mjs'},
 {job:108352556918, sig:'scrum475-firma-del-webhook.test.mjs'},
 ...col.map(c=>({job:c.job, sha:c.sha, sig: /SCRUM-446/.test(c.ultimoQueLlego)?'scrum447-byte-invisible-en-patrones.test.mjs':'scrum446-cabecera-modal.test.mjs'})),
];
const git=(...a)=>execFileSync('git',a,{cwd:repo,encoding:'utf8',maxBuffer:64*1024*1024});
for (const c of casos) {
  if (!c.sha) { const p=pasos.find(x=>x.job===c.job); c.sha = runs.find(r=>r.databaseId===p.run).headSha; }
  try { git('cat-file','-e',c.sha+'^{commit}'); } catch { try { git('fetch','-q','origin',c.sha); } catch(e) { console.log(c.job,'CIEGO: no tengo',c.sha); continue; } }
  const ls = git('ls-tree','--name-only',c.sha,'tests/').split('\n').map(s=>s.replace(/^tests\//,'')).filter(f=>f.endsWith('.test.mjs'));
  // orden de la shell de CI (LC_ALL=C? ) : pruebo el orden por codigo de caracter
  ls.sort((a,b)=>a<b?-1:a>b?1:0);
  const i = ls.indexOf(c.sig);
  console.log(c.job, c.sha.slice(0,9), 'ficheros', ls.length, 'indice del SIGUIENTE (1..n)', i+1, c.sig.slice(0,28), '| restantes', ls.length-i-1, '| anterior', ls[i-1]);
}
