// las runs en SUCCESS tambien: un job colgado puede estar en un intento anterior de una run que luego salio verde
import { execFile } from 'node:child_process';
import fs from 'node:fs';
const REPO='lwislg99/cobroflash-backend', JOB='build + tests (con banco desechable)';
const runs = JSON.parse(fs.readFileSync('runs.json','utf8')).filter(r=>r.status==='completed' && r.conclusion==='success');
const gh=(a)=>new Promise(res=>execFile('gh',a,{maxBuffer:64*1024*1024,encoding:'utf8'},(err,stdout,stderr)=>res({err,stdout,stderr})));
const filas=[]; let i=0, errores=0;
async function obrero(){ while(i<runs.length){ const r=runs[i++]; let j=await gh(['api',`repos/${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100&filter=all`]);
  if(j.err){ j=await gh(['api',`repos/${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100&filter=all`]); }
  if(j.err){ errores++; continue; }
  for(const job of JSON.parse(j.stdout).jobs.filter(x=>x.name===JOB)){ const s=(job.steps||[]).find(s=>/^Tests/.test(s.name));
    filas.push({run:r.databaseId,job:job.id,intento:job.run_attempt,creado:r.createdAt,rama:r.headBranch,evento:r.event,conclusion:job.conclusion,paso:s?s.conclusion:null,pasoS:s&&s.started_at&&s.completed_at?(Date.parse(s.completed_at)-Date.parse(s.started_at))/1000:null}); } } }
await Promise.all(Array.from({length:8},obrero));
const prev=JSON.parse(fs.readFileSync('pasos.json','utf8'));
fs.writeFileSync('pasos-todos.json',JSON.stringify([...prev,...filas],null,1));
console.log('POBLACION runs success miradas',runs.length,'errores',errores,'filas',filas.length,'de intentos>1 o no-success',filas.filter(f=>f.conclusion!=='success').length);
const T=[...prev,...filas].filter(f=>f.job);
console.log('TOTAL jobs obligatorios',T.length,'| por conclusion',JSON.stringify(T.reduce((a,f)=>(a[f.conclusion]=(a[f.conclusion]||0)+1,a),{})));
const cand=T.filter(f=>f.paso==='failure'&&f.pasoS>=900).sort((a,b)=>a.creado.localeCompare(b.creado));
for(const c of cand) console.log('  ',c.job,c.creado,c.pasoS+'s','intento',c.intento,c.rama.slice(0,48));
console.log('CANDIDATOS',cand.length,'| failure entre 600 y 900 s:',T.filter(f=>f.paso==='failure'&&f.pasoS>=600&&f.pasoS<900).length);
fs.writeFileSync('cand.json',JSON.stringify(cand));
