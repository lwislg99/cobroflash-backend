// tests/_censo-nuevo-presupuesto.mjs — SCRUM-286 (B3): censo DERIVADO de lo que el formulario
// «Nuevo presupuesto» ENVÍA. Puro: recibe la fuente, devuelve el censo.
//
// ── 🔴 LA POBLACIÓN, DECLARADA. Un número sin población no vale nada ──────────
// Lección de hoy (SCRUM-311): el guard de SCRUM-271 aparentaba cobertura porque su ticket
// estaba Finalizada — pero leía DOS ficheros enumerados a mano. El número «2 sitios vigilados»
// era cierto y engañaba, porque no decía sobre qué población se había calculado.
//
// Así que aquí va escrito, y sale en la salida del censo, no solo en esta cabecera:
//
//   FICHERO:  public/dashboard/js/quotesView.js
//   FRONTERA: el objeto literal que se pasa a `createQuote(...)` — más la sub-población de
//             `lines`, construida en `payloadLines`.
//   MIDE:     lo que se ENVÍA al servidor.
//
// ── POR QUÉ «LO QUE SE ENVÍA» Y NO «LO QUE SE PINTA» ─────────────────────────
// Son dos poblaciones distintas y el ticket vigila la segunda:
//
//   · Un campo PINTADO QUE NO VIAJA es un control muerto: el pro lo rellena y no pasa nada.
//   · Un campo QUE VIAJA SIN PINTARSE es un valor que el pro no controla (`merchant_id`,
//     `currency`, `created_via`) — legítimo, pero no es suyo.
//
// El fallo mudo que declara el ticket —«un campo que se pierde al reordenar»— se paga en el
// ENVÍO: reordenar la pantalla y que un campo deje de viajar no se ve en la pantalla. Por eso
// esta es la población, y por eso el censo NO cuenta lo que se pinta. La otra población es una
// medición distinta y no está hecha.
//
// ⚠️ NO cubre `saveDraft` (línea ~918): ese snapshot va a `localStorage`, no al servidor. Es
// otra población; mezclarlas daría un número más grande y menos cierto.
import ts from 'typescript';

function recorrer(nodo, fn) { fn(nodo); nodo.forEachChild((h) => recorrer(h, fn)); }

const nombreDeLlamada = (n) => {
  if (!ts.isCallExpression(n)) return null;
  const c = n.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.name)) return c.name.text;
  return null;
};

/** Nombre de una propiedad de objeto literal, sea identificador o cadena. */
function nombreDePropiedad(p) {
  if (!p.name) return null;
  if (ts.isIdentifier(p.name)) return p.name.text;
  if (ts.isStringLiteral(p.name)) return p.name.text;
  return null;
}

/**
 * @returns {{envio:Array, linea:Array, poblacion:object}}
 */
export function censarEnvioPresupuesto(fuente, ruta = 'quotesView.js') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const nLinea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const envio = [];
  const linea = [];
  // Lo que el censo NO ha podido resolver. Va en la salida y no en un `console.warn`: un aviso
  // que nadie lee es un cero que parece un dato.
  const opacos = [];

  // ── FORMA 1 · el objeto que se pasa a createQuote(...) ──────────────────────
  // Se sigue la VARIABLE: `createQuote(quotePayload)` no lleva el literal dentro, así que
  // buscar solo el argumento daría CERO — y cero se leería como «no hay campos», que es
  // justo el falso verde que este censo existe para no producir.
  let nombreDelPayload = null;
  recorrer(sf, (n) => {
    if (nombreDeLlamada(n) === 'createQuote' && n.arguments[0] && ts.isIdentifier(n.arguments[0])) {
      nombreDelPayload = n.arguments[0].text;
    }
  });

  if (nombreDelPayload) {
    recorrer(sf, (n) => {
      if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name)) return;
      if (n.name.text !== nombreDelPayload || !n.initializer) return;
      if (!ts.isObjectLiteralExpression(n.initializer)) return;
      for (const p of n.initializer.properties) {
        // 🔴 SCRUM-587 (4-sep-2026) · LA CEGUERA DEL SPREAD, MEDIDA Y CERRADA.
        //
        // `nombreDePropiedad` devuelve `null` para un `...algo` —un `SpreadAssignment` no tiene
        // `.name`—, así que el bucle lo SALTABA EN SILENCIO. Medido sobre el árbol de hoy: metiendo
        // `...({ campoFantasma: 1 })` en `quotePayload`, el guard de SCRUM-286 seguía **VERDE**.
        // Un campo que viaja al servidor sin estar colocado en ningún bloque es exactamente lo que
        // este censo existe para cazar, y por esa puerta pasaban todos.
        //
        // Se separan los DOS casos, porque son distintos y confundirlos es el defecto de siempre:
        //   · `...({ a: 1 })` — literal: SE PUEDEN LEER sus claves, y se leen.
        //   · `...variable`   — opaco: NO se pueden. Y entonces se DECLARA que no se supo mirar,
        //     en vez de contar cero y llamarlo «no hay campos».
        if (ts.isSpreadAssignment(p)) {
          // ⚠️ SE DESENVUELVEN LOS PARÉNTESIS, y esto lo cazó la medición, no la lectura: la forma
          // que uno escribe de verdad es `...({ a: 1 })`, y ahí `p.expression` NO es el literal
          // sino un `ParenthesizedExpression` que lo envuelve. Sin desenvolver, el caso legible
          // más común se clasificaba como OPACO — seguro, pero falso: obligaría a quitar unos
          // paréntesis legítimos para que el censo volviera a ver.
          let dentro = p.expression;
          while (ts.isParenthesizedExpression(dentro)) dentro = dentro.expression;
          if (ts.isObjectLiteralExpression(dentro)) {
            for (const q of dentro.properties) {
              const c = nombreDePropiedad(q);
              if (c) envio.push({ clave: c, linea: nLinea(q), origen: 'quotePayload (spread literal)' });
              else opacos.push({ texto: p.getText(sf).slice(0, 60), linea: nLinea(q) });
            }
          } else {
            opacos.push({ texto: p.getText(sf).slice(0, 60), linea: nLinea(p) });
          }
          continue;
        }
        const clave = nombreDePropiedad(p);
        if (clave) envio.push({ clave, linea: nLinea(p), origen: 'quotePayload' });
      }
    });
  }

  // ── FORMA 2 · la sub-población de cada línea: lo que se empuja a payloadLines ─
  recorrer(sf, (n) => {
    if (nombreDeLlamada(n) !== 'push') return;
    // 🔴 SCRUM-500: el literal dejó de ser el argumento DIRECTO del `push` — ahora pasa antes por
    // `lineaParaPayload(...)`, que es quien fuerza `tax: 0` en un suplido. Mirando solo
    // `arguments[0]`, el censo contó CERO campos por línea. Se desenvuelve UNA capa de llamada:
    // sin esto, envolver el literal en cualquier función deja toda la sub-población sin vigilar, y
    // el único que lo cazó fue el suelo de «≥4 campos» — que es exactamente para lo que está.
    let obj = n.arguments[0];
    if (obj && ts.isCallExpression(obj) && obj.arguments.length === 1) obj = obj.arguments[0];
    if (!obj || !ts.isObjectLiteralExpression(obj)) return;
    // Solo el push que alimenta el array de líneas del envío.
    const receptor = ts.isPropertyAccessExpression(n.expression) ? n.expression.expression : null;
    if (!receptor || !ts.isIdentifier(receptor) || receptor.text !== 'payloadLines') return;
    for (const p of obj.properties) {
      const clave = nombreDePropiedad(p);
      if (clave) linea.push({ clave, linea: nLinea(p), origen: 'payloadLines' });
    }
  });

  return {
    envio,
    linea,
    opacos,
    poblacion: {
      fichero: ruta,
      frontera: 'objeto pasado a createQuote(...) + sub-población de payloadLines',
      mide: 'lo que se ENVÍA al servidor (no lo que se pinta)',
      excluido: 'saveDraft → localStorage: otra población',
    },
  };
}

/** Los cinco bloques que enumera el ticket. Control cruzado, NO censo. */
export const BLOQUES_DEL_TICKET = ['Cliente', 'Líneas', 'Condiciones', 'Envío', 'Notas'];
