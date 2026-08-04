// tests/_identificadores-sueltos.mjs — SCRUM-258 · ¿algún script usa un nombre que no existe?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, Y ES UNA HISTORIA CORTA
//
// SCRUM-253 cambió `const dueño = idDeSesion(os.hostname(), process.pid)` por
// `const dueño = dueñoActual()` en CUATRO ficheros, y puso el import en TRES. El cuarto era
// `scripts/turno-staging.mjs`, o sea el CLI del turno. Llegó a `main` así:
//
//     ReferenceError: dueñoActual is not defined
//
// con la suite en **1196 tests verdes**. Y no fue mala suerte: `turno-staging.mjs` es un script
// que **ningún test importa ni ejecuta**, porque importarlo lanzaría acciones contra staging. Un
// artefacto que nunca se ejecuta como se va a ejecutar no está verificado (SCRUM-168), y aquí eso
// no era una advertencia: era un `ReferenceError` esperando a que alguien tecleara el comando.
//
// Este analizador es la red que faltaba. Es ESTÁTICO a propósito: no ejecuta nada, así que puede
// mirar scripts que tocan la base sin tocarla.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE COMPRUEBA, Y LO QUE DELIBERADAMENTE NO
//
// Un identificador usado en el fichero tiene que estar en alguno de estos tres sitios:
//   · importado,
//   · declarado en cualquier parte del fichero,
//   · o ser un global del runtime.
//
// **Los globales se derivan de `globalThis`, no de una lista escrita a mano.** Una lista de
// globales sería justo lo que esta casa no quiere: se queda vieja, y cuando falla lo hace
// acusando a código correcto — el camino más corto a que un guard se desactive.
//
// ⚠️ SE MIRA EL FICHERO ENTERO SIN DISTINGUIR ÁMBITOS, y es una decisión, no un descuido. Un
// nombre declarado dentro de una función y usado en otra NO se detecta. A cambio, **el análisis
// no puede producir falsos positivos por ámbito**: si el nombre no está declarado en ninguna
// parte, no existe y punto. Prefiero un guard que detecta menos y nunca miente a uno que grita
// por casos legítimos — un guard que grita sin razón se acaba puenteando, y entonces no vigila
// nada. El caso que motivó el ticket (un import que falta) cae de lleno en lo que sí detecta.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Globales del runtime, LEÍDOS del runtime. */
export const GLOBALES = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  'arguments', // no es propiedad de globalThis pero existe en funciones no-flecha
]);

function recorrer(n, visita) {
  visita(n);
  n.forEachChild((h) => recorrer(h, visita));
}

/** Todo nombre que el fichero ATA: imports, declaraciones, parámetros, capturas de catch. */
function nombresDeclarados(sf) {
  const nombres = new Set();
  const anotar = (nodo) => {
    if (!nodo) return;
    if (ts.isIdentifier(nodo)) { nombres.add(nodo.text); return; }
    // desestructuración: `const { a, b: c } = x` y `const [d] = y`
    if (ts.isObjectBindingPattern(nodo) || ts.isArrayBindingPattern(nodo)) {
      for (const el of nodo.elements) if (ts.isBindingElement(el)) anotar(el.name);
    }
  };

  recorrer(sf, (n) => {
    if (ts.isImportDeclaration(n) && n.importClause) {
      const c = n.importClause;
      if (c.name) nombres.add(c.name.text);
      if (c.namedBindings) {
        if (ts.isNamespaceImport(c.namedBindings)) nombres.add(c.namedBindings.name.text);
        else for (const el of c.namedBindings.elements) nombres.add(el.name.text);
      }
      return;
    }
    if (ts.isVariableDeclaration(n) || ts.isBindingElement(n)) anotar(n.name);
    else if (ts.isParameter(n)) anotar(n.name);
    else if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) nombres.add(n.name.text);
    else if (ts.isFunctionExpression(n) && n.name) nombres.add(n.name.text);
    else if (ts.isCatchClause(n) && n.variableDeclaration) anotar(n.variableDeclaration.name);
  });
  return nombres;
}

/** ¿este identificador es una REFERENCIA a un valor, o solo un nombre (propiedad, etiqueta…)? */
function esReferencia(n) {
  const p = n.parent;
  if (!p) return false;
  // `import.meta` → `meta` no es un identificador que nadie tenga que declarar
  if (ts.isMetaProperty(p)) return false;
  // `obj.prop` → `prop` no es una referencia
  if (ts.isPropertyAccessExpression(p) && p.name === n) return false;
  // `{ prop: valor }` → `prop` no lo es; `{ prop }` (atajo) SÍ referencia a `prop`
  if (ts.isPropertyAssignment(p) && p.name === n) return false;
  if (ts.isMethodDeclaration(p) || ts.isPropertySignature(p)) return false;
  // `{ get merchant() {…} }` → `merchant` es el nombre del accesor, no una referencia
  if ((ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) && p.name === n) return false;
  // declaraciones: el nombre que se ATA no es una referencia
  if (ts.isVariableDeclaration(p) && p.name === n) return false;
  if (ts.isParameter(p) && p.name === n) return false;
  if ((ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isFunctionExpression(p)) && p.name === n) return false;
  if (ts.isBindingElement(p) && (p.name === n || p.propertyName === n)) return false;
  if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return false;
  if (ts.isExportSpecifier(p)) return false;
  // etiquetas de bucle
  if (ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) return false;
  return true;
}

/**
 * ¿este nodo está dentro de una función que se le pasa a `.evaluate(…)`?
 *
 * Ese cuerpo NO lo ejecuta Node: se serializa y corre DENTRO DEL NAVEGADOR (Playwright), donde
 * `window`, `document` o `caches` sí existen. Reclamarlos como «no declarados» sería acusar a
 * código correcto de un fallo que no tiene. Se detecta por la FORMA de la llamada, no por una
 * lista de ficheros: cualquier script que evalúe en el navegador queda cubierto por existir.
 */
function dentroDeEvaluate(n) {
  for (let a = n.parent; a; a = a.parent) {
    if (!ts.isCallExpression(a)) continue;
    const callee = a.expression;
    if (ts.isPropertyAccessExpression(callee) && /^evaluate/.test(callee.name.text)) return true;
  }
  return false;
}

/** Identificadores referenciados que no están atados en ninguna parte ni son globales. */
export function identificadoresSueltos(rutaRel, codigo) {
  const sf = ts.createSourceFile(rutaRel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const atados = nombresDeclarados(sf);
  const sueltos = new Map(); // nombre -> primera línea

  recorrer(sf, (n) => {
    if (!ts.isIdentifier(n) || !esReferencia(n)) return;
    if (atados.has(n.text) || GLOBALES.has(n.text)) return;
    if (dentroDeEvaluate(n)) return;
    if (sueltos.has(n.text)) return;
    sueltos.set(n.text, sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
  });

  return [...sueltos].map(([nombre, linea]) => ({ fichero: rutaRel, nombre, linea }));
}

/** Los `.mjs` de un directorio, derivados del directorio y no de una lista. */
export function ficherosDe(raiz, dir) {
  const abs = path.join(raiz, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((n) => n.endsWith('.mjs')).map((n) => `${dir}/${n}`).sort();
}

export function barrer(raiz, dir = 'scripts') {
  return ficherosDe(raiz, dir).flatMap((rel) =>
    identificadoresSueltos(rel, fs.readFileSync(path.join(raiz, rel), 'utf8')));
}
