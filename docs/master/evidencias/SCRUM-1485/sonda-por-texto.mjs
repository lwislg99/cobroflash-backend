// Segunda sonda de SCRUM-1485, INDEPENDIENTE del censo por AST: por TEXTO y por NOMBRE, sin ámbitos.
// Sobre-acusa a propósito (un nombre ligado en otro sitio cuenta). Lo que importa es la DIFERENCIA de
// conjuntos con el censo: lo que ésta ve y aquél no, se lee a mano.
// uso: node sonda-texto-1485.mjs <árbol> <censo.json>
import fs from 'node:fs';
import path from 'node:path';

const [arbol, jsonCenso] = process.argv.slice(2);
const censo = JSON.parse(fs.readFileSync(jsonCenso, 'utf8'));
const vistos = new Set(censo.filas.map((f) => `${f.fichero}:${f.linea}`));
const ficheros = fs.readdirSync(path.join(arbol, 'tests'), { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.(mjs|cjs|js|ts)$/.test(e.name))
  .map((e) => path.relative(arbol, path.join(e.parentPath || e.path, e.name)).split(path.sep).join('/')).sort();
const LIT = String.raw`['"\`][^'"\`\n]*[\/\\][^'"\`\n]*['"\`]`;
let conNombres = 0;
const filas = [];
for (const rel of ficheros) {
  const lineas = fs.readFileSync(path.join(arbol, rel), 'utf8').split(/\r?\n/);
  const nombres = new Set();
  for (const l of lineas) {
    if (/^\s*(\/\/|\*)/.test(l)) continue;
    const m = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:path\.(?:join|relative|resolve|normalize|dirname)|fileURLToPath|relative|join|resolve)\(/.exec(l);
    if (m && !/split\(|replace(All)?\(/.test(l)) nombres.add(m[1]);
  }
  if (!nombres.size) continue;
  conNombres++;
  const alt = [...nombres].join('|');
  const patrones = [
    new RegExp(String.raw`\b(?:${alt})\.(?:startsWith|endsWith|includes|indexOf|match)\(\s*(?:${LIT}|\/[^\/\n]*\\[\/\\])`),
    new RegExp(String.raw`\b(?:${alt})\s*[!=]==?\s*${LIT}`),
    new RegExp(String.raw`${LIT}\s*[!=]==?\s*(?:${alt})\b`),
    new RegExp(String.raw`\/[^\/\n]*\\[\/\\][^\n]*\/[a-z]*\.test\(\s*(?:${alt})\s*\)`),
    new RegExp(String.raw`assert\.\w+\(\s*(?:${alt})\s*,\s*${LIT}`),
    new RegExp(String.raw`\$\{(?:${alt})\}[\/\\]`),
  ];
  lineas.forEach((l, i) => {
    if (/^\s*(\/\/|\*)/.test(l)) return;
    const k = patrones.findIndex((p) => p.test(l));
    if (k < 0) return;
    filas.push({ rel, n: i + 1, k, l: l.trim().slice(0, 170), enCenso: vistos.has(`${rel}:${i + 1}`) });
  });
}
console.log(`POBLACION · ${ficheros.length} ficheros · ${conNombres} con algún nombre ligado a una ruta de máquina sin normalizar en su renglón`);
console.log(`ACUSA · ${filas.length} renglones · ${filas.filter((f) => f.enCenso).length} los tiene también el censo · ${filas.filter((f) => !f.enCenso).length} sólo esta sonda`);
const porPatron = ['metodo(literal)', 'nombre===literal', 'literal===nombre', 'regex.test(nombre)', 'assert(nombre, literal)', '${nombre}/ pegado'];
for (const f of filas) console.log(`${f.enCenso ? 'AMBOS' : 'SOLO '} ${f.rel}:${f.n} · ${porPatron[f.k]}\n      ${f.l}`);
console.log('EXIT=0');
