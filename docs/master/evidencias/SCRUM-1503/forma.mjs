// docs/master/evidencias/SCRUM-1503/forma.mjs — SCRUM-1503
//
// ¿ES LA FORMA? La hipótesis que sale de `por-que-no-entra.mjs` (un solo test) se pasa aquí por
// TODA la población: cada fuente de `tests/` y `scripts/` se busca por AST el «caminante invocado
// en el sitio» — `(function anda(d) { … readdirSync(d) … })(ALGO);` — y se REESCRIBE EN MEMORIA
// (no se toca el árbol) a su forma con nombre — `function anda(d) { … }  anda(ALGO);` —. Las dos
// versiones se pasan por el lector REAL de la herramienta (`leerFuente`).
//
// Si con la forma reescrita el lector ve un directorio o apunta un «no sé» que antes no veía, la
// causa de que ese fuente no deje rastro es la forma de la llamada, y nada más.
//
//   node docs/master/evidencias/SCRUM-1503/forma.mjs [<por-test.tsv>]
//
// Sólo LEE. Primera línea: población. Última: EXIT.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { leerFuente } from '../../../../scripts/_tests-que-cubren.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const tsv = process.argv[2] || path.join(AQUI, 'por-test.tsv');
const LISTAN = new Set(['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync', 'glob']);

const fuentes = [];
for (const dir of ['tests', 'scripts', 'scripts/equipo']) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).sort()) if (/\.(mjs|js)$/.test(f)) fuentes.push(`${dir}/${f}`);
}

/** Los caminantes invocados en el sitio de un fuente: la llamada, la función y el nombre. */
function enElSitio(sf) {
  const hallados = [];
  (function mirar(n) {
    if (ts.isCallExpression(n)) {
      let callee = n.expression;
      while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
      if ((ts.isFunctionExpression(callee) || ts.isArrowFunction(callee)) && callee.parameters.length) {
        const params = new Set(callee.parameters.filter((p) => ts.isIdentifier(p.name)).map((p) => p.name.text));
        let lista = false;
        (function dentro(m) {
          if (ts.isCallExpression(m)) {
            const c = m.expression;
            const nom = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : '';
            const a = m.arguments[0];
            if (LISTAN.has(nom) && a && ts.isIdentifier(a) && params.has(a.text)) lista = true;
          }
          ts.forEachChild(m, dentro);
        })(callee.body);
        if (lista) hallados.push({ llamada: n, fn: callee });
      }
    }
    ts.forEachChild(n, mirar);
  })(sf);
  return hallados;
}

const firma = (d) => `${[...d.listados].sort().join('|')}#${d.noSe.length}`;
const filas = [];
let ilegibles = 0;
for (const rel of fuentes) {
  const original = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  let sf;
  try { sf = ts.createSourceFile(rel, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS); } catch { ilegibles += 1; continue; }
  const hallados = enElSitio(sf);
  if (!hallados.length) continue;
  let nuevo = original;
  let reescritos = 0;
  let noReescribibles = 0;
  // De atrás adelante, para que las posiciones de los anteriores sigan valiendo.
  for (const [i, h] of [...hallados.entries()].sort((a, b) => b[1].llamada.getStart(sf) - a[1].llamada.getStart(sf))) {
    const st = h.llamada.parent;
    if (!ts.isExpressionStatement(st) || !ts.isFunctionExpression(h.fn)) { noReescribibles += 1; continue; }
    const nombre = h.fn.name ? h.fn.name.text : `caminante1503_${i}`;
    let texto = h.fn.getText(sf);
    if (!h.fn.name) texto = texto.replace(/^function\s*\(/, `function ${nombre}(`);
    const argumentos = h.llamada.arguments.map((a) => a.getText(sf)).join(', ');
    nuevo = `${nuevo.slice(0, st.getStart(sf))}${texto}\n${nombre}(${argumentos});${nuevo.slice(st.getEnd())}`;
    reescritos += 1;
  }
  const antes = leerFuente(rel, original, RAIZ);
  const despues = leerFuente(rel, nuevo, RAIZ);
  filas.push({
    rel, cuantos: hallados.length, reescritos, noReescribibles, cambiaTexto: nuevo !== original,
    antes, despues, gana: firma(antes) !== firma(despues),
    ganaListados: [...despues.listados].filter((x) => !antes.listados.has(x)).sort(),
    ganaNoSe: despues.noSe.length - antes.noSe.length,
  });
}

console.log(`POBLACION: ${fuentes.length} fuentes de tests/ y scripts/ (${ilegibles} ilegibles) · con algun caminante invocado en el sitio: ${filas.length} · caminantes: ${filas.reduce((s, f) => s + f.cuantos, 0)}`);
const deTests = filas.filter((f) => f.rel.endsWith('.test.mjs'));
console.log(`   en ficheros de test: ${deTests.length} · en helpers de tests/: ${filas.filter((f) => f.rel.startsWith('tests/') && !f.rel.endsWith('.test.mjs')).length} · en scripts/: ${filas.filter((f) => f.rel.startsWith('scripts/')).length}`);
console.log(`   reescritos en memoria: ${filas.reduce((s, f) => s + f.reescritos, 0)} · no reescribibles (la llamada es un valor, o es una flecha): ${filas.reduce((s, f) => s + f.noReescribibles, 0)}`);

const ganan = filas.filter((f) => f.gana);
console.log('\n── CON LA FORMA REESCRITA, el lector de la herramienta…');
console.log(`   ve algo que antes no veia en ${ganan.length} de ${filas.length} fuentes`);
console.log(`     pasan a tener algun «no se» (entrarian SIEMPRE): ${ganan.filter((f) => f.ganaNoSe > 0).length}`);
console.log(`     ganan algun directorio listado (entrarian por RECORRE): ${ganan.filter((f) => f.ganaListados.length).length}`);
console.log(`   se quedan igual: ${filas.length - ganan.length}`);
for (const f of filas.filter((x) => !x.gana)) console.log(`     igual · ${f.rel} · reescritos ${f.reescritos} de ${f.cuantos} · ya tenia: listados ${f.antes.listados.size}, no-se ${f.antes.noSe.length}`);

// La población ① sale del cruce: `ficheros_ciegos` > 0. La columna `lista_quien` dice qué fichero lista.
let ciegos = [];
if (fs.existsSync(tsv)) {
  const [cab, ...lineas] = fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean);
  const col = Object.fromEntries(cab.split('\t').map((c, i) => [c, i]));
  ciegos = lineas.map((l) => l.split('\t')).filter((c) => Number(c[col.ficheros_ciegos]) > 0)
    .map((c) => ({ t: c[col.test], quien: c[col.lista_quien].split(' ').filter(Boolean) }));
}
console.log(`\n── CONTRA LA POBLACION ① del cruce (${ciegos.length} tests con algun par ciego)`);
const porRel = new Map(filas.map((f) => [f.rel, f]));
let porLaForma = 0;
const otros = [];
for (const c of ciegos) {
  const f = c.quien.map((q) => porRel.get(q)).find((x) => x && x.gana);
  if (f) {
    porLaForma += 1;
    console.log(`   FORMA · ${c.t}${f.rel !== c.t ? ` (lista ${f.rel})` : ''} → ${f.ganaNoSe > 0 ? `«no se» +${f.ganaNoSe}` : ''}${f.ganaListados.length ? ` listados +${f.ganaListados.join(', ')}` : ''}`);
  } else otros.push(c);
}
console.log(`   por la forma (reescrita, el lector los ve): ${porLaForma} de ${ciegos.length}`);
console.log(`   por OTRA causa: ${otros.length}`);
for (const c of otros) console.log(`     OTRA · ${c.t} · lista ${c.quien.join(', ')}`);

const enUno = new Set(ciegos.flatMap((c) => c.quien));
const fueraDeUno = ganan.filter((f) => !enUno.has(f.rel));
console.log(`\n── LA FORMA, fuera de ①: ${fueraDeUno.length} fuentes la tienen, ganarian algo al reescribirla, y NO salen ciegos en el cruce`);
for (const f of fueraDeUno) console.log(`     ${f.rel} · antes: listados ${f.antes.listados.size}, no-se ${f.antes.noSe.length} · ganaria: no-se +${f.ganaNoSe}, listados +${f.ganaListados.length}`);

// Controles: scrum622 tiene que estar (positivo); un fuente sin la forma no (a cero).
const c622 = porRel.get('tests/scrum622-desconocido-no-es-verde.test.mjs');
const cero = porRel.get('scripts/_tests-que-cubren.mjs');
console.log('\n── CONTROLES');
console.log(`   positivo · scrum622 tiene la forma y al reescribirla el lector gana algo: ${Boolean(c622 && c622.gana && c622.cambiaTexto)}`);
console.log(`   a cero · scripts/_tests-que-cubren.mjs (lista por nombre, no en el sitio) NO sale: ${!cero}`);
let salida = 2;
if (c622 && c622.gana && c622.cambiaTexto && !cero && ciegos.length && !ilegibles) salida = 0;
console.log(`\nEXIT=${salida}`);
process.exit(salida);
