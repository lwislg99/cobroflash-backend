// en cada log COLGADO: hora de la ultima linea de la tanda, y lineas del Postgres del servicio POSTERIORES a esa hora
import fs from 'node:fs';
const dir = process.argv[2];
const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
let n=0, conTestigo=0;
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.log')).sort()) {
  const L = fs.readFileSync(dir+'/'+f,'utf8').replace(CSI,'').split('\n');
  const ia = L.findIndex(l=>l.includes('TANDA SIN VEREDICTO (SCRUM-858):'));
  if (ia<0) continue; n++;
  let k=ia-1; while(k>0 && !/Z [✔✖﹣ℹ]/.test(L[k])) k--;
  const tUlt = L[k].slice(0,19), tAviso = L[ia].slice(0,19);
  const pg = L.map(l=>/^\S+Z\s+(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+ UTC \[\d+\] (.*)$/.exec(l)).filter(Boolean).map(m=>({t:m[1].replace(' ','T'),s:m[2]}));
  const despues = pg.filter(x=>x.t>tUlt && x.t<tAviso && !/checkpoint/.test(x.s));
  const chk = pg.filter(x=>x.t>tUlt && /checkpoint complete/.test(x.s)).map(x=>x.t.slice(11)+' '+(/wrote (\d+) buffers/.exec(x.s)||[])[1]+'buf');
  if (despues.length) conTestigo++;
  console.log(`\n== ${f} ultima=${tUlt.slice(11)} aviso=${tAviso.slice(11)} lineasPG=${pg.length} sentencias/errores entre medias=${despues.length}`);
  for (const d of despues.slice(0,6)) console.log('   '+d.t.slice(11)+' '+d.s.slice(0,150));
  console.log('   checkpoints posteriores: '+chk.join(' · '));
}
console.log(`\nPOBLACION colgados=${n} conTestigoPosterior=${conTestigo}`);
