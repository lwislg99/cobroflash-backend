import fs from 'node:fs'; import {execFileSync as x} from 'node:child_process';
const [raiz, f39, out] = process.argv.slice(2);
const L=JSON.parse(fs.readFileSync(f39,'utf8').replace(/^\uFEFF/,''));
const git=(...a)=>x('git',['-C',raiz,...a],{encoding:'utf8',maxBuffer:1e8});
const res=[];
for(const r of L){
  const [file,ln]=r.donde.split(/:(?=\d+$)/); const lines=fs.readFileSync(`${raiz}/${file}`,'utf8').split('\n');
  const want=r.frase.slice(0,60); let n=+ln; for(let i=+ln-1;i<Math.min(lines.length,+ln+60);i++){ if(lines[i].trim().startsWith(want.slice(0,40))||lines[i].includes(want.slice(3,50))){n=i+1;break;} }
  const p=git('blame','-L',`${n},${n}`,'--porcelain','HEAD','--',file);
  const sha=p.split(' ')[0]; const g=(k)=>(p.match(new RegExp(`^${k} (.*)$`,'m'))||[])[1];
  const msg=git('show','-s','--format=%B',sha);
  const fundEnMsg=msg.split('\n').filter(l=>/fundador|asesor|aprob|firm/i.test(l)).slice(0,6);
  res.push({donde:r.donde,lineaMarca:n,sha,autor:g('author'),fecha:new Date(+g('author-time')*1000).toISOString().slice(0,10),asunto:g('summary'),coautor:/Co-Authored-By: Claude/i.test(msg),fundEnMsg});
}
fs.writeFileSync(out,JSON.stringify(res,null,1));
for(const r of res) console.log(r.donde,'L'+r.lineaMarca,r.sha.slice(0,9),r.autor,r.fecha,r.coautor?'+Claude':'','|',r.asunto.slice(0,90));
