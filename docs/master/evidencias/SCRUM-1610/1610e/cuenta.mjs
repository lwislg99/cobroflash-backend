import fs from 'node:fs';
const [f, t1, t2] = process.argv.slice(2);
const L = fs.readFileSync(f,'utf8').trim().split('\n'); const h = L[0].split('\t');
const rows = L.slice(1).map(l => Object.fromEntries(l.split('\t').map((v,i)=>[h[i],v])));
const test = rows.filter(r => r.corre1516c === '1' && r.ciego !== '1');
const tramos = [['antes-1610b', '', t1], ['1610b..1610d', t1, t2], ['tras-1610d', t2, '9']];
for (const [n,a,b] of tramos) { const s = test.filter(r => r.createdAt >= a && r.createdAt < b);
  console.log(n, 'logs', s.length, 'cortes', s.filter(r=>r.S_NEW_corte!=='0').length, 'desde', s.map(r=>r.createdAt).sort()[0], 'hasta', s.map(r=>r.createdAt).sort().pop()); }
