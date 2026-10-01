// scripts/_tests-que-cubren.mjs — SCRUM-1363
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ CONTESTA ESTO: «he tocado ESTOS ficheros: ¿qué tests me pueden caer?»
//
// Una tanda DIRIGIDA armada a mano se elige por NOMBRE —«los tests que nombran el fichero que he
// tocado»— y hay una clase entera de tests que ninguna selección por nombre incluye nunca: los
// trinquetes y censos que RECORREN un directorio. Medido el 1-oct-2026: `scrum713c` hace
// `readdirSync` de `public/dashboard/js` y cuenta estilos en línea; quien tocó
// `albaranDetailView.js` armó su dirigida con los tests que lo nombran, pasó en verde, y el CI
// cayó por ese trinquete (337 contra un techo de 336).
//
// ── LOS TRES CUBOS, POR TEST ─────────────────────────────────────────────────────────────────
//   · NOMBRA   — escribe la ruta del fichero (él, o un módulo que importa).
//   · RECORRE  — escribe la ruta de un DIRECTORIO que lo contiene. No se exige probar que lo
//                recorre entero: quien nombra un directorio puede estar contando sobre él, y de
//                eso es de lo que una dirigida no puede prescindir.
//   · NO SÉ    — enumera el árbol por un camino que no se puede leer en el fuente: un
//                `readdirSync` sobre algo que no resuelve a un directorio, o un `git ls-files` /
//                `git grep`. Entra SIEMPRE en la dirigida. «No sé qué lee» no es «no lee esto».
//
// ── DE QUÉ NO RESPONDE, DICHO ────────────────────────────────────────────────────────────────
//   · Es ESTÁTICO: lee el fuente, no ejecuta. Una ruta que se compone en ejecución con trozos que
//     no están escritos (`path.join(RAIZ, carpeta, nombre)`) no se ve.
//   · El grafo de `src/` se sigue por sus `import` relativos. Lo que un test alcanza por otra vía
//     (un servidor levantado, una base) no sale.
//   · NO sustituye a la tanda completa. El juez es el CI; esto decide qué merece la pena correr
//     antes de empujar.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

export const NOMBRA = 'NOMBRA';
export const RECORRE = 'RECORRE';
export const NO_SE = 'NO_SE';

/** Las llamadas que LISTAN un directorio. */
const LISTAN = new Set(['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync', 'glob']);
/** Subcomandos de git que enumeran el árbol o su historia: lo que leen no está en el fuente. */
const GIT_QUE_ENUMERA = new Set(['ls-files', 'grep', 'ls-tree', 'diff', 'status']);

const aPosix = (p) => p.split(path.sep).join('/');

/** Los imports relativos de un fuente: el especificador y, si los hay, sus nombres (`local` ← `importado`). */
function importsDe(sf) {
  const out = [];
  (function mirar(n) {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) {
      const nombres = [];
      const lig = ts.isImportDeclaration(n) && n.importClause && n.importClause.namedBindings;
      if (lig && ts.isNamedImports(lig)) {
        for (const e of lig.elements) nombres.push({ local: e.name.text, importado: (e.propertyName || e.name).text });
      }
      out.push({ de: n.moduleSpecifier.text, nombres });
    }
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword
        && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) out.push({ de: n.arguments[0].text, nombres: [] });
    ts.forEachChild(n, mirar);
  })(sf);
  return out;
}

/** La función que encierra a un nodo, y su nombre si lo tiene (`function f` o `const f = () =>`). */
function funcionDe(n) {
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p;
  return null;
}
function nombreDe(fn) {
  if (!fn) return null;
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  if (fn.parent && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text;
  return null;
}

/**
 * Lo que UN fuente dice, sin seguir sus imports.
 *
 *   · `ficheros`   — rutas de FICHERO escritas en él (existentes).
 *   · `listados`   — directorios que LISTA (`readdirSync` y familia) y que se resuelven leyendo.
 *   · `noSe`       — listados cuyo directorio NO se resuelve, y enumeraciones que hace git.
 *   · `caminantes` — funciones que listan un directorio que les llega por PARÁMETRO
 *                    (`function andar(dir) { fs.readdirSync(dir) … }`): qué listan lo decide quien
 *                    las llama, así que se resuelve en cada llamada, también desde otro fichero.
 *   · `importa`    — los módulos locales de los que depende.
 *
 * `caminantesDe(rel)` devuelve los caminantes de un módulo importado (o `null`).
 */
export function leerFuente(rel, codigo, raiz, caminantesDe = () => null) {
  const esTs = rel.endsWith('.ts');
  const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, esTs ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const dirDelFichero = path.posix.dirname(rel);
  const ficheros = new Set();
  const listados = new Set();
  const noSe = new Map();
  const importa = [];

  /** ¿Existe esta ruta relativa al repositorio? La raíz misma no cuenta. */
  const clase = (r) => {
    const limpia = path.posix.normalize(r).replace(/^\.\//, '').replace(/\/$/, '');
    if (!limpia || limpia === '.' || limpia.startsWith('..')) return null;
    let st;
    try { st = fs.statSync(path.join(raiz, limpia)); } catch { return null; }
    return { ruta: limpia, tipo: st.isDirectory() ? 'd' : 'f' };
  };
  /** Una ruta ESCRITA: existe como fichero, como directorio, o está escrita y no existe. */
  const porRuta = (texto) => {
    const r = aPosix(texto.replace(/\\/g, '/'));
    // `dist/x.js` es el compilado de `src/x.ts`: quien lee uno depende del otro.
    const fuente = r.replace(/^(\.\.\/)*dist\//, 'src/').replace(/\.js$/, '.ts');
    for (const cand of r === fuente ? [r] : [fuente, r]) {
      const c = clase(cand) || clase(path.posix.join(dirDelFichero, cand));
      if (c) return { estado: c.tipo, ruta: c.ruta };
    }
    return { estado: 'no-existe' };
  };
  const apuntar = (texto) => {
    const c = porRuta(texto);
    if (c.estado !== 'f') return;
    ficheros.add(c.ruta);
    // Un script de la casa nombrado por su ruta se suele LANZAR: lo que él lea también cuenta.
    if (/^(scripts|tests)\/.*\.(mjs|js)$/.test(c.ruta)) importa.push(c.ruta);
  };

  /** Los trozos literales de un `path.join(…)` / `path.resolve(…)`. */
  const trozosDe = (n) => {
    const trozos = [];
    for (const a of n.arguments) {
      if (ts.isStringLiteralLike(a)) trozos.push(a.text);
      else if (ts.isTemplateExpression(a)) { trozos.push(a.head.text); break; } // lo fijo, hasta la primera variable
      else if (trozos.length) break; // una variable EN MEDIO corta la ruta: lo de detrás es de otro sitio
    }
    return trozos.filter((t) => t !== '..' && t !== '.' && t !== '');
  };

  /**
   * ¿A qué apunta esta expresión? `d`/`f` con su ruta, `no-existe` (escrita, pero no está),
   * `param` (es un parámetro de la función que la encierra: lo decide quien llama) o `desconocido`.
   */
  const resolver = (n, prof = 0) => {
    const NO = { estado: 'desconocido' };
    if (!n || prof > 5) return NO;
    if (ts.isStringLiteralLike(n)) return porRuta(n.text);
    if (ts.isTemplateExpression(n)) return n.head.text ? porRuta(n.head.text) : NO;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ['join', 'resolve'].includes(n.expression.name.text)) {
      const t = trozosDe(n);
      if (t.length) return porRuta(t.join('/'));
      return n.arguments.length === 1 ? resolver(n.arguments[0], prof + 1) : NO;
    }
    if (ts.isIdentifier(n)) {
      for (let fn = funcionDe(n); fn; fn = funcionDe(fn)) {
        const i = fn.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === n.text);
        if (i < 0) continue;
        if (fn.parameters[i].initializer) return resolver(fn.parameters[i].initializer, prof + 1);
        const nombre = nombreDe(fn);
        return nombre ? { estado: 'param', fn: nombre, indice: i } : NO;
      }
      let ini = null;
      (function buscar(m) {
        if (ini) return;
        if (ts.isVariableDeclaration(m) && ts.isIdentifier(m.name) && m.name.text === n.text && m.initializer) ini = m.initializer;
        ts.forEachChild(m, buscar);
      })(sf);
      return ini ? resolver(ini, prof + 1) : NO;
    }
    return NO;
  };

  const lineaDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const apuntarNoSe = (n, que) => noSe.set(`${n.getStart(sf)}·${que}`, { fichero: rel, linea: lineaDe(n), que });
  const recortar = (n) => (n ? n.getText(sf).replace(/\s+/g, ' ').slice(0, 60) : '');

  // Caminantes conocidos: los que llegan importados, y los que se descubran aquí.
  const caminantes = new Map();
  const sumar = (nombre, indice) => {
    if (!caminantes.has(nombre)) caminantes.set(nombre, new Set());
    if (caminantes.get(nombre).has(indice)) return false;
    caminantes.get(nombre).add(indice);
    return true;
  };
  const propios = new Set();
  for (const imp of importsDe(sf)) {
    if (!imp.de.startsWith('.')) continue;
    const destino = path.posix.join(dirDelFichero, imp.de);
    // Un import de `dist/` es, para lo que aquí importa, un import de su fuente en `src/`.
    const cands = [destino, destino.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts'),
      destino.replace(/\.js$/, '.ts'), `${destino}.ts`, `${destino}/index.ts`];
    const hallado = cands.find((c) => clase(c)?.tipo === 'f');
    if (!hallado) continue;
    const relImportado = path.posix.normalize(hallado);
    importa.push(relImportado);
    const suyos = imp.nombres.length ? caminantesDe(relImportado) : null;
    if (!suyos) continue;
    for (const { local, importado } of imp.nombres) {
      for (const i of suyos.get(importado) || []) sumar(local, i);
    }
  }

  /** Decide qué hacer con el directorio que alguien lista (o le pasa a un caminante). */
  const juzgar = (arg, donde, que) => {
    const r = resolver(arg);
    if (r.estado === 'd') { listados.add(r.ruta); return false; }
    if (r.estado === 'param') { propios.add(r.fn); return sumar(r.fn, r.indice); }
    if (r.estado === 'desconocido') apuntarNoSe(donde, que);
    return false; // `f` y `no-existe`: escrito y resuelto, no hay nada que recorrer ahí
  };

  // 🔴 EL NOMBRE SUELTO. Media casa lee un fichero con el directorio en una constante y el nombre
  // aparte —`path.join(DIR, 'homeView.js')`, `leer('homeView.js')`—, y esa ruta entera no está
  // escrita en ningún sitio. Se apunta el NOMBRE cuando va en una cadena del código (no en un
  // comentario: por AST). Dos ficheros con el mismo nombre en carpetas distintas se confunden, y
  // se confunden hacia el lado bueno: entra un test de más, nunca uno de menos.
  const nombres = new Set();
  const NOMBRE_DE_FICHERO = /^[\w@-][\w.@-]*\.[A-Za-z0-9]{1,6}$/;
  const apuntarNombre = (texto) => {
    const ultimo = texto.replace(/\\/g, '/').split('/').pop();
    if (ultimo && NOMBRE_DE_FICHERO.test(ultimo)) nombres.add(ultimo);
  };

  const llamadas = [];
  (function mirar(n) {
    if (ts.isStringLiteralLike(n) && n.text.length < 200) apuntarNombre(n.text);
    if (ts.isStringLiteralLike(n) && /[\\/]/.test(n.text) && n.text.length < 200) apuntar(n.text);
    if (ts.isTemplateExpression(n) && n.head.text.includes('/')) apuntar(n.head.text);
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nom = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : '';
      if (['join', 'resolve'].includes(nom)) {
        const t = trozosDe(n);
        if (t.length) apuntar(t.join('/'));
      }
      if (LISTAN.has(nom)) juzgar(n.arguments[0], n, `${nom}(${recortar(n.arguments[0])})`);
      else if (ts.isIdentifier(c)) llamadas.push(n);
      // `exec*('git', ['ls-files', …])`: la lista de ficheros la da git, no el fuente.
      const a = n.arguments;
      if (/^(exec|execSync|execFile|execFileSync|spawn|spawnSync)$/.test(nom) && a[0] && ts.isStringLiteralLike(a[0])) {
        const partes = a[0].text === 'git' && a[1] && ts.isArrayLiteralExpression(a[1])
          ? a[1].elements.filter(ts.isStringLiteralLike).map((e) => e.text)
          : a[0].text.startsWith('git ') ? a[0].text.split(/\s+/).slice(1) : [];
        const sub = partes.find((p) => !p.startsWith('-'));
        if (sub && GIT_QUE_ENUMERA.has(sub)) apuntarNoSe(n, `git ${sub}`);
      }
    }
    ts.forEachChild(n, mirar);
  })(sf);

  // Las llamadas a un caminante: el directorio lo pone quien llama. Se repite mientras aparezcan
  // caminantes nuevos (`f(dir)` que llama a `andar(dir)` es caminante a su vez).
  for (let crece = true; crece;) {
    crece = false;
    for (const n of llamadas) {
      const indices = caminantes.get(n.expression.text);
      if (!indices) continue;
      // La recursión no dice nada nuevo, aunque vaya dentro de un `forEach` de la propia función.
      let recursiva = false;
      for (let fn = funcionDe(n); fn; fn = funcionDe(fn)) if (nombreDe(fn) === n.expression.text) recursiva = true;
      if (recursiva) continue;
      for (const i of indices) {
        if (!n.arguments[i]) continue;
        if (juzgar(n.arguments[i], n, `${n.expression.text}(${recortar(n.arguments[i])})`)) crece = true;
      }
    }
  }

  // Sólo se ofrecen a quien importe los caminantes DECLARADOS aquí, no los que se recibieron.
  const exporta = new Map([...caminantes].filter(([nombre]) => propios.has(nombre)));
  return { ficheros, nombres, listados, noSe: [...noSe.values()], importa, caminantes: exporta };
}

/**
 * El análisis de TODOS los tests del árbol. Cada test arrastra lo de los módulos que importa
 * (los suyos de `tests/` y `scripts/`, y el grafo de `src/` detrás de un import de `dist/`).
 */
export function analizarArbol(raiz) {
  const dirTests = path.join(raiz, 'tests');
  const tests = fs.existsSync(dirTests)
    ? fs.readdirSync(dirTests).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `tests/${f}`)
    : [];
  const cache = new Map();
  const ilegibles = [];
  const leer = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    // Mientras se lee, vale `null`: un import circular no encuentra caminantes, y no se cuelga.
    cache.set(rel, null);
    let dato = null;
    try {
      dato = leerFuente(rel, fs.readFileSync(path.join(raiz, rel), 'utf8'), raiz, (imp) => leer(imp)?.caminantes || null);
    } catch (e) { ilegibles.push(`${rel}: ${e.message}`); }
    cache.set(rel, dato);
    return dato;
  };

  const porTest = new Map();
  for (const t of tests) {
    const vistos = new Set();
    const ficheros = new Set([t]);
    const listados = new Set();
    const nombres = new Set();
    const noSe = [];
    const cola = [t];
    while (cola.length) {
      const rel = cola.pop();
      if (vistos.has(rel)) continue;
      vistos.add(rel);
      const d = leer(rel);
      if (!d) { noSe.push({ fichero: rel, linea: 0, que: 'no se pudo leer' }); continue; }
      ficheros.add(rel);
      for (const f of d.ficheros) ficheros.add(f);
      // Lo que un módulo de `src/` lista en ejecución es cosa de la aplicación, no del test.
      if (!rel.startsWith('src/')) {
        for (const x of d.listados) listados.add(x);
        for (const x of d.nombres) nombres.add(x);
        noSe.push(...d.noSe);
      }
      cola.push(...d.importa);
    }
    porTest.set(t, { ficheros, nombres, listados, noSe });
  }
  return { tests, porTest, ilegibles, enDisco: tests.length };
}

/** Por qué un test cubre un fichero tocado, o `null`. Gana la razón más precisa. */
export function razonDe(dato, tocado) {
  if (dato.ficheros.has(tocado)) return { cubo: NOMBRA, por: tocado };
  const nombre = path.posix.basename(tocado);
  if (dato.nombres.has(nombre)) return { cubo: NOMBRA, por: `«${nombre}» (el nombre suelto, sin su carpeta)` };
  let mejor = null;
  for (const d of dato.listados) {
    if (tocado.startsWith(`${d}/`) && (!mejor || d.length > mejor.length)) mejor = d;
  }
  if (mejor) return { cubo: RECORRE, por: mejor };
  if (dato.noSe.length) return { cubo: NO_SE, por: `${dato.noSe[0].fichero}:${dato.noSe[0].linea} ${dato.noSe[0].que}` };
  return null;
}

/**
 * La selección. `tocados` son rutas relativas al repositorio, con `/`.
 * Devuelve la lista de tests, por qué entra cada uno, y los tocados que NADIE cubre a la vista.
 */
export function seleccionar(arbol, tocados) {
  const elegidos = new Map();
  const sinCobertura = [];
  for (const tocado of tocados) {
    let alguno = false;
    for (const t of arbol.tests) {
      const r = razonDe(arbol.porTest.get(t), tocado);
      if (!r) continue;
      if (r.cubo !== NO_SE) alguno = true;
      const previo = elegidos.get(t);
      // Un test que entra por NO SÉ y además NOMBRA otro tocado se queda con la razón que se ve.
      if (!previo || (previo.cubo === NO_SE && r.cubo !== NO_SE)) elegidos.set(t, { ...r, tocado });
    }
    if (!alguno) sinCobertura.push(tocado);
  }
  const cuenta = { [NOMBRA]: 0, [RECORRE]: 0, [NO_SE]: 0 };
  for (const r of elegidos.values()) cuenta[r.cubo] += 1;
  return { elegidos, sinCobertura, cuenta };
}

/**
 * La selección que se hace A MANO y que este ticket viene a sustituir: los tests cuyo TEXTO
 * contiene el nombre del fichero tocado. Existe para poder enseñar la diferencia, no para usarla.
 */
export function seleccionPorNombre(raiz, arbol, tocado) {
  const base = path.posix.basename(tocado).replace(/\.[^.]+$/, '');
  return arbol.tests.filter((t) => fs.readFileSync(path.join(raiz, t), 'utf8').includes(base));
}

/** Motivos para NO fiarse del análisis. Vacío = se puede usar. */
export function motivosParaNoFiarse(arbol) {
  const m = [];
  if (!arbol.tests.length) m.push('CERO tests en `tests/`: no hay población.');
  if (arbol.porTest.size !== arbol.enDisco) m.push(`se analizaron ${arbol.porTest.size} tests y en disco hay ${arbol.enDisco}.`);
  if (arbol.ilegibles.length) m.push(`${arbol.ilegibles.length} fuentes no se pudieron leer: ${arbol.ilegibles.slice(0, 3).join(' · ')}`);
  const conAlgo = [...arbol.porTest.values()].filter((d) => d.listados.size || d.ficheros.size > 1).length;
  if (arbol.tests.length && conAlgo < arbol.tests.length / 2) {
    m.push(`sólo ${conAlgo} de ${arbol.tests.length} tests nombran algún fichero o directorio: el lector de rutas no está viendo.`);
  }
  return m;
}
