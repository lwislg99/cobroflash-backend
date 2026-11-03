// tests/_censo-filas-sin-teclado.mjs — SCRUM-1639
//
// CUÁNTAS FILAS QUE NAVEGAN NO SE ALCANZAN CON TECLADO, leído del código (AST de TypeScript, no texto:
// un comentario que nombre `renderAppView` o `keydown` no cuenta).
//
// Una «fila que navega» es un `X.addEventListener('click', H)` cuyo manejador lleva a otra pantalla:
// llama a `renderAppView(`, o a una función del mismo fichero que lo hace (`const go = () => …`).
// Se descarta si `X` nace como `<button>` o `<a>` (el navegador ya le da foco y teclas). Si no, tiene
// vía de teclado cuando la MISMA función que registra el clic registra también un `keydown` que
// navega, o crea un `<button>`/`<a>` cuyo clic navega (el «Ver detalle» de Trabajos y Facturas).
//
// LO QUE NO VE (declarado): oyentes puestos por delegación en `document`; un `X` cuyo nacimiento no
// está en esa función cuenta como «nacimiento desconocido» (no se descarta como nativo); y no sabe si
// el anillo de foco se ve (CSS) ni cómo lo anuncia un lector de pantalla.
import ts from 'typescript';

const NATIVOS = new Set(['button', 'a']);

function esFuncion(n) {
  return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
}

function funcionQueEncierra(n) {
  for (let p = n.parent; p; p = p.parent) if (esFuncion(p)) return p;
  return n.getSourceFile();
}

/** `X.addEventListener('<tipo>', H)` → { receptor: 'X', tipo, manejador: H } o null. */
function oyente(n) {
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return null;
  if (n.expression.name.text !== 'addEventListener' || n.arguments.length < 2) return null;
  const [tipo, manejador] = n.arguments;
  if (!ts.isStringLiteralLike(tipo)) return null;
  const receptor = ts.isIdentifier(n.expression.expression) ? n.expression.expression.text : null;
  return { receptor, tipo: tipo.text, manejador };
}

function recorrer(n, f) { f(n); n.forEachChild((h) => recorrer(h, f)); }

/** Censa UN fichero. Devuelve { navegan, nativas, conTeclado, sinTeclado: [linea], desconocidas }. */
export function censarFuente(fuente, nombre = 'x.js') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // A qué pantallas lleva un trozo de código: el primer argumento de cada `renderAppView('<vista>', …)`,
  // y las de las funciones del fichero que navegan (`const go = () => renderAppView(…)`).
  // `soloPropias`: sin bajar a las funciones anidadas. Una función que PINTA la ficha entera lleva
  // dentro los clics de sus filas; llamarla para recargar no es navegar (medido: «Marcar como pagada»
  // recarga la ficha y, sin esto, el censo creía que abría la factura).
  const vistasDirectas = (n, soloPropias = false) => {
    const v = new Set();
    const ir = (x) => {
      if (soloPropias && x !== n && esFuncion(x)) return;
      if (ts.isCallExpression(x) && /(^|\.)renderAppView$/.test(x.expression.getText(sf))) {
        const a = x.arguments[0];
        v.add(a && ts.isStringLiteralLike(a) ? a.text : '?');
      }
      x.forEachChild(ir);
    };
    ir(n);
    return v;
  };
  const navegadoras = new Map();
  recorrer(sf, (n) => {
    let fn = null;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && esFuncion(n.initializer)) fn = n.initializer;
    if (ts.isFunctionDeclaration(n) && n.name) fn = n;
    if (!fn) return;
    const v = vistasDirectas(fn, true);
    if (v.size) navegadoras.set(n.name.text, v);
  });
  const destinos = (h) => {
    const v = vistasDirectas(h);
    const suma = (nombre) => { for (const d of navegadoras.get(nombre) || []) v.add(d); };
    recorrer(h, (x) => { if (ts.isCallExpression(x)) suma(x.expression.getText(sf)); });
    if (ts.isIdentifier(h)) suma(h.text);
    return v;
  };
  const navega = (h) => destinos(h).size > 0;
  const comparten = (a, b) => [...a].some((d) => b.has(d));
  // Cómo nace cada variable dentro de una función: `document.createElement('div')`, y los ayudantes
// del panel que reciben la etiqueta primero: `createElement('button', …)` (customersView), `gastoEl('div', …)`.
  // La ÚLTIMA declaración de ese nombre ANTES del uso (dos funciones hermanas pueden llamar `mas` a cosas distintas).
  const etiquetaEn = (funcion, nombreVar, antesDe) => {
    let tag = null;
    recorrer(funcion, (x) => {
      if (!ts.isVariableDeclaration(x) || !ts.isIdentifier(x.name) || x.name.text !== nombreVar || !x.initializer) return;
      if (x.getStart(sf) > antesDe) return;
      const m = /^(?:document\.createElement|createElement|gastoEl|nodo)\(\s*['"]([a-zA-Z]+)['"]/.exec(x.initializer.getText(sf));
      tag = m ? m[1].toLowerCase() : null;
    });
    return tag;
  };
  const r = { navegan: 0, nativas: 0, conTeclado: 0, sinTeclado: [], desconocidas: 0 };
  recorrer(sf, (n) => {
    const o = oyente(n);
    if (!o || o.tipo !== 'click' || !navega(o.manejador)) return;
    r.navegan++;
    const funcion = funcionQueEncierra(n);
    const tag = o.receptor ? etiquetaEn(funcion, o.receptor, n.getStart(sf)) : null;
    if (!tag) { r.desconocidas++; return; }
    if (NATIVOS.has(tag)) { r.nativas++; return; }
    const adonde = destinos(o.manejador);
    let teclado = false;
    recorrer(funcion, (x) => {
      const k = oyente(x);
      if (!k || !comparten(adonde, destinos(k.manejador))) return;
      if (k.tipo === 'keydown') teclado = true;
      if (k.tipo === 'click' && k.receptor && NATIVOS.has(etiquetaEn(funcion, k.receptor, x.getStart(sf)) || '')) teclado = true;
    });
    if (teclado) r.conTeclado++;
    else r.sinTeclado.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
  });
  return r;
}
