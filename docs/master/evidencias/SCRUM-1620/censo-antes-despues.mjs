// Declaraciones por guard: HEAD (git show) contra el árbol de trabajo, con el lector del meta-guard.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const raiz = process.cwd();
const m = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const enHead = execFileSync('git', ['ls-tree', '--name-only', 'HEAD', 'tests/'], { encoding: 'utf8' })
  .split('\n').filter((f) => f.endsWith('.test.mjs')).map((f) => path.basename(f));
const enArbol = fs.readdirSync(path.join(raiz, 'tests')).filter((f) => f.endsWith('.test.mjs'));
const contar = (codigo, f) => m.lecturaDeDeclaraciones(codigo, f).buenas.length;
const antes = new Map(enHead.map((f) => [f, contar(execFileSync('git', ['show', `HEAD:tests/${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 }), f)]));
const despues = new Map(enArbol.map((f) => [f, contar(fs.readFileSync(path.join(raiz, 'tests', f), 'utf8'), f)]));
const todos = new Set([...antes.keys(), ...despues.keys()]);
const suma = (mp) => [...mp.values()].reduce((a, b) => a + b, 0);
const guards = (mp) => [...mp.values()].filter(Boolean).length;
console.log(`población: HEAD ${antes.size} ficheros · árbol ${despues.size}`);
console.log(`declarantes: HEAD ${guards(antes)} · árbol ${guards(despues)}`);
console.log(`declaraciones: HEAD ${suma(antes)} · árbol ${suma(despues)}`);
let cambios = 0;
for (const f of [...todos].sort()) {
  const a = antes.get(f) ?? 0; const d = despues.get(f) ?? 0;
  if (a !== d) { cambios++; console.log(`  ${d < a ? '🔴 BAJA' : '⬆ sube'} ${f}: ${a} → ${d}`); }
}
console.log(cambios ? `${cambios} fichero(s) cambian` : 'ningún fichero cambia');
