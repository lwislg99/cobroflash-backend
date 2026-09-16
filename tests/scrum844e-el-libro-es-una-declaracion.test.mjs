// tests/scrum844e-el-libro-es-una-declaracion.test.mjs — SCRUM-844 · puesto 5
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL LIBRO REGISTRO NO ES UN INFORME: ES UNA DECLARACIÓN.
//
// `construirLibroRegistro` y `construirLibroRecibidas` son funciones PURAS —reciben las filas ya
// leídas y no tocan la base—, y de ellas sale el libro de facturas expedidas y recibidas, que es
// lo que se le enseña a Hacienda y de lo que sale el 303.
//
// Sus dos tests grandes (`scrum296`, `scrum426`) ya cubren lo gordo: la tenencia, los gastos sin
// base, los importes ilegibles. Medido hoy, punto por punto. Lo que queda vivo es una familia
// concreta y reconocible:
//
// ── 🔴 LO QUE SE ROMPE SIN QUE CAIGA NADIE: «NO CONSTA» DISFRAZADO DE DATO ────────────────────
//
// Los cuatro puntos de abajo comparten forma. En todos, el código distingue hoy TRES estados
// donde un lector distraído ve dos:
//
//   · una factura sin líneas → base y cuota van `null`, **no cero**;
//   · una factura que no viene de presupuesto → `presupuestoFirmado: null`, **no `false`**;
//   · un importe que no se pudo leer → se queda fuera de la suma, **no suma 0,00 €**;
//   · un gasto cuya deducibilidad nunca se decidió → se CUENTA aparte, no pasa por «no deducible».
//
// > Un cero declarado es una afirmación: dice «esta operación no llevó IVA». Un `null` dice «no
// > se pudo saber». Confundirlos no rompe ninguna suma — y por eso no lo caza nadie —, pero
// > cambia lo que el libro AFIRMA.
//
// ⛔ Este fichero NO toca `src/`. Cada caso se probó EN ROJO inyectando el punto exacto,
//    recompilando, y restaurando fuente y `dist/` byte a byte (`Buffer.compare === 0`).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirLibroRegistro } =
  await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } =
  await import('../dist/modules/invoicing/domain/libroRecibidas.js');

const MIO = 7;

const mkFactura = (over = {}) => ({
  id: 1, merchantId: MIO, number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'),
  type: 'F1', total: '121.00', currency: 'EUR', status: 'paid', customerId: 3,
  quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  ...over,
});

const mkGasto = (over = {}) => ({
  id: 1, merchantId: MIO, date: new Date('2026-03-10T00:00:00Z'), concept: 'Material',
  amount: '121.00', currency: 'EUR', providerId: 5,
  baseAmount: '100.00', vatRate: '21', vatAmount: '21.00', vatDeducible: true,
  providerInvoiceNumber: 'P-2026-88', providerInvoiceDate: new Date('2026-03-09T00:00:00Z'),
  ...over,
});

const libro = (facturas, extra = {}) =>
  construirLibroRegistro({ facturas, merchantId: MIO, ...extra });
const recibidas = (gastos) => construirLibroRecibidas({ gastos, merchantId: MIO });

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — un libro vacío haría verdes todas las ausencias de abajo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844e · SUELO: los dos libros producen asientos con el banco bueno', () => {
  const l = libro([mkFactura()]);
  assert.equal(l.asientos.length, 1,
    `🔴 el libro de expedidas salió con ${l.asientos.length} asientos: todo lo de abajo estaría `
    + 'comprobando cómo NO es un asiento que no existe');
  assert.equal(l.asientos[0].base, 100, '🔴 el banco no desglosa: revisa las líneas del fixture');

  const r = recibidas([mkGasto()]);
  assert.equal(r.asientos.length, 1, '🔴 el libro de recibidas salió vacío con el banco bueno');
  assert.equal(r.asientos[0].base, 100);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1 · 🔴 SIN LÍNEAS NO SE DESGLOSA A CERO: se declara que NO SE PUEDE DESGLOSAR
//
// `tieneLineas` exige ADEMÁS que el array no esté vacío. Sin esa mitad, una factura con
// `lines: []` desglosaría `base: 0, cuota: 0, porTipo: []` — que el 303 suma como una operación
// real de importe cero, en vez de como un asiento que no se puede desglosar.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844e · 🔴 una factura con `lines: []` NO desglosa a cero: base y cuota van `null`', () => {
  const [a] = libro([mkFactura({ lines: [] })]).asientos;
  assert.equal(a.base, null,
    '🔴 una factura sin líneas declara base 0,00 €. Eso AFIRMA que la operación no tuvo base '
    + 'imponible; lo cierto es que no se puede desglosar, y el 303 tiene que poder separarlas.');
  assert.equal(a.cuota, null, '🔴 ídem con la cuota: un 0,00 € declarado no es «no consta»');
  assert.deepEqual(a.porTipo, [],
    '🔴 `porTipo` tiene tramos inventados para una factura sin líneas');
});

test('SCRUM-844e · ✅ y con líneas SÍ desglosa (el caso de arriba no sale de una función muda)', () => {
  const [a] = libro([mkFactura()]).asientos;
  assert.equal(a.base, 100);
  assert.equal(a.cuota, 21);
  assert.deepEqual(a.porTipo, [{ tipo: 21, base: 100, cuota: 21 }]);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 2 · 🔴 «NO VIENE DE PRESUPUESTO» NO ES «VIENE DE UNO SIN FIRMAR»
//
// Los tres estados: `null` (no viene de ninguno), `false` (viene de uno y NO está firmado) y
// `true`. Fundir los dos primeros en `false` convierte «no aplica» en «falta la firma» — y eso
// es una incidencia inventada en cada factura suelta del libro.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844e · 🔴 los TRES estados de la firma del presupuesto siguen siendo tres', () => {
  const asientos = libro(
    [
      mkFactura({ id: 1, number: '2026-CF-001', quoteId: null }),
      mkFactura({ id: 2, number: '2026-CF-002', quoteId: 55 }),
      mkFactura({ id: 3, number: '2026-CF-003', quoteId: 66 }),
    ],
    { presupuestosFirmados: [66] },
  ).asientos;

  assert.equal(asientos[0].enlaces.presupuestoFirmado, null,
    '🔴 una factura que NO viene de presupuesto declara su firma como `false`. Eso dice «hay un '
    + 'presupuesto y le falta la firma» de un documento que no tiene presupuesto ninguno.');
  assert.equal(asientos[1].enlaces.presupuestoFirmado, false,
    '🔴 un presupuesto SIN firmar tiene que salir `false`, no `null`');
  assert.equal(asientos[2].enlaces.presupuestoFirmado, true,
    '🔴 un presupuesto firmado tiene que salir `true`');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 3 · 🔴 UN IMPORTE ILEGIBLE NO SUMA CERO EN EL TOTAL DE LAS QUE NO TIENEN NÚMERO
//
// Las facturas sin número no son asientos, pero su dinero se declara aparte. Si un total
// ilegible entrara como 0, el `sinNumeroImporte` diría «este dinero está contado» cuando no lo
// está — familia SCRUM-271, y aquí en un renglón que va en el libro.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844e · 🔴 el dinero SIN NÚMERO que no se puede leer se queda FUERA de la suma', () => {
  const l = libro([
    mkFactura({ id: 1, number: null, total: '50.00' }),
    mkFactura({ id: 2, number: null, total: 'no-es-un-numero' }),
  ]);
  assert.equal(l.sinNumero, 2, '🔴 las dos facturas sin número tienen que contarse');
  assert.equal(l.sinNumeroImporte, 50,
    `🔴 el total sin número salió ${l.sinNumeroImporte}: el importe ILEGIBLE ha entrado como `
    + '0,00 €. Sumar cero lo hace desaparecer del renglón sin que nada lo diga — y el renglón '
    + 'existe justamente para que ese dinero se vea.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 4 · 🔴 LOS ALBARANES VIVOS QUE LA FACTURA NO SELLÓ
//
// `albaranesNoSellados` es la única señal de que hay trabajo entregado que la factura no
// incorporó. Si deja de contarse, el libro sale idéntico —mismos importes, mismas sumas— y la
// incidencia desaparece sin dejar rastro. No cuadra nada mal: simplemente ya no avisa.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844e · 🔴 un albarán VIVO que la factura no selló se cuenta como no sellado', () => {
  const [a] = libro(
    [mkFactura({ id: 9, albaranRefs: [{ albaranId: 100, numero: 'A-1' }] })],
    { albaranesVivos: new Map([[9, [{ albaranId: 100, numero: 'A-1' }, { albaranId: 200, numero: 'A-2' }]]]) },
  ).asientos;

  assert.equal(a.enlaces.albaranesNoSellados, 1,
    `🔴 salieron ${a.enlaces.albaranesNoSellados} albaranes sin sellar y hay 1: el A-2 está vivo `
    + 'y la factura no lo incorporó. Sin este contador, el trabajo entregado y no facturado no '
    + 'aparece por ningún lado del libro.');
  assert.equal(a.enlaces.albaranes.length, 1, '🔴 el albarán SÍ sellado tiene que seguir constando');
});

test('SCRUM-844e · ✅ y si la factura los selló TODOS, no se inventa ninguna incidencia', () => {
  const [a] = libro(
    [mkFactura({ id: 9, albaranRefs: [{ albaranId: 100, numero: 'A-1' }] })],
    { albaranesVivos: new Map([[9, [{ albaranId: 100, numero: 'A-1' }]]]) },
  ).asientos;
  assert.equal(a.enlaces.albaranesNoSellados, 0,
    '🔴 se cuenta como «no sellado» un albarán que SÍ está en el sello: un aviso inventado en '
    + 'cada factura hace que se dejen de mirar todos');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 5 · 🔴 EL LIBRO DE RECIBIDAS: la deducibilidad que nunca se decidió
//
// Las columnas fiscales del gasto nacieron a NULL (SCRUM-403/E4). `vatDeducible: null` significa
// «nadie ha decidido todavía si este IVA es deducible», y eso NO es «no es deducible»: es IVA
// soportado pendiente de clasificar, que o se decide o se queda fuera del 303.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844e · 🔴 un gasto SIN deducibilidad decidida se cuenta — `undefined` incluido', () => {
  const r = recibidas([
    mkGasto({ id: 1, vatDeducible: null }),
    mkGasto({ id: 2, vatDeducible: undefined }),
    mkGasto({ id: 3, vatDeducible: false }),
    mkGasto({ id: 4, vatDeducible: true }),
  ]);
  assert.equal(r.sinDeducibilidadDecidida, 2,
    `🔴 salieron ${r.sinDeducibilidadDecidida} y son 2: el \`null\` y el \`undefined\`. Los dos `
    + 'significan «nunca se clasificó», y una fila que llega sin la columna (`undefined`) es '
    + 'exactamente lo que produce un `select` que no la pide.');
  // Y el que SÍ se decidió que no, no se cuenta: si no, el contador diría siempre lo mismo.
  assert.equal(r.asientos[2].deducible, false, '🔴 «se decidió que NO» tiene que salir `false`');
  assert.equal(r.asientos[0].deducible, null, '🔴 «nunca se decidió» tiene que salir `null`');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 6 · 🔴 UN NÚMERO DE PROVEEDOR VACÍO NO ES UN NÚMERO
//
// El asiento ENTRA igual —la compra ocurrió—, pero se cuenta como identificable a medias. Una
// cadena vacía que cuente como número deja el asiento pareciendo completo y sin serlo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844e · 🔴 un nº de proveedor VACÍO se declara `null` y se cuenta, no pasa por número', () => {
  const r = recibidas([
    mkGasto({ id: 1, providerInvoiceNumber: '' }),
    mkGasto({ id: 2, providerInvoiceNumber: null }),
    mkGasto({ id: 3, providerInvoiceNumber: 'P-2026-88' }),
  ]);
  assert.equal(r.asientos[0].numeroProveedor, null,
    '🔴 la cadena vacía ha entrado como número de factura del proveedor. `""` no identifica '
    + 'ninguna factura, y con ella el asiento parece completo.');
  assert.equal(r.sinNumeroProveedor, 2,
    `🔴 salieron ${r.sinNumeroProveedor} sin número y son 2 (la vacía y la nula)`);
  assert.equal(r.asientos[2].numeroProveedor, 'P-2026-88',
    '🔴 el número bueno se ha perdido: el caso de arriba no puede salir de tirarlos todos');
});
