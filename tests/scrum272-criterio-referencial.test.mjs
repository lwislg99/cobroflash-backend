// SCRUM-272 · EL BARRIDO DE HUÉRFANAS DECIDE EN LA BASE, NO CON UNA FOTO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `barridoDeHuerfanas` tomaba `merchant.findMany()` UNA vez y luego borraba con
// `merchantId: { notIn: ids }` durante los `deleteMany` siguientes: decidía con una foto y
// borraba después. La dirección peligrosa es la que no se ve — **un merchant creado DESPUÉS de la
// foto no está en `ids`, así que sus filas CASAN el criterio y se borran**, aunque exista.
//
// Y hoy no puede morder por sí solo: dentro de una tanda nada crea merchants a la vez (hijos
// secuenciales por `spawnSync`, `--test-concurrency=1`) y el turno de SCRUM-188 serializa las
// tandas. Lo mantenía inofensivo **un mecanismo externo que la función no conoce** — correcto por
// la razón equivocada, la familia de SCRUM-239 y SCRUM-235.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE TEST NO MIRA EL RESULTADO SINO LO QUE SE PIDE A LA BASE
//
// La propiedad no es «borra las huérfanas» —eso ya lo comprobaba lo anterior— sino **cuándo se
// evalúa el criterio**. Eso no se ve en el resultado: se ve en la CONSULTA. Por eso el doble
// registra lo que se le pide y los asserts leen eso, que es donde vive la diferencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { barridoDeHuerfanas } from './_merchant-fixture.mjs';

/** DMMF de mentira: dos modelos, uno con `@map` en la columna y otro sin él. */
const DMMF = {
  datamodel: {
    models: [
      { name: 'Invoice',  dbName: 'invoices',  fields: [{ name: 'merchantId' }] },                         // sin @map
      { name: 'Customer', dbName: 'customers', fields: [{ name: 'merchantId', dbName: 'merchant_id' }] },   // con @map
    ],
  },
};

/** Un `prisma` que no toca nada y apunta todo lo que se le pide. */
function prismaEspia({ filas = 0 } = {}) {
  const sql = [];
  const llamadas = [];
  const delegado = (nombre) => new Proxy({}, {
    // Los `find*` devuelven ARRAY y los demás `{count}`. Importa: si `findMany` devolviera un
    // objeto, el código que reintroduzca la foto reventaría al hacer `.map` y el rojo saldría por
    // el motivo equivocado — el doble tiene que dejar que el defecto FUNCIONE para poder cazarlo
    // (incidente #12: un rojo con el caso fuera del mecanismo no prueba nada).
    get: (_, m) => (...args) => {
      llamadas.push({ modelo: nombre, metodo: String(m), args });
      return Promise.resolve(/^find/.test(String(m)) ? [] : { count: 0 });
    },
  });
  return {
    sql,
    llamadas,
    $executeRawUnsafe: (q) => { sql.push(q); return Promise.resolve(filas); },
    get merchant() { return delegado('merchant'); },
    // cualquier otro delegado (invoice, customer…) queda registrado igual
    ...Object.fromEntries(['invoice', 'customer', 'auditLog'].map((n) => [n, delegado(n)])),
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ROJO · el criterio ya no puede depender de una lista tomada antes
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-272 · NO se toma ninguna foto de merchants antes de borrar', async () => {
  const p = prismaEspia();
  await barridoDeHuerfanas(p, DMMF);

  const fotos = p.llamadas.filter((l) => l.modelo === 'merchant' && /^find/.test(l.metodo));
  assert.deepEqual(
    fotos, [],
    '🔴 VUELVE LA FOTO: se consulta la lista de merchants ANTES de borrar, así que todo lo que ' +
    'aparezca entre esa consulta y cada DELETE queda fuera del criterio — o, peor, DENTRO por ' +
    'accidente: un merchant creado después de la foto no está en la lista y sus filas se borran.',
  );
});

test('SCRUM-272 · el criterio viaja EN la sentencia y lo evalúa la base', async () => {
  const p = prismaEspia();
  await barridoDeHuerfanas(p, DMMF);

  assert.equal(p.sql.length, 2, 'una sentencia por modelo');
  for (const q of p.sql) {
    assert.match(q, /NOT EXISTS/i, '🔴 el criterio ya no es referencial');
    assert.match(q, /FROM "merchants"/, '🔴 no consulta la tabla de merchants en el propio DELETE');
    // Y lo que NO puede aparecer: una lista de ids materializada en el texto.
    assert.doesNotMatch(q, /IN \(\s*\d/, '🔴 hay una lista de ids incrustada: eso es la foto otra vez');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS NOMBRES FÍSICOS · la trampa que tumbó el backfill de SCRUM-205
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-272 · tabla y columna salen del DMMF, no se derivan a mano', async () => {
  // Medido en el schema real: casi todos llevan `@map("merchant_id")` y **DOS no** — `Quote` e
  // `Invoice`; `invoices.merchantId` es camelCase en la propia BD. Derivar el nombre a
  // snake_case a ojo habría roto esos dos, que es exactamente cómo murió el backfill de
  // SCRUM-205. Se nombran en vez de contarlos (SCRUM-680): los nombres no caducan.
  const p = prismaEspia();
  await barridoDeHuerfanas(p, DMMF);

  assert.match(p.sql[0], /DELETE FROM "invoices"/);
  assert.match(p.sql[0], /t\."merchantId"/, '🔴 el modelo SIN @map debe usar la columna tal cual');
  assert.match(p.sql[1], /DELETE FROM "customers"/);
  assert.match(p.sql[1], /t\."merchant_id"/, '🔴 el modelo CON @map debe usar el nombre físico');
});

test('SCRUM-272 · un modelo sin columna de merchant se salta, no se inventa', async () => {
  const p = prismaEspia();
  await barridoDeHuerfanas(p, {
    datamodel: { models: [{ name: 'Invoice', dbName: 'invoices', fields: [{ name: 'id' }] }] },
  });
  assert.deepEqual(p.sql, [], '🔴 se ha construido un DELETE sobre una columna que no existe');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL NÚMERO · lo que de verdad se ahorra, sin adornarlo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-272 · una sentencia por modelo y NINGUNA de más', async () => {
  // El ahorro real es **la consulta de la foto**: 22 → 21 por barrido. Ni una más.
  //
  // NO se colapsan los 21 DELETE en una sola sentencia, y el motivo está medido: hay **13
  // relaciones entre tablas del propio barrido** (`Invoice → Charge`, `Quote → Customer`,
  // `Expense → Provider`…). Con CTEs de escritura el orden de ejecución no está garantizado y
  // las FK inmediatas pueden reventar. El orden de `MODELOS_POR_MERCHANT` es deliberado
  // (SCRUM-170) y se conserva.
  const p = prismaEspia();
  await barridoDeHuerfanas(p, DMMF);
  assert.equal(p.sql.length, 2, 'dos modelos en el DMMF de prueba → dos sentencias');
  assert.equal(
    p.llamadas.length, 0,
    '🔴 hay llamadas al cliente ADEMÁS de las sentencias: el barrido debe hacer exactamente una ' +
    'por modelo y nada más',
  );
});

test('SCRUM-272 · devuelve cuántas filas barrió, para que el aviso sea cierto', async () => {
  const p = prismaEspia({ filas: 3 });
  assert.equal(await barridoDeHuerfanas(p, DMMF), 6, '2 modelos × 3 filas');
});
