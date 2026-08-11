// tests/scrum445-cobros-duplicados.test.mjs — SCRUM-445 · PASO 0
//
// LA DUPLICACIÓN DE COBROS: REPRODUCIDA, Y CON SU MECANISMO NOMBRADO.
//
// ── EL MECANISMO, no el nombre ──────────────────────────────────────────────────────────────
// `/admin/cobros` funde DOS poblaciones a propósito: los `Charge` (pasarela) y las `Invoice`
// sueltas (dinero marcado a mano, que no genera `Charge`). Fundir las dos fue el ticket anterior y
// **no es el defecto**: sin eso, el dinero cobrado a mano no se veía.
//
// El defecto está en **la clave con la que se desduplica**. Una `Invoice` se descarta solo si existe
// un `Event{type:'invoiced'}` cuyo `payload.invoice_id` sea **`typeof === 'number'`**. Y el campo
// que existe PARA esto —`Invoice.chargeId`— **no lo escribe nadie**: el propio código lo dice
// («hoy NO EXCLUYE NADA»). O sea que **toda la desduplicación cuelga de un solo canal frágil**.
//
// ── REPRODUCIDO, ejecutando la fusión real ──────────────────────────────────────────────────
// Tres formas de que el mismo dinero salga dos veces, todas medidas:
//   · **sin evento** → 2 filas (charge + invoice);
//   · **`invoice_id` como cadena** `"42"` → 2 filas: el filtro de tipo lo descarta;
//   · **payload nulo** → 2 filas.
// Con el evento y un id numérico → **1 fila**. La fusión está bien escrita; lo que es frágil es de
// qué depende.
//
// ── ⚠️ LO QUE ESTE FICHERO NO AFIRMA ────────────────────────────────────────────────────────
// **No he demostrado que hoy ocurra en producción.** El camino normal de pasarela
// (`ensurePdfAndEvent`) SÍ escribe el evento con un id numérico, así que en ese flujo no duplica.
// Lo reproducido es el MECANISMO en aislamiento. Decir «está duplicando» sin ese dato sería
// exactamente lo que este proyecto no hace.
import test from 'node:test';
import assert from 'node:assert/strict';
import fsMod from 'node:fs';
import { fundirCobros } from '../dist/modules/billing/domain/cobros.service.js';

const charge = (id) => ({
  id, createdAt: new Date('2026-08-01'), customer: { name: 'Ana' }, concept: 'Trabajo',
  amount: '121.00', currency: 'EUR', method: 'card', status: 'paid', reference: 'pi_1',
});
const invoice = (id, numero = '2026-CF-0001') => ({
  id, createdAt: new Date('2026-08-01'), customer: { name: 'Ana' },
  total: '121.00', currency: 'EUR', status: 'paid', number: numero, type: 'F1',
});

/**
 * EL MISMO dinero contado dos veces: una fila de `charge` y otra de `invoice`.
 *
 * ⚠️ NO se compara por cliente+importe, y eso lo aprendí de un falso positivo de mi propio
 * detector: **dos cobros legítimos del mismo importe al mismo cliente no son un duplicado**, y con
 * esa heurística salían marcados. Lo que define el duplicado es que la MISMA operación aparezca por
 * los dos orígenes.
 */
function duplicados(filas) {
  const deCharge = filas.filter((c) => c.origen === 'charge');
  const deInvoice = filas.filter((c) => c.origen === 'invoice');
  return deCharge.length > 0 && deInvoice.length > 0
    ? deInvoice.map((i) => `invoice#${i.id} junto a charge#${deCharge[0].id}`)
    : [];
}

test('SCRUM-445 · SUELO: la fusión devuelve filas — si no, no se mide nada', () => {
  // «Cero duplicados» y «la fusión no devuelve nada» son el mismo número con significados
  // opuestos. Sin este suelo, romper `fundirCobros` daría un verde tranquilizador.
  const r = fundirCobros({ charges: [charge(7)], candidatas: [invoice(42)], invoiced: [] });
  assert.ok(r.length >= 2,
    `🔴 ESCÁNER CIEGO: la fusión devuelve ${r.length} filas con dos poblaciones no vacías`);
});

test('SCRUM-445 · CON su evento y un id numérico, el cobro sale UNA vez', () => {
  const r = fundirCobros({
    charges: [charge(7)], candidatas: [invoice(42)], invoiced: [{ payload: { invoice_id: 42 } }],
  });
  assert.deepEqual(duplicados(r), [], '🔴 duplica incluso con el vínculo bien puesto');
  assert.equal(r.length, 1);
});

test('SCRUM-445 · 🔴 REPRODUCIDO: sin evento, el mismo cobro sale DOS veces', () => {
  const r = fundirCobros({ charges: [charge(7)], candidatas: [invoice(42)], invoiced: [] });
  assert.equal(duplicados(r).length, 1,
    '🔴 la duplicación ya no se reproduce por esta vía. Si se ha arreglado, dilo y quita este test; '
    + 'no lo dejes describiendo un mundo que ya cambió.');
});

test('SCRUM-445 · 🔴 REPRODUCIDO: con `invoice_id` como CADENA, sale DOS veces', () => {
  // El filtro exige `typeof id === 'number'`. Un `"42"` se cae, y con él la desduplicación.
  const r = fundirCobros({
    charges: [charge(7)], candidatas: [invoice(42)], invoiced: [{ payload: { invoice_id: '42' } }],
  });
  assert.equal(duplicados(r).length, 1,
    '🔴 ya no duplica con el id como cadena: revisa si el filtro de tipo cambió');
});

test('SCRUM-445 · el dinero marcado A MANO no puede desaparecer al desduplicar', () => {
  // La otra mitad, y pesa igual: fundir las dos poblaciones existe para que el cobro manual se vea.
  // Cualquier arreglo de la duplicación que se lo lleve por delante es peor que el defecto.
  const r = fundirCobros({ charges: [], candidatas: [invoice(42), invoice(43, '2026-CF-0002')], invoiced: [] });
  assert.equal(r.length, 2,
    '🔴 se han perdido cobros marcados a mano. Desduplicar no puede volver a esconder el dinero que '
    + 'la fase anterior sacó a la luz.');
  assert.deepEqual(duplicados(r), [],
    '🔴 dos cobros distintos del mismo importe se están tomando por duplicado: eso es un falso '
    + 'positivo, y un guard que da falsos positivos se acaba silenciando.');
});

// ═══ EL ARREGLO: el vínculo escrito ═══════════════════════════════════════════════════════

test('SCRUM-445 · con `chargeId` escrito, el cobro sale UNA vez SIN necesitar el evento', () => {
  // 🔴 EL ARREGLO. `ensureInvoiceForCharge` ahora escribe `Invoice.chargeId`, así que la factura
  // dice ella misma de qué cobro nació. La desduplicación deja de colgar de un solo canal frágil.
  const r = fundirCobros({
    charges: [charge(7)],
    candidatas: [{ ...invoice(42), chargeId: 7 }],
    invoiced: [], // sin evento: antes duplicaba, ahora no hace falta
  });
  assert.equal(r.length, 1,
    '🔴 con el vínculo escrito sigue duplicando: la fusión no está mirando `chargeId`');
  assert.deepEqual(duplicados(r), []);
});

test('SCRUM-445 · el HISTÓRICO sigue desduplicando por el evento', () => {
  // Los cobros anteriores al arreglo tienen `chargeId` nulo y su único vínculo es el `Event`.
  // Quitar esa vía desduplicaría PEOR que antes para todo lo ya emitido.
  const r = fundirCobros({
    charges: [charge(7)],
    candidatas: [invoice(42)], // sin chargeId, como el histórico
    invoiced: [{ payload: { invoice_id: 42 } }],
  });
  assert.equal(r.length, 1, '🔴 se ha perdido la desduplicación por evento: el histórico vuelve a duplicar');
});

test('SCRUM-445 · CONTROL NEGATIVO: dos cobros legítimos del mismo importe siguen siendo DOS', () => {
  // Es mi propio falso positivo, convertido en test. Dos transferencias de 121 € al mismo cliente
  // son dos cobros, no un duplicado — y ninguna tiene `chargeId`, porque el dinero marcado a mano
  // no crea `Charge` (SCRUM-441).
  const r = fundirCobros({
    charges: [], candidatas: [invoice(42), invoice(43, '2026-CF-0002')], invoiced: [],
  });
  assert.equal(r.length, 2,
    '🔴 se han fundido dos cobros distintos en uno: el arreglo se está comiendo dinero real');
});

test('SCRUM-445 · ROJO POR EL MECANISMO: la escritura de `chargeId` sigue ahí', () => {
  // Los tests de arriba prueban la DECISIÓN (la fusión). Éste prueba que alguien escribe el dato:
  // sin la escritura, la fusión es correcta y la pantalla vuelve a duplicar igual, porque ninguna
  // factura nueva llevaría el vínculo. Es el hueco entre «está bien programado» y «funciona».
  const fs = require$$fs();
  const s = fs.readFileSync(new URL('../src/lib/invoicing.ts', import.meta.url), 'utf8');
  const sinComentarios = s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(sinComentarios, /tx\.invoice\.create\(\{[\s\S]{0,400}?chargeId:\s*ch\.id/,
    '🔴 `ensureInvoiceForCharge` ha DEJADO DE ESCRIBIR `Invoice.chargeId`.\n\n'
    + '  Sin ese vínculo, cada cobro por pasarela vuelve a salir DOS VECES en la pantalla de\n'
    + '  Cobros: una por su `Charge` y otra por su `Invoice`, porque nada las relaciona. La\n'
    + '  desduplicación volvería a colgar solo del `Event{invoiced}`, que es de donde venía el\n'
    + '  defecto.');
});

function require$$fs() { return globalThis.__nodeFs || (globalThis.__nodeFs = fsMod); }
