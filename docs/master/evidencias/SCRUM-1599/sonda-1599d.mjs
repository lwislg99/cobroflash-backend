// SCRUM-1599d · sonda de SOLO LECTURA: ¿qué tests están gateados, por qué variable, y cuáles
// NO corren en NINGÚN sitio que deje rastro (CI)? No escribe nada, no toca bases.
//
//   node docs/master/evidencias/SCRUM-1599/sonda-1599d.mjs --ref origin/main --log <log del job «build + tests»>
//
// DOS SONDAS INDEPENDIENTES (A3):
//   ① ESTÁTICA: lee `tests/*.test.mjs` de la ref (git show, no el árbol) y saca el motivo literal
//      de cada `skip: !X && '…'`. Clasifica por las variables que nombra el motivo.
//   ② DINÁMICA: lee el log del job de CI y saca cada caso saltado (`﹣ … # motivo`). Exige que
//      pass + skipped = tests (si no suman, CIEGO). Cada caso saltado por QA_DB_TEST se busca por
//      su TÍTULO en los ficheros de la ref: así se sabe QUÉ FICHEROS no corren en CI.
// CONTROLES: el positivo se SIEMBRA (cicatriz ②): se fabrica una línea de log con el título de un
//   caso que la sonda ① ha encontrado, y tiene que mapear a su fichero; y otra con un título
//   inventado, que NO puede mapear. Si ① sale vacía no hay qué sembrar: CIEGO, no verde.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('--ref', 'origin/main');
const LOG = arg('--log', '');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const CIEGO = (m) => { console.log(`CIEGO · ${m}`); process.exit(2); };

const sha = git('rev-parse', REF).trim();
const ficheros = git('ls-tree', '--name-only', REF, 'tests/').split('\n').filter((f) => f.endsWith('.test.mjs'));
if (ficheros.length === 0) CIEGO(`0 ficheros .test.mjs en ${REF}`);

// ── ① ESTÁTICA ───────────────────────────────────────────────────────────────────────────
const VARS = ['QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST', 'LIBRO_PG_URL', 'SERIE_PG_URL', 'TRAMOS_PG_URL'];
const RE_SKIP = /skip:\s*!\s*[A-Za-z_]+\s*&&\s*(['"`])((?:(?!\1).)*)\1/g;
const fuente = new Map();
const porFichero = new Map(); // fichero → { vars:Set, motivos:n }
for (const f of ficheros) {
  const src = git('show', `${sha}:${f}`);
  fuente.set(f, src);
  for (const m of src.matchAll(RE_SKIP)) {
    const vs = VARS.filter((v) => m[2].includes(v));
    if (vs.length === 0) continue;
    const e = porFichero.get(f) || { vars: new Set(), motivos: 0 };
    vs.forEach((v) => e.vars.add(v));
    e.motivos++;
    porFichero.set(f, e);
  }
}
// sin motivo literal pero nombra la variable: otra forma de gatear (o un test que la ENSEÑA)
const sinLiteral = ficheros.filter((f) => !porFichero.has(f) && VARS.some((v) => fuente.get(f).includes(`process.env.${v}`)));

const firma = (e) => [...e.vars].sort().join(' + ');
const grupos = new Map();
for (const [f, e] of porFichero) grupos.set(firma(e), [...(grupos.get(firma(e)) || []), f]);
console.log(`ref ${REF} = ${sha}`);
console.log(`① ESTÁTICA · población: ${ficheros.length} ficheros .test.mjs · con skip literal que nombra un gate: ${porFichero.size}`);
for (const [g, fs_] of [...grupos].sort((a, b) => b[1].length - a[1].length)) console.log(`   ${String(fs_.length).padStart(3)} ficheros · motivo nombra: ${g}`);
const soloQa = [...porFichero].filter(([, e]) => e.vars.has('QA_DB_TEST') && !e.vars.has('LIBRO_PG_URL')).map(([f]) => f);
console.log(`   → nombran QA_DB_TEST y NO LIBRO_PG_URL (no tienen banco desechable): ${soloQa.length}`);
console.log(`   sin motivo literal pero leen process.env.<gate>: ${sinLiteral.length} (no clasificados: pueden ser gate de otra forma o tests que la enseñan)`);

if (!LOG) { console.log('② DINÁMICA · sin --log: no medida'); process.exit(0); }

// ── ② DINÁMICA ───────────────────────────────────────────────────────────────────────────
const texto = fs.readFileSync(LOG, 'utf8');
if (texto.length < 100_000) CIEGO(`log de ${texto.length} B: un job a medias o sin bajar (uno completo pasa de 1,7 MB)`);
const num = (k) => [...texto.matchAll(new RegExp(`ℹ ${k} (\\d+)`, 'g'))].map((m) => +m[1]);
const [tests, pass, skipped] = ['tests', 'pass', 'skipped'].map((k) => Math.max(0, ...num(k)));
const saltos = [...texto.matchAll(/^\S+Z ﹣ (.*) \([\d.]+m?s\) # (.*)$/gm)].map((m) => ({ titulo: m[1], motivo: m[2] }));

function mapear(lista) {
  return lista.map((s) => {
    const clave = s.titulo.slice(0, 40);
    const donde = ficheros.filter((f) => fuente.get(f).includes(clave));
    return { ...s, donde };
  });
}
// controles SEMBRADOS: un título real sacado de ①, y uno inventado
const fSembrado = soloQa[0];
if (!fSembrado) CIEGO('① no encontró ningún fichero gateado por QA_DB_TEST: no hay positivo que sembrar');
const tituloSembrado = (fuente.get(fSembrado).match(/test\(\s*(['"`])((?:(?!\1).){20,})\1/) || [])[2];
if (!tituloSembrado) CIEGO(`no se pudo sacar un título de ${fSembrado} para sembrar`);
const [pos, neg] = mapear([
  { titulo: tituloSembrado, motivo: 'sin QA_DB_TEST=1 (SEMBRADO)' },
  { titulo: `SONDA-1599d-titulo-que-no-existe-${sha.slice(0, 7)}`, motivo: 'sin QA_DB_TEST=1 (SEMBRADO)' },
]);
const ctlPos = pos.donde.includes(fSembrado);
const ctlNeg = neg.donde.length === 0;

const qa = mapear(saltos.filter((s) => s.motivo.includes('QA_DB_TEST')));
const ficherosQa = new Set(qa.flatMap((s) => s.donde));
const sinCasar = qa.filter((s) => s.donde.length === 0);
const otros = saltos.filter((s) => !s.motivo.includes('QA_DB_TEST'));
console.log(`② DINÁMICA · log ${texto.length} B · tests ${tests} = pass ${pass} + skipped ${skipped}: ${pass + skipped === tests ? 'SUMA' : 'NO SUMA'} · líneas de salto leídas: ${saltos.length}`);
if (pass + skipped !== tests || saltos.length !== skipped) CIEGO('el recuento no cuadra con el resumen del propio log');
console.log(`   casos saltados por QA_DB_TEST: ${qa.length} · en ${ficherosQa.size} ficheros · sin casar con ningún fichero: ${sinCasar.length}`);
console.log(`   otros saltos (no son de base): ${otros.length}`);
for (const s of otros) console.log(`      · ${s.motivo.slice(0, 90)}`);
console.log(`   control POSITIVO sembrado (${fSembrado}): ${ctlPos ? 'casa' : 'NO CASA'} · control NEGATIVO inventado: ${ctlNeg ? 'no casa' : 'CASA'}`);
if (!ctlPos || !ctlNeg) CIEGO('los controles sembrados no dan lo que deben');
// cruce de las dos sondas: ficheros que ① da por «solo QA» y ② no ve saltar en CI, y al revés
const soloEst = soloQa.filter((f) => !ficherosQa.has(f));
const soloDin = [...ficherosQa].filter((f) => !soloQa.includes(f));
console.log(`   cruce ①×②: en ① y no saltan en CI: ${soloEst.length} · saltan en CI y ① no los tiene como «solo QA»: ${soloDin.length}`);
for (const f of soloEst) console.log(`      ①-sólo ${f}`);
for (const f of soloDin) console.log(`      ②-sólo ${f}`);
console.log('FICHEROS QUE NO CORREN EN CI (② por título):');
for (const f of [...ficherosQa].sort()) console.log(`   ${f} · ${qa.filter((s) => s.donde.includes(f)).length} casos`);
