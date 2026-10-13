// docs/master/evidencias/scrum1502b/ancla-en-el-arbol.mjs - SCRUM-1511, punto 3
//
// SE PUEDE COMPROBAR UN ANCLA SIN RED, CONTRA ALGO DEL ARBOL? Para cada par ticket+comentario se
// mira si el id del comentario aparece (como numero entero, no como subcadena) en el registro del
// propio ticket (docs/master/SCRUM-<n>.md), y en cualquier .md de docs/.
//
// Uso:  node ancla-en-el-arbol.mjs <ancladas.json>   (la lista lleva dentro sus dos pares fabricados)
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const lista = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pares = [...new Set(lista.flatMap((m) => m.anclas))];
const mds = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p); else if (e.name.endsWith('.md')) mds.push(p);
  }
})(path.join(RAIZ, 'docs'));
const textos = mds.map((p) => ({ p: path.relative(RAIZ, p).split(path.sep).join('/'), t: fs.readFileSync(p, 'utf8') }));
let enSuRegistro = 0; let enAlguno = 0;
for (const par of pares) {
  const [, n, id] = par.match(/SCRUM-(\d+) comentario (\d+)/);
  const re = new RegExp(`(?<![0-9])${id}(?![0-9])`);
  const suyo = textos.find((x) => x.p === `docs/master/SCRUM-${n}.md`);
  const a = Boolean(suyo && re.test(suyo.t));
  const donde = textos.filter((x) => re.test(x.t)).map((x) => x.p);
  if (a) enSuRegistro += 1;
  if (donde.length) enAlguno += 1;
  console.log(`${par}\tregistro propio: ${suyo ? (a ? 'SI lleva el id' : 'existe, sin el id') : 'NO EXISTE'}\tmd de docs/ con el id: ${donde.length}`);
}
console.log(`POBLACION pares=${pares.length} md leidos=${textos.length} · con el id en su propio registro=${enSuRegistro} · con el id en algun md=${enAlguno}`);
