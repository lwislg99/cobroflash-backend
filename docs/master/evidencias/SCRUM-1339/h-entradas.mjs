// Lee los 50 TAP de la ventana con el `leerTap` DE LA CASA y mira, de cada entrada de fichero,
// lo que la senal NO mira: si cayo, y con que (exitCode / signal / spawn). SOLO LECTURA.
//   node docs/master/evidencias/SCRUM-1339/h-entradas.mjs scripts/_senal-de-nombres.mjs <tsv> <carpeta de taps>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [modulo, tsv, carpeta] = process.argv.slice(2);
const m = await import(pathToFileURL(path.resolve(modulo)).href);
// `\r?\n`: en un checkout de Windows el TSV llega con CRLF y la última columna se llamaría `avisos\r`
const [cab, ...lineas] = fs.readFileSync(tsv, 'utf8').split(/\r?\n/).filter(Boolean);
const k = cab.split('\t');
const filas = lineas.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [k[i], v])))
  .filter((f) => ['CON AUSENTES', 'completo', 'sólo dudosos'].includes(f.estado));
const RE = /^tests\/([\w.-]+\.test\.mjs) · faltan (?:AL MENOS )?(\d+) de (\d+) \((\w+)\)/;

/** El bloque YAML que sigue a una linea de nivel 0 `ok|not ok N - <algo>.test.mjs`. */
function bloquesDeFichero(texto) {
  const L = texto.split('\n');
  const out = [];
  for (let i = 0; i < L.length; i++) {
    const mm = /^(not )?ok \d+ - (.*\.test\.mjs)\s*$/.exec(L[i]);
    if (!mm) continue;
    const y = [];
    if ((L[i + 1] ?? '').trim() === '---') for (let j = i + 2; j < L.length && j < i + 80; j++) { if (L[j].trim() === '...') break; y.push(L[j].trim()); }
    const campo = (c) => (y.find((l) => l.startsWith(c + ':')) ?? '').slice(c.length + 1).trim() || null;
    out.push({ fichero: mm[2].split(/[\\/]/).pop(), caida: Boolean(mm[1]), exitCode: campo('exitCode'), signal: campo('signal'), error: campo('error'), code: campo('code'), failureType: campo('failureType'), tipo: campo('type') });
  }
  return out;
}

const tot = { taps: 0, enteros: 0, conNul: 0, entradas: 0, entradasCaidas: 0, entradasOk: 0, spawn: 0, conSenal: 0 };
const filasSalida = [];
const cruce = { bloques: 0, casos: 0, clases: {} };
let descuadres = 0;
let sinFail = 0;
const caidosDeNivel0 = [];
for (const f of filas) {
  const ruta = path.join(carpeta, f.sha.slice(0, 8), 'tanda.tap');
  const texto = fs.readFileSync(ruta, 'utf8');
  const t = m.leerTap(texto);
  tot.taps++;
  if (t.entero) tot.enteros++;
  if (t.nul) tot.conNul++;
  const regTests = Number(/tap_tests=(\d+)/.exec(f.linea)?.[1]);
  const regFail = Number(/tap_fail=(\d+)/.exec(f.linea)?.[1]);
  // CONTROL: el TAP bajado es el que midio el paso (mismo `# tests` y `# fail`)
  if (t.tests !== regTests || t.fail !== regFail) { descuadres++; console.log(`  DESCUADRE ${f.sha.slice(0, 8)}: TAP tests=${t.tests} fail=${t.fail} · registro tests=${regTests} fail=${regFail} · ${t.motivo ?? ''}`); }
  // EL CAMINO QUE NO DEPENDE DE LA FORMA DE LA ENTRADA: un fichero caído cuenta como `fail` (SCRUM-1389 ①).
  // Con `# fail 0` no hay ninguno, se escriba como se escriba; con `fail > 0` se nombra cada caído.
  if (t.fail === 0) sinFail++;
  else for (const l of texto.split('\n')) if (/^not ok \d+ - /.test(l)) caidosDeNivel0.push(`${f.sha.slice(0, 8)} · ${l.slice(0, 110)}`);
  const mias = bloquesDeFichero(texto);
  // CONTROL: mi lector de entradas ve las mismas que el de la casa
  if (mias.length !== t.entradasDeFichero.length) { descuadres++; console.log(`  DESCUADRE DE LECTORES ${f.sha.slice(0, 8)}: yo ${mias.length}, la casa ${t.entradasDeFichero.length}`); }
  tot.entradas += mias.length;
  for (const e of mias) {
    if (e.caida) tot.entradasCaidas++; else tot.entradasOk++;
    if (/spawn/.test(e.error ?? '') || e.code) tot.spawn++;
    if (e.signal && e.signal !== '~' && e.signal !== 'null') tot.conSenal++;
    filasSalida.push(`${f.sha.slice(0, 8)}\t${f.fecha}\t${f.estado}\t${f.conclusion}\ttap_fail=${t.fail}\t${e.fichero}\t${e.caida ? 'not ok' : 'ok'}\texitCode=${e.exitCode}\tsignal=${e.signal}\terror=${e.error}\tfailureType=${e.failureType}\ttype=${e.tipo}`);
  }
  // cruce: cada bloque del aviso con la entrada (o no) de su fichero
  if (f.estado === 'CON AUSENTES') for (const trozo of f.avisos.split(' | ')) {
    const b = RE.exec(trozo);
    if (!b) { descuadres++; console.log('  AVISO SIN PARSEAR', trozo.slice(0, 80)); continue; }
    const e = mias.filter((x) => x.fichero === b[1]);
    const clase = e.length === 0 ? `SIN entrada de fichero (${b[4]})`
      : e.map((x) => `entrada ${x.caida ? 'NOT OK' : 'ok'} · exitCode=${x.exitCode} · signal=${x.signal} · error=${x.error}`).join(' + ') + ` (${b[4]})`;
    cruce.bloques++; cruce.casos += Number(b[2]);
    cruce.clases[clase] ??= { bloques: 0, casos: 0, runs: new Set(), ficheros: new Set() };
    cruce.clases[clase].bloques++; cruce.clases[clase].casos += Number(b[2]); cruce.clases[clase].runs.add(f.sha.slice(0, 8)); cruce.clases[clase].ficheros.add(b[1]);
  }
}
console.log(`POBLACION: ${tot.taps} TAP (uno por run medido) · enteros segun la casa ${tot.enteros} · con NUL ${tot.conNul} · descuadres ${descuadres}`);
console.log(`ENTRADAS DE FICHERO en los ${tot.taps} TAP: ${tot.entradas} · caidas (not ok) ${tot.entradasCaidas} · ok ${tot.entradasOk} · con spawn/code ${tot.spawn} · con senal ${tot.conSenal}`);
for (const l of filasSalida) console.log('  ' + l);
console.log(`SIN DEPENDER DE LA FORMA: TAP con «# fail 0»: ${sinFail} de ${tot.taps} · en los otros ${tot.taps - sinFail}, lo caído de nivel 0 (${caidosDeNivel0.length}):`);
for (const l of caidosDeNivel0) console.log('  ' + l);
console.log(`CRUCE bloque del aviso -> entrada de su fichero: ${cruce.bloques} bloques · ${cruce.casos} casos`);
for (const [c, v] of Object.entries(cruce.clases)) console.log(`  ${v.bloques} bloques · ${v.casos} casos · ${v.runs.size} runs · ${v.ficheros.size} ficheros · ${c}`);
// CONTROL DE CERO: una entrada de fichero con un nombre que no existe
console.log(`CONTROL DE CERO: entradas de «scrum9999-no-existe.test.mjs»: ${filasSalida.filter((l) => l.split('\t')[5] === 'scrum9999-no-existe.test.mjs').length}`);
// CONTROL POSITIVO del lector de entradas, con un TAP fabricado
const fab = ['TAP version 13', '# Subtest: tests/a.test.mjs', 'not ok 1 - tests/a.test.mjs', '  ---', '  duration_ms: 1', "  type: 'test'", "  location: 'x:1:1'", "  failureType: 'testCodeFailure'", "  exitCode: 1", '  signal: ~', "  error: 'test failed'", "  code: 'ERR_TEST_FAILURE'", '  ...', '1..1', '# tests 1', '# fail 1'].join('\n');
const pf = bloquesDeFichero(fab);
console.log(`CONTROL POSITIVO (TAP fabricado con un fichero caido): entradas ${pf.length} · caida ${pf[0]?.caida} · exitCode ${pf[0]?.exitCode} · la casa ve ${m.leerTap(fab).entradasDeFichero.length} con caida=${m.leerTap(fab).entradasDeFichero[0]?.caida}`);
