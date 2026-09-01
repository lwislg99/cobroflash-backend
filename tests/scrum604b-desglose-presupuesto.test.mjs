// tests/scrum604b-desglose-presupuesto.test.mjs — SCRUM-604 (DOC-14) · el PRESUPUESTO
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE FALTABA, Y DÓNDE FALTABA DE VERDAD
//
// La evidencia del ticket era el PDF de presupuesto #32: «Total presupuesto: 1210 EUR y nada
// más». Medido antes de tocar nada, con el caso de SCRUM-619, el documento decía:
//
//     Total presupuesto: 117.60 EUR
//
// Sin base imponible y sin cuota. (El de FACTURA sí las pinta desde su bloque «4. TOTALES»: eso
// se caracterizó en `scrum604-desglose-en-el-pdf.test.mjs` y aquí no se toca.)
//
// Ahora imprime las tres, y esto lo fija leyendo el PDF de verdad — no por tamaño en bytes, que
// es como la suite medía los documentos hasta hoy y no distingue una cuota buena de una mala.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CERO MICROCOPY NUEVO (regla 30). Los tres rótulos salen de sitios YA aprobados:
//
//   «Base imponible:»      el MISMO literal del bloque de totales de la factura.
//   «IVA» / «IGV»          `locale.vatName`, que ya existía. Sale IGV en Perú — o sea que este
//                          documento queda MÁS correcto que la factura, que lo lleva a mano.
//   «Total <quoteVerb>:»   el rótulo que este documento ya imprimía. No se ha tocado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ DOS COSAS QUE ESTE FICHERO FIJA Y QUE NO SON MEJORAS
//
// ① HEREDA EL DEFECTO ① DE LA FACTURA: las filas con cuota CERO no se pintan, así que la base
//    al 0 % (el caso del suplido) no sale en el desglose. Se hizo igual que la factura a
//    propósito —el encargo dice «construye la forma de TRES conceptos que hay hoy»— y divergir
//    habría inventado una segunda forma de documento. Es SCRUM-623, y ahora está en los DOS.
//
// ② EL FORMATO DEL TOTAL CAMBIA de `117.60` a `117,60`. El encargo lo permite explícitamente
//    («si te sale natural usar el formateador correcto, ÚSALO y dilo»), y era inevitable: dejar
//    las filas nuevas en `105,00` junto a un total en `117.60` habría metido dos formatos en el
//    MISMO bloque. Toca una línea que pertenece a SCRUM-625; el resto del documento no se ha
//    tocado.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = 'src/modules/invoicing/infra/pdf/pdf.service.ts';

/** Genera un presupuesto de verdad y devuelve su TEXTO. Borra el fichero siempre. */
async function textoDePresupuesto(id, { lines, total, country = 'ES' }) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: 99990000 + id, quoteNumber: 600 + id,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total, lines, signatureData: null, country,
  });
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF (${id}): ${r.motivo}. Un texto vacío se leería `
      + 'como «el documento no dice eso», que es un falso verde.');
    return r.texto;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/**
 * El bloque de totales, recortado, para compararlo ENTERO con `===`.
 * Con `includes()` un fallo sólo puede decir «no está la cadena que esperaba»; comparando el
 * bloque entero, el rojo enseña las dos versiones y el defecto se lee solo. (Lección del
 * hermano de este fichero, el de la factura.)
 */
function bloqueDeTotales(texto) {
  const marcas = ['Base imponible', 'Total presupuesto', 'Total cotización']
    .map((m) => texto.indexOf(m)).filter((i) => i !== -1);
  if (marcas.length === 0) return '(NO HAY BLOQUE DE TOTALES)';
  const ini = Math.min(...marcas);
  // El pie empieza por el NOMBRE del documento («Presupuesto generado automáticamente por
  // YaQu…»), así que cortar en «generado autom» deja pegada esa palabra al final del bloque.
  // Se quita: es del pie, no del desglose. Lo cazaron los cinco casos a la vez.
  const fin = texto.indexOf('generado autom', ini);
  const bruto = texto.slice(ini, fin === -1 ? undefined : fin).trim();
  return bruto.replace(/(Presupuesto|Cotización)$/, '').trim();
}

const UNA_TASA = [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 }];
const CON_SUPLIDO = [
  { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 },
  { concept: 'Tasa municipal', qty: 1, price: 45, tax: 0 },  // el suplido: base al 0 %
];
const DOS_TASAS = [
  { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 },
  { concept: 'Material', qty: 1, price: 45, tax: 0.10 },
];

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-604b · SUELO: sé leer el texto de un PDF de presupuesto', async () => {
  const texto = await textoDePresupuesto(1, { lines: UNA_TASA, total: '72.60' });
  assert.ok(texto.length > 100, `🔴 EXTRACTOR CIEGO: sólo he leído ${texto.length} caracteres`);
  // CONTROL NEGATIVO: no puede encontrar lo que no está.
  assert.equal(texto.indexOf('FACTURA RECTIFICATIVA'), -1,
    '🔴 el extractor dice ver texto que el documento no tiene');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE IMPRIME AHORA
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-604b · un solo tipo: base, cuota y total', async () => {
  const bloque = bloqueDeTotales(await textoDePresupuesto(2, { lines: UNA_TASA, total: '72.60' }));
  assert.equal(bloque, 'Base imponible: 60,00 EURIVA 21%: 12,60 EURTotal presupuesto: 72,60 EUR',
    '🔴 cambió el bloque de totales del presupuesto de un solo tipo');
});

test('SCRUM-604b · dos tipos CON cuota: una fila por tipo', async () => {
  const bloque = bloqueDeTotales(await textoDePresupuesto(3, { lines: DOS_TASAS, total: '122.10' }));
  assert.equal(bloque,
    'Base imponible: 105,00 EURIVA 21%: 12,60 EURIVA 10%: 4,50 EURTotal presupuesto: 122,10 EUR',
    '🔴 cambió el bloque con dos tipos que sí llevan cuota');
});

test('SCRUM-604b · 🔴 el caso con SUPLIDO: dos bases, y la del 0 % sigue sin salir', async () => {
  const conSuplido = bloqueDeTotales(await textoDePresupuesto(4, { lines: CON_SUPLIDO, total: '117.60' }));
  assert.equal(conSuplido, 'Base imponible: 105,00 EURIVA 21%: 12,60 EURTotal presupuesto: 117,60 EUR',
    '🔴 cambió el bloque del caso con suplido');

  // La propiedad, que sobrevive a cualquier cambio de importes: un documento de DOS bases
  // imprime el MISMO número de filas de impuesto que uno de UNA. Es el defecto ① heredado, y
  // está fijado para que su arreglo (SCRUM-623) tenga que pasar por aquí.
  const unaSola = bloqueDeTotales(await textoDePresupuesto(5, { lines: UNA_TASA, total: '72.60' }));
  const filas = (b) => (b.split('IVA ').length - 1) + (b.split('IGV ').length - 1);
  assert.equal(filas(conSuplido), filas(unaSola),
    'CARACTERIZACIÓN: hoy el presupuesto con DOS bases (21 % y 0 %) imprime las MISMAS filas de '
    + 'impuesto que el de una sola. Si esto falla, la del 0 % ya sale — y ① está resuelto.');
});

test('SCRUM-604b · el rótulo del impuesto sale del locale: en Perú es IGV, no IVA', async () => {
  const bloque = bloqueDeTotales(await textoDePresupuesto(6, {
    lines: [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.18 }], total: '70.80', country: 'PE',
  }));
  assert.equal(bloque, 'Base imponible: 60,00 EURIGV 18%: 10,80 EURTotal cotización: 70,80 EUR',
    '🔴 el rótulo del impuesto ha dejado de salir de `locale.vatName`, o cambió el de Perú. '
    + 'Es lo que hace que este bloque no necesitara microcopy nueva.');
});

test('SCRUM-604b · sin líneas no hay desglose que imprimir, y el total sigue saliendo', async () => {
  const bloque = bloqueDeTotales(await textoDePresupuesto(7, { lines: [], total: '318.45' }));
  assert.equal(bloque, 'Total presupuesto: 318,45 EUR',
    'CARACTERIZACIÓN: sin líneas no hay de dónde sacar el desglose. El total sí sale, y ahora '
    + 'con el formato correcto (antes: `318.45`).');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA CUARTA FILA TIENE QUE CABER SIN REHACER LA MAQUETA — requisito explícito del encargo.
//
// Se comprueba por AST y no leyendo el PDF, porque es una propiedad del CÓDIGO: las filas son
// DATOS (un array al que se empuja) y el pintado es un bucle sobre ese array. Mientras eso sea
// así, añadir la fila del suplido el día que el fundador escriba su etiqueta es empujar una
// entrada más — no tocar el dibujo.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-604b · 🔴 las filas del desglose son DATOS, no dibujo: cabe una cuarta', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8');
  const sf = ts.createSourceFile(FUENTE, fuente, ts.ScriptTarget.Latest, true);

  let declarada = false;   // const filasDeTotales: … = []
  let seEmpuja = 0;        // filasDeTotales.push(…)
  let seRecorre = false;   // for (… of filasDeTotales)

  (function rec(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'filasDeTotales') declarada = true;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && ts.isIdentifier(n.expression.name) && n.expression.name.text === 'push'
        && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'filasDeTotales') seEmpuja++;
    if (ts.isForOfStatement(n) && ts.isIdentifier(n.expression) && n.expression.text === 'filasDeTotales') seRecorre = true;
    n.forEachChild(rec);
  })(sf);

  assert.ok(declarada, '🔴 ya no existe `filasDeTotales`: el desglose ha dejado de ser una lista de datos');
  assert.ok(seEmpuja >= 2, `🔴 sólo veo ${seEmpuja} \`push\` sobre \`filasDeTotales\`: la lista se ha vuelto fija`);
  assert.ok(seRecorre,
    '🔴 el desglose ya NO se pinta recorriendo la lista. Eso significa que añadir la cuarta fila '
    + '(el suplido fuera de la base, cuando el fundador escriba su etiqueta) obligaría a rehacer '
    + 'la maqueta — que es justo lo que el encargo de SCRUM-604 mandaba evitar.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DUPLICACIÓN DECLARADA · ACTUALIZADA POR SCRUM-636, y hay que explicar por qué.
//
// Este guard nació vigilando que `fmtImporte` (presupuesto) y el `fmt` INLINE de la factura
// tuvieran el MISMO CUERPO, porque el encargo de SCRUM-604 decía que la factura no se tocaba:
// «divergencia VIGILADA, que es lo que se puede hacer hoy sin tocarla».
//
// 🔴 ESA CONDICIÓN YA NO EXISTE. SCRUM-636 es el ticket que sí podía tocarla, y las unificó: el
// `fmt` de la factura es ahora `const fmt = fmtImporte`, y `fmtImporte` delega en el sitio único
// `formatImporteEs`. **No hay dos cuerpos que puedan separarse: hay uno.**
//
// Así que el guard NO se relaja — se reescribe contra un invariante MÁS FUERTE. Antes decía
// «que los dos cuerpos sigan siendo iguales» (vigilancia); ahora dice «que sigan siendo UNO»
// (imposibilidad). Comparar el cuerpo viejo aquí sería fijar un comportamiento que este ticket
// corrigió a propósito: aquel `toLocaleString` NO agrupaba los miles.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-604b · los dos formateadores de importe del fichero SIGUEN SIENDO UNO', async () => {
  const { fmtImporte } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
  const { formatImporteEs } = await import('../dist/core/utils/utils.js');
  const fuente = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8');

  // ① La factura no tiene formateador propio: usa el mismo objeto.
  assert.ok(fuente.includes('const fmt = fmtImporte;'),
    '🔴 la factura ha vuelto a tener su PROPIO formateador. Si se separa de `fmtImporte`, los dos '
    + 'documentos empiezan a escribir el dinero de dos maneras — que es lo que este guard impide.');

  // ② Y `fmtImporte` no tiene cuerpo propio: delega en el sitio único.
  assert.ok(fuente.includes('return formatImporteEs(v);'),
    '🔴 `fmtImporte` ha dejado de delegar en el sitio único (SCRUM-636).');

  // ③ SUELO: que el fichero no tenga NINGUNA copia del formato escrita a mano.
  assert.equal(/toLocaleString\(\s*['"]es-ES['"],\s*\{\s*minimumFractionDigits/.test(fuente), false,
    '🔴 ha reaparecido una copia del formato en el fichero del PDF');

  // ④ Y que de verdad producen lo mismo, no sólo que lo parezca leyendo el fuente.
  for (const v of [0, 4.5, 12.6, 105, 117.6, 1234.5]) {
    assert.equal(fmtImporte(v), formatImporteEs(v),
      `🔴 \`fmtImporte\` ya no formatea ${v} como el sitio único`);
  }
});
