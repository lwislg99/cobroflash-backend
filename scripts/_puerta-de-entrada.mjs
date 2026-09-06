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
// ── EL PRIMER ARREGLO, Y POR QUÉ NO BASTABA ─────────────────────────────────────────────────
// `pathToFileURL(argv[1]).href` construye la URL con las MISMAS reglas con las que Node compone
// `import.meta.url`, y casa en las cuatro formas de invocación. **Pero se rompe en cuanto hay un
// ENLACE de por medio**, y eso lo destapó CI: Node resuelve el módulo de ENTRADA pasando por
// `realpath`, así que `import.meta.url` trae la ruta REAL y `argv[1]` la que se escribió.
//
// MEDIDO en Windows el 6-sep-2026, arrancando el MISMO fichero a través de un junction al repo:
//
//     argv[1]              C:\…\scratchpad\enlace-repo\scripts\_sonda-enlace-765.mjs
//     realpath(argv[1])    C:\Users\Javier Pereira\cobroflash-b5\scripts\_sonda-enlace-765.mjs
//     import.meta.url      file:///C:/Users/Javier%20Pereira/cobroflash-b5/scripts/…
//     pathToFileURL(argv1) file:///C:/Users/JAVIER%7E1/AppData/…/enlace-repo/scripts/…
//     ¿ABRE LA PUERTA?     **false**   ← el script no arranca, y sale con 0 sin hacer nada
//
// ── LA FORMA QUE SE QUEDA: LAS DOS RUTAS REALES ─────────────────────────────────────────────
// `realpath` a los DOS lados y una sola comparación. Normaliza de golpe todo lo que separaba a
// las dos cadenas —el enlace, el sentido de las barras, el escapado, la mayúscula de la unidad y
// hasta el nombre corto 8.3 (`JAVIER~1` → `Javier Pereira`)— porque pregunta por el FICHERO DE
// DISCO en vez de por dos convenios de texto.
//
// Se probó antes una versión con las dos comparaciones (la de URL y ésta). Se retiró: con
// `realpath` a los dos lados, la de URL **no puede fallar sin que falle también la otra**, o sea
// que ninguna mutación podría cazarla. Código que ningún rojo puede alcanzar es decoración.
//
// ⛔ Y ESTO NO ES EL RESPALDO `endsWith()`. Aquél comparaba por NOMBRE DE FICHERO, y por eso una
// copia renombrada colaba y tapaba la avería. Esto compara el MISMO FICHERO DE DISCO: una copia
// con otro nombre sigue sin casar con el original.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    return fs.realpathSync(fileURLToPath(metaUrl)) === fs.realpathSync(argv1);
  } catch {
    // Un `metaUrl` que no es `file:`, o un fichero que ya no está en disco: no se puede AFIRMAR
    // que seamos la entrada, y ante la duda no se arranca.
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
