// tests/scrum1783b-sin-selector-recargo.test.mjs — SCRUM-1783b (J2)
//
// EL SELECTOR DEL RECARGO DE EQUIVALENCIA SALE DE LA FICHA DEL CLIENTE. EL DATO GUARDADO, NO.
//
// Decisión del fundador, SCRUM-1783 c.22264 («1-Ok lo recomendado»): ① se quita el selector de la
// ficha (`customersView.js`); ② la columna `Customer.recargo_equivalencia` y lo que acepta la API se
// QUEDAN. Autorización de los guards, c.22267 («1-Sí»): 294a y 692 se reanclan para exigir que el
// selector NO está y que el payload del formulario ya NO envía la clave.
//
// ── 🔴 POR QUÉ NO BASTA CON QUITAR EL SELECTOR ─────────────────────────────────────────────
// Medido por jv-j2dm (c.22266): con «No consta» el modal mandaba `recargoEquivalencia: null`. Si
// se quitara solo el control y la clave siguiera viajando como `null`, CADA guardado de la ficha
// BORRARÍA lo que el cliente tuviera guardado. Con la clave AUSENTE, `customerUpdateSchema` (un
// `.partial()` de Zod) no la produce y Prisma no toca la columna. Eso es lo que se exige aquí, en
// las dos mitades: la ficha no la envía (estático, AST) y el esquema no la inventa (ejecutado).
//
// Lo que este fichero NO prueba: el viaje entero contra una base. Eso es
// `tests/scrum692-guardado-parcial-en-base.test.mjs`, gateado (staging o banco desechable).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MODAL = 'public/dashboard/js/customersView.js';
const FICHA = 'public/dashboard/js/customerDetailView.js';
// Lo que TIENE que sobrevivir al filtro de comentarios en cada vista (suelo de SCRUM-719).
const ANCLA = { [MODAL]: 'fieldTipoDestinatario', [FICHA]: 'e360-tipodestinatario' };
const leer = (rel) => {
  try {
    return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${rel} (${e && e.code ? e.code : e}). «No está» y «no supe mirar» son el mismo verde.`);
  }
};

// «Muta» = escribe algo en el árbol; el meta-guard aplica cada una y exige que este fichero caiga.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La regresión muda que nombra c.22266: la clave vuelve al payload como null y borra el dato.
    fichero: 'public/dashboard/js/customersView.js',
    de: '      tipoDestinatario: fieldTipoDestinatario.value || null, // SCRUM-69\n',
    a: '      tipoDestinatario: fieldTipoDestinatario.value || null, // SCRUM-69\n      recargoEquivalencia: null,\n',
    cae: 'el payload del modal ya NO envía la clave recargoEquivalencia',
  },
  {
    // El selector vuelve a la ficha (aunque el payload siga limpio).
    fichero: 'public/dashboard/js/customersView.js',
    de: '    tipoWrapper.appendChild(fieldTipoDestinatario);\n',
    a: '    tipoWrapper.appendChild(fieldTipoDestinatario);\n    const sel = document.createElement("select"); sel.name = "recargoEquivalencia";\n',
    cae: 'ninguna ficha de cliente tiene control del recargo',
  },
];

/** ¿Hay un control del recargo en este fuente? (nombre, id o variable del campo, o su rótulo). */
function controlesDelRecargo(fuente, ancla, donde) {
  const ejecutable = ejecutableDe(fuente, { ancla, donde });
  const hallados = [];
  for (const [que, re] of [
    ['name="recargoEquivalencia"', /\.name\s*=\s*["'`]recargoEquivalencia["'`]|name=["']recargoEquivalencia["']/],
    ['id de control con «recargo»', /id=["'][^"']*recargo[^"']*["']/i],
    ['variable fieldRecargo', /\bfieldRecargo\b/],
    ['rótulo «Recargo de equivalencia»', /textContent\s*=\s*["'`]Recargo de equivalencia|>Recargo de equivalencia</],
  ]) if (re.test(ejecutable)) hallados.push(que);
  return hallados;
}

/** Las claves del objeto `payload` (literal + `payload.x = …` posteriores), por AST. */
function clavesDelPayload(fuente, nombre = 'x.js') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const claves = [];
  (function walk(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'payload'
        && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) if (p.name) claves.push(p.name.getText());
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && n.left.expression.getText() === 'payload') {
      claves.push(n.left.name.getText());
    }
    n.forEachChild(walk);
  })(sf);
  return claves;
}

// ── ① LOS INSTRUMENTOS VEN: positivo SEMBRADO, no prestado del árbol ─────────────────────
test('SCRUM-1783b · SUELO: los dos detectores ven un caso fabricado (si no, «ausente» sería ceguera)', () => {
  const sembrado = [
    'const sel = document.createElement("select");',
    'sel.name = "recargoEquivalencia";',
    'const payload = { name: n, recargoEquivalencia: null };',
    'payload.phone = p;',
  ].join('\n');
  assert.ok(controlesDelRecargo(sembrado, 'createElement', 'el sembrado').includes('name="recargoEquivalencia"'),
    '🔴 DETECTOR CIEGO: no ve un select con name="recargoEquivalencia" sembrado a propósito.');
  assert.deepEqual(clavesDelPayload(sembrado), ['name', 'recargoEquivalencia', 'phone'],
    '🔴 EXTRACTOR CIEGO: no ve las claves de un payload sembrado (literal + asignación posterior).');
  // Y sobre el árbol real, el extractor ve el payload del modal (suelo, no conclusión).
  const modal = clavesDelPayload(leer(MODAL), MODAL);
  for (const k of ['name', 'tipoDestinatario', 'internalRef', 'billingAddress']) {
    assert.ok(modal.includes(k), `🔴 EXTRACTOR CIEGO sobre ${MODAL}: no ve «${k}», que el modal envía.`);
  }
});

// ── ② EL SELECTOR NO ESTÁ ──────────────────────────────────────────────────────────────────
test('SCRUM-1783b · ninguna ficha de cliente tiene control del recargo', () => {
  for (const rel of [MODAL, FICHA]) {
    assert.deepEqual(controlesDelRecargo(leer(rel), ANCLA[rel], rel), [],
      `🔴 ${rel} vuelve a tener un control del recargo de equivalencia. El fundador decidió quitarlo `
      + 'de la ficha (SCRUM-1783 c.22264).');
  }
});

// ── ③ LA CLAVE NO VIAJA ────────────────────────────────────────────────────────────────────
test('SCRUM-1783b · 🔴 el payload del modal ya NO envía la clave recargoEquivalencia', () => {
  for (const rel of [MODAL, FICHA]) {
    assert.ok(!clavesDelPayload(leer(rel), rel).includes('recargoEquivalencia'),
      `🔴 ${rel} envía «recargoEquivalencia» sin tener control que la muestre. Si viaja como null, `
      + 'cada guardado BORRA el dato que el cliente tenía (medido por jv-j2dm, SCRUM-1783 c.22266).');
  }
});

// ── ④ CONTROL POSITIVO DE CONDUCTA: sin la clave, el esquema no la inventa ──────────────────
test('SCRUM-1783b · sin la clave, el guardado no toca el recargo; con null SÍ lo tocaría', async () => {
  const { customerUpdateSchema } = await import('../dist/core/validation/schemas.js');
  const sin = customerUpdateSchema.parse({ name: 'Cliente', tipoDestinatario: 'EMPRESARIO' });
  assert.ok(!Object.prototype.hasOwnProperty.call(sin, 'recargoEquivalencia'),
    '🔴 el esquema PRODUCE `recargoEquivalencia` aunque el formulario no la mande: Prisma la '
    + 'escribiría y el dato guardado se perdería.');
  // El negativo que da sentido al positivo: si la clave viajara como null, llegaría a Prisma.
  const conNull = customerUpdateSchema.parse({ name: 'Cliente', recargoEquivalencia: null });
  assert.equal(conNull.recargoEquivalencia, null,
    '🔴 CONTROL ROTO: con la clave en null el esquema ya no la deja pasar, así que este test no '
    + 'distingue «ausente» de «borrar».');
  // Y la API sigue aceptando el dato (la decisión ② de c.22264: la columna y la API se quedan).
  assert.equal(customerUpdateSchema.parse({ recargoEquivalencia: true }).recargoEquivalencia, true,
    '🔴 la API ya no acepta `recargoEquivalencia`: c.22264 decidió que se QUEDA.');
});
