// tests/scrum1063h-umbral-herramientas.test.mjs — SCRUM-1063h
//
// Decisión del fundador (SCRUM-1063 c.20867, «A ahora, columna después»): un gasto de la categoría
// «herramientas» cuya base más cuota NO LLEGUE a 3.005,06 € va a la 28/29 como gasto corriente;
// si llega o pasa, sigue apartado con `posible_bien_de_inversion`. Fuente: art. 108.Dos.5.º LIVA,
// «cuyo valor de adquisición sea inferior a quinientas mil pesetas» (consolidado leído por J5 en
// c.20863; 500.000 / 166,386 = 3.005,0605… → 3.005,06 €). Ningún texto nuevo: el motivo es código.
//
// Las cifras de los bordes están escritas A MANO (base 2.483,52 + cuota de 521,53 / 521,54 / 521,55);
// el caso del umbral DERIVADO de la constante va aparte, para que una constante movida no arrastre
// al test con ella. Gastos fabricados, pasados por `construirLibroRecibidas` y `construirModelo303`
// reales; el 390 se construye encima de esos 303, sin tocarlo.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303, construirIvaDeducible, UMBRAL_BIEN_DE_INVERSION } =
  await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirModelo390 } = await import('../dist/modules/fiscal/modelo390/modelo390.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts', de: 'centimos(a.base + a.cuota) < centimos(UMBRAL_BIEN_DE_INVERSION)',
    a: 'centimos(a.base + a.cuota) <= centimos(UMBRAL_BIEN_DE_INVERSION)', cae: 'SCRUM-1063h · el borde' },
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts', de: 'export const UMBRAL_BIEN_DE_INVERSION = 3005.06;',
    a: 'export const UMBRAL_BIEN_DE_INVERSION = 3005.07;', cae: 'SCRUM-1063h · la constante' },
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts', de: 'centimos(a.base + a.cuota) < centimos(UMBRAL_BIEN_DE_INVERSION)',
    a: 'centimos(a.base) < centimos(UMBRAL_BIEN_DE_INVERSION)', cae: 'SCRUM-1063h · el borde' },
  { fichero: 'src/modules/fiscal/modelo303/modelo303.ts', de: 'if (categoria === CATEGORIA_AMBIGUA && !pordebajoDelUmbral(a))',
    a: 'if (categoria === CATEGORIA_AMBIGUA)', cae: 'SCRUM-1063h · por debajo del umbral' },
];

const M = 7;

const factura = () => ({
  merchantId: M, number: '2026-CF-001', createdAt: new Date(2026, 3, 15, 12), type: 'F1',
  total: '121.00', currency: 'EUR', status: 'pending', customerId: 3, quoteId: null, chargeId: null,
  albaranRefs: null, lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
});

/** Una herramienta deducible al 21 % del 2T-2026, con base y cuota como texto (como la columna). */
const herramienta = (base, cuota, o = {}) => ({
  merchantId: M, date: new Date(2026, 4, 2, 9), concept: 'Taladro', amount: (Number(base) + Number(cuota)).toFixed(2),
  currency: 'EUR', providerId: 3, baseAmount: base, vatRate: 21, vatAmount: cuota, vatDeducible: true,
  providerInvoiceNumber: 'H-1', providerInvoiceDate: new Date(2026, 4, 1), category: 'herramientas', ...o,
});

const recibidas = (gastos) => construirLibroRecibidas({ gastos, merchantId: M });
const m303 = (gastos, trimestre = 2) => construirModelo303({
  libro: construirLibroRegistro({ facturas: [factura()], merchantId: M }),
  libroRecibidas: recibidas(gastos), año: 2026, trimestre,
});
const motivos = (d) => d.sinClasificar.map((g) => [g.numeroProveedor, g.motivo]);

test('SCRUM-1063h · la constante: 500.000 pesetas a 166,386 = 3.005,06 € (art. 108.Dos.5.º LIVA)', () => {
  assert.equal(UMBRAL_BIEN_DE_INVERSION, 3005.06);
  assert.equal(Math.round((500000 / 166.386) * 100) / 100, UMBRAL_BIEN_DE_INVERSION,
    'la constante no es la conversión de las 500.000 pesetas');
});

test('SCRUM-1063h · por debajo del umbral: 2.483,52 + 521,53 = 3.005,05 → 28/29', () => {
  const d = construirIvaDeducible(recibidas([herramienta('2483.52', '521.53')]));
  assert.deepEqual({ ...d.corrientes }, { casillaBase: 28, casillaCuota: 29, base: 2483.52, cuota: 521.53 });
  assert.deepEqual(d.casillaTotalADeducir, { casilla: 45, valor: 521.53 });
  assert.deepEqual(motivos(d), [], '🔴 una herramienta por debajo del umbral sigue apartada');
});

test('SCRUM-1063h · el borde: justo EN el umbral, 2.483,52 + 521,54 = 3.005,06 → apartada', () => {
  const d = construirIvaDeducible(recibidas([herramienta('2483.52', '521.54')]));
  assert.deepEqual({ ...d.corrientes }, { casillaBase: 28, casillaCuota: 29, base: 0, cuota: 0 },
    '🔴 una herramienta que LLEGA al umbral ha entrado en la 28/29');
  assert.deepEqual(motivos(d), [['H-1', 'posible_bien_de_inversion']]);
});

test('SCRUM-1063h · por encima: 2.483,52 + 521,55 = 3.005,07 → apartada', () => {
  const d = construirIvaDeducible(recibidas([herramienta('2483.52', '521.55')]));
  assert.equal(d.corrientes.cuota, 0);
  assert.deepEqual(motivos(d), [['H-1', 'posible_bien_de_inversion']]);
});

test('SCRUM-1063h · la constante: el borde DERIVADO de UMBRAL_BIEN_DE_INVERSION (un céntimo a cada lado)', () => {
  const cuota = 500;
  const conTotal = (centimosTotal) => herramienta(((centimosTotal - cuota * 100) / 100).toFixed(2), cuota.toFixed(2));
  const umbral = Math.round(UMBRAL_BIEN_DE_INVERSION * 100);
  const debajo = construirIvaDeducible(recibidas([conTotal(umbral - 1)]));
  const justo = construirIvaDeducible(recibidas([conTotal(umbral)]));
  assert.equal(debajo.corrientes.cuota, cuota, 'un céntimo por debajo de la constante tiene que deducirse');
  assert.deepEqual(motivos(justo), [['H-1', 'posible_bien_de_inversion']], 'en la constante tiene que apartarse');
});

test('SCRUM-1063h · por debajo del umbral: sin base o sin cuota no se puede medir → sigue apartada', () => {
  const d = construirIvaDeducible(recibidas([
    herramienta('100.00', null, { providerInvoiceNumber: 'sin-cuota' }),
    herramienta(null, null, { providerInvoiceNumber: 'sin-base', vatRate: null, vatDeducible: true }),
  ]));
  assert.equal(d.corrientes.cuota, 0);
  // La que no tiene base no es asiento (SCRUM-426): no llega aquí, se cuenta en `gastosSinDatosDeIva`.
  assert.deepEqual(motivos(d), [['sin-cuota', 'posible_bien_de_inversion']]);
});

test('SCRUM-1063h · por debajo del umbral, la herramienta pasa por las MISMAS puertas que un corriente', () => {
  const d = construirIvaDeducible(recibidas([
    herramienta('100.00', '0.00', { providerInvoiceNumber: 'cero', vatRate: 0 }),
    herramienta('100.00', '21.00', { providerInvoiceNumber: 'nulo', vatDeducible: null }),
    herramienta('100.00', '21.00', { providerInvoiceNumber: 'no', vatDeducible: false }),
  ]));
  assert.deepEqual(motivos(d), [['cero', 'tipo_cero'], ['nulo', 'deducibilidad_sin_decidir']]);
  assert.equal(d.noDeducibles, 1);
  assert.equal(d.corrientes.cuota, 0);
});

test('SCRUM-1063h · el 303 entero: 46 = 27 − 45 con la herramienta pequeña, y el aviso sólo por la grande', () => {
  const r = m303([
    herramienta('2483.52', '521.53', { providerInvoiceNumber: 'H-pequena' }),
    herramienta('2483.52', '521.54', { providerInvoiceNumber: 'H-grande' }),
  ]);
  assert.equal(r.casillaTotalCuota.valor, 21);
  assert.deepEqual(r.ivaDeducible.casillaTotalADeducir, { casilla: 45, valor: 521.53 });
  assert.deepEqual(r.resultadoRegimenGeneral, { casilla: 46, valor: -500.53 });
  assert.deepEqual(r.resultadoFinal.sumaDeResultados, { casilla: 64, valor: -500.53 });
  assert.deepEqual(motivos(r.ivaDeducible), [['H-grande', 'posible_bien_de_inversion']]);
  assert.equal(r.motivosParaNoFiarse.length, 1, 'la grande sigue declarada: un aviso, el que ya existía');
  assert.deepEqual({ ...r.ivaDeducible.bienesDeInversion }, {
    casillaBase: 30, casillaCuota: 31, base: 0, cuota: 0, vaciaPorque: 'sin_dato_de_bien_de_inversion',
  }, '30/31 siguen vacías: la columna (C) no está decidida');
});

test('SCRUM-1063h · el 390 lee del 303 y sigue cuadrando: 29 anual = Σ 29 trimestrales', () => {
  const ts = [1, 2, 3, 4].map((t) => construirModelo303({
    libro: construirLibroRegistro({ facturas: [], merchantId: M }),
    libroRecibidas: recibidas(t === 2
      ? [herramienta('2483.52', '521.53', { providerInvoiceNumber: 'H-pequena' }),
        herramienta('2483.52', '521.54', { providerInvoiceNumber: 'H-grande' })]
      : []),
    año: 2026, trimestre: t,
  }));
  const r = construirModelo390({ año: 2026, trimestres: ts, ahora: new Date(Date.UTC(2027, 2, 1, 12)) });
  const suma = ts.reduce((s, t) => s + t.ivaDeducible.corrientes.cuota, 0);
  assert.equal(suma, 521.53);
  assert.equal(r.deducible.corrientes.cuota.valor, suma, '🔴 el 390 no suma lo que el 303 dedujo');
  assert.deepEqual(r.gastosSinClasificar.map((g) => [g.trimestre, g.numeroProveedor, g.motivo]),
    [[2, 'H-grande', 'posible_bien_de_inversion']]);
});
