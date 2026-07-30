// SCRUM-222 · DERIVA-PROD-1 — los DOS caminos del assert de arranque, probados sin BD.
//
// La BD va inyectada (`consultar`), así que se prueban ambas severidades sin tocar Postgres:
//   · columna ausente = fallo DURO e INMEDIATO (una columna no aparece reintentando);
//   · error de conexión = REINTENTA con backoff y luego falla (un blip de red no bloquea un deploy).
// Importa de dist/ (npm test compila antes) — misma convención que el resto de tests de lógica src.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSchemaColumns, columnasFaltantes } from '../dist/core/db/schemaDrift.js';

const MANIFIESTO = { merchants: ['id', 'email'], quotes: ['id', 'job_id', 'merchantId'] };
const FILAS_OK = [
  { table_name: 'merchants', column_name: 'id' }, { table_name: 'merchants', column_name: 'email' },
  { table_name: 'quotes', column_name: 'id' }, { table_name: 'quotes', column_name: 'job_id' },
  { table_name: 'quotes', column_name: 'merchantId' },
];
const noEsperar = async () => {};

test('SCRUM-222 · COLUMNA ausente → falla INMEDIATO, SIN reintentos', async () => {
  const sinJobId = FILAS_OK.filter((r) => !(r.table_name === 'quotes' && r.column_name === 'job_id'));
  let llamadas = 0;
  const consultar = async () => { llamadas += 1; return sinJobId; };
  await assert.rejects(
    () => assertSchemaColumns(MANIFIESTO, consultar, { reintentos: 3, esperar: noEsperar }),
    /quotes\.job_id[\s\S]*db push/,
  );
  assert.equal(llamadas, 1, '🔴 una columna ausente NO se reintenta: la consulta debe llamarse una sola vez');
});

test('SCRUM-222 · CONEXIÓN caída → reintenta y luego falla, mensaje de red', async () => {
  let llamadas = 0;
  const consultar = async () => { llamadas += 1; throw new Error('ECONNREFUSED 127.0.0.1:5432'); };
  const esperas = [];
  await assert.rejects(
    () => assertSchemaColumns(MANIFIESTO, consultar, { reintentos: 3, backoffMs: 10, esperar: async (ms) => { esperas.push(ms); } }),
    /no se pudo comprobar[\s\S]*red\/conexión/,
  );
  assert.equal(llamadas, 3, '🔴 deben agotarse los 3 intentos ante un fallo de conexión');
  assert.deepEqual(esperas, [10, 20], '🔴 backoff creciente entre intentos (10, 20)');
});

test('SCRUM-222 · un BLIP: falla una vez, a la segunda conecta → PASA', async () => {
  let llamadas = 0;
  const consultar = async () => { llamadas += 1; if (llamadas === 1) throw new Error('blip'); return FILAS_OK; };
  await assertSchemaColumns(MANIFIESTO, consultar, { reintentos: 3, esperar: noEsperar });
  assert.equal(llamadas, 2, '🔴 reintentó una vez y a la segunda conectó');
});

test('SCRUM-222 · SUELO: catálogo vacío → fail-closed (no pasa a ciegas)', () => {
  assert.throws(() => columnasFaltantes(MANIFIESTO, []), /0 columnas|SUELO/);
});

test('SCRUM-222 · SUELO: sin la tabla centinela `merchants` → fail-closed', () => {
  assert.throws(
    () => columnasFaltantes(MANIFIESTO, [{ table_name: 'quotes', column_name: 'id' }]),
    /merchants/,
  );
});

test('SCRUM-222 · todo cuadra → no lanza', async () => {
  await assertSchemaColumns(MANIFIESTO, async () => FILAS_OK, { esperar: noEsperar });
});
