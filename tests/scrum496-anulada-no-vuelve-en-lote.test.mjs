// tests/scrum496-anulada-no-vuelve-en-lote.test.mjs — SCRUM-496
//
// UNA FACTURA ANULADA NO VUELVE — TAMPOCO POR LA PUERTA DE CIEN.
//
// SCRUM-153 cerró esto en `updateInvoiceStatusAdmin`: un `PATCH status:'paid'` sobre una anulada la
// resucitaba como pagada. El censo de SCRUM-441 encontró que **la puerta masiva seguía abierta**:
// `bulk-paid` filtraba `status: { not: 'paid' }`, y eso INCLUYE `annulled`. Un documento dado de
// baja ante la AEAT, con su registro de anulación sellado y encadenado, podía reaparecer como
// cobrado — y por `updateMany`, sin auditoría por fila.
//
// 🔴 EL TEST SE ATA AL HECHO, NO A LA FORMA DEL FILTRO. Comprobar que el `where` dice `notIn`
// seguiría verde si alguien lo cambiara por otro filtro equivalente y roto. Aquí se ejercita la
// REGLA contra filas de verdad: una anulada no es seleccionable, pase lo que pase con la sintaxis.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const {
  puedeMarcarsePagadaEnLote, NO_SE_MARCAN_PAGADAS_EN_LOTE, ESTADO_ANULADA,
} = require_(path.join(RAIZ, 'dist/modules/system/invoiceAdmin.js'));

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-496 · SUELO: la regla existe y se puede ejercitar', () => {
  assert.equal(typeof puedeMarcarsePagadaEnLote, 'function',
    '🔴 la regla no está exportada: lo de abajo no mediría nada.');
  // Control positivo del instrumento: una PENDIENTE sí se puede marcar. Sin esto, un `false`
  // constante pasaría todos los asserts de abajo y el guard sería decorativo.
  assert.equal(puedeMarcarsePagadaEnLote({ status: 'pending' }), true,
    '🔴 ni una pendiente se puede marcar: la regla dice que no a todo y no prueba nada.');
});

// ── EL HECHO ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-496 · 🔴 UNA ANULADA NO ACABA EN `paid` POR ESTA RUTA', () => {
  assert.equal(puedeMarcarsePagadaEnLote({ status: ESTADO_ANULADA }), false,
    '🔴 UNA FACTURA ANULADA SE PUEDE MARCAR COMO COBRADA EN LOTE.\n\n' +
    '  Es un documento dado de baja ante la AEAT, con su registro de anulación sellado y\n' +
    '  encadenado, reapareciendo como cobrado — y por `updateMany`, sin auditoría por fila.\n' +
    '  La Parte L declara `pending → annulled` y NO declara ninguna transición que salga de\n' +
    '  `annulled`: esto no es una regla nueva, es la que ya estaba escrita (regla 27).');
});

test('SCRUM-496 · 🔴 el lote, ejercitado sobre filas de verdad', () => {
  // La población que llegaría del `where`: se aplica la regla y se mira QUÉ QUEDA.
  const filas = [
    { id: 1, status: 'pending' },
    { id: 2, status: 'paid' },
    { id: 3, status: ESTADO_ANULADA },
    { id: 4, status: 'expired' },
    { id: 5, status: 'pending' },
  ];
  const seleccionadas = filas.filter(puedeMarcarsePagadaEnLote).map((f) => f.id);

  assert.deepEqual(seleccionadas, [1, 4, 5],
    `🔴 el lote selecciona ${JSON.stringify(seleccionadas)}. La anulada (id 3) no puede estar, y ` +
    'las pendientes y la caducada sí — si desaparecieran, el arreglo habría roto el marcado masivo.');

  // Y el suelo del propio caso: si la fixture no tuviera una anulada, el assert de arriba pasaría
  // vacío y no habría probado nada.
  assert.ok(filas.some((f) => f.status === ESTADO_ANULADA),
    '🔴 la fixture no tiene ninguna anulada: el caso no reproduce el defecto.');
});

test('SCRUM-496 · marcar en lote SIGUE funcionando para lo que sí se puede', () => {
  // CONTROL NEGATIVO: el arreglo no puede haber apagado la función. `expired` y `pending` entran.
  for (const estado of ['pending', 'expired', 'draft', 'sent']) {
    assert.equal(puedeMarcarsePagadaEnLote({ status: estado }), true,
      `🔴 «${estado}» ha dejado de poder marcarse en lote. El arreglo ha ido más lejos de lo que ` +
      'debía y el profesional pierde el marcado masivo.');
  }
});

// ── QUE LA REGLA LLEGUE A LA CONSULTA ────────────────────────────────────────────────────────

test('SCRUM-496 · la ruta CONSUME el conjunto, no escribe una copia', () => {
  const ruta = fs.readFileSync(
    path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');

  assert.match(ruta, /NO_SE_MARCAN_PAGADAS_EN_LOTE/,
    '🔴 la ruta ya no consume el conjunto de `invoiceAdmin.ts`. Si escribe su propia lista de ' +
    'estados, las dos puertas del mismo documento pueden discrepar — que es este ticket entero.');

  // Y el literal viejo no puede volver: es exactamente el filtro que dejaba pasar las anuladas.
  const sinComentarios = ruta.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.equal(sinComentarios.includes("status: { not: 'paid' }"), false,
    "🔴 ha vuelto `status: { not: 'paid' }`, que INCLUYE `annulled`.");
});

test('SCRUM-496 · la guarda de UNA factura y la del lote hablan del MISMO estado', () => {
  const servicio = fs.readFileSync(path.join(RAIZ, 'src/modules/system/invoiceAdmin.js'.replace('.js', '.ts')), 'utf8');
  assert.match(servicio, /existing\.status === ESTADO_ANULADA/,
    '🔴 la guarda de una sola factura ha vuelto a un literal suelto. Entonces el lote y ella pueden ' +
    'dejar de hablar del mismo estado sin que nada salte.');
  assert.ok((NO_SE_MARCAN_PAGADAS_EN_LOTE || []).includes(ESTADO_ANULADA),
    '🔴 el conjunto del lote ya no contiene el estado anulada.');
});
