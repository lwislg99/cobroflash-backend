// tests/scrum659-lector-de-lineas-del-pdf.test.mjs — SCRUM-659
//
// EL INSTRUMENTO NO PODÍA VER UN SALTO DE LÍNEA, ASÍ QUE EL CRITERIO NO SE PODÍA VERIFICAR.
//
// `extraerTextoPdf` concatena los fragmentos sin separador. Medido en las dos direcciones:
// `'ALFA\nBETA'` y `'ALFABETA'` devuelven los DOS `"ALFABETA"`. PDFKit sí respeta el salto —lo
// pinta en dos líneas—, pero el lector no lo veía.
//
// Eso dejaba sin verificar el criterio de DOC-03 (SCRUM-593) y el de SCRUM-655 (T6), que pide
// descripciones de ocho líneas con los saltos respetados. Un test escrito contra el lector de
// texto pasaría en VERDE con el salto roto: un guard muerto el día que nace.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE AÑADE UNA LECTURA; NO SE CAMBIA LA QUE HAY
//
// `extraerTextoPdf` sostiene los controles de SCRUM-603, 604, 604b, 623, 625, 636 y 647. Medido
// antes de decidir: los consumidores usan `r.ok` (147 veces), `r.motivo` (107) y `r.texto` (54), y
// **ninguno usa `r.trozos`**. Aun así se añade una función APARTE en lugar de un campo: así el
// riesgo sobre el camino existente es CERO y no «pequeño».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { extraerTextoPdf, lineasDePdf, lineasConPdf } from './_texto-del-pdf.mjs';

const TMP = path.join(process.env.TEMP || process.env.TMPDIR || '.', 'scrum659');
fs.mkdirSync(TMP, { recursive: true });

/** Un PDF de una sola llamada a `text`, para poder controlar exactamente qué se pinta. */
function pdfCon(texto, opciones = {}) {
  return new Promise((resolver) => {
    const f = path.join(TMP, `p${Math.random().toString(36).slice(2)}.pdf`);
    const d = new PDFDocument();
    const s = fs.createWriteStream(f);
    d.pipe(s);
    d.fontSize(10).text(texto, { width: 400, ...opciones });
    d.end();
    s.on('finish', () => resolver(fs.readFileSync(f)));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL, EN LAS DOS DIRECCIONES. Es todo el ticket.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-659 · 🔴 CON salto dice DOS líneas · SIN salto dice UNA', async () => {
  const con = lineasDePdf(await pdfCon('ALFA\nBETA'));
  const sin = lineasDePdf(await pdfCon('ALFABETA'));

  assert.equal(con.ok, true, `🔴 no supe leer el PDF con salto: ${con.motivo}`);
  assert.equal(sin.ok, true, `🔴 no supe leer el PDF sin salto: ${sin.motivo}`);

  assert.equal(con.lineas.length, 2,
    `🔴 un texto con salto se lee como ${con.lineas.length} línea(s): ${JSON.stringify(con.lineas.map((l) => l.texto))}`);
  assert.equal(sin.lineas.length, 1,
    `🔴 un texto sin salto se lee como ${sin.lineas.length} línea(s): ${JSON.stringify(sin.lineas.map((l) => l.texto))}`);

  // 🔴 Y LO QUE DECIDE EL TICKET: que NO den lo mismo. Si las dos direcciones coincidieran, el
  // instrumento seguiría sin distinguir nada y esto no estaría hecho.
  assert.notEqual(con.lineas.length, sin.lineas.length,
    '🔴 las dos direcciones dan el mismo número de líneas: el lector no distingue el salto.');
  assert.deepEqual(con.lineas.map((l) => l.texto), ['ALFA', 'BETA'],
    '🔴 las dos líneas no traen su propio texto.');
});

test('SCRUM-659 · 🔴 y el lector VIEJO sigue sin poder distinguirlo — por eso hacía falta éste', () => {
  // Se deja fijado como HECHO, no como defecto a arreglar: es la razón de existir de este ticket, y
  // si algún día `extraerTextoPdf` empezara a separar líneas, este test caería y habría que
  // revisar los siete controles que dependen de su salida.
  return Promise.all([pdfCon('ALFA\nBETA'), pdfCon('ALFABETA')]).then(([c, s]) => {
    assert.equal(extraerTextoPdf(c).texto, extraerTextoPdf(s).texto,
      '🔴 `extraerTextoPdf` ha cambiado de comportamiento. No es una mejora gratis: siete tests\n'
      + '  (603, 604, 604b, 623, 625, 636, 647) leen su salida y cambiarían de significado.');
  });
});

test('SCRUM-659 · 🔴 ocho líneas se leen como OCHO — el caso de SCRUM-655', async () => {
  const ocho = Array.from({ length: 8 }, (_, i) => `Linea numero ${i + 1}`).join('\n');
  const r = lineasDePdf(await pdfCon(ocho));
  assert.equal(r.ok, true, `🔴 ${r.motivo}`);
  assert.equal(r.lineas.length, 8,
    `🔴 una descripción de ocho líneas se lee como ${r.lineas.length}: ${JSON.stringify(r.lineas.map((l) => l.texto))}`);
  assert.equal(lineasConPdf(r.lineas, 'Linea numero'), 8, '🔴 `lineasConPdf` no las cuenta.');
  // Y el orden es el de LECTURA, no el del flujo.
  assert.equal(r.lineas[0].texto, 'Linea numero 1', '🔴 la primera línea no es la de arriba.');
  assert.equal(r.lineas[7].texto, 'Linea numero 8', '🔴 la última línea no es la de abajo.');
});

test('SCRUM-659 · el ajuste automático también son líneas: un párrafo largo ocupa varias', async () => {
  // No lleva ni un `\n`: lo parte el ancho. Para el criterio de T6 cuenta igual — lo que se afirma
  // es cuántas líneas VE quien lee el papel.
  const largo = 'palabra '.repeat(60).trim();
  const r = lineasDePdf(await pdfCon(largo, { width: 200 }));
  assert.equal(r.ok, true, `🔴 ${r.motivo}`);
  assert.ok(r.lineas.length > 3,
    `🔴 un párrafo de 60 palabras en 200pt se lee como ${r.lineas.length} línea(s).`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE YA VIGILABA NO SE TOCA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-659 · 🔴 el lector nuevo no pierde ni inventa un solo carácter', async () => {
  // La invariante que protege a los siete controles: los dos lectores leen LO MISMO. Lo único que
  // cambia es el ORDEN — el flujo del PDF no va de arriba abajo y el lector de líneas sí.
  const buf = await pdfCon('ALFA\nBETA\nGAMMA');
  const viejo = extraerTextoPdf(buf);
  const nuevo = lineasDePdf(buf);
  assert.equal(viejo.ok && nuevo.ok, true, '🔴 alguno de los dos lectores no supo leer.');
  const ordenado = (s) => s.split('').sort().join('');
  assert.equal(ordenado(viejo.texto), ordenado(nuevo.texto),
    `🔴 los dos lectores no leen lo mismo:\n  viejo: ${JSON.stringify(viejo.texto)}\n  nuevo: ${JSON.stringify(nuevo.texto)}`);
  assert.equal(viejo.texto.length, nuevo.texto.length, '🔴 uno de los dos pierde o repite caracteres.');
});

test('SCRUM-659 · SUELO: sobre un DOCUMENTO REAL, no sobre un PDF de juguete', async () => {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: 99659000, quoteNumber: 659,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '72.60',
    lines: [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 }],
    signatureData: null, country: 'ES',
  });
  try {
    const buf = fs.readFileSync(outPath);
    const r = lineasDePdf(buf);
    assert.equal(r.ok, true, `🔴 no sé leer las líneas de un presupuesto de verdad: ${r.motivo}`);
    assert.ok(r.lineas.length > 5,
      `🔴 un presupuesto entero se lee como ${r.lineas.length} línea(s): el lector no está mirando.`);
    // CONTROL NEGATIVO: no puede encontrar una línea que el documento no tiene.
    assert.equal(lineasConPdf(r.lineas, 'FACTURA RECTIFICATIVA'), 0,
      '🔴 dice ver una línea que ese documento no imprime.');
    // Y el contenido sigue siendo el mismo que ve el lector de siempre.
    const ordenado = (s) => s.split('').sort().join('');
    assert.equal(ordenado(extraerTextoPdf(buf).texto), ordenado(r.texto),
      '🔴 sobre un documento real los dos lectores dejan de leer lo mismo.');
  } finally {
    fs.rmSync(outPath, { force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED: «no supe leerlo» nunca se disfraza de «no tiene líneas»
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-659 · 🔴 hereda los suelos del lector de texto: lo ilegible se DECLARA', () => {
  const basura = lineasDePdf(Buffer.from('esto no es un PDF'));
  assert.equal(basura.ok, false, '🔴 dice haber leído líneas de algo que no es un PDF.');
  assert.ok(basura.motivo && basura.motivo.length > 10,
    '🔴 se declara ciego sin decir por qué, que es la mitad del valor.');
  // Y la forma del resultado es la misma que la del lector de siempre, para que quien ya sabe
  // leer un `ok:false` no tenga que aprender otra.
  assert.equal(extraerTextoPdf(Buffer.from('esto no es un PDF')).ok, false);
});

test('SCRUM-659 · 🔴 un fragmento SIN posición hace caer la lectura, no baja el recuento', () => {
  // Es el modo en que este instrumento mentiría en verde: si hubiera texto que no sabemos situar,
  // contaríamos MENOS líneas de las que hay y un salto roto pasaría desapercibido. Se comprueba
  // que el motivo existe en el código, anclado a su frase — el caso no se puede fabricar con
  // PDFKit, que siempre emite `Tm`.
  const modulo = fs.readFileSync(new URL('./_texto-del-pdf.mjs', import.meta.url), 'utf8');
  assert.match(modulo, /sin operador de posición: no sé en qué línea van/,
    '🔴 se ha quitado el suelo del fragmento sin posición. Sin él, un texto que no sepamos situar\n'
    + '  se descartaría en silencio y el recuento de líneas sería menor que el real.');
  assert.match(modulo, /if \(sinPosicion > 0\)/, '🔴 el suelo ya no se evalúa.');
});
