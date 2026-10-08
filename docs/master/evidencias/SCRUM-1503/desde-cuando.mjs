// docs/master/evidencias/SCRUM-1503/desde-cuando.mjs — SCRUM-1503
//
// ③ ¿DESDE CUÁNDO? Tres mediciones, las tres sobre git y sin tocar el árbol:
//
//   a) ¿El lector de la herramienta ha cambiado alguna vez? Se compara el BLOB de
//      `scripts/_tests-que-cubren.mjs` en cada commit que lo toca con el de HEAD.
//   b) Los ficheros que hoy listan sin dejar rastro (columna `lista_quien` de la población ① del
//      cruce): su versión DEL DÍA EN QUE NACIÓ la herramienta se pasa por el lector. Si el blob de
//      (a) es el mismo, es ejecutar la herramienta de entonces sobre los tests de entonces.
//   c) Las otras dos causas (las que NO son «el caminante invocado en el sitio»), cada una con su
//      variante fabricada en memoria: si al cambiar SÓLO eso el lector ve, la causa es ésa.
//
//   node docs/master/evidencias/SCRUM-1503/desde-cuando.mjs [<por-test.tsv>]
//
// Aviso: `leerFuente` comprueba contra el disco de HOY si una ruta escrita existe. Para (b) eso
// sólo puede QUITAR rastro a un directorio que existiera entonces y hoy no; se dice si pasa.
// Primera línea: población. Última: EXIT.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leerFuente } from '../../../../scripts/_tests-que-cubren.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const tsv = process.argv[2] || path.join(AQUI, 'por-test.tsv');
const LECTOR = 'scripts/_tests-que-cubren.mjs';
const git = (args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
const gitO = (args) => { try { return git(args); } catch { return null; } };

const [cab, ...lineas] = fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean);
const col = Object.fromEntries(cab.split('\t').map((c, i) => [c, i]));
const ciegos = lineas.map((l) => l.split('\t')).filter((c) => Number(c[col.ficheros_ciegos]) > 0);
const listan = [...new Set(ciegos.flatMap((c) => c[col.lista_quien].split(' ').filter(Boolean)))].sort();

const commits = git(['log', '--format=%H %cI', '--', LECTOR]).trim().split('\n').filter(Boolean).map((l) => l.split(' '));
console.log(`POBLACION: ${commits.length} commits tocan ${LECTOR} · ${ciegos.length} tests en la poblacion ① · ${listan.length} ficheros que listan por ellos`);

// ── a ────────────────────────────────────────────────────────────────────────────────────────
const blobHoy = git(['rev-parse', `HEAD:${LECTOR}`]).trim();
console.log('\n── a) el lector, commit a commit');
let distintos = 0;
for (const [sha, fecha] of commits) {
  const blob = git(['rev-parse', `${sha}:${LECTOR}`]).trim();
  if (blob !== blobHoy) distintos += 1;
  console.log(`   ${sha.slice(0, 9)} · ${fecha} · blob ${blob.slice(0, 12)} · ${blob === blobHoy ? 'IDENTICO al de hoy' : 'DISTINTO del de hoy'}`);
}
const nacimiento = commits[commits.length - 1];
const antes = gitO(['rev-parse', `${nacimiento[0]}~1:${LECTOR}`]);
console.log(`   el commit anterior al primero ${antes ? 'YA TENIA el fichero (mal: no es el nacimiento)' : 'NO tiene el fichero: el primero es su nacimiento'}`);

// ── b ────────────────────────────────────────────────────────────────────────────────────────
console.log(`\n── b) los ${listan.length} ficheros que listan, en su version del nacimiento (${nacimiento[0].slice(0, 9)}, ${nacimiento[1]})`);
let existian = 0;
let sinRastroEntonces = 0;
let sinRastroHoy = 0;
const firma = (d) => `listados ${d.listados.size} · no-se ${d.noSe.length}`;
for (const rel of listan) {
  const hoy = leerFuente(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), RAIZ);
  if (!hoy.listados.size && !hoy.noSe.length) sinRastroHoy += 1;
  const viejo = gitO(['show', `${nacimiento[0]}:${rel}`]);
  if (viejo === null) { console.log(`   NO EXISTIA · ${rel} · hoy: ${firma(hoy)}`); continue; }
  existian += 1;
  const d = leerFuente(rel, viejo, RAIZ);
  const mudo = !d.listados.size && !d.noSe.length;
  if (mudo) sinRastroEntonces += 1;
  console.log(`   ${mudo ? 'SIN RASTRO' : 'con rastro'} · ${rel} · entonces: ${firma(d)} · hoy: ${firma(hoy)}`);
}
console.log(`   existian al nacer la herramienta: ${existian} de ${listan.length} · sin rastro entonces: ${sinRastroEntonces} · sin rastro hoy: ${sinRastroHoy}`);

// ── c ────────────────────────────────────────────────────────────────────────────────────────
console.log('\n── c) las otras dos causas, cada una con su variante en memoria');
const variar = (rel, de, a, etiqueta) => {
  const original = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const veces = original.split(de).length - 1;
  const nuevo = original.replace(de, a);
  const d0 = leerFuente(rel, original, RAIZ);
  const d1 = leerFuente(rel, nuevo, RAIZ);
  const gana = [...d1.listados].filter((x) => !d0.listados.has(x));
  console.log(`   ${etiqueta}`);
  console.log(`     ${rel} · «${de}» aparece ${veces} vez · el texto cambia: ${nuevo !== original}`);
  console.log(`     tal cual: ${firma(d0)} [${[...d0.listados].join(', ')}] · variado: ${firma(d1)} [${[...d1.listados].join(', ')}] · gana listados: ${gana.join(', ') || '(ninguno)'} · gana no-se: ${d1.noSe.length - d0.noSe.length}`);
  return veces === 1 && nuevo !== original && (gana.length > 0 || d1.noSe.length > d0.noSe.length);
};
const c1 = variar('tests/scrum164-gate-por-campo.test.mjs', 'dirs.forEach(walk);', 'for (const uno of dirs) walk(uno);',
  'el caminante se pasa como VALOR (`dirs.forEach(walk)`): no hay llamada por nombre que resolver');
const c2 = variar('scripts/_cobertura-visual.mjs', "const dir = path.join(raiz, 'tests');\n  if (!fs.existsSync(dir)) return new Set();\n  const fuera = new Set();\n  for (const f of fs.readdirSync(dir)) {",
  "const dirDeTests = path.join(raiz, 'tests');\n  if (!fs.existsSync(dirDeTests)) return new Set();\n  const fuera = new Set();\n  for (const f of fs.readdirSync(dirDeTests)) {",
  'dos `const dir` en el mismo fichero, en funciones distintas: el lector resuelve el nombre SIN ambito y se queda con la primera');

const salida = distintos === 0 && !antes && c1 && c2 && ciegos.length ? 0 : 2;
console.log(`\nlector identico en todos sus commits: ${distintos === 0} · variante 1 gana: ${c1} · variante 2 gana: ${c2}`);
console.log(`EXIT=${salida}`);
process.exit(salida);
