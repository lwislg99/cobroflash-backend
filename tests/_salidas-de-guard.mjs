// tests/_salidas-de-guard.mjs — SCRUM-1320
//
// Lee, por AST, CON QUÉ sale un guard (`process.exit(…)`) y si el veredicto entre «hallazgo» y
// «ciego» lo decide él a mano o lo saca de `veredictoDe` (`scripts/_hallazgos-y-ciegos.mjs`).
//
// Por AST y no por texto: los comentarios de estos guards CITAN las colas viejas para explicar por
// qué se retiraron, y un `grep` las contaría como vivas (A23, casilla 2).
import ts from 'typescript';

/** Los nombres que en esta casa significan «no llegué a medir». */
const NOMBRES_DE_CIEGO = new Set(['SALIDA_NO_SUPE_MEDIR', 'SALIDA_CIEGO', 'SALIDA_NO_ENCONTRADO', 'SALIDA_NO_ARRANCA', 'SALIDA_SIN_SERVIDOR']);
const NUMEROS_DE_CIEGO = new Set(['2', '3', '4']);

function clasificar(arg) {
  if (!arg) return 'otro';
  if (ts.isNumericLiteral(arg)) return arg.text === '1' ? 'hallazgo' : (NUMEROS_DE_CIEGO.has(arg.text) ? 'ciego' : 'otro');
  if (ts.isIdentifier(arg)) return arg.text === 'SALIDA_HALLAZGO' ? 'hallazgo' : (NOMBRES_DE_CIEGO.has(arg.text) ? 'ciego' : 'otro');
  if (ts.isPropertyAccessExpression(arg) && arg.name.text === 'codigo') return 'veredicto';
  // `process.exit(fallos === 0 ? 0 : 1)`: un 1 elegido a mano, aunque venga dentro de un ternario.
  if (ts.isConditionalExpression(arg)) {
    const ramas = [clasificar(arg.whenTrue), clasificar(arg.whenFalse)];
    return ramas.includes('hallazgo') ? 'hallazgo' : (ramas.includes('ciego') ? 'ciego' : 'otro');
  }
  return 'otro';
}

function nombresDe(nodo, sf) {
  const nombres = new Set();
  const ver = (n) => { if (ts.isIdentifier(n)) nombres.add(n.text); ts.forEachChild(n, ver); };
  if (nodo) ver(nodo);
  return nombres;
}

/**
 * Las salidas de un guard y lo que le pasa a `veredictoDe`.
 * `error` no nulo = el fichero no se pudo leer como programa: eso es un CIEGO del censo, no «sin salidas».
 */
export function salidasDe(fuente, nombre = 'guard.mjs') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    return { error: String(ts.flattenDiagnosticMessageText(sf.parseDiagnostics[0].messageText, ' ')), salidas: [], cuentasDeCiego: new Set(), usaVeredicto: false };
  }
  const salidas = [];
  const cuentasDeCiego = new Set();
  let usaVeredicto = false;

  const visitar = (nodo, condiciones) => {
    let dentro = condiciones;
    if (ts.isIfStatement(nodo)) dentro = [...condiciones, nodo.expression];
    if (ts.isCallExpression(nodo)) {
      const f = nodo.expression;
      if (ts.isPropertyAccessExpression(f) && f.name.text === 'exit' && ts.isIdentifier(f.expression) && f.expression.text === 'process') {
        salidas.push({
          tipo: clasificar(nodo.arguments[0]),
          linea: sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1,
          // Los nombres de las condiciones `if` que envuelven a esta salida.
          bajo: new Set(condiciones.flatMap((c) => [...nombresDe(c, sf)])),
        });
      }
      if (ts.isIdentifier(f) && f.text === 'veredictoDe') {
        usaVeredicto = true;
        const o = nodo.arguments[0];
        if (o && ts.isObjectLiteralExpression(o)) {
          for (const p of o.properties) {
            const clave = p.name && p.name.text;
            if (clave !== 'ciegos') continue;
            // `{ ciegos }` y `{ ciegos: ciego }` y `{ ciegos: ciegos.length + 1 }`: los nombres de dentro.
            const valor = ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer;
            for (const n of nombresDe(valor, sf)) cuentasDeCiego.add(n);
          }
        }
      }
    }
    // El `if` cubre su rama y su `else`; la propia condición se visita sin ella.
    ts.forEachChild(nodo, (hijo) => visitar(hijo, ts.isIfStatement(nodo) && hijo === nodo.expression ? condiciones : dentro));
  };
  visitar(sf, []);
  return { error: null, salidas, cuentasDeCiego, usaVeredicto };
}

/**
 * Los defectos de UN guard. Vacío = o no distingue dos estados, o los decide con `veredictoDe`.
 *
 *   ① decide a mano: tiene una salida de ciego Y una de hallazgo escritas por él. Es la cola de la
 *      familia de antes de SCRUM-1320 (el orden lo eligió alguien, y uno de los dos estados se pierde).
 *   ② usa `veredictoDe` y aun así sale a mano con el hallazgo: el ciego volvería a desaparecer.
 *   ③ usa `veredictoDe` y sale a mano con el ciego BAJO una condición sobre la misma cuenta que le
 *      pasa: el defecto original, vuelto a poner delante del veredicto.
 */
export function defectosDe(fuente, nombre = 'guard.mjs') {
  const r = salidasDe(fuente, nombre);
  if (r.error) return { ciego: r.error, defectos: [], ...r };
  const deCiego = r.salidas.filter((s) => s.tipo === 'ciego');
  const deHallazgo = r.salidas.filter((s) => s.tipo === 'hallazgo');
  const defectos = [];
  if (!r.usaVeredicto && deCiego.length && deHallazgo.length) {
    defectos.push('decide a mano entre ciego (línea ' + deCiego.map((s) => s.linea).join(', ') + ') y hallazgo (línea ' + deHallazgo.map((s) => s.linea).join(', ') + ')');
  }
  if (r.usaVeredicto && deHallazgo.length) {
    defectos.push('usa `veredictoDe` y además sale a mano con el hallazgo (línea ' + deHallazgo.map((s) => s.linea).join(', ') + ')');
  }
  if (r.usaVeredicto) {
    const tapan = deCiego.filter((s) => [...r.cuentasDeCiego].some((n) => s.bajo.has(n)));
    if (tapan.length) {
      defectos.push('usa `veredictoDe` y además sale por ciego bajo su propia cuenta de ciegos (línea ' + tapan.map((s) => s.linea).join(', ') + ')');
    }
  }
  return { ciego: null, defectos, ...r };
}
