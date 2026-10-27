// en cada colgado: la ULTIMA rafaga antes del silencio. Donde empieza (ultimo hueco >=300 ms), que caso la abre, cuanto duraba, y los casos lentos (>=1000 ms) de dentro
import fs from 'node:fs';
const dir=process.argv[2]; const CSI=/\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.log')).sort()) {
  const raw=fs.readFileSync(dir+'/'+f,'utf8').replace(CSI,'').split('\n');
  const L=raw.map(l=>{const m=/^(\d{4}-\d\d-\d\dT[\d:.]+)Z (.*)$/.exec(l); return m?{t:Date.parse(m[1].slice(0,23)+'Z'),h:m[1].slice(11,23),s:m[2]}:null}).filter(Boolean);
  const casos=L.map((l,i)=>({...l,i})).filter(l=>/^\s*[✔✖﹣ℹ]/.test(l.s));
  const fin=L.findIndex(l=>/ℹ tests \d+/.test(l.s)); if (fin>=0) continue; // solo los que no acabaron
  const ult=casos[casos.length-1]; let k=casos.length-1; while(k>0 && casos[k].t-casos[k-1].t<300) k--;
  const raf=casos.slice(k); const lentos=raf.filter(c=>Number((/\(([\d.]+)ms\)$/.exec(c.s)||[])[1])>=1000).map(c=>c.s.slice(2,40)+' '+Math.round(Number(/\(([\d.]+)ms\)$/.exec(c.s)[1]))+'ms');
  const sigLinea=L[ult.i+1]||L[L.length-1]; const finLog=L[L.length-1];
  console.log(`\n== ${f.slice(0,12)} ${L[0].h?'':''}dia=${raw[0].slice(0,10)} ultimaLinea=${ult.h} "${ult.s.slice(2,48)}" | silencio hasta lo siguiente=${Math.round(((L.find((l,i)=>i>ult.i && l.t-ult.t>1000)||finLog).t-ult.t)/1000)}s`);
  console.log(`   ultima rafaga: ${raf.length} lineas en ${raf[raf.length-1].t-raf[0].t} ms, tras un hueco de ${k>0?casos[k].t-casos[k-1].t:0} ms; la abre "${raf[0].s.slice(2,60)}"`);
  console.log(`   lentos (>=1 s) dentro de la rafaga: ${lentos.join(' · ')||'ninguno'}`);
}
