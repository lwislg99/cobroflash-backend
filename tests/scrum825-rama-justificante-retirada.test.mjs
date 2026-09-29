// tests/scrum825-rama-justificante-retirada.test.mjs — SCRUM-825 D1 (panel)
//
// LA RAMA «JUSTIFICANTE» DEL PANEL SE RETIRA. Firma del fundador: SCRUM-825 comentario 17446 («1-Sí a
// las 3»), con los rótulos según el censo de SCRUM-1257 y no según la tabla del 8-sep.
//
// Desde SCRUM-1027 `modoDocumentoSuelto` solo devuelve 'factura' o 'no', así que la rama que el panel
// abría con `appDocumentoSuelto === 'justificante'` no la veía nadie: el GRUPO A del censo, ocho
// rótulos. Se borra la rama y queda el lado «factura», que ya estaba aprobado y ya se pintaba.
//
// Lo que vigila este fichero:
//   1. que los ocho rótulos muertos no vuelvan como literales del panel;
//   2. que nadie vuelva a preguntar `=== 'justificante'` por el modo del documento suelto;
//   3. que un 'justificante' que llegara del servidor caiga a 'no' (fallar cerrado) y no a «factura».
//
// ⛔ NO vigila, a propósito, los rótulos de los documentos `J-` antiguos (grupo D: la ficha, el chip,
// la ficha del trabajo, el correo de Cobros). Esos se ven con documentos ya emitidos, no se renombran
// (reglas 7 y 29) y se deciden en SCRUM-1252. Por eso se mira la población de ocho, no la palabra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = (f) => path.join(RAIZ, 'public/dashboard/js', f);

/** Los ocho del grupo A del censo de SCRUM-1257, con el fichero donde vivían. */
const GRUPO_A = [
  ['rotulosDelDocumento.js', 'Justificantes'],
  ['rotulosDelDocumento.js', 'Nº justificante'],
  ['rotulosDelDocumento.js', 'Nuevo justificante'],
  ['rotulosDelDocumento.js', 'Emitir justificante'],
  ['rotulosDelDocumento.js', 'Justificante emitido'],
  ['rotulosDelDocumento.js', 'No hemos podido emitir el justificante. Inténtalo otra vez.'],
  ['invoicesView.js', '+ Nuevo justificante'],
  ['quotesView.js', '¿Para quién es el justificante?'],
];

function arbol(fichero) {
  return ts.createSourceFile(fichero, fs.readFileSync(JS(fichero), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/** Los literales de un fichero: el código cita el texto viejo en comentarios, con su motivo. */
function literales(fichero) {
  const sf = arbol(fichero);
  const out = new Set();
  (function v(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.add(n.text);
    ts.forEachChild(n, v);
  })(sf);
  return out;
}

test('SCRUM-825 · los ocho rótulos de la rama muerta ya no son literales del panel', () => {
  const siguen = GRUPO_A.filter(([f, t]) => literales(f).has(t)).map(([f, t]) => `${f}: «${t}»`);
  assert.deepEqual(siguen, [], `🔴 siguen en el panel:\n  ${siguen.join('\n  ')}`);
});

test('SCRUM-825 · control: el detector SÍ ve un literal que sigue, y lo distingue de un comentario', () => {
  assert.ok(literales('rotulosDelDocumento.js').has('Nueva factura'),
    '🔴 el detector no ve el lado factura: la negación de arriba no probaría nada');
  const sf = ts.createSourceFile('x.js', "// 'Justificantes'\nconst a = 'Facturas';", ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const vistos = [];
  (function v(n) { if (ts.isStringLiteral(n)) vistos.push(n.text); ts.forEachChild(n, v); })(sf);
  assert.deepEqual(vistos, ['Facturas']);
});

test('SCRUM-825 · nadie pregunta ya si el documento suelto es un justificante', () => {
  const con = [];
  for (const f of fs.readdirSync(path.join(RAIZ, 'public/dashboard/js')).filter((x) => x.endsWith('.js'))) {
    const sf = arbol(f);
    (function v(n) {
      if (ts.isBinaryExpression(n) && /^={2,3}$/.test(n.operatorToken.getText(sf))) {
        const lados = [n.left.getText(sf), n.right.getText(sf)];
        if (lados.some((l) => /appDocumentoSuelto/.test(l)) && lados.some((l) => /^['"]justificante['"]$/.test(l))) {
          con.push(`${f}: ${n.getText(sf)}`);
        }
      }
      ts.forEachChild(n, v);
    })(sf);
  }
  assert.deepEqual(con, [], `🔴 vuelve a haber una rama por modo justificante:\n  ${con.join('\n  ')}`);
  assert.equal(typeof ejecutarRotulos('justificante').esJustificante, 'undefined',
    '🔴 `rotulosDelDocumento.esJustificante()` sigue existiendo: el predicado de la rama muerta');
});

/** Ejecuta la fuente de rótulos con un `window` de mentira, como `scrum776`. */
function ejecutarRotulos(documentoSuelto) {
  const ventana = { appDocumentoSuelto: documentoSuelto };
  new Function('window', fs.readFileSync(JS('rotulosDelDocumento.js'), 'utf8'))(ventana);
  return ventana.rotulosDelDocumento;
}

test('SCRUM-825 · con cualquier valor, los rótulos dicen «factura»', () => {
  for (const modo of ['factura', 'justificante', 'no', undefined]) {
    const r = ejecutarRotulos(modo);
    assert.equal(r.tituloListado(), 'Facturas', `🔴 con ${JSON.stringify(modo)} el listado no dice «Facturas»`);
    assert.equal(r.avisoEmitido(), 'Factura emitida');
  }
});

test('SCRUM-825 · un «justificante» que llegara del servidor cae a «no», no a «factura»', () => {
  // Se EJECUTA la línea real de `app.js` que normaliza el valor, extraída por AST.
  const sf = arbol('app.js');
  let asignacion = null;
  (function v(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && n.left.getText(sf) === 'window.appDocumentoSuelto') asignacion = n.right.getText(sf);
    ts.forEachChild(n, v);
  })(sf);
  assert.ok(asignacion, '🔴 no encuentro la asignación de window.appDocumentoSuelto en app.js');
  const normaliza = new Function('me', `return (${asignacion});`);
  assert.equal(normaliza({ documentoSuelto: 'factura' }), 'factura');
  for (const v of ['justificante', 'no', undefined, 'JUSTIFICANTE']) {
    assert.equal(normaliza({ documentoSuelto: v }), 'no',
      `🔴 ${JSON.stringify(v)} no cae a 'no': el botón de crear se pintaría con un valor fuera del contrato`);
  }
});
