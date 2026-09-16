// tests/_censo-acciones-factura.mjs — SCRUM-283 (B2)
//
// CENSO DERIVADO de las acciones de la vista de detalle de FACTURA. NO mapea a ninguna celda: la
// tabla de estados está en tensión (contradicciones B/C/D) y ese mapeo lo decide el fundador. Aquí
// solo se ENUMERA lo que EXISTE, con su CONDICIÓN de aparición, para que el mapeo sea verificable
// el día que la tabla se decida. El censo enumera; el mapeo coloca.
//
// DERIVADO DE LA ESTRUCTURA (AST de TypeScript sobre el JS), nunca una lista a mano: una lista no
// avisa de lo que le falta, y el propio ticket contó 8 acciones donde el árbol tiene 9.
//
// LA TRAMPA DE LA CASA: solo cuentan los botones DENTRO de `renderInvoiceDetailView`. El mismo
// fichero tiene `abrirModalAnular`, con sus botones de confirmar/cancelar del modal, que NO son
// acciones de la factura — igual que `job_without_quote` vivía en el fichero de albaranes pero
// pertenecía a collect-rest.
//
// ACCIÓN vs NAVEGACIÓN: derivado de la cadena de `appendChild`. Un botón cuya cadena llega a través
// de `header` (la cabecera con las migas y el «← Volver») es navegación; el resto son acciones. Y
// solo cuenta lo que se APPENDEA: un botón creado y nunca añadido no está en pantalla.
import ts from 'typescript';

export const FUNCION_VISTA = 'renderInvoiceDetailView';
const CABECERA = 'header';

const t = (n) => n.getText();

export function censarAccionesFactura(codigo) {
  const sf = ts.createSourceFile('invoiceDetailView.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // 1 · localizar el CUERPO de la vista
  let vista = null;
  (function buscar(n) {
    if (!vista && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n))
        && n.name && n.name.text === FUNCION_VISTA) { vista = n; return; }
    if (!vista) ts.forEachChild(n, buscar);
  })(sf);
  if (!vista) return { vistaEncontrada: false, acciones: [], navegacion: [], rangoVista: null };

  const ini = vista.getStart(sf), fin = vista.getEnd();
  const dentro = (n) => n.getStart(sf) >= ini && n.getEnd() <= fin;
  const lineaDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const botones = new Map();     // var -> { id, linea }
  const textoBtn = new Map();    // var -> primer texto asignado
  const padreDe = new Map();     // hijoVar -> padreVar (de appendChild)
  const condBtn = new Map();     // var -> [condiciones] (ifs que envuelven su colocación)
  const consts = new Map();      // nombre -> texto del inicializador (resuelve condiciones nombradas)
  const colocadoPor = new Map(); // var -> 'ubicarAccion' | 'appendChild' (cómo llega a la pantalla)

  const esCreateButton = (init) =>
    init && ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression)
    && init.expression.name.text === 'createElement'
    && init.arguments.length === 1 && ts.isStringLiteralLike(init.arguments[0])
    && init.arguments[0].text === 'button';

  // ifs (en su rama THEN) que envuelven `nodo`, hasta el cuerpo de la vista
  const condicionesEnvolventes = (nodo) => {
    const out = [];
    for (let p = nodo.parent; p && p.getStart(sf) >= ini; p = p.parent) {
      if (ts.isIfStatement(p)
          && p.thenStatement.getStart(sf) <= nodo.getStart(sf) && nodo.getEnd() <= p.thenStatement.getEnd()) {
        out.unshift(t(p.expression).replace(/\s+/g, ' ').trim());
      }
    }
    return out;
  };

  (function visitar(n) {
    if (!dentro(n)) return; // fuera de la vista → ni se mira (trampa de la casa)

    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer) {
      if (esCreateButton(n.initializer)) botones.set(n.name.text, { id: n.name.text, linea: lineaDe(n) });
      else consts.set(n.name.text, t(n.initializer).replace(/\s+/g, ' ').trim());
    }

    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression)
        && (n.left.name.text === 'textContent' || n.left.name.text === 'innerHTML')) {
      const v = n.left.expression.text;
      if (!textoBtn.has(v)) textoBtn.set(v, t(n.right).replace(/\s+/g, ' ').trim());
    }

    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'appendChild' && ts.isIdentifier(n.expression.expression)
        && n.arguments.length === 1 && ts.isIdentifier(n.arguments[0])) {
      const hijo = n.arguments[0].text;
      padreDe.set(hijo, n.expression.expression.text);
      if (!colocadoPor.has(hijo)) { colocadoPor.set(hijo, 'appendChild'); condBtn.set(hijo, condicionesEnvolventes(n)); }
    }

    // ubicarAccion(btnX, 'id') — el patrón SCRUM-283 coloca desde el registro; equivale a "aparece
    // en pantalla". La condición envolvente son los data-gates (chargeId/phone/…): el ESTADO ya no
    // está en un if, vive en el registro.
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'ubicarAccion'
        && n.arguments.length >= 1 && ts.isIdentifier(n.arguments[0])) {
      const hijo = n.arguments[0].text;
      colocadoPor.set(hijo, 'ubicarAccion');
      condBtn.set(hijo, condicionesEnvolventes(n));
    }

    ts.forEachChild(n, visitar);
  })(vista);

  const cadena = (v) => { const c = [v]; let x = v, g = 0; while (padreDe.has(x) && g++ < 40) { x = padreDe.get(x); c.push(x); } return c; };
  const resolver = (cs) => cs.map((c) => (consts.has(c) ? `${c} (= ${consts.get(c)})` : c));

  const acciones = [], navegacion = [];
  for (const [v, info] of botones) {
    if (!colocadoPor.has(v)) continue; // ni ubicado por el registro ni appendeado: no está en pantalla
    const entrada = { id: v, linea: info.linea, texto: textoBtn.get(v) ?? '(sin texto)', condicion: resolver(condBtn.get(v) ?? []) };
    // Navegación = appendeado a través de la cabecera (btnBack). Lo ubicado por el registro es acción.
    const esNav = colocadoPor.get(v) === 'appendChild' && cadena(v).includes(CABECERA);
    (esNav ? navegacion : acciones).push(entrada);
  }
  acciones.sort((a, b) => a.linea - b.linea);
  navegacion.sort((a, b) => a.linea - b.linea);
  return { vistaEncontrada: true, acciones, navegacion, rangoVista: { desde: lineaDe(vista), hasta: sf.getLineAndCharacterOfPosition(fin).line + 1 } };
}
