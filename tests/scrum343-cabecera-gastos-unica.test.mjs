// tests/scrum343-cabecera-gastos-unica.test.mjs — SCRUM-343
//
// gastos.csv se produce por DOS caminos: el CSV suelto (GET /admin/exports/expenses.csv) y el del
// paquete (datos.zip, vía `buildGastos`). Divergieron sin que nada lo dijera —9 columnas en el ZIP,
// 8 en el suelto (le faltaba «Registrado por»)— y un comentario en `buildGastos` AFIRMABA que eran
// las mismas: quien lo leía se fiaba y no comprobaba (SCRUM-321 lo midió en E0). Este guard cierra la
// trampa: falla si las dos cabeceras dejan de ser idénticas.
//
// 🔴 DERIVADO DE LAS DOS FUENTES, no escrito a mano. Escribir las 9 columnas en el assert sería la
// cuarta lista sin guard: el día que el código cambie una y no la otra, el test seguiría verde contra
// su propia copia. Aquí:
//   · cabecera del ZIP  = `buildGastos(...).header`  (la función que `construirCsvsDelPaquete` mete en
//     el zip como gastos.csv — exportData.ts).
//   · cabecera del suelto = se INVOCA el handler real GET /expenses.csv y se parsea la 1ª línea del CSV
//     que emite (patrón SCRUM-263). Sin BD, sin turno.
// SUELO: si el derivador NO saca una cabecera de gastos REAL de alguno de los dos caminos (vacía, o sin
// las columnas ancla Fecha/Importe), FALLA — dos vacíos no pueden pasar por «coinciden».
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { buildGastos } = await import(DIST + 'modules/exports/domain/exportData.js');
const RUTA = 'modules/exports/app/routes/exports.routes.js';

const routerDe = (mod) => mod.default?.default ?? mod.default;

/** Invoca el handler de negocio (el último de la capa) de una ruta real y devuelve lo que respondió. */
async function invocar(rutaModulo, metodo, ruta, req) {
  const router = routerDe(await import(DIST + rutaModulo));
  assert.ok(Array.isArray(router?.stack),
    `🔴 no se pudo leer el router de ${rutaModulo}: sin su stack no se invoca nada (SUELO)`);
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.[metodo]);
  assert.ok(capa,
    `🔴 no existe ${metodo.toUpperCase()} ${ruta} en ${rutaModulo}. Si se renombró, este guard dejaría ` +
    'de comprobar nada y pasaría en verde: por eso FALLA aquí (SUELO).');
  let salida = null;
  const res = {
    statusCode: 200,
    setHeader() { return this; }, type() { return this; },
    status(c) { this.statusCode = c; return this; },
    send(b) { salida = { code: this.statusCode, body: b }; return this; },
    json(b) { salida = { code: this.statusCode, body: b }; return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

const ORIG = {};
function sustituirPrisma(expenses = [], members = []) {
  for (const k of ['expense', 'teamMember', 'auditLog']) ORIG[k] = moduloPrisma.prisma[k];
  moduloPrisma.prisma.expense = { findMany: async () => expenses };
  moduloPrisma.prisma.teamMember = { findMany: async () => members };
  moduloPrisma.prisma.auditLog = { create: async () => ({}) }; // auditExport es fire-safe; lo callamos
}
function restaurarPrisma() { for (const k of Object.keys(ORIG)) moduloPrisma.prisma[k] = ORIG[k]; }

/** Cabecera del CSV suelto: se INVOCA la ruta y se parsea la 1ª línea (sin BOM), separador `;`. */
async function cabeceraDelSuelto() {
  const r = await invocar(RUTA, 'get', '/expenses.csv', { query: {}, merchantId: 1, teamMemberId: null, headers: {} });
  assert.ok(r && typeof r.body === 'string',
    `🔴 SUELO: GET /expenses.csv no devolvió un CSV (body=${typeof r?.body}); no se puede derivar su cabecera`);
  const sinBom = r.body.replace(/^﻿/, '');
  return sinBom.split('\r\n')[0].split(';');
}

/** Cabecera del ZIP: la que `buildGastos` (lo que el paquete mete como gastos.csv) declara. */
async function cabeceraDelZip() {
  const data = await buildGastos(1, { from: null, to: null });
  return data.header;
}

const esCabeceraDeGastosReal = (h) =>
  Array.isArray(h) && h.length >= 5 && h.includes('Fecha') && h.includes('Importe');

// ─── EL GUARD ─────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-343 · la cabecera de gastos.csv es IDÉNTICA en el ZIP y en el suelto (derivada de ambos)', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma([], []);

  const zip = await cabeceraDelZip();
  const suelto = await cabeceraDelSuelto();

  // SUELO — antes de comparar, los dos derivadores tienen que haber sacado una cabecera de gastos REAL.
  // Si uno sale vacío (ruta renombrada, builder roto), el test FALLA aquí; nunca dice «coinciden» sobre
  // dos cosas que no pudo leer.
  assert.ok(esCabeceraDeGastosReal(zip),
    `🔴 SUELO: no se derivó una cabecera de gastos real del ZIP (buildGastos): ${JSON.stringify(zip)}`);
  assert.ok(esCabeceraDeGastosReal(suelto),
    `🔴 SUELO: no se derivó una cabecera de gastos real del CSV suelto (GET /expenses.csv): ${JSON.stringify(suelto)}`);

  assert.deepEqual(suelto, zip,
    '🔴 las dos cabeceras de gastos.csv DIVERGEN. El suelto (GET /expenses.csv) y el del paquete ' +
    '(buildGastos, en datos.zip) deben producir columnas idénticas o el asesor no puede cruzar las dos ' +
    `descargas.\n  ZIP    (${zip.length}): ${JSON.stringify(zip)}\n  suelto (${suelto.length}): ${JSON.stringify(suelto)}\n` +
    '  Arréglalo unificando el suelto por el builder compartido (buildGastos), no tocando el assert.');
});

// ─── LAS DOS CARAS · cada descarga sigue produciendo un CSV bien formado (cabecera ↔ fila) ──────────
test('SCRUM-343 · dos caras: ZIP y suelto producen un CSV alineado, y el suelto YA lleva «Registrado por»', async (t) => {
  t.after(restaurarPrisma);
  const expense = {
    id: 1, date: new Date('2026-07-10T00:00:00Z'), concept: 'Tornillos', category: 'materiales',
    amount: '12.50', currency: 'EUR', provider: { name: 'Ferretería' }, quote: { id: 9 }, quoteId: 9,
    teamMemberId: 5, notes: 'caja de 100',
  };
  sustituirPrisma([expense], [{ id: 5, name: 'Juan' }]);

  // ZIP
  const zip = await buildGastos(1, { from: null, to: null });
  assert.equal(zip.rows.length, 1, 'el builder del ZIP debe emitir la fila del gasto');
  assert.equal(zip.rows[0].split(';').length, zip.header.length, 'ZIP: la fila tiene tantos campos como columnas');

  // suelto
  const r = await invocar(RUTA, 'get', '/expenses.csv', { query: {}, merchantId: 1, teamMemberId: null, headers: {} });
  const lineas = r.body.replace(/^﻿/, '').split('\r\n');
  const cab = lineas[0].split(';');
  const fila = lineas[1].split(';');
  assert.equal(fila.length, cab.length, 'suelto: la fila tiene tantos campos como columnas (CSV válido)');
  const iAutor = cab.indexOf('Registrado por');
  assert.ok(iAutor >= 0, '🔴 el suelto DEBE llevar ya la columna «Registrado por» (paridad con el ZIP)');
  assert.equal(fila[iAutor], 'Juan', 'el suelto rellena «Registrado por» con el autor del gasto');
});
