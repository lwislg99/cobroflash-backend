// Consumidores transitivos de tests/_banco-vistas.mjs y scripts/_pagina-panel.mjs (los *.test.mjs).
import fs from 'node:fs'; import path from 'node:path';
const raiz = process.cwd();
const ficheros = [...fs.readdirSync('tests').map((f) => 'tests/' + f), ...fs.readdirSync('scripts').map((f) => 'scripts/' + f)].filter((f) => /\.m?js$/.test(f));
const imp = new Map();
for (const f of ficheros) {
  const t = fs.readFileSync(f, 'utf8');
  const deps = [...t.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
  imp.set(f, deps);
}
const alcanzados = new Set(['tests/_banco-vistas.mjs', 'scripts/_pagina-panel.mjs']);
let cambio = true;
while (cambio) { cambio = false; for (const [f, d] of imp) if (!alcanzados.has(f) && d.some((x) => alcanzados.has(x))) { alcanzados.add(f); cambio = true; } }
const pob = [...alcanzados].filter((f) => f.startsWith('tests/') && f.endsWith('.test.mjs')).sort();
fs.writeFileSync(process.argv[2], pob.join('\n') + '\n');
console.log('poblacion', pob.length);
