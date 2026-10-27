// Separa los ausentes de la ventana de 50 runs por lo que el propio aviso dice de cada fichero.
// SOLO LECTURA: lee el TSV de e-tasa-de-main.mjs (g-tasa-de-main.tsv). No baja nada.
//   node docs/master/evidencias/SCRUM-1339/h-separar.mjs docs/master/evidencias/SCRUM-1339/g-tasa-de-main.tsv
import fs from 'node:fs';
const tsv = process.argv[2];
// `\r?\n`: en un checkout de Windows el TSV llega con CRLF y la última columna se llamaría `avisos\r`
const [cab, ...lineas] = fs.readFileSync(tsv, 'utf8').split(/\r?\n/).filter(Boolean);
const k = cab.split('\t');
const filas = lineas.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [k[i], v])));
const medidos = filas.filter((f) => ['CON AUSENTES', 'completo', 'sólo dudosos'].includes(f.estado));
const con = medidos.filter((f) => f.estado === 'CON AUSENTES');
console.log(`POBLACION: ${filas.length} filas · ${medidos.length} medidos · ${con.length} con ausentes`);
const RE = /^tests\/([\w.-]+\.test\.mjs) · faltan (AL MENOS )?(\d+) de (\d+) \((\w+)\)/;
const MARCA = 'el fichero sale en el TAP como UNA línea';
const bloques = [];
let sinParsear = 0;
let trozosMas = 0;
for (const f of con) {
  const fail = Number(/tap_fail=(\d+)/.exec(f.linea)?.[1] ?? NaN);
  const tests = Number(/tap_tests=(\d+)/.exec(f.linea)?.[1] ?? NaN);
  const decl = Number(/declarados=(\d+)/.exec(f.linea)?.[1] ?? NaN);
  let suma = 0;
  for (const trozo of f.avisos.split(' | ')) {
    const m = RE.exec(trozo);
    if (!m) { if (/ y \d+ más|no caben/.test(trozo)) trozosMas++; else { sinParsear++; console.log('  SIN PARSEAR:', JSON.stringify(trozo.slice(0, 160))); } continue; }
    const b = { sha: f.sha.slice(0, 8), fecha: f.fecha, job: f.conclusion, fail, tests, decl, fichero: m[1], alMenos: Boolean(m[2]), faltan: Number(m[3]), de: Number(m[4]), forma: m[5], entrada: trozo.includes(MARCA) };
    bloques.push(b); suma += b.faltan;
  }
  if (suma !== Number(f.ausentes)) console.log(`  DESCUADRE ${f.sha.slice(0, 8)}: avisos suman ${suma}, registro dice ${f.ausentes}`);
}
console.log(`bloques: ${bloques.length} · trozos sin parsear: ${sinParsear} · avisos «y N más»: ${trozosMas}`);
const total = bloques.reduce((a, b) => a + b.faltan, 0);
console.log(`suma de ausentes en bloques: ${total} (el registro suma ${con.reduce((a, f) => a + Number(f.ausentes), 0)})`);
const grupo = (f) => { const o = {}; for (const b of bloques) { const c = f(b); o[c] ??= { bloques: 0, casos: 0, runs: new Set() }; o[c].bloques++; o[c].casos += b.faltan; o[c].runs.add(b.sha); } return Object.fromEntries(Object.entries(o).map(([c, v]) => [c, `${v.bloques} bloques · ${v.casos} casos · ${v.runs.size} runs`])); };
console.log('por forma × entrada de fichero × job:', JSON.stringify(grupo((b) => `${b.forma} · entrada=${b.entrada ? 'si' : 'no'} · job ${b.job} · tap_fail=${b.fail > 0 ? '>0' : b.fail}`), null, 1));
console.log('por entrada de fichero:', JSON.stringify(grupo((b) => `entrada=${b.entrada ? 'si' : 'no'}`)));
// CONTROL DE CERO: una marca que no existe
console.log('CONTROL DE CERO (marca inventada «el fichero NO SALE en el TAP»):', bloques.filter((b) => con.find((f) => f.sha.startsWith(b.sha)).avisos.includes('el fichero NO SALE en el TAP')).length);
// runs por tipo
const porRun = new Map();
for (const b of bloques) { if (!porRun.has(b.sha)) porRun.set(b.sha, []); porRun.get(b.sha).push(b); }
let soloEntrada = 0, mixto = 0, sinEntrada = 0;
for (const [, bs] of porRun) { const e = bs.filter((b) => b.entrada).length; if (e === bs.length) soloEntrada++; else if (e === 0) sinEntrada++; else mixto++; }
console.log(`runs con ausentes: ${porRun.size} · TODOS sus bloques con entrada de fichero: ${soloEntrada} · ninguno: ${sinEntrada} · mezcla: ${mixto}`);
console.log('--- detalle de los bloques con entrada de fichero o de jobs en failure ---');
for (const b of bloques.filter((x) => x.entrada || x.job !== 'success')) console.log(`${b.sha} ${b.fecha} job=${b.job} tap_fail=${b.fail} ${b.fichero} faltan ${b.faltan}/${b.de} ${b.forma} entrada=${b.entrada}`);
