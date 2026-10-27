// huecos de tiempo (>= umbral ms) entre lineas consecutivas del paso de tests, con la linea de antes y la de despues
import fs from 'node:fs';
const [dir, umbral='1500'] = process.argv.slice(2);
const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.log')).sort()) {
  const L = fs.readFileSync(dir+'/'+f,'utf8').replace(CSI,'').split('\n');
  const col = L.some(l=>l.includes('TANDA SIN VEREDICTO (SCRUM-858):'));
  // tramo de la tanda: desde la primera linea de caso hasta "ℹ tests" o el aviso
  let a = L.findIndex(l=>/^\S+Z [✔✖﹣]/.test(l)), b = L.findIndex(l=>/Z (ℹ tests \d+|.*TANDA SIN VEREDICTO)/.test(l));
  if (a<0||b<0) { console.log(f,'CIEGO a,b',a,b); continue; }
  console.log(`\n== ${f} ${col?'COLGADO':'sin aviso'} bytes=${fs.statSync(dir+'/'+f).size} lineasTanda=${b-a}`);
  let prev=null, prevLine='';
  for (let i=a;i<=b;i++){ const m=/^(\d{4}-\d\d-\d\dT[\d:.]+)Z (.*)$/.exec(L[i]); if(!m) continue; const t=Date.parse(m[1].slice(0,23)+'Z');
    if(prev!==null && t-prev>=Number(umbral)) console.log(`  +${((t-prev)/1000).toFixed(1)}s @${m[1].slice(11,19)} | antes: ${prevLine.slice(0,70)} | despues: ${m[2].slice(0,70)}`);
    prev=t; prevLine=m[2]; }
}
