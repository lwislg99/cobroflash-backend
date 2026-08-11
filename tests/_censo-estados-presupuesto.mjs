// tests/_censo-estados-presupuesto.mjs — SCRUM-421
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ AST Y NO UN ESCÁNER DE LITERALES
//
// `Quote.status` es un **String LIBRE**: el modelo no cierra el conjunto. Así que la tabla del
// registro no vale nada si no hay algo que contraste lo que el código ESCRIBE de verdad.
//
// Y el caso que decide si el escáner sirve está en la ruta principal de creación:
//
//     quotes.routes.ts:119   const initialStatus = needsApproval ? 'pending_approval' : 'draft';
//     quotes.routes.ts:155   status: initialStatus,
//
// Una escritura REAL **por variable**. Un escáner de literales ve `status: initialStatus`, no
// encuentra comilla, y pasa de largo: el guard nacería con el agujero dentro. Aquí se resuelve la
// variable dentro de su función y se sacan los dos valores del ternario.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 Y LO QUE NO SE PUEDE RESOLVER SE CUENTA
//
// Si el AST no sabe de dónde sale un valor, eso **no es «no hay estados fuera de la tabla»**: es
// «no supe leer esta escritura». Las dos cosas se ven igual en un verde, y son opuestas. Por eso
// `sinResolver` viaja con el censo y el test falla si no es cero.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Los ficheros de `src/` donde puede escribirse el estado de un presupuesto. */
function fuentes(raiz) {
  const out = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.name.endsWith('.ts')) out.push(p);
    }
  };
  const dir = path.join(raiz, 'src');
  if (fs.existsSync(dir)) rec(dir);
  return out;
}

const textoDe = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null);

/** La función que envuelve a un nodo, para poder resolver variables en SU ámbito. */
function funcionQueEnvuelve(nodo) {
  let p = nodo.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) || ts.isMethodDeclaration(p)) return p;
    p = p.parent;
  }
  return null;
}

/**
 * Los valores posibles de una expresión. `null` = no se supo resolver (y eso se cuenta).
 *
 * Resuelve: literal · ternario de literales · identificador declarado en la misma función con
 * cualquiera de los dos anteriores. Todo lo demás es honestamente «no lo sé».
 */
function valoresDe(expr, sf) {
  const lit = textoDe(expr);
  if (lit !== null) return [lit];

  if (ts.isConditionalExpression(expr)) {
    const a = valoresDe(expr.whenTrue, sf);
    const b = valoresDe(expr.whenFalse, sf);
    return a && b ? [...a, ...b] : null;
  }

  if (ts.isIdentifier(expr)) {
    // 🔴 SE SUBE POR TODAS LAS FUNCIONES QUE ENVUELVEN, no solo por la más interna.
    //
    // El caso que decide este guard vive en `quotes.routes.ts`: `initialStatus` se declara en el
    // handler (:119) y se escribe DENTRO de `prisma.$transaction(async (tx) => …)` (:155). Con la
    // función más interna sola, la declaración queda fuera de alcance y la escritura sale «sin
    // resolver» — el guard vería el agujero pero no sabría leerlo, que es medio agujero igual.
    let fn = funcionQueEnvuelve(expr);
    while (fn) {
      if (fn.body) {
        let encontrado = null;
        const buscar = (n) => {
          if (encontrado) return;
          if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === expr.text && n.initializer) {
            encontrado = valoresDe(n.initializer, sf);
            return;
          }
          ts.forEachChild(n, buscar);
        };
        buscar(fn.body);
        if (encontrado) return encontrado;
      }
      fn = funcionQueEnvuelve(fn);
    }
    return null;
  }

  return null;
}

/**
 * Censo de escrituras de `status` sobre presupuestos.
 *
 * @returns {{escrituras:{fichero:string,linea:number,valores:string[]}[], sinResolver:{fichero:string,linea:number,texto:string}[], ficherosMirados:number}}
 */
export function censarEstadosDePresupuesto(raiz) {
  const escrituras = [];
  const sinResolver = [];
  const ficheros = fuentes(raiz);

  for (const f of ficheros) {
    const rel = path.relative(raiz, f).replace(/\\/g, '/');
    // Solo donde se habla de presupuestos: `status` es un nombre compartido con facturas y cobros,
    // y meterlos aquí daría ruido — y un guard con ruido acaba relajado hasta quedarse ciego.
    const fuente = fs.readFileSync(f, 'utf8');
    if (!/\bquote\b/i.test(rel) && !/\.quote\./.test(fuente)) continue;

    const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
    const visitar = (nodo) => {
      if (ts.isPropertyAssignment(nodo)) {
        const clave = ts.isIdentifier(nodo.name) || ts.isStringLiteral(nodo.name) ? nodo.name.text : null;
        if (clave === 'status') {
          // Solo si el objeto cuelga de una escritura de `quote` — no de una lectura ni de otro modelo.
          // 🔴 `\.quote\.` y NO `prisma\.quote\.`: dentro de una transacción el cliente se llama
          // `tx`, y la escritura que ESTE ticket señaló como la que decide —`tx.quote.create` con
          // `status: initialStatus`, la ruta principal de creación— quedaba fuera del censo. El
          // guard habría nacido con el agujero dentro, que es justo contra lo que se avisó.
          const enQuote = /\.quote\.(create|update|updateMany|upsert)/.test(
            nodo.getSourceFile().text.slice(Math.max(0, nodo.pos - 400), nodo.pos),
          );
          if (enQuote) {
            const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf));
            const vals = valoresDe(nodo.initializer, sf);
            if (vals) escrituras.push({ fichero: rel, linea: line + 1, valores: vals });
            else sinResolver.push({ fichero: rel, linea: line + 1, texto: nodo.getText(sf).slice(0, 80) });
          }
        }
      }
      ts.forEachChild(nodo, visitar);
    };
    ts.forEachChild(sf, visitar);
  }

  return { escrituras, sinResolver, ficherosMirados: ficheros.length };
}

/** Igual, pero sobre una fuente suelta: para los controles del test. */
export function censarFuente(nombre, codigo) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const escrituras = [];
  const sinResolver = [];
  const visitar = (nodo) => {
    if (ts.isPropertyAssignment(nodo)) {
      const clave = ts.isIdentifier(nodo.name) || ts.isStringLiteral(nodo.name) ? nodo.name.text : null;
      if (clave === 'status') {
        const vals = valoresDe(nodo.initializer, sf);
        if (vals) escrituras.push({ valores: vals });
        else sinResolver.push({ texto: nodo.getText(sf) });
      }
    }
    ts.forEachChild(nodo, visitar);
  };
  ts.forEachChild(sf, visitar);
  return { escrituras, sinResolver };
}
