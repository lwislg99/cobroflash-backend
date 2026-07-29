// SCRUM-217 · LOS CUATRO FAIL-OPEN LATENTES — cerrados en la puerta, no en el emisor.
//
// Ninguno estaba incumplido, y ninguno necesitaba un bug para incumplirse: bastaba un dato de
// entrada normal. Se cierran ahora que `INVOICING_ES_ENABLED` está OFF y no hay nada emitido;
// después, cada uno sería una factura que corregir hacia atrás, con su huella sellada.
//
// Cada test usa EL VALOR QUE HOY PASA, no un valor absurdo. Es la lección del incidente #12: un
// desvío enorme se sale del mecanismo que se quiere vigilar y el rojo no distingue nada. Aquí
// `2023`, `0.15`, `A"B` y la variable sin definir caen DENTRO del hueco, que es lo que los hace
// buenos casos de prueba.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  invalidAnioFiscal, invalidTipoIva, invalidPrefijoSerie,
  ANIO_MINIMO_FISCAL, TIPOS_IVA_ES_BP,
} = await import('../dist/core/validation/fiscalInput.js');
const { invalidVerifactuIdSistema } = await import('../dist/core/config/env.js');
const { CreateQuoteSchema, merchantProfileUpdateSchema } = await import('../dist/core/validation/schemas.js');

// ── 1 · AEAT 1152 · el año del export no tenía cota inferior ─────────────────────────────

test('SCRUM-217 · ?year=2023 se RECHAZA (antes del 28-10-2024 no hay sistema)', () => {
  const motivo = invalidAnioFiscal(2023);
  assert.ok(motivo, '🔴 2023 pasa: el export emitiría fechas anteriores al suelo del sistema');
  assert.match(motivo, /2024/);
});

test('SCRUM-217 · el año válido sigue pasando (el guard no rompe el caso normal)', () => {
  assert.equal(invalidAnioFiscal(ANIO_MINIMO_FISCAL), null);
  assert.equal(invalidAnioFiscal(new Date().getFullYear()), null);
});

test('SCRUM-217 · año futuro y basura también se rechazan', () => {
  assert.ok(invalidAnioFiscal(new Date().getFullYear() + 1));
  assert.ok(invalidAnioFiscal('pepe'));
  assert.ok(invalidAnioFiscal(2024.5));
});

// ── 2 · AEAT 1124 · el IVA aceptaba un 15 % ──────────────────────────────────────────────

test('SCRUM-217 · un tax de 0.15 se RECHAZA (el 15 % no existe en España)', () => {
  const motivo = invalidTipoIva(0.15);
  assert.ok(motivo, '🔴 el 15 % pasa: un impuesto inventado acabaría en la cuota de la huella');
  assert.match(motivo, /15 %/);
});

test('SCRUM-217 · los 7 tipos españoles pasan, sin trampa de coma flotante', () => {
  // 0,075 es el que rompe una comparación ingenua de flotantes: por eso el validador compara
  // en puntos básicos y por eso este caso está aquí.
  for (const f of [0, 0.02, 0.04, 0.05, 0.075, 0.10, 0.21]) {
    assert.equal(invalidTipoIva(f), null, `el tipo ${f * 100} % debería ser válido`);
  }
  assert.equal(TIPOS_IVA_ES_BP.size, 7);
});

test('SCRUM-217 · el esquema de presupuesto rechaza la línea con IVA inventado', () => {
  const cuerpo = (tax) => ({
    merchant_id: 1, customer_id: 1, currency: 'EUR',
    lines: [{ concept: 'Reparación', qty: 1, price: 100, tax }],
  });
  assert.throws(() => CreateQuoteSchema.parse(cuerpo(0.15)), /15 %|IVA/);
  assert.doesNotThrow(() => CreateQuoteSchema.parse(cuerpo(0.21)));
});

// ── 3 · AEAT 1130 / 1287 · el prefijo de serie no validaba charset ───────────────────────

test('SCRUM-217 · una serie con carácter prohibido se RECHAZA', () => {
  // Las comillas dobles son uno de los cinco que la AEAT prohíbe expresamente en NumSerieFactura.
  const motivo = invalidPrefijoSerie('A"B');
  assert.ok(motivo, '🔴 pasa una serie que haría rechazar TODAS las facturas de ese merchant');
  assert.match(motivo, /"/);

  for (const malo of ["A'B", 'A<B', 'A>B', 'A=B']) assert.ok(invalidPrefijoSerie(malo), malo);
  assert.ok(invalidPrefijoSerie('CFé'), 'lo no-ASCII también sale');
});

test('SCRUM-217 · los prefijos normales siguen pasando', () => {
  for (const bueno of ['CF', 'FAC', '2026-CF', 'A1']) {
    assert.equal(invalidPrefijoSerie(bueno), null, bueno);
  }
});

test('SCRUM-217 · el esquema del merchant rechaza el prefijo con carácter prohibido', () => {
  assert.throws(() => merchantProfileUpdateSchema.parse({ invoiceSeriesPrefix: 'A"B' }), /AEAT|admite/);
  assert.doesNotThrow(() => merchantProfileUpdateSchema.parse({ invoiceSeriesPrefix: 'CF' }));
});

// ── 4 · AEAT 1177 · VERIFACTU_ID_SISTEMA || '' ───────────────────────────────────────────

test('SCRUM-217 · la variable SIN DEFINIR se detecta como inválida', () => {
  // El `|| ''` de env.ts convierte «no configurado» en «configurado a vacío». El validador ya no
  // se lo traga: undefined, null y '' son los tres el mismo agujero.
  for (const v of [undefined, null, '', '   ']) {
    assert.ok(invalidVerifactuIdSistema(v), `🔴 ${JSON.stringify(v)} pasa como si estuviera configurado`);
  }
  assert.match(invalidVerifactuIdSistema(undefined), /no está configurado/);
});

test('SCRUM-217 · el valor PRESENTE Y MAL es el hueco que el emisor no ve', () => {
  // El emisor solo comprueba `!idSistema`, así que estos cuatro lo atraviesan y llegan a la AEAT.
  for (const v of ['abc', 'a', 'a1', 'Ñ1', '1', 'ABC']) {
    assert.ok(invalidVerifactuIdSistema(v), `🔴 ${v} atraviesa el guard del emisor y da error 1177`);
  }
});

test('SCRUM-217 · un id bien formado pasa', () => {
  for (const v of ['01', 'A1', 'ZZ', '99']) assert.equal(invalidVerifactuIdSistema(v), null, v);
});
