// tests/_ambito-de-la-factura.mjs — SCRUM-723
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL AGUJERO QUE DEJÓ DECLARADO SCRUM-603b, ATADO
//
// El guard de 603b se acotó al CUERPO de `generateInvoicePdf` —y con motivo: en `pdf.service.ts`
// viven los tres documentos, y comparar el fichero entero hacía imposible tocar el presupuesto.
// Pero al acotarlo se declaró un hueco con estas palabras: **si alguien mueve código de la factura
// FUERA de esa función, el guard deja de verlo.** Una línea movida a un ayudante del módulo cambia
// lo que imprime la factura y el cuerpo de la función no se entera: sólo queda la llamada, que ya
// estaba.
//
// Aquí se cierra midiendo el ÁMBITO EFECTIVO: la función MÁS todo lo que declara el módulo y ella
// alcanza —directa o indirectamente—. Mover código a un ayudante ya no lo saca del guard: lo mete,
// porque el ayudante entra por la llamada que lo trajo.
//
// 🔴 SE AMPLÍA LO QUE VIGILA, NO SE RELAJA. Lo de antes es un subconjunto estricto de esto: todo
// lo que caía antes sigue cayendo.
//
// Y por AST, que aquí no es preferencia: `softBreakLongTokens` aparece en comentarios y en cadenas
// del propio módulo, y un recorte por texto ampliaría el ámbito por una mención.
// ═════════════════════════════════════════════════════════════════════════════════════════
import ts from 'typescript';

export const ENTRADA_FACTURA = 'generateInvoicePdf';

/** Las declaraciones de nivel superior del módulo, por nombre → nodo. */
function declaracionesDelModulo(sf) {
  const porNombre = new Map();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) porNombre.set(st.name.text, st);
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) porNombre.set(d.name.text, st);
      }
    } else if (ts.isClassDeclaration(st) && st.name) porNombre.set(st.name.text, st);
  }
  return porNombre;
}

/** Los identificadores que un nodo menciona (sin contar los nombres de propiedad: `a.main`). */
function identificadoresDe(nodo, sf) {
  const vistos = new Set();
  (function mirar(n) {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const esPropiedad = p && ts.isPropertyAccessExpression(p) && p.name === n;
      const esClave = p && (ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === n;
      if (!esPropiedad && !esClave) vistos.add(n.text);
    }
    ts.forEachChild(n, mirar);
  })(nodo, sf);
  return vistos;
}

/**
 * El ámbito efectivo de la factura en ese fuente.
 *
 * @returns `{ texto, piezas, entrada }` — `texto` es lo que se compara (las piezas concatenadas en
 * orden ALFABÉTICO, para que reordenar el fichero no cuente como cambio), `piezas` los nombres.
 * Si no encuentra la entrada devuelve `{ texto: null }`: no se puede comparar el vacío en silencio.
 */
export function ambitoDeLaFactura(codigo, entrada = ENTRADA_FACTURA, ruta = 'pdf.service.ts') {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const decls = declaracionesDelModulo(sf);
  if (!decls.has(entrada)) return { texto: null, piezas: [], entrada };

  // Cierre transitivo desde la entrada. Cada pieza nueva aporta sus propias menciones.
  const dentro = new Set([entrada]);
  const cola = [entrada];
  while (cola.length) {
    const n = cola.pop();
    for (const id of identificadoresDe(decls.get(n), sf)) {
      if (decls.has(id) && !dentro.has(id)) { dentro.add(id); cola.push(id); }
    }
  }

  const piezas = [...dentro].sort();
  const texto = piezas.map((p) => decls.get(p).getFullText(sf)).join('\n');
  return { texto, piezas, entrada };
}
