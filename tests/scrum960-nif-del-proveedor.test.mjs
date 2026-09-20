// tests/scrum960-nif-del-proveedor.test.mjs — SCRUM-960 · el NIF se pone y se corrige desde la FICHA
//
// Hasta hoy `Provider.taxId` solo se podía escribir apuntando un GASTO (`guardarNifDelProveedor`).
// La ficha lo LEÍA (el listado ya lo devolvía) y no lo dejaba escribir: el alta contestaba 201 y
// tiraba el campo en silencio, y la edición con solo el NIF daba 400 `empty_update`. Medido
// corriendo en `docs/master/evidencias/SCRUM-960/paso0.mjs` antes de tocar nada.
//
// Sin red, sin socket y sin base: se invoca el router REAL de `dist/` en proceso, con la base
// doblada por `global.prisma` (la costura que `dist/core/db/prisma.js` ya tiene).
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

// ⚠️ AQUÍ NO SE ABRE UN SERVIDOR, Y ES A PROPÓSITO. La primera versión levantaba un express real
// por test (8 sockets) y la tanda salía así:
//
//     not ok 1 - tests\scrum960-nif-del-proveedor.test.mjs   exitCode 3221226505 (0xC0000409)
//     # tests 9 · # pass 8 · # fail 1
//
// O sea: el FICHERO en ROJO con sus OCHO TESTS EN VERDE. El aborto de node dice qué pasa —
// `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` —: `--test-force-exit` mata el proceso
// mientras un handle de socket está vivo o a medio cerrar. Lo medido, en orden:
//
//     un servidor por test, cerrando con await ......... 1 de 5 y 2 de 8 pasadas en rojo
//     + closeAllConnections() y `Connection: close` .... 2 de 8   (no era el keep-alive)
//     un solo servidor, sin cerrar .................... 10 de 10  (peor, pero DETERMINISTA)
//     sin socket, router en proceso ................... 0 de 10 ✅
//
// El contraste que lo acotó: `scrum912`, con el arnés de servidor pero menos ciclos de cierre,
// dio 0 fallos en 8 pasadas. No era «el arnés está mal»: era la cantidad de sockets.
//
// 🔒 Un fichero de test puede salir ROJO con todos sus tests en VERDE; ese rojo no habla del
//    código, habla del arnés. Y como empezó siendo una CARRERA, la primera pasada salió verde:
//    de habérmela creído, esto entraba en la tanda de todos los días como un intermitente
//    de nadie, de los que se miran seis veces y se culpa a «Windows».
//
// Se invoca el router REAL en proceso, SIN abrir un socket. `express.Router` es una función
// `(req, res, next)`: enruta por `req.method` y `req.url` y rellena `req.params` él mismo, así que
// lo que se ejercita es el handler de verdad, con su enrutado y sus códigos.
//
// Lo que este arnés NO cubre, dicho: el `express.json()` de la aplicación. Aquí el cuerpo se le
// entrega ya parseado, igual que se lo entregaría el parser. El camino HTTP completo —incluido el
// parser y los códigos por la red— está medido aparte, en `docs/master/evidencias/SCRUM-960/paso0.mjs`.
function pedir(metodo, ruta, cuerpo) {
  escrituras.length = 0;
  return new Promise((resolve, reject) => {
    const req = { method: metodo, url: ruta, body: cuerpo === undefined ? {} : cuerpo, merchantId: 1, headers: {} };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(cuerpoJson) { resolve({ status: this.statusCode, json: cuerpoJson, escrituras: escrituras.slice() }); return this; },
    };
    router(req, res, (err) => (err ? reject(err) : resolve({ status: 404, json: null, escrituras: escrituras.slice() })));
  });
}

/** Se conserva la forma `conApp(fn)` para que cada test se lea igual. */
const conApp = (fn) => fn(pedir);

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
