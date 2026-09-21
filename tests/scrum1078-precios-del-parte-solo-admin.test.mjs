// SCRUM-1078 · LOS PRECIOS DE UN PARTE SON DEL ADMIN.
//
// `PATCH /admin/partes/:id` con `{precios:[…]}` lo aceptaba un técnico en su propio parte (200 y el
// importe quedaba en la fila): `permisoDeCampos` solo mira el estado, no el rol. Decisión: `precios`
// solo para `seesAllJobs`, y la petición ENTERA rechazada con 403 (como SCRUM-164).
// Dos mitades, sin banco: la REGLA (función pura) y su CABLEADO en el handler (AST).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { adminOnlyParteField, seesAllJobs } from '../dist/core/http/roleCapabilities.js';
import { FIELD_LEVEL_ROLE_GATES } from '../dist/core/http/adminRouteDeclarations.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'partes.routes.ts');

test('SCRUM-1078 · la regla: `precios` es de admin, y basta uno para contaminar la petición', () => {
  assert.equal(adminOnlyParteField({ precios: [{ lineaId: 1, precio: 10 }] }), 'precios');
  assert.equal(adminOnlyParteField({ notas: 'ok', precios: [] }), 'precios', 'mezclado con campos legítimos también');
  assert.equal(adminOnlyParteField({ notas: 'ok', entrada: '08:00' }), null, 'el día a día del técnico sigue libre');
  for (const b of [null, undefined, 'x', 7]) assert.equal(adminOnlyParteField(b), null);
});

test('SCRUM-1078 · control positivo: el admin/propietario pasa por `seesAllJobs`, el técnico no', () => {
  assert.equal(seesAllJobs('admin'), true);
  assert.equal(seesAllJobs('tecnico'), false);
});

test('SCRUM-1078 · la regla está DECLARADA como gate por campo', () => {
  const d = FIELD_LEVEL_ROLE_GATES.find((g) => g.method === 'PATCH' && g.path === '/admin/partes/:id');
  assert.ok(d, 'falta la declaración');
  assert.deepEqual([...d.campos], ['precios']);
});

test('SCRUM-1078 · el PATCH de partes aplica el gate ANTES de `permisoDeCampos` y solo a quien no ve todo', () => {
  const src = fs.readFileSync(RUTAS, 'utf8');
  const sf = ts.createSourceFile(RUTAS, src, ts.ScriptTarget.Latest, true);
  let handler = null;
  sf.forEachChild((n) => {
    if (!ts.isExpressionStatement(n) || !ts.isCallExpression(n.expression)) return;
    const c = n.expression;
    if (ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === 'patch'
      && ts.isStringLiteralLike(c.arguments[0]) && c.arguments[0].text === '/:id') handler = c.arguments[c.arguments.length - 1];
  });
  assert.ok(handler, 'no encuentro router.patch("/:id")');
  // Posición del `if (!seesAllJobs(...)) { … adminOnlyParteField … 403 }` y de `permisoDeCampos(`.
  let posGate = -1;
  let posPermiso = -1;
  (function anda(x) {
    if (ts.isIfStatement(x) && ts.isPrefixUnaryExpression(x.expression)
      && x.expression.operator === ts.SyntaxKind.ExclamationToken
      && ts.isCallExpression(x.expression.operand) && x.expression.operand.expression.getText() === 'seesAllJobs') {
      const t = x.thenStatement.getText();
      if (/adminOnlyParteField\(/.test(t) && /status\(403\)/.test(t)) posGate = x.getStart();
    }
    if (ts.isCallExpression(x) && x.expression.getText() === 'permisoDeCampos') posPermiso = x.getStart();
    x.forEachChild(anda);
  })(handler);
  assert.ok(posGate > -1, 'el PATCH no rechaza `precios` al que no ve todo con 403');
  assert.ok(posPermiso > -1, 'población: `permisoDeCampos` debe seguir en el handler');
  assert.ok(posGate < posPermiso, 'el gate de rol debe ir antes de aplicar nada');
});
