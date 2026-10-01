#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/perdidas.mjs
//
// Sobre lo que deja `analizar-logs.mjs`, describe las PÉRDIDAS de «build + tests»:
//
//  A · MISMO ÁRBOL. Para cada job de un árbol probado más de una vez, lo que le falta respecto a
//      un hermano del mismo árbol: cuántos casos, con qué veredicto estaban en el hermano, si
//      forman un BLOQUE seguido, de qué fichero son y si el bloque es la cola del fichero.
//  B · LA LÍNEA DE MAIN. Para cada job de `push` a main, los casos que traen los vecinos de
//      antes Y de después y él no. No exige árbol repetido, así que cubre toda la semana; es una
//      cota POR DEBAJO (si un vecino también perdió ese caso, no se ve).
//
//   node perdidas.mjs <carpeta> <raíz del repo, para atribuir nombres a ficheros de tests/>
//
// 🔴 El emparejado de A es un recorrido en paralelo de las dos listas. Lleva su control: al acabar,
// TODOS los casos del job que pierde tienen que haberse encontrado, en orden, en el hermano. Si
// no, ese par se declara «orden distinto» y no se usa para hablar de bloques.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [carpeta, raiz] = process.argv.slice(2);
if (!carpeta || !raiz) { console.error('uso: node perdidas.mjs <carpeta> <raíz del repo>'); process.exit(2); }

const L = fs.readFileSync(path.join(carpeta, 'medidos.tsv'), 'utf8').split('\n').filter(Boolean);
const cab = L.shift().split('\t');
const jobs = L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v]))).filter((j) => j.tests !== '');
const lista = (job) => fs.readFileSync(path.join(carpeta, 'casos', `${job}.txt`), 'utf8').split('\n').filter(Boolean).map((l) => { const [estado, nivel, ...r] = l.split('\t'); return { estado, nivel, nombre: r.join('\t') }; });
const verde = (j) => j.fail === '0' && j.cancelled === '0';

// ── nombre → fichero, leyendo tests/ ───────────────────────────────────────────────────────
const deFichero = new Map(); const ordenEnFichero = new Map();
const dirTests = path.join(raiz, 'tests');
const ficherosTest = fs.readdirSync(dirTests).filter((f) => f.endsWith('.test.mjs'));
for (const f of ficherosTest) {
  const src = fs.readFileSync(path.join(dirTests, f), 'utf8');
  const re = /(?:^|[\s;])(?:test|it)(?:\.\w+)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m; let n = 0;
  while ((m = re.exec(src))) {
    const nombre = m[2].replace(/\\(['"`\\])/g, '$1');
    n++;
    if (!deFichero.has(nombre)) deFichero.set(nombre, new Set());
    deFichero.get(nombre).add(f);
    ordenEnFichero.set(`${f}\t${nombre}`, n);
  }
  ordenEnFichero.set(`${f}\t#total`, n);
}
const ficheroDe = (nombre) => { const s = deFichero.get(nombre); return s && s.size === 1 ? [...s][0] : s ? 'AMBIGUO' : 'SIN-LOCALIZAR'; };
console.log(`ATRIBUCIÓN: ${ficherosTest.length} ficheros de tests/ leídos en ${raiz} · ${deFichero.size} nombres literales distintos`);

// ── A · mismo árbol ────────────────────────────────────────────────────────────────────────
const grupos = new Map();
for (const j of jobs) { if (!grupos.has(j.arbol)) grupos.set(j.arbol, []); grupos.get(j.arbol).push(j); }
const repetidos = [...grupos.values()].filter((g) => g.length > 1);
const eventos = []; let ordenDistinto = 0;
for (const g of repetidos) {
  const listas = g.map((j) => lista(j.job));
  for (let a = 0; a < g.length; a++) {
    // el hermano de referencia: el que MÁS casos trae de los otros
    let ref = -1; for (let b = 0; b < g.length; b++) if (b !== a && (ref < 0 || listas[b].length > listas[ref].length)) ref = b;
    const A = listas[a]; const R = listas[ref];
    let p = 0; const faltan = [];
    for (let i = 0; i < R.length; i++) { if (p < A.length && A[p].nombre === R[i].nombre) p++; else faltan.push(i); }
    if (p !== A.length) {
      // puede ser que a éste también le sobre algo (el hermano perdió otra cosa): se reintenta
      // contando sólo lo que NO está en A por multiplicidad, y se marca que el orden no sirvió.
      const cuenta = new Map(); for (const x of A) cuenta.set(x.nombre, (cuenta.get(x.nombre) || 0) + 1);
      const f2 = []; for (let i = 0; i < R.length; i++) { const c = cuenta.get(R[i].nombre) || 0; if (c > 0) cuenta.set(R[i].nombre, c - 1); else f2.push(i); }
      if (f2.length) { ordenDistinto++; eventos.push({ j: g[a], ref: g[ref], idx: f2, R, porOrden: false }); }
      continue;
    }
    if (faltan.length) eventos.push({ j: g[a], ref: g[ref], idx: faltan, R, porOrden: true });
  }
}
const porFichero = new Map(); const estados = new Map(); let bloques = 0; let colas = 0; let cabezas = 0; let enteros = 0; let medios = 0; let sinSituar = 0;
const filas = [];
for (const e of eventos) {
  // bloques seguidos de índices
  const runs = []; for (const i of e.idx) { if (runs.length && runs.at(-1).at(-1) === i - 1) runs.at(-1).push(i); else runs.push([i]); }
  for (const r of runs) {
    bloques++;
    const fich = new Set(r.map((i) => ficheroDe(e.R[i].nombre)));
    for (const i of r) estados.set(e.R[i].estado, (estados.get(e.R[i].estado) || 0) + 1);
    const f = [...fich].filter((x) => x !== 'SIN-LOCALIZAR' && x !== 'AMBIGUO');
    const nombreF = f.length === 1 ? f[0] : f.length === 0 ? [...fich][0] : 'VARIOS:' + f.join('+');
    if (!porFichero.has(nombreF)) porFichero.set(nombreF, { jobs: new Set(), casos: 0, verdes: new Set() });
    const pf = porFichero.get(nombreF); pf.jobs.add(e.j.job); pf.casos += r.length; if (verde(e.j)) pf.verdes.add(e.j.job);
    // posición: ¿el caso de ANTES y el de DESPUÉS del bloque son del mismo fichero?
    let pos = 'sin situar';
    if (f.length === 1) {
      const antes = r[0] > 0 ? ficheroDe(e.R[r[0] - 1].nombre) : 'INICIO';
      const despues = r.at(-1) + 1 < e.R.length ? ficheroDe(e.R[r.at(-1) + 1].nombre) : 'FIN';
      const mismoAntes = antes === f[0]; const mismoDespues = despues === f[0];
      pos = mismoAntes && !mismoDespues ? 'cola' : !mismoAntes && mismoDespues ? 'cabeza' : mismoAntes && mismoDespues ? 'medio' : 'fichero entero';
    }
    if (pos === 'cola') colas++; else if (pos === 'cabeza') cabezas++; else if (pos === 'medio') medios++; else if (pos === 'fichero entero') enteros++; else sinSituar++;
    filas.push([e.j.job, e.j.run, e.j.intento, e.j.evento, e.j.conclusion, e.j.empezo, e.j.tests, e.ref.job, e.ref.tests, r.length, nombreF, pos, e.porOrden ? 'orden' : 'multiplicidad'].join('\t'));
  }
}
fs.writeFileSync(path.join(carpeta, 'perdidas-mismo-arbol.tsv'), ['job\trun\tintento\tevento\tconclusion\tempezo\ttests\thermano\ttests_hermano\tcasos_del_bloque\tfichero\tposicion\tmetodo', ...filas].join('\n') + '\n');

const jobsEnGrupos = repetidos.reduce((s, g) => s + g.length, 0);
const jobsQuePierden = new Set(eventos.map((e) => e.j.job));
const verdesQuePierden = new Set(eventos.filter((e) => verde(e.j)).map((e) => e.j.job));
const pushQuePierden = new Set(eventos.filter((e) => e.j.evento === 'push').map((e) => e.j.job));
const pushVerdes = new Set(eventos.filter((e) => e.j.evento === 'push' && verde(e.j)).map((e) => e.j.job));
const tam = eventos.map((e) => e.idx.length).sort((a, b) => a - b);
console.log(`\nA · MISMO ÁRBOL`);
console.log(`  POBLACIÓN: ${repetidos.length} árboles probados más de una vez · ${jobsEnGrupos} jobs · de ellos verdes ${repetidos.flat().filter(verde).length} · de push a main ${repetidos.flat().filter((j) => j.evento === 'push').length}`);
console.log(`  jobs a los que les faltan casos que su hermano sí trae: ${jobsQuePierden.size} de ${jobsEnGrupos} (${(100 * jobsQuePierden.size / jobsEnGrupos).toFixed(0)} %)`);
console.log(`    · de ellos, VERDES (fail 0): ${verdesQuePierden.size}`);
console.log(`    · de ellos, de push a main: ${pushQuePierden.size} (verdes ${pushVerdes.size})`);
console.log(`  casos perdidos por job: mín ${tam[0]} · mediana ${tam[Math.floor(tam.length / 2)]} · máx ${tam.at(-1)} · total ${tam.reduce((s, v) => s + v, 0)}`);
console.log(`  veredicto que tenían en el hermano los casos perdidos: ${[...estados.entries()].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  bloques seguidos: ${bloques} · cola del fichero ${colas} · en medio ${medios} · cabeza ${cabezas} · fichero entero ${enteros} · sin situar ${sinSituar}`);
console.log(`  pares emparejados por orden: ${eventos.filter((e) => e.porOrden).length} · por multiplicidad (el orden no bastó): ${ordenDistinto}`);
console.log(`  ficheros (jobs · verdes · casos):`);
for (const [f, v] of [...porFichero.entries()].sort((a, b) => b[1].jobs.size - a[1].jobs.size)) console.log(`     ${String(v.jobs.size).padStart(3)} · ${String(v.verdes.size).padStart(3)} · ${String(v.casos).padStart(4)}  ${f}`);

// ── B · la línea de main ───────────────────────────────────────────────────────────────────
let orden = [];
try { orden = execFileSync('git', ['rev-list', '--first-parent', '--reverse', 'origin/main'], { cwd: raiz, maxBuffer: 64 * 1024 * 1024 }).toString().split('\n').filter(Boolean); } catch { /* sin git no hay B */ }
const pos = new Map(orden.map((c, i) => [c, i]));
const dePush = jobs.filter((j) => j.evento === 'push' && pos.has(j.probado));
// un job por commit: el que más casos trae (un reintento no es un commit nuevo)
const porCommit = new Map();
for (const j of dePush) { const p = porCommit.get(j.probado); if (!p || Number(j.tests) > Number(p.tests)) porCommit.set(j.probado, j); }
const linea = [...porCommit.values()].sort((a, b) => pos.get(a.probado) - pos.get(b.probado));
const multis = linea.map((j) => { const m = new Map(); for (const x of lista(j.job)) m.set(x.nombre, (m.get(x.nombre) || 0) + 1); return m; });
const V = 2; let conPerdida = 0; let conPerdidaVerde = 0; let medibles = 0; const filasB = []; const porFicheroB = new Map();
for (let k = V; k < linea.length - V; k++) {
  medibles++;
  const perdidos = [];
  const antes = new Map(); const despues = new Map();
  for (let d = 1; d <= V; d++) { for (const [n, c] of multis[k - d]) antes.set(n, Math.max(antes.get(n) || 0, c)); for (const [n, c] of multis[k + d]) despues.set(n, Math.max(despues.get(n) || 0, c)); }
  for (const [n, c] of antes) { const esperado = Math.min(c, despues.get(n) || 0); const tengo = multis[k].get(n) || 0; if (tengo < esperado) perdidos.push([n, esperado - tengo]); }
  const total = perdidos.reduce((s, [, c]) => s + c, 0);
  if (total) {
    conPerdida++; if (verde(linea[k])) conPerdidaVerde++;
    const fs2 = new Map(); for (const [n, c] of perdidos) { const f = ficheroDe(n); fs2.set(f, (fs2.get(f) || 0) + c); }
    for (const f of fs2.keys()) porFicheroB.set(f, (porFicheroB.get(f) || 0) + 1);
    filasB.push([linea[k].job, linea[k].run, linea[k].probado, linea[k].empezo, linea[k].conclusion, linea[k].tests, total, [...fs2.entries()].map(([f, c]) => `${f}×${c}`).join(' ')].join('\t'));
  }
}
fs.writeFileSync(path.join(carpeta, 'perdidas-linea-de-main.tsv'), ['job\trun\tcommit\tempezo\tconclusion\ttests\tperdidos\tficheros', ...filasB].join('\n') + '\n');
console.log(`\nB · LA LÍNEA DE MAIN (casos que traen los ${V} commits de antes Y los ${V} de después, y éste no)`);
console.log(`  POBLACIÓN: ${dePush.length} jobs de push con resumen · ${linea.length} commits de main distintos · medibles (con ${V} vecinos a cada lado) ${medibles}`);
console.log(`  commits de main cuyo «build + tests» perdió casos: ${conPerdida} de ${medibles} (${medibles ? (100 * conPerdida / medibles).toFixed(0) : '—'} %) · de ellos verdes: ${conPerdidaVerde}`);
console.log(`  ficheros (en cuántos commits):`);
for (const [f, c] of [...porFicheroB.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${String(c).padStart(3)}  ${f}`);
console.log('EXIT=0');
