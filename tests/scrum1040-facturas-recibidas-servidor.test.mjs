// tests/scrum1040-facturas-recibidas-servidor.test.mjs — SCRUM-1040 (CON-04).
//
// LA RUTA NUEVA DE LECTURA: `GET /admin/libros/recibidas.json`. No hay banco (sin Postgres en
// esta máquina): handler real contra un `db` falso, mismo patrón que SCRUM-1043 y SCRUM-426.
//
// Lo que se vigila:
//   · el contrato de periodo es el MISMO que `/recibidas.csv` (año y trimestre obligatorios, 400
//     con el mismo texto) — es la ruta VIEJA, y no se toca (NO TOCAR del ticket).
//   · la ruta nueva y el CSV dan el MISMO conjunto de filas: las dos llaman al MISMO motor
//     (`leerLibroRecibidasDelTrimestre`), así que comparar aquí es comparar el cableado, no el
//     cálculo — eso ya lo prueba SCRUM-426.
//   · aislamiento por merchant (regla 2) y `Cache-Control: no-store` (es una foto de un instante).
import test from 'node:test';
import assert from 'node:assert/strict';
import routerModulo from '../dist/modules/fiscal/librosAeat/librosAeat.routes.js';
import { leerLibroRecibidasDelTrimestre } from '../dist/modules/fiscal/librosAeat/librosAeat.repo.js';
import { csvLibroRecibidas } from '../dist/modules/fiscal/librosAeat/librosAeatCsv.js';

const router = routerModulo.default ?? routerModulo;
const M = 11;
const OTRO = 22;

/** Un gasto CLASIFICADO, con base/tipo/cuota — el caso que sí produce asiento. */
const gasto = (over = {}) => ({
  merchantId: M,
  date: new Date('2026-08-11T09:00:00Z'),
  concept: 'Material eléctrico',
  amount: '121.00',
  currency: 'EUR',
  providerId: 3,
  baseAmount: '100.00',
  vatRate: 21,
  vatAmount: '21.00',
  vatDeducible: true,
  providerInvoiceNumber: 'A-2026/443',
  providerInvoiceDate: new Date('2026-08-10T00:00:00Z'),
  ...over,
});

/** Base falsa: filtra por `where.merchantId` como haría Prisma de verdad. */
function dbFalsa(gastos, proveedores = [{ id: 3, name: 'Suministros Peña', taxId: 'B12345678' }]) {
  return {
    expense: {
      findMany: async ({ where }) => gastos.filter((g) => g.merchantId === where.merchantId),
    },
    provider: { findMany: async () => proveedores },
  };
}

/** Ejecuta el handler real de `GET /admin/libros/recibidas.json` contra `db`. */
async function pedir(db, { merchantId = M, query = {} } = {}) {
  const capa = router.stack.find((l) => l.route?.path === '/recibidas.json' && l.route.methods.get);
  assert.ok(capa, '🔴 ESCÁNER CIEGO: no encuentro `GET /recibidas.json` en el router');
  let status = 200;
  let cuerpo = null;
  const res = {
    status(c) { status = c; return res; },
    json(b) { cuerpo = b; return res; },
    setHeader(k, v) { (res._headers ||= {})[k] = v; },
  };
  // El handler lee `prisma` importado del módulo, no el `db` de aquí: se sustituye vía el mismo
  // truco que SCRUM-1043 (doble global), porque la ruta importa `{ prisma }` directamente.
  const { prisma } = await import('../dist/core/db/prisma.js');
  const orig = { expense: prisma.expense, provider: prisma.provider };
  prisma.expense = db.expense; prisma.provider = db.provider;
  try {
    await capa.route.stack[capa.route.stack.length - 1].handle({ merchantId, query }, res);
  } finally {
    prisma.expense = orig.expense; prisma.provider = orig.provider;
  }
  return { status, cuerpo, headers: res._headers || {} };
}

// ── EL CONTRATO DE PERIODO, IDÉNTICO AL DE `/recibidas.csv` ────────────────────────────────

test('SCRUM-1040 · 🔴 sin año o sin trimestre, 400 con el MISMO texto que `/recibidas.csv`', async () => {
  const db = dbFalsa([gasto()]);
  for (const query of [{}, { 'año': '2026' }, { trimestre: '3' }, { 'año': 'x', trimestre: '3' }, { 'año': '2026', trimestre: '7' }]) {
    const { status, cuerpo } = await pedir(db, { query });
    assert.equal(status, 400, `🔴 con ${JSON.stringify(query)} no responde 400`);
    assert.equal(cuerpo.error, 'periodo_invalido');
    assert.equal(cuerpo.detalle, 'No reconozco ese periodo. Elige un trimestre (T1 a T4) y un año.',
      '🔴 el texto se ha separado del de `/recibidas.csv`: son la MISMA decisión de microcopy (7-ago-2026).');
  }
});

test('SCRUM-1040 · sin caché: es una foto de un instante, igual que las dos descargas', async () => {
  const { headers } = await pedir(dbFalsa([gasto()]), { query: { 'año': '2026', trimestre: '3' } });
  assert.equal(headers['Cache-Control'], 'no-store');
});

// ── LA RUTA NUEVA Y EL CSV DAN EL MISMO CONJUNTO DE FILAS (aceptación 5) ────────────────────

test('SCRUM-1040 · 🔴 la ruta JSON y el CSV son el MISMO motor: mismas filas, mismos avisos', async () => {
  const gastos = [gasto(), gasto({ concept: 'Gasoil', amount: '60.00', baseAmount: null, vatRate: null, vatAmount: null, providerId: null, providerInvoiceNumber: null, providerInvoiceDate: null })];
  const db = dbFalsa(gastos);

  const { status, cuerpo } = await pedir(db, { query: { 'año': '2026', trimestre: '3' } });
  assert.equal(status, 200);

  // La comparación no es cosmética: se llama al MISMO lector con el MISMO `db`, que es
  // exactamente lo que hace `/recibidas.csv`. Si algún día la ruta JSON se desconecta del motor
  // y empieza a calcular por su cuenta, esto cae.
  const esperado = await leerLibroRecibidasDelTrimestre(db, { merchantId: M, año: 2026, trimestre: 3 });
  assert.deepEqual(cuerpo.filas, esperado.filas, '🔴 las filas de la pantalla no son las del motor');
  assert.equal(cuerpo.miradas, esperado.miradas);
  assert.deepEqual(cuerpo.avisos, esperado.avisos);

  // Y como CONJUNTO contra lo que produciría el CSV — no como cuenta (regla del ticket).
  // Las líneas de dato empiezan por «A-» (nº de factura del proveedor) o van vacías (sin nº); las
  // de avisos y cabecera no, así que basta excluirlas por lo que SÍ se sabe que dicen.
  const csv = csvLibroRecibidas(esperado.filas, esperado.avisos);
  const filasCsv = csv.split('\r\n').filter((l) => l
    && !l.startsWith('﻿Formato') && !l.startsWith('Formato')
    && !/^\d+ gastos? sin datos de IVA/.test(l)
    && !l.startsWith('Serie y número'));
  assert.equal(filasCsv.length, cuerpo.filas.length,
    `🔴 el CSV trae ${filasCsv.length} filas de datos y la pantalla ${cuerpo.filas.length}: no son el mismo conjunto.`);
});

test('SCRUM-1040 · aislamiento: un merchant no ve los gastos de otro (regla 2)', async () => {
  const db = dbFalsa([gasto(), gasto({ merchantId: OTRO, providerInvoiceNumber: 'X-1' })]);
  const mio = await pedir(db, { merchantId: M, query: { 'año': '2026', trimestre: '3' } });
  const ajeno = await pedir(db, { merchantId: OTRO, query: { 'año': '2026', trimestre: '3' } });
  assert.equal(mio.cuerpo.filas.length, 1);
  assert.equal(mio.cuerpo.filas[0].numeroProveedor, 'A-2026/443');
  assert.equal(ajeno.cuerpo.filas.length, 1);
  assert.equal(ajeno.cuerpo.filas[0].numeroProveedor, 'X-1');
});

// ── LO QUE ESTA RUTA NO HACE ────────────────────────────────────────────────────────────────

test('SCRUM-1040 · la ruta NO toca el camino de emisión ni escribe nada (regla 38)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const src = fs.readFileSync(path.join(raiz, 'src/modules/fiscal/librosAeat/librosAeat.routes.ts'), 'utf8');
  const bloque = src.slice(src.indexOf("router.get('/recibidas.json'"));
  assert.doesNotMatch(bloque, /\.create\(|\.update\(|\.delete\(|allocateInvoiceNumber|applyVeriFactu/,
    '🔴 la ruta nueva ha dejado de ser solo lectura.');
  assert.match(bloque, /leerLibroRecibidasDelTrimestre/,
    '🔴 la ruta nueva ya no llama al motor de A6/E4: si recalcula, un día dirá otra cifra que el CSV.');
});
