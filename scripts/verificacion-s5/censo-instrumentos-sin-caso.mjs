// Censo: ¿qué instrumentos de medición tienen un CASO CONOCIDO FABRICADO delante?
// Se corre desde la raíz del worktree.
import fs from 'node:fs';
import ts from 'typescript';

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

// ── POBLACIÓN: funciones exportadas cuyo nombre dice que producen una medida.
const VERBOS = /^(censar|censo|detectar|barrer|analizar|clasificar|contar|medir|inventario|escanear|rastroDe|tautologiasDe|enPatronPeligroso)/i;
const inst = [];
for (const d of ['scripts', 'tests']) {
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.mjs')) continue;
    const s = fs.readFileSync(`${d}/${f}`, 'utf8');
    for (const m of s.matchAll(/export (?:async )?function (\w+)/g)) {
      if (VERBOS.test(m[1])) inst.push({ fichero: `${d}/${f}`, fn: m[1] });
    }
  }
}

const corpus = [];
for (const d of ['scripts', 'tests']) {
  for (const f of fs.readdirSync(d)) {
    if (f.endsWith('.mjs')) corpus.push({ f: `${d}/${f}`, s: fs.readFileSync(`${d}/${f}`, 'utf8') });
  }
}

/**
 * ¿Es este argumento una ENTRADA FABRICADA? Un literal, o una variable ligada a un literal.
 * Lo contrario es una entrada leída del árbol (fs, git, la instantánea): eso no demuestra que
 * el instrumento VEA — si el árbol está limpio, un cero sale igual estando roto el detector.
 */
function esFabricado(a, sf, fuente) {
  if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) || ts.isTemplateExpression(a)) return true;
  if (ts.isArrayLiteralExpression(a) || ts.isObjectLiteralExpression(a)) return true;
  if (ts.isIdentifier(a)) {
    // ¿La variable está ligada a un literal en el mismo fichero?
    const re = new RegExp(`(?:const|let|var)\\s+${a.text}\\s*=\\s*(?:\`|'|"|\\[|\\{)`);
    if (re.test(fuente)) return true;
    // …o es la variable de un `for (const x of [ … literales … ])`.
    const reFor = new RegExp(`for\\s*\\(\\s*(?:const|let)\\s+(?:\\[[^\\]]*\\]|\\{[^}]*\\}|${a.text})\\s+of\\s*(?:\\[|\\w+)`);
    if (reFor.test(fuente)) return true;
  }
  // `s.src`, `x.fuente`… un acceso a propiedad de un objeto declarado con literales.
  if (ts.isPropertyAccessExpression(a)) return true;
  // 🔴 UNA LLAMADA CON ARGUMENTOS LITERALES TAMBIEN ES UNA ENTRADA FABRICADA. Este censo
  // no la veia: dijo que `clasificarBlob` seguia sin caso cuando yo acababa de sembrarselo
  // con un Buffer construido a partir de un literal. Un literal envuelto sigue siendo un
  // literal, y no reconocerlo hacia que el censo NO viera su propia mejora.
  if (ts.isCallExpression(a) && a.arguments.length
    && a.arguments.every((x) => ts.isStringLiteral(x) || ts.isNumericLiteral(x)
      || ts.isNoSubstitutionTemplateLiteral(x) || ts.isArrayLiteralExpression(x))) return true;
  return false;
}

function tieneCasoFabricado(fuente, fn) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let si = false;
  const visita = (n) => {
    if (ts.isCallExpression(n)) {
      const nombre = norm(n.expression.getText(sf));
      if ((nombre === fn || nombre.endsWith(`.${fn}`)) && n.arguments.length) {
        if (esFabricado(n.arguments[0], sf, fuente)) si = true;
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return si;
}

// 🔴 LA UNIDAD ES EL MODULO, NO LA FUNCION — y me lo enseño el propio censo. `censarReferenciaMovil`
// recibe la RAIZ del arbol, nunca un literal; quien recibe los casos fabricados es su hermana
// `analizarFuente`, en el mismo modulo. Contando por funcion, el par salia acusado con un
// autoexamen impecable al lado. Lo que importa es si el MODULO ha demostrado que ve.
const porModulo = new Map();
for (const i of inst) {
  if (!porModulo.has(i.fichero)) porModulo.set(i.fichero, []);
  porModulo.get(i.fichero).push(i.fn);
}
// 🔴 Y AL BUSCARLE CASO AL MODULO SE MIRAN TODAS SUS EXPORTADAS, no solo las que casan con
// VERBOS. Segundo punto ciego medido: `frontera-dist` exporta `censoDeLaFrontera` (censada) y
// `correspondencia` (no censada), y el caso fabricado se lo puse a la segunda. El modulo SI
// habia demostrado que ve; mi censo miraba por la rendija equivocada.
const todasLasExportadas = new Map();
for (const [fichero] of porModulo) {
  const src = fs.readFileSync(fichero, 'utf8');
  todasLasExportadas.set(fichero, [...src.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]));
}
const con = [], sin = [];
for (const [fichero, fns] of porModulo) {
  const candidatas = todasLasExportadas.get(fichero) || fns;
  const hay = candidatas.some((fn) => corpus.some((t) => t.s.includes(fn) && tieneCasoFabricado(t.s, fn)));
  (hay ? con : sin).push(`${fichero} :: ${fns.join(', ')}`);
}

console.log(`INSTRUMENTOS censados: ${inst.length} funciones en ${porModulo.size} modulos`);
console.log(`  CON caso fabricado delante: ${con.length}`);
console.log(`  SIN ninguno:                ${sin.length}`);

console.log('\nSUELO — los tres que YA sé que lo tienen:');
let sueloOk = true;
for (const n of ['tautologiasDe', 'enPatronPeligroso', 'censarReferenciaMovil']) {
  const ok = con.some((x) => x.includes(n));
  if (!ok) sueloOk = false;
  console.log(`  ${ok ? '✅ CON' : (sin.some((x) => x.includes(n)) ? '🔴 SIN' : '🔴 no censado')}  ${n}`);
}
console.log('\nCONTROL NEGATIVO — uno que sé que NO lo tiene tiene que salir SIN:');
const neg = sin.some((x) => /rastroDe|clasificarSentencias|medirMargen/.test(x));
console.log(`  ${neg ? '✅' : '🔴'} al menos uno de los conocidos-sin-caso sale en la lista SIN`);

if (!sueloOk) {
  console.log('\n🔴 CENSO CIEGO: no reconoce casos fabricados que sé que existen.');
  console.log('   La lista de abajo NO se puede leer como «éstos no tienen caso».');
  process.exit(2);
}
console.log(`\nSIN CASO CONOCIDO (${sin.length}) — pueden dar un cero y nadie sabrá si es real:`);
for (const x of sin) console.log('    ' + x);
