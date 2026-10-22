// Sonda de un solo uso (SCRUM-1569). Lee el schema con la MISMA expresion que el censo.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = process.argv[2];
const { camposPersonalesDelSchema, VOCABULARIO_PERSONAL } = await import(pathToFileURL(path.join(raiz, 'tests/_censo-datos-personales.mjs')).href);
const schema = fs.readFileSync(path.join(raiz, 'prisma/schema.prisma'), 'utf8');
const todas = [];
let modelo = null;
for (const linea of schema.replace(/\r/g, '').split('\n')) {
  const abre = /^\s*model\s+(\w+)\s*\{/.exec(linea);
  if (abre) { modelo = abre[1]; continue; }
  if (!modelo) continue;
  if (/^\s*\}/.test(linea)) { modelo = null; continue; }
  const campo = /^\s*(\w+)\s+String(\?)?(\s|$)/.exec(linea);
  if (!campo) continue;
  todas.push(`${modelo[0].toLowerCase() + modelo.slice(1)}.${campo[1]}`);
}
const exactas = camposPersonalesDelSchema(schema).map((p) => p.clave);
console.log('POBLACION String:', todas.length, '· exactas:', exactas.length, '· exactas dentro:', exactas.every((c) => todas.includes(c)));
const vocab = VOCABULARIO_PERSONAL.map((v) => v.toLowerCase());
const contiene = todas.filter((c) => { const n = c.split('.')[1].toLowerCase(); return !vocab.includes(n) && vocab.some((v) => n.includes(v)); });
console.log('SUBCADENA (no exactas):', contiene.length);
console.log(contiene.join('\n'));
const resto = todas.filter((c) => !exactas.includes(c) && !contiene.includes(c));
console.log('RESTO sin mirar:', resto.length);
fs.writeFileSync(path.join(process.argv[3], 'resto.txt'), resto.join('\n') + '\n');
console.log('EXIT=0');
