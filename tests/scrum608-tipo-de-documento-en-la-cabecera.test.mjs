// tests/scrum608-tipo-de-documento-en-la-cabecera.test.mjs — SCRUM-608 (ALB-03)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL PAPEL TIENE QUE DECIR QUÉ ES, ARRIBA DEL TODO.
//
// 🔴 ESTE TICKET LLEGÓ YA HECHO, Y ESO ES EXACTAMENTE POR LO QUE ESTE FICHERO EXISTE.
//
// SCRUM-608 pedía que el PDF dijera arriba «Albarán» / «Presupuesto» / «Factura», y daba por
// hecho que sólo el presupuesto lo hacía. MEDIDO sobre el árbol el 6-sep-2026: **los tres ya lo
// decían**, y desde mucho antes de que el ticket se escribiera (22-may-2026 el presupuesto,
// 11-jun-2026 la factura, 12-jul-2026 el albarán). El ticket nació satisfecho porque nadie lo
// midió al abrirlo — su propia descripción admite que el documento de origen «no dice qué
// muestran hoy la cabecera del PDF de factura ni la de albarán».
//
// Lo que NO había era nada que lo sostuviera: tres literales sueltos en dos ficheros, sin un solo
// assert encima. Y eso importa más aquí que en otro sitio, porque SCRUM-762 tiene medido que el
// PDF de un documento **ya emitido y firmado** se REGENERA con el código de hoy en cuanto el
// fichero falta del disco (el fs de Railway es efímero). Provocado en esta misma tanda sobre
// `ensureAlbaranPdf` con un albarán v:3 firmado: mutando el generador, el MISMO albarán sale con
// otra cabecera. O sea: una regresión aquí no estropea sólo los documentos futuros — reescribe el
// aspecto de los pasados.
//
// Así que el trabajo de este ticket no es escribir la cabecera: es que no se pueda perder en
// silencio.
//
// ── QUÉ SE AFIRMA, Y POR QUÉ ASÍ ────────────────────────────────────────────────────────────
// Se afirma sobre la PRIMERA LÍNEA DE LA PÁGINA —la de `y` mayor—, no sobre «el texto contiene».
// «Contiene» daría verde con la palabra escondida en el pie legal, que es justo donde no sirve:
// el cliente que tiene el papel en la mano lee lo de arriba.
//
// ── LO QUE ESTE FICHERO NO TOCA ─────────────────────────────────────────────────────────────
// ⛔ Sólo LEE el camino de emisión (regla 38): llama a los tres generadores tal y como están
//    exportados hoy y no cambia ni una firma. No hay refactor, no hay constante compartida nueva
//    y no hay microcopy nueva — los tres rótulos llevan meses impresos y no se toca ni una letra.
// ⛔ No afirma NADA sobre la numeración (`AB260001`, series, formato): ese carril es de SCRUM-361
//    y de los tests gateados de `tests/albaran.test.mjs`. Los números que se usan aquí son de
//    atrezo y se eligen a propósito con formas que ningún guard de serie reconoce.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineasDePdf } from './_texto-del-pdf.mjs';
// El LECTOR OFICIAL del meta-guard (SCRUM-745). Se importa para preguntarle si VE la declaración
// de este fichero — no para reimplementar su criterio.
import { mutacionesDeclaradas } from '../scripts/meta-guard-mutaciones.mjs';
// SCRUM-262 · el teléfono de un dato de prueba no puede ser de nadie. Se DERIVA del sitio único en
// vez de escribirlo: `+34 6XX` es rango de móvil español ORDINARIO, y hay tres crons que envían
// WhatsApp a teléfonos guardados. Lo cazó `tests/scrum262-telefonos-de-prueba.test.mjs` en la
// primera tanda de este ticket, con el número puesto a mano.
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AQUI = fileURLToPath(import.meta.url);

// 🔴 SCRUM-409 · NUNCA el id 1: ése es el merchant DEMO, y su PDF sale CON MARCA DE AGUA. Un
// fixture ahí no mide el documento que dice medir. Lo cazó su guard en la primera tanda.
const MERCHANT_ID = 7;
const MERCHANT = {
  name: 'QA Fontanería', legalName: 'QA Fontanería SL', taxId: 'B00000000',
  address: 'C/ QA 1', logoUrl: null, whatsappPhone: telefonoDePrueba(608),
};
const CLIENTE = { name: 'Cliente QA' };
const LINEAS = [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 21 }];

/**
 * La PRIMERA línea de la página, con su texto. `lineasDePdf` ya devuelve las líneas ordenadas por
 * `y` descendente, que es el orden de lectura.
 *
 * 🔴 El `ok:false` del lector se convierte en un fallo RUIDOSO a propósito: «no supe leer el PDF»
 * y «el PDF no dice eso» se escriben igual si uno deja que la cadena vacía siga adelante.
 */
function primeraLineaDe(outPath, quien) {
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF (${quien}): ${r.motivo}. Un texto vacío se `
      + 'leería como «el documento no lo dice», que es un falso rojo tan malo como un falso verde.');
    assert.ok(r.lineas.length > 3, `🔴 CIEGO (${quien}): sólo ${r.lineas.length} líneas leídas.`);
    return r.lineas[0].texto;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

async function cabeceraDeFactura(id, extra = {}) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `QA608-${id}`, invoiceId: id, merchantId: MERCHANT_ID,
    merchant: MERCHANT, customer: CLIENTE, currency: 'EUR', total: '121.00',
    qrData: `QA:${id}`, createdAt: new Date('2026-09-06T10:00:00Z'), lines: LINEAS, ...extra,
  });
  return primeraLineaDe(outPath, `factura ${extra.type ?? 'F1'}`);
}

async function cabeceraDePresupuesto(id, country) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: id, quoteNumber: id, merchant: MERCHANT, customer: CLIENTE,
    currency: 'EUR', total: '121.00', lines: LINEAS, country,
  });
  return primeraLineaDe(outPath, `presupuesto ${country ?? 'sin país'}`);
}

async function cabeceraDeAlbaran(sufijo, extra = {}) {
  const { generateAlbaranPdf } = await import('../dist/modules/jobs/infra/albaranPdf.service.js');
  const { outPath } = await generateAlbaranPdf({
    merchantId: MERCHANT_ID,
    // Atrezo A PROPÓSITO sin forma de serie: aquí no se afirma nada sobre la numeración.
    numero: `QA608${sufijo}`,
    fecha: new Date('2026-09-06T10:00:00Z'), emisionAt: new Date('2026-09-06T10:00:00Z'),
    version: 1, modoValoracion: 'VALORADO',
    merchant: { address: MERCHANT.address, logoUrl: null, whatsappPhone: MERCHANT.whatsappPhone },
    customer: { taxId: null },
    obra: null, referenciaTrabajo: null, cliente: 'Cliente QA',
    emisor: 'QA Fontanería SL', emisorNif: 'B00000000',
    lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'ud', precioUnitario: 100 }],
    totales: { base: 100, cuota: 21, total: 121 },
    ...extra,
  });
  return primeraLineaDe(outPath, `albarán ${sufijo}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL SUELO — que el instrumento vea, y que no vea lo que no está
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-608 · SUELO: leo de verdad la primera línea de un PDF, y no leo lo que no está', async () => {
  const cabecera = await cabeceraDeFactura(60801);
  assert.ok(cabecera.length > 0, '🔴 CIEGO: la primera línea ha salido vacía.');
  // CONTROL NEGATIVO del instrumento: si devolviera cualquier cosa como buena, todo lo de abajo
  // sería decoración. La primera línea de una factura NO puede ser la de un albarán.
  assert.notEqual(cabecera, 'ALBARÁN / PARTE DE TRABAJO',
    '🔴 el lector está devolviendo texto que no corresponde al documento que ha generado.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② CADA DOCUMENTO DICE LO QUE ES
//
// Los literales de FACTURA y ALBARÁN se escriben aquí, y es el escalón 3 (duplicar con guard) con
// su imposibilidad MEDIDA, no una excusa de calendario: `docTitle` es una `const` LOCAL dentro de
// `generateInvoicePdf`, y el rótulo del albarán es un literal en su `doc.text`. Derivarlos
// obligaría a EXPORTARLOS, o sea a modificar el camino de emisión — que es STOP (AA1.4 / regla 38)
// y no está en el alcance de este ticket. El del presupuesto SÍ se deriva, porque su fuente
// (`locale.quote`) ya es un dato público y derivarlo demuestra algo que un literal no demostraría:
// que la cabecera SIGUE al país en vez de llevar la palabra grabada.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-608 · la FACTURA dice FACTURA arriba del todo', async () => {
  assert.equal(await cabeceraDeFactura(60802, { type: 'F1' }), 'FACTURA',
    '🔴 la primera línea del PDF de factura ya no es el tipo de documento.');
});

test('SCRUM-608 · la RECTIFICATIVA y el JUSTIFICANTE tampoco se disfrazan de factura normal', async () => {
  assert.equal(await cabeceraDeFactura(60803, { type: 'R1', rectifiesNumber: 'QA608-60802' }),
    'FACTURA RECTIFICATIVA',
    '🔴 una rectificativa que abre diciendo «FACTURA» se lee como la factura que rectifica.');
  assert.equal(await cabeceraDeFactura(60804, { type: 'JUST' }), 'JUSTIFICANTE DE COBRO',
    '🔴 el justificante NO puede abrir con la palabra «FACTURA»: es el documento del flag apagado '
    + '(INVOICING_ES_ENABLED=OFF) y decirlo sería un claim fiscal (reglas 7 y 17).');
});

test('SCRUM-608 · el PRESUPUESTO dice su tipo, y lo dice en el idioma del país', async () => {
  const { getLocale } = await import('../dist/core/i18n/locales.js');
  let id = 60810;
  for (const pais of ['ES', 'MX', null]) {
    const esperado = getLocale(pais).quote;
    assert.ok(esperado && esperado.length > 2, `🔴 CIEGO: el locale de ${pais} no da un rótulo.`);
    assert.equal(await cabeceraDePresupuesto(id++, pais), esperado,
      `🔴 la cabecera del presupuesto ya no sigue a locale.quote para country=${pais}.`);
  }
  // Y que los dos rótulos probados sean DISTINTOS: si el locale devolviera lo mismo para todos, el
  // bucle de arriba pasaría sin haber comprobado nada de la variación por país.
  assert.notEqual(getLocale('ES').quote, getLocale('MX').quote,
    '🔴 CIEGO: ES y MX dan el mismo rótulo, así que el bucle no ha probado la variación por país.');
});

test('SCRUM-608 · el ALBARÁN dice ALBARÁN arriba del todo, en sus tres modos', async () => {
  for (const [modo, extra] of [
    ['VALORADO', {}],
    ['SIN_VALORAR', { modoValoracion: 'SIN_VALORAR', totales: null }],
    ['sin precios en el papel', { ocultarPreciosEnDocumento: true }],
  ]) {
    assert.equal(await cabeceraDeAlbaran(modo.slice(0, 3), extra), 'ALBARÁN / PARTE DE TRABAJO',
      `🔴 el albarán en modo «${modo}» ya no dice qué es en su primera línea.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL QUE DECIDE — la víctima del ticket, sin un solo literal
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-608 · EL QUE DECIDE: los tres papeles NO comparten cabecera', async () => {
  const cabeceras = {
    factura: await cabeceraDeFactura(60820),
    presupuesto: await cabeceraDePresupuesto(60821, 'ES'),
    albaran: await cabeceraDeAlbaran('D'),
  };
  const vistas = new Set(Object.values(cabeceras));
  assert.equal(vistas.size, 3,
    '🔴 DOS DOCUMENTOS ABREN IGUAL, que es la víctima literal de ALB-03: el cliente que recibe el '
    + `papel no sabe cuál tiene en la mano. Cabeceras: ${JSON.stringify(cabeceras)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ ¿ME VE EL META-GUARD? (SCRUM-745 · defecto 757: una declaración con forma propia se ignora
//    EN SILENCIO, y entonces esto no es un guard vivo sino un comentario largo.)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-608 · el lector oficial del meta-guard VE mi declaración, y ve las tres', () => {
  const mias = mutacionesDeclaradas(fs.readFileSync(AQUI, 'utf8'), path.basename(AQUI));
  assert.equal(mias.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 el lector oficial ve ${mias.length} mutaciones y yo declaro `
    + `${MUTACIONES_QUE_ME_TUMBAN.length}: mi declaración tiene una forma que él ignora en silencio.`);
  for (const m of mias) {
    assert.ok(fs.existsSync(path.join(RAIZ, m.fichero)),
      `🔴 la mutación apunta a \`${m.fichero}\`, que no existe: el meta-guard la daría por CIEGA. `
      + 'Si es un fichero de `dist/`, hace falta haber compilado (`npm run build`).');
    const texto = fs.readFileSync(path.join(RAIZ, m.fichero), 'utf8');
    assert.ok(texto.includes(m.de),
      `🔴 EL ANCLA CADUCÓ: \`${m.de.slice(0, 60)}…\` ya no está en \`${m.fichero}\`.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
//
// ⚠️ APUNTAN A `dist/`, Y NO ES UN ATAJO: ESTÁ MEDIDO. Este guard corre contra el compilado —es la
// única forma de leer el PDF de verdad—, así que una mutación sobre el fuente `.ts` NO cambiaría
// nada de lo que este fichero ejecuta: el meta-guard vería el guard en verde y dictaría MUDO sobre
// un guard sano. Es el mismo filo del que avisa la casa: **restaurar el fuente no es restaurar el
// árbol**. Se muta el árbol que se corre.
//
// `dist/` está en `.gitignore`, así que una mutación de aquí NO puede llegar a un commit ni con un
// descuido; y el meta-guard restaura por bytes y sale con 3 si no puede.
//
// Las tres imitan el defecto que este fichero promete cazar: que un papel deje de decir qué es.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // LA VÍCTIMA DEL TICKET, literal: el albarán abriendo igual que un presupuesto.
    fichero: 'dist/modules/jobs/infra/albaranPdf.service.js',
    de: ".text('ALBARÁN / PARTE DE TRABAJO', M, hY, { width: W, align: 'right' });",
    a: ".text('Presupuesto', M, hY, { width: W, align: 'right' });",
    cae: 'el ALBARÁN dice ALBARÁN arriba del todo, en sus tres modos',
  },
  {
    // La factura deja de nombrarse: los tres tipos pasan a decir lo mismo y nada distingue una
    // rectificativa de la factura que rectifica.
    fichero: 'dist/modules/invoicing/infra/pdf/pdf.service.js',
    de: "const docTitle = isReceipt ? 'JUSTIFICANTE DE COBRO' : isRect ? 'FACTURA RECTIFICATIVA' : 'FACTURA';",
    a: "const docTitle = 'Documento';",
    cae: 'la FACTURA dice FACTURA arriba del todo',
  },
  {
    // El presupuesto deja de seguir al país: la palabra pasa a estar grabada en la maqueta.
    fichero: 'dist/modules/invoicing/infra/pdf/pdf.service.js',
    de: 'const QUOTE_LABEL = locale.quote;',
    a: "const QUOTE_LABEL = 'Documento';",
    cae: 'el PRESUPUESTO dice su tipo, y lo dice en el idioma del país',
  },
];
