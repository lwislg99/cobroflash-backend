// tests/scrum616-que-guarda-la-factura.test.mjs — SCRUM-616 (carril B)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUE GUARDA HOY `POST /admin/invoices`. NO lo que deberia guardar: LO QUE GUARDA.
//
// Esto es una CARACTERIZACION: congela el comportamiento actual para que un cambio lo delate.
// `scrum289b` ya cubre el gate, la tenencia, la regla 29, el microcopy y que la validacion
// acepta y rechaza. Lo que NO cubria —medido en SCRUM-600— son dos cosas:
//
//   · LA FORMA DEL RESULTADO: que queda guardado, exactamente.
//   · QUE LAS CLAVES DE MAS SE DESCARTAN EN SILENCIO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUE ESTO IMPORTA: ES COMO SE PIERDE EL SUPLIDO
//
// F8 —«suplido como concepto de primera clase»— es una de las ocho funciones que DOC-10
// (SCRUM-600) declara innegociables. Para un oficio es real y es FISCAL: lo que el profesional
// paga por cuenta del cliente y le repercute tal cual, sin IVA ni margen.
//
// MEDIDO AQUI, y es peor de lo que parece:
//
//   la linea que VIAJA     {concept, qty, price, tax: 0, suplido: true}
//   lo que se GUARDA       {concept, qty, price, tax: 0}
//
// El `tax: 0` SI sobrevive, asi que el dinero sale bien. Lo que se pierde es la CLASIFICACION:
// una vez guardada, **una linea de suplido es indistinguible de una linea legitima al 0 %**. El
// documento no dice en ninguna parte que aquello fuera un suplido, y nadie se entera — no hay
// error, no hay aviso, no hay diferencia de euros. Por eso hacia falta una prueba que lo DIGA
// EN VOZ ALTA en vez de un hueco que nadie ve.
//
// ⛔ ESTE FICHERO NO ARREGLA NADA. Que la marca se caiga es un HALLAZGO, no un defecto que se
// tape de paso: completarla toca el camino de emision (reglas 29/38) y puede tocar el schema,
// que es dominio del fundador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ SI ESTE FICHERO TE SALE EN ROJO, LEE ESTO ANTES DE ARREGLARLO
//
// Un rojo aqui tiene DOS significados posibles y no son el mismo:
//
//   (a) SE ROMPIO ALGO. Alguien cambio sin querer lo que se guarda, y esto lo ha cazado.
//       Es el caso normal y el motivo de que exista.
//
//   (b) CAMBIO LA DECISION. El fundador decidio que la factura guarde otra cosa —por ejemplo,
//       que la marca de suplido persista, o que quepa una fecha de vencimiento—. Entonces este
//       rojo NO es un fallo: es el aviso de que **DOC-10 dejo de ser un cambio de front** y paso
//       a ser un cambio de lo que se almacena, con lo que eso arrastra (regla 29, schema, sellado).
//
// El riesgo de (b) se acepto CON LOS OJOS ABIERTOS al aprobar este ticket. Si estas en (b), lo
// que toca es actualizar esta caracterizacion Y decirlo en la entrada del master — no borrarla.
// Nadie deberia descubrir tarde que el alcance de DOC-10 cambio.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validarFacturaSuelta } from '../dist/modules/invoicing/domain/facturaSuelta.js';
import { calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';
import { hayLineasFacturables } from '../dist/modules/invoicing/domain/lineasFacturables.js';
import { cargarFrontSuplido, claves, recorrerLinea, recorrerDocumento } from './_camino-factura-suelta.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const front = cargarFrontSuplido();
const DOMINIO = { lineaParaPayload: front.lineaParaPayload, validarFacturaSuelta, calcVatBreakdown };

// La linea tal como sale del front del presupuesto (`quotesView.js`, `payloadLines.push`).
const NORMAL = { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21, suplido: false };
const SUPLIDO = { concept: 'Tasa municipal', qty: 1, price: 45, tax: 0.21, suplido: true };

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO · si el instrumento no alcanza el camino, se declara CIEGO. `scrum289b` lo alcanza,
// asi que existe: un cero aqui seria del instrumento y no del codigo.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-616 · SUELO: el instrumento alcanza el camino que guarda la factura', () => {
  assert.equal(typeof validarFacturaSuelta, 'function', '🔴 CIEGO: no tengo validarFacturaSuelta');
  assert.equal(typeof calcVatBreakdown, 'function', '🔴 CIEGO: no tengo calcVatBreakdown');
  assert.equal(typeof front.lineaParaPayload, 'function',
    '🔴 CIEGO: `quoteSuplido.js` no publico `lineaParaPayload` — sin eso no se que linea viaja');

  const r = validarFacturaSuelta({ customerId: 7, lines: [{ concept: 'x', qty: 1, price: 1, tax: 0.21 }] });
  assert.equal(r.ok, true, '🔴 CIEGO: un cuerpo valido se rechaza — no estoy midiendo el camino bueno');
  assert.ok(Array.isArray(r.lineas) && r.lineas.length === 1, '🔴 CIEGO: la validacion no devuelve lineas');
});

test('SCRUM-616 · 🔴 SUELO del SUPUESTO: entre validar y guardar no hay nada que transforme', () => {
  // Toda esta caracterizacion se apoya en que la ruta pasa `val.lineas` a `emitInvoice` y
  // `emitInvoice` lo escribe tal cual. Si eso deja de ser verdad, aqui se mide OTRA COSA — y
  // hay que enterarse por este test, no por una factura mal guardada.
  const ruta = leer('src/modules/system/app/routes/invoicesAdmin.routes.ts');
  assert.ok(ruta.split('lines: val.lineas').length - 1 === 1,
    '🔴 SUPUESTO ROTO: la ruta ya no le pasa `val.lineas` a emitInvoice tal cual. '
    + 'Esta caracterizacion mide funciones puras porque en medio no habia transformacion: '
    + 'si ahora la hay, deja de caracterizar lo guardado y hay que rehacerla contra el camino nuevo.');

  const servicio = leer('src/modules/invoicing/domain/invoicing.service.ts');
  assert.ok(servicio.split('lines: (input.lines as any) ?? undefined').length - 1 === 1,
    '🔴 SUPUESTO ROTO: `emitInvoice` ya no escribe `input.lines` tal cual en Invoice.lines.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// PUNTO 1 · LA FORMA DEL RESULTADO. Lo que queda guardado, exactamente.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-616 · lo que se guarda en Invoice.lines tiene EXACTAMENTE cuatro claves', () => {
  const r = recorrerLinea(DOMINIO, NORMAL);
  assert.equal(r.ok, true);
  assert.deepEqual(claves(r.guardado), ['concept', 'price', 'qty', 'tax'],
    `🔴 cambio la FORMA de lo que se guarda. Antes: concept, price, qty, tax. Ahora: ${claves(r.guardado).join(', ')}`);
  // Y los valores, no solo las claves: una forma correcta con el valor cambiado se guarda igual de mal.
  assert.deepEqual(r.guardado, { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 },
    '🔴 cambio lo que se guarda para una linea normal');
});

test('SCRUM-616 · el DOCUMENTO guardado: lineas, desglose y total con el que se emite', () => {
  const viajan = [NORMAL, SUPLIDO].map((l) => front.lineaParaPayload(l));
  const doc = recorrerDocumento(DOMINIO, viajan);
  assert.equal(doc.ok, true, '🔴 un documento de dos lineas validas se esta rechazando');

  assert.deepEqual(doc.guardado, [
    { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 },
    { concept: 'Tasa municipal', qty: 1, price: 45, tax: 0 },
  ], '🔴 cambio lo que se guarda en Invoice.lines');

  // El desglose por tipo, que es lo que va al PDF y al registro.
  assert.deepEqual(doc.entries, [
    { rate: 21, base: 60, cuota: 12.6 },
    { rate: 0, base: 45, cuota: 0 },
  ], '🔴 cambio el desglose por tipo de IVA');

  assert.equal(doc.base, 105, '🔴 cambio la base imponible');
  assert.equal(doc.cuota, 12.6, '🔴 cambio la cuota');
  // `.toFixed(2)` porque `Invoice.total` es Decimal(12,2) y la ruta redondea AHI.
  assert.equal(doc.total, '117.60', '🔴 cambio el TOTAL con el que se emite la factura');
  assert.equal(hayLineasFacturables(doc.guardado), true, '🔴 el porton de lineas ya no las da por facturables');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// PUNTO 2 · EL CORAZON DEL TICKET: que las claves de mas se descartan, DICHO EN VOZ ALTA.
//
// La lista esta FIJADA. No se calcula y se da por buena: si alguien anade una clave a la linea
// que viaja, el conjunto cambia y este test CAE NOMBRANDOLA. Un test que solo comprobara «se
// descarta algo» se quedaria callado justo cuando aparece una clave nueva, que es cuando hace
// falta que hable.
// ─────────────────────────────────────────────────────────────────────────────────────────
const VIAJAN_SUPLIDO = ['concept', 'price', 'qty', 'suplido', 'tax'];
const SOBREVIVEN = ['concept', 'price', 'qty', 'tax'];
const DESCARTADAS = ['suplido'];

test('SCRUM-616 · 🔴 LAS CLAVES DE MAS SE DESCARTAN EN SILENCIO — y aqui se dice cuales', () => {
  const r = recorrerLinea(DOMINIO, SUPLIDO);

  assert.deepEqual(r.claveViajan, VIAJAN_SUPLIDO,
    `🔴 cambio lo que VIAJA del front al servidor.\n  antes: ${VIAJAN_SUPLIDO.join(', ')}\n  ahora: ${r.claveViajan.join(', ')}\n`
    + '  Si has ANADIDO una clave: comprueba si sobrevive, porque hoy el servidor tira en silencio\n'
    + '  todo lo que no sea concept/qty/price/tax. Si la has QUITADO: eso es perder un dato por el camino.');

  assert.deepEqual(r.claveSobreviven, SOBREVIVEN,
    `🔴 cambio lo que SOBREVIVE hasta Invoice.lines: ${r.claveSobreviven.join(', ')}`);

  assert.deepEqual(r.claveDescartadas, DESCARTADAS,
    `🔴 cambio el conjunto de claves DESCARTADAS EN SILENCIO.\n`
    + `  antes: ${DESCARTADAS.join(', ')}\n  ahora: ${r.claveDescartadas.join(', ') || '(ninguna)'}\n`
    + '  Cada clave de esta lista es un dato que el front manda y el documento NO guarda,\n'
    + '  sin error y sin aviso. Si la lista crece, alguien acaba de perder un dato nuevo.');
});

test('SCRUM-616 · CONTROL NEGATIVO: una clave inventada tambien se descarta, y el censo la NOMBRA', () => {
  // El control va DENTRO: si el detector no supiera ver una clave que no ha visto nunca, la
  // lista fijada de arriba estaria comprobando su propio eco.
  const r = recorrerLinea(DOMINIO, { ...SUPLIDO, referenciaProveedor: 'AY-2026-0044' });
  assert.ok(r.claveDescartadas.includes('referenciaProveedor'),
    `🔴 DETECTOR CIEGO: una clave inventada no aparece como descartada. Descartadas: ${r.claveDescartadas.join(', ')}`);
  assert.deepEqual(r.claveSobreviven, SOBREVIVEN,
    '🔴 una clave inventada ha SOBREVIVIDO al validador: la frontera ya no es la que dice este test');
});

test('SCRUM-616 · CONTROL POSITIVO: con la linea completa y correcta, nada salta', () => {
  // Si esto saltara con datos buenos seria ruido, y el ruido acaba desactivado — que es como se
  // pierden las protecciones buenas.
  const r = recorrerLinea(DOMINIO, NORMAL);
  assert.equal(r.ok, true, '🔴 una linea correcta se esta rechazando');
  assert.equal(r.error, null);
  assert.deepEqual(r.claveDescartadas, [],
    `🔴 una linea NORMAL (sin marca) esta perdiendo claves: ${r.claveDescartadas.join(', ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// PUNTO 3 · EL VIAJE DE `suplido`, DE LA LINEA AL DOCUMENTO GUARDADO.
// Es el campo con nombre y apellidos del ticket, y hoy NO llega.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-616 · 🔴 `suplido` NO sobrevive el viaje — se queda el 0 %, se pierde la MARCA', () => {
  const r = recorrerLinea(DOMINIO, SUPLIDO);

  // ① El front SI la marca y SI fuerza el 0 % (esto es lo que hace `lineaParaPayload`).
  assert.equal(r.viaja.suplido, true,
    '🔴 el front ha dejado de marcar la linea como suplido: F8 se ha perdido en el ORIGEN, '
    + 'antes incluso de llegar al servidor. Es una de las ocho de SCRUM-600.');
  assert.equal(r.viaja.tax, 0,
    '🔴 el front ha dejado de forzar el 0 % en un suplido: eso es IVA sobre un importe que YA era un impuesto');

  // ② El servidor guarda el 0 %… y tira la marca.
  assert.equal(r.guardado.tax, 0, '🔴 el 0 % del suplido ya no llega al documento guardado');
  assert.equal('suplido' in r.guardado, false,
    'CARACTERIZACION: hoy la marca NO se guarda. Si esto falla es que AHORA SI se guarda — '
    + 'buena noticia, pero significa que cambio lo que se almacena (caso (b) de la cabecera).');

  // ③ 🔴 EL DANO, DICHO ENTERO: guardada, no se distingue de un 0 % legitimo.
  const legitimaAlCero = recorrerLinea(DOMINIO, { ...SUPLIDO, tax: 0, suplido: false });
  assert.deepEqual(r.guardado, legitimaAlCero.guardado,
    'CARACTERIZACION: una linea de suplido y una linea legitima al 0 % se guardan IDENTICAS. '
    + 'Si esto falla, es que ya se distinguen — y eso tambien es un cambio de lo almacenado.');
});

test('SCRUM-616 · el dinero NO cambia por perder la marca (solo cambia la clasificacion)', () => {
  // Importa decirlo: el hallazgo no es que se cobren euros de mas. Es que el documento deja de
  // saber lo que es. Confundir las dos cosas mandaria a alguien a buscar un defecto de importes.
  const conMarca = recorrerDocumento(DOMINIO, [front.lineaParaPayload(SUPLIDO)]);
  const sinMarca = recorrerDocumento(DOMINIO, [front.lineaParaPayload({ ...SUPLIDO, tax: 0, suplido: false })]);
  assert.equal(conMarca.total, sinMarca.total, '🔴 ahora la marca SI cambia el total: es otro ticket y otro riesgo');
  assert.equal(conMarca.total, '45.00', '🔴 cambio el total de un documento de un solo suplido');
});
