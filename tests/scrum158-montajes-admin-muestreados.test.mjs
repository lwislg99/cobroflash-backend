// SCRUM-158 — INVARIANTE: todo montaje admin-gateado tiene al menos UNA ruta suya muestreada
// en `ADMIN_ONLY_ROUTES`, es decir, al menos un 403 que alguien comprueba de verdad (A12.4).
//
// POR QUÉ ESTE INVARIANTE Y NO 11 ASSERTS MÁS
// -------------------------------------------
// Una ruta que nace bajo un montaje YA gateado no abre ningún hueco: hereda la misma instancia
// de middleware que a su hermana ya se le mide a 403. Añadir un assert por ruta sería teatro de
// cobertura. El hueco real se abre cuando nace un **montaje admin NUEVO sin ningún hermano** en
// la lista: su gate no lo ejercería nadie jamás, y `scrum55-admin-fail-closed` solo comprueba
// que la ruta DECLARA rol, no que RESPONDA 403.
//
// La causa de fondo es la de siempre en esta casa (ratchet de SCRUM-113): `ADMIN_ONLY_ROUTES`
// es una lista LITERAL mantenida a mano, no se deriva del árbol de rutas. Una lista a mano no
// sigue al árbol — así que hace falta algo que avise cuando el árbol se le adelanta.
//
// Sin gate y sin BD: lee `app.ts` como TEXTO e importa la lista. No arranca la app a propósito
// (importar `dist/app.js` levanta crons y conexiones que este invariante no necesita).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_TS = path.join(DIR, '..', 'src', 'app.ts');

/**
 * Montajes admin-gateados declarados en `app.ts`:
 *   mountAdmin(app, '/admin/loquesea', requireRole('admin'), router)
 * Se lee del FUENTE y no del runtime porque lo que se vigila es la DECLARACIÓN: que alguien
 * añada un montaje nuevo es exactamente el evento que este test tiene que ver.
 */
function montajesGateados(fuente) {
  return [...fuente.matchAll(/mountAdmin\(\s*app\s*,\s*'([^']+)'\s*,\s*requireRole\('admin'\)/g)]
    .map((m) => m[1]);
}

test('SCRUM-158: todo montaje admin-gateado tiene ≥1 ruta suya en ADMIN_ONLY_ROUTES', async () => {
  const { ADMIN_ONLY_ROUTES } = await import('../dist/core/http/adminOnlyRoutes.js');
  const fuente = fs.readFileSync(APP_TS, 'utf8');
  const montajes = montajesGateados(fuente);

  // GUARDA DEL DETECTOR (principio 2 de docs/QA/SUITE_REGRESION.md, sección «Escribir
  // verificaciones» / lección de SCRUM-113): si el extractor deja de
  // reconocer la forma de `mountAdmin` —porque alguien la reescribe, la envuelve o la renombra—
  // este test pasaría EN VACÍO con cero montajes que comprobar, que es indistinguible de "todo
  // correcto". Antes de afirmar nada hay que probar que se está viendo algo.
  assert.ok(
    montajes.length >= 5,
    `🔴 DETECTOR CIEGO: solo se han reconocido ${montajes.length} montajes admin-gateados en app.ts.\n` +
    `Al escribirse este test había 6 (billing, team, connect, charges, exports, reports). Si la\n` +
    `forma de mountAdmin cambió, ACTUALIZA el extractor — no bajes este número para ponerlo verde:\n` +
    `un contador que baja porque se quedó ciego es indistinguible de uno que baja porque el\n` +
    `trabajo se hizo, y es el peor de los dos (SCRUM-103).`,
  );

  const sinMuestra = montajes.filter(
    (m) => !ADMIN_ONLY_ROUTES.some((r) => r.path === m || r.path.startsWith(m + '/')),
  );

  assert.deepEqual(
    sinMuestra, [],
    `\n\n🔴 MONTAJE ADMIN SIN MUESTREAR: ${sinMuestra.join(', ')}\n\n` +
    `Ese router está gateado con requireRole('admin') pero NINGUNA de sus rutas aparece en\n` +
    `ADMIN_ONLY_ROUTES, así que su 403 no lo ejerce nadie: A12.4 no lo visita y\n` +
    `scrum55-admin-fail-closed solo comprueba que DECLARA rol, no que RESPONDA 403.\n\n` +
    `Arreglo: añade UNA ruta representativa de ese montaje a ADMIN_ONLY_ROUTES (con su method\n` +
    `y, si la necesita, su body). Con una basta — las demás heredan la MISMA instancia de\n` +
    `middleware, así que un assert por ruta sería teatro de cobertura.\n`,
  );
});
