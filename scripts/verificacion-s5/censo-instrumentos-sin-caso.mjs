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
// 🔴 TERCERA CORRECCION, Y ESTA ERA LA GRAVE — la cazo el control negativo poniendose en rojo.
// «Mirar TODAS las exportadas» era demasiado ancho: un modulo pasaba a CON porque CUALQUIER
// exportada suya recibia un literal en algun sitio, aunque fuese un ayudante trivial.
// `_censo-new-url` salia CON por `parseBDSegura` —que su censo ni siquiera llama: busca su
// NOMBRE con una regex— y `_censo-peticiones-panel` por `repartoPorMetodo`, que consume la
// SALIDA del censo sobre el arbol de verdad. Ninguno de los dos demuestra nada del detector.
//
// Lo que separa a la hermana buena de la trivial es DERIVABLE, no de ojo: una ARISTA DE LLAMADA
// dentro del modulo, en cualquiera de los dos sentidos. `censoDeLaFrontera` LLAMA a
// `correspondencia`; `revisarCondicionesContraEmisor` llama a `censarInsercionesDelSuelto`. Si
// hay arista, la entrada fabricada LLEGA al detector. Comprobado a mano en los 5 candidatos: el
// criterio reproduce el juicio 5/5, y deja fuera a `parseBDSegura` y `repartoPorMetodo`.
function aristasDe(fuente) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const mapa = new Map();
  const v = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) {
      const llamadas = new Set();
      const w = (m) => {
        if (ts.isCallExpression(m) && ts.isIdentifier(m.expression)) llamadas.add(m.expression.text);
        ts.forEachChild(m, w);
      };
      ts.forEachChild(n, w);
      mapa.set(n.name.text, llamadas);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return mapa;
}

/**
 * ¿Ha DEMOSTRADO este módulo que ve? Una sola función, usada por el censo real y por su suelo
 * sembrado, porque un suelo que corre por otro camino no prueba el camino que importa.
 * Devuelve `null`, `'propio'` (la censada misma) o `'hermana'` (una hermana con arista).
 */
function moduloDemuestraQueVe(fuenteModulo, censadas, exportadas, corpusDado) {
  const conCaso = (fn) => corpusDado.some((t) => t.s.includes(fn) && tieneCasoFabricado(t.s, fn));
  if (censadas.some(conCaso)) return 'propio';
  const mapa = aristasDe(fuenteModulo);
  for (const h of exportadas.filter((f) => !censadas.includes(f))) {
    if (!conCaso(h)) continue;
    const hayArista = censadas.some((f) => (mapa.get(f) || new Set()).has(h) || (mapa.get(h) || new Set()).has(f));
    if (hayArista) return 'hermana';
  }
  return null;
}

const con = [], sin = [];
let porHermana = 0;
for (const [fichero, fns] of porModulo) {
  const via = moduloDemuestraQueVe(fs.readFileSync(fichero, 'utf8'), fns,
    todasLasExportadas.get(fichero) || fns, corpus);
  if (via === 'hermana') porHermana += 1;
  (via ? con : sin).push(`${fichero} :: ${fns.join(', ')}`);
}

console.log(`INSTRUMENTOS censados: ${inst.length} funciones en ${porModulo.size} modulos`);
console.log(`  CON caso fabricado delante: ${con.length}  (${con.length - porHermana} en la función censada`
  + ` misma, ${porHermana} en una hermana que ella llama o que la llama)`);
console.log(`  SIN ninguno:                ${sin.length}`);

console.log('\nSUELO — los tres que YA sé que lo tienen:');
let sueloOk = true;
for (const n of ['tautologiasDe', 'enPatronPeligroso', 'censarReferenciaMovil']) {
  const ok = con.some((x) => x.includes(n));
  if (!ok) sueloOk = false;
  console.log(`  ${ok ? '✅ CON' : (sin.some((x) => x.includes(n)) ? '🔴 SIN' : '🔴 no censado')}  ${n}`);
}
// ── CONTROL NEGATIVO, AHORA SEMBRADO ────────────────────────────────────────────────────────
// Antes era una LISTA DE NOMBRES que yo sabía sin caso. Caducó: los tres tienen caso hoy, así
// que el control se puso en rojo sin que hubiera nada roto — y al seguirlo encontré que lo roto
// era otra cosa (la hermana trivial). Una lista cableada mide el pasado; un módulo SEMBRADO mide
// el censo. Se juzgan con la MISMA función que los de verdad, o el suelo no prueba este suelo.
const MODULO_SEMBRADO = [
  'export function censarInventado(raiz) { return leerElArbol(raiz); }',
  'export function ayudanteTrivial(t) { return t.trim(); }',
].join('\n');
const seSiembra = (llamada) => moduloDemuestraQueVe(MODULO_SEMBRADO, ['censarInventado'],
  ['censarInventado', 'ayudanteTrivial'], [{ f: 'sembrado.mjs', s: llamada }]);

console.log('\nCONTROL NEGATIVO — sembrado, en los dos sentidos:');
const negTrivial = seSiembra("ayudanteTrivial('literal'); censarInventado(RAIZ);");
const negNada = seSiembra('censarInventado(RAIZ);');
const posPropio = seSiembra("censarInventado('fuente fabricada');");
const negOk = negTrivial === null && negNada === null;
console.log(`  ${negNada === null ? '✅' : '🔴'} un censo que sólo recibe la raíz sale SIN`);
console.log(`  ${negTrivial === null ? '✅' : '🔴'} una HERMANA trivial con literal, sin arista, NO lo salva`
  + (negTrivial ? `  (dice «${negTrivial}»)` : ''));
console.log(`  ${posPropio === 'propio' ? '✅' : '🔴'} y sí lo salva un literal en la censada misma`);
const neg = negOk && posPropio === 'propio';

if (!sueloOk || !neg) {
  console.log(`\n🔴 CENSO ${sueloOk ? 'DEMASIADO GENEROSO' : 'CIEGO'}: ${sueloOk
    ? 'da por bueno un módulo sembrado que no tiene caso.'
    : 'no reconoce casos fabricados que sé que existen.'}`);
  console.log('   La lista de abajo NO se puede leer como «éstos son exactamente los que no tienen caso».');
  process.exit(2);
}
console.log(`\nSIN CASO CONOCIDO (${sin.length}) — pueden dar un cero y nadie sabrá si es real:`);
for (const x of sin) console.log('    ' + x);
