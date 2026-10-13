// tests/_lista-en-la-mano.mjs — SCRUM-1392
//
// Lee, por AST, QUIÉN recorre con `recorrerCasos` (`scripts/_hallazgos-y-ciegos.mjs`) y si alguno de
// sus casos lleva LA LISTA EN LA MANO: una lista que nace dentro del caso, recibe apuntes y se
// devuelve. Si el caso lanza después del primer apunte, esa lista no llega a devolverse.
//
// Por AST y no por texto: los comentarios de estos guards nombran `recorrerCasos` y `hallazgos.push`
// al explicarse, y un `grep` los contaría (A23, casilla 2).
import ts from 'typescript';

/** Lo que este lector NO ve. Va en la salida del censo, no sólo aquí. */
export const LIMITES_DEL_CENSO = Object.freeze([
  'una lista que nace en una función y se apunta en OTRA (pasada como argumento) no se ve',
  'sólo sigue funciones declaradas en el mismo fichero; no sigue imports',
  'una llamada síncrona después del apunte se LISTA, no se juzga: que pueda lanzar se lee a mano',
]);

const esFuncion = (n) => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n));
const esBucle = (n) => ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n);

/** Los nodos de `raiz` que no están dentro de OTRA función: lo que corre cuando corre `raiz`. */
function propios(raiz, visitar) {
  const ver = (n) => {
    if (n !== raiz && esFuncion(n)) return;
    visitar(n);
    ts.forEachChild(n, ver);
  };
  ver(raiz);
}

/** Todos los descendientes, funciones anidadas incluidas. */
function todos(raiz, visitar) {
  const ver = (n) => { visitar(n); ts.forEachChild(n, ver); };
  ver(raiz);
}

/** Con qué nombres se llama a `recorrerCasos` en este fichero (alias de import incluidos). */
function nombresDelRecorrido(sf) {
  const directos = new Set(['recorrerCasos']);
  const espacios = new Set();
  let importaLaPieza = false;
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    if (!/(^|\/)_hallazgos-y-ciegos\.mjs$/.test(s.moduleSpecifier.text)) continue;
    importaLaPieza = true;
    const b = s.importClause && s.importClause.namedBindings;
    if (b && ts.isNamespaceImport(b)) espacios.add(b.name.text);
    if (b && ts.isNamedImports(b)) {
      for (const e of b.elements) if ((e.propertyName || e.name).text === 'recorrerCasos') directos.add(e.name.text);
    }
  }
  return { directos, espacios, importaLaPieza };
}

/** Las funciones del fichero, por nombre; y los objetos literales que guardan funciones. */
function tablaDeFunciones(sf) {
  const porNombre = new Map();
  const porObjeto = new Map();
  const apuntar = (nombre, fn) => { if (!porNombre.has(nombre)) porNombre.set(nombre, []); porNombre.get(nombre).push(fn); };
  todos(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) apuntar(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (esFuncion(n.initializer)) apuntar(n.name.text, n.initializer);
      if (ts.isObjectLiteralExpression(n.initializer)) {
        const suyas = [];
        for (const p of n.initializer.properties) {
          const fn = ts.isMethodDeclaration(p) ? p : (ts.isPropertyAssignment(p) && esFuncion(p.initializer) ? p.initializer : null);
          if (!fn || !p.name) continue;
          suyas.push(fn);
          if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) apuntar(p.name.text, fn);
        }
        if (suyas.length) porObjeto.set(n.name.text, suyas);
      }
    }
  });
  return { porNombre, porObjeto };
}

/** El caso y todo lo que alcanza dentro del fichero. */
function alcanzadas(caso, tabla) {
  const vistas = new Set([caso]);
  const cola = [caso];
  const meter = (fns) => { for (const f of fns || []) if (!vistas.has(f)) { vistas.add(f); cola.push(f); } };
  while (cola.length) {
    todos(cola.shift(), (n) => {
      if (!ts.isCallExpression(n)) return;
      const f = n.expression;
      if (ts.isIdentifier(f)) meter(tabla.porNombre.get(f.text));
      if (ts.isPropertyAccessExpression(f)) meter(tabla.porNombre.get(f.name.text));
      if (ts.isElementAccessExpression(f) && ts.isIdentifier(f.expression)) meter(tabla.porObjeto.get(f.expression.text));
    });
  }
  return [...vistas];
}

/** Las listas que nacen en `fn`, reciben apuntes y se devuelven. */
function listasEnLaMano(fn, sf, entregada) {
  const lineaDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const nacidas = [];
  propios(fn, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    if (ts.isArrayLiteralExpression(n.initializer)) nacidas.push({ ruta: n.name.text, raiz: n.name.text, linea: lineaDe(n) });
    if (ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ts.isArrayLiteralExpression(p.initializer)) {
          nacidas.push({ ruta: n.name.text + '.' + p.name.text, raiz: n.name.text, linea: lineaDe(n) });
        }
      }
    }
  });
  const salida = [];
  for (const l of nacidas) {
    const apuntes = [];
    todos(fn, (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push'
        && n.expression.expression.getText(sf) === l.ruta) apuntes.push(n);
    });
    if (!apuntes.length) continue;
    let devuelta = false;
    let papel = /\.hallazgos$/.test(l.ruta) ? 'hallazgos' : (/\.ciegos$/.test(l.ruta) ? 'ciegos' : 'desconocido');
    propios(fn, (n) => {
      if (!ts.isReturnStatement(n) || !n.expression) return;
      todos(n.expression, (m) => {
        if (!ts.isIdentifier(m) || m.text !== l.raiz) return;
        devuelta = true;
        const p = m.parent;
        if (ts.isPropertyAssignment(p) && p.initializer === m && ts.isIdentifier(p.name) && l.ruta === l.raiz) papel = p.name.text;
        if (ts.isShorthandPropertyAssignment(p) && l.ruta === l.raiz) papel = m.text;
      });
    });
    if (!devuelta) continue;
    // Desde dónde cuenta «después»: el primer apunte, o el bucle que lo contiene (la vuelta siguiente
    // corre el principio del cuerpo con el apunte ya hecho).
    const primero = apuntes.reduce((a, b) => (a.getStart(sf) <= b.getStart(sf) ? a : b));
    let desde = primero;
    for (let p = primero.parent; p && p !== fn; p = p.parent) if (esBucle(p)) desde = p;
    const inicio = desde.getStart(sf);
    const awaits = [];
    const lanzamientos = [];
    const llamadas = [];
    propios(fn, (n) => {
      if (n.getStart(sf) < inicio) return;
      if (ts.isAwaitExpression(n)) awaits.push(lineaDe(n));
      if (ts.isThrowStatement(n)) lanzamientos.push(lineaDe(n));
      if (ts.isCallExpression(n)) {
        const quien = n.expression.getText(sf);
        if (/\.push$/.test(quien) || /^console\./.test(quien)) return;
        llamadas.push(quien.length > 40 ? quien.slice(0, 37) + '…' : quien);
      }
    });
    salida.push({
      lista: l.ruta, papel, lineaDondeNace: l.linea, primerApunte: lineaDe(primero), apuntes: apuntes.length,
      // La lista que entrega la pieza NO es una lista en la mano: sobrevive al lanzamiento.
      esLaEntregada: Boolean(entregada && l.raiz === entregada),
      awaitsDespues: awaits, lanzamientosDespues: lanzamientos, llamadasDespues: [...new Set(llamadas)],
    });
  }
  return salida;
}

/**
 * El censo de UN fuente. `llamadas` son las llamadas a `recorrerCasos`; cada una dice si se pudo
 * leer su caso (`resuelta`) y qué listas en la mano alcanza.
 */
export function censoDeFuente(fuente, nombre = 'fuente.mjs') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true);
  const { directos, espacios, importaLaPieza } = nombresDelRecorrido(sf);
  const tabla = tablaDeFunciones(sf);
  const llamadas = [];
  todos(sf, (n) => {
    if (!ts.isCallExpression(n)) return;
    const f = n.expression;
    const es = (ts.isIdentifier(f) && directos.has(f.text))
      || (ts.isPropertyAccessExpression(f) && f.name.text === 'recorrerCasos' && ts.isIdentifier(f.expression) && espacios.has(f.expression.text));
    if (!es) return;
    const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const arg = n.arguments[1];
    let caso = null;
    if (esFuncion(arg)) caso = arg;
    else if (arg && ts.isIdentifier(arg) && (tabla.porNombre.get(arg.text) || []).length === 1) caso = tabla.porNombre.get(arg.text)[0];
    if (!caso) { llamadas.push({ linea, resuelta: false, parametros: null, enLaMano: [] }); return; }
    const segundo = caso.parameters[1];
    const entregada = segundo && ts.isIdentifier(segundo.name) ? segundo.name.text : null;
    const enLaMano = [];
    for (const fn of alcanzadas(caso, tabla)) enLaMano.push(...listasEnLaMano(fn, sf, entregada));
    llamadas.push({ linea, resuelta: true, parametros: caso.parameters.length, enLaMano: enLaMano.filter((l) => !l.esLaEntregada) });
  });
  return { importaLaPieza, llamadas };
}

/** Los defectos de un fuente: casos que no se pudieron leer, y listas de hallazgos en la mano. */
export function defectosDeFuente(fuente, nombre) {
  const defectos = [];
  for (const ll of censoDeFuente(fuente, nombre).llamadas) {
    if (!ll.resuelta) { defectos.push(`línea ${ll.linea}: no sé leer el caso de este recorrido (no es una función escrita ahí ni una del fichero)`); continue; }
    for (const l of ll.enLaMano) {
      if (l.papel === 'ciegos') continue;
      defectos.push(`línea ${l.lineaDondeNace}: «${l.lista}» nace dentro del caso, recibe ${l.apuntes} apunte(s) y se devuelve — si el caso lanza después, se pierde`);
    }
  }
  return defectos;
}
