import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const [verdes, out, n] = process.argv.slice(2);
const v = fs.readFileSync(verdes,'utf8').split(/\r?\n/).map(l=>l.trim().split(/\s+/)[0]).filter(x=>/^\d+$/.test(x));
// repartidos por toda la lista: uno de cada k
const k = Math.floor(v.length / Number(n)); let ok=0, mal=0;
for (let i=0;i<v.length;i+=k) { const j=v[i]; const d = out+'/'+j+'.log';
  if (!fs.existsSync(d) || fs.statSync(d).size < 1000) { const r = spawnSync('gh', ['api','--allow-escape-sequences','repos/lwislg99/cobroflash-backend/actions/jobs/'+j+'/logs'], {maxBuffer: 256*1024*1024}); fs.writeFileSync(d, r.stdout); }
  if (fs.statSync(d).size > 100000) ok++; else { mal++; console.log('PEQUENO', j, fs.statSync(d).size); } }
console.log('POBLACION lista', v.length, 'paso', k, 'bajados bien', ok, 'mal', mal);
