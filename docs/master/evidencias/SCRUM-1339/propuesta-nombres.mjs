#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/propuesta-nombres.mjs
//
// MIDE la señal que el registro propone, ANTES de proponerla. No la construye: es una sonda.
//
// La señal: «todo test que el árbol DECLARA con nombre literal tiene que aparecer en lo que la
// tanda registró». Es comparar CONJUNTOS (nombres), no un recuento con holgura.
//
// Dos preguntas, sobre los árboles probados más de una vez (mismo-arbol.tsv):
//   ① FALSOS POSITIVOS · en los jobs a los que NO les falta nada respecto a su hermano, ¿cuántos
//      nombres declarados no aparecen? (son los que habría que explicar uno a uno antes de
//      poder exigir «cero»).
//   ② PODER · de los jobs que SÍ perdieron casos, ¿en cuántos habría saltado, y cuántos de los
//      casos perdidos habría nombrado?
//
// Los nombres se sacan por AST con el compilador de TypeScript, el mismo motor que usa el censo
// de la casa (`tests/_poblacion-de-tests.mjs`, SCRUM-708): llamadas `test(…)` / `it(…)` cuyo
// primer argumento es una cadena o una plantilla SIN sustituciones. El árbol de cada commit se
// lee con `git cat-file`, sin tocar el árbol de trabajo.
//
//   node propuesta-nombres.mjs <carpeta> <raíz del repo>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const [carpeta, raiz] = process.argv.slice(2);
if (!carpeta || !raiz) { console.error('uso: node propuesta-nombres.mjs <carpeta> <raíz del repo>'); process.exit(2); }
const git = (args, input) => execFileSync('git', args, { cwd: raiz, input, maxBuffer: 1024 * 1024 * 1024 });

function declarados(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const literales = []; let total = 0;
  (function recorrer(x) {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && ['test', 'it'].includes(x.expression.text)) {
      total++;
      const a = x.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) literales.push(a.text);
    }
    ts.forEachChild(x, recorrer);
  })(sf);
  return { literales, total };
}

/** nombre literal → fichero(s), para el árbol de UN commit. */
function declaradosDelCommit(commit) {
  const rutas = git(['ls-tree', '-r', '--name-only', commit, 'tests/']).toString('utf8').split('\n').filter((r) => /^tests\/[^/]+\.test\.mjs$/.test(r));
  const salida = git(['cat-file', '--batch'], rutas.map((r) => `${commit}:${r}`).join('\n') + '\n');
  const mapa = new Map(); let p = 0; let total = 0;
  for (const r of rutas) {
    const fin = salida.indexOf(10, p);
    const cabecera = salida.subarray(p, fin).toString('utf8').split(' ');
    const n = Number(cabecera[2]);
    if (cabecera[1] !== 'blob' || !Number.isFinite(n)) throw new Error(`cat-file: cabecera inesperada para ${r}: ${cabecera.join(' ')}`);
    const d = declarados(salida.subarray(fin + 1, fin + 1 + n).toString('utf8'), r);
    total += d.total;
    for (const nombre of d.literales) { if (!mapa.has(nombre)) mapa.set(nombre, []); mapa.get(nombre).push(path.basename(r)); }
    p = fin + 1 + n + 1;
  }
  return { mapa, ficheros: rutas.length, total };
}

const leeTsv = (f) => { const L = fs.readFileSync(path.join(carpeta, f), 'utf8').split('\n').filter(Boolean); const c = L.shift().split('\t'); return L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [c[i], v]))); };
const medidos = new Map(leeTsv('medidos.tsv').map((j) => [j.job, j]));
const grupos = new Map();
for (const f of leeTsv('mismo-arbol.tsv')) { if (!grupos.has(f.arbol)) grupos.set(f.arbol, []); grupos.get(f.arbol).push(f); }
const nombresDe = (job) => { const s = new Map(); for (const l of fs.readFileSync(path.join(carpeta, 'casos', `${job}.txt`), 'utf8').split('\n')) { if (!l) continue; const n = l.split('\t').slice(2).join('\t'); s.set(n, (s.get(n) || 0) + 1); } return s; };
const existe = (c) => { try { execFileSync('git', ['cat-file', '-e', `${c}^{commit}`], { cwd: raiz, stdio: 'ignore' }); return true; } catch { return false; } };

let arbolesMedidos = 0; let sinCommitLocal = 0;
const fp = []; // por job completo: cuántos declarados no aparecen
const noAparecen = new Map(); // nombre → en cuántos jobs completos falta
let jobsCompletos = 0; let jobsConPerdida = 0; let cazados = 0; let casosPerdidos = 0; let casosNombrados = 0;
const noCazados = [];
let literalesUltimo = 0; let totalUltimo = 0; let ficherosUltimo = 0;
for (const [arbol, g] of grupos) {
  const commit = g.map((f) => medidos.get(f.job).probado).find(existe);
  if (!commit) { sinCommitLocal++; continue; }
  arbolesMedidos++;
  const d = declaradosDelCommit(commit);
  literalesUltimo = d.mapa.size; totalUltimo = d.total; ficherosUltimo = d.ficheros;
  const sets = g.map((f) => nombresDe(f.job));
  // lo que el árbol declara y NINGÚN job del grupo registró: no es pérdida, es un nombre que no se registra
  const nunca = [...d.mapa.keys()].filter((n) => sets.every((s) => !s.has(n)));
  g.forEach((f, i) => {
    const faltanDeclarados = [...d.mapa.keys()].filter((n) => !sets[i].has(n));
    if (Number(f.faltan) === 0) {
      jobsCompletos++; fp.push(faltanDeclarados.length);
      for (const n of faltanDeclarados) noAparecen.set(n, (noAparecen.get(n) || 0) + 1);
    } else {
      jobsConPerdida++;
      // habría saltado si falta algún declarado que SÍ registra otro job del mismo árbol
      const nombrados = faltanDeclarados.filter((n) => !nunca.includes(n));
      casosPerdidos += Number(f.faltan); casosNombrados += nombrados.length;
      if (nombrados.length) cazados++; else noCazados.push(`${f.job} (le faltan ${f.faltan})`);
    }
  });
}
fp.sort((a, b) => a - b);
console.log(`POBLACIÓN: ${grupos.size} árboles probados más de una vez · con un commit legible en local: ${arbolesMedidos} · sin él: ${sinCommitLocal}`);
console.log(`  último árbol leído: ${ficherosUltimo} ficheros de tests/ · ${totalUltimo} llamadas test()/it() · ${literalesUltimo} nombres literales distintos`);
console.log(`\n① FALSOS POSITIVOS — jobs a los que NO les falta nada respecto a su hermano: ${jobsCompletos}`);
console.log(`   nombres declarados que no aparecen en su registro: mín ${fp[0]} · mediana ${fp[fp.length >> 1]} · máx ${fp.at(-1)}`);
console.log(`   jobs «completos» a los que aun así les falta algún declarado: ${fp.filter((x) => x > 0).length} de ${jobsCompletos}`);
console.log(`   nombres distintos que faltan en algún job completo: ${noAparecen.size}`);
for (const [n, c] of [...noAparecen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`     ${String(c).padStart(3)}×  ${n.slice(0, 140)}`);
console.log(`\n② PODER — jobs que perdieron casos respecto a su hermano: ${jobsConPerdida}`);
console.log(`   habría saltado en ${cazados} de ${jobsConPerdida} · casos perdidos ${casosPerdidos} · de ellos nombrados por la señal ${casosNombrados}`);
if (noCazados.length) console.log(`   NO habría saltado en: ${noCazados.join(' · ')}`);
// ── ③ TODA LA LÍNEA DE MAIN, sin hermano: cada job de push contra lo que declara SU commit ──
const pushes = [...medidos.values()].filter((j) => j.evento === 'push' && j.tests !== '' && existe(j.probado));
let pushConFalta = 0; let pushVerdeConFalta = 0; const porFichero = new Map(); const filas = []; const tam = [];
for (const j of pushes) {
  const d = declaradosDelCommit(j.probado); const s = nombresDe(j.job);
  const faltan = [...d.mapa.keys()].filter((n) => !s.has(n));
  if (!faltan.length) continue;
  pushConFalta++; if (j.fail === '0' && j.cancelled === '0') pushVerdeConFalta++; tam.push(faltan.length);
  const fs3 = new Map(); for (const n of faltan) for (const f of d.mapa.get(n)) fs3.set(f, (fs3.get(f) || 0) + 1);
  for (const f of fs3.keys()) porFichero.set(f, (porFichero.get(f) || 0) + 1);
  filas.push([j.job, j.run, j.probado, j.empezo, j.conclusion, j.tests, d.total, faltan.length, [...fs3.entries()].map(([f, c]) => f + '×' + c).join(' ')].join('\t'));
}
fs.writeFileSync(path.join(carpeta, 'declarados-que-faltan-en-main.tsv'), ['job\trun\tcommit\tempezo\tconclusion\ttests\tllamadas_declaradas\tliterales_que_faltan\tficheros', ...filas].join('\n') + '\n');
tam.sort((a, b) => a - b);
console.log(`\n③ TODA LA LÍNEA DE MAIN — jobs de push con resumen y commit en local: ${pushes.length}`);
console.log(`   con algún nombre declarado que NO aparece en su registro: ${pushConFalta} de ${pushes.length} (${(100 * pushConFalta / pushes.length).toFixed(0)} %) · de ellos verdes: ${pushVerdeConFalta}`);
if (tam.length) console.log(`   nombres que faltan por job: mín ${tam[0]} · mediana ${tam[tam.length >> 1]} · máx ${tam.at(-1)}`);
for (const [f, c] of [...porFichero.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${String(c).padStart(3)}  ${f}`);
console.log('EXIT=0');
