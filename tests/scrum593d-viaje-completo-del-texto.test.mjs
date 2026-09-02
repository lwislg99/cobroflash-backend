// tests/scrum593d-viaje-completo-del-texto.test.mjs — SCRUM-593 (DOC-03) · fase ③
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL VIAJE ENTERO, CONTRA UNA BASE DE VERDAD: se escribe → se GUARDA → se RELEE → sale en el PDF
//
// Los otros tres ficheros de este ticket miran cada tramo por separado: el PDF pinta si le pasas
// el texto (593), la pieza de pantalla lo lee de vuelta (593b) y las tres puertas lo pasan (593c).
// **Ninguno demuestra que el texto sobreviva a la base.** Un `@map` mal escrito, una columna con
// otro nombre o un campo que la ruta no guarda dan verde en los tres y pierden el texto en el
// único sitio donde importa.
//
// 🔴 EL RELEER ES LA MITAD QUE CUENTA, y por eso el PDF NO se genera con el objeto que se acaba de
// escribir: se hace un `findUnique` NUEVO y el documento se pinta con LO QUE LA BASE DEVUELVE. Con
// el objeto en mano, el test pasaría aunque la columna no existiera.
//
// ── GATEADO, y se declara por qué ────────────────────────────────────────────────────────────
// Necesita base, así que vive detrás de `QA_DB_TEST=1` (`npm run test:staging:gated`) y en `npm
// test` sale en SKIP con su motivo escrito. El tramo estructural —que las puertas pasen los
// campos— NO está gateado a propósito: vive en 593c y corre siempre.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de pruebas del carril; fail-closed anti-prod
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withMerchant } from './_merchant-fixture.mjs';
import { lineasDePdf, lineasConPdf } from './_texto-del-pdf.mjs';

// 🔴 EL MOTIVO DEL SALTO VA EN EL LITERAL DE CADA `skip`, no en una constante. El censo de
// SCRUM-456 lee el motivo del CÓDIGO, así que un `skip: SIN_DB` se apaga sin decir por qué —
// y un test que se apaga en silencio es un test que nadie echa de menos.
const DB = process.env.QA_DB_TEST === '1';

// Marcas irrepetibles: si aparecieran por otra vía, no serían prueba de nada.
const CABECERA = 'CAB593D_UNO\nCAB593D_DOS';
const PIE = 'PIE593D_ALFA\nPIE593D_BETA\nPIE593D_GAMMA';

/** Genera el PDF de un presupuesto RELEÍDO de la base y devuelve sus líneas. */
async function pdfDeLaFila(prisma, quoteId) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const fila = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { merchant: true, customer: true },
  });
  assert.ok(fila, '🔴 SUELO: no encuentro el presupuesto que acabo de crear.');
  const { outPath } = await generateQuotePdf({
    quoteId: fila.id,
    quoteNumber: fila.quoteNumber,
    merchant: { name: fila.merchant.name, legalName: fila.merchant.legalName, taxId: fila.merchant.taxId },
    customer: { name: fila.customer.name },
    // 🔴 DE LA FILA, no de una variable de este test.
    docHeaderText: fila.docHeaderText,
    docFooterText: fila.docFooterText,
    currency: fila.currency,
    total: fila.total.toString(),
    lines: fila.lines,
    country: 'ES',
  });
  try {
    const buf = fs.readFileSync(outPath);
    const r = lineasDePdf(buf);
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    return { lineas: r.lineas, fila };
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/** Un presupuesto mínimo dentro de un merchant desechable. */
async function conPresupuesto(datosExtra, fn) {
  const { prisma } = await import('../dist/core/db/prisma.js');
  await withMerchant(prisma, { name: 'QA 593d' }, async (merchant) => {
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'Cliente 593d' },
    });
    const quote = await prisma.quote.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        currency: 'EUR',
        total: '121.00',
        lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
        ...datosExtra,
      },
    });
    await fn({ prisma, merchant, customer, quote });
  });
}

test('SCRUM-593d · 🔴 EL VIAJE: se escribe, se guarda, se RELEE y sale en el PDF', { skip: !DB && 'necesita base: sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  await conPresupuesto({ docHeaderText: CABECERA, docFooterText: PIE }, async ({ prisma, quote }) => {
    const { lineas, fila } = await pdfDeLaFila(prisma, quote.id);

    // ── 1 · sobrevivió a la BASE, con sus saltos intactos
    assert.equal(fila.docHeaderText, CABECERA,
      '🔴 la cabecera no vuelve igual de la base: o el `@map` apunta a otra columna, o algo la '
      + 'normaliza por el camino. Los saltos son DATO (SCRUM-655 · T6).');
    assert.equal(fila.docFooterText, PIE, '🔴 el pie no vuelve igual de la base.');

    // ── 2 · y llegó al PAPEL, cada línea en la suya
    for (const marca of ['CAB593D_UNO', 'CAB593D_DOS', 'PIE593D_ALFA', 'PIE593D_BETA', 'PIE593D_GAMMA']) {
      assert.equal(lineasConPdf(lineas, marca), 1,
        `🔴 «${marca}» no sale en su propia línea del PDF generado desde la fila releída.`);
    }
    const i = (m) => lineas.findIndex((l) => l.texto.includes(m));
    assert.ok(i('CAB593D_UNO') < i('PIE593D_ALFA'),
      '🔴 el bloque de cabecera no sale antes que el final.');
  });
});

test('SCRUM-593d · 🔴 CONTROL NEGATIVO: sin escribirlos, la base los devuelve NULL y el papel no los pinta', { skip: !DB && 'necesita base: sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  await conPresupuesto({}, async ({ prisma, quote }) => {
    const { lineas, fila } = await pdfDeLaFila(prisma, quote.id);
    assert.equal(fila.docHeaderText, null,
      '🔴 un presupuesto que no los pidió vuelve con cabecera: hay un default donde no debe haberlo.');
    assert.equal(fila.docFooterText, null, '🔴 vuelve con pie sin haberlo escrito.');
    for (const marca of ['CAB593D_UNO', 'PIE593D_ALFA', 'Observaciones']) {
      assert.equal(lineasConPdf(lineas, marca), 0,
        `🔴 sale «${marca}» en un documento que no lo pidió.`);
    }
    // SUELO del control: el detector SÍ ve algo que el documento imprime siempre.
    assert.ok(lineasConPdf(lineas, 'Total ') >= 1,
      '🔴 SUELO: el lector no encuentra ni el total. Sus ceros de arriba no significarían nada.');
  });
});

test('SCRUM-593d · 🔴 vaciar un texto ya guardado lo deja en NULL, no en cadena vacía', { skip: !DB && 'necesita base: sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  await conPresupuesto({ docHeaderText: CABECERA, docFooterText: PIE }, async ({ prisma, quote }) => {
    await prisma.quote.update({ where: { id: quote.id }, data: { docHeaderText: null, docFooterText: null } });
    const { lineas, fila } = await pdfDeLaFila(prisma, quote.id);
    assert.equal(fila.docHeaderText, null, '🔴 no se pudo vaciar la cabecera.');
    assert.equal(lineasConPdf(lineas, 'CAB593D_UNO'), 0, '🔴 el papel sigue pintando un texto ya borrado.');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO ASIMÉTRICO, AHORA CONTRA LA BASE: comprobar una AUSENCIA
//
// Que «el pie del albarán se REUTILIZA» sólo es una comprobación si alguien mira que el segundo
// campo NO existe. Es la única forma de distinguir una reutilización real de una intención
// declarada en un comentario.
//
// ⚠️ ALCANCE DECLARADO: esto mira LA BASE DE PRUEBAS DE ESTE CARRIL, no producción. Producción no
// vive en un árbol de trabajo (regla 3) y su comprobación la corre el fundador.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593d · 🔴 SUELO ASIMÉTRICO: `albaranes.doc_footer_text` NO existe en la base', { skip: !DB && 'necesita base: sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const filas = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema='public'
        AND ((table_name='albaranes' AND column_name IN ('doc_header_text','doc_footer_text','notas'))
          OR (table_name='quotes'    AND column_name IN ('doc_header_text','doc_footer_text')))`,
  );
  const vistas = new Set(filas.map((f) => `${f.table_name}.${f.column_name}`));

  // CONTROL POSITIVO primero: sin él, un cero significaría «no supe mirar» y no «no está».
  for (const c of ['albaranes.notas', 'albaranes.doc_header_text', 'quotes.doc_header_text', 'quotes.doc_footer_text']) {
    assert.equal(vistas.has(c), true,
      `🔴 CONTROL POSITIVO CAÍDO: no veo ${c}, que sí tiene que estar. Si la consulta no ve lo que `
      + 'hay, su «no existe» de abajo no es una medición.');
  }
  assert.equal(vistas.has('albaranes.doc_footer_text'), false,
    '🔴 existe `albaranes.doc_footer_text`. El pie de ese documento es `notas`, que ya existía y ya '
    + 'se imprimía: con dos campos para lo mismo, al día siguiente nadie sabe cuál manda.');
});
