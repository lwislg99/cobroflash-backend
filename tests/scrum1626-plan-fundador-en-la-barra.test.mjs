// tests/scrum1626-plan-fundador-en-la-barra.test.mjs — SCRUM-1626 (hermano de SCRUM-1623)
//
// QUIEN TIENE EL PLAN `founding` LO VE CON SU NOMBRE EN LA BARRA LATERAL.
//
// El defecto: `planLabels` de `public/dashboard/js/app.js` no conocía `founding`, y el subtítulo cae a
// `me.plan` en crudo: el dueño de una cuenta del plan de los primeros leía «founding», en inglés y en
// minúscula, bajo su nombre.
//
// El literal NO se redacta aquí: está FIRMADO en SCRUM-1626 c.21169 (27-oct-2026, regla 39). La
// respuesta literal del fundador: «si Plan Fundador me gusta».
//
// ── CÓMO MIDE ──────────────────────────────────────────────────────────────────────────────────────
// Igual que `scrum1623-plan-equipo-en-la-barra`, y por el mismo motivo: por EFECTO, sobre el código
// de verdad. Se saca por AST el tramo de `initApp` que pinta `#sidebar-user`, se ejecuta en una caja de
// arena con un `me` y un `document` mínimos, y se lee el `innerHTML`. Ni una línea de `app.js` se copia.
//
// ── LO QUE NO MIDE ─────────────────────────────────────────────────────────────────────────────────
//   · Qué plan tiene la cuenta: lo escribe el servidor (R27), no el panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTA = path.join(RAIZ, 'public/dashboard/js/app.js');

// La firma, copiada de c.21169. Es el único sitio de este fichero donde vive el literal.
const FIRMADO = 'Plan Fundador';

/** El tramo de `initApp` que pinta la tarjeta de usuario de la barra, tal cual está en `app.js`. */
function tramoDeLaBarra(fuente) {
  const sf = ts.createSourceFile('app.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let init = null;
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'initApp') init = n;
  });
  assert.ok(init, '🔴 no encuentro `async function initApp` en app.js');
  const sentencias = init.body.statements;
  const declara = (s, nombre) => ts.isVariableStatement(s)
    && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === nombre);
  const desde = sentencias.findIndex((s) => declara(s, 'initials'));
  const hasta = sentencias.findIndex((s) => ts.isIfStatement(s)
    && ts.isIdentifier(s.expression) && s.expression.text === 'sidebarUser');
  assert.ok(desde !== -1, '🔴 no encuentro `const initials` dentro de initApp');
  assert.ok(hasta > desde, '🔴 no encuentro `if (sidebarUser) {…}` detrás de `const initials`');
  const tramo = sentencias.slice(desde, hasta + 1);
  assert.ok(tramo.some((s) => declara(s, 'planLabels')), '🔴 el tramo no declara planLabels');
  return fuente.slice(tramo[0].getStart(sf), tramo[tramo.length - 1].getEnd());
}

const TRAMO = tramoDeLaBarra(fs.readFileSync(RUTA, 'utf8'));

/** Ejecuta el tramo con este `me` y devuelve el texto del subtítulo pintado. */
function subtituloPintado(me) {
  const tarjeta = { innerHTML: '' };
  const ctx = {
    me,
    logout() {},
    document: {
      getElementById: (id) => (id === 'sidebar-user' ? tarjeta : (id === 'btn-logout' ? { addEventListener() {} } : null)),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(`(function () { ${TRAMO} \n})()`, ctx);
  // Hueco para atributos a los dos lados de la clase (SCRUM-553).
  const m = tarjeta.innerHTML.match(/<div[^>]*class="sidebar-user-plan"[^>]*>([^<]*)<\/div>/);
  assert.ok(m, `🔴 la tarjeta no pinta .sidebar-user-plan; pintó:\n${tarjeta.innerHTML}`);
  return m[1];
}

test('① el dueño de una cuenta del plan `founding` ve «Plan Fundador» (c.21169) — no «founding» en crudo', () => {
  assert.equal(subtituloPintado({ name: 'Ana Ruiz', isOwner: true, plan: 'founding' }), FIRMADO);
});

test('② control: los planes que ya tenían rótulo no cambian', () => {
  assert.equal(subtituloPintado({ name: 'Ana Ruiz', isOwner: true, plan: 'pro' }), 'Plan Pro');
  assert.equal(subtituloPintado({ name: 'Ana Ruiz', isOwner: true, plan: 'equipo' }), 'Plan Equipo');
});

test('③ control: quien no es el dueño sigue viendo su rol y el negocio, también en una cuenta `founding`', () => {
  assert.equal(
    subtituloPintado({ name: 'Leo', isOwner: false, plan: 'founding', userRole: 'tecnico', merchantName: 'Reformas Ruiz' }),
    'Operario · Reformas Ruiz',
  );
});
