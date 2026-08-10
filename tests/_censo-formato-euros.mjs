// tests/_censo-formato-euros.mjs — SCRUM-436 · quién formatea dinero por su cuenta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE DERIVA DEL ÁRBOL, NO DE UN `grep` POR «€»
//
// Un censo por texto se caza a sí mismo en el comentario que explica la prohibición, y además no
// distingue un importe de un porcentaje: `(x * 100).toFixed(0) + '%'` y `n.toFixed(2) + ' €'` son
// la misma forma para una expresión regular y cosas distintas para el producto.
//
// Aquí se recorre el AST (compilador de TypeScript, que parsea JS igual) y se reconocen las DOS
// formas en que se construye un importe a mano:
//
//   ① `new Intl.NumberFormat(…, { style: 'currency', … })`  — lo dice el propio objeto de opciones
//   ② una concatenación cuyo literal de cadena lleva el símbolo de una moneda (` €`, ' EUR'…)
//
// Un porcentaje no cae en ninguna de las dos: ni declara `style: 'currency'` ni concatena `€`.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Símbolos que convierten una concatenación en «esto es dinero». */
const SIMBOLOS_MONEDA = ['€', 'EUR', '$', '£'];

/**
 * Ficheros que SÍ pueden formatear moneda: son el formateador de la casa.
 *
 * ⚠️ Allowlist VISIBLE y con su motivo, nunca una excepción silenciosa. Si crece, se ve en el diff.
 */
export const PUEDEN_FORMATEAR = Object.freeze({
  'api.js': 'define `fmtMoneyEs` y `fmtMoneyEsOAusente` — el formateador compartido (SCRUM-436)',
});

const DIR = 'public/dashboard/js';

function textoDeLiteral(nodo) {
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) return nodo.text;
  return null;
}

/** ¿Este objeto de opciones declara `style: 'currency'`? */
function declaraMoneda(nodo) {
  if (!nodo || !ts.isObjectLiteralExpression(nodo)) return false;
  return nodo.properties.some((p) => {
    if (!ts.isPropertyAssignment(p)) return false;
    const clave = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
    return clave === 'style' && textoDeLiteral(p.initializer) === 'currency';
  });
}

/** ¿Este literal de cadena lleva un símbolo de moneda? */
function llevaMoneda(texto) {
  if (texto === null) return false;
  return SIMBOLOS_MONEDA.some((s) => texto.includes(s));
}

/**
 * Los formateos de moneda a mano de UN fuente. Puro: recibe el texto, no toca disco.
 *
 * @returns {{linea:number, forma:string, fragmento:string}[]}
 */
export function formateosDe(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const out = [];
  const anota = (nodo, forma) => {
    const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf));
    out.push({ linea: line + 1, forma, fragmento: nodo.getText(sf).slice(0, 90).replace(/\s+/g, ' ') });
  };

  const visitar = (nodo) => {
    // ① new Intl.NumberFormat(locale, { style: 'currency' })
    if (ts.isNewExpression(nodo) && nodo.expression.getText(sf).endsWith('Intl.NumberFormat')) {
      if ((nodo.arguments || []).some(declaraMoneda)) anota(nodo, 'Intl.NumberFormat style:currency');
    }
    // ② concatenación con un literal que lleva símbolo de moneda
    if (ts.isBinaryExpression(nodo) && nodo.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      if (llevaMoneda(textoDeLiteral(nodo.left)) || llevaMoneda(textoDeLiteral(nodo.right))) {
        anota(nodo, 'concatenación con símbolo de moneda');
      }
    }
    ts.forEachChild(nodo, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** El censo del dashboard entero. `raiz` para poder correrlo sobre otro árbol. */
export function censo(raiz) {
  const dir = path.join(raiz, DIR);
  const ficheros = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];
  const hallazgos = [];
  for (const f of ficheros) {
    if (f in PUEDEN_FORMATEAR) continue;
    for (const h of formateosDe(f, fs.readFileSync(path.join(dir, f), 'utf8'))) {
      hallazgos.push({ fichero: `${DIR}/${f}`, ...h });
    }
  }
  return { ficherosMirados: ficheros.length, hallazgos };
}
