// tests/_censo-almacenamiento-publico.mjs — SCRUM-336
//
// CENSO DERIVADO del almacenamiento persistente en la SUPERFICIE PÚBLICA, y de los enlaces
// internos al registro que tienen que llevar la atribución.
//
// ⚠️ AST, no `grep`: hay que distinguir `localStorage.setItem('x')` de la palabra «localStorage»
// escrita en un comentario que explica por qué ya no se usa — y este repo está lleno de esos
// comentarios justo después de SCRUM-336. Un guard de texto se cazaría a sí mismo.
//
// ⚠️ Y NINGUNA LISTA A MANO: ni de páginas, ni de enlaces. Se recorre `public/` entero. Una lista
// envejece el día que alguien añade una página con un CTA y nadie se entera de que ese camino ni
// atribuye ni está vigilado.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * QUÉ ES «SUPERFICIE PÚBLICA»: `public/` MENOS `public/dashboard/`.
 *
 * El panel es la app DESPUÉS de identificarse, con una relación ya establecida y un servicio
 * pedido; su almacenamiento (preferencias de vista, borradores) es otra conversación y no es de
 * este ticket. La landing, precios, login y registro los ve cualquiera sin haber pedido nada:
 * ahí es donde el art. 5.3 muerde.
 */
export const PANEL = 'public/dashboard/';
const DESTINO_REGISTRO = '/register.html';

const ALMACENES = ['localStorage', 'sessionStorage'];
/** SCRUM-1687 · el almacén de una llamada cuyo receptor no se sabe seguir. Se VE; no desaparece. */
export const NO_RESUELTO = '(almacén no resuelto)';
const OPERACIONES = ['setItem', 'getItem', 'removeItem'];

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { ficheros(p, out); continue; }
    if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Los `<script>` de un HTML, con el desplazamiento para poder dar la línea REAL del fichero. */
function trozosDeScript(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    out.push({ codigo: m[1], offsetLineas: html.slice(0, m.index).split('\n').length - 1 });
  }
  return out;
}

/**
 * Todos los accesos a almacenamiento del navegador en `public/`.
 * `cookie` incluida: `document.cookie = …` es almacenamiento en el terminal igual que `localStorage`
 * (el art. 5.3 no habla de la tecnología). Si algún día alguien lo usa para atribuir, el censo lo ve.
 */
export function censarAlmacenamiento(raizPublic, raizRepo) {
  const accesos = [];
  // SCRUM-1687 · primero se parsea TODO `public/`: los scripts del panel son globales entre ficheros
  // (`guardarCopiaDeSesion` se declara en uno y se llama con `window.localStorage` en otro), así que
  // seguir un valor exige ver el resto de ficheros, no solo el de la llamada.
  const unidades = [];
  for (const abs of ficheros(raizPublic)) {
    const rel = path.relative(raizRepo, abs).replace(/\\/g, '/');
    const texto = fs.readFileSync(abs, 'utf8');
    const trozos = abs.endsWith('.html') ? trozosDeScript(texto) : [{ codigo: texto, offsetLineas: 0 }];
    for (const { codigo, offsetLineas } of trozos) {
      unidades.push({ rel, offsetLineas,
        sf: ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS) });
    }
  }
  const indice = indexar(unidades);

  for (const { rel, offsetLineas, sf } of unidades) {
    {
      const linea = (n) => offsetLineas + sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

      (function walk(n) {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
            && OPERACIONES.includes(n.expression.name.text)) {
          const receptor = n.expression.expression.getText(sf);
          const op = n.expression.name.text;
          // SCRUM-1687 · el almacén se decide por el VALOR del receptor, no por su texto. Lo que no
          // se sabe seguir hasta UN almacén sale como NO_RESUELTO: se ve, no desaparece.
          const posibles = almacenesDe(n.expression.expression, indice, new Set());
          const almacen = posibles && posibles.size === 1 ? [...posibles][0] : NO_RESUELTO;
          {
            const clave = n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])
              ? n.arguments[0].text : '(clave no literal)';
            accesos.push({
              fichero: rel, linea: linea(n), almacen, op, clave,
              escribe: op === 'setItem',
              enElPanel: rel.startsWith(PANEL),
              // SCRUM-457 · campo AÑADIDO, no sustituido: `clave` sigue diciendo exactamente lo que
              // decía. Ver `resolverClave` para qué es y por qué puede ser `null`.
              claveResuelta: resolverClave(n.arguments[0], sf),
              // SCRUM-1687 · campo AÑADIDO: el texto del receptor, para que quien lea un
              // NO_RESUELTO sepa qué mirar.
              receptor,
              id: `${rel}::${almacen}.${op}('${clave}')`,
            });
          }
        }
        // `document.cookie = …`
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'cookie') {
          accesos.push({
            fichero: rel, linea: linea(n), almacen: 'cookie', op: 'setItem', clave: '(cookie)',
            escribe: true, enElPanel: rel.startsWith(PANEL),
            id: `${rel}::document.cookie=`,
          });
        }
        ts.forEachChild(n, walk);
      })(sf);
    }
  }
  accesos.sort((a, b) => a.id.localeCompare(b.id));
  return accesos;
}

/**
 * SCRUM-1687 · QUÉ ALMACÉN ES el receptor de una llamada, siguiendo su VALOR por el AST.
 *
 * Antes se decidía por el TEXTO (`/(^|\.)localStorage$/` sobre el receptor), y eso dejaba fuera
 * `const a = window.localStorage; a.setItem(…)` y `function f(almacen) { almacen.setItem(…) }` —
 * dos escrituras reales de main el 11-nov-2026— y metía DENTRO un parámetro que se llamase
 * `localStorage` y valiese otra cosa.
 *
 * Formas que se siguen, y ninguna más (no es un intérprete):
 *   · `localStorage` global · `x.localStorage` · `x['localStorage']`;
 *   · un nombre → su declaración en el ámbito que lo contiene (o, si es global, la única de todo
 *     `public/`), siempre que no se reasigne;
 *   · un parámetro → el argumento en esa posición en TODAS las llamadas a la función en `public/`;
 *   · una llamada a una función → todos sus `return`;
 *   · `c ? a : b`, `a && b`, `a || b`, `a ?? b`; `null`/`undefined` no aportan almacén.
 *
 * 🔴 Devuelve `null` (= NO_RESUELTO) cuando no lo sabe: un nombre declarado dos veces, reasignado,
 * desestructurado, un parámetro sin llamadas, una función que además se pasa como valor (alguien la
 * llama sin que se vea). Nunca adivina.
 *
 * @returns {Set<string>|null}  los almacenes posibles; vacío si solo puede ser null/undefined.
 */
function almacenesDe(expr, indice, vistos, prof = 0) {
  if (!expr || prof > 12) return null;
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  if (expr.kind === ts.SyntaxKind.NullKeyword || ts.isVoidExpression(expr)) return new Set();
  if (ts.isPropertyAccessExpression(expr)) {
    return ALMACENES.includes(expr.name.text) ? new Set([expr.name.text]) : null;
  }
  if (ts.isElementAccessExpression(expr) && ts.isStringLiteralLike(expr.argumentExpression)) {
    return ALMACENES.includes(expr.argumentExpression.text) ? new Set([expr.argumentExpression.text]) : null;
  }
  if (ts.isConditionalExpression(expr)) {
    return unir(almacenesDe(expr.whenTrue, indice, vistos, prof + 1),
      almacenesDe(expr.whenFalse, indice, vistos, prof + 1));
  }
  if (ts.isBinaryExpression(expr)) {
    const k = expr.operatorToken.kind;
    // `a && b` vale `b` o un falso, y un falso no es un almacén.
    if (k === ts.SyntaxKind.AmpersandAmpersandToken) return almacenesDe(expr.right, indice, vistos, prof + 1);
    if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) {
      return unir(almacenesDe(expr.left, indice, vistos, prof + 1),
        almacenesDe(expr.right, indice, vistos, prof + 1));
    }
    return null;
  }
  if (ts.isIdentifier(expr)) return almacenesDeNombre(expr, indice, vistos, prof);
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const fns = indice.funciones.get(expr.expression.text) || [];
    if (fns.length !== 1) return null;
    const retornos = [];
    (function busca(n) {
      if (n !== fns[0] && ts.isFunctionLike(n)) return; // los `return` de funciones anidadas no son suyos
      if (ts.isReturnStatement(n)) retornos.push(n.expression);
      ts.forEachChild(n, busca);
    })(fns[0]);
    if (!retornos.length) return null;
    return retornos.reduce((acc, r) => unir(acc, r ? almacenesDe(r, indice, vistos, prof + 1) : new Set()), new Set());
  }
  return null;
}

function unir(a, b) {
  if (!a || !b) return null;
  return new Set([...a, ...b]);
}

/** `'exacto'` si el binding ES ese nombre; `'patron'` si lo contiene desestructurado; si no, `false`. */
function nombra(binding, texto) {
  if (ts.isIdentifier(binding)) return binding.text === texto ? 'exacto' : false;
  let dentro = false;
  (function busca(n) {
    if (ts.isIdentifier(n) && n.text === texto && ts.isBindingElement(n.parent) && n.parent.name === n) dentro = true;
    ts.forEachChild(n, busca);
  })(binding);
  return dentro ? 'patron' : false;
}

function almacenesDeNombre(id, indice, vistos, prof) {
  const texto = id.text;
  if (texto === 'undefined') return new Set();
  for (let a = id.parent; a; a = a.parent) {
    if (ts.isFunctionLike(a) && a.parameters) {
      const i = a.parameters.findIndex((p) => nombra(p.name, texto));
      if (i >= 0) {
        return nombra(a.parameters[i].name, texto) === 'exacto'
          ? almacenesDeParametro(a, i, indice, vistos, prof) : null;
      }
    }
    if (ts.isCatchClause(a) && a.variableDeclaration && nombra(a.variableDeclaration.name, texto)) return null;
    // Bucles: la variable del bucle no tiene UN valor que se pueda leer en su declaración.
    if ((ts.isForOfStatement(a) || ts.isForInStatement(a) || ts.isForStatement(a))
        && a.initializer && ts.isVariableDeclarationList(a.initializer)
        && a.initializer.declarations.some((d) => nombra(d.name, texto))) return null;
    if (a.statements) {
      const decls = declaracionesEn(a.statements, texto);
      if (decls === null) return null;
      if (decls.length) return almacenesDeDeclaracion(decls, indice, vistos, prof);
    }
  }
  // No está declarado en ningún ámbito que lo contenga: es un global.
  if (ALMACENES.includes(texto)) return new Set([texto]);
  const globales = indice.globales.get(texto) || [];
  if (indice.asignados.has(texto)) return null;
  return globales.length ? almacenesDeDeclaracion(globales, indice, vistos, prof) : null;
}

/** Las declaraciones de `texto` entre estas sentencias; `null` si alguna lo desestructura o es una función. */
function declaracionesEn(sentencias, texto) {
  const out = [];
  for (const s of sentencias) {
    if (ts.isFunctionDeclaration(s) && s.name && s.name.text === texto) return null;
    if (!ts.isVariableStatement(s)) continue;
    for (const d of s.declarationList.declarations) {
      const r = nombra(d.name, texto);
      if (r === 'patron') return null;
      if (r === 'exacto') out.push(d);
    }
  }
  return out;
}

/**
 * `vistos` es la PILA del camino que se está siguiendo, no un «ya visitado»: corta un ciclo
 * (`const A = B; const B = A;`) sin castigar dos llamadas legítimas que pasan el mismo alias.
 */
function enLaPila(vistos, llave, fn) {
  if (vistos.has(llave)) return null;
  vistos.add(llave);
  try { return fn(); } finally { vistos.delete(llave); }
}

function almacenesDeDeclaracion(decls, indice, vistos, prof) {
  if (decls.length !== 1 || !decls[0].initializer) return null;
  const d = decls[0];
  const esConst = (d.parent.flags & ts.NodeFlags.Const) !== 0;
  // Un `let`/`var` reasignado en su fichero ya no vale lo que dice su inicializador.
  if (!esConst && (indice.asignadosPorFichero.get(d.getSourceFile()) || new Set()).has(d.name.text)) return null;
  return enLaPila(vistos, `${d.getSourceFile().fileName}:${d.pos}`,
    () => almacenesDe(d.initializer, indice, vistos, prof + 1));
}

function nombreDeFuncion(fn) {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  if (fn.parent && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text;
  return null;
}

function almacenesDeParametro(fn, i, indice, vistos, prof) {
  const nombre = nombreDeFuncion(fn);
  if (!nombre || (indice.funciones.get(nombre) || []).length !== 1) return null;
  return enLaPila(vistos, `${fn.getSourceFile().fileName}:${fn.pos}:${i}`,
    () => argumentosDe(nombre, i, indice, vistos, prof));
}

function argumentosDe(nombre, i, indice, vistos, prof) {
  // Si la función se pasa como VALOR (callback, `addEventListener('x', f)`…), alguien la llama sin
  // que se vea la llamada: los argumentos visibles no son todos los que recibe.
  if (indice.comoValor.has(nombre)) return null;
  const llamadas = indice.llamadas.get(nombre) || [];
  if (!llamadas.length) return null;
  return llamadas.reduce((acc, c) => unir(acc,
    c.arguments[i] ? almacenesDe(c.arguments[i], indice, vistos, prof + 1) : new Set()), new Set());
}

/** El índice global de `public/`: funciones, globales, llamadas, usos como valor y reasignaciones. */
function indexar(unidades) {
  const indice = {
    funciones: new Map(), globales: new Map(), llamadas: new Map(),
    comoValor: new Set(), asignados: new Set(), asignadosPorFichero: new Map(),
  };
  const meter = (mapa, k, v) => { if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(v); };
  for (const { sf } of unidades) {
    const asignadosAqui = new Set();
    indice.asignadosPorFichero.set(sf, asignadosAqui);
    for (const s of sf.statements) {
      if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) meter(indice.globales, d.name.text, d);
        }
      }
    }
    (function walk(n) {
      if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n))) {
        const nombre = nombreDeFuncion(n);
        if (nombre) meter(indice.funciones, nombre, n);
      }
      if (ts.isCallExpression(n)) {
        const c = n.expression;
        if (ts.isIdentifier(c)) meter(indice.llamadas, c.text, n);
        else if (ts.isPropertyAccessExpression(c)) meter(indice.llamadas, c.name.text, n);
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
          && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && ts.isIdentifier(n.left)) {
        asignadosAqui.add(n.left.text);
        indice.asignados.add(n.left.text);
      }
      if (ts.isIdentifier(n) && usoComoValor(n)) indice.comoValor.add(n.text);
      ts.forEachChild(n, walk);
    })(sf);
  }
  return indice;
}

/**
 * ¿Este identificador es una REFERENCIA a su valor fuera de una llamada? Se excluyen las formas que
 * no reparten la función a nadie: su propia declaración, ser el callee, ser un nombre de propiedad,
 * y las dos exportaciones del panel (`window.f = f` y `module.exports = { f }`).
 */
function usoComoValor(id) {
  const p = id.parent;
  if (!p) return false;
  if ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isVariableDeclaration(p)
       || ts.isParameter(p) || ts.isBindingElement(p)) && p.name === id) return false;
  if (ts.isCallExpression(p) && p.expression === id) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) && p.name === id) return false;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    if (p.left === id) return false;
    if (p.right === id && ts.isPropertyAccessExpression(p.left) && p.left.name.text === id.text) return false;
  }
  if (ts.isShorthandPropertyAssignment(p) && ts.isObjectLiteralExpression(p.parent)
      && ts.isBinaryExpression(p.parent.parent) && p.parent.parent.left.getText() === 'module.exports') return false;
  if (ts.isTypeOfExpression(p)) return false;
  return true;
}

/**
 * SCRUM-457 · QUÉ CLAVE ES, cuando el argumento no es una cadena a secas.
 *
 * Hacía falta porque las dos claves que MÁS importan —el borrador y el catálogo con precios— se
 * escriben como `localStorage.setItem(draftKey(), …)`, y el censo de SCRUM-336 las daba por «clave
 * no literal». Para decidir si una clave está registrada hay que saber cómo empieza.
 *
 * Se resuelve UN salto, no más: literal, plantilla, o llamada a una función del MISMO fichero cuyo
 * `return` es una de esas dos cosas. Es lo que hay hoy y no se inventa un intérprete.
 *
 * 🔴 Y CUANDO NO SE SABE, DEVUELVE `null` — que el guard trata como CEGUERA y pone en rojo, no
 * como «no hay clave». Un `null` que se lee igual que «no existe» es lo que dejó dos vistas sin
 * medir en SCRUM-448.
 *
 * @returns {{tipo:'exacta'|'prefijo', valor:string}|null}
 */
function resolverClave(arg, sf, vistos = new Set()) {
  if (!arg) return null;
  if (ts.isStringLiteralLike(arg) && !ts.isTemplateExpression(arg)) {
    return { tipo: 'exacta', valor: arg.text };
  }
  if (ts.isTemplateExpression(arg)) {
    // `pf_quote_draft_${mid}` → todo lo que hay ANTES del primer hueco. Si no hay nada antes, el
    // prefijo es vacío y eso no identifica nada: se declara ciego.
    return arg.head.text ? { tipo: 'prefijo', valor: arg.head.text } : null;
  }
  // `'pf_algo_' + mid` — la otra forma de componer una clave, y hay que saber leerla: si no, una
  // escritura nueva escrita con `+` se declara ciega y parece un fallo del censo cuando es solo
  // una forma que no habíamos previsto. Se toma la parte IZQUIERDA si es una cadena.
  if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const izq = resolverClave(arg.left, sf, vistos);
    return izq && izq.valor ? { tipo: 'prefijo', valor: izq.valor } : null;
  }
  // SCRUM-584 · `localStorage.setItem(CLAVE_COLUMNAS, …)`: la clave vive en una CONSTANTE del
  // mismo fichero. Se añade por la MISMA razón que se añadió el `+` de arriba —una forma
  // corriente que nadie había previsto dejaba ciego al censo— y con el mismo límite: un salto,
  // identificador → su declaración en ESTE fichero, cuyo valor se vuelve a resolver con estas
  // reglas. No es un intérprete y no pretende serlo.
  //
  // 🔴 Dos cautelas, y las dos hacen que devuelva `null` (= ciego, = rojo), nunca una adivinanza:
  //   · si el nombre está declarado MÁS DE UNA VEZ en el fichero, no se elige: no se sabe cuál es.
  //   · `vistos` corta `const A = B; const B = A;` — sin él, el censo se colgaría al leerlo, y un
  //     censo colgado no es un rojo: es una tanda que no termina y nadie sabe por qué.
  if (ts.isIdentifier(arg)) {
    if (vistos.has(arg.text)) return null;
    vistos.add(arg.text);
    const valores = [];
    (function busca(n) {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)
          && n.name.text === arg.text && n.initializer) {
        valores.push(n.initializer);
      }
      ts.forEachChild(n, busca);
    })(sf);
    return valores.length === 1 ? resolverClave(valores[0], sf, vistos) : null;
  }
  if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
    const nombre = arg.expression.text;
    let hallada = null;
    (function busca(n) {
      if (hallada) return;
      const esLaFuncion = (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre)
        || ((ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && ts.isVariableDeclaration(n.parent)
            && ts.isIdentifier(n.parent.name) && n.parent.name.text === nombre);
      if (esLaFuncion && n.body) {
        (function buscaReturn(b) {
          if (hallada) return;
          if (ts.isReturnStatement(b) && b.expression) hallada = resolverClave(b.expression, sf, vistos);
          ts.forEachChild(b, buscaReturn);
        })(n.body);
      }
      ts.forEachChild(n, busca);
    })(sf);
    return hallada;
  }
  return null;
}

/**
 * Los enlaces internos al registro, derivados del DOM escrito (HTML) y del JS que inyecta HTML.
 * Sirven para el suelo: si el censo no ve NINGUNO, la comprobación de que la atribución viaja por
 * la URL no estaría comprobando nada.
 */
export function censarEnlacesAlRegistro(raizPublic, raizRepo) {
  const enlaces = [];
  for (const abs of ficheros(raizPublic)) {
    const rel = path.relative(raizRepo, abs).replace(/\\/g, '/');
    if (rel.startsWith(PANEL)) continue;
    fs.readFileSync(abs, 'utf8').split(/\r?\n/).forEach((l, i) => {
      for (const m of l.matchAll(/["'](\/register\.html[^"']*)["']/g)) {
        enlaces.push({ fichero: rel, linea: i + 1, destino: m[1] });
      }
    });
  }
  return enlaces;
}

export { DESTINO_REGISTRO };
