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
//
// ── 🔴 SCRUM-602 (4-sep-2026) · EL `...spread` DEJABA ESTE CENSO CIEGO, Y EN SILENCIO ──────
//
// `nombreDePropiedad` devuelve `null` para un `SpreadAssignment` —no tiene `.name`— y el bucle
// lo SALTABA sin decir nada. O sea: todo lo que viajara dentro de un spread era invisible para
// el censo, incluido «un campo nuevo que nadie ha colocado», que es el caso ④ que este
// mecanismo existe para cazar.
//
// MEDIDO, no supuesto, y con control positivo: se inyectó `campoQueNadieHaRegistrado` en el
// payload de tres formas. Escrito a mano → 3 rojos. Dentro de `...({ … })` → CERO rojos.
// Dentro de `...variable` → CERO rojos.
//
// Ahora hay dos respuestas y NINGUNA es el silencio:
//   · spread de un OBJETO LITERAL → sus claves se leen y se cuentan: son estáticas.
//   · spread de CUALQUIER OTRA COSA (variable, llamada, acceso) → `opacos`. El censo NO puede
//     saber qué claves viajan ahí, así que lo DICE en vez de devolver un número más bajo.
//     «No supe mirar» y «no hay nada» dejan de ser el mismo resultado.
//
// Quien lo convierte en rojo es `tests/scrum602-direccion-obra.test.mjs`, sobre
// `revisarAsignacionDeBloques(...).envioOpaco`.
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
 * SCRUM-602 · el objeto literal que hay DETRÁS de un spread, si lo hay.
 *
 * Acepta el paréntesis —`...({ a: 1 })` es la forma que sale sola al envolver— porque un censo
 * que pidiera la llave pegada al spread se quedaría ciego por la forma, que es la avería que
 * SCRUM-553 ya documentó en otro extractor.
 */
function objetoLiteralDetrasDelSpread(expr) {
  let e = expr;
  while (e && ts.isParenthesizedExpression(e)) e = e.expression;
  return e && ts.isObjectLiteralExpression(e) ? e : null;
}

/**
 * @returns {{envio:Array, linea:Array, poblacion:object}}
 */
export function censarEnvioPresupuesto(fuente, ruta = 'quotesView.js') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const nLinea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const envio = [];
  const linea = [];
  /** SCRUM-602 · spreads que el censo NO puede resolver. Vacío = lo ha visto TODO. */
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
        // SCRUM-602 · un spread NO se salta en silencio (ver la cabecera).
        if (ts.isSpreadAssignment(p)) {
          const lit = objetoLiteralDetrasDelSpread(p.expression);
          if (lit) {
            for (const q of lit.properties) {
              const c = nombreDePropiedad(q);
              if (c) envio.push({ clave: c, linea: nLinea(q), origen: 'quotePayload (spread literal)' });
              else opacos.push({ texto: q.getText(sf), linea: nLinea(q) });
            }
          } else {
            opacos.push({ texto: p.getText(sf), linea: nLinea(p) });
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
