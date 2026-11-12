// tests/scrum1588-alquiler-de-local-en-pantalla.test.mjs — SCRUM-1588, mitad de PANTALLA (S2)
//
// LA CATEGORÍA «alquiler» SE NOMBRA Y SE PINTA EN LA PANTALLA DE GASTOS.
//
// El defecto: `CATEGORY_LABELS` de `public/dashboard/js/expensesView.js` no conocía `alquiler`, así
// que un gasto de alquiler salía como «Otros» (la píldora y el KPI caen al comodín, SCRUM-944) y el
// formulario no ofrecía la opción. Sin ella el modelo 115 sale a cero en la práctica (SCRUM-1066e).
//
// El literal NO se redacta aquí: está FIRMADO en SCRUM-1066 c.20497 (23-oct-2026, regla 39):
// «Rótulo FIRMADO de la categoría (Javier: elige la A): «Alquiler de local».»
//
// ── CÓMO MIDE ──────────────────────────────────────────────────────────────────────────────────
// Por EFECTO: se sacan por AST `CATEGORY_LABELS`, `categoriaDe` y `catPill` de la vista, se ejecutan
// en una caja de arena y se lee lo que devuelven. Y en `styles.css` se lee la regla de la píldora.
//
// ── LO QUE NO MIDE ─────────────────────────────────────────────────────────────────────────────
//   · Que la ruta acepte `alquiler`: es la mitad del servidor (S1, `EXPENSE_CATEGORIES`). Hasta que
//     entre, guardar un gasto con esa categoría da `category_invalid`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/expensesView.js'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const TOKENS = fs.readFileSync(path.join(RAIZ, 'public/tokens.css'), 'utf8');

// La firma, copiada de c.20497. Es el único sitio de este fichero donde vive el literal.
const FIRMADO = 'Alquiler de local';

/** `CATEGORY_LABELS`, `categoriaDe` y `catPill`, tal cual están en la vista, ejecutados aparte. */
function piezas(fuente) {
  const sf = ts.createSourceFile('expensesView.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const trozos = {};
  sf.forEachChild((n) => {
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === 'CATEGORY_LABELS') trozos.CATEGORY_LABELS = n;
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name && ['categoriaDe', 'catPill'].includes(n.name.text)) trozos[n.name.text] = n;
  });
  for (const k of ['CATEGORY_LABELS', 'categoriaDe', 'catPill']) assert.ok(trozos[k], `🔴 no encuentro \`${k}\` en expensesView.js`);
  const codigo = ['CATEGORY_LABELS', 'categoriaDe', 'catPill'].map((k) => trozos[k].getText(sf)).join('\n');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${codigo}\nthis.r = { CATEGORY_LABELS, categoriaDe, catPill };`, ctx);
  return ctx.r;
}

const { CATEGORY_LABELS, categoriaDe, catPill } = piezas(VISTA);

/** El cuerpo de la regla `selector { … }` de la hoja, o `null`. */
function regla(css, selector) {
  const i = css.indexOf(`${selector} {`);
  if (i === -1) return null;
  return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)).trim();
}

test('① un gasto de alquiler se nombra «Alquiler de local» (c.20497), no «Otros»', () => {
  assert.deepEqual({ ...categoriaDe('alquiler') }, { clave: 'alquiler', label: FIRMADO });
  assert.equal(catPill('alquiler'), `<span class="gasto-cat gasto-cat--alquiler">${FIRMADO}</span>`);
});

test('② el formulario lo ofrece: está en el mapa del que salen las opciones, antes del comodín', () => {
  const claves = Object.keys(CATEGORY_LABELS);
  assert.ok(claves.includes('alquiler'), '🔴 `alquiler` no está en CATEGORY_LABELS: el formulario no lo ofrece');
  assert.equal(claves[claves.length - 1], 'otros', '🔴 «Otros» ha dejado de ser la última opción');
});

test('③ control: las demás categorías y el comodín no cambian', () => {
  assert.deepEqual({ ...categoriaDe('subcontrata') }, { clave: 'subcontrata', label: 'Subcontrata' });
  assert.deepEqual({ ...categoriaDe('otros') }, { clave: 'otros', label: 'Otros' });
  assert.deepEqual({ ...categoriaDe('nave') }, { clave: 'otros', label: 'Otros' },
    'una clave que no existe sigue cayendo a «Otros»');
});

test('④ la píldora tiene su color, y sale de tokens que existen (DESIGN.md: nada inventado)', () => {
  const cuerpo = regla(CSS, '.gasto-cat--alquiler');
  assert.ok(cuerpo, '🔴 no hay regla `.gasto-cat--alquiler`: la píldora sale sin color');
  assert.match(cuerpo, /background:\s*var\(--brand-tint\)/);
  assert.match(cuerpo, /color:\s*var\(--brand-tint-ink\)/);
  // Control de que los tokens existen: un `var()` de un token que no está no pinta nada.
  assert.match(TOKENS, /--brand-tint:\s*#ecfdf5/);
  assert.match(TOKENS, /--brand-tint-ink:\s*#047857/);
});
