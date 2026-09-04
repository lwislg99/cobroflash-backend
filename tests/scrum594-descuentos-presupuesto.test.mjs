// tests/scrum594-descuentos-presupuesto.test.mjs — SCRUM-594 (DOC-04)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// DESCUENTO POR LÍNEA (%) Y DESCUENTO GLOBAL (€) — LA ARITMÉTICA, EJECUTADA
//
// La víctima: un fontanero cierra una obra de 3.000 € y el cliente le pide una rebaja. Hasta
// hoy tenía que falsear los precios línea a línea, y el presupuesto dejaba de reflejar lo que
// costaba cada cosa.
//
// ── 🔴 EL TEST QUE DECIDE ESTÁ EL PRIMERO ───────────────────────────────────────────────
// Un presupuesto guardado ANTES de este cambio —sin `dto` en sus líneas y sin columna de
// descuento global— tiene que pintar EXACTAMENTE los mismos totales DESPUÉS. Céntimo a
// céntimo. No es una comprobación de cortesía: este ticket toca el cálculo del dinero, y si
// mueve un solo céntimo de un documento existente, no vale.
//
// Es cierto POR CONSTRUCCIÓN, no por suerte: la clave `dto` NO VIAJA cuando no hay descuento
// (`descuentoParaPayload`, el mismo criterio que `costeParaPayload` de SCRUM-661), así que una
// línea vieja y una nueva sin descuento son el MISMO objeto.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const D = require_(path.join(RAIZ, 'public/dashboard/js/quoteDescuentos.js'));
const { calcTotal } = await import('../dist/core/utils/utils.js');
const { generateQuotePdf, generateInvoicePdf } =
  await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');

const euros = (cents) => (cents / 100).toFixed(2);

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · si la pieza no responde, todo lo de abajo pasa sin medir nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-594 · SUELO: la pieza exporta lo que estos tests ejercen, y DISTINGUE', () => {
  for (const f of ['dtoDeLinea', 'precioEfectivo', 'repartirGlobal', 'totalesConDescuento',
    'hayDescuento', 'descuentoParaPayload']) {
    assert.equal(typeof D[f], 'function', `🔴 no se exporta \`${f}\``);
  }
  // Si diera lo mismo con y sin descuento, los tests de abajo pasarían sobre una función muda.
  const LS = [{ qty: 1, price: 100, tax: 0.21 }];
  assert.notEqual(
    D.totalesConDescuento(LS, null).totalCents,
    D.totalesConDescuento(LS, 10).totalCents,
    '🔴 el descuento global no cambia el total: la pieza no está calculando nada.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL NEGATIVO QUE MANDA: LO DE ANTES NO SE MUEVE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-594 · 🔴 un presupuesto SIN descuento da EXACTAMENTE lo de antes, céntimo a céntimo', () => {
  // Las líneas son las de un presupuesto anterior a este ticket: no tienen la clave `dto`.
  const VIEJAS = [
    { qty: 2, price: 45.5, tax: 0.21 },
    { qty: 1, price: 120, tax: 0.21 },
    { qty: 3, price: 9.99, tax: 0.1 },
  ];
  // Lo que daba el cálculo de siempre: base × (1 + tax) por línea, sumado.
  const antes = VIEJAS.reduce((a, l) => a + l.qty * l.price * (1 + l.tax), 0);

  const t = D.totalesConDescuento(VIEJAS, null);
  assert.equal(euros(t.totalCents), antes.toFixed(2),
    '🔴 UN PRESUPUESTO YA GUARDADO CAMBIA DE TOTAL. Es el defecto que este ticket no puede '
    + 'cometer: el documento deja de decir lo que se acordó.');
  assert.equal(t.descuentoLineasCents, 0, '🔴 inventa un descuento de línea donde no lo hay');
  assert.equal(t.descuentoGlobalCents, 0, '🔴 inventa un descuento global donde no lo hay');
  assert.equal(D.hayDescuento(VIEJAS, null), false,
    '🔴 daría el bloque de descuentos por pintado en un presupuesto que no lo tiene');
});

test('SCRUM-594 · 🔴 AUSENTE ≠ CERO: sin descuento la clave NO viaja', () => {
  // Si viajara `dto: 0`, una línea que nadie tocó dejaría de ser distinguible de una decisión —
  // y además cambiaría el objeto guardado de TODOS los presupuestos que se reediten.
  assert.deepEqual(D.descuentoParaPayload(''), {});
  assert.deepEqual(D.descuentoParaPayload(null), {});
  assert.deepEqual(D.descuentoParaPayload(undefined), {});
  assert.deepEqual(D.descuentoParaPayload('0'), {}, '🔴 un cero escrito tampoco crea la clave');
  assert.deepEqual(D.descuentoParaPayload('no es un número'), {}, '🔴 un texto ilegible NO es 0');
  assert.deepEqual(D.descuentoParaPayload('10'), { dto: 10 });
  assert.deepEqual(D.descuentoParaPayload('150'), { dto: 100 }, '🔴 un dto > 100 % dejaría el precio negativo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 NÚMEROS CONCRETOS, NO «APROXIMADAMENTE»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-594 · 🔴 un 10 % sobre tres líneas de 9,99 € cuadra céntimo a céntimo', () => {
  const LS = [
    { qty: 1, price: 9.99, dto: 10, tax: 0.21 },
    { qty: 1, price: 9.99, dto: 10, tax: 0.21 },
    { qty: 1, price: 9.99, dto: 10, tax: 0.21 },
  ];
  const t = D.totalesConDescuento(LS, null);
  // 9,99 − 10 % = 8,991 · 3 = 26,973 → base 26,97 · total 3 × 8,991 × 1,21 = 32,637 → 32,64
  //
  // 🔴 EL TOTAL ES 32,64 Y NO 32,63, Y LA DIFERENCIA NO ES CAPRICHO. La primera versión de esta
  // pieza redondeaba a céntimo POR LÍNEA y daba 32,63; `calcTotal` acumula en coma flotante y
  // redondea al final, y da 32,64. Lo cazó el barrido de equivalencia de más abajo. Manda el
  // backend, porque es quien produce el `Quote.total` que se guarda: cambiar SU redondeo movería
  // importes de presupuestos existentes, y cuál de las cuatro convenciones del árbol debe mandar
  // está en la asesoría (SCRUM-619, 623 y 624). Este ticket no lo decide.
  assert.equal(euros(t.sumaSinDescuentoCents), '29.97', '🔴 la suma de líneas a tarifa no cuadra');
  assert.equal(euros(t.descuentoLineasCents), '3.00', '🔴 el descuento de las líneas no cuadra');
  assert.equal(euros(t.baseImponibleCents), '26.97', '🔴 la base imponible no cuadra');
  assert.equal(euros(t.cuotaCents), '5.67', '🔴 la cuota no cuadra');
  assert.equal(euros(t.totalCents), '32.64', '🔴 el total no cuadra');
  // Y la comprobación que lo ata todo: las partes suman el todo.
  assert.equal(t.baseImponibleCents + t.cuotaCents, t.totalCents, '🔴 las partes no suman el total');
});

test('SCRUM-594 · 🔴 EL CÉNTIMO QUE SOBRA: el reparto suma EXACTAMENTE el descuento firmado', () => {
  // Dos tipos y un descuento que no divide limpio, que es el caso que pierde céntimos si el
  // reparto se hace a lo tonto. 1,00 € entre bases de 10,00 (21 %) y 5,00 (10 %):
  //   21 % → round(100 × 1000/1500) = 67    ·    10 % → 100 − 67 = 33    ·    suma = 100 ✅
  const r = D.repartirGlobal([{ rate: 21, baseCents: 1000 }, { rate: 10, baseCents: 500 }], 100);
  const suma = r.reduce((a, t) => a + t.descuentoCents, 0);
  assert.equal(suma, 100,
    `🔴 EL REPARTO PIERDE ${100 - suma} CÉNTIMO(S). El importe es lo que el cliente VE Y FIRMA: `
    + 'si el prorrateo no conserva la suma, el documento deja de decir lo que se acordó.');
  assert.deepEqual(r.map((t) => t.descuentoCents), [67, 33], '🔴 el reparto no es proporcional a la base');
});

test('SCRUM-594 · 🔴 y conserva la suma en MUCHOS casos, no en el que me convenía', () => {
  // Un solo ejemplo puede cuadrar por suerte. Se barre un rango de descuentos y de repartos.
  const CASOS = [
    [{ rate: 21, baseCents: 1000 }, { rate: 10, baseCents: 500 }],
    [{ rate: 21, baseCents: 333 }, { rate: 10, baseCents: 333 }, { rate: 4, baseCents: 334 }],
    [{ rate: 21, baseCents: 1 }, { rate: 0, baseCents: 99999 }],
  ];
  let comprobados = 0;
  for (const tipos of CASOS) {
    const total = tipos.reduce((a, t) => a + t.baseCents, 0);
    for (let d = 1; d <= Math.min(total, 500); d += 7) {
      const suma = D.repartirGlobal(tipos, d).reduce((a, t) => a + t.descuentoCents, 0);
      assert.equal(suma, d, `🔴 con ${tipos.length} tipos y ${d} céntimos, el reparto suma ${suma}`);
      comprobados++;
    }
  }
  assert.ok(comprobados > 100, `🔴 SUELO: sólo ${comprobados} casos comprobados; esto no barre nada`);
});

test('SCRUM-594 · el descuento global NUNCA deja bases negativas', () => {
  // Un descuento mayor que el presupuesto entero daría un IVA negativo y un total bajo cero.
  const LS = [{ qty: 1, price: 100, tax: 0.21 }];
  const t = D.totalesConDescuento(LS, 500);
  assert.equal(t.baseImponibleCents, 0, '🔴 base negativa con un descuento mayor que el total');
  assert.equal(t.cuotaCents, 0, '🔴 cuota negativa');
  assert.equal(t.totalCents, 0, '🔴 total negativo: el documento le pediría dinero al cliente');
  assert.equal(euros(t.descuentoGlobalCents), '100.00', '🔴 dice haber descontado más de lo que había');
});

test('SCRUM-594 · los DOS descuentos a la vez, y en el orden del bloque', () => {
  // Primero el de línea sobre el precio, después el global sobre lo que queda.
  const LS = [{ qty: 2, price: 50, dto: 10, tax: 0.21 }];   // 2 × 45 = 90,00
  const t = D.totalesConDescuento(LS, 15);                   // −15,00 → base 75,00
  assert.equal(euros(t.sumaSinDescuentoCents), '100.00');
  assert.equal(euros(t.descuentoLineasCents), '10.00');
  assert.equal(euros(t.descuentoGlobalCents), '15.00');
  assert.equal(euros(t.baseImponibleCents), '75.00');
  assert.equal(euros(t.cuotaCents), '15.75');
  assert.equal(euros(t.totalCents), '90.75');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA PANTALLA Y LO QUE SE GUARDA TIENEN QUE DAR EL MISMO NÚMERO
//
// Hay dos implementaciones —`quoteDescuentos.js` para la pantalla y `calcTotal` para lo que se
// guarda—, igual que el suplido tiene `quoteSuplido.js` y `suplidos.ts`. El repo lo permite,
// pero sólo con esto: un barrido que EXIGE que coincidan.
//
// No es teórico. Este test cazó una divergencia real mientras se escribía el ticket: la pieza
// de pantalla acumulaba en céntimos por línea y `calcTotal` en coma flotante, y `3 × 9,99 −10 %`
// daba 32,63 en la pantalla y 32,64 en la base. Un profesional habría visto un número y firmado
// otro.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-594 · 🔴 la pieza de PANTALLA y `calcTotal` dan EXACTAMENTE lo mismo', () => {
  const CASOS = [
    [[{ concept: 'a', qty: 1, price: 9.99, tax: 0.21 }], null],
    [[{ concept: 'a', qty: 3, price: 9.99, dto: 10, tax: 0.21 }], null],
    [[{ concept: 'a', qty: 2, price: 50, dto: 10, tax: 0.21 }], 15],
    [[{ concept: 'a', qty: 1, price: 10, tax: 0.21 }, { concept: 'b', qty: 1, price: 5, tax: 0.1 }], 1],
    // Una CABECERA de apartado con importe puesto: no puede mover el total por ningún lado.
    [[{ concept: 'h', apartado: true, qty: 99, price: 99 }, { concept: 'a', qty: 1, price: 10, tax: 0.21 }], null],
    [[{ concept: 'a', qty: 1, price: 100, tax: 0.21 }], 500],
    [[{ concept: 'a', qty: 7, price: 3.33, dto: 33, tax: 0.04 },
      { concept: 'b', qty: 2, price: 19.95, dto: 5, tax: 0.21 }], 7.77],
    [[{ concept: 'a', qty: 1, price: 0, tax: 0.21 }], null],
  ];
  for (const [lineas, global] of CASOS) {
    const pantalla = euros(D.totalesConDescuento(lineas, global).totalCents);
    const guardado = calcTotal(lineas, global).toFixed(2);
    assert.equal(pantalla, guardado,
      `🔴 LA PANTALLA DICE ${pantalla} Y SE GUARDARÍA ${guardado}. El profesional vería un número `
      + `y firmaría otro. Caso: ${JSON.stringify({ lineas, global })}`);
  }
});

test('SCRUM-594 · 🔴 y el papel SUMA: base + IVA = Total, siempre', () => {
  // Un céntimo de diferencia es malo; un documento cuyas filas no suman su propio total es peor,
  // porque el cliente lo comprueba con los dedos. Por eso la cuota se DERIVA del total.
  const CASOS = [
    [[{ concept: 'a', qty: 3, price: 9.99, dto: 10, tax: 0.21 }], null],
    [[{ concept: 'a', qty: 7, price: 3.33, dto: 33, tax: 0.04 },
      { concept: 'b', qty: 2, price: 19.95, dto: 5, tax: 0.21 }], 7.77],
    [[{ concept: 'a', qty: 1, price: 10, tax: 0.21 }, { concept: 'b', qty: 1, price: 5, tax: 0.1 }], 1],
  ];
  for (const [lineas, global] of CASOS) {
    const t = D.totalesConDescuento(lineas, global);
    assert.equal(t.baseImponibleCents + t.cuotaCents, t.totalCents,
      `🔴 el documento no suma: ${euros(t.baseImponibleCents)} + ${euros(t.cuotaCents)} ≠ `
      + `${euros(t.totalCents)}. Caso: ${JSON.stringify({ lineas, global })}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO DEL CENSO · si no encuentra líneas con descuento, falla
// ═════════════════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL PAPEL DE VERDAD — leído del PDF, no del fuente
// ═════════════════════════════════════════════════════════════════════════════════════════

const CASO = {
  merchantId: 71, merchant: { name: 'Taller' }, customer: { name: 'Cliente' },
  currency: 'EUR', qrData: 'x',
};

test('SCRUM-594 · 🔴 EL QUE DECIDE: un presupuesto SIN descuento imprime EXACTAMENTE lo de antes', async () => {
  // Líneas anteriores a este ticket: sin la clave `dto`, y sin descuento global. El papel tiene
  // que salir con las MISMAS cifras y con las MISMAS filas: ni una de más.
  const lines = [{ concept: 'Mano de obra', qty: 1, price: 105, tax: 0.12 }];
  const { outPath } = await generateQuotePdf({
    ...CASO, quoteId: 5941, number: 'P-5941', lines, total: '117.60',
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un texto vacío pasaría por «no dice nada».`);

  assert.ok(r.texto.includes('117,60'), '🔴 el total del presupuesto ha cambiado');
  assert.ok(r.texto.includes('105,00'), '🔴 la base imponible ha cambiado');
  assert.ok(r.texto.includes('12,60'), '🔴 la cuota ha cambiado');
  // Y las filas del descuento NO pueden aparecer: no hay descuento que contar.
  for (const rotulo of ['Suma de líneas', 'Descuento:', 'Descuento global']) {
    assert.equal(r.texto.includes(rotulo), false,
      `🔴 aparece «${rotulo}» en un presupuesto SIN descuento. El documento de un profesional que `
      + 'no ha rebajado nada no puede hablar de rebajas.');
  }
});

test('SCRUM-594 · con descuento, el papel LO DICE y sigue sumando', async () => {
  const lines = [{ concept: 'Mano de obra', qty: 1, price: 100, dto: 10, tax: 0.21 }];
  const { outPath } = await generateQuotePdf({
    ...CASO, quoteId: 5942, number: 'P-5942', lines, total: String(calcTotal(lines, 5)),
    discountGlobalAmount: 5,
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 no supe leer el PDF: ${r.motivo}`);
  assert.ok(r.texto.includes('Suma de líneas'), '🔴 no dice de cuánto se partía');
  assert.ok(r.texto.includes('Descuento global'), '🔴 no dice el descuento global');
  assert.ok(r.texto.includes('100,00'), '🔴 no imprime la suma de líneas a tarifa');
  // 100 − 10 % = 90 · −5 global = 85 de base · IVA 21 % = 17,85 · total 102,85
  assert.ok(r.texto.includes('85,00'), '🔴 la base imponible tras los dos descuentos no cuadra');
  assert.ok(r.texto.includes('102,85'), '🔴 el total no cuadra');
});

test('SCRUM-594 · 🔴 LA ACOTACIÓN, PROBADA: la factura IGNORA el `dto` por completo', async () => {
  // La propagación del descuento a la factura queda FUERA de este ticket: allí el total se
  // RECALCULA desde `lines` con un motor distinto del que alimenta el libro registro y VeriFactu
  // (SCRUM-624, abierto). Esto prueba que no se ha colado por ningún lado.
  //
  // 🔴 SE COMPARAN LOS DOS DOCUMENTOS, Y NO UNA CIFRA SUELTA. La primera versión de este test
  // comprobaba `texto.includes('121,00')` y era INCAPAZ DE FALLAR: al inyectar el descuento en
  // el bucle de la factura, el documento pasaba a imprimir 50,00 / 10,50 / **60,50** de total…
  // y seguía conteniendo «121,00», porque ese número también aparece en el IMPORTE DE LA LÍNEA.
  // El test pasaba sobre una factura con el total cambiado. Lo cazó la mutación, no la lectura.
  const conDto = [{ concept: 'Mano de obra', qty: 1, price: 100, dto: 50, tax: 0.21 }];
  const sinDto = [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }];

  const importesDe = async (lines, id) => {
    const { outPath } = await generateInvoicePdf({
      ...CASO, invoiceId: id, number: `2026-CF-${id}`, lines, total: '121.00',
    });
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 no supe leer el PDF: ${r.motivo}`);
    return [...new Set([...r.texto.matchAll(/\d+[.,]\d{2}/g)].map((m) => m[0]))].sort();
  };

  const a = await importesDe(conDto, 5943);
  const b = await importesDe(sinDto, 5944);
  assert.deepEqual(a, b,
    '🔴 LA FACTURA HA CAMBIADO DE IMPORTES al llegarle una línea con `dto`. Ese documento se '
    + 'calcula con un motor distinto del que alimenta el libro registro y VeriFactu (SCRUM-624, '
    + `abierto): el descuento NO entra ahí en este ticket.\n  con dto: ${a}\n  sin dto: ${b}`);
  // Y el suelo del propio control: si no viera importes, la igualdad de arriba sería vacía.
  assert.ok(a.length >= 3, `🔴 sólo veo ${a.length} importes en la factura: no estoy midiendo nada`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SUPERFICIE · que el campo EXISTA y que un descuento escrito NO quede invisible
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-594 · el editor tiene el campo, y el chip DICE el descuento', () => {
  // «Mencionar no es hacer»: que la pieza exista no prueba que la pantalla la use.
  const vista = soloCodigo(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8'));
  assert.match(vista, /campoLinea\("Dto\. %"/, '🔴 el editor no crea el campo «Dto. %»');
  assert.match(vista, /quoteDescuentos\.descuentoParaPayload/,
    '🔴 el payload no usa el criterio «ausente ≠ cero»: reeditar un presupuesto viejo le metería '
    + 'un `dto: 0` a todas sus líneas');
  assert.match(vista, /quoteDescuentos\.totalesConDescuento/,
    '🔴 la pantalla vuelve a sumar por su cuenta en vez de usar la pieza probada contra `calcTotal`');
  assert.match(vista, /Dto\. \$\{dtoDeEsta\} %/,
    '🔴 el chip de ajustes no dice el descuento. La hoja se abre cerrada: un descuento escrito '
    + 'quedaría invisible, y un dato invisible es un dato que nadie corrige (CONT-01 ②).');
  // Y el fichero tiene que estar CARGADO, no sólo existir.
  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  assert.match(html, /quoteDescuentos\.js/, '🔴 la pieza no está cargada en el panel: petaría al abrir');
});

test('SCRUM-594 · 🔴 CONTROL NEGATIVO: renombrar un rótulo NO tumba nada de esto', () => {
  // Los tests de arriba miran CONDUCTA —importes, claves, llamadas—, no textos de rótulo. Si
  // alguno se cayera al cambiar una etiqueta, estaría fijando microcopy sin decirlo, y el asesor
  // no podría aprobar un texto sin romper la suite.
  const T = D.totalesConDescuento([{ qty: 1, price: 100, dto: 10, tax: 0.21 }], 5);
  assert.equal(T.totalCents, 10285,
    '🔴 el cálculo depende de algún rótulo: es aritmética, no puede mirar textos');
  assert.deepEqual(D.descuentoParaPayload('10'), { dto: 10 });
});

test('SCRUM-594 · 🔴 SUELO: el detector de «hay descuento» VE los dos tipos por separado', () => {
  // Son independientes y se activan por separado: si el detector sólo viera uno, la mitad del
  // bloque no se pintaría nunca y nadie lo notaría.
  assert.equal(D.hayDescuento([{ qty: 1, price: 10, dto: 5, tax: 0.21 }], null), true,
    '🔴 no ve un descuento de LÍNEA');
  assert.equal(D.hayDescuento([{ qty: 1, price: 10, tax: 0.21 }], 2), true,
    '🔴 no ve un descuento GLOBAL');
  assert.equal(D.hayDescuento([{ qty: 1, price: 10, tax: 0.21 }], null), false,
    '🔴 ve descuentos donde no los hay: el bloque se pintaría siempre');
  assert.equal(D.hayDescuento([{ qty: 1, price: 10, dto: 0, tax: 0.21 }], 0), false,
    '🔴 un cero explícito cuenta como descuento');
});
