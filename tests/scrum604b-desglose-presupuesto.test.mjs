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
// SCRUM-647 · `taxName` entra en la ayuda porque el documento ya no lo deduce del país: se lo
// pasa quien llama. Sin él, el generador imprime su valor por defecto, que es lo que se comprueba.
async function textoDePresupuesto(id, { lines, total, country = 'ES', taxName }) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: 99990000 + id, quoteNumber: 600 + id,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total, lines, signatureData: null, country, taxName,
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

test('SCRUM-604b · el rótulo del impuesto: en Perú sigue siendo IGV (SCRUM-647)', async () => {
  // 🔴 REAPUNTADO POR SCRUM-647, y la propiedad NO se debilita: un presupuesto peruano sigue
  // teniendo que decir IGV. Lo que cambia es DÓNDE se decide.
  //
  // Antes el documento lo resolvía con `locale.vatName`, indexado por PAÍS. Eso miente en
  // Canarias —que es `ES` y repercute IGIC—, así que la resolución por país SUBIÓ AL LLAMANTE,
  // donde el país ya está a la vista. El documento recibe el nombre y no lo decide.
  const bloque = bloqueDeTotales(await textoDePresupuesto(6, {
    lines: [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.18 }], total: '70.80',
    country: 'PE', taxName: 'IGV', // ← exactamente lo que pasan las tres rutas
  }));
  assert.equal(bloque, 'Base imponible: 60,00 EURIGV 18%: 10,80 EURTotal cotización: 70,80 EUR',
    '🔴 el rótulo del impuesto ha dejado de llegar al bloque, o cambió el de Perú. '
    + 'Es lo que hace que este bloque no necesitara microcopy nueva.');

  // ⚠️ Y EL CAMBIO DE COMPORTAMIENTO, ESCRITO EN VEZ DE ESCONDIDO: sin `taxName`, el país YA NO
  // basta. El documento dice «IVA» aunque le pases `PE`. Que Perú siga viendo IGV depende
  // enteramente de que los llamantes lo pasen, y eso lo vigila
  // `scrum647-presupuesto-tambien-neutral.test.mjs` — sin aquel guard, esto regresaría en silencio.
  const sinNombre = bloqueDeTotales(await textoDePresupuesto(7, {
    lines: [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.18 }], total: '70.80', country: 'PE',
  }));
  assert.equal(sinNombre, 'Base imponible: 60,00 EURIVA 18%: 10,80 EURTotal cotización: 70,80 EUR',
    '🔴 el documento ha vuelto a resolver el impuesto por el país. Eso es lo que miente en '
    + 'Canarias y lo que SCRUM-647 sacó de aquí.');
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
// LA DUPLICACIÓN DECLARADA · `fmtImporte` (presupuesto) y `fmt` (factura) tienen el mismo
// cuerpo y NO se han unificado: el encargo dice que la factura no se toca. Divergencia
// VIGILADA, que es lo que se puede hacer hoy sin tocarla.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-604b · los dos formateadores de importe del fichero no pueden separarse', async () => {
  const { fmtImporte } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
  const fuente = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8');

  // ⚠️ SCRUM-636 · ESTE GUARD CAMBIA DE REFERENCIA, NO DE INTENCIÓN, y queda escrito por qué.
  //
  // Comprobaba dos cosas contra `v.toLocaleString('es-ES', …)`: que el `fmt` de la factura tuviera
  // ESE cuerpo exacto, y que `fmtImporte` diera ESA salida. Las dos usaban como patrón el
  // algoritmo que el fundador acaba de RETIRAR: `toLocaleString('es-ES')` no agrupa los enteros de
  // cuatro cifras (CLDR), así que el documento escribía `1000,00` y `12.345,67` — incoherente
  // consigo mismo. Un guard cuyo patrón es lo que se ha decidido no hacer ya no vigila nada.
  //
  // 🔴 Lo que este test existe para impedir —que los dos formateadores del fichero SE SEPAREN— no
  // cambia, y ahora se comprueba MÁS FUERTE: en vez de exigir que los dos cuerpos sean iguales, se
  // exige que sean EL MISMO, porque uno llama al otro y el otro llama al sitio único.
  const cuerpoFactura = '    return fmtImporte(v);';
  assert.equal(fuente.split(cuerpoFactura).length - 1, 1,
    '🔴 el `fmt` de la factura ha dejado de delegar en `fmtImporte` (o se ha movido). Si vuelve a '
    + 'tener cuerpo propio, los dos documentos pueden empezar a escribir el dinero de dos maneras.');
  assert.match(fuente, /export function fmtImporte[\s\S]{0,600}?return formatImporteEs\(v\);/,
    '🔴 `fmtImporte` ha dejado de delegar en el sitio único (`formatImporteEs`).');

  // Y la comprobación de SALIDA se conserva, contra el sitio único en vez de contra el algoritmo
  // retirado. Se añade 1000 a propósito: es la banda donde la incoherencia se veía.
  const { formatImporteEs } = await import('../dist/core/utils/utils.js');
  for (const v of [0, 4.5, 12.6, 105, 117.6, 1234.5, 1000]) {
    assert.equal(fmtImporte(v), formatImporteEs(v),
      `🔴 \`fmtImporte\` ya no escribe ${v} como el sitio único del dinero`);
  }
});
