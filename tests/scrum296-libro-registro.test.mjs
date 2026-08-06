// tests/scrum296-libro-registro.test.mjs — SCRUM-296 (A6) · el Libro de Registro.
//
// El libro de facturas emitidas es lo primero que pide un asesor. Lo que lo hace nuestro y no una
// tabla más es que **cada asiento enlaza con su presupuesto, su albarán y su cobro** — la
// trazabilidad completa de un euro. Ningún facturador puede hacerlo: no tiene los tres objetos
// atados.
//
// ⚠️ SOLO LECTURA sobre facturas ya emitidas: no toca el camino de emisión (regla 38).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { calcVatBreakdown } = await import('../dist/modules/invoicing/domain/vat.service.js');

const MIO = 7;
const OTRO = 99;

/** Una factura como la devuelve Prisma, con lo que el libro necesita. */
const factura = (o = {}) => ({
  merchantId: MIO,
  number: '2026-CF-001',
  createdAt: new Date('2026-03-04T10:00:00.000Z'),
  type: 'F1',
  total: '121.00',
  currency: 'EUR',
  status: 'paid',
  customerId: 3,
  quoteId: 11,
  chargeId: 22,
  albaranRefs: [{ albaranId: 33, numero: 'ALB-2026-007', fecha: '2026-03-01' }],
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
  ...o,
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO — y aquí no es una formalidad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-296 · SUELO: un libro vacío HABIENDO facturas es un fallo, no un «no hay»', () => {
  // Un libro vacío no se lee como «no encontré nada»: se lee como «no facturaste nada», y eso
  // ante Hacienda es una afirmación. El resultado tiene que permitir distinguir las dos cosas.
  const conFacturas = construirLibroRegistro({ facturas: [factura(), factura({ number: '2026-CF-002' })], merchantId: MIO });

  assert.equal(conFacturas.miradas, 2,
    '🔴 el libro no dice cuántas facturas miró. Sin ese número, «cero asientos» significa a la vez ' +
    '«no había» y «no supe leerlas», y las dos se leen igual de tranquilizadoras.');
  assert.ok(conFacturas.asientos.length > 0,
    '🔴 hay dos facturas y el libro no produce ni un asiento. Un libro que pierde asientos es peor ' +
    'que uno que no existe: el que no existe no afirma nada.');

  // Y el caso legítimo, para que el suelo no sea un adorno: sin facturas, cero de las dos cosas.
  const vacio = construirLibroRegistro({ facturas: [], merchantId: MIO });
  assert.equal(vacio.miradas, 0);
  assert.deepEqual(vacio.asientos, []);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · montado con DOS merchants, sin apoyarse en el guard de tenencia
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-296 · las facturas de OTRO merchant no aparecen, y se CUENTAN', () => {
  // No se apoya en el guard de tenencia de SCRUM-243: tiene un agujero conocido (SCRUM-348), así
  // que el aislamiento de un documento fiscal no puede colgar de él. El libro filtra también.
  const libro = construirLibroRegistro({
    facturas: [
      factura({ number: '2026-CF-001' }),
      factura({ merchantId: OTRO, number: '2026-XX-055' }),
      factura({ merchantId: OTRO, number: '2026-XX-056' }),
      factura({ number: '2026-CF-002' }),
    ],
    merchantId: MIO,
  });

  const numeros = libro.asientos.map((a) => a.numero);
  assert.deepEqual(numeros, ['2026-CF-001', '2026-CF-002'],
    '🔴 se ha colado una factura de OTRO merchant en el libro. En un libro de registro eso no es ' +
    'una fuga de datos cualquiera: es declarar como propia la facturación de un tercero.');
  assert.equal(libro.ajenas, 2,
    '🔴 las ajenas se descartan EN SILENCIO. Un descarte que no se cuenta es indistinguible de un ' +
    'dato que nunca existió, y aquí hay que poder demostrar por qué el libro tiene las filas que ' +
    'tiene.');
  assert.equal(libro.miradas, 4, 'y se sigue diciendo cuántas se miraron en total');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA TRAZABILIDAD DEL EURO — lo que ningún facturador puede hacer
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-296 · cada asiento enlaza con su presupuesto, su albarán y su cobro', () => {
  const [a] = construirLibroRegistro({ facturas: [factura()], merchantId: MIO }).asientos;

  assert.equal(a.enlaces.presupuestoId, 11,
    '🔴 el asiento no enlaza con su presupuesto: se pierde de dónde viene el euro.');
  assert.equal(a.enlaces.cobroId, 22,
    '🔴 el asiento no enlaza con su cobro: se pierde dónde acabó el euro.');
  assert.deepEqual(a.enlaces.albaranes, [{ albaranId: 33, numero: 'ALB-2026-007' }],
    '🔴 el asiento no enlaza con su albarán: se pierde qué se entregó a cambio.');
});

test('SCRUM-296 · una factura SIN enlaces no se rompe: los declara vacíos', () => {
  // La factura suelta (SCRUM-289) existe y es legítima. El libro tiene que admitirla sin inventar
  // enlaces y sin caerse — pero enseñando que no los tiene.
  const [a] = construirLibroRegistro({
    facturas: [factura({ quoteId: null, chargeId: null, albaranRefs: null })], merchantId: MIO,
  }).asientos;

  assert.equal(a.enlaces.presupuestoId, null);
  assert.equal(a.enlaces.cobroId, null);
  assert.deepEqual(a.enlaces.albaranes, [],
    '🔴 sin albaranes el asiento debe declarar una lista vacía, no romperse ni inventar una entrada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS IMPORTES · familia SCRUM-271 — `Number('')` es 0 y `Number([])` es 0
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-296 · los importes cuadran con las facturas, y salen del MISMO cálculo', () => {
  const lineas = [
    { concept: 'Mano de obra', qty: 2, price: 50, tax: 0.21 },
    { concept: 'Material', qty: 1, price: 30, tax: 0.10 },
  ];
  const [a] = construirLibroRegistro({ facturas: [factura({ lines: lineas, total: '154.00' })], merchantId: MIO }).asientos;
  const esperado = calcVatBreakdown(lineas);

  assert.equal(a.base, esperado.base,
    '🔴 la base del libro no es la que calcula el emisor. Recomputarla con otra fórmula haría que ' +
    'el libro cuadrase consigo mismo en vez de con las facturas.');
  assert.equal(a.cuota, esperado.cuota);
  assert.equal(a.total, 154,
    '🔴 el total del asiento no es el de la factura.');
});

test('SCRUM-296 · un importe ILEGIBLE sale como null y se declara — nunca como 0,00 €', () => {
  // `Number('')` es 0 y `Number([])` es 0. Un total ilegible convertido en cero es un asiento que
  // AFIRMA que esa factura no cobró nada, y eso es peor que no tener la fila.
  for (const malo of ['', [], null, undefined, 'doce euros', NaN, {}]) {
    const libro = construirLibroRegistro({ facturas: [factura({ total: malo })], merchantId: MIO });
    const [a] = libro.asientos;
    assert.equal(a.total, null,
      `🔴 el total ${JSON.stringify(malo)} se ha convertido en un número. Si acaba en 0, el libro ` +
      'declara que esa factura no cobró nada.');
    assert.equal(a.importeIlegible, true,
      '🔴 el asiento no avisa de que su importe no se pudo leer.');
    assert.deepEqual(libro.importesIlegibles, [a.numero],
      '🔴 el importe ilegible no se reporta con su número de factura delante: quien lea el libro ' +
      'no puede ir a mirar cuál falla.');
  }
});

test('SCRUM-296 · un total de CERO legítimo NO se confunde con uno ilegible', () => {
  // La otra cara: sin ella, «todo lo raro es null» y «todo es null» se ven igual.
  const [a] = construirLibroRegistro({ facturas: [factura({ total: '0.00', lines: [] })], merchantId: MIO }).asientos;
  assert.equal(a.total, 0, '🔴 un cero de verdad se está tratando como ilegible');
  assert.equal(a.importeIlegible, false);
});

test('SCRUM-296 · una factura sin NÚMERO no es asiento, y se declara', () => {
  // El número ES la identidad fiscal del documento. Una fila sin número no puede ser un asiento,
  // pero desaparecer en silencio la haría indistinguible de una que nunca existió.
  const libro = construirLibroRegistro({
    facturas: [factura(), factura({ number: null }), factura({ number: '' })], merchantId: MIO,
  });
  assert.equal(libro.asientos.length, 1);
  assert.equal(libro.sinNumero, 2,
    '🔴 las filas sin número se tiran sin contarlas.');
  assert.equal(libro.miradas, 3);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO DE COLUMNAS · y el rojo por el mecanismo
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Las columnas que un asiento DEBE llevar. Si falta una, el libro deja de ser un libro. */
const COLUMNAS = [
  'numero', 'fecha', 'tipo', 'clienteId', 'base', 'cuota', 'total', 'moneda', 'estado',
  'importeIlegible', 'enlaces',
];

test('SCRUM-296 · SUELO del censo: el asiento tiene columnas que censar', () => {
  const [a] = construirLibroRegistro({ facturas: [factura()], merchantId: MIO }).asientos;
  const claves = Object.keys(a);
  assert.ok(claves.length >= 8,
    `🔴 el asiento solo tiene ${claves.length} columnas: el censo de abajo no estaría comprobando ` +
    'nada. Un censo vacío da verde sobre un libro que no existe.');
});

test('SCRUM-296 · el asiento lleva TODAS sus columnas', () => {
  const [a] = construirLibroRegistro({ facturas: [factura()], merchantId: MIO }).asientos;
  const faltan = COLUMNAS.filter((c) => !(c in a));

  assert.deepEqual(faltan, [],
    `🔴 al asiento le faltan columnas: ${faltan.join(', ')}.\n\n` +
    '  Un libro de registro al que le falta una columna no es un libro incompleto: es un\n' +
    '  documento que se presenta como completo y no lo está. Si la columna sobra de verdad,\n' +
    '  quítala del censo EN EL MISMO COMMIT, con su motivo.');
  for (const c of ['presupuestoId', 'albaranes', 'cobroId']) {
    assert.ok(c in a.enlaces,
      `🔴 falta el enlace «${c}». Es lo único que este libro tiene y un facturador no puede tener.`);
  }
});

test('SCRUM-296 · el libro NO toca el camino de emisión (regla 38)', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/libroRegistro.ts'), 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.doesNotMatch(codigo, /allocateInvoiceNumber|formatInvoiceNumber|prisma\.|\.update\(|\.create\(/,
    '🔴 el libro ha dejado de ser solo lectura. Leer el camino de emisión no es STOP; escribir en ' +
    'él sí, y este módulo no tiene ningún motivo para hacerlo.');
  assert.match(codigo, /import \{ calcVatBreakdown \}/,
    '🔴 el libro ya no reutiliza el cálculo del emisor: si recomputa, cuadrará consigo mismo.');
});
