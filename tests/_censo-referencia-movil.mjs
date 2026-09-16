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
function envoltoriosDeGit(sf) {
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
  (function recorrer(n) {
    if (ts.isFunctionDeclaration(n) && n.name) registrar(n.name.text, n.body);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      registrar(n.name.text, n.initializer.body);
    }
    ts.forEachChild(n, recorrer);
  })(sf);
  return nombres;
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
export function analizarFuente(codigo, ruta = 'anonimo.mjs') {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const envoltorios = envoltoriosDeGit(sf);
  const llamadas = [];
  (function mirar(n) {
    if (ts.isCallExpression(n)) {
      let partes = argumentosDirectos(n, sf);
      if (!partes && ts.isIdentifier(n.expression) && envoltorios.has(n.expression.text)) {
        partes = n.arguments.map((e) => (ts.isStringLiteralLike(e) ? e.text : e.getText(sf)));
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
export function referenciaIndirecta(codigo, ruta = 'anonimo.mjs') {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const envoltorios = envoltoriosDeGit(sf);
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
 * El censo. Devuelve la población COMPLETA además de los hallazgos: sin saber cuántos ficheros se
 * leyeron y cuántos llaman a git, un «0 hallazgos» no se distingue de «no supe mirar».
 */
export function censarReferenciaMovil(raiz, carpetas = ['tests', 'scripts']) {
  const ficheros = fuentesDe(raiz, ...carpetas);
  const llamadas = [];
  const indirectas = [];
  for (const rel of ficheros) {
    const codigo = fs.readFileSync(path.join(raiz, rel), 'utf8');
    const suyas = analizarFuente(codigo, rel);
    llamadas.push(...suyas);
    // Sólo en los que YA llaman a git: una cadena `origin/main` en el mensaje de un aserto de un
    // fichero que no arranca git no puede comparar contra nada.
    if (suyas.length) indirectas.push(...referenciaIndirecta(codigo, rel));
  }
  return {
    escaneados: ficheros.length,
    conGit: new Set(llamadas.map((l) => l.ruta)).size,
    llamadas: llamadas.length,
    anclados: llamadas.filter((l) => ANCLAS.has(l.cmd)).length,
    hallazgos: llamadas.filter((l) => l.esHallazgo),
    indirectas,
  };
}
