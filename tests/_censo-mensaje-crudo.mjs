// tests/_censo-mensaje-crudo.mjs — SCRUM-644 · quién pinta el mensaje del servidor sin traducir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PUERTA QUE ESTABA ABIERTA
//
// SCRUM-641 arregló `productsView.js` y SCRUM-644 `providersView.js`. Pero **nada vigilaba que
// una vista NUEVA volviera a pintar `e.message`**, y ésa es la familia de defecto de la casa:
// se arregla una copia y no se cierra la puerta. Pasó con el dinero (seis copias), con el
// contador de scripts (cuatro conflictos) y con el vocabulario de códigos (dos capas).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE DERIVA DEL AST, NO DE UN `grep`
//
// Un censo por texto se caza a sí mismo en el comentario que explica la prohibición, y no
// distingue `e.message` pintado en un aviso de `d.message` leído para decidir. Aquí se recorre el
// árbol y se reconoce UNA forma: **una llamada a un PINTOR cuyo argumento lee un `.message`**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LAS DOS LISTAS SE ESCRIBEN A MANO Y NO SE HEREDAN DE NADIE (criterio de SCRUM-645)
//
// Si este censo dedujera los pintores del código —«toda función que reciba un texto»— o los
// traductores —«todo lo que se llame mensajeDe…»—, un caso nuevo entraría solo: se daría por
// bueno sin que nadie lo hubiera decidido, o se quedaría fuera del censo sin que nadie se
// enterara. Escritas a mano, cualquiera de las dos cosas exige tocar ESTE fichero, que es
// exactamente el momento en que alguien decide. **La duplicación es el precio.**
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Las funciones que ESCRIBEN EN LA PANTALLA. A mano. */
export const PINTORES = Object.freeze([
  'setAlert',   // productsView, providersView, customersView…
  'setStatus',  // invoiceDetailView, jobDetailView…
  'showToast',
  'alert',
]);

/** Lo que convierte un código del servidor en algo legible. A mano. */
export const TRADUCTORES = Object.freeze([
  'mensajeDeErrorCatalogo',   // SCRUM-641 · productsView
  'mensajeDeErrorProveedor',  // SCRUM-644 · providersView
  'mensajeParaPersona',       // SCRUM-1233 · api.js: `data.message` o el texto aprobado, nunca `err.message`
]);

/** Las propiedades que traen texto del servidor y no se pueden pintar crudas. */
const CAMPOS_DEL_SERVIDOR = Object.freeze(['message']);

const DIR = 'public/dashboard/js';

/** ¿Este nodo es `algo.message`? */
function leeCampoDelServidor(n) {
  return ts.isPropertyAccessExpression(n)
    && ts.isIdentifier(n.name)
    && CAMPOS_DEL_SERVIDOR.includes(n.name.text);
}

/** El nombre de la función que se llama, o `null` si no es una llamada reconocible. */
function nombreDeLlamada(n, sf) {
  if (!ts.isCallExpression(n)) return null;
  const e = n.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.name)) return e.name.text;
  return e.getText(sf);
}

/**
 * Los sitios de UN fuente que pintan un `.message` sin traducirlo. Puro: recibe el texto.
 *
 * @returns {{linea:number, pintor:string, fragmento:string}[]}
 */
export function crudosDe(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const out = [];

  /** ¿Hay un `.message` suelto aquí dentro, fuera de cualquier traductor? */
  const hayCrudo = (nodo) => {
    let encontrado = false;
    const mirar = (n) => {
      if (encontrado) return;
      // Si entramos en un traductor, lo de dentro YA está tratado: no se sigue bajando.
      if (TRADUCTORES.includes(nombreDeLlamada(n, sf))) return;
      if (leeCampoDelServidor(n)) { encontrado = true; return; }
      ts.forEachChild(n, mirar);
    };
    // 🔴 Se empieza por el NODO, no por sus hijos. Empezando por los hijos, un argumento que ES la
    // llamada al traductor nunca pasaba por la poda —se bajaba directo a su interior— y el
    // `.message` de dentro contaba como crudo. Lo cazó el suelo: «cebo traducido → 1».
    mirar(nodo);
    return encontrado;
  };

  const visitar = (n) => {
    const pintor = nombreDeLlamada(n, sf);
    if (pintor && PINTORES.includes(pintor)) {
      for (const arg of n.arguments || []) {
        if (hayCrudo(arg)) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          out.push({
            linea: line + 1,
            pintor,
            fragmento: n.getText(sf).slice(0, 110).replace(/\s+/g, ' '),
          });
          break;
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1233 · LOS DOS PUNTOS CIEGOS DE `crudosDe`
//
// `crudosDe` reconoce UNA forma, `pintor(… .message …)`, y el censo estuvo EN VERDE con dos sitios
// rotos delante, porque llegaban a la pantalla por otro camino:
//
//   ① ASIGNACIÓN   `detalle.textContent = String((err && err.message) || err || '')`  (albaranesView)
//   ② VARIABLE     `const detalle = … err.message …; showToast(prefijo + detalle)`     (jobsView)
//
// y un tercero que no se veía por la lista de pintores: ③ los PINTORES LOCALES, funciones de una
// pantalla que escriben en ella (`showErr`, `mostrarAviso`…). Van en su propia lista, a mano como
// las otras (SCRUM-645), y NO en `PINTORES`: meterlos ahí subiría el censo de SCRUM-644, cuyo total
// solo puede bajar, con sitios que ese censo nunca contó.
//
// Las tres formas son DISJUNTAS de `crudosDe`: lo que aquel ya cuenta no se vuelve a contar.
// Y el censo es FAIL-CLOSED: un fichero que el parser no entiende entero sale CIEGO, no limpio.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Funciones de una pantalla que escriben en ella. A mano. */
export const PINTORES_LOCALES = Object.freeze([
  'showErr',       // customerDetailView
  'showExpError',  // expensesView
  'mostrarAviso',  // signaturePad
  'conSalida',     // tutorial
  'uiErrorState',  // api.js
]);

/** Las propiedades del DOM que, asignadas, ponen texto en pantalla. */
export const PROPIEDADES_QUE_PINTAN = Object.freeze(['textContent', 'innerText', 'innerHTML', 'outerHTML']);

const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isSourceFile(n);

/**
 * Los sitios de UN fuente que pintan un `.message` por ①, ② o ③. Puro: recibe el texto.
 *
 * @returns {{hallazgos: {linea:number, forma:string, fragmento:string}[], ciego: string|null}}
 */
export function crudosOcultosDe(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const diag = sf.parseDiagnostics || [];
  if (diag.length) {
    const d = diag[0];
    const { line } = sf.getLineAndCharacterOfPosition(d.start || 0);
    return { hallazgos: [], ciego: `${nombre}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}` };
  }

  // Variables «manchadas»: se inicializan con un `.message` fuera de traductor. Por función.
  const manchadas = new Map();
  const funcionDe = (n) => { let p = n.parent; while (p && !esFuncion(p)) p = p.parent; return p || sf; };
  const estaManchada = (id) => {
    for (let f = funcionDe(id); f; f = f === sf ? null : funcionDe(f)) {
      if (manchadas.get(f)?.has(id.text)) return true;
    }
    return false;
  };

  /** ¿Hay aquí un `.message` suelto (`crudo`) o una variable manchada (`manchado`)? */
  const mirar = (nodo) => {
    const r = { crudo: false, manchado: false };
    const bajar = (n) => {
      if (TRADUCTORES.includes(nombreDeLlamada(n, sf))) return;
      if (leeCampoDelServidor(n)) { r.crudo = true; return; }
      if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
        && estaManchada(n)) r.manchado = true;
      ts.forEachChild(n, bajar);
    };
    bajar(nodo);
    return r;
  };

  const hallazgos = [];
  const anotar = (n, forma) => {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    hallazgos.push({ linea: line + 1, forma, fragmento: n.getText(sf).slice(0, 110).replace(/\s+/g, ' ') });
  };

  const visitar = (n) => {
    // Primero se anota la mancha: la declaración va antes que su uso en el recorrido.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && mirar(n.initializer).crudo) {
      const f = funcionDe(n);
      if (!manchadas.has(f)) manchadas.set(f, new Set());
      manchadas.get(f).add(n.name.text);
    }
    // ① asignación a una propiedad que pinta
    if (ts.isBinaryExpression(n)
      && (n.operatorToken.kind === ts.SyntaxKind.EqualsToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)
      && ts.isPropertyAccessExpression(n.left) && PROPIEDADES_QUE_PINTAN.includes(n.left.name.text)) {
      const r = mirar(n.right);
      if (r.crudo) anotar(n, 'asignación');
      else if (r.manchado) anotar(n, 'variable');
    }
    const llamada = nombreDeLlamada(n, sf);
    // ② variable manchada que llega a un pintor (el `.message` directo ya lo cuenta `crudosDe`)
    if (llamada && PINTORES.includes(llamada)) {
      const args = n.arguments || [];
      if (!args.some((a) => mirar(a).crudo) && args.some((a) => mirar(a).manchado)) anotar(n, 'variable');
    }
    // ③ pintor local
    if (llamada && PINTORES_LOCALES.includes(llamada)) {
      const args = (n.arguments || []).map(mirar);
      if (args.some((a) => a.crudo)) anotar(n, 'pintor local');
      else if (args.some((a) => a.manchado)) anotar(n, 'variable');
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return { hallazgos, ciego: null };
}

/** El censo de las tres formas sobre el dashboard entero. */
export function censoOculto(raiz) {
  const dir = path.join(raiz, DIR);
  const ficheros = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];
  const hallazgos = [];
  const ciegos = [];
  for (const f of ficheros) {
    const r = crudosOcultosDe(f, fs.readFileSync(path.join(dir, f), 'utf8'));
    if (r.ciego) ciegos.push(`${DIR}/${r.ciego}`);
    for (const h of r.hallazgos) hallazgos.push({ fichero: `${DIR}/${f}`, ...h });
  }
  return { ficherosMirados: ficheros.length, hallazgos, ciegos };
}

/** El censo del dashboard entero. `raiz` para poder correrlo sobre otro árbol. */
export function censo(raiz) {
  const dir = path.join(raiz, DIR);
  const ficheros = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];
  const hallazgos = [];
  for (const f of ficheros) {
    for (const h of crudosDe(f, fs.readFileSync(path.join(dir, f), 'utf8'))) {
      hallazgos.push({ fichero: `${DIR}/${f}`, ...h });
    }
  }
  return { ficherosMirados: ficheros.length, hallazgos };
}
