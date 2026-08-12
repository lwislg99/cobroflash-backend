// tests/scrum441-metodo-declarado.test.mjs — SCRUM-441
//
// EL CABLE: al marcar A MANO una factura como cobrada, el profesional puede decir CÓMO entró el
// dinero, y eso se guarda en `invoices.paid_via`.
//
// Hasta hoy no se podía: `Charge` guarda el método de lo que pasa por pasarela, pero una
// transferencia o un pago en efectivo **no crean `Charge`**, así que en la pantalla del dinero
// salían como «Método no registrado» — indistinguibles de un cobro del que de verdad no se sabe
// nada. Con `Charge` la casa distinguía cinco métodos; con lo marcado a mano, cero.
//
// 🔴 LA MITAD DE ESTE TEST ES EL CONTROL NEGATIVO: marcar cobrada SIN decir el método tiene que
// seguir funcionando exactamente igual que antes de que la columna existiera. Un campo nuevo que
// rompe el gesto de siempre no es una mejora.
import test from 'node:test';
import assert from 'node:assert/strict';

const { PAID_VIA } = await import('../dist/modules/billing/domain/paidVia.js');
const { metodoDeclarado, campoPaidViaAlMarcar, METODO_DESCONOCIDO } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-441 · SUELO: el conjunto cerrado se lee de verdad', () => {
  assert.ok(PAID_VIA.length >= 5,
    `🔴 PAID_VIA trae ${PAID_VIA.length} valores: no se ha leído bien, y lo de abajo no probaría nada.`);
  assert.equal(typeof campoPaidViaAlMarcar, 'function', '🔴 la decisión no está exportada.');
});

// ── LO QUE SE ACEPTA, DERIVADO DE `PAID_VIA` Y NO DE UNA LISTA A MANO ────────────────────────

test('SCRUM-441 · 🔴 TODO valor de PAID_VIA es declarable, sin excepción', () => {
  // Se recorre el conjunto: si mañana entra un método nuevo, este test lo exige solo.
  for (const v of PAID_VIA) {
    assert.equal(metodoDeclarado(v), v,
      `🔴 «${v}» está en PAID_VIA y el profesional no puede declararlo. El conjunto cerrado y lo ` +
      'que la pantalla deja decir han dejado de ser la misma cosa.');
  }
});

test('SCRUM-441 · el desconocido DECLARADO no es lo mismo que el silencio', () => {
  assert.equal(metodoDeclarado(METODO_DESCONOCIDO), METODO_DESCONOCIDO,
    '🔴 no se puede declarar «no consta». `null` es «nadie dijo nada» y esto es «se preguntó y no ' +
    'se sabe»: en una pantalla de dinero, la diferencia importa.');
  assert.notEqual(METODO_DESCONOCIDO, null);
});

test('SCRUM-441 · la forma `<metodo>:<pasarela>` sigue valiendo, y se normaliza', () => {
  assert.equal(metodoDeclarado('card:stripe'), 'card:stripe');
  assert.equal(metodoDeclarado('  TRANSFER  '), 'transfer', '🔴 no recorta ni baja a minúsculas.');
});

// ── CONTROL NEGATIVO: NADA DE LITERALES NUEVOS ───────────────────────────────────────────────

test('SCRUM-441 · 🔴 un literal que el conjunto cerrado no reconoce NO se escribe', () => {
  // `bank` y `mp` viven en el árbol y NO están en PAID_VIA (censo SCRUM-473): son el caso real.
  for (const malo of ['bank', 'mp', 'paypal', 'bizum', 'card:', ':stripe', '', '   ', null, undefined, 42, {}]) {
    assert.equal(metodoDeclarado(malo), null,
      `🔴 «${String(malo)}» se acepta como método. Escribir un valor inventado en la pantalla del ` +
      'dinero es peor que no escribir nada: lo segundo se ve, lo primero no.');
  }
});

// ── LA DECISIÓN DE ESCRITURA, LOS TRES CASOS ─────────────────────────────────────────────────

test('SCRUM-441 · 🔴 CONTROL NEGATIVO: marcar cobrada SIN método no toca la columna', () => {
  // `{}` en `data` de Prisma significa «no toques esta columna». No es `null`: es no escribir.
  for (const sinNada of [undefined, null, '', '   ']) {
    assert.deepEqual(campoPaidViaAlMarcar('paid', sinNada), {},
      `🔴 marcar cobrada con «${String(sinNada)}» toca \`paid_via\`. El gesto de siempre —marcar ` +
      'pagada y ya está— tiene que seguir funcionando EXACTAMENTE igual que antes de esta columna.');
  }
  // Y un método que no cuela tampoco escribe: fallar cerrado, no a medias.
  assert.deepEqual(campoPaidViaAlMarcar('paid', 'paypal'), {},
    '🔴 un método inválido deja la columna a medio escribir en vez de no tocarla.');
});

test('SCRUM-441 · marcar cobrada CON método declarado sí lo escribe', () => {
  assert.deepEqual(campoPaidViaAlMarcar('paid', 'transfer'), { paidVia: 'transfer' });
  assert.deepEqual(campoPaidViaAlMarcar('paid', 'cash'), { paidVia: 'cash' });
  assert.deepEqual(campoPaidViaAlMarcar('paid', 'bizum_manual'), { paidVia: 'bizum_manual' },
    '🔴 el Bizum confirmado por una PERSONA no se puede declarar, que es el caso más común de ' +
    'los que hoy salen como «Método no registrado».');
});

test('SCRUM-441 · deshacer el pago BORRA el método', () => {
  assert.deepEqual(campoPaidViaAlMarcar('pending', 'transfer'), { paidVia: null },
    '🔴 se deshace el pago y «cómo se cobró» sigue puesto: la factura diría que entró por ' +
    'transferencia un dinero que ya no consta cobrado.');
  assert.deepEqual(campoPaidViaAlMarcar('pending', undefined), { paidVia: null });
});

test('SCRUM-441 · `expired` no toca el método', () => {
  assert.deepEqual(campoPaidViaAlMarcar('expired', 'transfer'), {},
    '🔴 caducar una factura reescribe cómo se cobró. Caducar no es cobrar ni des-cobrar.');
  // Un estado que no existe tampoco escribe nada: lo que no está declarado, no actúa.
  assert.deepEqual(campoPaidViaAlMarcar('annulled', 'cash'), {});
});

// ── QUE EL CABLE ESTÉ ENCHUFADO DE VERDAD ────────────────────────────────────────────────────

test('SCRUM-441 · 🔴 el marcado a mano USA la decisión, no una copia suya', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const RAIZ = path.resolve(import.meta.dirname, '..');

  const servicio = fs.readFileSync(path.join(RAIZ, 'src/modules/system/invoiceAdmin.ts'), 'utf8');
  assert.match(servicio, /campoPaidViaAlMarcar\(status, paidVia\)/,
    '🔴 `updateInvoiceStatusAdmin` ya no llama a la decisión del dominio. Si la reimplementa aquí, ' +
    'hay dos criterios sobre qué se escribe y el de fuera es el fácil de equivocar.');

  const ruta = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  assert.match(ruta, /updateInvoiceStatusAdmin\(id, status, req\.merchantId, req\.body\?\.paidVia\)/,
    '🔴 la ruta no pasa el método declarado: el profesional lo elige y no llega a ninguna parte.');
});
