// tests/_censo-cierre-trabajo.mjs — SCRUM-344
//
// CENSO DERIVADO (AST de TypeScript sobre el JS) de la acción de CERRAR un Trabajo en la vista de
// Trabajos. No es una lista a mano: una lista no avisa de lo que le falta, y lo que hay que demostrar
// es justamente una AUSENCIA (que no queda ningún cierre sin aviso). Por eso se enumeran TODOS los
// sitios que transicionan a `cerrado`, vengan de donde vengan, y se mira uno por uno.
//
// Lo que deriva, y por qué cada cosa:
//   · `cierres`  — toda llamada que manda `status: 'cerrado'`. Se localizan por la FORMA del objeto
//                  literal, no por buscar la palabra en el fichero: un `grep` cazaría el rótulo del
//                  grupo «🔒 Cerrados» y el `JOB_STATE_META.cerrado`, que no cierran nada.
//   · `guardas`  — de cada cierre, las condiciones que lo protegen. Cuentan las dos formas: el `if`
//                  que lo ENVUELVE y el `if (…) return;` que lo PRECEDE en el mismo bloque. La
//                  segunda es la que usa el código real, y mirar solo la primera daría "sin guarda"
//                  sobre código correcto — un guard que da rojo en falso es un guard que se silencia.
//   · `textos`   — todo lo que el usuario LEE en la sección (textContent/innerHTML + el cuerpo del
//                  confirm), clasificado por su ORIGEN, para poder exigir que ninguno sea inventado.
//   · `dineroIds`— identificadores que salen de `fmtMoneyEs(...)`. DERIVADO, no una lista blanca
//                  escrita a mano: es lo que permite distinguir «un importe» de «una frase».
import ts from 'typescript';

export const FUNCION_SECCION = 'jobCierreSection';
const ESTADO_CERRADO = 'cerrado';
const LECTOR_TEXTOS = 'textoCierre'; // la única puerta legítima a CIERRE_TEXTOS
const FORMATEADOR = 'fmtMoneyEs';

const t = (n) => n.getText().replace(/\s+/g, ' ').trim();

export function censarCierreTrabajo(codigo) {
  const sf = ts.createSourceFile('jobsView.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // Función que ENCIERRA un nodo, por nombre (declaración o `const f = function/arrow`).
  const funcionDe = (nodo) => {
    for (let p = nodo.parent; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
      if ((ts.isFunctionExpression(p) || ts.isArrowFunction(p))
          && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) return p.parent.name.text;
    }
    return null;
  };

  // ¿Es `{ …, status: 'cerrado', … }`? La forma, no el texto.
  const esObjetoCierre = (n) =>
    ts.isObjectLiteralExpression(n) && n.properties.some((p) =>
      ts.isPropertyAssignment(p)
      && ((ts.isIdentifier(p.name) && p.name.text === 'status') || (ts.isStringLiteralLike(p.name) && p.name.text === 'status'))
      && ts.isStringLiteralLike(p.initializer) && p.initializer.text === ESTADO_CERRADO);

  // ── guardas de un cierre ────────────────────────────────────────────────────────────────────
  // (a) los `if` en cuya rama THEN cae el nodo (guarda envolvente)
  // (b) los `if (cond) return;` que aparecen ANTES en el mismo bloque (guarda por salida temprana)
  const guardasDe = (nodo) => {
    const out = [];
    for (let p = nodo.parent; p; p = p.parent) {
      if (ts.isIfStatement(p) && p.thenStatement.getStart(sf) <= nodo.getStart(sf) && nodo.getEnd() <= p.thenStatement.getEnd()) {
        out.push(t(p.expression));
      }
      if (ts.isBlock(p)) {
        for (const st of p.statements) {
          if (st.getEnd() > nodo.getStart(sf)) break; // solo lo que va ANTES
          if (ts.isIfStatement(st) && !st.elseStatement && contieneReturn(st.thenStatement)) out.push(t(st.expression));
        }
      }
    }
    return out;
  };
  // ⚠️ NO se entra en funciones anidadas. Un `return` dentro de un callback corta ESE callback, no
  // la ejecución de al lado: contarlo convertiría `if (!dt.value) { …; return; }` (dentro del
  // handler de «Agendar») en una guarda del cierre. Medido sobre el fichero de origin/main: sin este
  // corte, el censo le atribuía al cierre de L231 una guarda que no lo guarda. Y el error va del
  // lado PERMISIVO —más guardas = más fácil que alguna mencione lo que se exige—, que es el lado en
  // el que un guard se vuelve decorativo sin que nadie lo note.
  const esFuncion = (x) => ts.isFunctionDeclaration(x) || ts.isFunctionExpression(x) || ts.isArrowFunction(x);
  const contieneReturn = (n) => {
    let hay = false;
    (function ver(x) {
      if (hay) return;
      if (ts.isReturnStatement(x)) { hay = true; return; }
      ts.forEachChild(x, (h) => { if (!esFuncion(h)) ver(h); });
    })(n);
    return hay;
  };

  const cierres = [];
  const textos = [];
  const dineroIds = new Set();
  let seccion = null;

  (function visitar(n) {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === FUNCION_SECCION) {
      seccion = { desde: linea(n), hasta: sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1, nodo: n };
    }

    // `const importeFmt = fmtMoneyEs(...)` → importeFmt ES un importe, no una frase.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)
        && n.initializer.expression.text === FORMATEADOR) {
      dineroIds.add(n.name.text);
    }

    // Cierres: cualquier llamada con un objeto `{status:'cerrado'}` entre sus argumentos.
    if (ts.isCallExpression(n) && n.arguments.some(esObjetoCierre)) {
      cierres.push({ linea: linea(n), funcion: funcionDe(n), llamada: t(n.expression), guardas: guardasDe(n) });
    }

    // Textos que el usuario LEE.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left)
        && (n.left.name.text === 'textContent' || n.left.name.text === 'innerHTML')) {
      textos.push({ linea: linea(n), funcion: funcionDe(n), expr: t(n.right), nodo: n.right });
    }
    // El cuerpo del confirm también se lee.
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'confirm' && n.arguments.length >= 1) {
      textos.push({ linea: linea(n), funcion: funcionDe(n), expr: t(n.arguments[0]), nodo: n.arguments[0] });
    }

    ts.forEachChild(n, visitar);
  })(sf);

  // Origen de cada texto — se clasifica DESPUÉS, con `dineroIds` ya completo.
  const origen = (nodo) => {
    if (ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === LECTOR_TEXTOS) return 'CIERRE_TEXTOS';
    if (ts.isIdentifier(nodo) && dineroIds.has(nodo.text)) return 'importe';
    if (ts.isStringLiteralLike(nodo) || ts.isTemplateExpression(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) return 'literal';
    return 'otro';
  };
  for (const x of textos) { x.origen = origen(x.nodo); delete x.nodo; }

  const enSeccion = (x) => x.funcion === FUNCION_SECCION;
  return {
    seccionEncontrada: !!seccion,
    seccion: seccion ? { desde: seccion.desde, hasta: seccion.hasta } : null,
    cierres,
    textos,
    textosDeSeccion: textos.filter(enSeccion),
    dineroIds: [...dineroIds],
  };
}
