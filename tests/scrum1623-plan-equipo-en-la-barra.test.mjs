// tests/scrum1623-plan-equipo-en-la-barra.test.mjs — SCRUM-1623 (T2 de SCRUM-1402)
//
// QUIEN TIENE EL PLAN EQUIPO LO VE EN SU BARRA LATERAL.
//
// El defecto: `planLabels` de `public/dashboard/js/app.js` traía `trial`, `basic`, `pro` y
// `empresa`, sin `equipo`, y el subtítulo cae a `me.plan` en crudo: el dueño de una cuenta Equipo
// veía «equipo» bajo su nombre.
//
// El literal NO se redacta aquí: es T2, firmado en SCRUM-1402 c.20845 (24-oct-2026, regla 39):
// «T2 FIRMADO (regla 39): «Plan Equipo», en la barra lateral (`app.js:184/:188`, S2, Luis).»
//
// ── CÓMO MIDE ──────────────────────────────────────────────────────────────────────────────────
// Por EFECTO, sobre el código de verdad: se saca por AST el tramo de `initApp` que pinta
// `#sidebar-user` (de `const initials` al `if (sidebarUser) {…}`), se ejecuta en una caja de arena
// con un `me` y un `document` mínimos, y se lee el `innerHTML` que deja. Ni una línea de `app.js`
// se copia aquí: si mañana el subtítulo se calcula de otra forma, el test sigue midiendo lo pintado.
//
// ── LO QUE NO MIDE ─────────────────────────────────────────────────────────────────────────────
//   · El navegador ni el resto del arranque (`/admin/me`, el router): sólo este tramo.
//   · Qué plan tiene la cuenta: lo escribe el webhook de Stripe (R27), no el panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTA = path.join(RAIZ, 'public/dashboard/js/app.js');

// La firma, copiada de c.20845. Es el único sitio de este fichero donde vive el literal.
const T2 = 'Plan Equipo';

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
  // Control de población: el tramo tiene que contener el mapa de planes y el subtítulo.
  assert.ok(tramo.some((s) => declara(s, 'planLabels')), '🔴 el tramo no declara planLabels');
  assert.ok(tramo.some((s) => declara(s, 'sidebarSubtitle')), '🔴 el tramo no declara sidebarSubtitle');
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
  const m = tarjeta.innerHTML.match(/<div class="sidebar-user-plan">([^<]*)<\/div>/);
  assert.ok(m, `🔴 la tarjeta no pinta .sidebar-user-plan; pintó:\n${tarjeta.innerHTML}`);
  return m[1];
}

test('① el dueño de una cuenta Equipo ve «Plan Equipo» (T2, c.20845) — no «equipo» en crudo', () => {
  assert.equal(subtituloPintado({ name: 'Ana Ruiz', isOwner: true, plan: 'equipo' }), T2);
});

test('② control positivo: los planes que ya tenían rótulo no cambian', () => {
  assert.equal(subtituloPintado({ name: 'Ana Ruiz', isOwner: true, plan: 'pro' }), 'Plan Pro');
  assert.equal(subtituloPintado({ name: 'Ana Ruiz', isOwner: true, plan: 'trial' }), 'Trial gratuito');
});

test('③ control: quien no es el dueño sigue viendo su rol y el negocio, también en una cuenta Equipo', () => {
  assert.equal(
    subtituloPintado({ name: 'Leo', isOwner: false, plan: 'equipo', userRole: 'tecnico', merchantName: 'Reformas Ruiz' }),
    'Operario · Reformas Ruiz',
  );
});
