// tests/_censo-filtro-sin-suelo.mjs — SCRUM-1395
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ TESTS LLAMAN AL FILTRO DE COMENTARIOS SIN NADA QUE COMPRUEBE QUE DEVOLVIÓ ALGO?
//
// `npm run censo:mudez` MIDE la mudez (rompe el filtro y mira quién sigue verde), pero tarda
// cinco minutos, muta el árbol y no corre en ningún sitio. Esto NO lo sustituye: no mide mudez.
// Mide la CONDICIÓN NECESARIA para ser mudo —llamar al filtro por una forma que acepta la cadena
// vacía— y lo hace leyendo, en milisegundos, para poder vivir dentro de la tanda.
//
// Las formas de `tests/_guard-texto.mjs`, por lo que hacen sobre la nada:
//
//   SIN SUELO   `soloEjecutable(x)` · `leerFuente(r)` sin `ancla` · `ejecutableDe(x, { sinAncla })`
//               devuelven '' y la negación de después es cierta por vacía.
//   CON SUELO   `ejecutableDe(x, { ancla })` · `leerFuente(r, { ancla })` · `ejecutablesDe([...])`
//               LANZAN sobre la nada: quien las usa es vivo por construcción.
//   NO FILTRA   `leerFuente(r, { conComentarios: true })` devuelve el texto crudo.
//
// ── POR IDENTIDAD DEL IMPORT, NO POR EL NOMBRE ───────────────────────────────────────────
// Se parte de lo que el fichero IMPORTA de `_guard-texto.mjs` (con su alias, si lo tiene) y se
// siguen esos nombres por AST. Un comentario que nombra el helper no cuenta, y un `soloEjecutable`
// local que no venga de allí tampoco. Lo que no se puede seguir sale SIN JUZGAR y cuenta como
// «sin suelo»: no poder mirar no es estar limpio (SCRUM-1336).
//
// ── LO QUE NO VE, DECLARADO ──────────────────────────────────────────────────────────────
//   · un envoltorio propio (un `tests/_*.mjs` que llame al filtro por dentro): quien llame al
//     envoltorio no sale aquí. Los envoltorios se CUENTAN y se nombran, no se juzgan;
//   · que el guard sea MUDO de verdad: eso sólo lo dice `censo:mudez`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** El módulo cuyo import se sigue. Se compara por el FINAL de la ruta, que es lo estable. */
export const MODULO_DEL_FILTRO = '_guard-texto.mjs';

export const FORMAS = Object.freeze({
  SIN_SUELO: 'sin suelo',
  CON_SUELO: 'con suelo',
  NO_FILTRA: 'no filtra',
  SIN_JUZGAR: 'sin juzgar',
});

const DEL_FILTRO = new Set(['soloEjecutable', 'ejecutableDe', 'ejecutablesDe', 'leerFuente']);

const esDelModulo = (espec) => typeof espec === 'string' && espec.endsWith(MODULO_DEL_FILTRO);

/** ¿Qué clave lleva un literal de objeto? `null` si el argumento no es un literal legible. */
function clavesDe(nodo) {
  if (!nodo || !ts.isObjectLiteralExpression(nodo)) return null;
  const claves = new Map();
  for (const p of nodo.properties) {
    if (ts.isSpreadAssignment(p)) return null; // `...resto`: no se sabe qué trae
    const nombre = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
    if (!nombre) return null;
    claves.set(nombre, ts.isPropertyAssignment(p) ? p.initializer : p);
  }
  return claves;
}

const esFalso = (n) => n && (n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword);

/** La forma de UNA llamada al filtro. */
function formaDe(exportado, args) {
  if (exportado === 'soloEjecutable') return FORMAS.SIN_SUELO;
  if (exportado === 'ejecutablesDe') return FORMAS.CON_SUELO;
  const opciones = args[1];
  if (exportado === 'ejecutableDe') {
    if (!opciones) return FORMAS.CON_SUELO; // sin opciones LANZA «falta ancla»: no devuelve la nada
    const claves = clavesDe(opciones);
    if (!claves) return FORMAS.SIN_JUZGAR;
    if (claves.has('sinAncla') && !esFalso(claves.get('sinAncla'))) return FORMAS.SIN_SUELO;
    return FORMAS.CON_SUELO; // con `ancla` filtra con suelo; sin ella, lanza
  }
  // leerFuente
  if (!opciones) return FORMAS.SIN_SUELO;
  const claves = clavesDe(opciones);
  if (!claves) return FORMAS.SIN_JUZGAR;
  if (claves.has('conComentarios') && !esFalso(claves.get('conComentarios'))) return FORMAS.NO_FILTRA;
  if (claves.has('ancla') && !esFalso(claves.get('ancla'))) return FORMAS.CON_SUELO;
  return FORMAS.SIN_SUELO;
}

/**
 * Los sitios donde un fuente usa el filtro, con su forma.
 *
 * @returns {{ ok: true, importa: boolean, sitios: {exportado:string, forma:string, linea:number, como:string}[] }
 *          | { ok: false, motivo: string }}
 */
export function analizarFiltro(fuente, nombre = 'fuente.mjs') {
  const sf = ts.createSourceFile(nombre, String(fuente ?? ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    return { ok: false, motivo: `no parsea: ${ts.flattenDiagnosticMessageText(sf.parseDiagnostics[0].messageText, ' ')}` };
  }
  const locales = new Map(); // nombre local → nombre exportado
  const espacios = new Set(); // `import * as g`, o `const g = await import(...)`
  const deImport = new Set(); // los nodos del propio import: no son un uso
  const sitios = [];
  let importa = false;
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const importDinamico = (n) => {
    let e = n;
    while (e && (ts.isAwaitExpression(e) || ts.isParenthesizedExpression(e))) e = e.expression;
    return e && ts.isCallExpression(e) && e.expression.kind === ts.SyntaxKind.ImportKeyword
      && e.arguments[0] && ts.isStringLiteralLike(e.arguments[0]) && esDelModulo(e.arguments[0].text);
  };

  // ① qué nombres vienen del módulo del filtro
  const recoger = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && esDelModulo(n.moduleSpecifier.text)) {
      importa = true;
      const ligaduras = n.importClause && n.importClause.namedBindings;
      if (ligaduras && ts.isNamespaceImport(ligaduras)) { espacios.add(ligaduras.name.text); deImport.add(ligaduras.name); }
      if (ligaduras && ts.isNamedImports(ligaduras)) {
        for (const el of ligaduras.elements) {
          const exportado = (el.propertyName || el.name).text;
          if (DEL_FILTRO.has(exportado)) locales.set(el.name.text, exportado);
          deImport.add(el.name);
          if (el.propertyName) deImport.add(el.propertyName);
        }
      }
    }
    if (ts.isVariableDeclaration(n) && n.initializer && importDinamico(n.initializer)) {
      importa = true;
      if (ts.isIdentifier(n.name)) { espacios.add(n.name.text); deImport.add(n.name); }
      if (ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) {
          if (!ts.isIdentifier(el.name)) continue;
          const exportado = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
          if (DEL_FILTRO.has(exportado)) locales.set(el.name.text, exportado);
          deImport.add(el.name);
          if (el.propertyName) deImport.add(el.propertyName);
        }
      }
    }
    ts.forEachChild(n, recoger);
  };
  recoger(sf);

  // ② dónde se usan
  const exportadoDe = (expr) => {
    if (ts.isIdentifier(expr) && locales.has(expr.text)) return locales.get(expr.text);
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)
      && espacios.has(expr.expression.text) && DEL_FILTRO.has(expr.name.text)) return expr.name.text;
    return null;
  };
  const vistos = new Set();
  const usar = (n) => {
    if (ts.isCallExpression(n)) {
      const exportado = exportadoDe(n.expression);
      if (exportado) {
        vistos.add(n.expression);
        if (ts.isPropertyAccessExpression(n.expression)) vistos.add(n.expression.name);
        sitios.push({ exportado, forma: formaDe(exportado, n.arguments), linea: linea(n), como: 'llamada' });
      }
    }
    // Pasado SIN llamar (`.map(soloEjecutable)`): quien lo reciba lo llamará con un solo argumento.
    const suelto = (ts.isIdentifier(n) && locales.has(n.text) && !deImport.has(n) && !vistos.has(n)
      && !(n.parent && ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
      && !(n.parent && ts.isPropertyAssignment(n.parent) && n.parent.name === n));
    if (suelto) {
      const exportado = locales.get(n.text);
      const forma = exportado === 'ejecutablesDe' || exportado === 'ejecutableDe' ? FORMAS.CON_SUELO : FORMAS.SIN_SUELO;
      sitios.push({ exportado, forma, linea: linea(n), como: 'referencia' });
    }
    ts.forEachChild(n, usar);
  };
  usar(sf);
  return { ok: true, importa, sitios };
}

/** La clase de un FICHERO: basta un sitio sin suelo (o sin juzgar) para que no esté cubierto. */
export function clasificarFiltro(analisis) {
  if (!analisis.ok) return FORMAS.SIN_JUZGAR;
  const formas = new Set(analisis.sitios.map((s) => s.forma));
  if (formas.has(FORMAS.SIN_JUZGAR)) return FORMAS.SIN_JUZGAR;
  if (formas.has(FORMAS.SIN_SUELO)) return FORMAS.SIN_SUELO;
  if (formas.has(FORMAS.CON_SUELO)) return FORMAS.CON_SUELO;
  if (formas.has(FORMAS.NO_FILTRA)) return FORMAS.NO_FILTRA;
  return null; // no usa el filtro
}

/**
 * El censo sobre `tests/`. La población que se JUZGA son los `*.test.mjs`, la misma que mira
 * `scripts/censo-mudez.mjs`; los módulos de apoyo (`_*.mjs`) que llaman al filtro se cuentan aparte.
 */
export function censoDelFiltro(raiz) {
  const dir = path.join(raiz, 'tests');
  const todos = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  const filas = [];
  const envoltorios = [];
  for (const f of todos) {
    const fuente = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!fuente.includes(MODULO_DEL_FILTRO)) { if (f.endsWith('.test.mjs')) filas.push({ fichero: f, clase: null, sitios: [] }); continue; }
    const a = analizarFiltro(fuente, f);
    const fila = { fichero: f, clase: clasificarFiltro(a), sitios: a.ok ? a.sitios : [], motivo: a.ok ? null : a.motivo };
    if (f.endsWith('.test.mjs')) filas.push(fila);
    else if (fila.clase && fila.clase !== FORMAS.NO_FILTRA) envoltorios.push(fila);
  }
  const de = (clase) => filas.filter((x) => x.clase === clase);
  const usan = filas.filter((x) => x.clase !== null);
  const sinSuelo = [...de(FORMAS.SIN_SUELO), ...de(FORMAS.SIN_JUZGAR)].sort((a, b) => a.fichero.localeCompare(b.fichero));
  return { filas, usan, sinSuelo, de, envoltorios, enDisco: todos.filter((f) => f.endsWith('.test.mjs')).length };
}
