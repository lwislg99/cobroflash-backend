#!/usr/bin/env node
// SCRUM-1485 · CENSO: ¿QUÉ TESTS COMPARAN UNA RUTA CON EL SEPARADOR DE LA MÁQUINA?
//
// El 6-oct-2026 el check obligatorio del PR #2221 estuvo tres horas en rojo por un test que en Windows
// daba «12 de 12». Comparaba rutas hechas con `path.join`/`path.relative` (que en Windows llevan «\» y
// en el CI, que es Linux, «/») con un renglón que llevaba una «/» escrita a mano. En esta máquina no hay
// Linux: un verde de aquí no dice nada de un test así. Este censo los busca LEYENDO, que es lo único que
// se puede hacer sin Linux.
//
// QUÉ MIDE, y qué no (un número cierto puede no medir el riesgo):
//   · mide SITIOS donde el resultado de una comparación DEPENDE DE LA MÁQUINA por cómo está escrita;
//   · NO mide tests en rojo. Todo lo que hay en `main` pasó por el CI, así que en Linux está verde: lo
//     que puede pasar es que en Windows caiga, o que en una de las dos máquinas compare OTRA cosa.
//
// CÓMO LEE: por AST (typescript), no por texto. Una «ruta de máquina» es lo que devuelve `path.join`,
// `relative`, `resolve`, `normalize`, `dirname`, `path.sep`, `fileURLToPath`, `process.cwd()`,
// `os.tmpdir()`, `__dirname`… y lo que se hace pegándole trozos. Deja de serlo cuando se NORMALIZA
// (`.split(path.sep).join('/')`, `.replace(/\\/g, '/')`). Un nombre se sigue hasta su `const` y una
// llamada hasta la función local que la define; NADA MÁS (ver LO_QUE_NO_VE).
//
// uso:  node scripts/equipo/censo-rutas-de-maquina.mjs            (resumen + LITERAL y NO-LEIDO)
//       node scripts/equipo/censo-rutas-de-maquina.mjs --todo     (además MAQUINA e INOCUO)
//       node scripts/equipo/censo-rutas-de-maquina.mjs --json
//       node scripts/equipo/censo-rutas-de-maquina.mjs <fichero>… (sólo ésos; rutas tal cual)
// salida: 0 = pudo leerlo todo · 2 = hubo ficheros que no supo leer (CIEGO para ésos).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

/** Lo que este censo NO ve, por construcción. Se imprime siempre: un cero suyo no absuelve esto. */
export const LO_QUE_NO_VE = [
  'una ruta que llega por PARÁMETRO de una función (el `(l) => l.startsWith(...)` de un filtro): se ve el sumidero, no de dónde viene `l`',
  'una ruta guardada en un array o en un objeto y comparada después (el `foto()` de SCRUM-1473 hacía eso)',
  'una ruta que viene de OTRO módulo (un ayudante `_*.mjs` que devuelve rutas) o de un `let` reasignado',
  'lo que hace el CÓDIGO probado con sus rutas: sólo se leen los ficheros de `tests/`',
  'las otras diferencias entre Windows y Linux: mayúsculas en nombres, finales de línea, permisos, enlaces',
];

const FUENTES = new Set(['join', 'relative', 'resolve', 'normalize', 'dirname', 'format', 'toNamespacedPath']);
const CONSERVAN = new Set(['slice', 'substring', 'substr', 'trim', 'trimEnd', 'trimStart', 'toLowerCase', 'toUpperCase', 'toString', 'concat', 'repeat']);
const ABSOLUTAS = new Set(['cwd', 'tmpdir', 'homedir', 'mkdtempSync', 'realpathSync']);
const METODOS = new Set(['startsWith', 'endsWith', 'includes', 'indexOf', 'lastIndexOf']);
const ASERTOS = new Set(['equal', 'strictEqual', 'notEqual', 'notStrictEqual', 'deepEqual', 'deepStrictEqual', 'notDeepEqual', 'notDeepStrictEqual']);
const ASERTOS_RE = new Set(['match', 'doesNotMatch']);
const CON_RE = new Set(['match', 'search', 'matchAll']);
const IGUALDAD = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
]);
const tieneSep = (s) => s.includes('/') || s.includes('\\');
const empiezaPorSep = (s) => s.startsWith('/') || s.startsWith('\\');
const acabaEnSep = (s) => s.endsWith('/') || s.endsWith('\\');
const pelar = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isAwaitExpression(n))) n = n.expression;
  return n;
};
const ligaNombre = (patron, nombre) => {
  if (!patron) return false;
  if (ts.isIdentifier(patron)) return patron.text === nombre;
  return patron.elements.some((e) => !ts.isOmittedExpression(e) && ligaNombre(e.name, nombre));
};

/**
 * Lee UN fichero. Devuelve `{ leido, usaRutas, hallazgos }`; cada hallazgo es un sitio donde una ruta de
 * máquina llega a una comparación, con su veredicto:
 *   LITERAL   · contra un texto con «/» o «\» escrito a mano, o la propia ruta lleva uno pegado: DIFIERE.
 *   MAQUINA   · ruta de máquina contra ruta de máquina: lo mismo en las dos.
 *   INOCUO    · contra un texto sin separador («..», «», un nombre) o una regex que admite los dos.
 *   NO-LEIDO  · el otro lado es algo que el censo no sabe seguir: lo tiene que leer una persona.
 */
export function analizar(texto, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, nombre.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    return { leido: false, motivo: ts.flattenDiagnosticMessageText(sf.parseDiagnostics[0].messageText, ' '), usaRutas: false, hallazgos: [], mezclas: [] };
  }
  // ① Con qué nombres entra `path` en este fichero.
  const espacios = new Set();
  const sueltos = new Map();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    if (!['node:path', 'path'].includes(s.moduleSpecifier.text) || !s.importClause) continue;
    if (s.importClause.name) espacios.add(s.importClause.name.text);
    const nb = s.importClause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) espacios.add(nb.name.text);
    if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) sueltos.set(e.name.text, (e.propertyName || e.name).text);
  }
  const esEspacio = (n) => ts.isIdentifier(n) && espacios.has(n.text);

  // ② De quién es un nombre: su declaración más cercana, subiendo por los ámbitos.
  const declaracionDe = (id) => {
    const nombreId = id.text;
    for (let n = id.parent; n; n = n.parent) {
      if (ts.isFunctionLike(n)) {
        if (n.parameters.some((p) => ligaNombre(p.name, nombreId))) return { tipo: 'param' };
        if (ts.isFunctionExpression(n) && n.name && n.name.text === nombreId) return { tipo: 'fn', nodo: n };
      }
      if (ts.isCatchClause(n) && n.variableDeclaration && ligaNombre(n.variableDeclaration.name, nombreId)) return { tipo: 'opaco' };
      if ((ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) && n.initializer && ts.isVariableDeclarationList(n.initializer)
        && n.initializer.declarations.some((d) => ligaNombre(d.name, nombreId))) return { tipo: 'opaco' };
      const sentencias = (ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n)) ? n.statements : null;
      if (!sentencias) continue;
      for (const s of sentencias) {
        if (ts.isVariableStatement(s)) {
          for (const d of s.declarationList.declarations) {
            if (ts.isIdentifier(d.name) && d.name.text === nombreId) return { tipo: (s.declarationList.flags & ts.NodeFlags.Const) ? 'const' : 'let', nodo: d };
            if (!ts.isIdentifier(d.name) && ligaNombre(d.name, nombreId)) return { tipo: 'opaco' };
          }
        } else if (ts.isFunctionDeclaration(s) && s.name && s.name.text === nombreId) return { tipo: 'fn', nodo: s };
        else if (ts.isClassDeclaration(s) && s.name && s.name.text === nombreId) return { tipo: 'opaco' };
      }
    }
    return null;
  };
  const funcionDe = (id) => {
    const d = declaracionDe(id);
    if (!d) return null;
    if (d.tipo === 'fn') return d.nodo;
    if (d.tipo === 'const' && d.nodo.initializer) {
      const ini = pelar(d.nodo.initializer);
      if (ts.isArrowFunction(ini) || ts.isFunctionExpression(ini)) return ini;
    }
    return null;
  };

  // ③ ¿Esta expresión es una ruta de máquina? 0 = no · 1 = sí · 2 = sí, y lleva pegado un separador escrito a mano.
  const enCurso = new Set();
  const memo = new Map();
  const esSeparador = (n) => {
    n = pelar(n);
    if (!n) return false;
    if (ts.isStringLiteralLike(n)) return n.text.includes('\\');
    if (ts.isRegularExpressionLiteral(n)) return n.text.includes('\\\\');
    return leer(n) > 0;
  };
  const devuelve = (fn) => {
    if (memo.has(fn)) return memo.get(fn);
    if (enCurso.has(fn)) return 0;
    enCurso.add(fn);
    let nivel = 0;
    if (fn.body && !ts.isBlock(fn.body)) nivel = leer(fn.body);
    else if (fn.body) {
      const baja = (n) => {
        if (ts.isFunctionLike(n)) return;
        if (ts.isReturnStatement(n) && n.expression) nivel = Math.max(nivel, leer(n.expression));
        ts.forEachChild(n, baja);
      };
      ts.forEachChild(fn.body, baja);
    }
    enCurso.delete(fn);
    memo.set(fn, nivel);
    return nivel;
  };
  function leer(expr) {
    const n = pelar(expr);
    if (!n) return 0;
    if (ts.isTemplateExpression(n)) {
      // PEGADO = el separador toca a la ruta (`${ruta}/x`, `x/${ruta}`). Un mensaje que nombra una ruta
      // («no cuelga de ${ruta}: mira docs/x») lleva «/» en otra parte y no fabrica ninguna ruta.
      let nivel = 0;
      let pegado = false;
      n.templateSpans.forEach((s, i) => {
        const suyo = leer(s.expression);
        nivel = Math.max(nivel, suyo);
        if (!suyo) return;
        const antes = i === 0 ? n.head.text : n.templateSpans[i - 1].literal.text;
        if (suyo === 2 || acabaEnSep(antes) || empiezaPorSep(s.literal.text)) pegado = true;
      });
      return pegado ? 2 : nivel;
    }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken) {
        const a = leer(n.left);
        const b = leer(n.right);
        const nivel = Math.max(a, b);
        if (!nivel) return 0;
        const izq = pelar(n.left);
        const der = pelar(n.right);
        const pegado = (b > 0 && ts.isStringLiteralLike(izq) && acabaEnSep(izq.text)) || (a > 0 && ts.isStringLiteralLike(der) && empiezaPorSep(der.text));
        return pegado ? 2 : nivel;
      }
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return Math.max(leer(n.left), leer(n.right));
      return 0;
    }
    if (ts.isConditionalExpression(n)) return Math.max(leer(n.whenTrue), leer(n.whenFalse));
    if (ts.isIdentifier(n)) {
      if (n.text === '__dirname' || n.text === '__filename') return 1;
      const d = declaracionDe(n);
      if (!d) return sueltos.get(n.text) === 'sep' ? 1 : 0;
      if (d.tipo !== 'const' || !d.nodo.initializer) return 0;
      if (memo.has(d.nodo)) return memo.get(d.nodo);
      if (enCurso.has(d.nodo)) return 0;
      enCurso.add(d.nodo);
      const nivel = leer(d.nodo.initializer);
      enCurso.delete(d.nodo);
      memo.set(d.nodo, nivel);
      return nivel;
    }
    if (ts.isPropertyAccessExpression(n)) {
      if (esEspacio(n.expression) && n.name.text === 'sep') return 1;
      if (ts.isMetaProperty(n.expression) && (n.name.text === 'dirname' || n.name.text === 'filename')) return 1;
      return 0;
    }
    if (ts.isCallExpression(n)) {
      const f = pelar(n.expression);
      if (ts.isIdentifier(f)) {
        if (f.text === 'fileURLToPath') return 1;
        if (f.text === 'String' && n.arguments.length) return leer(n.arguments[0]);
        const d = declaracionDe(f);
        if (!d) return FUENTES.has(sueltos.get(f.text)) ? 1 : 0;
        const fn = funcionDe(f);
        return fn ? devuelve(fn) : 0;
      }
      if (!ts.isPropertyAccessExpression(f)) return 0;
      const metodo = f.name.text;
      if (esEspacio(f.expression)) return FUENTES.has(metodo) ? 1 : 0;
      if (ABSOLUTAS.has(metodo)) return 1;
      const quien = pelar(f.expression);
      // `x.split(a).join(b)`: es ruta de máquina si se junta con el separador; deja de serlo si se partió por él.
      if (metodo === 'join' && ts.isCallExpression(quien) && ts.isPropertyAccessExpression(quien.expression) && quien.expression.name.text === 'split') {
        if (n.arguments.length && leer(n.arguments[0]) > 0) return 1;
        if (quien.arguments.length && esSeparador(quien.arguments[0])) return 0;
        return leer(quien.expression.expression);
      }
      if ((metodo === 'replace' || metodo === 'replaceAll') && n.arguments.length >= 2) {
        if (leer(n.arguments[1]) > 0) return 1;
        if (esSeparador(n.arguments[0])) return 0;
        return leer(quien);
      }
      if (CONSERVAN.has(metodo)) return leer(quien);
      return 0;
    }
    return 0;
  }
  // Lo mismo, bajando por los arrays y objetos escritos en el sitio (lo que recibe un `deepEqual`).
  const contiene = (expr) => {
    const n = pelar(expr);
    if (!n) return 0;
    if (ts.isArrayLiteralExpression(n)) return Math.max(0, ...n.elements.map((e) => contiene(ts.isSpreadElement(e) ? e.expression : e)));
    if (ts.isObjectLiteralExpression(n)) return Math.max(0, ...n.properties.map((p) => (ts.isPropertyAssignment(p) ? contiene(p.initializer) : 0)));
    return leer(n);
  };

  // ④ Qué hay al otro lado de la comparación.
  const contra = (expr, salto = 0) => {
    const n = pelar(expr);
    if (!n) return 'no-leido';
    if (contiene(n) > 0) return 'maquina';
    if (ts.isStringLiteralLike(n)) return tieneSep(n.text) ? 'literal-sep' : 'literal-sin-sep';
    if (ts.isTemplateExpression(n)) return (tieneSep(n.head.text) || n.templateSpans.some((s) => tieneSep(s.literal.text))) ? 'literal-sep' : 'no-leido';
    if (ts.isRegularExpressionLiteral(n)) {
      const cuerpo = n.text.slice(1, n.text.lastIndexOf('/'));
      const barra = cuerpo.includes('/');
      const contrabarra = cuerpo.includes('\\\\');
      if (barra && contrabarra) return 'regex-dos-separadores';
      return (barra || contrabarra) ? 'literal-sep' : 'literal-sin-sep';
    }
    if (ts.isNumericLiteral(n) || n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword) return 'literal-sin-sep';
    if (ts.isArrayLiteralExpression(n)) {
      const dentro = n.elements.map((e) => contra(ts.isSpreadElement(e) ? e.expression : e, salto));
      if (dentro.includes('literal-sep')) return 'literal-sep';
      if (dentro.length && dentro.every((d) => d === 'literal-sin-sep')) return 'literal-sin-sep';
      return 'no-leido';
    }
    if (ts.isIdentifier(n) && salto < 2) {
      if (n.text === 'undefined') return 'literal-sin-sep';
      const d = declaracionDe(n);
      if (d && d.tipo === 'const' && d.nodo.initializer) return contra(d.nodo.initializer, salto + 1);
    }
    return 'no-leido';
  };

  const hallazgos = [];
  let usaRutas = espacios.size > 0 || sueltos.size > 0;
  const apunta = (nodo, sumidero, lados) => {
    const niveles = lados.map((l) => contiene(l));
    const cuantos = niveles.filter((x) => x > 0).length;
    if (!cuantos) return;
    usaRutas = true;
    let frente;
    if (cuantos === lados.length) frente = 'maquina';
    else frente = contra(lados[niveles.findIndex((x) => x === 0)]);
    const veredicto = (niveles.includes(2) || frente === 'literal-sep') ? 'LITERAL'
      : frente === 'maquina' ? 'MAQUINA'
        : (frente === 'literal-sin-sep' || frente === 'regex-dos-separadores') ? 'INOCUO' : 'NO-LEIDO';
    const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf));
    const renglon = texto.split(/\r?\n/)[line].trim();
    hallazgos.push({
      linea: line + 1, sumidero, veredicto,
      contra: niveles.includes(2) ? 'la ruta lleva un separador escrito a mano' : frente,
      texto: renglon.length > 170 ? `${renglon.slice(0, 167)}…` : renglon,
    });
  };
  // Una MEZCLA es una ruta de máquina con un «/» o un «\» pegado a mano, llegue o no a una comparación a
  // la vista. Es lo que fabricaba el `foto()` de SCRUM-1473 (`${path.relative(raiz, p)}/`) antes de meterlo
  // en un array: el censo no sigue el array, pero el sitio donde nace la ruta rara sí lo ve.
  const mezclas = [];
  const esPegado = (n) => ts.isTemplateExpression(n) || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken);
  const visita = (n) => {
    if (esPegado(n) && leer(n) === 2) {
      let arriba = n.parent;
      while (arriba && ts.isParenthesizedExpression(arriba)) arriba = arriba.parent;
      if (!(arriba && esPegado(arriba) && leer(arriba) === 2)) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        const renglon = texto.split(/\r?\n/)[line].trim();
        mezclas.push({ linea: line + 1, texto: renglon.length > 170 ? `${renglon.slice(0, 167)}…` : renglon });
      }
    }
    if (ts.isBinaryExpression(n) && IGUALDAD.has(n.operatorToken.kind)) apunta(n, n.operatorToken.getText(sf), [n.left, n.right]);
    else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      const quien = n.expression.expression;
      const esAssert = ts.isIdentifier(pelar(quien)) && /^assert/i.test(pelar(quien).text);
      if (esAssert && ASERTOS.has(metodo) && n.arguments.length >= 2) apunta(n, `assert.${metodo}`, [n.arguments[0], n.arguments[1]]);
      else if (esAssert && ASERTOS_RE.has(metodo) && n.arguments.length >= 2) apunta(n, `assert.${metodo}`, [n.arguments[0], n.arguments[1]]);
      else if (METODOS.has(metodo) && n.arguments.length >= 1) apunta(n, `.${metodo}()`, [quien, n.arguments[0]]);
      else if (CON_RE.has(metodo) && n.arguments.length >= 1) apunta(n, `.${metodo}()`, [quien, n.arguments[0]]);
      else if (metodo === 'test' && n.arguments.length === 1 && (ts.isRegularExpressionLiteral(pelar(quien)) || contra(quien) !== 'no-leido')) apunta(n, 'regex.test()', [n.arguments[0], quien]);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { leido: true, usaRutas: usaRutas || mezclas.length > 0, hallazgos, mezclas };
}

/** Los ficheros de código que cuelgan de una carpeta (por defecto, `tests/`), ordenados y con «/». */
export function poblacion(raiz, carpeta = 'tests') {
  const base = path.join(raiz, carpeta);
  return fs.readdirSync(base, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(mjs|cjs|js|ts)$/.test(e.name))
    .map((e) => path.relative(raiz, path.join(e.parentPath || e.path, e.name)).split(path.sep).join('/'))
    .sort();
}

/** Corre el censo sobre una lista de ficheros (relativos a `raiz`). */
export function censar(raiz, ficheros = poblacion(raiz)) {
  const filas = [];
  const mezclas = [];
  const sinLeer = [];
  let conRutas = 0;
  for (const rel of ficheros) {
    let r;
    try { r = analizar(fs.readFileSync(path.join(raiz, rel), 'utf8'), rel); } catch (e) { r = { leido: false, motivo: String(e.code || e.message), hallazgos: [], mezclas: [] }; }
    if (!r.leido) { sinLeer.push({ fichero: rel, motivo: r.motivo }); continue; }
    if (r.usaRutas) conRutas++;
    for (const h of r.hallazgos) filas.push({ fichero: rel, ...h });
    for (const m of r.mezclas) mezclas.push({ fichero: rel, ...m });
  }
  const de = (v) => filas.filter((f) => f.veredicto === v);
  return { poblacion: ficheros.length, conRutas, sinLeer, filas, mezclas, literal: de('LITERAL'), maquina: de('MAQUINA'), inocuo: de('INOCUO'), noLeido: de('NO-LEIDO') };
}

/** La clave de un hallazgo para una lista declarada: fichero + el renglón, SIN el número de línea (que caduca). */
export const claveDe = (f) => `${f.fichero} · ${f.texto}`;

export function informe(c, { todo = false } = {}) {
  const fich = (l) => new Set(l.map((f) => f.fichero)).size;
  const out = [
    `POBLACION · ${c.poblacion} ficheros de código leídos · ${c.sinLeer.length} que NO supo leer · ${c.conRutas} tocan rutas de máquina`,
    `SITIOS donde una ruta de máquina llega a una comparación: ${c.filas.length}, en ${fich(c.filas)} ficheros`,
    `  LITERAL  ${c.literal.length} en ${fich(c.literal)} ficheros · contra un «/» o «\\» escrito a mano: DIFIERE entre máquinas`,
    `  NO-LEIDO ${c.noLeido.length} en ${fich(c.noLeido)} ficheros · el otro lado no lo sabe seguir: lo lee una persona`,
    `  MAQUINA  ${c.maquina.length} en ${fich(c.maquina)} ficheros · ruta de máquina contra ruta de máquina`,
    `  INOCUO   ${c.inocuo.length} en ${fich(c.inocuo)} ficheros · contra un texto sin separador, o una regex que admite los dos`,
    `MEZCLAS · ${c.mezclas.length} en ${fich(c.mezclas)} ficheros · una ruta de máquina con un «/» o «\\» pegado a mano, llegue o no a una comparación`,
  ];
  const lista = (titulo, filas) => {
    out.push('', `── ${titulo} (${filas.length}) ──`);
    for (const f of filas) out.push(`${f.fichero}:${f.linea} · ${f.sumidero} · ${f.contra}`, `    ${f.texto}`);
  };
  for (const s of c.sinLeer) out.push(`SIN LEER · ${s.fichero} · ${s.motivo}`);
  lista('LITERAL', c.literal);
  lista('NO-LEIDO', c.noLeido);
  out.push('', `── MEZCLAS (${c.mezclas.length}) ──`);
  for (const m of c.mezclas) out.push(`${m.fichero}:${m.linea}`, `    ${m.texto}`);
  if (todo) { lista('MAQUINA', c.maquina); lista('INOCUO', c.inocuo); }
  out.push('', 'LO QUE ESTE CENSO NO VE (un cero suyo no lo absuelve):', ...LO_QUE_NO_VE.map((l) => `  · ${l}`));
  return out.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const args = process.argv.slice(2);
  const sueltosCli = args.filter((a) => !a.startsWith('--'));
  const c = sueltosCli.length ? censar(process.cwd(), sueltosCli) : censar(raiz);
  if (args.includes('--json')) console.log(JSON.stringify(c, null, 1));
  else console.log(informe(c, { todo: args.includes('--todo') }));
  const salida = c.sinLeer.length ? 2 : 0;
  if (!args.includes('--json')) console.log(`EXIT=${salida}`);
  process.exitCode = salida;
}
