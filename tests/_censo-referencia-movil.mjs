// tests/_censo-referencia-movil.mjs — SCRUM-723
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUIÉN COMPARA CONTRA UN OBJETIVO QUE SE MUEVE
//
// Un guard de PR responde a «¿qué ha cambiado ESTA rama?». Si para contestar lee `origin/main`,
// no está midiendo la rama: está midiendo la DIFERENCIA ENTRE DOS COSAS QUE SE MUEVEN, y el día
// que otro PR entre en `main` se pone rojo acusando a quien no ha tocado nada. Pasó el 4-sep-2026
// (SCRUM-723): el guard de SCRUM-603b acusó a la rama de SCRUM-605 porque SCRUM-594 había entrado
// en `main` tocando el mismo fichero.
//
// La referencia estable de una rama es su PUNTO DE PARTIDA — `git merge-base HEAD origin/main` —,
// que es un commit y no se mueve. Por eso `merge-base` NO es un hallazgo aunque nombre
// `origin/main`: su oficio es precisamente convertir una referencia móvil en un commit fijo.
//
// 🔴 POR AST Y NO POR TEXTO. Un censo de texto se caza a sí mismo en el comentario que explica la
// prohibición (SCRUM-203, y le pasó literalmente a SCRUM-387). Aquí sólo cuentan las cadenas que
// viajan DENTRO de una llamada a git de verdad; este párrafo, que la nombra tres veces, no cuenta.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Las referencias que se mueven bajo los pies. `HEAD` no está: es el árbol bajo prueba. */
export const REFERENCIA_MOVIL = /origin\/(main|HEAD)|(^|[^\w/-])main(:|\b)/;

/** Subcomandos que LEEN contenido o historia y por tanto dependen de contra qué se les apunte. */
const LECTORES = new Set(['show', 'ls-tree', 'cat-file', 'diff', 'log', 'rev-parse', 'rev-list', 'archive', 'grep']);

/** Lo que convierte una referencia móvil en un commit fijo: no es un hallazgo, es la solución. */
const ANCLAS = new Set(['merge-base']);

const ARRANQUES = /^(exec|execSync|execFile|execFileSync|spawn|spawnSync)$/;

const esArranque = (n, sf) => ARRANQUES.test(n.expression.getText(sf).split('.').pop());

/** ¿Esta llamada es `exec*('git', …)`? Devuelve sus argumentos o `null`. */
function argumentosDirectos(n, sf) {
  if (!esArranque(n, sf)) return null;
  const args = n.arguments || [];
  if (!args.length) return null;
  const primero = args[0];
  if (!ts.isStringLiteralLike(primero) || primero.text !== 'git') return null;
  const lista = args[1] && ts.isArrayLiteralExpression(args[1]) ? args[1].elements : args.slice(1);
  return lista.map((e) => (ts.isStringLiteralLike(e) ? e.text : e.getText(sf)));
}

/**
 * 🔴 LOS ENVOLTORIOS, Y ESTO NO ESTABA EN LA PRIMERA VERSIÓN.
 *
 * Media casa no llama a git a pelo: declara `const g = (...a) => execFileSync('git', a, …)` y
 * luego escribe `g('show', 'origin/main:' + rel)`. Mirando sólo los `execFileSync` con `'git'`
 * delante, el censo NO VEÍA ninguna de esas llamadas — y lo cazó su propio test, que usa
 * exactamente ese idioma y salía absuelto. Un censo ciego al idioma más común del árbol devuelve
 * cero y parece un árbol limpio.
 *
 * Un envoltorio es una declaración de nivel de fichero cuyo cuerpo arranca git. Sus llamadas se
 * miden igual que las directas, con TODOS sus argumentos como argumentos de git.
 */
function envoltoriosDeGit(sf, importados = new Map()) {
  const nombres = new Set();
  const registrar = (nombre, cuerpo) => {
    if (!nombre || !cuerpo) return;
    let arranca = false;
    (function mirar(n) {
      if (!arranca && ts.isCallExpression(n) && argumentosDirectos(n, sf)) arranca = true;
      ts.forEachChild(n, mirar);
    })(cuerpo);
    if (arranca) nombres.add(nombre);
  };
  for (const f of funcionesCon(sf)) registrar(f.nombre, f.cuerpo);
  const pasamanos = new Map([...importados, ...pasamanosDeGit(sf, importados)]);
  for (const n of pasamanos.keys()) nombres.add(n);
  return { nombres, pasamanos };
}

/** Las funciones con nombre de un fuente: `function f(…)` y `const f = (…) => …`. */
function funcionesCon(sf) {
  const out = [];
  (function recorrer(n) {
    if (ts.isFunctionDeclaration(n) && n.name) out.push({ nombre: n.name.text, fn: n, cuerpo: n.body });
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      out.push({ nombre: n.name.text, fn: n.initializer, cuerpo: n.initializer.body });
    }
    ts.forEachChild(n, recorrer);
  })(sf);
  return out;
}

/**
 * 🔴 LOS PASAMANOS, Y ESTO TAMPOCO ESTABA (SCRUM-1281).
 *
 * Al envoltorio de arriba se le escapaban tres formas, y las tres dejaban git sin ver:
 *
 *   · el que vive en OTRO fichero. La familia de fixtures de git dejó de escribir
 *     `execFileSync('git', args)` y pasó a `gitDeFixture(args)`, importado. Para el censo, el
 *     fichero que lo importaba DEJÓ DE LLAMAR A GIT —cero llamadas— y se cayó de la lista de los
 *     que nombran la referencia móvil, nombrándola igual que el día anterior;
 *   · el de DOS pisos: `const g = (...args) => gitDeFixture(args, { cwd })`;
 *   · el que recibe los argumentos en un ARRAY o detrás de otro parámetro: `git(['show', ref])`,
 *     `git(raiz, 'log', ref)`. Se leía el array entero —o `raiz`— como si fuera el subcomando, que
 *     entonces no era ningún lector, y la llamada salía absuelta. Medido al arreglarlo: tres
 *     comparaciones contra la punta en `scripts/censo-regla-42.mjs` que nunca habían salido.
 *
 * Un fichero que desaparece de una lista de deuda sin que nadie lo haya arreglado es el censo
 * perdiendo la vista.
 *
 * Un PASAMANOS es una función que le entrega a git UNO DE SUS PROPIOS parámetros como lista de
 * argumentos: a pelo (`exec*('git', args)`) o a través de otro pasamanos, EN EL SITIO donde ese
 * otro los espera. Se apunta cuál es ese parámetro (`indice`) y si es un resto (`...args`).
 *
 * Es una definición ESTRECHA a propósito, por los dos lados:
 *   · una función que simplemente llama a git por dentro NO lo es. Si lo fuera,
 *     `censar('origin/main')` contaría como «argumento de git» y esa cadena saldría de la lista de
 *     indirectas — el censo se taparía los ojos con su propio arreglo;
 *   · y pasarle un parámetro propio a un pasamanos en OTRO sitio tampoco: en `git(raiz, 'log')` el
 *     primero es el directorio, no los argumentos. Sin mirar el sitio, quien llama así sería
 *     pasamanos a su vez y sus llamadas se leerían como git sin serlo.
 *
 * `importados`: nombre local → { indice, resto } de lo que ESTE fuente importa y en su origen lo es.
 */
function pasamanosDeGit(sf, importados = new Map()) {
  const funciones = funcionesCon(sf);
  const hallados = new Map();
  const conocido = (nombre) => hallados.get(nombre) || importados.get(nombre);
  const entrega = (f) => {
    const params = (f.fn.parameters || []).map((p) => ({
      nombre: ts.isIdentifier(p.name) ? p.name.text : null,
      resto: !!p.dotDotDotToken,
    }));
    const propio = (e) => {
      const x = e && ts.isSpreadElement(e) ? e.expression : e;
      if (!x || !ts.isIdentifier(x)) return null;
      const i = params.findIndex((p) => p.nombre === x.text);
      return i < 0 ? null : { indice: i, resto: params[i].resto };
    };
    if (!params.length || !f.cuerpo) return null;
    let es = null;
    (function mirar(n) {
      if (es) return;
      if (ts.isCallExpression(n)) {
        const a = n.arguments || [];
        if (esArranque(n, sf) && a[0] && ts.isStringLiteralLike(a[0]) && a[0].text === 'git') {
          es = propio(a[1]);
        } else if (ts.isIdentifier(n.expression) && conocido(n.expression.text)) {
          es = propio(a[conocido(n.expression.text).indice]);
        }
      }
      // Un piso más abajo los parámetros son de OTRA función: `(cwd) => (...args) => git(args)` no
      // entrega los suyos, entrega los de la flecha de dentro.
      if (n !== f.fn && ts.isFunctionLike(n)) return;
      if (!es) ts.forEachChild(n, mirar);
    })(f.cuerpo);
    return es;
  };
  for (let crece = true; crece;) {
    crece = false;
    for (const f of funciones) {
      if (hallados.has(f.nombre)) continue;
      const es = entrega(f);
      if (es) { hallados.set(f.nombre, es); crece = true; }
    }
  }
  return hallados;
}

/**
 * Los argumentos de git de una llamada a un envoltorio. De un pasamanos se sabe DÓNDE van: desde
 * su parámetro en adelante si es un resto, o los elementos del array que ocupa ese sitio. De un
 * envoltorio a secas no se sabe, y se toman todos, como siempre.
 */
function partesDeEnvoltorio(n, sf, pasamanos) {
  const a = [...(n.arguments || [])];
  const p = ts.isIdentifier(n.expression) ? pasamanos.get(n.expression.text) : null;
  let lista = a;
  if (p) lista = p.resto ? a.slice(p.indice) : (a[p.indice] && ts.isArrayLiteralExpression(a[p.indice]) ? [...a[p.indice].elements] : a.slice(p.indice, p.indice + 1));
  return lista.map((e) => (ts.isStringLiteralLike(e) ? e.text : e.getText(sf)));
}

/** `import { a, b as c } from './x.mjs'` → [{ local, importado, de }], sólo de rutas relativas. */
function importadosDe(sf) {
  const out = [];
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteralLike(s.moduleSpecifier)) continue;
    const de = s.moduleSpecifier.text;
    const lig = s.importClause && s.importClause.namedBindings;
    if (!de.startsWith('.') || !lig || !ts.isNamedImports(lig)) continue;
    for (const e of lig.elements) out.push({ local: e.name.text, importado: (e.propertyName || e.name).text, de });
  }
  return out;
}

/** El subcomando: el primer argumento que no sea una opción global (`-c x=y`, `-C dir`). */
function subcomando(partes) {
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (p === '-c' || p === '-C') { i++; continue; }
    if (p.startsWith('-')) continue;
    return p;
  }
  return null;
}

/**
 * Analiza un FUENTE (no un fichero): así el control positivo no necesita arrancar git.
 *
 * Los argumentos se leen como TEXTO DE FUENTE cuando no son cadenas literales, a propósito: media
 * casa construye el ref con una plantilla (`` `origin/main:${rel}` ``) y el valor sólo existe en
 * ejecución. El texto de fuente sí está aquí y contiene la parte fija, que es la que decide contra
 * qué se compara.
 */
export function analizarFuente(codigo, ruta = 'anonimo.mjs', importados = new Map()) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const envoltorios = envoltoriosDeGit(sf, importados);
  const llamadas = [];
  (function mirar(n) {
    if (ts.isCallExpression(n)) {
      let partes = argumentosDirectos(n, sf);
      if (!partes && ts.isIdentifier(n.expression) && envoltorios.nombres.has(n.expression.text)) {
        partes = partesDeEnvoltorio(n, sf, envoltorios.pasamanos);
      }
      if (partes) {
        const cmd = subcomando(partes);
        const movil = partes.filter((p) => REFERENCIA_MOVIL.test(p));
        llamadas.push({
          ruta,
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          cmd,
          partes,
          movil,
          // Un hallazgo: LEE algo apuntando a una referencia móvil, y no es un `merge-base`.
          esHallazgo: movil.length > 0 && !ANCLAS.has(cmd) && LECTORES.has(cmd),
        });
      }
    }
    ts.forEachChild(n, mirar);
  })(sf);
  return llamadas;
}

/**
 * Ficheros que llaman a git Y escriben la referencia móvil en una cadena FUERA de esos argumentos.
 *
 * 🔴 ESTO EXISTE PORQUE EL CENSO SE QUEDÓ CORTO AL PRIMER INTENTO. `tests/_censo-tickets.mjs`
 * recibe la referencia en un PARÁMETRO con valor por defecto (`ref = 'origin/main'`) y la mete en
 * el git de abajo: mirando sólo los argumentos de la llamada, el censo no la veía. Seguir la
 * cadena hasta la llamada sería análisis de flujo; declararla es medirla y dejarla A LA VISTA, que
 * es la diferencia entre un hueco DECLARADO y uno que nadie sabe que está.
 */
export function referenciaIndirecta(codigo, ruta = 'anonimo.mjs', importados = new Map()) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const envoltorios = envoltoriosDeGit(sf, importados).nombres;
  const dentroDeGit = new Set();
  (function marcarGits(n) {
    if (ts.isCallExpression(n)
        && (argumentosDirectos(n, sf) || (ts.isIdentifier(n.expression) && envoltorios.has(n.expression.text)))) {
      (function marcar(m) { dentroDeGit.add(m.getStart(sf)); ts.forEachChild(m, marcar); })(n);
    }
    ts.forEachChild(n, marcarGits);
  })(sf);

  const sueltas = [];
  (function mirar(n) {
    if (ts.isStringLiteralLike(n) && REFERENCIA_MOVIL.test(n.text) && !dentroDeGit.has(n.getStart(sf))) {
      sueltas.push({
        ruta,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        texto: n.text.slice(0, 60),
      });
    }
    ts.forEachChild(n, mirar);
  })(sf);
  return sueltas;
}

/** Todos los `.mjs`/`.js` de una carpeta, recursivo. */
export function fuentesDe(raiz, ...carpetas) {
  const out = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') andar(p); continue; }
      if (/\.(mjs|js)$/.test(e.name)) out.push(path.relative(raiz, p).split(path.sep).join('/'));
    }
  };
  for (const c of carpetas) { const d = path.join(raiz, c); if (fs.existsSync(d)) andar(d); }
  return out.sort();
}

/**
 * Para cada fichero, los nombres que importa y que en su origen son pasamanos de git. Se repite
 * hasta que no crece: un pasamanos puede apoyarse en otro que vive un fichero más allá.
 */
function pasamanosImportados(codigoDe) {
  // Sólo se parte el que tiene con qué: el que escribe `'git'` (puede ser origen) y el que importa
  // de uno de ésos, o de uno que importa de ésos. Los demás no pueden ni dar ni recibir un
  // pasamanos, y así el censo no parsea dos veces los mil ficheros que no pintan aquí.
  const importaDe = new Map();
  for (const [rel, codigo] of codigoDe) {
    const de = [...codigo.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
      .map((m) => path.posix.join(path.posix.dirname(rel), m[1]));
    if (de.length) importaDe.set(rel, de);
  }
  const candidatos = new Set([...codigoDe].filter(([, codigo]) => /['"]git['"]/.test(codigo)).map(([rel]) => rel));
  for (let crece = true; crece;) {
    crece = false;
    for (const [rel, de] of importaDe) {
      if (!candidatos.has(rel) && de.some((d) => candidatos.has(d))) { candidatos.add(rel); crece = true; }
    }
  }
  const sfDe = new Map();
  const importsDe = new Map();
  for (const rel of candidatos) {
    const codigo = codigoDe.get(rel);
    const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    sfDe.set(rel, sf);
    importsDe.set(rel, importadosDe(sf).map((i) => ({ ...i, de: path.posix.join(path.posix.dirname(rel), i.de) })));
  }
  const propios = new Map();
  const recibidos = new Map([...codigoDe.keys()].map((rel) => [rel, new Map()]));
  for (let crece = true; crece;) {
    crece = false;
    for (const [rel, sf] of sfDe) {
      const antes = recibidos.get(rel).size;
      for (const i of importsDe.get(rel)) {
        const es = propios.get(i.de)?.get(i.importado);
        if (es) recibidos.get(rel).set(i.local, es);
      }
      if (propios.has(rel) && recibidos.get(rel).size === antes) continue;
      const suyos = pasamanosDeGit(sf, recibidos.get(rel));
      if (!propios.has(rel) || suyos.size !== propios.get(rel).size) crece = true;
      propios.set(rel, suyos);
    }
  }
  return recibidos;
}

/**
 * El censo. Devuelve la población COMPLETA además de los hallazgos: sin saber cuántos ficheros se
 * leyeron y cuántos llaman a git, un «0 hallazgos» no se distingue de «no supe mirar».
 */
export function censarReferenciaMovil(raiz, carpetas = ['tests', 'scripts']) {
  const ficheros = fuentesDe(raiz, ...carpetas);
  const codigoDe = new Map(ficheros.map((rel) => [rel, fs.readFileSync(path.join(raiz, rel), 'utf8')]));
  const importadosDeCada = pasamanosImportados(codigoDe);
  const llamadas = [];
  const indirectas = [];
  for (const rel of ficheros) {
    const codigo = codigoDe.get(rel);
    const importados = importadosDeCada.get(rel);
    const suyas = analizarFuente(codigo, rel, importados);
    llamadas.push(...suyas);
    // Sólo en los que YA llaman a git: una cadena `origin/main` en el mensaje de un aserto de un
    // fichero que no arranca git no puede comparar contra nada.
    if (suyas.length) indirectas.push(...referenciaIndirecta(codigo, rel, importados));
  }
  return {
    escaneados: ficheros.length,
    // Cuántos ficheros llaman a git a través de un pasamanos que vive en OTRO fichero. Si vuelve a
    // cero habiendo familia de fixtures, el censo ha dejado de seguir los imports (SCRUM-1281).
    porImportado: [...importadosDeCada.values()].filter((s) => s.size).length,
    conGit: new Set(llamadas.map((l) => l.ruta)).size,
    llamadas: llamadas.length,
    anclados: llamadas.filter((l) => ANCLAS.has(l.cmd)).length,
    hallazgos: llamadas.filter((l) => l.esHallazgo),
    indirectas,
  };
}
