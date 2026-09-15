// tests/scrum844-sellar-dentro-de-transaccion.test.mjs — SCRUM-844 · puesto 1
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS PUERTAS DE `verifactu_seal_inside_transaction`, EN LA TANDA QUE CI SÍ CORRE.
//
// `applyVeriFactu` y `applyVeriFactuAnulacion` RECHAZAN que se les pase un cliente de transacción.
// Si ese rechazo cae, N facturas emitidas en un mismo `$transaction` encadenan TODAS a la misma
// huella anterior —no se ven entre sí sin commitear— y una cadena rota solo se deshace emitiendo
// **una R1 por cada factura afectada** (regla 29). Irreversible.
//
// El vector no es hipotético: `recapitulativa.service.ts` emite N facturas en una sola
// transacción, y el propio `verifactu.service.ts` lo nombra como «lo que habría pasado».
//
// ── 🔴 POR QUÉ ESTE FICHERO EXISTE SI YA HAY UNO ──────────────────────────────────────────────
//
// `tests/scrum173-cadena-verifactu-serializada.test.mjs` **ya cubre estas dos puertas**… y está
// GATEADO (`QA_DB_TEST=1` + base de staging). Medido: en `npm test` sale **7 skipped, 0 pass**.
//
// 🔒 Un test gateado que CI no corre no es un test que existe: es un test que existirá si algún
//    día alguien pone la variable.
//
// Aquí va SOLO la mitad que no necesita base, y el fichero gateado **no se toca**: lo que él
// prueba —el encadenamiento real, el orden determinista, dos sellados concurrentes— sigue
// necesitando una base y sigue siendo suyo. Esto cubre el PORTÓN, que es lo que se puede
// comprobar sin ella.
//
// ── ⚠️ LA TRAMPA, Y ES EL MOTIVO DE MEDIA CABECERA ───────────────────────────────────────────
//
// El portón del ALTA está en `verifactu.service.ts:283`, pero antes hay TRES puertas más. Medido
// una por una, con el mismo doble y cambiando sólo lo que se dice:
//
//     factura sin `type` ................. `unknown_invoice_type`
//     sin doble de `invoice` ............. TypeError: no puede leer `findUnique`
//     doble con `lines: []` .............. `invoice_without_lines_not_sealable`
//     con `type` Y con líneas ............ ✅ `verifactu_seal_inside_transaction`
//
// O sea que **un doble vacío nunca llega al portón** — y como `assert.rejects` SIN comprobar el
// mensaje da por buena cualquier excepción, un test escrito a la ligera saldría VERDE habiendo
// probado otra puerta. Está abajo, convertido en test, para que no haya que creérselo.
//
// 🔒 Un test escrito a la ligera puede pasar en verde habiendo probado otra puerta.
//
// Y las dos funciones NO se comportan igual, que es lo que hace la trampa tan fácil de pisar:
// la ANULACIÓN sí llega al portón con un doble vacío (delante sólo tiene el corte del `J-`).
// Copiar el caso de una para la otra da un verde falso en una de las dos.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';

const { applyVeriFactu, applyVeriFactuAnulacion } =
  await import('../dist/modules/invoicing/domain/verifactu.service.js');

const NIF = 'B12345678';
const LINEAS = [{ concept: 'Reparación de fuga', qty: 1, price: 100, tax: 0.21 }];

/** Una factura fiscal mínima. `type: 'F1'` es obligatorio para pasar `exigirTipoDeclarable`. */
const factura = (over = {}) => ({
  id: 1, merchantId: 9, number: 'F260001', type: 'F1',
  total: '121.00', createdAt: new Date('2026-03-15T10:00:00Z'), ...over,
});

/**
 * 🔴 EL DOBLE QUE DE VERDAD LLEGA AL PORTÓN DEL ALTA.
 *
 * Un cliente de transacción de Prisma es `Omit<PrismaClient, ITXClientDenyList>`, y `$transaction`
 * está en esa lista: por eso **no tenerlo ES la forma de un `tx`**, y por eso el portón pregunta
 * exactamente eso. Este doble lo imita: trae `invoice.findUnique` (hace falta para llegar) y NO
 * trae `$transaction` (que es lo que se está probando).
 */
const comoUnaTx = () => ({ invoice: { findUnique: async () => ({ lines: LINEAS }) } });

/** Y el cliente GLOBAL: lo mismo, pero CON `$transaction`. El portón tiene que dejarlo pasar. */
const PASE = 'PASO_EL_PORTON';
const comoElGlobal = () => ({
  invoice: { findUnique: async () => ({ lines: LINEAS }) },
  $transaction: async () => { throw new Error(PASE); },
});

/** El mensaje del error, sin suponer que es un Error. */
const mensaje = (e) => String(e?.message ?? e);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① EL CONTROL POSITIVO VA PRIMERO: el portón DISCRIMINA, no rechaza a todo el mundo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844 · ✅ POSITIVO: con un cliente que SÍ tiene `$transaction`, el portón deja pasar', async () => {
  // Sin esto, los dos rechazos de abajo pasarían igual con un portón que rechazara SIEMPRE — y un
  // portón así rompería toda la emisión fiscal sin que este fichero se enterase.
  for (const [nombre, fn] of [['applyVeriFactu', applyVeriFactu], ['applyVeriFactuAnulacion', applyVeriFactuAnulacion]]) {
    await assert.rejects(
      () => fn(factura(), NIF, comoElGlobal()),
      (e) => {
        assert.equal(mensaje(e), PASE,
          `🔴 ${nombre} NO ha llegado a abrir la transacción con un cliente que sí la tiene. `
          + `Llegó: «${mensaje(e)}». El portón está rechazando de más.`);
        return true;
      },
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② LAS DOS PUERTAS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844 · 🔴 `applyVeriFactu` RECHAZA que se le pase un cliente de transacción', async () => {
  await assert.rejects(
    () => applyVeriFactu(factura(), NIF, comoUnaTx()),
    (e) => {
      assert.match(mensaje(e), /verifactu_seal_inside_transaction/,
        `🔴 sellar DENTRO de una tx tiene que rechazarse. Llegó: «${mensaje(e)}».\n\n`
        + '  Si el portón cae, las N facturas de un mismo `$transaction` no se ven entre sí sin\n'
        + '  commitear y TODAS encadenan a la misma huella anterior. Eso solo se deshace con una\n'
        + '  R1 por factura (regla 29): irreversible.');
      // Y que NOMBRE a su propia función: los dos portones comparten código de error, así que
      // sin esto una prueba podría estar mirando el de la anulación y no enterarse.
      assert.match(mensaje(e), /applyVeriFactu debe llamarse/,
        '🔴 el mensaje no nombra `applyVeriFactu`: puede que se esté probando el otro portón');
      return true;
    },
  );
});

test('SCRUM-844 · 🔴 `applyVeriFactuAnulacion` RECHAZA lo mismo — es la MISMA cadena', async () => {
  // La anulación extiende la misma cadena que el alta (`ultimaHuellaDeLaCadena` mira las dos), así
  // que hereda el mismo peligro. Dejar una de las dos sin cubrir es peor que no cubrir ninguna:
  // un mecanismo a medias parece uno entero.
  await assert.rejects(
    () => applyVeriFactuAnulacion(factura(), NIF, comoUnaTx()),
    (e) => {
      assert.match(mensaje(e), /verifactu_seal_inside_transaction/,
        `🔴 anular DENTRO de una tx tiene que rechazarse. Llegó: «${mensaje(e)}»`);
      assert.match(mensaje(e), /applyVeriFactuAnulacion debe llamarse/,
        '🔴 el mensaje no nombra `applyVeriFactuAnulacion`: puede que sea el portón del alta');
      return true;
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ LA TRAMPA, CONVERTIDA EN TEST — el verde que no habría probado nada
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844 · 🔴 LA TRAMPA: con un doble VACÍO el alta muere ANTES, en otra puerta', async () => {
  // Esto NO comprueba el portón: comprueba que quien escriba un doble vacío se entere. Un
  // `assert.rejects` sin mirar el mensaje daría VERDE aquí, porque la llamada sí rechaza — pero
  // por un TypeError, a 40 líneas de distancia del mecanismo que se creía estar probando.
  await assert.rejects(
    () => applyVeriFactu(factura(), NIF, {}),
    (e) => {
      assert.doesNotMatch(mensaje(e), /verifactu_seal_inside_transaction/,
        '🔴 el alta ha llegado al portón con un doble VACÍO. Si eso cambia, esta trampa dejó de '
        + 'existir y el aviso de la cabecera hay que reescribirlo.');
      return true;
    },
  );

  // Y las otras dos puertas de delante, nombradas, para que quien depure sepa dónde está.
  await assert.rejects(
    () => applyVeriFactu(factura({ type: undefined }), NIF, comoUnaTx()),
    (e) => { assert.match(mensaje(e), /unknown_invoice_type/); return true; },
  );
  await assert.rejects(
    () => applyVeriFactu(factura(), NIF, { invoice: { findUnique: async () => ({ lines: [] }) } }),
    (e) => { assert.match(mensaje(e), /invoice_without_lines_not_sealable/); return true; },
  );
});

test('SCRUM-844 · 🔴 y las DOS funciones NO son simétricas: la anulación SÍ llega con el doble vacío', async () => {
  // Ésta es la mitad que hace la trampa peligrosa. Copiar el caso de una función para la otra
  // —lo natural, porque el portón es el mismo— da un verde correcto en la anulación y un verde
  // FALSO en el alta. Queda fijado para que la asimetría no se descubra dos veces.
  await assert.rejects(
    () => applyVeriFactuAnulacion(factura(), NIF, {}),
    (e) => {
      assert.match(mensaje(e), /verifactu_seal_inside_transaction/,
        '🔴 la anulación ya NO llega al portón con un doble vacío: han metido una puerta delante, '
        + 'y entonces el aviso de asimetría de la cabecera es falso.');
      return true;
    },
  );

  // El único corte que la anulación sí tiene delante: un justificante nunca entra en la cadena.
  await assert.rejects(
    () => applyVeriFactuAnulacion(factura({ number: 'J-20260315-ABCD' }), NIF, {}),
    (e) => { assert.match(mensaje(e), /receipt_document_not_invoiceable/); return true; },
  );
});
