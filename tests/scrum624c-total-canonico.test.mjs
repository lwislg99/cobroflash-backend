// tests/scrum624c-total-canonico.test.mjs — SCRUM-624 (fase C · el arreglo)
//
// LA VÍCTIMA: Tecnosel. Su camino de facturación es albarán → factura, y era el único de los
// cuatro que guardaba un `ImporteTotal` que NO se puede reconstruir sumando su propio desglose.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL INVARIANTE, EN UNA FRASE
//
//     ImporteTotal  ===  Σ(base + cuota)   del MISMO desglose que viaja con la factura
//
// 🔒 Un total que no cuadra con su desglose no es «otro redondeo»: es un registro que se
// contradice a sí mismo, y el sistema que lo recibe lo RECHAZA (VeriFactu 1210).
//
// ⚠️ NO SE APOYA NADA en el margen de ±10 € de la AEAT: `SEMAFORO_CALIBRACION.md` §8.1 dice que
// dónde está la frontera entre el rechazo (1210) y la aceptación (2005) **es una inferencia, no
// está escrito en ninguna de las dos fuentes**. Lo que se comprueba aquí es COHERENCIA INTERNA:
// aritmética contra la estructura del registro, no interpretación de la norma.
//
// 🔴 Y LA CONVENCIÓN POR LÍNEA NO SE DEROGA. Sigue viva y gobierna el ALBARÁN. Hay un control
// negativo abajo que cae si alguien se la lleva por delante «de paso».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const codigoDe = (p) => soloCodigo(leer(p), path.basename(p));

const { calcVatBreakdown } = await import('../dist/modules/invoicing/domain/vat.service.js');
const { totalDeFacturables } = await import('../dist/modules/jobs/domain/albaranAFactura.js');
const { calcTotal } = await import('../dist/core/utils/utils.js');
const { calcAlbaranTotales } = await import('../dist/modules/jobs/domain/albaran.service.js');

/** El caso que destapó el defecto: tres líneas que arrastran céntimo. */
const LINEAS = [
  { concept: 'a', qty: 1, price: 9.99, tax: 0.21 },
  { concept: 'b', qty: 1, price: 9.99, tax: 0.21 },
  { concept: 'c', qty: 1, price: 9.99, tax: 0.21 },
];

/** Σ(base + cuota) del desglose que viaja con la factura. Es la vara de medir. */
function totalDelDesglose(lineas) {
  const bd = calcVatBreakdown(lineas);
  return { total: (bd.base + bd.cuota).toFixed(2), base: bd.base, cuota: bd.cuota };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SUELO: son CUATRO caminos, y si el censo ve menos es que no está mirando
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 EL MOTOR DE UN CAMINO SE DERIVA DE SU CÓDIGO, NO SE ESCRIBE A MANO.
 *
 * La primera versión de este fichero declaraba a mano cómo calcula cada camino. Eso comprobaba mi
 * transcripción, no el producto: al inyectar el mecanismo viejo, este test **siguió verde** y solo
 * cayó el estructural. Una tautología con pinta de invariante.
 *
 * Ahora se LEE el bloque del camino y se elige el motor que de verdad invoca.
 */
function motorDe(bloque) {
  if (/calcVatBreakdown\s*\(/.test(bloque)) return (l) => totalDelDesglose(l).total;
  if (/totalDeFacturables\s*\(/.test(bloque)) {
    return (l) => totalDeFacturables(l.map((x) => ({ cantidad: x.qty, precioUnitario: x.price, tax: x.tax })));
  }
  if (/calcTotal\s*\(/.test(bloque)) return (l) => calcTotal(l).toFixed(2);
  return null;   // no se adivina: quien lo reciba se declara ciego
}

const CAMINOS = [
  {
    nombre: 'C7-albaran · albarán → factura (el de Tecnosel)',
    donde: 'src/modules/jobs/app/routes/albaranes.routes.ts',
    ancla: 'origen: \'C7-albaran\'',
    bloque: (fuente) => {
      const fin = fuente.indexOf("origen: 'C7-albaran'");
      const ini = fuente.lastIndexOf('const invoiceLines', fin);
      return ini > 0 && ini < fin ? fuente.slice(ini, fin) : null;
    },
  },
  {
    nombre: 'albarán parcial',
    donde: 'src/modules/jobs/app/routes/albaranes.routes.ts',
    ancla: 'calcVatBreakdown(invoiceLines)',
    bloque: (fuente) => {
      const i = fuente.indexOf('calcVatBreakdown(invoiceLines)');
      return i > 0 ? fuente.slice(Math.max(0, i - 400), i + 200) : null;
    },
  },
  {
    nombre: 'recapitulativa',
    donde: 'src/modules/jobs/domain/recapitulativa.service.ts',
    ancla: '(bd.base + bd.cuota).toFixed(2)',
    bloque: (fuente) => {
      const i = fuente.indexOf('(bd.base + bd.cuota).toFixed(2)');
      return i > 0 ? fuente.slice(Math.max(0, i - 400), i + 200) : null;
    },
  },
  {
    nombre: 'presupuesto → factura',
    donde: 'src/modules/quotes/app/routes/quotes.routes.ts',
    ancla: 'calcTotal(',
    bloque: (fuente) => {
      const i = fuente.indexOf('calcTotal(');
      return i > 0 ? fuente.slice(Math.max(0, i - 300), i + 200) : null;
    },
  },
];

test('SCRUM-624c · 🔴 SUELO: el censo ve los CUATRO caminos que fijan el total', () => {
  assert.ok(CAMINOS.length >= 4,
    `🔴 el censo declara ${CAMINOS.length} caminos y se midieron CUATRO. Menos de cuatro no es ` +
    '«hay menos caminos»: es que no se está mirando.');

  const ciegos = CAMINOS.filter((c) => !codigoDe(c.donde).includes(c.ancla));
  assert.deepEqual(ciegos.map((c) => `${c.nombre} → no encuentro «${c.ancla}» en ${c.donde}`), [],
    '🔴 CIEGO: un camino declarado ya no se reconoce en el árbol. O se renombró —y este censo mide ' +
    'un fantasma— o el camino cambió de forma.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL INVARIANTE: los CUATRO caminos, uno por uno, con su número
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624c · 🔴 los CUATRO caminos guardan un total reconstruible desde su desglose', () => {
  const { total: vara, base, cuota } = totalDelDesglose(LINEAS);

  const rotos = [];
  const ciegos = [];
  for (const c of CAMINOS) {
    const bloque = c.bloque(codigoDe(c.donde));
    if (!bloque) { ciegos.push(`${c.nombre}: no acoto su bloque`); continue; }
    const motor = motorDe(bloque);
    if (!motor) { ciegos.push(`${c.nombre}: no reconozco qué motor usa`); continue; }
    const suyo = motor(LINEAS);
    if (suyo !== vara) rotos.push(`${c.nombre}: guarda ${suyo} · Σ(base+cuota) = ${vara}`);
  }

  // SUELO: «no supe leer el camino» y «el camino cuadra» son el mismo verde y significan lo
  // contrario. Un camino ilegible se declara, no se aprueba.
  assert.deepEqual(ciegos, [],
    '🔴 CIEGO: no se ha podido derivar el motor de estos caminos:\n    ' + ciegos.join('\n    ') +
    '\n\n  Si no se lee cómo calculan, este test no está midiendo el producto.');

  assert.deepEqual(rotos, [],
    '🔴 HAY UN CAMINO QUE GUARDA UN TOTAL QUE NO CUADRA CON SU PROPIO DESGLOSE:\n    ' +
    rotos.join('\n    ') +
    `\n\n  desglose de esas líneas: base ${base} + cuota ${cuota} = ${vara}\n\n` +
    '  Una factura cuyo `ImporteTotal` no se puede reconstruir sumando su desglose es un registro\n' +
    '  que se contradice a sí mismo, y el sistema que lo recibe lo RECHAZA (VeriFactu 1210).');
});

test('SCRUM-624c · 🔴 Y CAE CON EL MECANISMO VIEJO: `totalDeFacturables` daba otro número', () => {
  const vara = totalDelDesglose(LINEAS).total;
  const facturables = LINEAS.map((l) => ({ cantidad: l.qty, precioUnitario: l.price, tax: l.tax }));
  const viejo = totalDeFacturables(facturables);

  assert.equal(vara, '36.26', '🔴 la canónica ha cambiado de resultado');
  assert.equal(viejo, '36.27', '🔴 la convención por línea ha cambiado de resultado');
  assert.notEqual(viejo, vara,
    '🔴 las dos han dejado de divergir. Si es a propósito, este ticket ha avanzado y hay que ' +
    'actualizar `docs/master/SCRUM-624.md`; si no, alguien ha tocado un cálculo de dinero.');
});

test('SCRUM-624c · 🔴 el camino de Tecnosel usa la CANÓNICA, y sobre las líneas que GUARDA', () => {
  // Atado al BLOQUE del camino C7-albaran, no al fichero: en el mismo fichero vive la parcial, que
  // ya usaba `calcVatBreakdown`, así que buscar en todo el fichero daría verde sin arreglar nada.
  const fuente = codigoDe('src/modules/jobs/app/routes/albaranes.routes.ts');
  const fin = fuente.indexOf("origen: 'C7-albaran'");
  assert.ok(fin > 0, '🔴 CIEGO: no encuentro el camino `C7-albaran`');
  // Desde la construcción de sus líneas hasta su `emitInvoice`: ése es su bloque.
  const ini = fuente.lastIndexOf('const invoiceLines', fin);
  assert.ok(ini > 0 && ini < fin, '🔴 CIEGO: no acoto el bloque del camino');
  const bloque = fuente.slice(ini, fin);

  assert.ok(/calcVatBreakdown\(invoiceLines\)/.test(bloque),
    '🔴 el camino albarán→factura NO calcula su total con la canónica sobre las líneas que guarda.\n' +
    '  Tiene que salir del MISMO cálculo y los MISMOS datos que el desglose y que la cuota de la\n' +
    '  huella VeriFactu — que cuadren por construcción, no por casualidad.');
  assert.ok(!/totalDeFacturables\s*\(/.test(bloque),
    '🔴 ha vuelto `totalDeFacturables` al camino de la FACTURA. Esa convención gobierna el ALBARÁN, ' +
    'no el registro fiscal.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CONTROL NEGATIVO: la convención POR LÍNEA sigue viva en el ALBARÁN
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624c · 🔴 CONTROL NEGATIVO: el ALBARÁN sigue redondeando POR LÍNEA', () => {
  // Si al arreglar la factura se hubiera «unificado» el albarán, el defecto no se cierra: se mueve.
  const totales = calcAlbaranTotales([
    { concepto: 'a', cantidad: 1, precioUnitario: 9.99, tipoIva: 21 },
    { concepto: 'b', cantidad: 1, precioUnitario: 9.99, tipoIva: 21 },
    { concepto: 'c', cantidad: 1, precioUnitario: 9.99, tipoIva: 21 },
  ]);
  const totalAlbaran = (totales.totalCents / 100).toFixed(2);

  assert.equal(totalAlbaran, '36.27',
    '🔴 EL ALBARÁN HA CAMBIADO DE REDONDEO. Su convención es POR LÍNEA y no se deroga: un albarán ' +
    'no es un registro fiscal y sus líneas tienen que sumar A LA VISTA ' +
    '(`albaranAFactura.ts:274-278`, `albaran.service.ts:191`). Lo que se arregló fue la FRONTERA, ' +
    'no la convención.');

  // Y la frase que la declara sigue escrita donde tiene sentido.
  assert.ok(leer('src/modules/jobs/domain/albaranAFactura.ts').includes('redondeado a céntimo POR LÍNEA'),
    '🔴 se ha borrado la declaración de la convención del albarán.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA HUELLA: el total y la cuota, del MISMO cálculo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624c · 🔴 la cuota de la HUELLA sale del mismo cálculo que el total', async () => {
  const { calcVatCuotaTotal } = await import('../dist/modules/invoicing/domain/vat.service.js');
  const bd = calcVatBreakdown(LINEAS);
  assert.equal(calcVatCuotaTotal(LINEAS), bd.cuota,
    '🔴 la cuota de la huella VeriFactu y la del desglose han dejado de salir del mismo sitio. Si ' +
    'divergen, el registro vuelve a contradecirse — y esta vez entre el total y la huella.');

  // Y el total guardado por el camino de Tecnosel se reconstruye con esa misma cuota.
  assert.equal((bd.base + calcVatCuotaTotal(LINEAS)).toFixed(2), totalDelDesglose(LINEAS).total,
    '🔴 el total y la cuota de la huella ya no cuadran por construcción.');
});
