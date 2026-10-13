// por cada run fallida o cancelada: el job obligatorio y la duracion de su paso de Tests
import { execFile } from 'node:child_process';
import fs from 'node:fs';
const REPO='lwislg99/cobroflash-backend', JOB='build + tests (con banco desechable)';
const runs = JSON.parse(fs.readFileSync('runs.json','utf8')).filter(r=>r.status==='completed' && (r.conclusion==='failure'||r.conclusion==='cancelled'));
const gh=(a)=>new Promise(res=>execFile('gh',a,{maxBuffer:64*1024*1024,encoding:'utf8'},(err,stdout,stderr)=>res({err,stdout,stderr})));
const filas=[]; let i=0, errores=0;
async function obrero(){ while(i<runs.length){ const r=runs[i++]; let j=await gh(['api',`repos/${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100&filter=all`]);
  if(j.err){ j=await gh(['api',`repos/${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100&filter=all`]); }
  if(j.err){ errores++; filas.push({run:r.databaseId,error:String(j.stderr).slice(0,120)}); continue; }
  for(const job of JSON.parse(j.stdout).jobs.filter(x=>x.name===JOB)){ const s=(job.steps||[]).find(s=>/^Tests/.test(s.name));
    filas.push({run:r.databaseId,job:job.id,intento:job.run_attempt,creado:r.createdAt,rama:r.headBranch,evento:r.event,conclusion:job.conclusion,paso:s?s.conclusion:null,pasoS:s&&s.started_at&&s.completed_at?(Date.parse(s.completed_at)-Date.parse(s.started_at))/1000:null}); } } }
await Promise.all(Array.from({length:8},obrero));
fs.writeFileSync('pasos.json',JSON.stringify(filas,null,1));
console.log('POBLACION runs miradas',runs.length,'filas',filas.length,'errores',errores,'con job',filas.filter(f=>f.job).length,'paso Tests failure',filas.filter(f=>f.paso==='failure').length,'cancelled',filas.filter(f=>f.paso==='cancelled').length);
