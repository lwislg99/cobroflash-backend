// tests/_censo-cantidad-inventada.mjs — SCRUM-311: la red de SCRUM-271, DERIVADA.
//
// ── EL DEFECTO DE LA RED, no del arreglo ──────────────────────────────────────
// SCRUM-271 arregló bien sus tres puntos. Lo que falla es su GUARD: lee DOS rutas escritas a
// mano (`homeView.js` y `jobDetailView.js`), que son exactamente los dos ficheros que ya
// arregló. Su propia cabecera nombra tres sitios más que nunca cubrió —`expensesView`,
// `productsView` ×2— y `quotesView.js` tiene el patrón sin vigilancia.
//
// O sea: el guard aparentaba cobertura porque su ticket estaba Finalizada. Un guard que
// enumera solo protege lo que ya se arregló. **Deriva, no enumeres.**
//
// ── QUÉ ES EL PATRÓN PELIGROSO, y esto es lo que cuesta escribir ──────────────
// `<input type="number">` devuelve CADENA VACÍA cuando el navegador rechaza la entrada.
// `Number("")` es `0`, y `0 || 1` da `1` en silencio. El pro deja la cantidad vacía y el
// sistema inventa una.
//
// PELIGROSO  = leer un `.value` y caer a un literal numérico **DISTINTO DE CERO**.
// LEGÍTIMO   = todo lo demás, y hay tres familias, las tres medidas en `quotesView.js`:
//
//   · `|| ""`        (30 casos) — la reserva es cadena VACÍA. `parseFloat("")` es `NaN`, y el
//                     código lo trata aparte con `Number.isFinite`. No inventa: se entera.
//   · `|| 0` / `|| "0"` (3 casos) — cero significa cero. No hay valor inventado: hay ausencia
//                     representada como ausencia.
//   · `|| "21"`      (3 casos) — lee el campo **IVA POR DEFECTO** del merchant. El sujeto no es
//                     una línea del presupuesto: es un ajuste cuyo defecto ES el 21. Caer a él
//                     no inventa nada, restaura lo configurado.
//
// La tercera familia es la única que no se separa por la FORMA del literal —21 es no-cero, como
// el 1 peligroso—, así que se separa por el SUJETO: una lectura de un campo `*Default*` es un
// valor por defecto, no una entrada de línea.
//
// ⚠️ LÍMITE DECLARADO: ese último discriminador se apoya en el NOMBRE del identificador, no en
// la estructura. Es el punto débil de este censo y va escrito aquí en vez de descubrirse luego:
// un campo de valores por defecto que no se llamara `*Default*` caería como falso positivo, y
// uno peligroso que sí se llamara así se escaparía. No se me ocurre un discriminador
// estructural sin análisis de flujo de datos, que sería más código que lo que vigila.
import ts from 'typescript';

function recorrer(nodo, fn) { fn(nodo); nodo.forEachChild((h) => recorrer(h, fn)); }

/** ¿El literal es un número distinto de cero? `''` y `'0'` y `0` NO lo son. */
function literalNoCero(n) {
  if (!n) return null;
  if (ts.isNumericLiteral(n)) return Number(n.text) !== 0 ? n.text : null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
    const t = n.text.trim();
    if (t === '') return null;
    const v = Number(t.replace(',', '.'));
    return Number.isFinite(v) && v !== 0 ? n.text : null;
  }
  return null;
}

/** Texto del sujeto de la lectura: `line.qtyInput.value` → 'line.qtyInput.value'. */
function textoDelSujeto(n, sf) {
  try { return n.getText(sf); } catch { return ''; }
}

/**
 * ¿La expresión lee el `.value` de un control?
 *
 * ⚠️ MIRA EL SUBÁRBOL, no solo el nodo raíz — y esto lo cazó el CONTROL POSITIVO, no yo. La
 * primera versión exigía que el lado izquierdo fuese un `.value` DIRECTO, y con eso el defecto
 * ORIGINAL de SCRUM-271 —`Number(l.qtyInput.value) || 1`, donde el izquierdo es una LLAMADA— no
 * caía. O sea que derivar habría EMPEORADO la red que venía a ampliar, que es el colmo posible
 * en este ticket. La envoltura (`Number`, `parseFloat`, `parseInt`, `String`) es justamente lo
 * que convierte `""` en `0` y hace que `|| 1` se dispare: ignorarla era mirar al lado.
 */
function esLecturaDeValue(n) {
  let si = false;
  recorrer(n, (x) => {
    if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.name) && x.name.text === 'value') si = true;
  });
  return si;
}

/**
 * @returns {{hallazgos:Array, lecturasDeValue:number}}
 */
export function censarCantidadInventada(fuente, ruta) {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const hallazgos = [];
  let lecturasDeValue = 0;

  recorrer(sf, (n) => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name) && n.name.text === "value") lecturasDeValue++;
    if (!ts.isBinaryExpression(n)) return;
    if (n.operatorToken.kind !== ts.SyntaxKind.BarBarToken) return;
    if (!esLecturaDeValue(n.left)) return;

    const reserva = literalNoCero(n.right);
    if (reserva === null) return; // `|| ""`, `|| 0`, `|| "0"` → legítimos

    const sujeto = textoDelSujeto(n.left, sf);
    // El sujeto es un VALOR POR DEFECTO, no una entrada de línea (ver límite en la cabecera).
    if (/Default/i.test(sujeto)) return;

    hallazgos.push({
      ruta,
      linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      sujeto,
      reserva,
    });
  });

  return { hallazgos, lecturasDeValue };
}

/**
 * EXCEPCIÓN EXPLICADA — no una allowlist muda.
 *
 * `quotesView.js:2585` es el único sitio con la forma exacta hoy. NO se arregla ni se silencia:
 * tiene DECISIÓN DEL FUNDADOR pendiente en SCRUM-311 — ¿puede una plantilla inventar cantidad 1?
 *
 * Los tres atenuantes medidos, para que quien lea esto no tenga que volver a medirlos:
 *   1. Está en el camino de GUARDAR PLANTILLA, no en el cálculo ni en el envío del presupuesto.
 *   2. Tiene segunda defensa explícita tres líneas más abajo: `Number.isFinite(qty) ? qty : 1`.
 *      Alguien pensó el caso vacío y eligió 1 a conciencia.
 *   3. Las otras cuatro lecturas de `qtyInput.value` del mismo fichero usan `|| ""`.
 *
 * Va con su motivo y su ticket. Cuando el fundador decida, esta entrada se va — y si el patrón
 * reaparece en OTRA línea, el censo lo caza igual porque la excepción es por ruta+línea, no por
 * fichero entero.
 */
export const EXCEPCIONES_CON_MOTIVO = [
  {
    ruta: 'public/dashboard/js/quotesView.js',
    linea: 2585,
    motivo: 'camino de GUARDAR PLANTILLA (no el envío del presupuesto), con segunda defensa en ' +
            '`Number.isFinite(qty) ? qty : 1`. Decisión del fundador pendiente en SCRUM-311.',
  },
];

export const esExcepcion = (h) =>
  EXCEPCIONES_CON_MOTIVO.some((e) => e.ruta === h.ruta && e.linea === h.linea);
