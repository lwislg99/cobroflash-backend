import fs from 'node:fs';
const dir = process.argv[2];
const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const rows=[];
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.log')).sort()) {
  const L = fs.readFileSync(dir+'/'+f,'utf8').replace(CSI,'').split('\n').map(l=>{const m=/^(\d{4}-\d\d-\d\dT[\d:.]+)Z (.*)$/.exec(l); return m?{t:Date.parse(m[1].slice(0,23)+'Z'),s:m[2],d:m[1].slice(0,10)}:null}).filter(Boolean);
  const col = L.some(l=>l.s.includes('TANDA SIN VEREDICTO (SCRUM-858):'));
  const i419 = L.findIndex(l=>/^✔ SCRUM-419 · SUELO/.test(l.s));
  if (i419<0) { rows.push({f,col,ciego:1}); continue; }
  let j=i419; while (j+1<L.length && L[j+1].t-L[j].t < 60) j++;
  const tag = (s)=>((/^[✔✖﹣] (SCRUM-\w+)/.exec(s)||[])[1]||s.slice(0,25));
  const first=(re)=>{const x=L.find(l=>re.test(l.s)); return x?x.t-L[i419].t:null;};
  const d419 = Number((/\(([\d.]+)ms\)/.exec(L[i419].s)||[])[1]);
  rows.push({f:f.slice(0,12),dia:L[i419].d.slice(5),col:col?'COLG':'', d419:Math.round(d419), finRafaga:tag(L[j].s), sigue:j+1<L.length?tag(L[j+1].s)+' +'+(L[j+1].t-L[j].t)+'ms':'-', t446:first(/^✔ SCRUM-446 · SUELO/), t447:first(/^✔ SCRUM-447 · SUELO/), t448:first(/^✔ SCRUM-448 /)});
}
console.log('POBLACION', rows.length, 'colgados', rows.filter(r=>r.col).length, 'ciegos', rows.filter(r=>r.ciego).length);
for (const r of rows.sort((a,b)=>(a.dia+a.f).localeCompare(b.dia+b.f))) console.log([r.f,r.dia,r.col||'    ',('d419='+r.d419).padEnd(10),('finRafaga='+r.finRafaga).padEnd(22),('sigue='+r.sigue).padEnd(28),'t446='+r.t446,'t447='+r.t447,'t448='+r.t448].join(' '));
