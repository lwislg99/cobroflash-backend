// uso: node extraer-articulo.cjs <fichero.xml> <idBloque>  → última versión con vigencia <= hoy, texto plano
const fs=require('fs');const [f,id]=process.argv.slice(2);const x=fs.readFileSync(f,'utf8');
const i=x.indexOf(`<bloque id="${id}"`);if(i<0){console.log('NO EXISTE',id);process.exit(1)}
const b=x.slice(i,x.indexOf('</bloque>',i));
const vs=[...b.matchAll(/<version [^>]*fecha_vigencia="(\d+)"[^>]*>([\s\S]*?)<\/version>/g)].filter(v=>v[1]<='20260928');
const v=vs[vs.length-1];
console.log(`[${id}] versiones=${vs.length} vigente desde ${v[1]}`);
console.log(v[2].replace(/<\/p>/g,'\n').replace(/<[^>]+>/g,'').replace(/\n\s*\n/g,'\n').trim());
