// tests/_censo-new-url.mjs — SCRUM-414 · dónde se parsea una URL a mano, y si ese parseo puede hablar.
//
// ── POR QUÉ SE DERIVA ASÍ Y NO POR EL NOMBRE DE LA VARIABLE ─────────────────────────────────
// El guard de SCRUM-195 marcaba `new URL(x)` **solo si `x` se llamaba algo con pinta de base de
// datos** (`/db|database|conn|dsn|postgres|pg/i`). Medido: de **10** `new URL` en `scripts/`, ese
// filtro marcaba **2**. Se le escapaban **8**, y tres de ellos parsean de verdad una URL de BD
// —`backfill-quote-jobid.mjs`, `conciliar-auditoria-fiscal.mjs`, `preflight-schema-drift.mjs`—, así
// que **la regla que el propio guard enunciaba estaba incumplida en `main` y el guard daba verde**.
//
// Es la sexta variante del mismo patrón de esta casa: el guard atado a la FORMA en vez de al HECHO.
// Ternario, `||`, objeto indexado, puntuación, número de línea… y ahora el identificador. Un nombre
// de variable no es un hecho: es una costumbre, y basta llamarla `u` para salir del radar.
//
// ── EL HECHO ────────────────────────────────────────────────────────────────────────────────
// Lo que filtró una credencial de producción no fue el nombre de nada: fue que **`new URL()` lanza
// un error que lleva la cadena entera en `e.input`**, y ese objeto acabó volcado. Así que el hecho
// peligroso es *«¿puede alguien llegar a ese error?»*, y eso se responde mirando el `try/catch`:
//
//   · **catch ciego** (`catch {`, sin binding) → el error es INALCANZABLE. Nadie puede imprimirlo,
//     ni hoy ni el día que alguien añada una línea de depuración. Seguro por construcción.
//   · **catch con binding** (`catch (e)`) → alcanzable. Puede que hoy no se imprima; el primer
//     `console.error(e)` de depuración lo publica.
//   · **sin try** → el peor caso, y es el que ocurrió: el error sube hasta el manejador de
//     excepciones no capturadas, que **vuelca el objeto entero**.
//
// Se mira TODO `new URL` de `scripts/`, no solo los de BD. Una URL de petición también lleva
// secretos en este proyecto: los `portalToken` viajan en la ruta.
//
// ── LA ÚNICA EXENCIÓN, Y SE DERIVA ──────────────────────────────────────────────────────────
// El módulo que **exporta `parseBDSegura`** es donde vive el parseo seguro: su `new URL` es el que
// todos los demás usan en vez de escribir el suyo. No se exime por su nombre —se exime por lo que
// EXPORTA—, así que si el parseo seguro se mudara, la exención se mudaría con él.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const DIR_SCRIPTS = 'scripts';

/**
 * Todos los `new URL(...)` de `scripts/`, con su veredicto.
 * @returns {{fichero:string,linea:number,argumento:string,proteccion:'catch-ciego'|'catch-con-binding'|'sin-try',seguro:boolean,esElParseoSeguro:boolean}[]}
 */
export function censoNewUrl(raiz) {
  const dir = path.join(raiz, DIR_SCRIPTS);
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  const hallazgos = [];

  for (const f of ficheros) {
    const codigo = fs.readFileSync(path.join(dir, f), 'utf8');
    const fuente = ts.createSourceFile(f, codigo, ts.ScriptTarget.Latest, true);
    // ¿Es este el módulo donde vive el parseo seguro? Se deriva de lo que exporta.
    const esElParseoSeguro = /export function parseBDSegura/.test(codigo);

    const visitar = (nodo) => {
      if (
        ts.isNewExpression(nodo)
        && ts.isIdentifier(nodo.expression)
        && nodo.expression.text === 'URL'
      ) {
        hallazgos.push({
          fichero: f,
          linea: fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente)).line + 1,
          argumento: nodo.arguments?.[0] ? nodo.arguments[0].getText(fuente) : '(sin argumento)',
          esElParseoSeguro,
          ...proteccionDe(nodo, fuente),
        });
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(fuente);
  }
  return hallazgos;
}

/**
 * Sube por los padres del nodo hasta encontrar el `try` que lo envuelve, y mira su `catch`.
 *
 * Se sube por el AST en vez de buscar «hay un `catch {` cerca» porque la cercanía en el texto no es
 * contención: un `catch` ciego tres líneas más abajo, en OTRO try, daría un verde falso.
 */
function proteccionDe(nodo, fuente) {
  for (let p = nodo.parent; p; p = p.parent) {
    if (ts.isTryStatement(p)) {
      // Solo cuenta si el `new URL` está en el BLOQUE del try. Si estuviera dentro del propio
      // `catch` o del `finally`, ese try no lo protege.
      const dentroDelTry = nodo.getStart(fuente) >= p.tryBlock.getStart(fuente)
        && nodo.getEnd() <= p.tryBlock.getEnd();
      if (!dentroDelTry) continue;
      if (!p.catchClause) continue; // try/finally sin catch: el error sigue subiendo
      const ciego = !p.catchClause.variableDeclaration; // `catch {` no captura nada
      return { proteccion: ciego ? 'catch-ciego' : 'catch-con-binding', seguro: ciego };
    }
  }
  return { proteccion: 'sin-try', seguro: false };
}
