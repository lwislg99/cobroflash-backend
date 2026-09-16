// tests/scrum339-importador-productos.test.mjs — SCRUM-339
//
// El importador de productos (importProductsCsv) NO tenía un solo test. Tenía cuatro defectos:
//   1. 🔴 El recuento MIENTE: `skippedDuplicates` solo contaba el choque P2002; el duplicado normal
//      (findFirst) hacía `continue` mudo → 100 filas duplicadas mostraban «Insertados 0 · Duplicados 0».
//   2. Filas tiradas en silencio: nombre vacío / precio no numérico o ≤0 / IVA fuera de 0..1. Nada se reportaba.
//   3. 🔴 El ida y vuelta con nuestro propio export NO era idempotente: exportProductsCsv escribe con `;`
//      pero escapeCsv no entrecomillaba `;`, y el importador partía por split(delimiter) sin honrar comillas
//      → un `;` en el nombre desplazaba las columnas, el precio se leía de la celda equivocada y la fila caía.
//   4. El BOM de nuestro export (:92) no se quitaba al importar (latente: el .trim() de la ruta lo mordía).
//
// EL CONTRATO NO SE INVENTA: se alinea con POST /admin/customers/import → { created, skipped, errors, errorList }.
//
// CÓMO: se importan las funciones REALES del `dist` y se sustituye `prisma.product` por un doble (mutando
// el objeto exportado). Sin BD, sin turno.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { importProductsCsv, exportProductsCsv } = await import(DIST + 'modules/products/domain/products.service.js');

const ORIG = {};
function conProducto(dobles) {
  ORIG.product = moduloPrisma.prisma.product;
  moduloPrisma.prisma.product = {
    findFirst: async () => null,
    create: async ({ data }) => ({ id: 1, ...data }),
    findMany: async () => [],
    ...dobles,
  };
}
function restaurar() { if (ORIG.product) moduloPrisma.prisma.product = ORIG.product; }

// ─── 1. 🔴 EL RECUENTO QUE MIENTE — N filas todas duplicadas → skipped = N (hoy mostraba 0 y 0) ──────
test('SCRUM-339 · N filas todas duplicadas → created 0 · skipped N (antes: skippedDuplicates 0, la mentira)', async (t) => {
  t.after(restaurar);
  conProducto({
    findFirst: async () => ({ id: 99 }), // TODAS ya existen
    create: async () => { throw new Error('no debería crearse ninguna'); },
  });
  const csv = 'name;price\nAlfa;10\nBeta;20\nGamma;30';
  const r = await importProductsCsv(1, csv);
  assert.equal(r.created, 0, `created esperado 0, fue ${r.created}`);
  assert.equal(r.skipped, 3,
    `🔴 el recuento debe contar los 3 duplicados. Antes el findFirst hacía continue mudo y skipped era ` +
    `0 (la pantalla decía «0 y 0»). Fue ${r.skipped}: ${JSON.stringify(r)}`);
});

// ─── 2. LAS FILAS TIRADAS EN SILENCIO — ahora se reportan (errors + errorList) ───────────────────────
test('SCRUM-339 · filas inválidas se REPORTAN: nombre vacío / precio ≤0 / IVA fuera de 0..1', async (t) => {
  t.after(restaurar);
  conProducto({ findFirst: async () => null });
  const csv = [
    'name;price;vat',
    ';10;0.21',        // nombre vacío
    'Buena;20;0.21',   // OK
    'MalPrecio;-5;0.21', // precio ≤ 0
    'MalIva;30;1.5',   // IVA fuera de 0..1
  ].join('\n');
  const r = await importProductsCsv(1, csv);
  assert.equal(r.created, 1, `solo «Buena» debería entrar; created=${r.created}`);
  assert.equal(r.errors, 3, `esperaba 3 filas con error; errors=${r.errors}: ${JSON.stringify(r.errorList)}`);
  assert.ok(r.errorList.length >= 3, 'errorList debe listar los motivos (como el contrato de clientes)');
});

// ─── 3. 🔴 IDA Y VUELTA CON EL `;` EN EL NOMBRE — export → reimport → mismo producto ────────────────
test('SCRUM-339 · round-trip: un producto con «;» en el nombre se exporta y reimporta idéntico', async (t) => {
  t.after(restaurar);
  const original = { name: 'Tornillo; caja de 100', description: 'inox', price: 12.5, vat: 0.21, isActive: true };
  conProducto({ findMany: async () => [original] });
  const csv = await exportProductsCsv(1); // lleva BOM y (con el arreglo) el nombre entrecomillado

  let creado = null;
  conProducto({ findFirst: async () => null, create: async ({ data }) => { creado = data; return { id: 1, ...data }; } });
  const r = await importProductsCsv(1, csv);

  assert.equal(r.created, 1, `🔴 el producto con «;» debe reimportarse (created=${r.created}). Antes el ; partía ` +
    'la fila y el precio se leía de la celda equivocada → fila caída; y el BOM hacía saltar invalid_header.');
  assert.equal(creado.name, 'Tornillo; caja de 100', 'el nombre entero, no partido por el ;');
  assert.equal(creado.price, 12.5, 'el precio se lee de la celda correcta');
});

// ─── DOS CARAS · un CSV bueno sigue importando exactamente igual ─────────────────────────────────────
test('SCRUM-339 · dos caras: un CSV bueno importa igual (created N, isActive/vat bien leídos)', async (t) => {
  t.after(restaurar);
  const creados = [];
  conProducto({ findFirst: async () => null, create: async ({ data }) => { creados.push(data); return { id: creados.length, ...data }; } });
  const csv = 'name;description;price;vat;isActive\nSilla;madera;30;0.21;true\nMesa;roble;120;0.10;false';
  const r = await importProductsCsv(1, csv);
  assert.equal(r.created, 2);
  assert.equal(r.skipped, 0);
  assert.equal(r.errors, 0);
  assert.equal(creados[0].name, 'Silla');
  assert.equal(creados[0].price, 30);
  assert.equal(creados[0].isActive, true);
  assert.equal(creados[1].isActive, false);
  assert.equal(creados[1].vat, 0.10);
});

// ─── CONTROL NEGATIVO · un duplicado legítimo es SKIP, no ERROR (la clasificación es específica) ─────
test('SCRUM-339 · control negativo: un duplicado cuenta como skipped, NO como error', async (t) => {
  t.after(restaurar);
  // Primera fila nueva, segunda ya existe: created 1 · skipped 1 · errors 0. Si «skipped» y «errors»
  // no estuvieran bien separados, un duplicado se contaría como error y este test caería.
  let vistos = 0;
  conProducto({ findFirst: async () => (++vistos === 1 ? null : { id: 7 }), create: async ({ data }) => ({ id: 1, ...data }) });
  const csv = 'name;price\nNueva;10\nYaExiste;20';
  const r = await importProductsCsv(1, csv);
  assert.equal(r.created, 1);
  assert.equal(r.skipped, 1);
  assert.equal(r.errors, 0, 'un duplicado NO es un error de formato');
});

// ─── CONTRATO · alineado con POST /admin/customers/import (created/skipped/errors/errorList) ──────────
test('SCRUM-339 · el contrato es el de clientes: created/skipped/errors/errorList (no inserted/skippedDuplicates)', async (t) => {
  t.after(restaurar);
  conProducto({ findFirst: async () => null });
  const r = await importProductsCsv(1, 'name;price\nX;5');
  for (const k of ['created', 'skipped', 'errors', 'errorList']) {
    assert.ok(k in r, `🔴 el contrato debe exponer «${k}» (alineación con /admin/customers/import). Claves: ${Object.keys(r)}`);
  }
  assert.ok(Array.isArray(r.errorList), 'errorList es un array (como en clientes)');
  assert.ok(!('inserted' in r) && !('skippedDuplicates' in r),
    '🔴 no debe volver el contrato viejo inserted/skippedDuplicates: es el que mentía');
});
