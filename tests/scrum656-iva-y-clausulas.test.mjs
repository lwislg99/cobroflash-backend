// SCRUM-656 (T7, sprint Tecnosel) · EL IVA AL FINAL DEL PRESUPUESTO, Y LAS CLÁUSULAS DE CIERRE.
//
// Sin gate: funciones puras + AST. Ni BD, ni red, ni PDF renderizado.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO MEDIDO EN SUS DOCUMENTOS REALES
//
//   IRVE ............ TOTAL 987,00 € + «IVA. NO INCLUIDO» — el documento ni lo calcula
//   Escuela Arte .... TOTAL 550,00 · 21% IVA 115,50 · TOTAL IVA INCLUIDO 665,50
//   Facturas ........ BASE 280,00 / IVA 21% 58,80 / TOTAL 338,80
//
// En ninguno hay IVA por línea. Y la elección es del profesional, según el cliente que tenga
// delante: por eso la casilla va al CREAR y no en Configuración.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL PELIGRO DE ESTE TICKET, Y SALE DE LA TANDA ANTERIOR
//
// `calcTierTotal` era UNA SEGUNDA COPIA de `calcTotal`, y se habría quedado sumando `undefined`
// mientras la buena ya sabía saltarse las cabeceras de apartado (SCRUM-655). Tocar totales
// invita a escribir «una funcioncita para el IVA del pie», y ésa sería la TERCERA.
//
// Por eso `pieDePresupuesto` no calcula: llama a `calcVatBreakdown` —la primitiva de siempre— y
// solo decide QUÉ FILAS SE PINTAN. El modo no mueve un céntimo: cambia lo que el documento dice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import {
  MODOS_IVA, MODO_IVA_POR_DEFECTO, LEYENDA_IVA_NO_INCLUIDO,
  esModoIva, leerModoIva, pieDePresupuesto,
} from '../dist/modules/quotes/domain/presentacionIva.js';
import { clausulasParaDocumento, esClausulaPintable } from '../dist/modules/quotes/domain/clausulas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 LA ARITMÉTICA PRIMERO, Y CON CÉNTIMOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-656 · 🔴 base 280,00 → IVA 21% 58,80 → total 338,80, y a mano', () => {
  // Los números salen de su factura real, y NO de llamar a lo que se prueba:
  //   4 × 45,00 = 180,00 · 2 × 32,50 = 65,00 · 1 × 35,00 = 35,00  →  base 280,00
  //   280,00 × 0,21 = 58,80  →  total 338,80
  const lineas = [
    { concept: 'Punto de recarga', qty: 4, price: 45, tax: 0.21 },
    { concept: 'Canalización', qty: 2, price: 32.5, tax: 0.21 },
    { concept: 'Puesta en marcha', qty: 1, price: 35, tax: 0.21 },
  ];
  const pie = pieDePresupuesto({ lineas, modo: 'sumar', nombreImpuesto: 'IVA' });

  assert.equal(pie.filas.length, 2,
    `🔴 el pie tiene ${pie.filas.length} filas y son DOS: base imponible y la cuota del 21 %.`);
  assert.equal(pie.filas[0].etiqueta, 'Base imponible:');
  assert.equal(pie.filas[0].importe, 280.00,
    `🔴 LA BASE NO ES 280,00 € SINO ${eur(pie.filas[0].importe)}. A mano: 180,00 + 65,00 + 35,00. `
    + 'Un total que no cuadra con su base y su cuota es un defecto fiscal, no de interfaz.');
  assert.equal(pie.filas[1].etiqueta, 'IVA 21%:');
  assert.equal(pie.filas[1].importe, 58.80,
    `🔴 LA CUOTA NO ES 58,80 € SINO ${eur(pie.filas[1].importe)} (280,00 × 21 %).`);
  assert.equal(
    Math.round((pie.filas[0].importe + pie.filas[1].importe) * 100) / 100, 338.80,
    '🔴 base + cuota no dan 338,80 €: el documento enseñaría tres cifras que no cuadran entre sí.');
  assert.equal(pie.leyenda, null, '🔴 en modo «sumar» no va ninguna leyenda');
});

test('SCRUM-656 · con dos tipos de IVA salen las DOS cuotas, cada una con su tipo', () => {
  // 10 × 80 = 800 al 21 % → 168,00 · 1 × 250 = 250 al 10 % → 25,00
  const lineas = [
    { concept: 'Mano de obra', qty: 10, price: 80, tax: 0.21 },
    { concept: 'Material reducido', qty: 1, price: 250, tax: 0.10 },
  ];
  const pie = pieDePresupuesto({ lineas, modo: 'sumar', nombreImpuesto: 'IVA' });
  assert.deepEqual(pie.filas.map((f) => f.etiqueta), ['Base imponible:', 'IVA 21%:', 'IVA 10%:']);
  assert.equal(pie.filas[0].importe, 1050.00, '🔴 la base de los dos tramos no es 1.050,00 €');
  assert.equal(pie.filas[1].importe, 168.00);
  assert.equal(pie.filas[2].importe, 25.00);
});

test('SCRUM-656 · el nombre del impuesto es un DATO: en Canarias rotula IGIC', () => {
  // SCRUM-647: resolver el nombre por PAÍS miente en Canarias, y `ES` incluye Canarias. Aquí solo
  // se rotula con lo que le den — el módulo no decide de qué impuesto se trata.
  const pie = pieDePresupuesto({
    lineas: [{ concept: 'X', qty: 1, price: 100, tax: 0.07 }],
    modo: 'sumar', nombreImpuesto: 'IGIC',
  });
  assert.equal(pie.filas[1].etiqueta, 'IGIC 7%:',
    '🔴 el pie rotula «IVA» pase lo que pase: a un canario le pondría un impuesto que no repercute.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 LOS DOS MODOS, ENUMERADOS. Probar uno no distingue «tiene dos modos» de
//       «ignora la casilla».
// ═════════════════════════════════════════════════════════════════════════════════════════

const LINEAS = [{ concept: 'Instalación', qty: 1, price: 987, tax: 0.21 }];

test('SCRUM-656 · 🔴 CONTROL POSITIVO · modo «sumar»: se pintan las TRES cifras', () => {
  const pie = pieDePresupuesto({ lineas: LINEAS, modo: 'sumar', nombreImpuesto: 'IVA' });
  assert.equal(pie.filas.length, 2, '🔴 faltan filas: base y cuota tienen que salir las dos');
  assert.equal(pie.leyenda, null,
    '🔴 en «sumar» se ha pintado una leyenda: el documento diría a la vez cuánto es el IVA y que '
    + 'no está incluido.');
});

test('SCRUM-656 · 🔴 CONTROL NEGATIVO · modo «no incluido»: NINGUNA cuota, y SÍ la leyenda', () => {
  const pie = pieDePresupuesto({ lineas: LINEAS, modo: 'no_incluido', nombreImpuesto: 'IVA' });
  assert.deepEqual(pie.filas, [],
    '🔴 SE HA PINTADO UNA CUOTA EN UN PRESUPUESTO SIN IVA INCLUIDO.\n'
    + '  No es que se oculte una cifra que existe: ese documento NO AFIRMA cuánto será el\n'
    + '  impuesto. Pintarla «por si acaso» convierte una oferta sin IVA en una oferta con IVA a\n'
    + '  los ojos del cliente — y es la cifra por la que después se discute.');
  assert.equal(pie.leyenda, LEYENDA_IVA_NO_INCLUIDO,
    '🔴 falta la leyenda «IVA NO INCLUIDO». Sin ella el cliente lee el total como precio final, '
    + 'que es exactamente lo que la leyenda existe para impedir.');
});

test('SCRUM-656 · los dos modos son un conjunto CERRADO y el desconocido se declara', () => {
  assert.deepEqual([...MODOS_IVA].sort(), ['no_incluido', 'sumar']);
  assert.equal(esModoIva('sumar'), true);
  assert.equal(esModoIva('sin_iva'), false, '🔴 un modo inventado no puede pasar por bueno');

  // Ausente = presupuesto anterior a la casilla → el de siempre, y RECONOCIDO.
  assert.deepEqual(leerModoIva(null), { modo: MODO_IVA_POR_DEFECTO, reconocido: true });
  assert.deepEqual(leerModoIva(undefined), { modo: MODO_IVA_POR_DEFECTO, reconocido: true });
  // Desconocido = cae al de siempre PERO se puede saber que cayó.
  const raro = leerModoIva('sin_iva');
  assert.equal(raro.modo, MODO_IVA_POR_DEFECTO);
  assert.equal(raro.reconocido, false,
    '🔴 un modo ilegible se traga en silencio: «no lo entendí» y «no había nada» acabarían siendo '
    + 'el mismo caso, y nadie podría avisar.');
  assert.equal(MODO_IVA_POR_DEFECTO, 'sumar',
    '🔴 el defecto ha dejado de ser «sumar». Eso cambiaría EN SILENCIO todos los presupuestos de '
    + 'quien no ha elegido nada: hoy el PDF ya pinta el desglose desde SCRUM-623.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · 🔴 EL CONTROL NEGATIVO QUE NO PUEDE FALTAR: LA CASILLA NO TOCA LA FACTURA
// ═════════════════════════════════════════════════════════════════════════════════════════

/** El cuerpo de una función del PDF, extraído por AST. */
function cuerpoDe(nombre) {
  const sf = ts.createSourceFile('pdf.ts', PDF, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let out = null;
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nombre && n.body) out = n.body.getText(sf);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

test('SCRUM-656 · 🔴 la FACTURA no sabe nada del modo de IVA — y no puede saberlo', () => {
  const factura = cuerpoDe('generateInvoicePdf');
  const presupuesto = cuerpoDe('generateQuotePdf');

  // SUELO: si el extractor no encuentra las funciones, los `!includes` de abajo pasarían vacíos.
  assert.ok(factura && factura.length > 2000,
    '🔴 CIEGO: no se ha podido extraer el cuerpo de `generateInvoicePdf`; el control negativo '
    + 'estaría comprobando una cadena vacía.');
  assert.ok(presupuesto && presupuesto.length > 2000,
    '🔴 CIEGO: no se ha podido extraer el cuerpo de `generateQuotePdf`.');

  for (const marca of ['modoIva', 'pieDePresupuesto', 'leerModoIva', LEYENDA_IVA_NO_INCLUIDO]) {
    assert.ok(!factura.includes(marca),
      `🔴 «${marca}» APARECE EN EL CUERPO DE LA FACTURA.\n`
      + '  Una factura lleva base, cuota y total SIEMPRE: lo exige el reglamento de facturación.\n'
      + '  Esta casilla vive en el presupuesto y muere ahí. Si el modo se propaga a la factura, es\n'
      + '  un defecto FISCAL, no una preferencia de maqueta.');
  }
  // Y el positivo: el presupuesto SÍ lo usa. Sin esto, borrar el modo entero pasaría en verde.
  assert.ok(presupuesto.includes('pieDePresupuesto'),
    '🔴 el PDF de PRESUPUESTO ya no llama a `pieDePresupuesto`: el modo no se aplica en ningún '
    + 'sitio y los dos controles de arriba estarían midiendo un mecanismo desconectado.');
  assert.ok(presupuesto.includes('pie.leyenda'),
    '🔴 el PDF de presupuesto ya no pinta la leyenda: en modo «no incluido» el documento saldría '
    + 'con el total a secas y sin decir que el IVA no está dentro.');
});

test('SCRUM-656 · el módulo del modo vive en `quotes/` y no lo importa nadie de emisión', () => {
  // La frontera, por construcción y no por costumbre: si un fichero de `invoicing/domain` lo
  // importara, el modo tendría un camino hasta el sellado.
  const dir = path.join(RAIZ, 'src/modules/invoicing/domain');
  const culpables = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('presentacionIva'));
  assert.deepEqual(culpables, [],
    `🔴 estos ficheros del dominio de FACTURACIÓN importan el modo de IVA del presupuesto: `
    + `${culpables.join(', ')}. Ese módulo no puede tener un camino hacia el camino de emisión.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 4 · LAS CLÁUSULAS
// ═════════════════════════════════════════════════════════════════════════════════════════

const DEL_MERCHANT = [
  { id: 'garantia', titulo: 'Garantía', texto: 'Dos años sobre la instalación, salvo mal uso.' },
  {
    id: 'alcance',
    titulo: 'Alcance',
    texto: 'No incluye los trabajos de albañilería, carpintería, pintura y en general, cualquier '
      + 'concepto o elemento no especificado en la oferta.',
  },
  { id: 'validez', titulo: 'Plazo de validez', texto: 'Treinta días desde la fecha de emisión.' },
];

test('SCRUM-656 · las tres cláusulas del merchant salen en el documento', () => {
  const c = clausulasParaDocumento(DEL_MERCHANT, null);
  assert.equal(c.length, 3, '🔴 no salen las tres cláusulas del merchant');
  assert.match(c[1].texto, /albañilería/,
    '🔴 se ha perdido la de ALCANCE, que es la que evita la discusión: es la frase que dice que '
    + 'pintar la pared que se picó no entra en el precio.');
});

test('SCRUM-656 · 🔴 quitar UNA de un presupuesto NO la borra de la configuración', () => {
  const c = clausulasParaDocumento(DEL_MERCHANT, ['garantia']);
  assert.deepEqual(c.map((x) => x.id), ['alcance', 'validez'],
    '🔴 excluir una cláusula no la ha quitado de ESTE documento.');
  // Y la configuración sigue intacta: el siguiente presupuesto vuelve a llevarla.
  assert.equal(DEL_MERCHANT.length, 3,
    '🔴 EXCLUIR HA BORRADO: la lista del merchant ha cambiado. El siguiente presupuesto saldría '
    + 'sin garantía sin que nadie lo haya decidido.');
  assert.deepEqual(clausulasParaDocumento(DEL_MERCHANT, null).map((x) => x.id),
    ['garantia', 'alcance', 'validez'],
    '🔴 tras excluirla en un documento, otro documento ya no la lleva: la exclusión se ha hecho '
    + 'permanente.');
});

test('SCRUM-656 · 🔴 con la configuración VACÍA no hay bloque, y un título sin texto no cuenta', () => {
  assert.deepEqual(clausulasParaDocumento([], null), [],
    '🔴 con la configuración vacía se devuelve algo: el PDF abriría una sección sin contenido.');
  assert.deepEqual(clausulasParaDocumento(null, null), [],
    '🔴 AUSENTE y VACÍO tienen que dar los dos «nada que pintar», sin reventar.');

  // 🔴 El título huérfano: «GARANTÍA» y debajo nada se lee como que la garantía existe y no dice
  // cuál. En un documento que el cliente firma, eso es peor que no ponerla.
  assert.deepEqual(clausulasParaDocumento([{ id: 'g', titulo: 'Garantía', texto: '   ' }], null), [],
    '🔴 una cláusula con el texto en blanco se pinta: sale un TÍTULO HUÉRFANO.');
  assert.deepEqual(clausulasParaDocumento([{ id: 'g', titulo: '', texto: 'Dos años.' }], null), [],
    '🔴 una cláusula sin título se pinta: sale un párrafo suelto sin encabezar.');
  assert.equal(esClausulaPintable({ id: 'x', titulo: 'A', texto: 'B' }), true);
  assert.equal(esClausulaPintable(null), false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 5 · SUELO DE CEGUERA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-656 · 🔴 SUELO: sin líneas no se inventa un pie, y el total no puede salir a cero', () => {
  const pie = pieDePresupuesto({ lineas: [], modo: 'sumar', nombreImpuesto: 'IVA' });
  assert.deepEqual(pie.filas, [],
    '🔴 sin líneas se ha pintado una «Base imponible: 0,00 €». Un «0,00 €» en un presupuesto se '
    + 'lee como GRATIS, y es la cifra que el cliente recuerda.');
  assert.equal(pie.leyenda, null);

  // Y el suelo del propio módulo: si `calcVatBreakdown` dejara de devolver tramos, el pie saldría
  // con la base sola y sin cuotas — o sea, un documento que dice que no hay impuesto.
  const conLineas = pieDePresupuesto({
    lineas: [{ concept: 'X', qty: 1, price: 100, tax: 0.21 }], modo: 'sumar', nombreImpuesto: 'IVA',
  });
  assert.ok(conLineas.filas.length >= 2,
    `🔴 CIEGO: con una línea al 21 % solo salen ${conLineas.filas.length} fila(s). Si el desglose `
    + 'devolviera vacío, el documento enseñaría base sin cuota y nadie lo notaría.');
});
