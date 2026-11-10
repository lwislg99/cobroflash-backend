const fs=require('fs');
for(const id of process.argv.slice(2)){const [f,l]=id.split(/:(?=\d+$)/);const ls=fs.readFileSync(f,'utf8').split(/\r?\n/);let i=+l-1;
while(i<ls.length&&/^\s*(\/\/|\/?\*)/.test(ls[i]))i++;
const code=[];for(let k=i;k<ls.length&&code.length<2;k++){if(ls[k].trim()&&!/^\s*(\/\/|\/?\*)/.test(ls[k]))code.push((k+1)+': '+ls[k].trim().slice(0,170)+(ls[k].trim().length>170?' [CORTADO]':''));}
console.log('## '+id+'\n  '+code.join('\n  '));}
