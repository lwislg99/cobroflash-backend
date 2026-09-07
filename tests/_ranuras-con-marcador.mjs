// tests/_ranuras-con-marcador.mjs — SCRUM-755
//
// DERIVA DEL ÁRBOL los sitios donde el panel pinta el marcador de microcopy sin firmar.
// Vive aparte del test que lo usa porque el censo y el guard tienen que mirar EXACTAMENTE lo
// mismo: dos lectores distintos de la misma pregunta es cómo nacen los números que no cuadran.
//
// ── LO QUE CUENTA, Y LO QUE NO ──────────────────────────────────────────────────────────────
// Cuenta SITIOS DE LLAMADA: cada aparición del marcador que acaba en pantalla. NO cuenta:
//   · la DECLARACIÓN de la constante que guarda el texto (ahí vive el marcador, no se pinta), y
//     se detecta por su VALOR, no por su nombre — la casa las llama `INV_MARCADOR_MICROCOPY`,
//     `PRV_MARCADOR_MICROCOPY`, `MARCADOR` y `PENDIENTE_MODO_EMISION`, así que un patrón de
//     nombre se dejaría tres fuera (medido: pasó en el primer intento de este censo);
//   · el puente `window.X = X`, que es fontanería y no una ranura;
//   · los comentarios: el AST no los ve, y es lo que queremos — un fichero que EXPLICA el
//     marcador en una nota no está pintándolo.
//
// 🔴 Y CUENTA LAS REPETICIONES DENTRO DE UN MISMO LITERAL. Un template con dos marcadores son
// DOS sitios. El primer intento usaba `.includes()` y devolvía 1: el instrumento contestaba a
// «¿hay marcador aquí?» cuando la pregunta era «¿cuántos hay?».
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** El texto exacto. Literal único: si se concatenara, este módulo se contaría a sí mismo. */
export const MARCA = '[PENDIENTE microcopy oficial]';

const cuantasVeces = (texto) => {
  let n = 0, i = 0;
  for (;;) {
    const j = texto.indexOf(MARCA, i);
    if (j < 0) return n;
    n++; i = j + MARCA.length;
  }
};

/**
 * ¿Esta referencia es FONTANERÍA en vez de una ranura? Lo es cuando vive dentro del objeto que se
 * asigna a `module.exports` o a `window.…`: exportar la constante no la pinta en ninguna pantalla.
 *
 * 🔴 SE AÑADIÓ TRAS LEER LOS DIEZ FICHEROS UNO A UNO, y cambió el censo: `jobAsignados.js:210`,
 * `patronDetalleAcciones.js:83` y `settingsSubmenus.js:364` eran EXACTAMENTE eso —
 * `module.exports = { …, MARCA_ASIGNADOS }` y `{ MARCA_MICROCOPY_SUBMENU: MARCA_… }`— y el lector
 * los daba por ranuras pintadas. Un instrumento que cuenta de más asusta con ficheros que no
 * pintan nada, y el susto se paga desactivándolo.
 */
function esFontaneria(nodo, sf) {
  for (let p = nodo.parent; p; p = p.parent) {
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const izq = p.left.getText(sf);
      return /^module\.exports\b/.test(izq) || /^window\./.test(izq);
    }
    if (ts.isFunctionLike(p)) return false;   // dentro de una función ya no es una tabla de export
  }
  return false;
}

/** Los sitios de un fichero, con su línea, para que el rojo pueda NOMBRARLOS. */
export function ranurasDe(ruta) {
  const fuente = fs.readFileSync(ruta, 'utf8');
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);

  // ① Qué identificadores GUARDAN el marcador. Por VALOR, nunca por nombre.
  const constantes = new Set();
  const buscaConstantes = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))
        && n.initializer.text === MARCA) {
      constantes.add(n.name.text);
    }
    ts.forEachChild(n, buscaConstantes);
  };
  ts.forEachChild(sf, buscaConstantes);

  // ② Los sitios.
  const sitios = [];
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visita = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n)
        || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const veces = cuantasVeces(n.text);
      if (veces > 0) {
        const p = n.parent;
        const esDeclaracion = p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && constantes.has(p.name.text);
        if (!esDeclaracion) for (let i = 0; i < veces; i++) sitios.push({ linea: linea(n), via: 'literal' });
      }
    }
    if (ts.isIdentifier(n) && constantes.has(n.text)) {
      const p = n.parent;
      const esDeclaracion = p && ts.isVariableDeclaration(p) && p.name === n;
      const esPuenteIzq = p && ts.isPropertyAccessExpression(p) && p.name === n;              // window.X (el nombre)
      const esPuenteAsig = p && ts.isBinaryExpression(p) && ts.isPropertyAccessExpression(p.left)
        && p.left.getText(sf).startsWith('window.') && p.right === n;                          // window.X = X
      const esClave = p && ts.isPropertyAssignment(p) && p.name === n;                         // { X: … } — la clave
      if (!esDeclaracion && !esPuenteIzq && !esPuenteAsig && !esClave && !esFontaneria(n, sf)) {
        sitios.push({ linea: linea(n), via: 'constante' });
      }
    }
    ts.forEachChild(n, visita);
  };
  ts.forEachChild(sf, visita);
  return sitios;
}

/** Todo el panel: `{ 'fichero.js': [sitios…] }`, sólo con los que tienen alguno. */
export function ranurasDelPanel(raizDelRepo) {
  const dir = path.join(raizDelRepo, 'public/dashboard/js');
  const salida = {};
  for (const nombre of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
    const sitios = ranurasDe(path.join(dir, nombre));
    if (sitios.length) salida[nombre] = sitios;
  }
  return salida;
}

/** Los contadores `*_SIN_APROBAR` de un fichero, encontrados por su FORMA. */
export function contadoresDe(ruta) {
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /SIN_APROBAR$/.test(n.name.text)
        && n.initializer && ts.isNumericLiteral(n.initializer)) {
      out.push({ nombre: n.name.text, valor: Number(n.initializer.text), linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, visita);
  };
  ts.forEachChild(sf, visita);
  return out;
}
