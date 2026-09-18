// tests/scrum915d-pasos-del-editor.test.mjs — SCRUM-915d · la red de Node de los PASOS del editor.
//
// Lo que se JUZGA de verdad (qué se ve después de pulsar) sólo existe con el CSS resuelto y lo mide
// `npm run guard:pasos-del-editor` en navegador. Esto vigila, en cada `npm test`, el MECANISMO que
// hace que los pasos no puedan perder nada:
//
//   ① los pasos SON los bloques de SCRUM-286 (clase más), en el orden de la v3, con los totales
//     detrás de las líneas;
//   ② abrir y cerrar un paso NO MUEVE NODOS: las funciones de control no insertan, no quitan y no
//     reescriben HTML. Un paso cerrado sigue teniendo sus campos en el DOM, y por eso se envían;
//   ③ «Continuar» de Conceptos y «Generar» usan la MISMA regla de línea válida;
//   ④ montado en el banco: al entrar se abre el paso Cliente, «Continuar» está deshabilitado sin
//     cliente y habilitado con él, y al pulsarlo se abre Conceptos.
//
// Cada comprobación lleva su mutación en rojo sobre la fuente REAL, en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { derivarOrdenDePintado } from './_orden-pintado-presupuesto.mjs';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = 'public/dashboard/js/quotesView.js';
const FUENTE = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');

function mutar(buscar, poner) {
  assert.ok(FUENTE.includes(buscar), `🔴 el patrón a mutar ya no existe: ${buscar}`);
  const m = FUENTE.replace(buscar, poner);
  assert.notEqual(m, FUENTE, 'la mutación no cambió nada');
  return m;
}

// ── ① los pasos son los bloques ──────────────────────────────────────────────────────────────
const ORDEN_V3 = ['blockClient', 'blockLines', 'blockTotals', 'blockConditions', 'blockDelivery', 'kpiBox', 'blockActions'];

function ordenDeBloques(fuente) {
  const p = derivarOrdenDePintado(fuente, 'quotesView.js');
  return { raiz: p.raiz, bloques: p.orden.filter((n) => n.esBloque).map((n) => ({ nombre: n.nombre, clase: n.clase })) };
}

test('SCRUM-915d · ① los pasos son los bloques de siempre, en el orden de la v3', () => {
  const o = ordenDeBloques(FUENTE);
  assert.equal(o.raiz, 'leftCard', '🔴 SUELO: el censo de orden no encuentra el formulario');
  assert.deepEqual(o.bloques.map((b) => b.nombre), ORDEN_V3,
    '🔴 el orden de los bloques no es el de los pasos: Cliente · Conceptos (líneas + totales) · '
    + 'Condiciones (+ Ajustes) · total · Revisar');
  const clase = (n) => o.bloques.find((b) => b.nombre === n).clase.split(/\s+/);
  for (const n of ['blockClient', 'blockLines', 'blockConditions', 'blockActions']) {
    assert.ok(clase(n).includes('quote-paso'), `🔴 \`${n}\` no es un paso (le falta \`quote-paso\`)`);
  }
  for (const n of ['blockTotals', 'blockDelivery']) {
    assert.ok(clase(n).includes('quote-paso-parte'), `🔴 \`${n}\` no es la segunda mitad de su paso`);
  }
});

test('SCRUM-915d · ① ROJO: si los totales vuelven detrás de Condiciones, cae', () => {
  const m = mutar('  leftCard.appendChild(blockTotals);\n', '');
  const conTotalesAlFinal = m.replace('  // ---------- BLOQUE C: TOTALES ----------\n',
    '  // ---------- BLOQUE C: TOTALES ----------\n  leftCard.appendChild(blockTotals);\n');
  assert.notDeepEqual(ordenDeBloques(conTotalesAlFinal).bloques.map((b) => b.nombre), ORDEN_V3);
});

// ── ② abrir y cerrar no mueve nodos ──────────────────────────────────────────────────────────
const CONTROL = ['refrescarPasos', 'pintarFilas', 'abrirPaso'];
const QUE_MUEVE = new Set(['appendChild', 'insertBefore', 'prepend', 'append', 'remove', 'removeChild',
  'replaceChildren', 'replaceWith', 'insertAdjacentElement', 'insertAdjacentHTML']);

function queMueveElControl(fuente) {
  const sf = ts.createSourceFile('quotesView.js', fuente, ts.ScriptTarget.Latest, true);
  const hallados = [];
  const vistas = new Set();
  const dentro = (n, nombre) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && QUE_MUEVE.has(n.expression.name.text)) {
      hallados.push(`${nombre}: .${n.expression.name.text}()`);
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && ['innerHTML', 'outerHTML'].includes(n.left.name.text)) {
      hallados.push(`${nombre}: .${n.left.name.text} =`);
    }
    n.forEachChild((h) => dentro(h, nombre));
  };
  const buscar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && CONTROL.includes(n.name.text)) { vistas.add(n.name.text); dentro(n.body, n.name.text); }
    n.forEachChild(buscar);
  };
  buscar(sf);
  return { hallados, vistas: [...vistas].sort() };
}

test('SCRUM-915d · ② abrir y cerrar un paso NO mueve, quita ni reescribe nodos', () => {
  const r = queMueveElControl(FUENTE);
  assert.deepEqual(r.vistas, [...CONTROL].sort(), '🔴 SUELO: no encuentro las funciones de control de los pasos');
  assert.deepEqual(r.hallados, [],
    '🔴 el control de los pasos MUEVE NODOS. Un campo que se mueve al abrir un paso es un campo que '
    + 'se puede perder por el camino; lo que se ve lo decide la hoja de estilos:\n  ' + r.hallados.join('\n  '));
});

test('SCRUM-915d · ② ROJO: si el control mete un appendChild, cae nombrándolo', () => {
  const m = mutar('    pasoAbierto = destino;\n', '    pasoAbierto = destino;\n    leftCard.appendChild(blockActions);\n');
  assert.deepEqual(queMueveElControl(m).hallados, ['abrirPaso: .appendChild()']);
});

// ── ③ una sola regla de línea válida ─────────────────────────────────────────────────────────
test('SCRUM-915d · ③ «Continuar» de Conceptos y «Generar» usan la MISMA regla de línea', () => {
  const usos = FUENTE.split('lineaValidaParaGenerar').length - 1;
  assert.ok(usos >= 3, `🔴 la regla aparece ${usos} veces: tiene que estar definida y usada por los dos`);
  assert.ok(FUENTE.includes('if (!lineaValidaParaGenerar(line)) {'), '🔴 «Generar» ya no usa la regla compartida');
  assert.ok(FUENTE.includes('lines.filter(lineaValidaParaGenerar)'), '🔴 el paso Conceptos ya no usa la regla compartida');
  assert.equal(FUENTE.split('if (!concept || safeQty <= 0 || safePrice < 0) {').length - 1, 0,
    '🔴 «Generar» ha vuelto a llevar su propia copia de la regla');
});

// ── ④ montado en el banco ────────────────────────────────────────────────────────────────────
const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001' };

async function montar(fuente = null) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'QA 915', defaultCurrency: 'EUR' };
      if (/\/admin\/customers/.test(u)) return [CLIENTE];
      return datosDeMuestra(u);
    },
  });
  if (fuente) {
    vm.runInContext(`(function () {\n${fuente}\n;globalThis.renderQuotesView = renderQuotesView;\n})();`,
      banco.ctx, { filename: 'js/quotesView.js' });
  }
  const r = await pintarVista(banco, 'renderQuotesView');
  await new Promise((ok) => setTimeout(ok, 0));
  return r;
}
const clases = (n) => String(n.className || '').split(/\s+/);
const bloqueConTitulo = (c, t) => {
  const h = todos(c).find((n) => n.tagName === 'H3' && String(n.textContent || '').trim() === t);
  return h ? h._padre : null;
};
const continuar = (c) => todos(c).filter((n) => n.tagName === 'BUTTON' && String(n.textContent || '').trim() === 'Continuar');

test('SCRUM-915d · ④ en el banco: un paso abierto, «Continuar» sólo con cliente, y abre Conceptos', async () => {
  const r = await montar();
  assert.equal(r.error, null, `🔴 el editor no monta: ${r.error && r.error.message}`);
  const cliente = bloqueConTitulo(r.contenedor, 'Cliente');
  const conceptos = bloqueConTitulo(r.contenedor, 'Conceptos');
  assert.ok(cliente && conceptos, '🔴 SUELO: no encuentro los pasos Cliente y Conceptos');
  assert.ok(clases(cliente).includes('is-abierto') && clases(conceptos).includes('is-cerrado'),
    '🔴 al entrar tiene que estar abierto el paso Cliente y cerrado el de Conceptos');
  const [seguir] = continuar(r.contenedor);
  assert.equal(seguir.disabled, true, '🔴 «Continuar» está habilitado sin cliente');
  const sel = todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.name === 'customer_id');
  sel.value = String(CLIENTE.id);
  sel.disparar('change');
  assert.equal(seguir.disabled, false, '🔴 con cliente, «Continuar» sigue deshabilitado');
  assert.equal(seguir.disparar('click'), 1, '🔴 «Continuar» no tiene oyente');
  assert.ok(clases(conceptos).includes('is-abierto') && clases(cliente).includes('is-cerrado'),
    '🔴 «Continuar» no abrió Conceptos');
});

test('SCRUM-915d · ④ ROJO: si «Continuar» no mirase al cliente, cae', async () => {
  const r = await montar(mutar('      puede: function () { return !!clienteElegido(); },', '      puede: function () { return true; },'));
  const [seguir] = continuar(r.contenedor);
  assert.equal(seguir.disabled, false, 'la mutación tenía que dejar «Continuar» habilitado sin cliente');
});
