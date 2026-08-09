// SCRUM-370 · QUIEN PUEDE CREAR UN GASTO TIENE QUE PODER VOLVER A VERLO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PREMISA DEL TICKET ESTABA A MEDIAS, Y LA MITAD FALSA IMPORTA
//
// El ticket decía «guarda un gasto que luego no se ve en ninguna parte». Medido: **el gasto SÍ se
// guarda** (`Expense.quoteId`) y **sí se ve** en la vista de Gastos. No se pierde nada.
//
// El defecto real es más pequeño y más feo: «+ Añadir gasto» se construyó **para el técnico**
// (SCRUM-135, el alta rápida desde la furgoneta), y al técnico
//   · se le oculta el nav de Gastos (`app.js`), y
//   · `GET /admin/expenses` es `requireRole('admin')`.
// O sea que **su propia API se lo negaba**: tras el toast, el gasto que acababa de meter
// desaparecía para él para siempre.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL LÍMITE CON EL TICKET VECINO, DECLARADO
//
// Esto NO es rentabilidad por obra. **Sin totales, sin márgenes y sin comparar con el
// presupuesto**: eso vive en `GET /admin/expenses/margin/:quoteId`, sigue siendo admin-only y no
// se toca. Aquí solo se devuelve lo que el usuario metió.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TECNICO_ALLOWED } from '../dist/core/http/adminRouteDeclarations.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/jobs.routes.ts'), 'utf8');
const bloque = (() => {
  const i = RUTAS.indexOf("router.get('/:id/gastos'");
  assert.ok(i > 0, '🔴 no encuentro la ruta de gastos del Trabajo');
  return RUTAS.slice(i, i + 1400);
})();

test('SCRUM-370 · SUELO: la ruta existe y está declarada como del TÉCNICO', () => {
  // Si no estuviera declarada, la red fail-closed de SCRUM-55 la rechazaría — y si estuviera
  // declarada pero no existiera, este suelo lo diría en vez de pasar en verde.
  const decl = TECNICO_ALLOWED.find((r) => r.path === '/admin/jobs/:id/gastos' && r.method === 'GET');
  assert.ok(decl, '🔴 la ruta no está en TECNICO_ALLOWED: el técnico no podría verla');
  assert.match(decl.why, /SCRUM-370/, 'la declaración tiene que decir por qué se abre');
});

test('SCRUM-370 · 🔴 CONTROL NEGATIVO: el Trabajo AJENO da 404, no la lista', () => {
  // Es la razón de colgar esto del Trabajo en vez de abrir `GET /admin/expenses?quoteId=`: por el
  // listado global, un técnico podría enumerar cotizaciones y ver gastos de obras que no son
  // suyas. Aquí hereda el candado de SCRUM-147.
  assert.match(bloque, /seesOnlyOwnJobs\(req\.userRole\)\s*&&\s*job\.operarioId !== req\.teamMemberId/,
    '🔴 la ruta no aplica la regla de «solo SUS Trabajos»');
  assert.match(bloque, /findFirst\(\{ where: \{ id, merchantId: req\.merchantId \} \}\)/,
    '🔴 la ruta no filtra por merchant: es la tenencia (regla 2)');
  // El orden importa: la comprobación va ANTES de leer nada.
  assert.ok(bloque.indexOf('seesOnlyOwnJobs') < bloque.indexOf('listExpenses'),
    '🔴 se leen los gastos ANTES de comprobar de quién es el Trabajo');
});

test('SCRUM-370 · un Trabajo sin cotización responde lista VACÍA, no error', () => {
  // El gasto se ata por `quoteId`. «No tiene gastos» es una respuesta, no un fallo — devolver 404
  // haría que la pantalla enseñara un error donde no hay ninguno.
  assert.match(bloque, /job\.quoteId == null\) return res\.json\(\{ gastos: \[\] \}\)/,
    '🔴 un Trabajo sin cotización no devuelve lista vacía');
});

test('SCRUM-370 · 🔴 EL LÍMITE: aquí no hay márgenes, ni totales, ni presupuesto', () => {
  // El ticket vecino (rentabilidad por obra) sigue siendo otro, y su endpoint sigue admin-only.
  for (const prohibido of ['margin', 'margen', 'total', 'rentabilidad', 'presupuestado']) {
    assert.ok(!bloque.toLowerCase().includes(prohibido),
      `🔴 la ruta de gastos del Trabajo menciona «${prohibido}»: eso invade el ticket de rentabilidad por obra`);
  }
  // Respaldo de la negación (SCRUM-237): el endpoint de margen EXISTE y sigue siendo admin-only.
  const expensesRoutes = fs.readFileSync(path.join(RAIZ, 'src/modules/expenses/app/routes/expenses.routes.ts'), 'utf8');
  assert.match(expensesRoutes, /router\.get\('\/margin\/:quoteId', requireRole\('admin'\)/,
    'suelo: el endpoint de margen tiene que seguir existiendo y siendo admin-only');
});

test('SCRUM-370 · el listado GLOBAL de gastos NO se ha abierto al técnico', () => {
  // La otra mitad del límite: se abrió una puerta pequeña, no la grande.
  const expensesRoutes = fs.readFileSync(path.join(RAIZ, 'src/modules/expenses/app/routes/expenses.routes.ts'), 'utf8');
  assert.match(expensesRoutes, /router\.get\('\/', requireRole\('admin'\)/,
    '🔴 `GET /admin/expenses` ha dejado de ser admin-only: eso deja enumerar cotizaciones ajenas');
});
