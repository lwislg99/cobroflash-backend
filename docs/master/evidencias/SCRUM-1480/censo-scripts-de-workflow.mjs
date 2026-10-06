// Censo de consulta (S0, 6-oct-2026): qué ficheros de scripts/ EJECUTA un workflow de
// .github/workflows/ (no los que sólo nombra en un comentario), con su cierre por imports, y
// cuáles no tienen fila propia en dos-equipos.md §3.3. Sólo LEE.
// Uso: node censo-scripts-de-workflow.mjs <raíz del árbol>
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const raiz = process.argv[2];
if (!raiz || !existsSync(path.join(raiz, 'package.json'))) { console.error('CIEGO: falta la raíz del árbol'); process.exit(2); }
const require = createRequire(path.join(raiz, 'package.json'));
const ts = require('typescript');
const git = (...a) => execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });

const sha = git('rev-parse', 'HEAD').trim();
const rastreados = new Set(git('ls-files', 'scripts').split('\n').filter(Boolean));
const workflows = git('ls-files', '.github/workflows').split('\n').filter(Boolean);
const pkg = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));

const RUTA = /scripts\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts|sh|ps1|py)/g;
const NPM = /npm (?:run|run-script)(?: -s| --silent)? ([A-Za-z0-9:_-]+)/g;

// 1 · Lo que cada workflow EJECUTA: líneas que no son comentario, rutas directas y `npm run X`.
const directo = new Map(); // script -> Set(de dónde)
const soloComentario = new Map();
const anota = (mapa, s, de) => { if (!mapa.has(s)) mapa.set(s, new Set()); mapa.get(s).add(de); };
const npmVistos = new Set();
function deComando(texto, de, hondo = 0) {
  for (const m of texto.matchAll(RUTA)) anota(directo, m[0], de);
  for (const m of texto.matchAll(NPM)) {
    const cmd = pkg.scripts?.[m[1]];
    npmVistos.add(`${de} → npm run ${m[1]}${cmd ? ` = ${cmd.slice(0, 90)}` : '  (NO EXISTE en package.json)'}`);
    if (cmd && hondo < 4) deComando(cmd, `${de} › npm run ${m[1]}`, hondo + 1);
  }
  if (/\bnpm test\b/.test(texto) && pkg.scripts?.test && hondo < 4) {
    npmVistos.add(`${de} → npm test = ${pkg.scripts.test.slice(0, 90)}`);
    deComando(pkg.scripts.test, `${de} › npm test`, hondo + 1);
  }
}
let lineasYml = 0, lineasComentario = 0;
for (const w of workflows) {
  const corto = w.replace('.github/workflows/', '');
  for (const linea of readFileSync(path.join(raiz, w), 'utf8').split(/\r?\n/)) {
    lineasYml++;
    if (/^\s*#/.test(linea)) { lineasComentario++; for (const m of linea.matchAll(RUTA)) anota(soloComentario, m[0], corto); continue; }
    deComando(linea, corto);
  }
}

// 2 · Cierre transitivo SÓLO por imports (AST de TypeScript). Una ruta escrita en una cadena no
//     cuenta: puede ser una lista, un mensaje o un censo (contar texto no es contar cosas).
const cierre = new Map();
const cola = [];
for (const [s, de] of directo) { if (rastreados.has(s)) { cierre.set(s, [...de].join(' | ')); cola.push(s); } }
const noRastreados = [...directo.keys()].filter((s) => !rastreados.has(s));
let leidos = 0;
while (cola.length) {
  const f = cola.shift();
  if (!/\.(mjs|cjs|js|ts)$/.test(f)) continue;
  const info = ts.preProcessFile(readFileSync(path.join(raiz, f), 'utf8'), true, true); leidos++;
  for (const imp of info.importedFiles) {
    if (!imp.fileName.startsWith('.')) continue;
    const destino = path.posix.normalize(path.posix.join(path.posix.dirname(f), imp.fileName));
    const cand = [destino, destino + '.mjs', destino + '.js'].find((c) => rastreados.has(c));
    if (cand && !cierre.has(cand)) { cierre.set(cand, `importado por ${f.replace('scripts/', '')}`); cola.push(cand); }
  }
}

// 3 · Fila propia en §3.3, tal como está HOY en este árbol.
function fila(f) {
  if (f.startsWith('scripts/equipo/')) return 'S5 · scripts/equipo/**';
  if (f.startsWith('scripts/qa/')) return 'S3 · scripts/qa/**';
  if (/^scripts\/_suelo-/.test(f)) return 'S3 · scripts/_suelo-*';
  if (f === 'scripts/vigia-sesiones-jv.mjs') return 'S5 · fila propia';
  return null;
}

// 4 · Historia de cada fichero: primer commit, cuántos, y los tickets de sus asuntos.
function historia(f) {
  const SEP = String.fromCharCode(31);
  const filas = git('log', '--follow', `--format=%h${SEP}%cs${SEP}%an${SEP}%s`, '--', f).split('\n').filter(Boolean).map((l) => l.split(SEP));
  const propios = filas.filter((x) => !/^Merge /.test(x[3]));
  const tickets = new Map();
  for (const x of propios) for (const m of x[3].matchAll(/SCRUM-(\d+)/g)) tickets.set(m[1], (tickets.get(m[1]) || 0) + 1);
  const autores = new Map();
  for (const x of propios) autores.set(x[2], (autores.get(x[2]) || 0) + 1);
  const primero = propios[propios.length - 1];
  const ultimo = propios[0];
  return { n: propios.length, primero, ultimo, tickets, autores };
}

console.log(`POBLACIÓN · árbol ${sha} · ${rastreados.size} ficheros rastreados en scripts/ · ${workflows.length} workflows · ${lineasYml} líneas de yml, ${lineasComentario} de ellas comentario (no cuentan como ejecución)`);
console.log(`CONTROL POSITIVO · ¿ve scripts/vigia-pasada.mjs (vigia-atascados.yml:210 lo corre)? ${directo.has('scripts/vigia-pasada.mjs') ? 'SÍ' : 'NO → CIEGO'}`);
console.log(`CONTROL NEGATIVO · ¿deja fuera scripts/_evidencia-tanda.mjs (ci.yml sólo lo nombra en un comentario)? ${!directo.has('scripts/_evidencia-tanda.mjs') ? 'SÍ' : 'NO → cuenta comentarios'}`);
console.log(`\nnpm vistos en líneas ejecutables: ${npmVistos.size}`);
for (const l of [...npmVistos].sort()) console.log('  ' + l);
if (noRastreados.length) { console.log(`\nNOMBRADOS en una línea ejecutable pero NO rastreados (${noRastreados.length}):`); for (const s of noRastreados.sort()) console.log(`  ${s}  ← ${[...directo.get(s)].join(' | ')}`); }

const todos = [...cierre.keys()].sort();
const D = todos.filter((f) => directo.has(f));
const T = todos.filter((f) => !directo.has(f));
const resumen = (l) => `${l.length} (con fila ${l.filter(fila).length} · SIN fila ${l.filter((f) => !fila(f)).length})`;
console.log(`\nRECUENTO`);
console.log(`  A · los EJECUTA un workflow (ruta o npm run en una línea no comentada): ${resumen(D)}`);
console.log(`  B · sólo llegan por import desde los de A: ${resumen(T)}`);
console.log(`  A + B: ${resumen(todos)} · ficheros leídos por AST ${leidos}`);

console.log('\n--- A · SIN FILA PROPIA ---');
const ticketsTodos = new Set();
for (const f of D.filter((x) => !fila(x))) {
  const h = historia(f);
  for (const t of h.tickets.keys()) ticketsTodos.add(t);
  const tk = [...h.tickets].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(' ');
  const au = [...h.autores].map(([a, n]) => `${a}×${n}`).join(', ');
  console.log(`${f}\n    lo ejecuta: ${cierre.get(f)}\n    nace ${h.primero[1]} «${h.primero[3].slice(0, 70)}» · ${h.n} commits · último ${h.ultimo[1]}\n    tickets: ${tk}\n    autores: ${au}`);
}
console.log('\n--- A · CON FILA PROPIA ---');
for (const f of D.filter(fila)) console.log(`${f}  [${fila(f)}]  ← ${cierre.get(f)}`);
console.log('\n--- B · SIN FILA PROPIA ---');
for (const f of T.filter((x) => !fila(x))) console.log(`${f}  ← ${cierre.get(f)}`);
console.log('\n--- B · CON FILA PROPIA ---');
for (const f of T.filter(fila)) console.log(`${f}  [${fila(f)}]  ← ${cierre.get(f)}`);
const soloC = [...soloComentario.keys()].filter((s) => !cierre.has(s)).sort();
console.log(`\n--- sólo NOMBRADOS en un comentario de un yml, sin ejecutarse desde ninguno (${soloC.length}) ---`);
for (const s of soloC) console.log(`${s}  ← ${[...soloComentario.get(s)].join(' | ')}`);
console.log(`\nTICKETS de los asuntos de A sin fila (${ticketsTodos.size}): ${[...ticketsTodos].sort((a, b) => a - b).join(',')}`);
console.log('\nEXIT=0');
