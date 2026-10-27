import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const [colg, verdes, out] = process.argv.slice(2);
const c = JSON.parse(fs.readFileSync(colg,'utf8')).map(x=>String(x.job));
const v = fs.readFileSync(verdes,'utf8').split(/\r?\n/).map(l=>l.trim().split(/\s+/)[0]).filter(x=>/^\d+$/.test(x));
const pick = [...c, ...v.slice(-12)];
for (const j of pick) {
  const d = out + '/' + j + '.log';
  if (!fs.existsSync(d) || fs.statSync(d).size < 1000) {
    const r = spawnSync('gh', ['api','--allow-escape-sequences','repos/lwislg99/cobroflash-backend/actions/jobs/'+j+'/logs'], {maxBuffer: 256*1024*1024});
    fs.writeFileSync(d, r.stdout);
  }
  console.log(c.includes(j)?'COLGADO':'verde  ', j, fs.statSync(d).size);
}
console.log('POBLACION colgados', c.length, 'verdes en lista', v.length, 'bajados', pick.length);
