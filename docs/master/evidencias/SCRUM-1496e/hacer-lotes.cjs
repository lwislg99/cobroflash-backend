const fs=require("fs");
const luis=new Set(["SCRUM-870","SCRUM-1092","SCRUM-1505","SCRUM-1506","SCRUM-1507"]);
let keys=fs.readFileSync("algo.txt","utf8").trim().split("\n").filter(k=>!luis.has(k));
keys.push("SCRUM-1548","SCRUM-1331");
keys.sort((a,b)=>+a.slice(6)-+b.slice(6));
const tabla=(fs.readFileSync("tabla.md","utf8")+fs.readFileSync("tabla-controles.md","utf8")).split("\n");
const v=fs.readFileSync("v1496d.md","utf8").split("\n");
const fila=(arr,k)=>arr.find(l=>l.startsWith("| "+k+" |"))||"(sin fila)";
const N=13, lotes=Array.from({length:N},()=>[]);
keys.forEach((k,i)=>lotes[i%N].push(k));
lotes.forEach((ks,i)=>{
  const nn=String(i+1).padStart(2,"0");
  let s=`# lote-${nn} · ${ks.length} tickets\n\n`;
  for(const k of ks) s+=`## ${k}\n- censo de hoy (8ad167195): ${fila(tabla,k)}\n- PISTA 1496d (20-oct, re-mídela): ${fila(v,k)}\n\n`;
  fs.writeFileSync(`lotes/lote-${nn}.md`,s);
  console.log(nn,ks.length,ks.join(" "));
});
console.log("total",keys.length,"unicas",new Set(keys).size);
