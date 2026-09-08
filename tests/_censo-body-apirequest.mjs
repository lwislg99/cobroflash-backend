// tests/_censo-body-apirequest.mjs — SCRUM-704
//
// QUÉ FORMA TIENE EL `body` QUE CADA LLAMADOR LE PASA A `apiRequest`.
//
// La pregunta no es retórica: decide cuál es el arreglo correcto. Si casi todos mandan cadena,
// serializar dentro rompería a la mayoría; si casi todos mandan objeto, el que serializa fuera es
// la excepción. **No se supone: se cuenta.**
//
// ── POR QUÉ AST Y NO `grep` ───────────────────────────────────────────────────────────────
// `grep "body:"` no distingue un `body` dentro de un comentario, ni el de un `fetch` que no es
// `apiRequest`, ni sabe si lo que sigue es un objeto o una llamada a `JSON.stringify`. Lo que hay
// que clasificar es la EXPRESIÓN, y eso es un nodo.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Las tres formas que puede tener el `body` de una llamada. */
export const FORMAS = Object.freeze({
  OBJETO: 'objeto',          // { a: 1 }  → hoy viaja como "[object Object]"
  STRINGIFY: 'stringify',    // JSON.stringify({...})
  OTRA: 'otra',              // una variable, un FormData, una plantilla… no se puede decidir aquí
});

function ficherosJs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosJs(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/**
 * Censo de llamadas a `apiRequest(...)` con `body` en sus opciones.
 *
 * @returns {{ total:number, llamadas:Array<{fichero:string,linea:number,forma:string,texto:string}> }}
 */
export function censoDeBodies(raiz) {
  const base = path.join(raiz, 'public');
  const llamadas = [];
  if (!fs.existsSync(base)) return { total: 0, llamadas, sinPublic: true };

  for (const fichero of ficherosJs(base)) {
    const fuente = fs.readFileSync(fichero, 'utf8');
    const sf = ts.createSourceFile(fichero, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const rel = path.relative(raiz, fichero).replace(/\\/g, '/');

    const visita = (n) => {
      if (ts.isCallExpression(n)
        && ts.isIdentifier(n.expression) && n.expression.text === 'apiRequest'
        && n.arguments.length >= 2 && ts.isObjectLiteralExpression(n.arguments[1])) {
        for (const prop of n.arguments[1].properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const nombre = prop.name && (prop.name.text || prop.name.escapedText);
          if (nombre !== 'body') continue;
          const v = prop.initializer;
          let forma = FORMAS.OTRA;
          if (ts.isObjectLiteralExpression(v)) forma = FORMAS.OBJETO;
          else if (ts.isCallExpression(v) && v.expression.getText().replace(/\s/g, '') === 'JSON.stringify') {
            forma = FORMAS.STRINGIFY;
          }
          llamadas.push({
            fichero: rel,
            linea: sf.getLineAndCharacterOfPosition(prop.getStart()).line + 1,
            forma,
            texto: v.getText().replace(/\s+/g, ' ').slice(0, 90),
          });
        }
      }
      ts.forEachChild(n, visita);
    };
    ts.forEachChild(sf, visita);
  }
  return { total: llamadas.length, llamadas };
}

/** Recuento por forma, para no contar a mano. */
export function porForma(censo) {
  const c = { objeto: 0, stringify: 0, otra: 0 };
  for (const l of censo.llamadas) c[l.forma] += 1;
  return c;
}
