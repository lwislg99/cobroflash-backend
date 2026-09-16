// tests/scrum844g-el-tipo-de-lo-recibido.test.mjs — SCRUM-844 · el hueco que dejó la auditoría
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL TIPO DE IVA DEL LIBRO DE RECIBIDAS NO PUEDE SER CUALQUIER ENTERO.
//
// `tipo()` (`libroRecibidas.ts`) solo da por bueno un ENTERO entre 0 y 100; fuera de eso devuelve
// `null`, «no consta». Y es la ÚNICA defensa que hay:
//
//   · `Expense.vatRate` es `Int?`, y `POST /admin/expenses` no lo valida —solo exige `concept` y
//     `amount`—, así que un 150 o un −5 llegan a la base tal cual;
//   · lo que devuelve `tipo()` es lo que `librosAeat.ts` pinta en la fila del libro de recibidas,
//     que es un libro que se ENTREGA.
//
// 🔴 Medido en la auditoría del 15-sep-2026 (comentario en SCRUM-844): quitando `n > 100`, o
// quitando `n < 0`, la tanda completa —789 ficheros, corrida por lotes— seguía con 0 fallos. El
// tercer operando (`!Number.isInteger`) sí lo caza `scrum426` («una fracción NO se acepta»); estos
// dos no los miraba nadie.
//
// Va en fichero propio y no dentro de `scrum426`: aquel test es de otro carril y no se amplía.
//
// ⛔ Este fichero NO toca `src/`. Cada caso se vio CAER con su mutación en el FUENTE, recompilando,
//    y se restauraron fuente y `dist/` byte a byte (`Buffer.compare === 0`), con `git status src/`
//    vacío después de cada uno.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirLibroRecibidas } =
  await import('../dist/modules/invoicing/domain/libroRecibidas.js');

// Merchant 7, NO el 1: el 1 es el DEMO (regla 8) y un fixture ahí desactiva comprobaciones sin
// tocar nada (SCRUM-409).
const M = 7;

/** Un gasto CLASIFICADO —con base—, que es el único que llega a asiento y hace correr `tipo()`. */
const gasto = (vatRate) => ({
  merchantId: M,
  date: '2026-03-01',
  concept: 'Material de fontanería',
  amount: '121.00',
  currency: 'EUR',
  providerId: null,
  baseAmount: '100.00',
  vatRate,
  vatAmount: '21.00',
  vatDeducible: true,
  providerInvoiceNumber: 'P-2026-001',
  providerInvoiceDate: '2026-03-01',
});

/**
 * El tipo que DECLARA el libro para un gasto, con suelo: sin asiento, `tipo()` no se ha ejecutado y
 * «sale `null`» se cumpliría por vacío — que es exactamente el verde que no mira nada.
 */
function tipoDeclarado(vatRate) {
  const libro = construirLibroRecibidas({ gastos: [gasto(vatRate)], merchantId: M });
  assert.equal(libro.asientos.length, 1,
    `🔴 CIEGO: el gasto con vatRate ${vatRate} no ha producido asiento, así que \`tipo()\` no se ha `
    + 'ejecutado y la comprobación de abajo pasaría sin haber mirado nada.');
  return libro.asientos[0].tipoIva;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO — sin él, un `tipo()` que devolviera siempre `null` pasaría los dos rojos
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844g · ✅ CONTROL POSITIVO: un tipo legítimo se declara tal cual', () => {
  assert.equal(tipoDeclarado(21), 21,
    '🔴 un 21 % no se ha declarado como 21: los casos de abajo saldrían verdes por un `tipo()` que '
    + 'no devuelve nada, no porque rechace lo que tiene que rechazar.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS DOS OPERANDOS QUE NO MIRABA NADIE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844g · 🔴 un tipo de 150 % NO se declara: sale `null`, no consta', () => {
  assert.equal(tipoDeclarado(150), null,
    '🔴 el libro de recibidas declara un IVA del 150 %. `Expense.vatRate` no se valida al guardar, '
    + 'así que la guarda `n > 100` de `tipo()` es lo único que impide entregar un libro con un tipo '
    + 'que no existe.');
});

test('SCRUM-844g · 🔴 un tipo NEGATIVO (−5 %) NO se declara: sale `null`, no consta', () => {
  assert.equal(tipoDeclarado(-5), null,
    '🔴 el libro de recibidas declara un IVA del −5 %. La guarda `n < 0` de `tipo()` es la única '
    + 'defensa: la API guarda cualquier entero en `vatRate`.');
});
