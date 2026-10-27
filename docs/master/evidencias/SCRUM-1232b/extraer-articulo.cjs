// uso: node extraer-articulo.cjs <fichero.xml> <idBloque>  → última versión con vigencia <= hoy, texto plano
// 🔴 AVISO del 7-oct-2026 (SCRUM-1316b, §Ⓝ): «hoy» es la fecha FIJA de abajo, y fecha_vigencia NO es la fecha
// desde la que se aplica una versión. El art. 91 LIVA trae una con fecha_vigencia="20261008" (RDL 29/2026) cuyos
// efectos son del 1-dic-2026: si mueves la fecha a hoy, este guion la devuelve como si ya rigiera. Lee la nota
// al pie de la versión, o usa docs/master/evidencias/scrum1316/versiones-art91.cjs, que no corta por fecha.
const fs=require('fs');const [f,id]=process.argv.slice(2);const x=fs.readFileSync(f,'utf8');
const i=x.indexOf(`<bloque id="${id}"`);if(i<0){console.log('NO EXISTE',id);process.exit(1)}
const b=x.slice(i,x.indexOf('</bloque>',i));
const vs=[...b.matchAll(/<version [^>]*fecha_vigencia="(\d+)"[^>]*>([\s\S]*?)<\/version>/g)].filter(v=>v[1]<='20260928');
const v=vs[vs.length-1];
console.log(`[${id}] versiones=${vs.length} vigente desde ${v[1]}`);
console.log(v[2].replace(/<\/p>/g,'\n').replace(/<[^>]+>/g,'').replace(/\n\s*\n/g,'\n').trim());
