// tests/scrum1618-fecha-de-cobro-en-el-panel.test.mjs — SCRUM-1618
//
// EL PANEL DEJA DECIR CUÁNDO SE COBRÓ, Y SIN FECHA EL CUERPO ES EL DE SIEMPRE.
//
// El servidor ya aceptaba `paidAt` en el lote (SCRUM-397) y de una en una (SCRUM-1609), y ninguna
// pantalla lo mandaba: `invoicesView.js` enviaba `{ ids }` y la ficha `{ status }`. El cobro del
// 31 de marzo conciliado el 2 de abril quedaba en abril.
//
// ⚠️ LOS DOS LADOS SON EL TEST. Que `paidAt` viaje con fecha no dice nada si también viaja sin
// ella: un `paidAt: null` en cada marcado sería un cuerpo DISTINTO del de hoy. Por eso ① y ② van
// juntos, y ③/④ miran que los dos botones usan de verdad la pieza (por AST, no por la palabra:
// el comentario que la explica mantendría la palabra viva aunque la llamada se fuera).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'public/dashboard/js/invoicesView.js', de: 'if (f) cuerpo.paidAt = f;',
    a: 'cuerpo.paidAt = f;', cae: 'SCRUM-1618 · ① sin fecha' },
  { fichero: 'public/dashboard/js/invoicesView.js',
    de: 'JSON.stringify(cuerpoConFechaDeCobro({ ids }, bulkFechaCobro))',
    a: 'JSON.stringify({ ids })', cae: 'SCRUM-1618 · ③ el lote' },
  { fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: 'cuerpo = window.cuerpoConFechaDeCobro(cuerpo, inpFechaCobro);',
    a: 'cuerpo = cuerpo;', cae: 'SCRUM-1618 · ④ la ficha' },
];

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_LISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoicesView.js');
const F_FICHA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoiceDetailView.js');
const pieza = createRequire(import.meta.url)(F_LISTA);
const { cuerpoConFechaDeCobro } = pieza;

const campo = (value) => ({ value });

function ast(fichero) {
  return ts.createSourceFile(fichero, fs.readFileSync(fichero, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}
function recorrer(nodo, f) { f(nodo); ts.forEachChild(nodo, (h) => recorrer(h, f)); }
const nombreDe = (expr) => (ts.isIdentifier(expr) ? expr.text
  : ts.isPropertyAccessExpression(expr) ? expr.name.text : null);
function funcionQueEnvuelve(n) {
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p;
  return null;
}
/** El argumento `body` del objeto de opciones de una llamada `fetch(…)`/`apiRequest(…)`. */
function cuerpoDeLaLlamada(call) {
  const opts = call.arguments[1];
  if (!opts || !ts.isObjectLiteralExpression(opts)) return null;
  const p = opts.properties.find((x) => x.name && x.name.text === 'body');
  return p && ts.isPropertyAssignment(p) ? p.initializer : null;
}
function llamadasA(sf, nombre, rutaContiene) {
  const out = [];
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || nombreDe(n.expression) !== nombre) return;
    const a0 = n.arguments[0];
    if (a0 && a0.getText(sf).includes(rutaContiene)) out.push(n);
  });
  return out;
}

// ── ① 🔴 SIN FECHA, EL CUERPO ES EL DE HOY, BYTE A BYTE ─────────────────────────────────────

test('SCRUM-1618 · ① sin fecha, el cuerpo que se manda es IDÉNTICO al de hoy (sin `paidAt`)', () => {
  for (const base of [{ ids: [4, 9] }, { status: 'paid' }, { status: 'paid', paidVia: 'bizum_manual' }]) {
    for (const input of [campo(''), campo('   '), null, undefined]) {
      const c = cuerpoConFechaDeCobro(base, input);
      assert.equal(JSON.stringify(c), JSON.stringify(base),
        `🔴 con el campo vacío (${JSON.stringify(input)}) el cuerpo cambia: ${JSON.stringify(c)}`);
      assert.equal(Object.prototype.hasOwnProperty.call(c, 'paidAt'), false,
        '🔴 viaja `paidAt` sin que el profesional haya dicho ninguna fecha');
    }
  }
  const base = { ids: [1] };
  cuerpoConFechaDeCobro(base, campo('2026-03-31'));
  assert.deepEqual(base, { ids: [1] }, '🔴 la pieza modifica el cuerpo que recibe');
});

// ── ② CON FECHA, VIAJA ESA FECHA ────────────────────────────────────────────────────────────

test('SCRUM-1618 · ② con fecha, viaja como `paidAt` sin tocar lo demás', () => {
  assert.deepEqual(cuerpoConFechaDeCobro({ ids: [4, 9] }, campo('2026-03-31')),
    { ids: [4, 9], paidAt: '2026-03-31' });
  assert.deepEqual(cuerpoConFechaDeCobro({ status: 'paid', paidVia: 'transferencia' }, campo('2026-03-31')),
    { status: 'paid', paidVia: 'transferencia', paidAt: '2026-03-31' });
});

// ── ③ / ④ LOS DOS BOTONES USAN LA PIEZA (AST) ───────────────────────────────────────────────

test('SCRUM-1618 · ③ el lote manda su cuerpo POR la pieza, con el campo del lote', () => {
  const sf = ast(F_LISTA);
  const llamadas = llamadasA(sf, 'apiRequest', '/admin/invoices/bulk-paid');
  assert.equal(llamadas.length, 1, `🔴 esperaba UNA llamada a bulk-paid; hay ${llamadas.length}`);
  const body = cuerpoDeLaLlamada(llamadas[0]);
  assert.ok(body && ts.isCallExpression(body) && body.expression.getText(sf) === 'JSON.stringify',
    '🔴 el body de bulk-paid no es un JSON.stringify(…)');
  const dentro = body.arguments[0];
  assert.ok(ts.isCallExpression(dentro) && nombreDe(dentro.expression) === 'cuerpoConFechaDeCobro',
    `🔴 el lote manda \`${dentro.getText(sf)}\` sin pasar por cuerpoConFechaDeCobro: la fecha no viaja`);
  assert.equal(dentro.arguments[1] && dentro.arguments[1].getText(sf), 'bulkFechaCobro',
    '🔴 el lote lee la fecha de otro sitio que no es su campo');
  let pinta = 0;
  recorrer(sf, (n) => { if (ts.isCallExpression(n) && nombreDe(n.expression) === 'pintarFechaDeCobro') pinta++; });
  assert.equal(pinta, 1, '🔴 la barra del lote no pinta el campo de fecha');
});

test('SCRUM-1618 · ④ la ficha pasa su cuerpo POR la pieza antes del PUT', () => {
  const sf = ast(F_FICHA);
  const puts = llamadasA(sf, 'fetch', '/status');
  assert.equal(puts.length, 1, `🔴 esperaba UN fetch a …/status; hay ${puts.length}`);
  const body = cuerpoDeLaLlamada(puts[0]);
  assert.ok(body && ts.isCallExpression(body) && body.arguments[0] && ts.isIdentifier(body.arguments[0]),
    '🔴 el body del PUT ya no es JSON.stringify(<variable>)');
  const variable = body.arguments[0].text;
  const fn = funcionQueEnvuelve(puts[0]);
  let asignada = null;
  recorrer(fn, (n) => {
    if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
    if (!ts.isIdentifier(n.left) || n.left.text !== variable || !ts.isCallExpression(n.right)) return;
    if (nombreDe(n.right.expression) !== 'cuerpoConFechaDeCobro') return;
    if (n.right.arguments[0]?.getText(sf) === variable && n.right.arguments[1]?.getText(sf) === 'inpFechaCobro'
      && n.pos < puts[0].pos) asignada = n;
  });
  assert.ok(asignada,
    `🔴 \`${variable}\` llega al PUT sin pasar por cuerpoConFechaDeCobro(${variable}, inpFechaCobro): la fecha no viaja`);
  let pinta = 0;
  recorrer(sf, (n) => { if (ts.isCallExpression(n) && nombreDe(n.expression) === 'pintarFechaDeCobro') pinta++; });
  assert.equal(pinta, 1, '🔴 la ficha no pinta el campo de fecha');
});
