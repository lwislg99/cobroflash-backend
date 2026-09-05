// tests/scrum661-el-coste-no-llega-al-papel.test.mjs — SCRUM-661 (condición 1)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL COSTE DEL PROFESIONAL NO LLEGA AL PAPEL QUE FIRMA SU CLIENTE.
//
// Es lo más importante del ticket, y no es un fallo estético: si el coste unitario aparece en el
// presupuesto o en la factura, el cliente ve el margen y la negociación se acabó.
//
// 🔴 SE LEE EL PDF DE VERDAD, no el objeto que se le pasa al generador. Que un dato no esté en la
// plantilla NO prueba que no salga; que salga en el papel SÍ prueba que sale. El instrumento es
// `lineasDePdf` (SCRUM-659), que además dice DÓNDE está cada texto.
//
// 🔴 QUÉ SIGNIFICA EL VERDE DE ESTE FICHERO — Y HA CAMBIADO. LÉELO ANTES DE FIARTE DE ÉL.
//
// HASTA SCRUM-661 ①②③ significaba «aquí no hay coste que filtrar». El guard entró ANTES que el
// dato, a propósito: protegía la FORMA, porque el día que el coste viajara de verdad nadie se
// acordaría de comprobarlo, y un guard que llega después del dato llega tarde. Pero mientras el
// coste no existía, su verde no era una garantía de contención: era una consecuencia de que no
// hubiera sujeto.
//
// DESDE SCRUM-661 ①②③ SÍ HAY SUJETO. `searchProducts` devuelve `cost`, la línea lo congela y lo
// envía, y `QuoteLineSchema` lo deja llegar a `Quote.lines`. Así que a partir de aquí el verde
// significa lo segundo: **EL COSTE ESTÁ CONTENIDO** — llega a la base y NO sale por el papel.
//
// Por eso las líneas de prueba de abajo ya no se escriben a mano: se construyen POR LA CADENA
// REAL (`costeDeCatalogo` → `costeParaPayload` → `CreateQuoteSchema`), que es la única forma de
// que lo que se le da al PDF sea lo mismo que le llegará en producción.
//
// ⛔ `pdf.service.ts` NO se toca: es de S3. Aquí se LEE su salida.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { lineasDePdf, extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const ts = require_('typescript');
const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

/** La misma extracción que usa `scrum661b`: la vista no se importa, se saca del árbol y se ejecuta. */
function funcionDeLaVista(nombre) {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i > 0, `🔴 no encuentro \`${nombre}\` en la vista.`);
  const sf = ts.createSourceFile('x.js', src.slice(i), ts.ScriptTarget.Latest, true);
  const fn = sf.statements[0];
  assert.ok(ts.isFunctionDeclaration(fn), `🔴 lo que hay en \`${nombre}\` no es una función.`);
  // eslint-disable-next-line no-new-func
  return new Function(`${fn.getText(sf)}; return ${nombre};`)();
}

/**
 * Un coste RECONOCIBLE e improbable: si aparece en el papel, no es coincidencia.
 * Se busca en las tres grafías que puede tomar un importe en este árbol.
 */
const COSTE = 1234.56;
const GRAFIAS = ['1234.56', '1234,56', '1.234,56'];

/**
 * 🔴 LAS LÍNEAS SE CONSTRUYEN POR LA CADENA REAL, no a mano.
 *
 * Antes de SCRUM-661 ①②③ el `costeUnitario` se escribía aquí directamente, porque no había otra
 * forma: el campo no existía en ningún sitio. Ahora sí existe, así que fabricarlo a mano
 * probaría el PDF contra una línea inventada — y lo que hay que probar es la que va a llegar.
 *
 * El recorrido es el del profesional: elige un producto del catálogo (que ahora trae `cost`), el
 * campo de la línea lo congela, el payload lo envía y el esquema lo deja pasar a `Quote.lines`.
 */
const PRODUCTO_DEL_CATALOGO = { id: 7, name: 'Detector de humos', price: '1000.00', cost: String(COSTE) };

function lineasComoLleganDeVerdad() {
  const enElCampo = funcionDeLaVista('costeDeCatalogo')(PRODUCTO_DEL_CATALOGO.cost);
  const enElPayload = funcionDeLaVista('costeParaPayload')(enElCampo);
  assert.deepEqual(enElPayload, { costeUnitario: COSTE },
    '🔴 SUELO: la cadena no está entregando el coste, así que este fichero estaría probando que '
    + 'no sale al papel algo que tampoco ha entrado. Un verde así no significa nada.');

  const validado = CreateQuoteSchema.parse({
    merchant_id: 1, customer_id: 1, currency: 'EUR',
    lines: [
      { concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21, ...enElPayload },
      { concept: 'Material', qty: 1, price: 50, tax: 0.21, ...enElPayload },
    ],
  });
  // Y el coste sigue ahí después de la puerta: si no, lo de abajo no probaría nada.
  assert.equal(validado.lines[0].costeUnitario, COSTE, '🔴 SUELO: el esquema ha borrado el coste.');
  return validado.lines;
}

const LINEAS_CON_COSTE = lineasComoLleganDeVerdad();

async function pdfDePresupuesto(id, lines) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: id,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '302.50', lines,
  });
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

async function pdfDeFactura(sufijo, lines) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA661${sufijo}`,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '302.50', qrData: 'x', type: 'F1', lines,
  });
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

/** Cuántas veces aparece el coste en el papel, en cualquiera de sus grafías. */
function vecesQueAparece(texto) {
  return GRAFIAS.reduce((n, g) => n + vecesEnPdf(texto, g), 0);
}

test('SCRUM-661 · SUELO: el lector VE líneas de un PDF de verdad', async () => {
  const buf = await pdfDePresupuesto(6610, LINEAS_CON_COSTE);
  const r = lineasDePdf(buf);
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un lector que no lee diría que el `
    + 'coste no está por el mismo motivo por el que no ve nada — y eso es un falso verde.');
  assert.ok(r.lineas.length > 5,
    `🔴 LECTOR CIEGO: sólo ${r.lineas.length} líneas. «No está el coste» y «no supe mirar» son el `
    + 'mismo resultado con significados opuestos.');
});

test('SCRUM-661 · 🔴 CONTROL NEGATIVO: lo que SÍ debe salir, sale', async () => {
  // Sin esto, un lector que devolviera texto vacío pasaría el guard de abajo sin mirar nada.
  const texto = extraerTextoPdf(await pdfDePresupuesto(6611, LINEAS_CON_COSTE)).texto;
  assert.equal(vecesEnPdf(texto, 'Mano de obra') > 0, true, '🔴 no encuentro ni el concepto.');
  assert.equal(vecesEnPdf(texto, '100,00') > 0, true, '🔴 no encuentro ni el precio de la línea.');
  // Y el detector del coste, sobre este mismo documento, distingue: encuentra el precio y NO el coste.
  assert.equal(vecesQueAparece(texto), 0);
});

test('SCRUM-661 · 🔴 EL COSTE NO LLEGA AL PRESUPUESTO', async () => {
  const texto = extraerTextoPdf(await pdfDePresupuesto(6612, LINEAS_CON_COSTE)).texto;
  assert.equal(vecesQueAparece(texto), 0,
    `🔴 EL COSTE DEL PROFESIONAL ESTÁ EN EL PAPEL QUE FIRMA SU CLIENTE (${COSTE}). No es un fallo `
    + 'de maquetación: el cliente ve el margen y la negociación se acabó.');
  // Y tampoco el NOMBRE del campo, que delataría igual.
  for (const n of ['costeUnitario', 'coste', 'Coste']) {
    assert.equal(vecesEnPdf(texto, n), 0, `🔴 el documento nombra «${n}».`);
  }
});

test('SCRUM-661 · 🔴 EL COSTE NO LLEGA A LA FACTURA', async () => {
  const texto = extraerTextoPdf(await pdfDeFactura('A', LINEAS_CON_COSTE)).texto;
  assert.equal(vecesQueAparece(texto), 0,
    `🔴 EL COSTE DEL PROFESIONAL ESTÁ EN LA FACTURA (${COSTE}).`);
  for (const n of ['costeUnitario', 'coste', 'Coste']) {
    assert.equal(vecesEnPdf(texto, n), 0, `🔴 la factura nombra «${n}».`);
  }
});

test('SCRUM-661 · 🔴 EL ROJO: el guard CAE cuando el coste SÍ sale', async () => {
  // «Un guard de fuga que no se ha visto caer ante la fuga no protege nada.» Aquí se provoca la
  // fuga por el único camino disponible sin tocar `pdf.service.ts` (que es de S3): se mete el
  // número del coste en un campo que el documento SÍ imprime.
  //
  // ⚠️ ESTO PRUEBA EL DETECTOR, no que `pdf.service` filtre. Es la distinción honesta: demuestra
  // que si el coste llegara al papel, este guard lo vería — que es lo que hay que poder afirmar.
  const conFuga = [{ concept: `Mano de obra ${COSTE}`, qty: 1, price: 100, tax: 0.21, costeUnitario: COSTE }];
  const texto = extraerTextoPdf(await pdfDePresupuesto(6613, conFuga)).texto;

  assert.ok(vecesQueAparece(texto) > 0,
    '🔴 EL DETECTOR NO VE UNA FUGA QUE ESTÁ DELANTE. Con el coste impreso en el papel, este guard '
    + 'ha dado verde: no protege nada y hay que arreglarlo ANTES de fiarse de los casos de arriba.');

  // Y dice DÓNDE está, que es lo que sirve dentro de tres meses.
  const r = lineasDePdf(await pdfDePresupuesto(6614, conFuga));
  const donde = r.lineas.filter((l) => GRAFIAS.some((g) => l.texto.includes(g)));
  assert.ok(donde.length > 0, '🔴 el lector de líneas no sabe decir en qué línea está la fuga.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ VE ESTE DETECTOR Y QUÉ NO — MEDIDO, no supuesto (2-sep-2026)
//
// Con el guard en verde y con sujeto real, se le hace la pregunta que no se le hizo al
// escribirlo: ¿y si el coste sale en el papel con OTRA GRAFÍA? El hueco estaba declarado en la
// entrada de máster («vigila un número reconocible y el nombre del campo»), pero declarado en
// prosa envejece; aquí queda FIJADO, y si alguien mejora el detector este caso cae y le obliga a
// actualizar la declaración en vez de dejarla mintiendo.
//
// No se cierra el hueco entero a propósito: cubrir toda grafía posible exigiría normalizar el
// texto del PDF, y eso convierte un detector legible en un detector que nadie audita. Lo que sí
// hace falta es SABER qué no cubre, y que esté escrito donde se lee.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-661 · 🔴 INTERROGATORIO: las grafías que el detector VE, y las que NO', () => {
  const ve = (t) => vecesQueAparece(t) > 0;

  // LO QUE VE. Si alguna de éstas dejara de verse, el guard se habría vuelto más ciego sin que
  // nadie tocara su lógica —por ejemplo cambiando cómo formatea importes el generador—.
  const CUBIERTO = {
    'punto decimal (1234.56)': 'Total 1234.56 EUR',
    'coma decimal (1234,56)': 'Total 1234,56 EUR',
    'miles con punto (1.234,56)': 'Total 1.234,56 EUR',
    'con el símbolo pegado': '1.234,56EUR',
    // El encargo preguntaba justo por éste: sí lo ve, porque busca subcadena y no una celda.
    'DENTRO de una descripción larga': 'Coste unitario del material: 1.234,56 EUR por unidad',
  };
  for (const [que, texto] of Object.entries(CUBIERTO)) {
    assert.equal(ve(texto), true, `🔴 el detector ha DEJADO DE VER «${que}». Era una de las `
      + 'grafías cubiertas: el guard se ha vuelto más ciego sin que nadie tocara su lógica.');
  }

  // 🔴 LO QUE **NO** VE. Está aquí para que se lea, no para que se ignore: si el coste se
  // filtrara en alguna de estas formas, este guard daría VERDE y la fuga pasaría.
  const NO_CUBIERTO = {
    'miles con ESPACIO (1 234,56)': 'Total 1 234,56 EUR',
    'miles con espacio DURO (1 234,56)': 'Total 1 234,56 EUR',
    'REDONDEADO a un decimal (1234.5)': 'Total 1234.5 EUR',
    'REDONDEADO a entero (1235)': 'Total 1235 EUR',
    'partido por un salto de línea': 'Total 1234.\n56 EUR',
    'apóstrofo de miles (1’234,56)': "Total 1’234,56 EUR",
  };
  for (const [que, texto] of Object.entries(NO_CUBIERTO)) {
    assert.equal(ve(texto), false,
      `✅ BUENA NOTICIA con deberes: el detector AHORA VE «${que}», que estaba declarado como `
      + 'hueco el 2-sep-2026. No es un fallo: actualiza la lista y la entrada de máster, porque '
      + 'un hueco declarado que ya no existe engaña igual que uno que no se declaró.');
  }

  // Y el nombre del campo se busca en tres grafías, pero NO en otras que un generador podría
  // usar. Se mide igual, para que la lista de arriba no parezca la única frontera.
  assert.equal(vecesEnPdf('Coste unit. 10', 'coste'), 0,
    '✅ el detector ahora ve «Coste unit.»: actualiza la declaración del hueco.');
});
