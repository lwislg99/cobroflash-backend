// tests/scrum445-cobros-sin-duplicar.test.mjs — SCRUM-445
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: un profesional abre Cobros para repasar lo que ha entrado este mes y ve cada cobro
// por pasarela DOS VECES. **En la pantalla del dinero, ver el doble es peor que no ver.**
//
// 🔴 Y EL DEFECTO NO ES UN DESCUIDO DE UNA LÍNEA: la fusión de SCRUM-285 se diseñó contra una
// propiedad que nadie comprobó que existiera. Decía que `chargeId: null` impedía contar dos veces
// —«si la factura tiene charge, el charge ya la representa»— y **`Invoice.chargeId` no lo escribe
// nadie en todo el árbol**. El campo está en el esquema, es nullable, y parecía escrito. Es el
// mismo defecto que `Job.direccion` en otra tabla: una columna declarada que nadie rellena, con un
// mecanismo apoyado encima como si estuviera llena.
//
// El vínculo que SÍ existe es el `Event{ chargeId, type: 'invoiced', payload.invoice_id }`, y por
// eso la desduplicación arregla **también los históricos**: ese evento se lleva escribiendo desde
// siempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fundirCobros } from '../dist/modules/billing/domain/cobros.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICIO = fs.readFileSync(
  path.join(RAIZ, 'src/modules/billing/domain/cobros.service.ts'), 'utf8');

const d = (iso) => new Date(iso);

/** Un cobro por PASARELA: su `Charge` y el justificante que generó, atados por el evento. */
const CHARGE_PASARELA = {
  id: 11, createdAt: d('2026-08-01T10:00:00Z'), amount: '100.00', currency: 'EUR',
  method: 'card', status: 'paid', concept: 'Reforma', reference: 'ref-1',
  customer: { name: 'Con pasarela' },
};
const JUSTIFICANTE_DE_ESE_CHARGE = {
  id: 501, createdAt: d('2026-08-01T10:05:00Z'), total: '100.00', currency: 'EUR',
  status: 'paid', number: 'J-20260801-AAAA', type: 'JUST', customer: { name: 'Con pasarela' },
};
const EVENTO_QUE_LOS_ATA = { payload: { invoice_id: 501 } };

/** Un cobro marcado A MANO: no hay `Charge` ni evento. Es el dinero que la fase 1 sacó a la luz. */
const COBRO_A_MANO = {
  id: 502, createdAt: d('2026-08-02T10:00:00Z'), total: '250.00', currency: 'EUR',
  status: 'paid', number: 'J-20260802-BBBB', type: 'JUST', customer: { name: 'A mano' },
};

const TODO = {
  charges: [CHARGE_PASARELA],
  candidatas: [JUSTIFICANTE_DE_ESE_CHARGE, COBRO_A_MANO],
  invoiced: [EVENTO_QUE_LOS_ATA],
};

/** Cuántas veces sale el mismo dinero, por su importe. */
const porImporte = (cobros, importe) => cobros.filter((c) => c.importe === importe);

// ═══ SUELO ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-445 · SUELO: con las dos poblaciones vacías, la fusión no dice «sin duplicados»', () => {
  // 🔴 Una lista vacía hace verdad CUALQUIER «no hay duplicados». Y «sin duplicados» y «solo he
  // leído una mitad» dan el mismo número de filas. El suelo es que el test que decide traiga su
  // control positivo dentro — aquí se fija que el vacío es distinguible.
  assert.deepEqual(fundirCobros({ charges: [], candidatas: [], invoiced: [] }), [],
    '🔴 la fusión inventa filas con las poblaciones vacías.');
  const soloCharges = fundirCobros({ charges: [CHARGE_PASARELA], candidatas: [], invoiced: [] });
  assert.equal(soloCharges.length, 1,
    '🔴 con solo la mitad de `Charge` no devuelve esa mitad: la fusión está leyendo mal una ' +
    'población, y entonces «sin duplicados» no significaría nada.');
  const soloInvoices = fundirCobros({ charges: [], candidatas: [COBRO_A_MANO], invoiced: [] });
  assert.equal(soloInvoices.length, 1,
    '🔴 con solo la mitad de `Invoice` no devuelve esa mitad: mismo problema por el otro lado.');
});

// ═══ ① EL TEST QUE DECIDE, con su control positivo DENTRO ════════════════════════════════

test('SCRUM-445 · ① un cobro por pasarela sale UNA vez, y el marcado a mano SIGUE saliendo', () => {
  const cobros = fundirCobros(TODO);

  // Control positivo primero: sin él, una lista vacía haría verdad todo lo de abajo.
  assert.ok(cobros.length > 0,
    '🔴 la fusión no devuelve NADA. Con la lista vacía «no hay duplicados» es cierto y no ' +
    'significa nada: es el verde hueco que ya apareció hoy en otro ticket.');

  // (a) el de pasarela, UNA vez
  const pasarela = porImporte(cobros, '100.00');
  assert.equal(pasarela.length, 1,
    `🔴 el cobro por pasarela sale ${pasarela.length} veces. En la pantalla del dinero, ver el ` +
    'doble es peor que no ver:\n   ' + pasarela.map((c) => `${c.origen} #${c.id} · ${c.numero ?? '(sin número)'}`).join('\n   '));
  assert.equal(pasarela[0].origen, 'charge',
    '🔴 el que sobrevive tiene que ser el `Charge`: es el que trae el MÉTODO de cobro, que la ' +
    '`Invoice` no guarda. Quedarse con el justificante perdería el dato.');

  // (b) 🔴 EL CONTROL QUE IMPIDE PASARSE DE FRENADA
  const aMano = porImporte(cobros, '250.00');
  assert.equal(aMano.length, 1,
    '🔴 el cobro marcado A MANO ha desaparecido. La desduplicación no puede volver a esconder el ' +
    'dinero que la fase 1 sacó a la luz: transferencia y efectivo no crean `Charge`, así que no ' +
    'tienen evento y NO son duplicados de nada.');
  assert.equal(aMano[0].numero, 'J-20260802-BBBB',
    '🔴 el cobro a mano sale sin su número de justificante.');
});

test('SCRUM-445 · ① CONTROL NEGATIVO: un justificante SIN evento no se quita', () => {
  // Si la desduplicación quitara por «ser justificante» en vez de por «tener charge», este caería.
  const cobros = fundirCobros({ charges: [], candidatas: [JUSTIFICANTE_DE_ESE_CHARGE], invoiced: [] });
  assert.equal(cobros.length, 1,
    '🔴 se ha quitado un justificante que NO está atado a ningún cobro. El criterio es «lo trae su ' +
    'charge», no «es un justificante».');
});

test('SCRUM-445 · ① un evento que apunta a otra factura no se lleva la que no toca', () => {
  const cobros = fundirCobros({
    charges: [CHARGE_PASARELA],
    candidatas: [JUSTIFICANTE_DE_ESE_CHARGE, COBRO_A_MANO],
    invoiced: [{ payload: { invoice_id: 999 } }], // no es ninguna de las dos
  });
  assert.equal(cobros.length, 3,
    '🔴 un evento que apunta a una factura que no está en la lista ha quitado a otra. El cruce ' +
    'tiene que ser por id exacto.');
});

test('SCRUM-445 · ① un payload roto no tumba la lista ni quita de más', () => {
  // El payload es JSON libre: puede venir sin `invoice_id`, con `null`, o con basura.
  const cobros = fundirCobros({
    charges: [],
    candidatas: [COBRO_A_MANO],
    invoiced: [{ payload: null }, { payload: {} }, { payload: { invoice_id: 'nope' } }],
  });
  assert.equal(cobros.length, 1,
    '🔴 un payload sin `invoice_id` usable se ha llevado una fila por delante, o ha reventado.');
});

// ═══ ② LA CONSULTA: que lea de verdad las tres poblaciones ═══════════════════════════════

test('SCRUM-445 · ② `listarCobros` lee las TRES poblaciones — mencionar no es hacer', () => {
  // Que `fundirCobros` desduplique bien no prueba que alguien le pase los eventos.
  assert.match(SERVICIO, /prisma\.event\.findMany/,
    '🔴 el servicio ya no lee los eventos `invoiced`: sin ellos no hay vínculo cobro→justificante ' +
    'y la lista vuelve a duplicar.');
  assert.match(SERVICIO, /type: 'invoiced'/,
    '🔴 la consulta de eventos ya no filtra por `invoiced`.');
  assert.match(SERVICIO, /charge: \{ merchantId \}/,
    '🔴 la consulta de eventos ha perdido el filtro por merchant: estaría leyendo cobros de otro ' +
    'profesional (regla 2).');
  assert.match(SERVICIO, /return fundirCobros\(\{ charges, candidatas, invoiced \}\);/,
    '🔴 `listarCobros` ya no pasa por `fundirCobros`: la desduplicación seguiría escrita y no la ' +
    'usaría nadie.');
});

test('SCRUM-445 · ② el comentario NO vuelve a afirmar que `chargeId` desduplica', () => {
  // El defecto de origen fue una afirmación sobre el esquema que nadie midió. Que el comentario
  // diga hoy la verdad —que ese campo no lo escribe nadie— es parte del arreglo, no decoración.
  assert.match(SERVICIO, /HOY NO EXCLUYE NADA/,
    '🔴 el comentario de `chargeId: null` ha vuelto a presentarlo como si filtrara. Es la ' +
    'afirmación no comprobada que creó este defecto.');
});
