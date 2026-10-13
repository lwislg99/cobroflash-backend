// offset (s) entre la linea de corte (ultimo de 445b) y el error de scrum809 en el Postgres; en verdes y colgados
import fs from 'node:fs';
const dir = process.argv[2];
const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const ts = (s)=>Date.parse(s.slice(0,19)+'Z');
const V=[], C=[];
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.log')).sort()) {
  const L = fs.readFileSync(dir+'/'+f,'utf8').replace(CSI,'').split('\n');
  const col = L.some(l=>l.includes('TANDA SIN VEREDICTO (SCRUM-858):'));
  const a = L.find(l=>/Z [✔✖﹣]/.test(l));
  const c = L.find(l=>/✔ SCRUM-445 · ② el comentario NO vuelve/.test(l));
  const pg = L.map(l=>/^\S+Z\s+(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+ UTC \[\d+\] DETAIL:.*evt_scrum809/.exec(l)).find(Boolean);
  const fin = L.find(l=>/Z ℹ tests \d+/.test(l));
  if (!a||!c||!pg) { console.log('CIEGO', f, !!a, !!c, !!pg); continue; }
  const r = { f:f.slice(0,12), ini445:(ts(c)-ts(a))/1000, de445a809:(Date.parse(pg[1].replace(' ','T')+'Z')-ts(c))/1000, de445aFin: fin?(ts(fin)-ts(c))/1000:null };
  (col?C:V).push(r);
}
const med=(a)=>{const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)];};
const res=(n,R)=>console.log(n,'n='+R.length,'inicio->445b mediana',med(R.map(r=>r.ini445)),'min',Math.min(...R.map(r=>r.ini445)),'max',Math.max(...R.map(r=>r.ini445)),'| 445b->pg809 mediana',med(R.map(r=>r.de445a809)),'min',Math.min(...R.map(r=>r.de445a809)),'max',Math.max(...R.map(r=>r.de445a809)), '| 445b->fin mediana', med(R.filter(r=>r.de445aFin!=null).map(r=>r.de445aFin)));
res('VERDES  ',V); res('COLGADOS',C);
for (const r of C) console.log('  ',r.f,'inicio->445b',r.ini445,'445b->pg809',r.de445a809, 'ratio', (r.de445a809/r.ini445).toFixed(2));
console.log('   verdes ratio 445b->pg809 / inicio->445b: mediana', med(V.map(r=>r.de445a809/r.ini445)).toFixed(2), 'min', Math.min(...V.map(r=>r.de445a809/r.ini445)).toFixed(2), 'max', Math.max(...V.map(r=>r.de445a809/r.ini445)).toFixed(2));
