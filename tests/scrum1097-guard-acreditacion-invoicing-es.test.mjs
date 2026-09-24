// tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs
//
// Prueba `scripts/guard-acreditacion-invoicing-es.mjs` SIN base de datos real: la lógica de
// medición recibe un `PrismaClient` inyectado (mismo patrón que `preview-migracion.mjs`), y el
// auto-check de "solo lectura" se prueba con TEXTO, en rojo y en verde, antes de confiar en que
// se ejecuta contra su propio fichero.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  analizarSoloLectura,
  verificarSoloLecturaEstructural,
  medirAcreditacion,
  MERCHANT_DEMO_ID,
  FLAG_INVOICING_ES,
  TIPOS_FISCALES,
  METODOS_PERMITIDOS,
} from '../scripts/guard-acreditacion-invoicing-es.mjs';

const RUTA_PROPIA = fileURLToPath(new URL('../scripts/guard-acreditacion-invoicing-es.mjs', import.meta.url));

test('SCRUM-1097 · el auto-check ve limpio su propio fichero (solo findMany y $disconnect)', () => {
  const r = verificarSoloLecturaEstructural(RUTA_PROPIA);
  assert.deepEqual(r.prohibidos, []);
});

test('SCRUM-1097 · control positivo del auto-check: SÍ hay una llamada findMany Y una $disconnect reales en el fichero', () => {
  // Si esto no encontrara ninguna, el analizador estaría ciego y el test de arriba pasaría por
  // no ver nada, no por ver algo limpio — la misma trampa que puesto-j6.md advierte.
  const codigo = fs.readFileSync(RUTA_PROPIA, 'utf8');
  assert.match(codigo, /prisma\.merchant\.findMany\(/);
  assert.match(codigo, /prisma\.\$disconnect\(/);
});

test('SCRUM-1097 · EN ROJO: el auto-check caza un `.update(` sobre `prisma` que no está en la lista blanca', () => {
  const rojo = `
    async function tocar(prisma) {
      return prisma.merchant.update({ where: { id: 1 }, data: { flags: {} } });
    }
  `;
  const r = analizarSoloLectura(rojo, 'rojo.mjs');
  assert.equal(r.prohibidos.length, 1);
  assert.equal(r.prohibidos[0].metodo, 'update');
});

test('SCRUM-1097 · EN ROJO: caza también `create`, `upsert`, `delete` y `$executeRaw` sobre `prisma`, uno por uno', () => {
  for (const metodo of ['create', 'createMany', 'upsert', 'update', 'updateMany', 'delete', 'deleteMany', '$executeRaw', '$executeRawUnsafe']) {
    const rojo = `prisma.merchant.${metodo}({});`;
    const r = analizarSoloLectura(rojo, 'rojo.mjs');
    assert.equal(r.prohibidos.length, 1, `«${metodo}» debería estar fuera de la lista blanca`);
    assert.equal(r.prohibidos[0].metodo, metodo);
  }
});

test('SCRUM-1097 · en VERDE: una llamada `findMany` sobre `prisma` no se marca', () => {
  const verde = `prisma.merchant.findMany({ where: { country: 'ES' } });`;
  const r = analizarSoloLectura(verde, 'verde.mjs');
  assert.deepEqual(r.prohibidos, []);
});

test('SCRUM-1097 · una llamada de igual nombre sobre OTRO objeto (no `prisma`) no se confunde', () => {
  // Control: el analizador ancla a la cadena que arranca en el identificador `prisma`, no al
  // nombre del método suelto — `otraCosa.update(...)` no es un escritor de Prisma.
  const verde = `otraCosa.merchant.update({});`;
  const r = analizarSoloLectura(verde, 'verde.mjs');
  assert.deepEqual(r.prohibidos, []);
});

test('SCRUM-1097 · la lista blanca es exactamente {findMany, $disconnect}, declarada y no accidental', () => {
  assert.deepEqual([...METODOS_PERMITIDOS].sort(), ['$disconnect', 'findMany']);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// `medirAcreditacion` — con un doble de Prisma, sin tocar ninguna base.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const merchantBase = (over) => ({ id: 2, flags: null, Invoice: [], ...over });

test('SCRUM-1097 · CIEGO si no hay ni un merchant ES no-demo (suelo ausente, no "cero")', async () => {
  const prisma = { merchant: { findMany: async () => [] } };
  const r = await medirAcreditacion(prisma);
  assert.equal(r.ciego, true);
  assert.match(r.motivo, /CERO merchants ES no-demo/);
});

test('SCRUM-1097 · CIEGO si la consulta falla — nunca se confunde con "cero"', async () => {
  const prisma = { merchant: { findMany: async () => { throw new Error('conexión perdida'); } } };
  const r = await medirAcreditacion(prisma);
  assert.equal(r.ciego, true);
});

test('SCRUM-1097 · limpio: hay suelo, y ninguno de los candidatos está acreditado', async () => {
  const prisma = { merchant: { findMany: async () => [merchantBase({ id: 2 }), merchantBase({ id: 3, flags: { OTRA_COSA: true } })] } };
  const r = await medirAcreditacion(prisma);
  assert.equal(r.ciego, false);
  assert.equal(r.floor, 2);
  assert.deepEqual(r.filas, []);
});

test('SCRUM-1097 · EN ROJO (a): un merchant con flags.INVOICING_ES_ENABLED=true SÍ se caza', async () => {
  const prisma = {
    merchant: {
      findMany: async () => [merchantBase({ id: 2 }), merchantBase({ id: 5, flags: { [FLAG_INVOICING_ES]: true } })],
    },
  };
  const r = await medirAcreditacion(prisma);
  assert.equal(r.ciego, false);
  assert.deepEqual(r.filas, [{ id: 5 }]);
});

test('SCRUM-1097 · EN ROJO (b): un merchant con una Invoice de tipo fiscal SÍ se caza, para cada tipo del catálogo', async () => {
  for (const tipo of TIPOS_FISCALES) {
    const prisma = {
      merchant: { findMany: async () => [merchantBase({ id: 9, Invoice: [{ id: 100 }] })] },
    };
    const r = await medirAcreditacion(prisma);
    assert.equal(r.ciego, false, `tipo ${tipo}`);
    assert.deepEqual(r.filas, [{ id: 9 }], `tipo ${tipo}`);
  }
});

test('SCRUM-1097 · un flag en falso, o distinto de booleano, NO acredita (mismo criterio que core/flags.ts)', async () => {
  const prisma = {
    merchant: {
      findMany: async () => [
        merchantBase({ id: 2 }),
        merchantBase({ id: 6, flags: { [FLAG_INVOICING_ES]: false } }),
        merchantBase({ id: 7, flags: { [FLAG_INVOICING_ES]: 'true' } }), // string, no booleano
        merchantBase({ id: 8, flags: [true] }), // array: no cuenta como objeto plano
      ],
    },
  };
  const r = await medirAcreditacion(prisma);
  assert.equal(r.ciego, false);
  assert.deepEqual(r.filas, []);
});

test('SCRUM-1097 · regla 8: el demo (id=1) se excluye por FILTRO EXPLÍCITO — control de que la constante es 1', () => {
  assert.equal(MERCHANT_DEMO_ID, 1);
});
