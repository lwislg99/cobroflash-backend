// tests/scrum1257e-modo-en-ajustes-tres-modos.test.mjs — SCRUM-1257e
//
// Sin gate: ni BD, ni red, ni navegador. Pinta `renderSettingsView` en el banco de vistas de la casa
// (`_banco-vistas.mjs`) con `window.appModoEmision` en cada uno de los tres modos y sin modo.
//
// LA FILA DEL MODO EN `Configuración › Cumplimiento` DICE, LITERAL, EL MODO EN EL QUE ESTÁ EL COMERCIO.
// La de `receipt` —«Por ahora, YaQu no genera facturas desde tu cuenta.»— es lo que lee un profesional
// español que no puede facturar con YaQu (regla 24). Si en `receipt` no sale, no se entera de por qué.
//
// El contraste ES la medición: cada modo pinta SU frase y SU rótulo, carácter a carácter (`===`, nunca
// subcadena) contra los literales de `settingsView.js` sacados por AST, y no casa con los de los otros
// dos. Un instrumento que pasara con la misma frase en los tres modos no estaría midiendo el modo.
//
// Esto es la red que bloquea: corre en la tanda. La medición en un navegador de verdad (CSS resuelto,
// alto en píxeles, submenú abierto) es `scripts/guard-modo-en-ajustes.mjs`, en el job de navegador.
// Las dos se tumban con las MISMAS mutaciones (abajo), y el guion que lo enseña en navegador es
// `docs/master/evidencias/SCRUM-1257e/mutar.mjs`.
//
// ⚠️ Prueba el CÓDIGO con el modo puesto a mano, no la pantalla de ningún comercio: no se ha visto en
// producción, donde hoy ningún comercio está en `receipt` (registro en `docs/master/SCRUM-1257.md`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = path.join(RAIZ, 'public/dashboard/js/settingsView.js');
const MODOS = ['fiscal', 'demo', 'receipt'];

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · todos los modos pintan la frase de receipt: el contraste tiene que verlo en los otros dos.
    fichero: 'public/dashboard/js/settingsView.js',
    de: 'detalle.textContent = DETALLE_MODO_EMISION[window.appModoEmision] || PENDIENTE_MODO_EMISION;',
    a: 'detalle.textContent = DETALLE_MODO_EMISION.receipt;',
    cae: 'en fiscal Ajustes pinta su frase y no la de receipt',
  },
  {
    // M2 · en receipt no se pinta la fila: el profesional no ve en qué modo está.
    fichero: 'public/dashboard/js/settingsView.js',
    de: 'if (window.appModoEmision) {\n      const fila',
    a: 'if (window.appModoEmision && window.appModoEmision !== "receipt") {\n      const fila',
    cae: 'en receipt Ajustes pinta la frase de receipt, literal',
  },
  {
    // M3 · en receipt la frase pierde el punto final: un PREFIJO no es el literal.
    fichero: 'public/dashboard/js/settingsView.js',
    de: 'detalle.textContent = DETALLE_MODO_EMISION[window.appModoEmision] || PENDIENTE_MODO_EMISION;',
    // Un solo literal: el lector del meta-guard no ve una `a` concatenada (la descarta en silencio).
    a: 'detalle.textContent = DETALLE_MODO_EMISION[window.appModoEmision] || PENDIENTE_MODO_EMISION; if (window.appModoEmision === "receipt") detalle.textContent = detalle.textContent.slice(0, -1);',
    cae: 'en receipt Ajustes pinta la frase de receipt, literal',
  },
  {
    // M4 · la fila se pinta y se borra después: el fallo del 13-ago-2026 (SCRUM-515), con otra cara.
    fichero: 'public/dashboard/js/settingsView.js',
    de: 'panelDeSuperficie("modoEmision").appendChild(fila);',
    a: 'panelDeSuperficie("modoEmision").appendChild(fila); setTimeout(() => fila.remove(), 100);',
    cae: 'en receipt Ajustes pinta la frase de receipt, literal',
  },
];

function objetoLiteral(fuente, nombre) {
  const sf = ts.createSourceFile('settingsView.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let hallado = null;
  (function v(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === nombre
      && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      hallado = {};
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) hallado[p.name.getText(sf)] = p.initializer.text;
      }
    }
    ts.forEachChild(n, v);
  })(sf);
  return hallado;
}

const fuente = fs.readFileSync(FUENTE, 'utf8');
const TITULO = objetoLiteral(fuente, 'TITULO_MODO_EMISION') || {};
const DETALLE = objetoLiteral(fuente, 'DETALLE_MODO_EMISION') || {};

/** Pinta Ajustes con el modo dado y lee la fila DESPUÉS de dejar correr lo asíncrono. */
async function medir(modo) {
  const banco = cargarDashboard(RAIZ, { datos: (url) => (/\/admin\/(merchant|me)\b/.test(String(url)) ? { country: 'ES' } : []) });
  banco.ctx.appModoEmision = modo;
  const r = await pintarVista(banco, 'renderSettingsView');
  assert.ok(!r.error, `CIEGO: la vista revienta con modo=${modo}: ${r.error && r.error.message}`);
  // Más que los 100 ms de M4: lo que se borra después del render tiene que haberse borrado ya.
  await new Promise((ok) => setTimeout(ok, 250));
  const arbol = todos(banco.ctx.document.body);
  const submenus = arbol.filter((n) => n.dataset && n.dataset.submenu).length;
  assert.ok(submenus > 0, `CIEGO: Ajustes no pintó ningún submenú con modo=${modo}`);
  const filas = arbol.filter((n) => n.className === 'settings-modo-emision');
  const fila = filas[0];
  const hijos = fila ? todos(fila) : [];
  const pill = hijos.find((n) => n.className === 'status-pill');
  const p = hijos.find((n) => n.tagName === 'P');
  return {
    filas: filas.length,
    titulo: pill ? pill.textContent : null,
    detalle: p ? p.textContent : null,
    todos: arbol.map((n) => String(n.textContent || '')),
  };
}

/** Los modos cuyo literal casa EXACTAMENTE con un texto. */
const casan = (obj, texto) => MODOS.filter((m) => obj[m] === texto);

async function suFraseYNoLaDeOtro(modo) {
  const r = await medir(modo);
  assert.equal(r.filas, 1, `🔴 con modo=${modo} hay ${r.filas} filas de modo en Ajustes, y tiene que haber UNA`);
  assert.equal(r.detalle, DETALLE[modo], `🔴 con modo=${modo} la frase pintada no es, carácter a carácter, la del fuente`);
  assert.deepEqual(casan(DETALLE, r.detalle), [modo], `🔴 con modo=${modo} la frase casa con otro modo`);
  assert.equal(r.titulo, TITULO[modo], `🔴 con modo=${modo} el rótulo pintado no es el del fuente`);
  assert.deepEqual(casan(TITULO, r.titulo), [modo], `🔴 con modo=${modo} el rótulo casa con otro modo`);
  for (const otro of MODOS.filter((m) => m !== modo)) {
    assert.ok(!r.todos.includes(DETALLE[otro]), `🔴 con modo=${modo} sale en Ajustes la frase del modo ${otro}: ${JSON.stringify(DETALLE[otro])}`);
  }
}

test('SCRUM-1257e · SUELO: los tres literales salen del fuente por AST, con texto y distintos entre sí', () => {
  for (const [nombre, obj] of [['TITULO_MODO_EMISION', TITULO], ['DETALLE_MODO_EMISION', DETALLE]]) {
    for (const m of MODOS) assert.ok(typeof obj[m] === 'string' && obj[m].trim(), `${nombre}.${m} no es un literal con texto`);
    assert.equal(new Set(MODOS.map((m) => obj[m])).size, MODOS.length,
      `${nombre} repite literal entre modos: el contraste no podría distinguirlos`);
  }
});

test('SCRUM-1257e · SUELO: la comparación rechaza un prefijo y una superstring del literal', () => {
  for (const m of MODOS) {
    assert.deepEqual(casan(DETALLE, DETALLE[m].slice(0, -1)), [], `un prefijo de ${m} no puede casar`);
    assert.deepEqual(casan(DETALLE, DETALLE[m] + '.'), [], `una superstring de ${m} no puede casar`);
  }
});

test('SCRUM-1257e · en receipt Ajustes pinta la frase de receipt, literal', () => suFraseYNoLaDeOtro('receipt'));
test('SCRUM-1257e · en fiscal Ajustes pinta su frase y no la de receipt', () => suFraseYNoLaDeOtro('fiscal'));
test('SCRUM-1257e · en demo Ajustes pinta su frase y no la de receipt', () => suFraseYNoLaDeOtro('demo'));

test('SCRUM-1257e · sin modo no se pinta ninguna fila ni ninguna de las tres frases', async () => {
  const r = await medir(null);
  assert.equal(r.filas, 0, '🔴 sin modo se pinta una fila de modo: es inventarse el estado fiscal de alguien');
  for (const m of MODOS) assert.ok(!r.todos.includes(DETALLE[m]), `🔴 sin modo sale la frase de ${m}`);
});

test('SCRUM-1257e · el guard de navegador está declarado y la puerta de navegador lo recoge', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['guard:modo-en-ajustes'], 'node scripts/guard-modo-en-ajustes.mjs');
  assert.match(String(pkg.scripts['//guard:modo-en-ajustes'] || ''), /navegador/i,
    'sin «navegador» en su nota, `guards:visuales` no lo corre en CI');
  assert.ok(fs.existsSync(path.join(RAIZ, 'scripts/guard-modo-en-ajustes.mjs')));
});
