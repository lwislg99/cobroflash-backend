// tests/_censo-redes-benignas.mjs — SCRUM-622
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS REDES QUE CONVIERTEN «NO LO SÉ» EN «TODO BIEN»
//
// Busca expresiones cuyo lado por defecto es el estado MÁS BENIGNO: `x || META.verde`,
// `x ?? 'verde'`, `cond ? a : 'verde'`, `default: return 'verde'`. Es el defecto número uno de
// la casa —una protección que produce verdes falsos— con la particularidad de que aquí el verde
// se lo enseña al profesional un semáforo de PLAZO LEGAL.
//
// 🔴 POR AST, Y NO ES PREFERENCIA: `tipoDestinatarioPendiente.js` contiene literalmente
// `|| SEMAFORO_META.verde` DENTRO DE UN COMENTARIO —el que anota este mismo ticket—, y un `grep`
// lo contaría como si fuera código. Con AST los comentarios quedan fuera POR CONSTRUCCIÓN.
// ─────────────────────────────────────────────────────────────────────────────────────────
import ts from 'typescript';

/** Nombres que significan «el estado bueno». No incluye `rojo`/`error`: ésos NO son la trampa. */
const BENIGNO = /^(verde|green|ok|al_dia|aldia)$/i;

function esBenigno(n) {
  if (ts.isStringLiteralLike(n)) return BENIGNO.test(n.text);
  if (ts.isPropertyAccessExpression(n)) return BENIGNO.test(n.name.text);
  if (ts.isElementAccessExpression(n) && n.argumentExpression
      && ts.isStringLiteralLike(n.argumentExpression)) return BENIGNO.test(n.argumentExpression.text);
  return false;
}

/**
 * @returns {{linea:number, forma:string, texto:string}[]} una entrada por red encontrada.
 */
export function redesBenignas(fuente, nombre = 'x.js') {
  const kind = nombre.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const corto = (n) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 78);
  (function rec(n) {
    if (ts.isBinaryExpression(n)
        && (n.operatorToken.kind === ts.SyntaxKind.BarBarToken
            || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
        && esBenigno(n.right)) {
      out.push({ linea: linea(n), forma: n.operatorToken.kind === ts.SyntaxKind.BarBarToken ? '||' : '??', texto: corto(n) });
    }
    if (ts.isConditionalExpression(n) && esBenigno(n.whenFalse)) {
      out.push({ linea: linea(n), forma: '?:', texto: corto(n) });
    }
    if (ts.isDefaultClause(n)) {
      for (const st of n.statements) {
        if (ts.isReturnStatement(st) && st.expression && esBenigno(st.expression)) {
          out.push({ linea: linea(st), forma: 'default:', texto: corto(st) });
        }
      }
    }
    ts.forEachChild(n, rec);
  })(sf);
  return out;
}
