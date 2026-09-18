// tests/scrum937-el-nif-no-se-tira-en-silencio.test.mjs — SCRUM-937
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL NIF QUE TECLEA EL PROFESIONAL, O LLEGA A LA FICHA, O SE DICE QUE NO LLEGÓ
//
// SCRUM-324 (E3) decidió —y lo dejó escrito en tres sitios— que el NIF del proveedor NO es un
// campo del gasto: vive en `Provider.taxId`, y el veredicto del justificante lo lee de ahí. Esa
// decisión NO se toca aquí. Lo que se mide es lo que el PASO 0 encontró CORRIENDO el alta:
//
//   · con proveedor elegido y sin NIF en su ficha, el NIF tecleado llega a la ficha y cuenta;
//   · SIN proveedor elegido, el NIF no se guarda en NINGÚN sitio, el veredicto dice que falta, y
//     la respuesta 201 no lo menciona — el profesional cree que ha completado su justificante;
//   · en la EDICIÓN, el modal manda `nifProveedor` por PUT y la ruta ni lo lee.
//
// El arreglo es de dónde llega un dato, no de qué se afirma con él: el motor del justificante y
// sus veredictos no se tocan (bloqueados por SCRUM-324 E3), y este fichero lo comprueba.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// · Las RUTAS de verdad (`dist/…/expenses.routes.js`) y el SERVICIO de verdad, con la base doblada
//   por `_envio-doblado.mjs`. Ese doble no tiene estado; el poco que hace falta —UNA ficha de
//   proveedor y UN gasto— lo lleva este banco en sus propias respuestas, y el `updateMany` evalúa
//   el `where` que de verdad evaluaría Postgres (`taxId: null`), porque es justo lo que se mide.
// · Se llama al ÚLTIMO manejador de cada ruta, el del trabajo: `requireRole` no es de este ticket.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
const PROVEEDOR_ID = 937;
const GASTO_ID = 9370;

/** Un gasto con el desglose fiscal ENTERO: lo único que puede faltarle es el NIF. */
const DESGLOSE = {
  concept: 'Tubo de cobre 22 mm', amount: 121, baseAmount: 100, vatRate: 21, vatAmount: 21,
  providerInvoiceNumber: 'FV-2026-0937', providerInvoiceDate: '2026-09-10', date: '2026-09-10',
};

/**
 * La base doblada, con estado para lo que se mide.
 * `ficha` es el proveedor tal y como está en la base (o `null` si no hay ninguno).
 * `gasto` es el gasto que ya existe, para la edición.
 */
function banco({ ficha = null, gasto = null } = {}) {
  const estado = {
    ficha: ficha && { ...ficha },
    gasto: gasto && { ...gasto },
    /** Cada `provider.updateMany`, con su `where` y su `data`, tal cual. */
    escriturasEnLaFicha: [],
    /** Cada `expense.update`, con su `data`, tal cual. */
    escriturasEnElGasto: [],
  };
  const esLaFicha = (where) =>
    estado.ficha && where.id === estado.ficha.id && where.merchantId === estado.ficha.merchantId;

  inyectarBase({
    'provider.findFirst': ({ where }) => (esLaFicha(where) ? { ...estado.ficha } : null),
    'provider.updateMany': ({ where, data }) => {
      estado.escriturasEnLaFicha.push({ where, data });
      // Lo que haría Postgres con `taxId: null` en el `where`: si la ficha ya tiene NIF, 0 filas.
      if (esLaFicha(where) && (!('taxId' in where) || (where.taxId === null && estado.ficha.taxId == null))) {
        Object.assign(estado.ficha, data);
        return { count: 1 };
      }
      return { count: 0 };
    },
    'quote.findFirst': () => null,
    'expense.create': ({ data }) => ({ id: GASTO_ID, vatDeducible: null, ...data }),
    'expense.findFirst': ({ where }) =>
      (estado.gasto && where.id === estado.gasto.id && where.merchantId === estado.gasto.merchantId ? { ...estado.gasto } : null),
    'expense.update': ({ where, data }) => {
      estado.escriturasEnElGasto.push({ where, data });
      Object.assign(estado.gasto, data);
      return { ...estado.gasto };
    },
  }, [SERVICIO, RUTAS]);

  const router = moduloDeDist(RUTAS).default;
  const manejador = (metodo, ruta) => {
    const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
    assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router de gastos`);
    const pila = capa.route.stack;
    return pila[pila.length - 1].handle;
  };
  const llamar = (metodo, ruta) => async ({ body, params = {} }) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = JSON.parse(JSON.stringify(j)); return res; } };
    await manejador(metodo, ruta)({ body, params, merchantId: MERCHANT, userRole: 'admin', teamMemberId: null }, res);
    return r;
  };
  return {
    estado,
    alta: (body) => llamar('post', '/')({ body }),
    edicion: (body) => llamar('put', '/:id')({ body, params: { id: String(GASTO_ID) } }),
  };
}

const fichaSinNif = () => ({ id: PROVEEDOR_ID, merchantId: MERCHANT, name: 'Almacenes Sur', taxId: null });
const fichaConNif = (taxId = 'A11111111') => ({ id: PROVEEDOR_ID, merchantId: MERCHANT, name: 'Almacenes Sur', taxId });
const gastoGuardado = (extra = {}) => ({
  id: GASTO_ID, merchantId: MERCHANT, providerId: null, quoteId: null, ...DESGLOSE,
  date: new Date(DESGLOSE.date), providerInvoiceDate: new Date(DESGLOSE.providerInvoiceDate), vatDeducible: null, ...extra,
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — el banco ve lo que tiene que ver
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-937 · 🔴 SUELO: el alta de verdad responde 201 y el banco ve la escritura en la ficha', async () => {
  const b = banco({ ficha: fichaSinNif() });
  const r = await b.alta({ ...DESGLOSE, providerId: PROVEEDOR_ID, nifProveedor: 'B12345678' });
  assert.equal(r.status, 201, `🔴 SUELO: el alta respondió ${r.status}: ${JSON.stringify(r.data)}`);
  assert.equal(b.estado.escriturasEnLaFicha.length, 1,
    '🔴 SUELO: el banco no ve ninguna escritura en la ficha del proveedor; todo lo de abajo sería un verde vacío.');
  assert.equal(b.estado.ficha.taxId, 'B12345678');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ALTA — que la respuesta diga qué fue del NIF
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-937 · 🔴 EL DEFECTO: NIF tecleado SIN proveedor → la respuesta lo DICE en vez de tragárselo', async () => {
  const b = banco();
  const r = await b.alta({ ...DESGLOSE, nifProveedor: 'B12345678' });
  assert.equal(r.status, 201, 'el gasto se sigue guardando: no es un error del usuario, es un dato sin destino');
  assert.equal(r.data.destinoDelNif, 'sin_proveedor',
    `🔴 la respuesta no dice que el NIF se ha quedado sin sitio (destinoDelNif = ${JSON.stringify(r.data.destinoDelNif)}). `
    + 'El profesional cree que ha completado su justificante, y no lo ha hecho.');
  assert.equal(b.estado.escriturasEnLaFicha.length, 0, 'sin proveedor no hay ficha que escribir');
});

test('SCRUM-937 · el motor del justificante NO se toca: sin proveedor sigue faltando el NIF', async () => {
  // NEGATIVO del ticket. Lo que cambia es que se DICE; lo que se afirma con el dato es lo de siempre.
  const b = banco();
  const r = await b.alta({ ...DESGLOSE, nifProveedor: 'B12345678' });
  assert.ok(r.data.justificante, '🔴 el alta ya no devuelve el veredicto');
  assert.ok(r.data.justificante.faltan.includes('nif_proveedor'),
    `🔴 el veredicto ha cambiado: ${JSON.stringify(r.data.justificante)}. Esto no es de este ticket.`);
});

test('SCRUM-937 · CONTROL POSITIVO: con proveedor sin NIF, el NIF llega a la ficha, cuenta, y se dice', async () => {
  const b = banco({ ficha: fichaSinNif() });
  const r = await b.alta({ ...DESGLOSE, providerId: PROVEEDOR_ID, nifProveedor: 'B12345678' });
  assert.equal(b.estado.ficha.taxId, 'B12345678');
  assert.ok(!r.data.justificante.faltan.includes('nif_proveedor'),
    `el veredicto sigue pidiendo el NIF aunque está en la ficha: ${JSON.stringify(r.data.justificante)}`);
  assert.equal(r.data.destinoDelNif, 'en_la_ficha');
});

test('SCRUM-937 · la ficha que YA tenía otro NIF no se pisa, y se dice', async () => {
  // La decisión de SCRUM-324: el de la ficha lo puso alguien mirando una factura. Gana, pero no en silencio.
  const b = banco({ ficha: fichaConNif('A11111111') });
  const r = await b.alta({ ...DESGLOSE, providerId: PROVEEDOR_ID, nifProveedor: 'B99999999' });
  assert.equal(b.estado.ficha.taxId, 'A11111111', '🔴 se ha pisado el NIF que ya estaba en la ficha');
  assert.equal(r.data.destinoDelNif, 'la_ficha_tiene_otro');
});

test('SCRUM-937 · sin NIF tecleado, la respuesta no inventa un destino', async () => {
  const b = banco({ ficha: fichaConNif() });
  const r = await b.alta({ ...DESGLOSE, providerId: PROVEEDOR_ID });
  assert.equal(r.data.destinoDelNif, null);
  assert.equal(b.estado.escriturasEnLaFicha.length, 0);
});

test('SCRUM-937 · el mismo NIF con otras mayúsculas o espacios no es «otro»', async () => {
  const b = banco({ ficha: fichaConNif('B12345678') });
  const r = await b.alta({ ...DESGLOSE, providerId: PROVEEDOR_ID, nifProveedor: '  b12345678 ' });
  assert.equal(r.data.destinoDelNif, 'en_la_ficha');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA EDICIÓN — la otra puerta del mismo silencio
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-937 · 🔴 EL DEFECTO: editar un gasto con proveedor sin NIF y teclearlo → llega a la ficha', async () => {
  const b = banco({ ficha: fichaSinNif(), gasto: gastoGuardado({ providerId: PROVEEDOR_ID }) });
  const r = await b.edicion({ concept: DESGLOSE.concept, nifProveedor: 'B12345678' });
  assert.equal(r.status, 200, `la edición respondió ${r.status}: ${JSON.stringify(r.data)}`);
  assert.equal(b.estado.ficha.taxId, 'B12345678',
    '🔴 el PUT ha tirado el NIF: el modal de edición lo manda y la ruta no lo lee.');
  assert.equal(r.data.destinoDelNif, 'en_la_ficha');
});

test('SCRUM-937 · la edición que CAMBIA de proveedor guarda el NIF en el proveedor NUEVO', async () => {
  const b = banco({ ficha: fichaSinNif(), gasto: gastoGuardado({ providerId: null }) });
  const r = await b.edicion({ providerId: PROVEEDOR_ID, nifProveedor: 'B12345678' });
  assert.equal(b.estado.ficha.taxId, 'B12345678',
    '🔴 el NIF no ha ido al proveedor que se acaba de elegir en la misma edición');
  assert.equal(r.data.destinoDelNif, 'en_la_ficha');
});

test('SCRUM-937 · 🔴 EL DEFECTO: editar SIN proveedor y teclear el NIF → la respuesta lo dice', async () => {
  const b = banco({ gasto: gastoGuardado({ providerId: null }) });
  const r = await b.edicion({ concept: DESGLOSE.concept, nifProveedor: 'B12345678' });
  assert.equal(r.status, 200);
  assert.equal(r.data.destinoDelNif, 'sin_proveedor');
});

test('SCRUM-937 · el NIF NO viaja a la fila del gasto (no es columna de Expense: Prisma la rechazaría)', async () => {
  const b = banco({ ficha: fichaSinNif(), gasto: gastoGuardado({ providerId: PROVEEDOR_ID }) });
  await b.edicion({ concept: DESGLOSE.concept, nifProveedor: 'B12345678' });
  assert.equal(b.estado.escriturasEnElGasto.length, 1, 'SUELO: el banco no ve el update del gasto');
  assert.ok(!('nifProveedor' in b.estado.escriturasEnElGasto[0].data),
    `🔴 \`nifProveedor\` ha llegado al \`expense.update\`: ${JSON.stringify(b.estado.escriturasEnElGasto[0].data)}`);
});

test('SCRUM-937 · una edición SIN NIF no toca la ficha del proveedor (esto no se ha movido)', async () => {
  const b = banco({ ficha: fichaSinNif(), gasto: gastoGuardado({ providerId: PROVEEDOR_ID }) });
  const r = await b.edicion({ concept: 'Otro concepto' });
  assert.equal(r.status, 200);
  assert.equal(b.estado.escriturasEnLaFicha.length, 0);
  assert.equal(b.estado.ficha.taxId, null);
  assert.equal(r.data.destinoDelNif, null);
});

test('SCRUM-937 · la escritura en la ficha filtra por merchant y por «sin NIF» (multi-tenant y no pisar)', async () => {
  const b = banco({ ficha: fichaSinNif(), gasto: gastoGuardado({ providerId: PROVEEDOR_ID }) });
  await b.edicion({ nifProveedor: 'B12345678' });
  assert.equal(b.estado.escriturasEnLaFicha.length, 1, 'SUELO: no se ve la escritura');
  assert.deepEqual(b.estado.escriturasEnLaFicha[0].where, { id: PROVEEDOR_ID, merchantId: MERCHANT, taxId: null });
});
