// Para cada script con area de ticket creador (los que decide el criterio), quien lo IMPORTA o lo nombra
// desde otro script, y de quien es ese importador: fila propia hoy, area propia (otro de los 41), o sin fila.
// Solo lectura. Uso: node importadores-por-area.mjs <raiz> <scripts-sueltos.tsv> <areas-de-tickets.tsv>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [raiz, tsv, areasF] = process.argv.slice(2);
const lin = (f) => fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean);
const cab = lin(tsv)[0].split('\t');
const filas = lin(tsv).slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const areas = new Map(lin(areasF).map((l) => l.split('\t')));
const areaDe = new Map();
for (const f of filas) { const a = areas.get(f.nace); if (a && /^[sj]\d$/.test(a)) areaDe.set(f.fichero, a); }
const todos = execFileSync('git', ['-C', raiz, 'ls-files', '-z', '--', 'scripts'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const sueltos = new Set(filas.map((f) => f.fichero));
const texto = new Map(todos.map((f) => [f, fs.readFileSync(path.join(raiz, f), 'utf8')]));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nombra = (t, base) => new RegExp(`(^|[^A-Za-z0-9_-])${esc(base)}(?![A-Za-z0-9_-])`, 'm').test(t);
// un IMPORT de verdad (from '...base' o import('...base')), distinto de nombrarlo en un comentario
const importa = (t, base) => new RegExp(`(from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)['"\`][^'"\`]*${esc(base)}['"\`]`).test(t);
const duenoHoy = (f) => execFileSync('node', [path.join(raiz, 'scripts/carriles.mjs'), 'de', f], { cwd: raiz, encoding: 'utf8' }).trim().replace(/^.*? → /, '').split(' · ')[0];
console.log(`POBLACION | ${todos.length} ficheros de scripts/ leidos | ${sueltos.size} solo fila general | ${areaDe.size} con area de ticket creador`);
// control positivo: _navegador.mjs tiene que salir con muchos importadores
const ctrl = todos.filter((g) => g !== 'scripts/_navegador.mjs' && importa(texto.get(g), '_navegador.mjs')).length;
console.log(`CONTROL POSITIVO | _navegador.mjs lo importan ${ctrl} scripts ${ctrl > 20 ? '(ve)' : '-> CIEGO'}`);
if (ctrl <= 20) process.exit(2);
const cache = new Map();
for (const [f, a] of [...areaDe].sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]))) {
  const base = path.basename(f);
  const imps = todos.filter((g) => g !== f && importa(texto.get(g), base));
  const solo = todos.filter((g) => g !== f && !imps.includes(g) && nombra(texto.get(g), base));
  const de = (g) => { if (areaDe.has(g)) return areaDe.get(g); if (sueltos.has(g)) return 'SIN-FILA'; if (!cache.has(g)) cache.set(g, duenoHoy(g)); return cache.get(g); };
  const lista = imps.map((g) => `${path.basename(g)}[${de(g)}]`);
  const ajenos = imps.filter((g) => de(g).toLowerCase() !== a);
  console.log(`${a}\t${f.replace('scripts/', '')}\timporta: ${imps.length}${lista.length ? ' ' + lista.join(' ') : ''}\tsolo-lo-nombra: ${solo.length}\t${imps.length === 0 ? 'NADIE-LO-IMPORTA' : ajenos.length === 0 ? 'TODOS-DEL-MISMO' : 'HAY-AJENOS:' + ajenos.length}`);
}
