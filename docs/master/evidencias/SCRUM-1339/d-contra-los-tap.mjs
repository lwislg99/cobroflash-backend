#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/d-contra-los-tap.mjs — SCRUM-1339d · SÓLO LECTURA.
//
// Pasa el módulo de la señal (`scripts/_senal-de-nombres.mjs`) por los TAP que el job TUVO
// DENTRO (el artefacto `tanda-tap`), cada uno contra el árbol que ESE job probó, y lo cruza
// con lo que midió J3h con su sonda (`b-analisis.tsv`). Son dos instrumentos distintos sobre
// las mismas entradas: donde discrepan, la discrepancia es el dato.
//
//   node d-contra-los-tap.mjs <carpeta del banco> <raíz del repo> [<carpeta de salida>]
//
// El banco es el que deja `b-bajar.mjs`: `bajados.tsv`, `taps/<id>.tap`, `logs/<id>.log` y,
// si está, `analisis.tsv`. El árbol probado se resuelve igual que en `b-analizar.mjs`: de la
// línea «Merge <cabeza> into <base>» del log (PR) o del sha (push). Las fuentes se leen con
// `git cat-file`, sin tocar el árbol de trabajo.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [carpeta, raiz, salida = carpeta] = process.argv.slice(2);
if (!carpeta || !raiz) { console.error('uso: node d-contra-los-tap.mjs <carpeta del banco> <raíz del repo> [<salida>]'); process.exit(2); }
const m = await import(pathToFileURL(path.join(raiz, 'scripts', '_senal-de-nombres.mjs')).href);

const git = (args, input) => execFileSync('git', args, { cwd: raiz, input, maxBuffer: 1024 * 1024 * 1024 });
const gitOk = (args) => { try { return git(args).toString('utf8').trim(); } catch { return null; } };
const leeTsv = (f) => { const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); const c = L.shift().split('\t'); return L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [c[i], v]))); };

const cache = new Map();
function fuentesDelArbol(arbol) {
  if (cache.has(arbol)) return cache.get(arbol);
  const rutas = git(['ls-tree', '-r', '--name-only', arbol, 'tests/']).toString('utf8').split('\n').filter((r) => /^tests\/[^/]+\.test\.mjs$/.test(r));
  const bruto = git(['cat-file', '--batch'], rutas.map((r) => `${arbol}:${r}`).join('\n') + '\n');
  const fuentes = []; let p = 0;
  for (const r of rutas) {
    const fin = bruto.indexOf(10, p);
    const cab = bruto.subarray(p, fin).toString('utf8').split(' ');
    const n = Number(cab[2]);
    if (cab[1] !== 'blob' || !Number.isFinite(n)) throw new Error(`cat-file: cabecera inesperada para ${r}: ${cab.join(' ')}`);
    fuentes.push({ fichero: path.basename(r), codigo: bruto.subarray(fin + 1, fin + 1 + n).toString('utf8') });
    p = fin + 1 + n + 1;
  }
  cache.clear(); cache.set(arbol, fuentes); return fuentes; // SCRUM-1339e: sólo el último árbol (con 229 árboles distintos, guardarlos todos agotó la memoria)
}

// El log es del ÚLTIMO intento del run (`b-bajar.mjs`), y vale para todos sus intentos: un
// relanzamiento prueba el mismo commit de fusión que el original. Por eso se busca por RUN.
const logDelRun = new Map();
function probado(f) {
  const log = logDelRun.get(f.run) ?? path.join(carpeta, 'logs', `${f.id}.log`);
  if (fs.existsSync(log)) {
    const mm = fs.readFileSync(log, 'latin1').match(/HEAD is now at [0-9a-f]+ Merge ([0-9a-f]{40}) into ([0-9a-f]{40})/);
    if (mm) {
      const [, cabeza, base] = mm;
      for (const c of [cabeza, base]) if (gitOk(['cat-file', '-e', `${c}^{commit}`]) === null) return { arbol: null, de: `falta ${c.slice(0, 8)} en local` };
      const a = gitOk(['merge-tree', '--write-tree', base, cabeza]);
      return a && /^[0-9a-f]{40}$/.test(a.split('\n')[0]) ? { arbol: a.split('\n')[0], de: 'fusión' } : { arbol: null, de: 'merge-tree no dio árbol' };
    }
  }
  if (f.evento === 'push') { const a = gitOk(['rev-parse', `${f.sha}^{tree}`]); return a ? { arbol: a, de: 'push' } : { arbol: null, de: 'falta el sha en local' }; }
  return { arbol: null, de: fs.existsSync(log) ? 'sin línea de fusión en el log' : 'sin log' };
}

const filas = leeTsv(path.join(carpeta, 'bajados.tsv'));
for (const f of filas) { const l = path.join(carpeta, 'logs', `${f.id}.log`); if (fs.existsSync(l)) logDelRun.set(f.run, l); }
const deJ3h = fs.existsSync(path.join(carpeta, 'analisis.tsv')) ? new Map(leeTsv(path.join(carpeta, 'analisis.tsv')).map((x) => [x.id, x])) : new Map();

const out = []; const registrosDePush = [];
let sinTap = 0;
for (const f of filas) {
  const ruta = path.join(carpeta, 'taps', `${f.id}.tap`);
  if (!fs.existsSync(ruta)) { sinTap++; continue; }
  const tap = fs.readFileSync(ruta, 'utf8');
  const p = probado(f);
  const fila = { id: f.id, creado: f.creado, run: f.run, intento: `${f.intento}/${f.intentos}`, evento: f.evento, conclusion: f.conclusion, arbol: p.arbol ? p.arbol.slice(0, 12) : `— (${p.de})` };
  const antes = deJ3h.get(f.id);
  fila.j3h_faltan = antes && antes.faltan !== '' ? antes.faltan : '';
  if (!p.arbol) {
    const t = m.leerTap(tap);
    Object.assign(fila, { medible: 'sin árbol', motivo: p.de, tap_entero: t.entero ? 'sí' : 'NO' });
  } else {
    const r = m.senalDeNombres({ fuentes: fuentesDelArbol(p.arbol), tap });
    Object.assign(fila, {
      medible: r.medible ? 'sí' : 'NO', motivo: r.motivo ?? '', tap_entero: r.tap.entero ? 'sí' : 'NO',
      declarados: r.poblacion.llamadas, literales: r.poblacion.literales, no_comparables: r.poblacion.noComparables,
      tap_tests: r.tap.tests ?? '', tap_fail: r.tap.fail ?? '', ausentes: r.ausentes ?? '', dudosos: r.dudosos ?? '',
      donde: r.bloques.map((b) => m.describirBloque(b)).join(' | '),
      dudas: r.dudas.map((x) => `«${x.nombre}» ${x.registrado}/${x.declarado} [${x.ficheros.join(',')}]`).join(' | '),
      registro: m.lineaDeRegistro(r),
    });
    if (f.evento === 'push') registrosDePush.push(m.registroDesdeLinea(m.lineaDeRegistro(r)));
  }
  out.push(fila);
}
const cab = ['id', 'creado', 'run', 'intento', 'evento', 'conclusion', 'arbol', 'medible', 'tap_entero', 'declarados', 'literales', 'no_comparables', 'tap_tests', 'tap_fail', 'ausentes', 'dudosos', 'j3h_faltan', 'motivo', 'donde', 'dudas'];
fs.writeFileSync(path.join(salida, 'd-contra-los-tap.tsv'), cab.join('\t') + '\n' + out.map((f) => cab.map((k) => f[k] ?? '').join('\t')).join('\n') + '\n');

const medidos = out.filter((f) => f.medible === 'sí');
const noMedibles = out.filter((f) => f.medible === 'NO');
const sinArbol = out.filter((f) => f.medible === 'sin árbol');
const limpios = medidos.filter((f) => f.ausentes === 0 && f.dudosos === 0);
const conAusentes = medidos.filter((f) => f.ausentes > 0);
const soloDudosos = medidos.filter((f) => f.ausentes === 0 && f.dudosos > 0);
console.log(`POBLACIÓN: ${filas.length} artefactos · con TAP en disco ${out.length} · sin TAP ${sinTap}`);
console.log(`  medibles (TAP entero y árbol probado resuelto): ${medidos.length} · TAP no entero: ${noMedibles.length} · sin árbol: ${sinArbol.length}`);
const motivos = {}; for (const f of noMedibles) { const k = f.motivo.replace(/\d+/g, 'N'); motivos[k] = (motivos[k] || 0) + 1; }
for (const [k, n] of Object.entries(motivos)) console.log(`     ${String(n).padStart(3)}× no medible: ${k}`);
console.log(`① CON AUSENTES: ${conAusentes.length} de ${medidos.length} · de ellos success ${conAusentes.filter((f) => f.conclusion === 'success').length}`);
for (const f of conAusentes) console.log(`   ${f.id} run ${f.run} [${f.intento}] ${f.evento} ${f.conclusion} ausentes=${f.ausentes} dudosos=${f.dudosos} → ${f.donde}`);
console.log(`② LIMPIOS (0 ausentes, 0 dudosos): ${limpios.length} de ${medidos.length}`);
console.log(`   SÓLO DUDOSOS (0 ausentes, algún repetido que llega menos veces de las declaradas): ${soloDudosos.length}`);
for (const f of soloDudosos) console.log(`   ${f.id} run ${f.run} ${f.conclusion} dudosos=${f.dudosos} → ${f.dudas}`);
// ── el cruce con la sonda de J3h: mismos TAP, mismo árbol, otro instrumento ────────────────
const comparables = medidos.filter((f) => f.j3h_faltan !== '');
const mismoVeredicto = comparables.filter((f) => (Number(f.j3h_faltan) > 0) === (f.ausentes + f.dudosos > 0));
const mismaCifra = comparables.filter((f) => Number(f.j3h_faltan) === f.ausentes);
console.log(`③ CRUCE CON LA SONDA DE J3h (b-analisis.tsv): comparables ${comparables.length} de ${medidos.length}`);
console.log(`   mismo veredicto (falta algo / no falta nada): ${mismoVeredicto.length} de ${comparables.length} · misma cifra de ausentes: ${mismaCifra.length} de ${comparables.length}`);
for (const f of comparables.filter((x) => !mismaCifra.includes(x))) console.log(`   DISCREPA ${f.id} run ${f.run}: J3h ${f.j3h_faltan} · aquí ausentes=${f.ausentes} dudosos=${f.dudosos} → ${f.donde} ${f.dudas}`);
const pob = medidos.map((f) => f.no_comparables).sort((a, b) => a - b);
if (pob.length) console.log(`④ PUNTO CIEGO por job: llamadas no comparables mín ${pob[0]} · mediana ${pob[pob.length >> 1]} · máx ${pob.at(-1)} (de ${medidos.at(-1).declarados} declaradas en el último)`);
console.log(`⑤ TASA sobre los jobs de push de este banco (${registrosDePush.length}):`);
console.log('   ' + m.lineaDeTasa(m.tasaDeRegistros(registrosDePush)));
console.log('EXIT=0');
