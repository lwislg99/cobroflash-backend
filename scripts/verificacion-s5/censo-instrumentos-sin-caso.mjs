// scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs — SCRUM-846 · carril de VERIFICACIÓN
//
// ¿Qué instrumentos de medición tienen un CASO CONOCIDO FABRICADO delante?
//
// Un instrumento que sólo lee el árbol de verdad devuelve un cero que no distingue «no hay nada» de
// «el detector está roto». Este censo busca, para cada función exportada que produce una medida, al
// menos una llamada en `scripts/` o `tests/` cuyo primer argumento sea una entrada FABRICADA.
//
// Dos usos y UNA sola función, para que el trinquete no mida por otro camino que el censo:
//   · a mano ....... node scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs
//   · en la tanda .. `tests/scrum846c-trinquete-instrumentos-con-caso.test.mjs` (SCRUM-846c) importa
//                    `censoDeInstrumentos` y cae si aparece un instrumento sin caso.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ejecutadoDirectamente } from '../_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NL = String.fromCharCode(10);

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

// ── POBLACIÓN: funciones EXPORTADAS cuyo nombre dice que producen una medida.
//
// 🔴 POR AST, NO POR TEXTO (SCRUM-846c). La versión anterior buscaba `export function` con una regex
// sobre el fichero, y eso casa también dentro de un literal de cadena. El trinquete de la tanda lleva,
// a propósito, un instrumento de mentira escrito en una cadena para verse caer: con la regex, el
// trinquete se habría acusado a sí mismo. Sólo cuenta una declaración `export function` de verdad,
// de primer nivel.
export const VERBOS = /^(censar|censo|detectar|barrer|analizar|clasificar|contar|medir|inventario|escanear|rastroDe|tautologiasDe|enPatronPeligroso)/i;
export const CARPETAS = ['scripts', 'tests'];

const cacheDeArboles = new Map();
/** El AST de un texto, parseado UNA vez: el censo pregunta muchas veces por el mismo fichero. */
function arbolDe(fuente) {
  let sf = cacheDeArboles.get(fuente);
  if (!sf) {
    sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    cacheDeArboles.set(fuente, sf);
  }
  return sf;
}

/** Los nombres de las funciones que el módulo EXPORTA de verdad: declaraciones de primer nivel. */
export function exportadasDe(fuente) {
  return arbolDe(fuente).statements
    .filter((s) => ts.isFunctionDeclaration(s) && s.name
      && (s.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
    .map((s) => s.name.text);
}

/** Los `.mjs` de PRIMER NIVEL de las carpetas censadas, con su texto. Las subcarpetas no entran. */
function leerCorpus(raiz) {
  const corpus = [];
  for (const d of CARPETAS) {
    const dir = path.join(raiz, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (f.endsWith('.mjs')) corpus.push({ f: `${d}/${f}`, s: fs.readFileSync(path.join(dir, f), 'utf8') });
    }
  }
  return corpus;
}

/**
 * ¿Es este argumento una ENTRADA FABRICADA? Un literal, un árbol temporal, una mutación inyectada,
 * o un nombre que el AST resuelve —en SU ámbito— a una de esas cosas. Lo contrario es una entrada
 * leída del árbol (fs, git, la instantánea): eso no demuestra que el instrumento VEA — si el árbol
 * está limpio, un cero sale igual estando roto el detector.
 *
 * 🔴 CUARTA CORRECCIÓN (15-sep-2026). Este criterio era de REGEX sobre el texto del fichero, y
 * mentía hacia los dos lados. Juzgados a mano los módulos donde un criterio laxo y uno estricto
 * discrepaban, el censo comiteado fallaba en 4, los cuatro hacia «tiene caso»:
 *   · el for-of desestructurado casaba CUALQUIER for-of del fichero sin mirar el nombre, así que
 *     `censoCopy(RAIZ, …)` contaba como fabricado porque en otra parte del test había uno;
 *   · TODO acceso a propiedad contaba: `inventario(r.contenedor)`, con `r` = la vista de verdad.
 * Y un estricto ingenuo fallaba en los otros: no veía un árbol temporal (`mkdtempSync` relleno de
 * ficheros literales), ni un literal que entra por un envoltorio (`ve('…')` con
 * `ve = (fuente) => censar(fuente)`), y se tragaba `process.argv.slice(2)` como fabricado.
 * Ahora el nombre se RESUELVE por AST en su ámbito léxico, y cada forma es una regla con su
 * siembra en el control negativo. Más reglas salieron al calibrar cada versión contra el juicio a
 * mano, y cada una lleva el módulo que la destapó:
 *   · un literal pasado a OTRA llamada, o alcanzado por resolución, sólo fabrica si sus HOJAS son
 *     fabricadas. `run({ files: ficheros.map(…), cwd: RAIZ })` son opciones para ejecutar los tests
 *     de verdad (`censo-guards-gateados`), y `for (const p of [...todos, ...entradas])` reempaqueta
 *     lo leído. El literal pasado DIRECTAMENTE al detector sigue siendo su entrada;
 *   · `replace(literal, literal)` sobre lo leído SÍ es un caso conocido: es el rojo reinyectado de la
 *     casa, se sabe qué se ha metido y qué tiene que verse. Con una regex es normalizar, no inyectar;
 *   · un árbol temporal también entra por un constructor LOCAL (`arbolSintetico()`, que llama a
 *     `mkdtempSync`) o por el CALLBACK al que se lo pasa (`conArbol((raiz) => …)`), y una ruta
 *     `path.join(raiz, …)` dentro de él sigue siendo fabricada; `path.join(RAIZ, …)` no.
 */
function llamaA(e, sf) {
  return norm(e.expression.getText(sf)).split('.');
}
// Lo que LEE el mundo de verdad. Por segmentos y prefijos, no por subcadena: `digitos` no es git.
function lee(e, sf) {
  return llamaA(e, sf).some((p) => ['fs', 'process', 'child_process'].includes(p)
    || ['read', 'exec', 'spawn', 'leer', 'cargar', 'git'].some((pre) => p.startsWith(pre)));
}
/** La función LOCAL con ese nombre —declarada o asignada a un const—, o null. */
function funcionLocal(sf, nombre) {
  let hallada = null;
  const v = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre) hallada = n;
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer
      && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) hallada = n.initializer;
    if (!hallada) ts.forEachChild(n, v);
  };
  v(sf);
  return hallada;
}
const esCadenaLiteral = (x) => !!x && (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)
  || ts.isTemplateExpression(x));
const esLiteral = (e) => !!e && (esCadenaLiteral(e) || ts.isNumericLiteral(e)
  || ts.isArrayLiteralExpression(e) || ts.isObjectLiteralExpression(e));
/**
 * Las dos formas de crear un árbol temporal en esta casa.
 *
 * 🔴 `temporal` ENTRA AQUÍ EN SCRUM-864c, Y NO AFLOJA NADA. Es el ayudante de la casa
 * (`tests/_temporal.mjs`): por dentro hace `fs.mkdtempSync(path.join(os.tmpdir(), prefijo))` y
 * además se compromete a borrarlo. Desde SCRUM-864c es la forma OBLIGATORIA de crear un temporal
 * —`scrum864c-el-temporal-no-vuelve` exige cero llamadas sueltas—, así que sin este reconocimiento
 * el trinquete acusaría de «no tener caso conocido» a instrumentos que SÍ lo tienen, sólo porque
 * su fixture dejó de fugar. Y el arreglo que pediría sería volver a fugar temporales.
 *
 * La exigencia es la misma: hace falta una entrada FABRICADA. Lo único que cambia es que se
 * reconoce la forma nueva de fabricarla. Que `temporal()` siga colgando de `os.tmpdir()` no es
 * una promesa escrita: lo vigila un caso de `tests/scrum864-el-temporal-que-se-borra.test.mjs`.
 */
const CREAN_ARBOL = new Set(['mkdtempSync', 'temporal']);

function esArbolTemporal(e, sf) {
  if (!e || !ts.isCallExpression(e)) return false;
  if (CREAN_ARBOL.has(llamaA(e, sf).pop())) return true;
  // `arbolSintetico()`: una función LOCAL que crea el árbol con una de las dos también lo es.
  if (!ts.isIdentifier(e.expression)) return false;
  const g = funcionLocal(sf, e.expression.text);
  if (!g) return false;
  let crea = false;
  const v = (n) => {
    if (ts.isCallExpression(n) && CREAN_ARBOL.has(llamaA(n, sf).pop())) crea = true;
    if (!crea) ts.forEachChild(n, v);
  };
  ts.forEachChild(g, v);
  return crea;
}
const esMutacion = (e) => !!e && ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)
  && ['replace', 'replaceAll'].includes(e.expression.name.text)
  && e.arguments.length >= 2 && esCadenaLiteral(e.arguments[0]) && esCadenaLiteral(e.arguments[1]);
// Métodos que no cambian la PROCEDENCIA: lo que sale es tan fabricado como aquello sobre lo que operan.
const TRANSPARENTES = ['map', 'filter', 'flatMap', 'slice', 'concat', 'join', 'split', 'trim', 'replace', 'entries', 'values', 'keys'];
const PROFUNDIDAD = 8;

/** Un literal anidado en OTRA llamada, o alcanzado por resolución: fabrica sólo si todas sus hojas lo son. */
function hojasFabricadas(x, sf, prof) {
  if (!x || prof > PROFUNDIDAD) return false;
  if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || ts.isNumericLiteral(x)) return true;
  if (x.kind === ts.SyntaxKind.TrueKeyword || x.kind === ts.SyntaxKind.FalseKeyword || x.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isPrefixUnaryExpression(x) && ts.isNumericLiteral(x.operand)) return true;
  if (ts.isTemplateExpression(x)) return x.templateSpans.every((s) => esFabricado(s.expression, sf, null, prof + 1));
  if (ts.isArrayLiteralExpression(x)) {
    return x.elements.every((el) => (ts.isSpreadElement(el)
      ? esFabricado(el.expression, sf, null, prof + 1) : hojasFabricadas(el, sf, prof + 1)));
  }
  if (ts.isObjectLiteralExpression(x)) {
    return x.properties.every((p) => (ts.isPropertyAssignment(p) ? hojasFabricadas(p.initializer, sf, prof + 1)
      : ts.isShorthandPropertyAssignment(p) ? esFabricado(p.name, sf, null, prof + 1) : false));
  }
  return esFabricado(x, sf, null, prof + 1);
}

/** Resuelve un nombre en el ámbito léxico del nodo: una declaración, un parámetro o la variable de un bucle. */
function resolver(nodo, nombre) {
  const nombra = (b) => (ts.isIdentifier(b) ? b.text === nombre
    : (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b))
      ? b.elements.some((el) => !ts.isOmittedExpression(el) && nombra(el.name)) : false);
  for (let p = nodo.parent; p; p = p.parent) {
    if ((ts.isForOfStatement(p) || ts.isForInStatement(p) || ts.isForStatement(p))
      && p.initializer && ts.isVariableDeclarationList(p.initializer)
      && p.initializer.declarations.some((x) => nombra(x.name))) {
      return ts.isForOfStatement(p) ? { tipo: 'bucle', origen: p.expression } : null;
    }
    if (ts.isFunctionLike(p) && p.parameters) {
      const i = p.parameters.findIndex((q) => nombra(q.name));
      if (i >= 0) return { tipo: 'parametro', funcion: p, indice: i };
    }
    if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isCaseClause(p) || ts.isDefaultClause(p)) {
      for (const st of p.statements) {
        if (!ts.isVariableStatement(st)) continue;
        const d = st.declarationList.declarations.find((x) => nombra(x.name));
        if (d) return { tipo: 'declaracion', origen: d.initializer };
      }
    }
  }
  return null;
}

function esFabricado(a, sf, _fuente, prof = 0) {
  if (!a || prof > PROFUNDIDAD) return false;
  // El literal DIRECTO al detector es su entrada. Uno alcanzado por resolución —el origen de un
  // `for (const p of [...todos, ...entradas])`— sólo cuenta si sus HOJAS son fabricadas:
  // reempaquetar lo leído en un array no lo convierte en fixture.
  if (prof === 0 && esLiteral(a)) return true;
  if (prof > 0 && esLiteral(a)) return hojasFabricadas(a, sf, prof);
  if (esArbolTemporal(a, sf) || esMutacion(a)) return true;
  if (ts.isAwaitExpression(a) || ts.isParenthesizedExpression(a)) return esFabricado(a.expression, sf, _fuente, prof + 1);
  if (ts.isCallExpression(a) || ts.isNewExpression(a)) {
    const args = a.arguments || [];
    // `Object.entries(CASOS)`: tan fabricado como CASOS.
    const callee = norm(a.expression.getText(sf));
    if (['Object.entries', 'Object.values', 'Object.keys'].includes(callee)) return esFabricado(args[0], sf, _fuente, prof + 1);
    // `CASOS.map(…)`, `'…'.split(…)`: tan fabricado como aquello sobre lo que opera. Pero no
    // `path.join(…)`: su base es un MÓDULO importado, no un dato, y el AST no lo resuelve.
    const acceso = ts.isPropertyAccessExpression(a.expression) ? a.expression : null;
    const baseEsModulo = acceso && ts.isIdentifier(acceso.expression) && !resolver(acceso.expression, acceso.expression.text);
    if (acceso && TRANSPARENTES.includes(acceso.name.text) && !baseEsModulo && !lee(a, sf)) {
      return esFabricado(acceso.expression, sf, _fuente, prof + 1);
    }
    // Una llamada que FABRICA: no lee, sus argumentos tienen hojas fabricadas y al menos uno no es
    // un número suelto. `Buffer.from('…')`, `arbolDeMentira({ … })` o `path.join(dirTemporal, 'a')`
    // sí; `process.argv.slice(2)`, `run({ files: ficheros, cwd: RAIZ })` o `path.join(RAIZ, 'a')` no.
    return args.length > 0 && args.every((x) => hojasFabricadas(x, sf, prof + 1))
      && args.some((x) => !ts.isNumericLiteral(x)) && !lee(a, sf);
  }
  let base = a;
  while (ts.isPropertyAccessExpression(base) || ts.isElementAccessExpression(base)) base = base.expression;
  if (!ts.isIdentifier(base)) return false;
  const r = resolver(base, base.text);
  if (!r) return false;
  if (r.tipo === 'declaracion' || r.tipo === 'bucle') return esFabricado(r.origen, sf, _fuente, prof + 1);
  // El literal entra por un ENVOLTORIO: `const ve = (fuente) => censar(fuente)` y después `ve('…')`.
  const f = r.funcion;
  const nombreF = f.name && ts.isIdentifier(f.name) ? f.name.text
    : (f.parent && ts.isVariableDeclaration(f.parent) && ts.isIdentifier(f.parent.name) ? f.parent.name.text : null);
  if (!nombreF) {
    // …o por el CALLBACK de un constructor de árbol local: `conArbol((raiz) => censar(raiz))` con
    // `function conArbol(fn) { const raiz = arbolSintetico(); return fn(raiz); }`.
    const llamada = f.parent;
    if (!llamada || !ts.isCallExpression(llamada) || !ts.isIdentifier(llamada.expression)) return false;
    const k = llamada.arguments.indexOf(f);
    const g = funcionLocal(sf, llamada.expression.text);
    const param = g && k >= 0 ? g.parameters[k] : null;
    if (!param || !ts.isIdentifier(param.name)) return false;
    let visto = false;
    const w = (n) => {
      if (!visto && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === param.name.text
        && esFabricado(n.arguments[r.indice], sf, _fuente, prof + 1)) visto = true;
      if (!visto) ts.forEachChild(n, w);
    };
    ts.forEachChild(g, w);
    return visto;
  }
  let si = false;
  const v = (n) => {
    if (!si && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombreF
      && esFabricado(n.arguments[r.indice], sf, _fuente, prof + 1)) si = true;
    if (!si) ts.forEachChild(n, v);
  };
  v(sf);
  return si;
}

function tieneCasoFabricado(fuente, fn) {
  const sf = arbolDe(fuente);
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

// 🔴 LA UNIDAD ES EL MODULO, NO LA FUNCION — y me lo enseñó el propio censo. `censarReferenciaMovil`
// recibe la RAIZ del arbol, nunca un literal; quien recibe los casos fabricados es su hermana
// `analizarFuente`, en el mismo modulo. Contando por funcion, el par salia acusado con un
// autoexamen impecable al lado. Lo que importa es si el MODULO ha demostrado que ve.
//
// 🔴 Y AL BUSCARLE CASO AL MODULO SE MIRAN SUS OTRAS EXPORTADAS, no solo las que casan con VERBOS:
// `frontera-dist` exporta `censoDeLaFrontera` (censada) y `correspondencia` (no censada), y el caso
// fabricado lo recibe la segunda.
//
// 🔴 PERO SÓLO LAS QUE TIENEN ARISTA DE LLAMADA con la censada (tercera corrección). «Mirar todas»
// era demasiado ancho: `_censo-new-url` salía CON por `parseBDSegura`, que su censo ni llama, y
// `_censo-peticiones-panel` por `repartoPorMetodo`, que consume la SALIDA del árbol real. Una arista,
// en cualquiera de los dos sentidos, es lo que hace que la entrada fabricada LLEGUE al detector.
// Comprobado a mano en los 5 candidatos: el criterio reproduce el juicio 5/5.
function aristasDe(fuente) {
  const sf = arbolDe(fuente);
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
 * ¿Ha DEMOSTRADO este módulo que ve? Una sola función, usada por el censo real y por su control
 * negativo sembrado, porque un suelo que corre por otro camino no prueba el camino que importa.
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

/**
 * EL CENSO. Recorre `scripts/*.mjs` y `tests/*.mjs` bajo `raiz` y devuelve, por módulo, si alguna de
 * sus funciones de medida recibe en algún sitio una entrada fabricada.
 *
 * `sin` es la lista que importa: `{ fichero, funciones }` de cada módulo sin ningún caso conocido.
 */
export function censoDeInstrumentos(raiz = RAIZ) {
  const corpus = leerCorpus(raiz);
  const porModulo = new Map();
  let funciones = 0;
  for (const t of corpus) {
    for (const fn of exportadasDe(t.s)) {
      if (!VERBOS.test(fn)) continue;
      funciones += 1;
      if (!porModulo.has(t.f)) porModulo.set(t.f, []);
      porModulo.get(t.f).push(fn);
    }
  }
  const textoDe = new Map(corpus.map((t) => [t.f, t.s]));
  const con = [], sin = [];
  let porHermana = 0;
  for (const [fichero, fns] of porModulo) {
    const fuente = textoDe.get(fichero);
    const via = moduloDemuestraQueVe(fuente, fns, exportadasDe(fuente), corpus);
    if (via === 'hermana') porHermana += 1;
    (via ? con : sin).push({ fichero, funciones: fns, via });
  }
  return { funciones, modulos: porModulo.size, con, sin, porHermana };
}

// ── SUELO: tres módulos que SÉ que tienen caso. Si el censo no los ve, su lista no vale nada.
export const SUELO_CONOCIDOS = ['tautologiasDe', 'enPatronPeligroso', 'censarReferenciaMovil'];

export function sueloDelCenso(censo) {
  return SUELO_CONOCIDOS.map((nombre) => ({
    nombre,
    estado: censo.con.some((m) => m.funciones.includes(nombre)) ? 'CON'
      : (censo.sin.some((m) => m.funciones.includes(nombre)) ? 'SIN' : 'NO CENSADO'),
  }));
}

// ── CONTROL NEGATIVO, SEMBRADO ──────────────────────────────────────────────────────────────
// Antes era una LISTA DE NOMBRES que yo sabía sin caso. Caducó: los tres ganaron caso, así que el
// control se puso en rojo sin que hubiera nada roto — y al seguirlo encontré que lo roto era otra cosa
// (la hermana trivial). Una lista cableada mide el pasado; un módulo SEMBRADO mide el censo. Se juzga
// con la MISMA función que los de verdad, o el suelo no prueba este suelo. Y hay una siembra por cada
// regla del criterio de «fabricado», en el sentido que la rompería.
const MODULO_SEMBRADO = [
  'export function censarInventado(raiz) { return leerElArbol(raiz); }',
  'export function ayudanteTrivial(t) { return t.trim(); }',
].join(NL);
const seSiembra = (llamada) => moduloDemuestraQueVe(MODULO_SEMBRADO, ['censarInventado'],
  ['censarInventado', 'ayudanteTrivial'], [{ f: 'sembrado.mjs', s: llamada }]);

export const REGLAS_SEMBRADAS = [
  ['un censo que sólo recibe la raíz sale SIN', 'censarInventado(RAIZ);', null],
  ['una HERMANA trivial con literal, sin arista, NO lo salva', "ayudanteTrivial('literal'); censarInventado(RAIZ);", null],
  ['y sí lo salva un literal en la censada misma', "censarInventado('fuente fabricada');", 'propio'],
  ['una LECTURA con ruta literal no lo salva', "const T = fs.readFileSync('src/x.ts', 'utf8'); censarInventado(T);", null],
  ['una PROPIEDAD de lo leído no lo salva', 'const r = leerElArbol(RAIZ); censarInventado(r.texto);', null],
  ['un for-of desestructurado AJENO no lo salva', "for (const [a, b] of [['x', 'y']]) { usar(a, b); } censarInventado(RAIZ);", null],
  ['un número suelto no fabrica nada', 'const ficheros = process.argv.slice(2); censarInventado(ficheros);', null],
  ['sí lo salva un ÁRBOL TEMPORAL', "const dir = fs.mkdtempSync('sembrado-'); censarInventado(dir);", 'propio'],
  // SCRUM-864c · el mismo árbol temporal, creado con el ayudante que se limpia solo. Si esta
  // línea deja de decir «propio», el trinquete ha vuelto a castigar a los fixtures que no fugan.
  ['sí lo salva un ÁRBOL TEMPORAL del ayudante de la casa', "const dir = temporal('sembrado-'); censarInventado(dir);", 'propio'],
  ['pero NO lo salva un ayudante cualquiera que se llame parecido', "const dir = temporalizar(RAIZ); censarInventado(dir);", null],
  ['sí lo salva un literal que entra por un ENVOLTORIO', "const ve = (f) => censarInventado(f); ve('fuente fabricada');", 'propio'],
  ['unas OPCIONES literales para ejecutar el mundo no lo salvan', 'const flujo = run({ files: listarFicheros(), cwd: RAIZ }); for (const ev of flujo) censarInventado(ev);', null],
  ['un array que sólo REEMPAQUETA lo leído no lo salva', 'const todos = listar(RAIZ); for (const p of [...todos]) censarInventado(p);', null],
  ['una normalización con REGEX no es una mutación', "const t = fs.readFileSync('a.js', 'utf8'); censarInventado(t.replace(/x/g, 'y'));", null],
  ['sí lo salva una MUTACIÓN inyectada sobre lo leído', "const t = fs.readFileSync('a.js', 'utf8'); censarInventado(t.replace('</body>', '<b>x</b></body>'));", 'propio'],
  ['sí lo salva un fixture cuyas HOJAS son literales', "const raiz = arbolDeMentira({ 'src/a.ts': ['x', 'y'].join(' ') }); censarInventado(raiz);", 'propio'],
  ['sí lo salva el CALLBACK de un constructor de árbol local', "function arbolSintetico() { return fs.mkdtempSync('x'); } function conArbol(fn) { const raiz = arbolSintetico(); return fn(raiz); } conArbol((raiz) => censarInventado(raiz));", 'propio'],
  ['no lo salva el callback de uno que pasa la raíz REAL', 'function conRaiz(fn) { return fn(RAIZ); } conRaiz((raiz) => censarInventado(raiz));', null],
  ['una función local que LEE no es un constructor de árbol', "function leerTodo() { return fs.readdirSync('src'); } censarInventado(leerTodo());", null],
  ['sí lo salva una ruta DENTRO de un árbol temporal', "const dir = fs.mkdtempSync('x'); censarInventado(path.join(dir, 'src/a.ts'));", 'propio'],
  ['no lo salva una ruta dentro del árbol REAL', "censarInventado(path.join(RAIZ, 'src/a.ts'));", null],
];

export function controlNegativoSembrado() {
  return REGLAS_SEMBRADAS.map(([texto, llamada, esperado]) => {
    const dice = seSiembra(llamada);
    return { texto, esperado, dice, ok: dice === esperado };
  });
}

function principal() {
  const censo = censoDeInstrumentos(RAIZ);
  console.log(`INSTRUMENTOS censados: ${censo.funciones} funciones en ${censo.modulos} modulos`);
  console.log(`  CON caso fabricado delante: ${censo.con.length}  (${censo.con.length - censo.porHermana} en la función censada`
    + ` misma, ${censo.porHermana} en una hermana que ella llama o que la llama)`);
  console.log(`  SIN ninguno:                ${censo.sin.length}`);

  console.log(`${NL}SUELO — los tres que YA sé que lo tienen:`);
  const suelo = sueloDelCenso(censo);
  for (const s of suelo) console.log(`  ${s.estado === 'CON' ? '✅ CON' : `🔴 ${s.estado}`}  ${s.nombre}`);

  console.log(`${NL}CONTROL NEGATIVO — sembrado, en los dos sentidos:`);
  const control = controlNegativoSembrado();
  for (const c of control) console.log(`  ${c.ok ? '✅' : '🔴'} ${c.texto}${c.ok ? '' : `  (dice «${c.dice}»)`}`);

  const sueloOk = suelo.every((s) => s.estado === 'CON');
  const controlOk = control.every((c) => c.ok);
  if (!sueloOk || !controlOk) {
    console.log(`${NL}🔴 CENSO ${sueloOk ? 'DESCALIBRADO' : 'CIEGO'}: ${sueloOk
      ? 'su criterio de «fabricado» no distingue lo que su control negativo sembrado exige.'
      : 'no reconoce casos fabricados que sé que existen.'}`);
    console.log('   La lista de abajo NO se puede leer como «éstos son exactamente los que no tienen caso».');
    process.exit(2);
  }
  console.log(`${NL}SIN CASO CONOCIDO (${censo.sin.length}) — pueden dar un cero y nadie sabrá si es real:`);
  for (const m of censo.sin) console.log(`    ${m.fichero} :: ${m.funciones.join(', ')}`);
}

if (ejecutadoDirectamente(import.meta.url)) principal();
