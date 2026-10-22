const fs=require("fs");
const exp=new Set(fs.readFileSync("lotes/lote-01.md","utf8")&&[].concat(...Array.from({length:13},(_,i)=>fs.readFileSync(`lotes/lote-${String(i+1).padStart(2,"0")}.md`,"utf8").match(/^## (SCRUM-\d+)/gm).map(s=>s.slice(3)))));
const filas=[];let todo="";
for(let i=1;i<=13;i++){const nn=String(i).padStart(2,"0");const t=fs.readFileSync(`salida/veredicto-lote-${nn}.md`,"utf8");todo+=`\n\n## lote-${nn}\n\n`+t;
 for(const l of t.split("\n")){const m=l.match(/^\|\s*\**(SCRUM-\d+)\**\s*\|/);if(!m)continue;const c=l.split("|").map(s=>s.trim());filas.push({k:m[1],v:c[3].replace(/\*/g,""),lote:nn,falta:c[6]});}}
fs.writeFileSync("veredictos-por-lote.md",todo.trim()+"\n");
const ks=filas.map(f=>f.k);console.log("filas",filas.length,"unicas",new Set(ks).size,"esperadas",exp.size);
console.log("faltan",[...exp].filter(k=>!ks.includes(k)).join(" ")||"-","sobran",ks.filter(k=>!exp.has(k)).join(" ")||"-");
const cnt={};filas.forEach(f=>{const v=/^TERMINADO/.test(f.v)?"TERMINADO":/^LE FALTA/.test(f.v)?"LE FALTA ALGO":/^NO HE PODIDO/.test(f.v)?"NO HE PODIDO MIRAR":"?"+f.v;cnt[v]=(cnt[v]||0)+1;f.c=v});console.log(cnt);
const n=k=>+k.slice(6);
console.log("TERMINADO:",filas.filter(f=>f.c=="TERMINADO").map(f=>n(f.k)).sort((a,b)=>a-b).join(" "));
fs.writeFileSync("filas.json",JSON.stringify(filas));
