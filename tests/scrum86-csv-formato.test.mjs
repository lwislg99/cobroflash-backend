// SCRUM-86 — CONTRATO de formato de los CSV de export (separador · decimal · BOM).
//
// PURO Y SIN GATE a propósito: el formato lo fijan funciones puras de `exportData`, así
// que se puede blindar sin BD, sin staging y sin depender de la ventana de nadie. Es
// justo lo que faltaba en SCRUM-25: el bug (todo en la columna A de Excel) llegó a
// producción porque ningún test miraba el formato, solo el contenido.
//
// ⚠️ Este formato está OPTIMIZADO PARA ESPAÑA, no es universal — ver el comentario de
// cabecera de `exportData.ts`. Si algún día entra un merchant de México (punto decimal),
// esto pasa a depender del locale y este test tendrá que parametrizarse.
import test from 'node:test';
import assert from 'node:assert/strict';

const { CSV_SEPARADOR, csvEscape, csvRow, csvNum, csvBody } =
  await import('../dist/modules/exports/domain/exportData.js');

test('SCRUM-86: el separador es punto y coma (Excel ES no separa por coma)', () => {
  assert.equal(CSV_SEPARADOR, ';');
  assert.equal(csvRow(['a', 'b', 'c']), 'a;b;c');
});

test('SCRUM-86: los importes llevan coma decimal y SIEMPRE 2 decimales', () => {
  assert.equal(csvNum(1234.5), '1234,50');
  assert.equal(csvNum(0), '0,00');
  assert.equal(csvNum(121), '121,00');
  assert.equal(csvNum('99.9'), '99,90');   // Prisma Decimal llega como string
  assert.equal(csvNum(-45.25), '-45,25');  // un abono no puede perder el signo
});

test('SCRUM-86: SIN separador de miles — es la causa nº 1 de que Excel lo lea como texto', () => {
  assert.equal(csvNum(1234567.89), '1234567,89');
  for (const s of [csvNum(1234.5), csvNum(1234567.89)]) {
    assert.ok(!s.includes('.'), `no puede quedar ningún punto: ${s}`);
    assert.equal((s.match(/,/g) || []).length, 1, `una sola coma, la decimal: ${s}`);
  }
});

test('SCRUM-86: nada de símbolo de moneda (no se reutiliza formatMoneyEs)', () => {
  // formatMoneyEs produce "2.383,70 €": símbolo + punto de miles → Excel lo lee como texto.
  for (const s of [csvNum(2383.7), csvNum(10)]) {
    assert.ok(!/[€$\s]/.test(s), `el importe no lleva moneda ni espacios: ${s}`);
    assert.match(s, /^-?\d+,\d{2}$/, `formato esperado 1234,50 — llegó ${s}`);
  }
});

test('SCRUM-86: un importe NUNCA se entrecomilla (comillas ⇒ Excel lo trata como texto)', () => {
  // Este es el detalle que se escapa fácil: el escapado antiguo entrecomillaba por coma,
  // y con decimal español la coma está en TODOS los importes.
  const importe = csvNum(1234.5);
  assert.equal(csvEscape(importe), '1234,50');
  assert.ok(!csvEscape(importe).includes('"'), 'un importe entre comillas se rompe en Excel');
  assert.equal(csvRow(['Factura', csvNum(121)]), 'Factura;121,00');
});

test('SCRUM-86: se sigue escapando lo que de verdad rompe el CSV', () => {
  assert.equal(csvEscape('Reforma; cocina'), '"Reforma; cocina"');   // el separador
  assert.equal(csvEscape('El "jefe"'), '"El ""jefe"""');             // comillas duplicadas
  assert.equal(csvEscape('línea1\nlínea2'), '"línea1\nlínea2"');     // salto de línea
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(undefined), '');
});

test('SCRUM-86: BOM UTF-8 al principio y UNO SOLO', () => {
  const body = csvBody({ header: ['Nombre', 'Importe'], rows: [csvRow(['Pepe', csvNum(10)])] });

  assert.equal(body.charCodeAt(0), 0xfeff, 'sin BOM Excel rompe los acentos');
  assert.notEqual(body.charCodeAt(1), 0xfeff, 'dos BOM = basura visible en la primera celda');
  assert.deepEqual([...Buffer.from(body, 'utf8').subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test('SCRUM-86: filas separadas por CRLF (lo que espera Excel en Windows)', () => {
  const body = csvBody({ header: ['A', 'B'], rows: ['1;2', '3;4'] });
  assert.equal(body, '﻿A;B\r\n1;2\r\n3;4');
});

test('SCRUM-86: el contrato completo, tal cual lo abre el asesor', () => {
  const body = csvBody({
    header: ['Número', 'Fecha', 'Base', 'IVA', 'Total'],
    rows: [csvRow(['2026-CF-001', '2026-07-22', csvNum(1234.5), csvNum(259.25), csvNum(1493.75)])],
  });

  assert.equal(
    body,
    '﻿Número;Fecha;Base;IVA;Total\r\n2026-CF-001;2026-07-22;1234,50;259,25;1493,75',
  );
  // La fecha va en ISO: inequívoca (22/07 vs 07/22) y Excel la reconoce como fecha.
  assert.match(body.split('\r\n')[1].split(';')[1], /^\d{4}-\d{2}-\d{2}$/);
});
