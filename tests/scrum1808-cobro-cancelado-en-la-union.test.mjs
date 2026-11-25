// tests/scrum1808-cobro-cancelado-en-la-union.test.mjs — SCRUM-1808 (parte S1)
//
// `AuditAction` (src/modules/system/audit.service.ts) es una unión CERRADA: ampliarla es decisión del
// fundador (regla 5). La clave `cobro_cancelado` está aprobada en SCRUM-1532 c.22435 para que la ruta
// `POST /admin/charges/:id/cancel` (1532b, de J2) deje su fila en 1532c. Este test fija las dos cosas
// que S1 entrega y ninguna más:
//   ① la clave está en la unión;
//   ② NO está en `ACCIONES_BLOQUEANTES` — esa lista también es cerrada, y meterla ahí sería otra
//     decisión que c.22435 no tomó. Fuera de ella, `recordAudit` (fire-safe) la acepta en el TIPO.
//
// Se mide por AST (SCRUM-203), no por grep: un comentario que nombre la clave no la declara.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHERO = path.join(RAIZ, 'src', 'modules', 'system', 'audit.service.ts');
const CLAVE = 'cobro_cancelado';

function censo() {
  const sf = ts.createSourceFile(FICHERO, fs.readFileSync(FICHERO, 'utf8'), ts.ScriptTarget.Latest, true);
  let union = null;
  let bloqueantes = null;
  sf.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'AuditAction' && ts.isUnionTypeNode(n.type)) {
      union = n.type.types
        .filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal))
        .map((t) => t.literal.text);
    }
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.name.text !== 'ACCIONES_BLOQUEANTES' || !d.initializer) continue;
        let init = d.initializer;
        if (ts.isAsExpression(init)) init = init.expression;
        if (ts.isArrayLiteralExpression(init)) {
          bloqueantes = init.elements.filter(ts.isStringLiteral).map((e) => e.text);
        }
      }
    }
  });
  return { union, bloqueantes };
}

test('SCRUM-1808 · control positivo: el censo lee la unión y la lista bloqueante de verdad', () => {
  const { union, bloqueantes } = censo();
  assert.ok(Array.isArray(union), 'no encontré `type AuditAction = … | …` en audit.service.ts');
  assert.ok(union.includes('factura_anulada') && union.includes('trabajo_omitido_cliente_ajeno'),
    `la unión leída no tiene las claves conocidas: ${JSON.stringify(union)}`);
  assert.ok(Array.isArray(bloqueantes) && bloqueantes.includes('factura_emitida'),
    `no leí ACCIONES_BLOQUEANTES: ${JSON.stringify(bloqueantes)}`);
});

test('SCRUM-1808 · ① `cobro_cancelado` está en la unión cerrada de AuditAction (SCRUM-1532 c.22435)', () => {
  const { union } = censo();
  assert.ok(union.includes(CLAVE), `🔴 la unión no tiene '${CLAVE}': ${JSON.stringify(union)}`);
  assert.equal(union.filter((a) => a === CLAVE).length, 1, 'la clave va UNA vez');
});

test('SCRUM-1808 · ② `cobro_cancelado` NO es bloqueante: entra por la puerta fire-safe', () => {
  const { bloqueantes } = censo();
  assert.ok(!bloqueantes.includes(CLAVE),
    `🔴 '${CLAVE}' está en ACCIONES_BLOQUEANTES: esa lista es cerrada y c.22435 no la amplía`);
});
