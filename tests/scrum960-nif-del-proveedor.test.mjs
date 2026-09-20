// tests/scrum960-nif-del-proveedor.test.mjs — SCRUM-960 · el NIF se pone y se corrige desde la FICHA
//
// Hasta hoy `Provider.taxId` solo se podía escribir apuntando un GASTO (`guardarNifDelProveedor`).
// La ficha lo LEÍA (el listado ya lo devolvía) y no lo dejaba escribir: el alta contestaba 201 y
// tiraba el campo en silencio, y la edición con solo el NIF daba 400 `empty_update`. Medido
// corriendo en `docs/master/evidencias/SCRUM-960/paso0.mjs` antes de tocar nada.
//
// Sin red y sin base: el router REAL de `dist/` sobre un express de verdad, y la base doblada por
// `global.prisma` (la costura que `dist/core/db/prisma.js` ya tiene).
//
// Lo que sostiene este fichero, por orden de lo que costaría romperlo:
//   ① Se puede PONER y se puede CORREGIR: son los dos casos del profesional.
//   ② Un NIF que no cuadra NO entra, y no entra NADA con él (ni el resto de los campos).
//   ③ Vacío sigue siendo válido: validar no es obligar, y borrar un NIF puesto por error
//      también es corregirlo.
//   ④ La validación es LA QUE YA HABÍA (`validarNifEspanol`), no una segunda regla.
//   ⑤ NEGATIVO: el camino del gasto no se toca, y una petición sin `taxId` se comporta
//      exactamente como antes de este ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

// ── El doble, puesto ANTES de cargar el router ──────────────────────────────────────────────
const escrituras = [];
const FILA = { id: 7, merchantId: 1, name: 'Almacén Pérez', phone: null, email: null, notes: null,
  legalName: null, taxId: null, isActive: true };

global.prisma = {
  provider: {
    // Por `name` contesta la pregunta del duplicado («no hay»); por `id`, la ficha que se edita.
    findFirst: async (args) => (args?.where?.id !== undefined ? { ...FILA, id: args.where.id } : null),
    findMany: async () => [{ ...FILA, taxId: 'A58818501' }],
    create: async (args) => { escrituras.push({ op: 'create', data: args.data }); return { ...FILA, ...args.data }; },
    update: async (args) => { escrituras.push({ op: 'update', data: args.data }); return { ...FILA, ...args.data }; },
    updateMany: async (args) => { escrituras.push({ op: 'updateMany', data: args.data }); return { count: 1 }; },
  },
  product: { count: async () => 0 },
};

const mod = await import('../dist/modules/providers/app/routes/providers.routes.js');
const router = mod.default?.default ?? mod.default;

// CIF con dígito de control VÁLIDO, comprobado contra `nifEspanol.ts`. El «malo» es el mismo
// con el control cambiado: si la validación desapareciera, este fichero seguiría en verde sin él.
const NIF_BUENO = 'A58818501';
const NIF_MALO = 'A58818502';

async function conApp(fn) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.merchantId = 1; next(); });
  app.use('/admin/providers', router);
  const server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const base = `http://127.0.0.1:${server.address().port}/admin/providers`;
  try {
    return await fn(async (metodo, ruta, cuerpo) => {
      escrituras.length = 0;
      const r = await fetch(base + ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
      });
      return { status: r.status, json: await r.json().catch(() => null), escrituras: escrituras.slice() };
    });
  } finally {
    await new Promise((ok) => server.close(ok));
  }
}

// ── ① PONER y CORREGIR ──────────────────────────────────────────────────────────────────────

test('SCRUM-960 · el ALTA guarda el NIF (antes contestaba 201 y lo tiraba)', async () => {
  await conApp(async (pedir) => {
    const r = await pedir('POST', '/', { name: 'Almacén Pérez', taxId: NIF_BUENO });
    assert.equal(r.status, 201);
    assert.equal(r.escrituras.length, 1, 'tiene que haber UNA escritura');
    assert.equal(r.escrituras[0].op, 'create');
    assert.equal(r.escrituras[0].data.taxId, NIF_BUENO, 'el NIF tiene que LLEGAR a la base');
  });
});

test('SCRUM-960 · la EDICIÓN corrige el NIF, y solo con el NIF basta', async () => {
  await conApp(async (pedir) => {
    const r = await pedir('PUT', '/7', { taxId: NIF_BUENO });
    assert.equal(r.status, 200, 'antes daba 400 empty_update');
    assert.equal(r.escrituras.length, 1);
    assert.equal(r.escrituras[0].data.taxId, NIF_BUENO);
  });
});

// ── ② Un NIF que no cuadra no entra, Y NO ENTRA NADA CON ÉL ────────────────────────────────

test('SCRUM-960 · alta con NIF inválido: 400 taxId_invalido y NO se crea el proveedor', async () => {
  await conApp(async (pedir) => {
    const r = await pedir('POST', '/', { name: 'Almacén Pérez', phone: '600111222', taxId: NIF_MALO });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'taxId_invalido');
    // Lo que de verdad importa: no se queda a medias. Un alta que creara el proveedor sin NIF
    // dejaría al profesional con una ficha que él cree que tiene NIF y no lo tiene.
    assert.deepEqual(r.escrituras, [], 'no se escribe NADA');
  });
});

test('SCRUM-960 · edición con NIF inválido: 400 y ninguna escritura', async () => {
  await conApp(async (pedir) => {
    const r = await pedir('PUT', '/7', { name: 'Otro nombre', taxId: NIF_MALO });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'taxId_invalido');
    assert.deepEqual(r.escrituras, [], 'ni siquiera se guarda el nombre, que sí era válido');
  });
});

// ── ③ Vacío sigue siendo válido ─────────────────────────────────────────────────────────────

test('SCRUM-960 · null y "" dejan el NIF sin constar: validar no es obligar', async () => {
  await conApp(async (pedir) => {
    for (const vacio of [null, '', '   ']) {
      const r = await pedir('PUT', '/7', { taxId: vacio });
      assert.equal(r.status, 200, `taxId=${JSON.stringify(vacio)} tiene que valer`);
      assert.equal(r.escrituras[0].data.taxId, null, 'se guarda NULL, no la cadena vacía');
    }
  });
});

test('SCRUM-960 · un alta SIN NIF sigue funcionando igual que antes', async () => {
  await conApp(async (pedir) => {
    const r = await pedir('POST', '/', { name: 'Sin NIF', phone: '600111222' });
    assert.equal(r.status, 201);
    assert.equal(r.escrituras[0].data.taxId, null);
    assert.equal(r.escrituras[0].data.phone, '600111222', 'el resto del alta no cambia');
  });
});

// ── ④ La validación es LA QUE YA HABÍA, no una nueva ───────────────────────────────────────

test('SCRUM-960 · la ficha usa el MISMO validador que el resto del producto', async () => {
  const { validarNifEspanol } = await import('../dist/core/validation/nifEspanol.js');
  // Control positivo del propio test: el validador que cito distingue de verdad estos dos.
  assert.equal(validarNifEspanol(NIF_BUENO).valido, true, 'control positivo: el bueno es bueno');
  assert.equal(validarNifEspanol(NIF_MALO).valido, false, 'control negativo: el malo es malo');
  // Y la ruta se comporta EXACTAMENTE igual que él en los dos casos (ya probado arriba), en vez
  // de estrenar una segunda regla que con el tiempo diría otra cosa sobre el mismo NIF.
  await conApp(async (pedir) => {
    assert.equal((await pedir('PUT', '/7', { taxId: NIF_BUENO })).status, 200);
    assert.equal((await pedir('PUT', '/7', { taxId: NIF_MALO })).status, 400);
  });
});

// ── ⑤ NEGATIVO: el camino del gasto no se ha tocado ────────────────────────────────────────

test('SCRUM-960 · NEGATIVO: el que escribe el NIF desde un GASTO sigue siendo el de siempre', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../src/modules/expenses/domain/expenses.service.ts', import.meta.url), 'utf8'));
  // No es un guard del módulo entero: es la afirmación concreta de que este ticket NO tocó la
  // única puerta que ya existía. `updateMany` con `taxId: null` en el `where` es lo que hace que
  // el NIF del almacén no pise el que alguien puso mirando una factura.
  assert.match(src, /guardarNifDelProveedor/, 'la función tiene que seguir existiendo');
  assert.match(src, /taxId:\s*null/, 'sigue sin pisar un NIF ya guardado');
});
