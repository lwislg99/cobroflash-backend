// tests/_la-ruta-que-calla.mjs — SCRUM-1520d · el censo por AST de las formas en que un caso que CAE no pone la tanda en rojo
//
// Lo usan el guard `tests/scrum1520d-nada-calla-un-caido.test.mjs` y el banco
// `docs/master/evidencias/SCRUM-1520/d-la-ruta-que-calla.mjs`, que imprime la tabla entera.
//
// Las formas, medidas por `docs/master/evidencias/SCRUM-1520/d-tres-siembras.mjs` con la cadena de
// `npm test` del 14-oct (salida 0 con un caso que cae):
//   · `process.exit(0)` (o sin argumento) en el proceso del fichero: lo de detrás no corre;
//   · un caso marcado `todo` (`{ todo }`, `test.todo(…)`, `t.todo()`): si cae, se informa como TODO.
// `process.exitCode = 0` NO calla por sí solo (salida 1: el informe del caído llega igual); se censa
// porque, si el informe se pierde (la cola de SCRUM-1405), es lo único que queda.
//
// Se busca en el AST y no en el texto: una cadena o una plantilla con `process.exit(0)` dentro (un
// guion que el test escribe y lanza aparte) no es una llamada en el proceso del test (SCRUM-203).
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

const ts = createRequire(import.meta.url)('typescript');

const barra = (p) => p.replaceAll('\\', '/');
const MUNDO = new Set(['test', 'it', 'describe', 'suite']);

/** Es `process.<nombre>` (también `globalThis.process.<nombre>` y `process['<nombre>']`). */
function esDeProcess(n, nombre) {
  if (ts.isPropertyAccessExpression(n)) {
    if (n.name.text !== nombre) return false;
    const o = n.expression;
    return (ts.isIdentifier(o) && o.text === 'process')
      || (ts.isPropertyAccessExpression(o) && o.name.text === 'process' && ts.isIdentifier(o.expression) && o.expression.text === 'globalThis');
  }
  if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'process') {
    return ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === nombre;
  }
  return false;
}

const esLlamadaDeCaso = (c) => {
  if (!ts.isCallExpression(c)) return false;
  const e = c.expression;
  return (ts.isIdentifier(e) && MUNDO.has(e.text)) || (ts.isPropertyAccessExpression(e) && (e.name.text === 'test' || MUNDO.has(e.name.text)));
};

/** `nombre` es el primer parámetro de una función que se pasa a test/it/describe (el contexto). */
function esContextoDeCaso(nombre, n) {
  for (let p = n.parent; p; p = p.parent) {
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parameters[0]
      && ts.isIdentifier(p.parameters[0].name) && p.parameters[0].name.text === nombre) return esLlamadaDeCaso(p.parent);
  }
  return false;
}

/** El caso (test/it/describe) que envuelve a `n`, por su primer argumento si es literal; o, si no
 *  hay caso, si está dentro de un `if` que sólo se cumple al lanzar el fichero como programa. */
// Cómo se escribe en este árbol «sólo si me lanzan como programa» (leído el 14-oct en los primeros
// 50 «de primer nivel»): `process.argv[1]` a la vista, o una variable o función de nombre propio
// (`esPrincipal`, `esCli`, `invocadoDirectamente`, `ejecutadoDirectamente(import.meta.url)`,
// `esElScriptEjecutado()`). Una variable del propio fichero cuenta si su declaración mira `process.argv`;
// una función importada, sólo por su NOMBRE: eso es una suposición y se declara.
const NOMBRES_DE_PROGRAMA = /\b(ejecutadoDirectamente|esElScriptEjecutado|esPrincipal|esCli|invocadoDirectamente|esMain|isMain)\b/;
function esCondicionDePrograma(cond, sf) {
  const t = cond.getText(sf);
  if (/process\.argv|import\.meta\.main/.test(t) || NOMBRES_DE_PROGRAMA.test(t)) return true;
  const ids = new Set(t.match(/[A-Za-z_$][\w$]*/g) ?? []);
  return sf.statements.some((s) => ts.isVariableStatement(s) && s.declarationList.declarations.some(
    (d) => ts.isIdentifier(d.name) && ids.has(d.name.text) && d.initializer && /process\.argv/.test(d.initializer.getText(sf))));
}

function dondeEsta(n, sf) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isIfStatement(p) && esCondicionDePrograma(p.expression, sf)) {
      return 'en el bloque de programa (sólo corre si se LANZA el fichero, no al importarlo)';
    }
    if (ts.isCallExpression(p)) {
      const e = p.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (MUNDO.has(nombre) || (ts.isPropertyAccessExpression(e) && e.name.text === 'test')) {
        const a = p.arguments[0];
        return a && ts.isStringLiteralLike(a) ? `dentro de «${a.text.slice(0, 70)}»` : 'dentro de un caso';
      }
    }
  }
  // Ni caso ni bloque de programa: ¿en qué función de primer nivel está, y la exporta el fichero?
  // Una función EXPORTADA que llama a exit es la que un test puede invocar en su propio proceso.
  let arriba = n;
  while (arriba.parent && arriba.parent !== sf) arriba = arriba.parent;
  if (arriba === n || !arriba.parent) return 'fuera de todo caso';
  let nombre = '';
  if (ts.isFunctionDeclaration(arriba) && arriba.name) nombre = arriba.name.text;
  if (ts.isVariableStatement(arriba)) {
    const d = arriba.declarationList.declarations.find((x) => x.initializer && x.initializer.pos <= n.pos && n.end <= x.initializer.end);
    if (d && ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) nombre = d.name.text;
  }
  if (!nombre) return 'en código de primer nivel (corre al IMPORTAR el fichero)';
  const exportada = (arriba.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    || sf.statements.some((s) => ts.isExportDeclaration(s) && s.exportClause && ts.isNamedExports(s.exportClause)
      && s.exportClause.elements.some((e) => (e.propertyName ?? e.name).text === nombre));
  return `en la función ${nombre}() · ${exportada ? 'EXPORTADA' : 'no exportada'}`;
}

/** Censa una fuente. Devuelve una lista de hallazgos {forma, linea, texto, donde}. */
export function censar(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const apunta = (forma, n) => out.push({
    forma,
    linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
    texto: n.getText(sf).replace(/\s+/g, ' ').slice(0, 90),
    donde: dondeEsta(n, sf),
  });
  const visita = (n) => {
    if (ts.isCallExpression(n)) {
      if (esDeProcess(n.expression, 'exit')) {
        const a = n.arguments[0];
        const arg = a ? a.getText(sf) : '';
        // exit(1), exit(2)…: el hijo sale con ≠0 y el corredor lo cuenta como caído. No calla.
        if (!a || arg === '0' || !/^\d+$/.test(arg)) apunta(a ? (arg === '0' ? 'exit(0)' : 'exit(<expresión>)') : 'exit()', n);
      }
      const e = n.expression;
      // `.todo(…)` sólo si quien lo recibe es el corredor (`test.todo`) o el contexto de un caso
      // (`t.todo()`, con `t` el primer parámetro del cuerpo de un test). La primera versión casaba
      // el NOMBRE del método y contó 26 veces `b.todo()`, un método de un banco que devuelve la
      // salida (scrum1367b, scrum1367c, scrum1430): no marca nada como pendiente.
      if (ts.isPropertyAccessExpression(e) && e.name.text === 'todo' && ts.isIdentifier(e.expression)
        && (MUNDO.has(e.expression.text) || esContextoDeCaso(e.expression.text, n))) apunta('.todo(…)', n);
      if (MUNDO.has(ts.isIdentifier(e) ? e.text : '') || (ts.isPropertyAccessExpression(e) && (e.name.text === 'test' || MUNDO.has(e.name.text)))) {
        for (const a of n.arguments) {
          if (!ts.isObjectLiteralExpression(a)) continue;
          for (const p of a.properties) {
            const pn = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) ? p.name.text : '';
            if (pn !== 'todo') continue;
            const v = ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : 'todo';
            if (v === 'false' || v === 'undefined') continue;
            apunta(`{ todo: ${v.slice(0, 40)} }`, p);
          }
        }
      }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && esDeProcess(n.left, 'exitCode')) {
      const v = n.right.getText(sf);
      if (!/^[1-9]\d*$/.test(v)) apunta(`exitCode = ${v.slice(0, 30)}`, n);
    }
    // const { exit } = process  — el alias que el resto no ve
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.initializer) && n.initializer.text === 'process' && ts.isObjectBindingPattern(n.name)) {
      for (const el of n.name.elements) {
        const k = (el.propertyName ?? el.name).getText(sf);
        if (k === 'exit' || k === 'exitCode') apunta(`alias de process.${k}`, el);
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

/** Los ficheros que un fuente importa de forma estática o dinámica con literal (rutas relativas). */
export function importa(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const r = [];
  const visita = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) r.push(n.moduleSpecifier.text);
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) r.push(n.arguments[0].text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return r.filter((s) => s.startsWith('.')).map((s) => barra(join(dirname(nombre), s)));
}

// Las semillas de los controles: cada forma, sembrada, se tiene que ver (positivo); las mismas
// cadenas dentro de un literal, una plantilla o un comentario, un exit(1) y un método propio que se
// llama `todo` no se tienen que ver (cero).
export const SIEMBRA = [
  ['exit(0)', "import test from 'node:test';\ntest('a', () => { process.exit(0); });\n"],
  ['exit()', "test('a', () => { if (x) process.exit(); });\n"],
  ['exit(<expresión>)', "process.exit(codigo);\n"],
  ['exitCode = 0', "process.exitCode = 0;\n"],
  ['.todo(…)', "test.todo('pendiente', () => { throw new Error('x'); });\n"],
  ['.todo(…)', "test('b', (t) => { t.todo('aún no'); throw new Error('x'); });\n"],
  ['{ todo: true }', "test('c', { todo: true }, () => { throw new Error('x'); });\n"],
  ['{ todo: \'falta\' }', "it('d', { todo: 'falta' }, () => {});\n"],
  ['alias de process.exit', "const { exit } = process;\n"],
];
export const CERO = [
  "const guion = \"process.exit(0)\";\n",
  "const g = `test('x', { todo: true }, () => {}); process.exit(0); process.exitCode = 0;`;\n",
  "// process.exit(0) en un comentario\n/* test.todo('x') */\n",
  "process.exit(1);\nprocess.exitCode = 1;\ntest('e', { todo: false }, () => {});\n",
  // el falso positivo de la primera versión, medido: un método que se llama `todo` y no marca nada
  "const b = { todo: () => '' };\ntest('f', (t) => { assert.ok(1, b.todo()); });\n",
];

export const deLaTanda = (f) => /^tests\/[^/]+\.test\.mjs$/.test(f);

/** El censo del árbol: `tests/` entero más lo que la tanda importa fuera de `tests/`. */
export function censoDelArbol(RAIZ) {
  const TESTS = join(RAIZ, 'tests');
  const todos = [];
  (function anda(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') anda(p); continue; }
      if (/\.(mjs|js|cjs)$/.test(e.name)) todos.push(barra(relative(RAIZ, p)));
    }
  })(TESTS);
  todos.sort();
  const fuentes = new Map(todos.map((f) => [f, readFileSync(join(RAIZ, f), 'utf8')]));
  // Fuera de tests/: lo que la tanda importa (scripts/, dist/, public/…), por la misma cadena de
  // imports relativos. Un `process.exit(0)` en una función de `scripts/` que un test llama en su
  // propio proceso corta ese proceso igual que si estuviera en el test.
  const fuera = [];
  {
    const cola = [...fuentes.keys()];
    while (cola.length) {
      const f = cola.shift();
      for (const dest of importa(f, fuentes.get(f))) {
        if (fuentes.has(dest) || !/\.(mjs|js|cjs)$/.test(dest) || dest.startsWith('..') || dest.includes('node_modules/')) continue;
        let src;
        try { src = readFileSync(join(RAIZ, dest), 'utf8'); } catch { continue; } // no existe (p. ej. `dist/` sin compilar): se cuenta abajo
        fuentes.set(dest, src); fuera.push(dest); cola.push(dest);
      }
    }
  }
  const distEnElArbol = fuera.filter((f) => f.startsWith('dist/')).length;
  const hallazgos = [];
  for (const [f, src] of fuentes) for (const h of censar(f, src)) hallazgos.push({ fichero: f, ...h });
  
  // Quién importa a cada ayudante con hallazgo: los tests de la tanda que llegan a él por CUALQUIER
  // cadena de imports dentro de tests/ (un ayudante que importa a otro también cuenta).
  const directos = new Map();
  for (const [f, src] of fuentes) {
    for (const dest of importa(f, src)) {
      if (!directos.has(dest)) directos.set(dest, new Set());
      directos.get(dest).add(f);
    }
  }
  const importadores = new Map();
  for (const f of fuentes.keys()) {
    const vistos = new Set(); const cola = [f];
    while (cola.length) for (const q of directos.get(cola.shift()) ?? []) if (!vistos.has(q)) { vistos.add(q); cola.push(q); }
    importadores.set(f, [...vistos].filter(deLaTanda).sort());
  }
  
  return { todos, fuera, distEnElArbol, fuentes, hallazgos, importadores };
}

/** ¿Puede este hallazgo correr en el PROCESO de un test de la tanda, y callar un caído?
 *  · en un fichero de la tanda: cualquier forma;
 *  · en otro fichero al que llega la tanda por imports: `todo` en cualquier sitio; `exit(0)`,
 *    `exit()`, `exitCode` o el alias, si está en código de primer nivel, en una función EXPORTADA o
 *    dentro de un caso;
 *  · nunca en el bloque de programa (sólo corre si se LANZA el fichero) ni en un fichero que la
 *    tanda no importa (ésos se lanzan como programa: su código de salida es otro).
 *  NO cubre: `exit(<expresión>)` fuera de la tanda (no resuelve la constante; los cuatro de hoy
 *  salen con 2, 3, 4 y 3) ni una función no exportada que llama una exportada. */
export function puedeCallar(h, importadores) {
  if (h.donde.startsWith('en el bloque de programa')) return false;
  if (deLaTanda(h.fichero)) return true;
  if (!(importadores.get(h.fichero) ?? []).length) return false;
  if (h.forma.includes('todo')) return true;
  if (h.forma === 'exit(<expresión>)') return false;
  return /primer nivel|EXPORTADA|dentro de/.test(h.donde);
}
