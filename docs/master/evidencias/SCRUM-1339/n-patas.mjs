// docs/master/evidencias/SCRUM-1339/n-patas.mjs — SCRUM-1339n · SÓLO LECTURA.
//
// Lo que `j-logs.mjs` no dice y el encargo pide, sobre la MISMA población (la de `n-listar.mjs`):
//   ① los dos controles del día: los ciegos conocidos TIENEN que salir ciegos, y un meta-guard
//      que se sabe limpio NO puede salir ciego;
//   ② la pata independiente: ¿el MISMO blob (guard, fichero mutado e instrumento) se juzga
//      COMPLETO en otros jobs?
//   ③ cómo se reparte en el tiempo, por evento y dentro de una misma punta;
//   ④ qué otros guards ciegan en esos logs (para no cargarle a scrum859 lo que no es suyo).
//
//   node n-patas.mjs <n-datos.json> <salida de j-logs.mjs> <carpeta de logs> <repo> <positivos: jobs,por,comas> <cero: job>
//
// NO vuelve a leer qué dijo el instrumento de scrum859: eso lo toma de la LISTA de `j-logs.mjs`,
// para que haya UN lector y no dos.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [fDatos, fJ, dir, repo, positivos = '', cero = ''] = process.argv.slice(2);
if (!fDatos || !fJ || !dir || !repo) { console.error('uso: node n-patas.mjs <n-datos.json> <salida j-logs> <logs> <repo> <positivos> <cero>'); process.exit(2); }
const d = JSON.parse(fs.readFileSync(fDatos, 'utf8'));
const GUARD = 'scrum859-identidad-y-motivo-cerrado.test.mjs';
const TRES = ['tests/scrum859-identidad-y-motivo-cerrado.test.mjs', 'tests/scrum267-ancla-de-medicion.test.mjs', 'scripts/meta-guard-mutaciones.mjs'];
const git = (...a) => { try { return execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const por = (a, k) => a.reduce((o, x) => { const v = k(x); o[v] = (o[v] || 0) + 1; return o; }, {});
const pinta = (o) => Object.entries(o).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${k}: ${n}`).join(' · ');
let mal = 0;
const exige = (ok, txt) => { console.log(`${ok ? '✅' : '🔴'} ${txt}`); if (!ok) mal += 1; };

// ── La LISTA de j-logs: job → estado y marcas ────────────────────────────────────────────────
const lista = new Map();
for (const l of fs.readFileSync(fJ, 'utf8').split(/\r?\n/)) {
  const m = /^ {2}#(\d+) · (\d+) · (\S+) · (VERDE|CIEGO|ROJO|SIN VEREDICTO) · (.*) · (\S+|SIN VEREDICTO|\(no lo nombra\))$/.exec(l);
  if (m) lista.set(m[2], { pr: Number(m[1]), github: m[3], estado: m[4], resumen: m[5], marcas: m[6] });
}
const filas = d.prs.map((p) => {
  const j = p.runs[0].jobs[0];
  return { pr: p.n, run: p.run, intento: p.runs[0].intento, evento: p.evento, sha: p.sha, creado: p.runs[0].creado, job: String(j.id), ...(lista.get(String(j.id)) || { estado: 'NO ESTÁ EN LA LISTA' }) };
});
console.log(`POBLACIÓN: ${filas.length} ejecuciones del meta-guard en ${new Set(filas.map((f) => f.run)).size} runs y ${new Set(filas.map((f) => f.pr)).size} PR · de ${filas.map((f) => f.creado).sort()[0]} a ${filas.map((f) => f.creado).sort().at(-1)} · recogido ${d.recogido}`);
exige(lista.size === filas.length && filas.every((f) => f.estado !== 'NO ESTÁ EN LA LISTA'), `SUMA: las ${filas.length} ejecuciones listadas están, una a una, en la LISTA de j-logs (${lista.size} filas)`);
const juzgadas = filas.filter((f) => f.estado !== 'SIN VEREDICTO');
const ciegas = juzgadas.filter((f) => f.marcas === '✔?');
const enteras = juzgadas.filter((f) => f.marcas === '✔✔');
console.log(`  estado del job: ${pinta(por(filas, (f) => f.estado))}`);
console.log(`  ${GUARD}: ${pinta(por(filas, (f) => f.marcas ?? '(nada)'))}`);
exige(ciegas.length + enteras.length === juzgadas.length, `SUMA: ciegas (${ciegas.length}) + enteras (${enteras.length}) = con veredicto (${juzgadas.length}); no hay una tercera forma`);
console.log(`\n① TASA: scrum859 sale CIEGO en ${ciegas.length} de ${juzgadas.length} ejecuciones con veredicto = ${(100 * ciegas.length / juzgadas.length).toFixed(1)} % · sin veredicto (no cuentan ni a favor ni en contra): ${filas.length - juzgadas.length}`);

// ── ① Los controles del día ──────────────────────────────────────────────────────────────────
console.log('\nCONTROLES DEL DÍA');
for (const id of positivos.split(',').filter(Boolean)) {
  const f = filas.find((x) => x.job === id);
  exige(f?.marcas === '✔?', `POSITIVO que TIENE que salir ciego: job ${id}${f ? ` (#${f.pr}, run ${f.run})` : ''} → ${f ? `${f.estado} · ${f.marcas}` : 'NO ESTÁ EN LA POBLACIÓN'}`);
}
{
  const f = filas.find((x) => x.job === cero);
  exige(f?.marcas === '✔✔' && f?.estado === 'VERDE', `CERO que NO puede salir ciego: job ${cero}${f ? ` (#${f.pr})` : ''} → ${f ? `${f.estado} · ${f.marcas}` : 'NO ESTÁ EN LA POBLACIÓN'}`);
}
// Tamaño antes de contar: ¿algún log con veredicto es sospechosamente corto?
const peso = (f) => { try { return fs.statSync(path.join(dir, `${f.job}.log`)).size; } catch { return 0; } };
const pesos = juzgadas.map(peso).sort((a, b) => a - b);
exige(pesos[0] > 100000, `TAMAÑO: los ${juzgadas.length} logs con veredicto pesan de ${pesos[0]} a ${pesos.at(-1)} B (mediana ${pesos[pesos.length >> 1]}); los ${filas.length - juzgadas.length} sin veredicto, de ${Math.min(...filas.filter((f) => f.estado === 'SIN VEREDICTO').map(peso))} a ${Math.max(...filas.filter((f) => f.estado === 'SIN VEREDICTO').map(peso))} B`);

// ── ② La pata independiente: el mismo blob, ¿completo en otros jobs? ─────────────────────────
// CI no prueba la punta: prueba el MERGE de la punta con `main`. El blob que corrió es el de
// `main` salvo que la rama traiga una versión que `main` no ha tenido nunca.
console.log('\n② EL MISMO BLOB EN OTROS JOBS');
const historia = Object.fromEntries(TRES.map((f) => [f, new Set((git('log', '--format=%H', 'origin/main', '--', f) || '').split('\n').filter(Boolean).map((c) => git('rev-parse', `${c}:${f}`)))]));
const deMain = Object.fromEntries(TRES.map((f) => [f, git('rev-parse', `origin/main:${f}`)]));
for (const f of TRES) console.log(`  ${f}: blob de origin/main ${deMain[f]} · versiones que main ha tenido: ${historia[f].size}`);
const tocados = (git('log', '--format=%H', `${process.env.DESDE_COMMIT || '8290e27d56279a5c26b700dd7c30def2be75b933'}..origin/main`, '--', ...TRES) || '').split('\n').filter(Boolean);
exige(tocados.length === 0, `main NO ha tocado ninguno de los tres desde el merge del instrumento actual (8290e27d, #2213): ${tocados.length} commits · positivo del mismo comando sobre docs/master: ${(git('log', '--format=%H', '8290e27d56279a5c26b700dd7c30def2be75b933..origin/main', '--', 'docs/master') || '').split('\n').filter(Boolean).length} commits`);
const cache = new Map();
const blobDe = (sha) => {
  if (cache.has(sha)) return cache.get(sha);
  const v = TRES.map((f) => { const b = git('rev-parse', `${sha}:${f}`); return b === null ? 'SIN-OBJETO' : historia[f].has(b) ? deMain[f] : `PROPIO:${b}`; }).join(' ');
  cache.set(sha, v); return v;
};
for (const f of juzgadas) f.blobs = blobDe(f.sha);
const propios = juzgadas.filter((f) => /PROPIO|SIN-OBJETO/.test(f.blobs));
console.log(`  puntas distintas: ${new Set(juzgadas.map((f) => f.sha)).size} · ejecuciones cuya rama trae una versión de alguno de los tres que main no ha tenido, o cuyo commit no está en local: ${propios.length}${propios.length ? ' → ' + propios.map((f) => `#${f.pr} job ${f.job} ${f.marcas}`).join(' · ') : ''}`);
const tabla = {};
for (const f of juzgadas) { (tabla[f.blobs] ??= { '✔✔': 0, '✔?': 0 })[f.marcas] += 1; }
for (const [b, x] of Object.entries(tabla)) console.log(`  blobs [${b.split(' ').map((s) => s.slice(0, 17)).join(' ')}] → juzgado ENTERO (✔✔) en ${x['✔✔']} · CIEGO (✔?) en ${x['✔?']}`);
const mismo = tabla[TRES.map((f) => deMain[f]).join(' ')] || { '✔✔': 0, '✔?': 0 };
exige(mismo['✔✔'] > 0 && mismo['✔?'] > 0, `LA PATA: con los tres blobs de main, scrum859 sale juzgado ENTERO en ${mismo['✔✔']} ejecuciones y CIEGO en ${mismo['✔?']}`);

// ── ③ Reparto ────────────────────────────────────────────────────────────────────────────────
console.log('\n③ REPARTO');
const cruce = (k) => { const o = {}; for (const f of juzgadas) { const v = k(f); o[v] ??= [0, 0]; o[v][f.marcas === '✔?' ? 0 : 1] += 1; } return Object.entries(o).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([v, [c, n]]) => `${v}: ${c} de ${c + n}`).join(' · '); };
console.log(`  por día (UTC, creación del run), ciegas de las que tienen veredicto: ${cruce((f) => f.creado.slice(0, 10))}`);
console.log(`  por evento: ${cruce((f) => f.evento)}`);
console.log(`  por intento del run: ${cruce((f) => `intento ${f.intento}`)}`);
const porSha = {};
for (const f of juzgadas) (porSha[f.sha] ??= []).push(f);
const varias = Object.values(porSha).filter((a) => a.length > 1);
const mixtas = varias.filter((a) => new Set(a.map((f) => f.marcas)).size > 1);
console.log(`  la MISMA punta ejecutada más de una vez: ${varias.length} puntas (${varias.reduce((s, a) => s + a.length, 0)} ejecuciones) · con resultado DISTINTO entre sus ejecuciones: ${mixtas.length} · todas ciegas: ${varias.filter((a) => a.every((f) => f.marcas === '✔?')).length} · todas enteras: ${varias.filter((a) => a.every((f) => f.marcas === '✔✔')).length}`);
for (const a of mixtas) console.log(`     ${a[0].sha.slice(0, 10)} (#${a[0].pr}): ${a.map((f) => `job ${f.job} ${f.evento} intento ${f.intento} ${f.marcas}`).join(' · ')}`);
const porPr = {};
for (const f of juzgadas) (porPr[f.pr] ??= []).push(f);
const prVarias = Object.values(porPr).filter((a) => a.length > 1);
console.log(`  PR con más de una ejecución (puntas distintas incluidas): ${prVarias.length} · con las dos formas: ${prVarias.filter((a) => new Set(a.map((f) => f.marcas)).size > 1).length} · sólo ciegas: ${prVarias.filter((a) => a.every((f) => f.marcas === '✔?')).length} · sólo enteras: ${prVarias.filter((a) => a.every((f) => f.marcas === '✔✔')).length}`);
// Rachas: si fuera una avería que aparece y se queda, las ciegas irían seguidas.
const orden = [...juzgadas].sort((a, b) => (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : Number(a.job) - Number(b.job)));
let racha = 0; let maxC = 0; let cambios = 0;
orden.forEach((f, i) => { racha = f.marcas === '✔?' ? racha + 1 : 0; maxC = Math.max(maxC, racha); if (i && f.marcas !== orden[i - 1].marcas) cambios += 1; });
console.log(`  en orden de creación: ${cambios} cambios de forma entre ejecuciones vecinas · racha más larga de ciegas seguidas: ${maxC} · primera ciega ${orden.find((f) => f.marcas === '✔?')?.creado} · última ${orden.filter((f) => f.marcas === '✔?').at(-1)?.creado} · última entera ${orden.filter((f) => f.marcas === '✔✔').at(-1)?.creado}`);
console.log(`  secuencia (E entera, C ciega): ${orden.map((f) => (f.marcas === '✔?' ? 'C' : 'E')).join('')}`);

// ── ④ Qué más ciega en esos logs ─────────────────────────────────────────────────────────────
console.log('\n④ TODAS LAS MARCAS «?» Y «☠» DE LOS LOGS CON VEREDICTO, por guard');
const otros = {}; let cuadran = 0;
for (const f of juzgadas) {
  const crudo = fs.readFileSync(path.join(dir, `${f.job}.log`), 'utf8');
  const L = crudo.split(/\r?\n/).map((l) => l.slice(29).replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''));
  const mias = L.filter((l) => /^ {2}(\?|☠) /.test(l)).map((l) => /^ {2}(.) (\S+)/.exec(l));
  const dichas = /ciegas (\d+) · ficheros muertos (\d+)/.exec(f.resumen);
  if (dichas && mias.length === Number(dichas[1]) + Number(dichas[2])) cuadran += 1;
  for (const m of mias) { (otros[`${m[1]} ${m[2]}`] ??= []).push(f.pr); }
}
exige(cuadran === juzgadas.length, `SUMA: las marcas «?» y «☠» contadas aquí dan las ciegas más los muertos que dice el resumen en ${cuadran} de ${juzgadas.length} logs`);
for (const [k, v] of Object.entries(otros).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${k}: ${v.length} logs${v.length <= 12 ? ' (PR ' + v.map((n) => '#' + n).join(' ') + ')' : ''}`);
console.log(`  logs CIEGO que lo son sin que ciegue scrum859: ${juzgadas.filter((f) => f.estado === 'CIEGO' && f.marcas === '✔✔').length} · logs ROJO (alguna muda): ${juzgadas.filter((f) => f.estado === 'ROJO').length}`);

console.log(mal ? `\n🔴 ${mal} control(es) NO se cumplen: lo de arriba no vale` : '\ncontroles: todos se cumplen');
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
