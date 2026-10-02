// tests/scrum1232-libro-sin-justificantes.test.mjs — SCRUM-1232 · el libro registro de facturas
// EXPEDIDAS deja de meter justificantes; el 303 NO se toca.
//
// La salida la eligió la norma, no una preferencia (SCRUM-1232b, `docs/master/SCRUM-1232.md`):
//
//   · el libro de expedidas son FACTURAS y nada más (RIVA 62.1.a y 63) → se excluye el justificante,
//     en la pantalla y en el libro que se entrega a la AEAT;
//   · el 303 declara lo DEVENGADO, no lo documentado (LIVA 75/167, RIVA 71) → el justificante SIGUE
//     ahí. Sacarlo del 303 infradeclararía IVA que sí se debe.
//
// GO del fundador en SCRUM-1232, comentario 17435.
//
// ⚠️ SE MIDE EJECUTANDO EL CAMINO REAL: las rutas y los lectores de `dist/`, con un cliente Prisma
// falso en memoria. Ninguna base. Las dos rutas cogen el cliente del singleton de
// `core/db/prisma`, que respeta `global.prisma` si ya existe: se le pone el falso ANTES de cargarlas.
//
// 🔴 EL CRITERIO ES EL `type`, Y SÓLO EL `type`. El código de hoy decide «es justificante» por `type`
// **o** por número `J-` (`receipt.routes.ts:104`, `invoiceAdmin.ts:251`), y el censo del 10-ago-2026
// contó 5 documentos `F1` con número `J-`. La primera versión de este arreglo los sacaba del libro por
// el número. El fundador dijo qué son (28-sep-2026, transmitido por el orquestador): «Todos deberían ser
// facturas». Son FACTURAS con el número mal puesto, y se QUEDAN en el libro. La muestra lleva una, y
// hay un caso que cae si alguien vuelve a filtrar por el número (SCRUM-1252 decide qué hacer con ellas).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url'; import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(path.join(RAIZ, 'package.json'));

const MIO = 7;
const OTRO = 8;
const DIA = new Date('2026-08-10T10:00:00.000Z'); // 3T-2026

const fila = (id, merchantId, number, type, precio) => ({
  id, merchantId, number, createdAt: DIA, paidAt: DIA, type,
  total: Math.round(precio * 121) / 100, currency: 'EUR', status: 'paid',
  customerId: null, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Trabajo', qty: 1, price: precio, tax: 0.21 }],
});

/** La muestra. Cada fila está por un motivo, y el motivo va al lado. */
const FILAS = [
  fila(1, MIO, 'F260001', 'F1', 100),           // factura normal: TIENE que seguir (el positivo)
  fila(2, MIO, 'J-2026-0001', 'JUST', 200),     // justificante por `type`
  fila(3, MIO, 'J-20260805-AB12', 'F1', 50),    // 🔴 `F1` con número `J-`: es FACTURA y se queda (censo 10-ago: 5)
  fila(4, MIO, 'R260001', 'R1', -100),          // rectificativa: es factura, sigue
  fila(5, MIO, null, 'F1', 10),                 // sin número: no es asiento, pero se sigue DECLARANDO
  fila(6, OTRO, 'J-2026-0099', 'JUST', 999),    // otro merchant: la consulta ni lo trae
];
const F1_CON_NUMERO_J = 'J-20260805-AB12';
const FACTURAS_QUE_QUEDAN = ['F260001', F1_CON_NUMERO_J, 'R260001'];
const JUSTIFICANTES_MIOS = ['J-2026-0001'];

/**
 * El cliente falso. Aplica `merchantId` y, si se lo piden, `type: { not }` —como haría Postgres—, para
 * no premiar ni castigar que el filtro viva en el `where` o en el código. `fuga` simula el agujero de
 * tenencia de SCRUM-348: devuelve TAMBIÉN las filas de otro merchant.
 */
function clienteFalso({ fuga = false } = {}) {
  const pedidos = [];
  return {
    pedidos,
    invoice: {
      findMany: async (a) => {
        pedidos.push(a.where);
        const w = a.where ?? {};
        return FILAS.filter((r) => (fuga || r.merchantId === w.merchantId)
          && (!w.type || w.type.not === undefined || r.type !== w.type.not));
      },
    },
    quote: { findMany: async () => [] },
    albaran: { findMany: async () => [] },
    expense: { findMany: async () => [] },
    customer: { findMany: async () => [] },
    merchant: { findUnique: async () => ({ id: MIO, country: 'ES' }) },
  };
}

const db = clienteFalso();
globalThis.prisma = db; // ANTES de cargar las rutas: `core/db/prisma` se queda con éste.

const { leerLibroRegistro } = require('./dist/modules/invoicing/domain/libroRegistro.repo.js');
const { leerModelo303 } = require('./dist/modules/fiscal/modelo303/modelo303.repo.js');
const rutaLibro = require('./dist/modules/invoicing/app/routes/libroRegistro.routes.js').default;
const rutaLibrosAeat = require('./dist/modules/fiscal/librosAeat/librosAeat.routes.js').default;

assert.equal(require('./dist/core/db/prisma.js').prisma, db,
  '🔴 el singleton de Prisma no es el cliente falso: las rutas estarían hablando con otra cosa.');

/** Llama al manejador REAL de una ruta GET del router, con una respuesta de mentira. */
async function llamar(router, ruta, query = {}) {
  const capa = router.stack.find((c) => c.route && c.route.path === ruta && c.route.methods.get);
  assert.ok(capa, `🔴 el router no tiene GET ${ruta}: el test no está midiendo la ruta.`);
  const res = {
    statusCode: 200, cabeceras: {}, cuerpo: undefined,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.cabeceras[k.toLowerCase()] = v; },
    json(b) { this.cuerpo = b; return this; },
    send(b) { this.cuerpo = b; return this; },
  };
  await capa.route.stack[0].handle(reqDeSesion({ rol: 'admin', merchantId: MIO, query }), res, (e) => { throw e ?? new Error('next'); });
  return res;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL LIBRO QUE VE EL PROFESIONAL (GET /admin/libro-registro)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1232 · el libro de la pantalla NO trae justificantes (`type JUST`)', async () => {
  const res = await llamar(rutaLibro, '/');
  assert.equal(res.statusCode, 200, `🔴 la ruta no ha contestado 200: ${JSON.stringify(res.cuerpo)}`);
  const numeros = res.cuerpo.asientos.map((a) => a.numero);

  for (const j of JUSTIFICANTES_MIOS) {
    assert.ok(!numeros.includes(j),
      `🔴 «${j}» sigue en el «Libro registro de facturas expedidas». Un justificante no es una ` +
      'factura (RIVA 63: el libro son las facturas expedidas, y nada más).');
  }
});

test('SCRUM-1232 · una F1 con número J- SE QUEDA en el libro: es una factura con el número mal puesto', async () => {
  // El fundador, 28-sep-2026: «Todos deberían ser facturas». Filtrar por el número le quitaría
  // facturas a un libro que se entrega al gestor, y un libro al que le faltan facturas es peor que
  // uno que mete justificantes. Si esto cae, alguien ha vuelto a poner el criterio del número.
  const { cuerpo } = await llamar(rutaLibro, '/');
  assert.ok(cuerpo.asientos.some((a) => a.numero === F1_CON_NUMERO_J),
    `🔴 «${F1_CON_NUMERO_J}» (type F1, número J-) ha salido del libro. Es una FACTURA: el criterio es el ` +
    '`type`, no el número (fundador, 28-sep-2026, SCRUM-1232). Filtrar por el número quita facturas.');
  const csv = String((await llamar(rutaLibrosAeat, '/expedidas.csv', { 'año': '2026', trimestre: '3' })).cuerpo);
  assert.ok(csv.includes(F1_CON_NUMERO_J),
    `🔴 «${F1_CON_NUMERO_J}» (type F1, número J-) ha salido del libro de la AEAT. Es una FACTURA.`);
});

test('SCRUM-1232 · POSITIVO: las facturas de verdad siguen en el libro — un filtro que se lleva de más es peor', async () => {
  const { cuerpo } = await llamar(rutaLibro, '/');
  assert.deepEqual(cuerpo.asientos.map((a) => a.numero), FACTURAS_QUE_QUEDAN,
    '🔴 el libro ha perdido (o ganado) facturas que no son justificantes.');
  // La factura sin número NO es asiento, pero se sigue declarando. Si el filtro fuera un `NOT` en el
  // `where`, Postgres la tiraría en silencio (NOT (NULL LIKE 'J-%') es NULL): este par lo vigila.
  assert.equal(cuerpo.sinNumero, 1, '🔴 la factura sin número ha dejado de declararse.');
  assert.equal(cuerpo.miradas, 4,
    '🔴 `miradas` tiene que contar las FACTURAS examinadas (las dos F1, la R1 y la sin número). Si contara los ' +
    'justificantes, un merchant que sólo tuviera justificantes vería «el libro no cuadra».');
  assert.equal(cuerpo.justificantesFuera, JUSTIFICANTES_MIOS.length,
    '🔴 los justificantes se han quitado sin DECLARARLO. Lo que un libro fiscal descarta se cuenta.');
});

test('SCRUM-1232 · con SÓLO justificantes el libro dice «no hay», no «no cuadra»', async () => {
  const solos = { ...clienteFalso(), invoice: { findMany: async () => [FILAS[1]] } };
  const libro = await leerLibroRegistro(solos, { merchantId: MIO, soloFacturas: true });
  assert.equal(libro.asientos.length, 0);
  assert.equal(libro.miradas, 0,
    '🔴 cero asientos con `miradas > 0` pinta el aviso de DESCUADRE («el libro no cuadra»), que ' +
    'sería falso: no había ninguna factura, había justificantes.');
  assert.equal(libro.justificantesFuera, 1);
});

test('SCRUM-1232 · un justificante AJENO que se cuele no desaparece: sigue contando en `ajenas`', async () => {
  // El filtro de justificantes no puede tapar una fuga de tenencia (SCRUM-348): lo de otro
  // merchant tiene que llegar al constructor, que lo cuenta y la pantalla avisa.
  const libro = await leerLibroRegistro(clienteFalso({ fuga: true }), { merchantId: MIO, soloFacturas: true });
  assert.equal(libro.ajenas, 1, '🔴 el justificante del otro merchant se ha filtrado en silencio en vez de contarse.');
  assert.equal(libro.justificantesFuera, 1, '🔴 un justificante ajeno se ha contado como mío.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL LIBRO QUE SE ENTREGA (GET /exports/libros-aeat/expedidas.csv)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1232 · el libro de expedidas para la AEAT tampoco lleva justificantes', async () => {
  const res = await llamar(rutaLibrosAeat, '/expedidas.csv', { 'año': '2026', trimestre: '3' });
  assert.equal(res.statusCode, 200, `🔴 la ruta no ha contestado 200: ${String(res.cuerpo).slice(0, 200)}`);
  const csv = String(res.cuerpo);
  for (const j of JUSTIFICANTES_MIOS) {
    assert.ok(!csv.includes(j), `🔴 «${j}» sale en el libro de expedidas que se entrega a la AEAT.`);
  }
  for (const f of FACTURAS_QUE_QUEDAN) {
    assert.ok(csv.includes(f), `🔴 la factura «${f}» ha desaparecido del libro de la AEAT.`);
  }
  assert.equal(res.cabeceras['x-yaqu-miradas'], '4');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ EL 303 NO SE TOCA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1232 · ⛔ el 303 SIGUE declarando el IVA de los justificantes (lo devengado, no lo documentado)', async () => {
  const m = await leerModelo303(clienteFalso(), { merchantId: MIO, año: 2026, trimestre: 3 });
  // Lo esperado se DERIVA de la muestra, no se copia: todo lo numerado del merchant, justificantes
  // incluidos. La sin número nunca fue asiento, y no entra ni antes ni después.
  const numeradas = FILAS.filter((r) => r.merchantId === MIO && r.number);
  const base = numeradas.reduce((s, r) => s + r.lines[0].price, 0);
  const cuota = Math.round(base * 0.21 * 100) / 100;
  assert.equal(m.totalBase, base,
    '🔴 la base del 303 ha cambiado. Quitar el justificante del 303 INFRADECLARA: la operación ' +
    'devenga IVA aunque no se documente (LIVA 75). El GO de SCRUM-1232 lo excluye expresamente.');
  assert.equal(m.casillaTotalCuota.valor, cuota, '🔴 la casilla 27 del 303 ha cambiado.');
});

test('SCRUM-1232 · el 303 pide el libro SIN el filtro de facturas', async () => {
  // El par del test anterior, por la otra cara: si mañana alguien pone el filtro por defecto, el
  // 303 lo heredaría sin que su propio código cambiara una letra.
  const x = clienteFalso();
  const conFiltro = await leerLibroRegistro(x, { merchantId: MIO, soloFacturas: true });
  const sinFiltro = await leerLibroRegistro(x, { merchantId: MIO });
  assert.equal(conFiltro.asientos.length, 3);
  assert.equal(sinFiltro.asientos.length, 4,
    '🔴 `leerLibroRegistro` sin `soloFacturas` ya no trae los justificantes: el 303, las evidencias ' +
    'e Informes han cambiado de población sin GO.');
  assert.equal(sinFiltro.justificantesFuera, undefined);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL RECUENTO — firmado sólo DENTRO de este arreglo (comentario 17435)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1232 · el recuento concuerda en singular: «1 factura», no «1 facturas»', () => {
  const ctx = { document: { createElement: () => ({}) }, window: {}, Intl, Date, Array, Number, String, Boolean, Object, JSON, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/libroRegistroView.js'), 'utf8'), ctx);
  const COPY = ctx.window.LIBRO_COPY;
  assert.equal(typeof COPY?.recuento, 'function', '🔴 la vista no publica `LIBRO_COPY.recuento`.');
  assert.equal(COPY.recuento(1), '1 factura', `🔴 con un asiento pinta «${COPY.recuento(1)}».`);
  assert.equal(COPY.recuento(2), '2 facturas');
  assert.equal(COPY.recuento(0), '0 facturas');
});
