// tests/scrum452-pdf-lo-que-se-sello.test.mjs — SCRUM-452 · el papel dice lo que certifica el sello.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VÍCTIMA, EN UNA LÍNEA
//
// Un cliente corrige su razón social. El PDF de su albarán v:3 imprimía la NUEVA mientras el sello
// certificaba la ANTIGUA — y el verificador decía que TODO CUADRA, porque el sello no mentía: el
// que mentía era el papel. El documento que el profesional le enseña al cliente y la prueba que lo
// respalda decían cosas distintas, y nadie se enteraba hasta que alguien las comparaba.
//
// v:3 ya congelaba los cinco campos dentro del sobre; el PDF solo consumía DOS (`obra` y
// `referenciaTrabajo`). Este ticket le hace consumir los TRES que faltaban: `cliente`, `emisor`,
// `emisorNif`. No se sella nada nuevo — cambia lo que se PINTA, no lo que se SELLA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO SE ARREGLA, Y ES CORRECTO
//
// Los CUATRO que el sobre NO congela —`merchant.address`, `merchant.whatsappPhone`,
// `merchant.logoUrl` y `customer.taxId`— siguen leyéndose en vivo. Sobre ellos el sello no afirma
// nada, así que no puede contradecir al papel. Y `logoUrl` no tiene arreglo por esta vía ni en un
// v:4: congelar la URL no congela la imagen que hay detrás de ella.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE MIDE: SOBRE EL DOCUMENTO GENERADO, NO SOBRE LA BASE
//
// Se genera el PDF de verdad con `generateAlbaranPdf` y se lee su texto con `textoDePdf`
// (SCRUM-300). Afirmar sobre el papel es lo único que demuestra lo que ve el cliente: un test que
// comprobara la fila diría que el dato está bien guardado, que es otra cosa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { generateAlbaranPdf } from '../dist/modules/jobs/infra/albaranPdf.service.js';
import { contenidoSegunVersion } from '../dist/modules/jobs/domain/albaranContenidoFuentes.js';
import { textoDePdf, contiene } from './_pdf-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_SERVICIO = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaran.service.ts');
const F_PDF = path.join(RAIZ, 'src', 'modules', 'jobs', 'infra', 'albaranPdf.service.ts');
const F_WHATSAPP = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaranWhatsApp.service.ts');

/** El `—` que imprime PDFKit sale del flujo con el código 151, no como `—`. Medido. */
const RAYA = String.fromCharCode(151);

// ── EL ESCENARIO ─────────────────────────────────────────────────────────────────────────

// 🔴 LOS VALORES NO PUEDEN SER SUBCADENA UNO DEL OTRO, y esto costó un rojo falso: la primera
// versión usaba «Fontaneria Pereira» para lo sellado y «Fontaneria Pereira SL CORREGIDO» para lo
// vivo —que es lo realista—, y `contiene(papel, sellado)` daba VERDADERO encontrándolo DENTRO del
// vivo. El test acusaba al código de imprimir lo sellado cuando imprimía lo vivo.
//
// Por eso cada par es deliberadamente disjunto, y hay un suelo abajo que lo exige. Un escenario
// realista que no se puede medir no sirve: mide la coincidencia, no el comportamiento.

/** Lo que decían las filas EL DÍA DE LA FIRMA. Es lo que v:3 congela dentro del sobre. */
const EL_DIA_DE_LA_FIRMA = Object.freeze({
  jobDireccion: 'ZZSELLADA calle vieja',
  lugarEntrega: 'ZZSELLADA nave cuatro',
  referenciaTrabajo: 'ZZSELLADA bajante',
  cliente: 'ZZSELLADA comunidad',
  emisor: 'ZZSELLADA fontaneria',
  emisorNif: 'ZZSELLADAB11111111',
});

/** Lo que dicen HOY, tras correcciones perfectamente legítimas que el producto permite. */
const HOY = Object.freeze({
  jobDireccion: 'QQVIVA calle nueva',
  lugarEntrega: 'QQVIVA poligono sur',
  referenciaTrabajo: 'QQVIVA bajante fase dos',
  cliente: 'QQVIVA comunidad corregida',
  emisor: 'QQVIVA fontaneria SL',
  emisorNif: 'QQVIVAB99999999',
});

test('SCRUM-452 · SUELO del escenario: ningún valor sellado es subcadena de su vivo, ni al revés', () => {
  // Sin esto, `contiene(papel, sellado)` puede dar verdadero encontrándolo DENTRO del vivo, y todo
  // este fichero mediría una coincidencia de texto en vez de qué campo imprime el papel. Pasó.
  const solapan = Object.keys(EL_DIA_DE_LA_FIRMA).filter((k) => {
    const a = EL_DIA_DE_LA_FIRMA[k];
    const b = HOY[k];
    return a === b || a.includes(b) || b.includes(a);
  });
  assert.deepEqual(solapan, [],
    `🔴 ${solapan.join(', ')} se solapan entre lo sellado y lo vivo. Los asserts de «imprime lo ` +
    'sellado» y «no imprime lo vivo» dejarían de distinguir una cosa de la otra.');
});

/** El bloque que v:3 lleva dentro: los cinco, como los congeló el sellador. */
const BLOQUE = Object.freeze({
  obra: EL_DIA_DE_LA_FIRMA.lugarEntrega,
  referenciaTrabajo: EL_DIA_DE_LA_FIRMA.referenciaTrabajo,
  cliente: EL_DIA_DE_LA_FIRMA.cliente,
  emisor: EL_DIA_DE_LA_FIRMA.emisor,
  emisorNif: EL_DIA_DE_LA_FIRMA.emisorNif,
});

let n = 0;

/**
 * LA MISMA CADENA QUE RECORRE `ensureAlbaranPdf`, sin la lectura de prisma: resuelve los cinco por
 * la versión del sobre y se los da al PDF. Que el servicio componga EXACTAMENTE esto lo comprueba
 * el guard de AST del final — aquí se mide qué sale en el papel.
 */
async function papel({ v, bloque, vivas = HOY, extra = {} }) {
  const sellado = contenidoSegunVersion(v, { ...vivas, contenidoCongelado: bloque });
  const { outPath } = await generateAlbaranPdf({
    merchantId: 995000 + (n += 1),
    numero: `ALB-452-${n}`,
    fecha: new Date('2026-08-01T10:00:00Z'),
    emisionAt: new Date('2026-07-28T09:00:00Z'),
    version: 1,
    modoValoracion: 'SIN_VALORAR',
    // Lo que el sobre NO congela: se lee en vivo, y está bien que así sea.
    merchant: { address: 'Calle Fiscal 1', logoUrl: null, whatsappPhone: null },
    customer: { taxId: null },
    ...sellado,
    fechaEntrega: null,
    lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }],
    totales: null,
    notas: null,
    signatureData: null,
    firmadoAt: null,
    firmadoPorNombre: null,
    firmadoPorCalidad: null,
    evidencia: null,
    ...extra,
  });
  const txt = textoDePdf(outPath);
  try { fs.unlinkSync(outPath); } catch { /* el temporal da igual */ }
  return txt;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-452 · SUELO: el lector saca texto del papel, y el papel trae rótulos', async () => {
  // Sin esto, TODAS las aserciones de abajo pasarían a base de no encontrar nada — que es como un
  // test de documento deja de mirar sin que se note.
  const txt = await papel({ v: 3, bloque: BLOQUE });
  assert.ok(txt.length > 200, `🔴 el lector solo saca ${txt.length} caracteres del PDF`);
  assert.ok(contiene(txt, 'Emisor:'), '🔴 el papel no trae el rótulo «Emisor:»');
  assert.ok(contiene(txt, 'Receptor:'), '🔴 el papel no trae el rótulo «Receptor:»');
});

// ── 🔴 EL TEST ───────────────────────────────────────────────────────────────────────────

test('SCRUM-452 · 🔴 v:3: el papel imprime LO SELLADO aunque las filas vivas digan otra cosa', async () => {
  const txt = await papel({ v: 3, bloque: BLOQUE, vivas: HOY });

  // Los TRES, uno a uno y NOMBRADOS. Un solo assert sobre «el papel» diría que algo falla sin
  // decir qué campo, y el campo es justo lo que hay que saber para arreglarlo.
  const TRES = [
    ['emisor', BLOQUE.emisor, HOY.emisor],
    ['emisorNif', BLOQUE.emisorNif, HOY.emisorNif],
    ['cliente', BLOQUE.cliente, HOY.cliente],
  ];
  for (const [campo, sellado, vivo] of TRES) {
    assert.ok(contiene(txt, sellado),
      `🔴 EL PAPEL NO IMPRIME EL «${campo}» SELLADO («${sellado}»).`);
    assert.ok(!contiene(txt, vivo),
      `🔴 EL PAPEL IMPRIME EL «${campo}» VIVO («${vivo}») MIENTRAS EL SELLO CERTIFICA «${sellado}».\n\n` +
      '  Es el defecto entero de este ticket: el documento que el profesional le enseña al cliente\n' +
      '  y la prueba que lo respalda dicen cosas distintas, y el verificador da «cuadra» — porque\n' +
      '  el sello no miente, miente el papel.');
  }

  // Y los dos que ya salían del sobre desde SCRUM-438, para que nadie los pierda por el camino.
  assert.ok(contiene(txt, BLOQUE.obra), '🔴 el papel no imprime la `obra` sellada');
  assert.ok(contiene(txt, BLOQUE.referenciaTrabajo), '🔴 el papel no imprime la `referenciaTrabajo` sellada');

  // SUELO DEL ESCENARIO: que las vivas digan de verdad otra cosa. Si coincidieran, este test
  // pasaría sin haber ejercido nada.
  const iguales = Object.keys(EL_DIA_DE_LA_FIRMA).filter((k) => EL_DIA_DE_LA_FIRMA[k] === HOY[k]);
  assert.deepEqual(iguales, [],
    `🔴 SUELO: ${iguales.join(', ')} vale lo mismo antes y ahora — el escenario no cambia nada.`);
});

test('SCRUM-452 · 🔴 EN EL MOMENTO DE LA FIRMA el papel y el sobre dicen LO MISMO en los tres', async () => {
  // Es cuando `force = true` genera el PDF y el sobre a la vez. Si divergieran AHÍ, divergirían
  // desde el segundo cero y todo lo demás sobraría: no habría un «después» que proteger.
  //
  // Al firmar, las filas vivas y el bloque dicen lo mismo — el bloque acaba de salir de ellas.
  const txt = await papel({ v: 3, bloque: BLOQUE, vivas: EL_DIA_DE_LA_FIRMA });

  for (const [campo, valor] of [['emisor', BLOQUE.emisor], ['emisorNif', BLOQUE.emisorNif], ['cliente', BLOQUE.cliente]]) {
    assert.ok(contiene(txt, valor),
      `🔴 recién firmado, el papel NO dice el «${campo}» que el sobre acaba de sellar («${valor}»).`);
  }

  // Y el careo explícito: lo que el resolvedor devuelve para el PDF es, campo a campo, lo que el
  // bloque guarda. No se deduce de que el texto aparezca: se compara.
  const paraElPdf = contenidoSegunVersion(3, { ...EL_DIA_DE_LA_FIRMA, contenidoCongelado: BLOQUE });
  assert.deepEqual(
    { cliente: paraElPdf.cliente, emisor: paraElPdf.emisor, emisorNif: paraElPdf.emisorNif },
    { cliente: BLOQUE.cliente, emisor: BLOQUE.emisor, emisorNif: BLOQUE.emisorNif },
    '🔴 lo que se le pasa al PDF no es lo que el sobre selló. Papel y sello nacen ya divergentes.',
  );
});

// ── CONTROLES NEGATIVOS ──────────────────────────────────────────────────────────────────

test('SCRUM-452 · 🔴 v:1 y v:2 NO cambian: sin bloque, el papel sigue leyendo EN VIVO', async () => {
  // Condición dura. Sus sobres no tienen bloque congelado y no se van a rellenar jamás (regla 29):
  // para ellos el papel tiene que seguir diciendo exactamente lo que decía.
  for (const v of [1, 2]) {
    const txt = await papel({ v, bloque: undefined, vivas: HOY });
    for (const [campo, vivo, sellado] of [
      ['emisor', HOY.emisor, BLOQUE.emisor],
      ['emisorNif', HOY.emisorNif, BLOQUE.emisorNif],
      ['cliente', HOY.cliente, BLOQUE.cliente],
    ]) {
      assert.ok(contiene(txt, vivo),
        `🔴 un albarán v:${v} ha DEJADO de imprimir su «${campo}» vivo («${vivo}»). Sus sobres no ` +
        'tienen bloque: cambiarles el comportamiento toca documentos YA EMITIDOS.');
      assert.ok(!contiene(txt, sellado),
        `🔴 un albarán v:${v} está imprimiendo «${sellado}», que sale de un bloque que su sobre no ` +
        'tiene. Se le está aplicando la regla de v:3 a un documento viejo.');
    }
  }
});

test('SCRUM-452 · un albarán SIN FIRMAR manda el campo de HOY: es un borrador', async () => {
  // La tercera rama, y la que rompería el PDF de todos los borradores si se confundiera con una
  // versión desconocida.
  const txt = await papel({ v: undefined, bloque: undefined, vivas: HOY });
  assert.ok(contiene(txt, HOY.emisor), '🔴 un borrador no imprime su emisor de hoy');
  assert.ok(contiene(txt, HOY.cliente), '🔴 un borrador no imprime su cliente de hoy');
});

test('SCRUM-452 · 🔴 un v:3 con `cliente` sellado a NULL imprime la raya, no la razón social viva', async () => {
  // El caso que tienta a «mejorar»: el sobre congeló `null` porque aquel día no había nombre. El
  // papel imprime `—` desde SCRUM-67, y rellenarlo con la fila de hoy sería inventar lo que el
  // documento decía el día que se firmó.
  const bloqueSinNombres = { ...BLOQUE, cliente: null, emisor: null, emisorNif: null };
  const txt = await papel({ v: 3, bloque: bloqueSinNombres, vivas: HOY });

  assert.ok(!contiene(txt, HOY.cliente),
    `🔴 el papel imprime el cliente VIVO («${HOY.cliente}») donde el sobre selló \`null\`. Eso ` +
    'fabrica un dato que el documento firmado no tenía.');
  assert.ok(!contiene(txt, HOY.emisor), '🔴 ídem con el emisor');
  assert.ok(!contiene(txt, HOY.emisorNif), '🔴 ídem con el NIF del emisor');

  // Y la raya SÍ está: el `|| '—'` se conserva. Sin esto, «no imprime el vivo» se cumpliría
  // también con un hueco mudo, que no es lo mismo y cambia lo que ve quien firma.
  const i = txt.indexOf('Emisor:');
  assert.ok(i >= 0 && txt.slice(i, i + 40).includes(RAYA),
    `🔴 tras «Emisor:» no está la raya. Trozo: ${JSON.stringify(txt.slice(i, i + 40))}`);
  const j = txt.indexOf('Receptor:');
  assert.ok(j >= 0 && txt.slice(j, j + 40).includes(RAYA),
    `🔴 tras «Receptor:» no está la raya. Trozo: ${JSON.stringify(txt.slice(j, j + 40))}`);

  // 🔴 CONTROL POSITIVO DEL PROPIO CONTROL: con nombres puestos, la raya NO aparece ahí. Si
  // apareciera siempre, los dos asserts de arriba serían decorativos.
  const conNombres = await papel({ v: 3, bloque: BLOQUE, vivas: HOY });
  const k = conNombres.indexOf('Emisor:');
  assert.ok(!conNombres.slice(k, k + 40).includes(RAYA),
    '🔴 la raya sale también cuando SÍ hay emisor: este control no distingue nada.');
});

test('SCRUM-452 · lo que el sobre NO congela se sigue leyendo en vivo, y es correcto', async () => {
  // Los cuatro declarados. Sobre ellos el sello no afirma nada, así que no puede contradecir al
  // papel — y este test existe para que nadie los «arregle» de paso creyendo que faltaban.
  const txt = await papel({
    v: 3, bloque: BLOQUE, vivas: HOY,
    extra: { merchant: { address: 'Calle Fiscal 7', logoUrl: null, whatsappPhone: '+34012345678' }, customer: { taxId: 'X1234567Z' } },
  });
  assert.ok(contiene(txt, 'Calle Fiscal 7'), '🔴 el domicilio del emisor ha dejado de imprimirse');
  assert.ok(contiene(txt, '012345678'), '🔴 el WhatsApp del emisor ha dejado de imprimirse');
  assert.ok(contiene(txt, 'X1234567Z'), '🔴 el NIF del CLIENTE ha dejado de imprimirse (no está sellado)');
});

// ── EL SERVICIO COMPONE LO QUE ESTOS TESTS MIDEN ─────────────────────────────────────────
//
// Lo de arriba prueba el PDF con los cinco ya resueltos. Falta la mitad que no se puede ejecutar
// sin Postgres: que `ensureAlbaranPdf` los resuelva ASÍ y no de otra manera. Se deriva del AST,
// como el guard de SCRUM-371 con el sellador.

/** Las propiedades del objeto literal que el servicio le pasa a `generateAlbaranPdf`. */
function loQueRecibeElPdf(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  let objeto = null;
  const visita = (n2) => {
    if (!objeto && ts.isCallExpression(n2) && ts.isIdentifier(n2.expression) &&
        n2.expression.text === 'generateAlbaranPdf' && ts.isObjectLiteralExpression(n2.arguments[0])) {
      objeto = n2.arguments[0];
    }
    ts.forEachChild(n2, visita);
  };
  visita(sf);
  return objeto ? { objeto, sf } : null;
}

test('SCRUM-452 · 🔴 el servicio NO le pasa al PDF ningún nombre vivo — es imposible por construcción', () => {
  const fuente = fs.readFileSync(F_SERVICIO, 'utf8');
  const hallado = loQueRecibeElPdf(fuente);
  assert.ok(hallado, '🔴 no se encuentra la llamada a `generateAlbaranPdf`: este guard ha dejado de mirar');
  const { objeto, sf } = hallado;

  const props = new Map();
  for (const p of objeto.properties) {
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
      props.set(p.name.text, p.initializer.getText(sf).replace(/\s+/g, ' '));
    }
  }
  assert.ok(props.size >= 10,
    `🔴 solo se han leído ${props.size} propiedades de la llamada: el analizador está ciego`);

  // 🔴 `merchant` y `customer` NO pueden llevar nombre ni NIF de emisor: si llegaran, el PDF
  // podría volver a pintarlos y este ticket se desharía en una línea.
  for (const [clave, prohibidas] of [['merchant', ['name', 'legalName', 'taxId']], ['customer', ['name', 'legalName']]]) {
    const texto = props.get(clave) ?? '';
    assert.ok(texto, `🔴 no se ha leído la propiedad \`${clave}\` de la llamada al PDF`);
    for (const mala of prohibidas) {
      assert.ok(!new RegExp(`\\b${mala}\\b`).test(texto),
        `🔴 EL SERVICIO LE PASA \`${clave}.${mala}\` AL PDF: «${texto}».\n\n` +
        '  Ese campo lo SELLA v:3, así que tiene que llegar por `contenidoSegunVersion`, no por la\n' +
        '  fila de hoy. Mientras el PDF lo reciba por aquí, puede volver a imprimir el valor vivo\n' +
        '  mientras el sello certifica otro — que es el defecto que este ticket cierra.');
    }
  }

  // Y los cinco llegan por el despachador: la llave es el `...sellado` del bloque resuelto.
  assert.match(fuente, /const sellado = contenidoSegunVersion\(/,
    '🔴 el servicio ya no resuelve el contenido por versión');
  assert.match(fuente, /return sellado;/,
    '🔴 el servicio ya no devuelve los CINCO campos resueltos al PDF. Si volviera a devolverlos ' +
    'uno a uno, el día que el bloque gane un sexto se olvidaría en silencio.');
});

test('SCRUM-452 · 🔴 el PDF ya NO SABE derivar un nombre: no recibe con qué', () => {
  // La otra mitad del «imposible por construcción». No basta con que el servicio no lo mande: el
  // fichero del PDF no puede seguir leyendo esos campos, o bastaría un llamador descuidado.
  const fuente = fs.readFileSync(F_PDF, 'utf8');
  const usos = [...fuente.matchAll(/params\.(merchant|customer)\.(\w+)/g)].map((m) => `${m[1]}.${m[2]}`);
  assert.ok(usos.length >= 3, `🔴 solo se ven ${usos.length} usos: el escáner está ciego`);

  const vivosProhibidos = usos.filter((u) =>
    ['merchant.name', 'merchant.legalName', 'merchant.taxId', 'customer.name', 'customer.legalName'].includes(u));
  assert.deepEqual(vivosProhibidos, [],
    `🔴 EL PDF SIGUE LEYENDO ${vivosProhibidos.join(', ')} DE LA FILA VIVA.\n\n` +
    '  Esos tres los sella v:3 y tienen que llegar por `emisor`, `emisorNif` y `cliente`. Mientras\n' +
    '  el PDF sepa derivarlos por su cuenta, el papel puede contradecir al sello.');

  // CONTROL POSITIVO dentro del mismo test: los que SÍ deben seguir en vivo siguen ahí. Una lista
  // vacía de prohibidos también saldría si el escáner no viera nada.
  for (const permitido of ['merchant.address', 'merchant.whatsappPhone', 'merchant.logoUrl', 'customer.taxId']) {
    assert.ok(usos.includes(permitido),
      `🔴 \`${permitido}\` ha dejado de leerse. El sobre NO lo congela, así que el papel lo toma de ` +
      'la fila de hoy con toda razón — quitarlo deja el documento sin un dato que sí tenía.');
  }

  // Y los tres nuevos se usan de verdad. Mencionar no es hacer.
  for (const usado of ['params.emisor', 'params.emisorNif', 'params.cliente']) {
    assert.ok(fuente.includes(usado), `🔴 \`${usado}\` no se usa en el PDF: llega y no se pinta`);
  }
});

test('SCRUM-452 · 🔴 el PDF de WhatsApp —el que se queda el CLIENTE— va por el mismo camino', () => {
  // Es la superficie donde más duele: ese PDF sale del producto y se lo queda un tercero. Si el
  // envío tuviera su propia composición, arreglar el GET no lo arreglaría.
  const fuente = fs.readFileSync(F_WHATSAPP, 'utf8');
  assert.match(fuente, /ensureAlbaranPdf\(/,
    '🔴 el envío por WhatsApp ya no pasa por `ensureAlbaranPdf`: tiene su propio camino al PDF y ' +
    'este ticket no lo cubre.');
  assert.ok(!/generateAlbaranPdf/.test(fuente),
    '🔴 el envío por WhatsApp llama DIRECTAMENTE al generador del PDF, saltándose la resolución por ' +
    'versión. El papel que se queda el cliente se compondría con las filas de hoy.');

  // SUELO: que `ensureAlbaranPdf` sea de verdad quien compone, y no un envoltorio que delega.
  const servicio = fs.readFileSync(F_SERVICIO, 'utf8');
  const i = servicio.indexOf('export async function ensureAlbaranPdf');
  assert.ok(i >= 0, '🔴 no se encuentra `ensureAlbaranPdf`');
  assert.ok(servicio.slice(i).indexOf('generateAlbaranPdf({') > 0,
    '🔴 `ensureAlbaranPdf` no compone la llamada al PDF: entonces cubrirla no cubre el envío.');
});
