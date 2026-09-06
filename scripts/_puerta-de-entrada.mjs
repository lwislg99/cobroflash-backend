// scripts/_puerta-de-entrada.mjs — SCRUM-765
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «¿ME HAN EJECUTADO, O ME HAN IMPORTADO?» — Y POR QUÉ LA FORMA DE SIEMPRE NUNCA CASA AQUÍ.
//
// Un script que además es módulo necesita saber si es el punto de entrada. La forma que se ha
// copiado por todo el árbol es ésta:
//
//     import.meta.url === `file://${process.argv[1]}`
//
// y en Windows **NUNCA CASA**. Medido el 6-sep-2026 en las cuatro formas de invocación
// (relativa, absoluta con espacio, absoluta con barras invertidas, desde otro cwd):
//
//     argv[1]           C:\Users\Javier Pereira\cobroflash-b5\scripts\x.mjs
//     'file://'+argv[1] file://C:\Users\Javier Pereira\…        ← dos barras, invertidas, sin %20
//     import.meta.url   file:///C:/Users/Javier%20Pereira/…     ← tres barras, normales, con %20
//
// Tres diferencias a la vez: la tercera barra, el sentido de las barras y el escapado del
// espacio. **NO CASA en ninguna de las cuatro.** La variante que sólo cambia el sentido de las
// barras —la de `scripts/backfill-job-assignees.mjs`— tampoco: le siguen faltando la tercera
// barra y el `%20`.
//
// 🔴 LO QUE ESO PROVOCA. El script que llevaba respaldo `argv[1].endsWith('<su nombre>')`
// arrancaba SÓLO por el respaldo; el que no lo lleva no arranca nunca. Y el respaldo compara por
// NOMBRE DE FICHERO, así que una copia renombrada del `meta-guard` salía **exit 0 en 0,28 s sin
// ejecutar una sola mutación** — un verde perfecto sobre cero trabajo.
//
// ── LA FORMA QUE SÍ CASA, Y POR QUÉ ─────────────────────────────────────────────────────────
// `pathToFileURL(argv[1]).href` construye la URL con las MISMAS reglas con las que Node compone
// `import.meta.url`: resuelve la ruta a absoluta, pone las tres barras, invierte las barras y
// escapa. Se compara lo mismo con lo mismo en vez de dos convenios distintos. **CASA en las
// cuatro formas medidas.** No es una preferencia de estilo: seis scripts del árbol ya la usan
// (`citar-*.mjs`, `diagnostico-dependencias.mjs`, `registro-de-lo-aprobado.mjs`), así que esto
// no inventa nada — unifica en la forma que la casa ya había acertado.
//
// ⛔ Y SE VA EL RESPALDO `endsWith()`. No es una red: es lo que ocultaba el agujero. Mientras
// estuvo puesto, la puerta rota no se notaba, y por eso vivió desde que se escribió.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

/**
 * ¿Este módulo es el punto de entrada del proceso?
 *
 * `metaUrl` es el `import.meta.url` de quien pregunta. `argv1` se deja inyectar para poder
 * medirlo con pares reales en un test, en vez de tener que arrancar un proceso por caso.
 */
export function ejecutadoDirectamente(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false; // `node -e`, REPL: no hay fichero de entrada, luego no somos él
  try {
    return metaUrl === pathToFileURL(argv1).href;
  } catch {
    // Una ruta que ni siquiera se puede convertir en URL no es este fichero.
    return false;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EL CENSO DE PUERTAS FRÁGILES — POR AST, Y NO POR `grep`.
 *
 * 🔴 Un censo de TEXTO se cazaría A SÍ MISMO: la cabecera de este fichero escribe la forma
 * prohibida tres veces para poder explicarla. Es el defecto de SCRUM-614/617 y el motivo por el
 * que la casa exige AST para vigilar código (SCRUM-203). El AST no ve comentarios.
 *
 * Reconoce las dos formas de construir la cadena:
 *   ① plantilla:  `file://${process.argv[1]}`            (con o sin `.replace(…)` dentro)
 *   ② suma:       'file://' + process.argv[1]
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function puertasFragilesEn(codigo, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];

  /** ¿Este subárbol nombra `process.argv`? */
  const mencionaArgv = (n) => {
    let visto = false;
    const v = (x) => {
      if (ts.isPropertyAccessExpression(x) && x.name.text === 'argv'
          && ts.isIdentifier(x.expression) && x.expression.text === 'process') visto = true;
      ts.forEachChild(x, v);
    };
    v(n);
    return visto;
  };

  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const v = (n) => {
    // ① `file://${…argv…}`
    if (ts.isTemplateExpression(n) && n.head.text.startsWith('file://') && mencionaArgv(n)) {
      out.push({ fichero: nombre, linea: linea(n), forma: 'plantilla' });
    }
    // ② 'file://' + …argv…
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken
        && ts.isStringLiteralLike(n.left) && n.left.text.startsWith('file://') && mencionaArgv(n)) {
      out.push({ fichero: nombre, linea: linea(n), forma: 'suma' });
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

/** Recorre `dirs` (relativos a `raiz`) y devuelve todas las puertas frágiles que encuentre. */
export function censoDePuertasFragiles(raiz, dirs = ['scripts', 'tests']) {
  const out = [];
  let ficherosVistos = 0;
  for (const d of dirs) {
    const abs = path.join(raiz, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.mjs') && !f.endsWith('.js')) continue;
      ficherosVistos += 1;
      const rel = `${d}/${f}`;
      for (const p of puertasFragilesEn(fs.readFileSync(path.join(abs, f), 'utf8'), rel)) out.push(p);
    }
  }
  return { puertas: out, ficherosVistos };
}
