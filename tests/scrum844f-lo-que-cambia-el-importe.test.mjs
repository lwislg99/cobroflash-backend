// tests/scrum844f-lo-que-cambia-el-importe.test.mjs — SCRUM-844 · puesto 6
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LOS CUATRO QUE QUEDABAN, Y POR QUÉ SON LOS CUATRO QUE QUEDABAN.
//
// El puesto 6 de SCRUM-844 tenía siete funciones. Medidas hoy una a una por mutación, la mayoría
// de sus puntos YA los caza alguien: `scrum294` el recargo y el criterio de caja, `scrum293` la
// retención, `scrum500` la marca de suplido, `scrum289b` el IVA fuera de rango, `scrum780` la
// vista previa sin secuencia. Main se movió seis días y la lista con él.
//
// Lo que sobrevivía tiene una forma común, y no es casualidad: en los cuatro, el test que
// existe prueba el caso AUSENTE (`null`, `undefined`, falta el dato) y deja sin probar el caso
// PRESENTE PERO IMPOSIBLE — el `NaN`, el objeto que no es objeto, el número negativo, el decimal
// donde iba un entero.
//
// > Una guarda suele nacer mirando lo que falta. Lo que llega roto entra por la misma puerta y
// > casi nunca tiene su propio caso.
//
// ⛔ Este fichero NO toca `src/`. Cada caso se probó EN ROJO inyectando el punto exacto,
//    recompilando, y restaurando fuente y `dist/` byte a byte (`Buffer.compare === 0`).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';

const { clasificarPorCobro } = await import('../dist/modules/invoicing/domain/criterioCaja.js');
const { leerMarcaSuplido, MARCA_SUPLIDO } = await import('../dist/modules/invoicing/domain/suplidos.js');
const { validarFacturaSuelta, ERROR_LINEAS_INVALIDAS } =
  await import('../dist/modules/invoicing/domain/facturaSuelta.js');
const { vistaPreviaSerie } = await import('../dist/modules/invoicing/domain/vistaPreviaSerie.js');
const { CORTE_FORMATO_F } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1 · 🔴 LA CUOTA QUE NO ES UN NÚMERO — `clasificarPorCobro`
//
// De aquí sale la cuota que se declara por criterio de caja. La guarda exige `typeof === 'number'`
// Y `Number.isFinite`, y la segunda mitad es la que no se probaba: `NaN` e `Infinity` SON de tipo
// `number`, así que pasan la primera. Un `NaN` que entre en `cobrados` envenena la suma entera
// (`x + NaN === NaN`) y la declaración sale sin un número.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844f · SUELO: la clasificación separa cobrado de no cobrado con datos buenos', () => {
  const r = clasificarPorCobro([
    { numero: 'A', estado: 'paid', cuota: 21 },
    { numero: 'B', estado: 'sent', cuota: 10 },
  ]);
  assert.equal(r.cuotaCobrada, 21, '🔴 el banco no clasifica: lo de abajo no mediría nada');
  assert.equal(r.cuotaNoCobrada, 10);
  assert.deepEqual(r.sinCuota, []);
});

test('SCRUM-844f · 🔴 una cuota `NaN` no entra en la suma: se declara como ilegible', () => {
  const r = clasificarPorCobro([
    { numero: 'A', estado: 'paid', cuota: 21 },
    { numero: 'ENVENENADA', estado: 'paid', cuota: NaN },
  ]);
  assert.deepEqual(r.sinCuota, ['ENVENENADA'],
    '🔴 un `NaN` ha pasado por cuota. `typeof NaN === "number"`, así que la primera mitad de la '
    + 'guarda lo deja entrar; sin `Number.isFinite` acaba en `cobrados`.');
  assert.equal(r.cuotaCobrada, 21,
    `🔴 la cuota cobrada salió ${r.cuotaCobrada}. Un solo NaN convierte la suma entera en NaN y `
    + 'la declaración por criterio de caja se queda literalmente sin número.');
});

test('SCRUM-844f · 🔴 una cuota `Infinity` tampoco cuela (es la otra mitad de `isFinite`)', () => {
  const r = clasificarPorCobro([{ numero: 'INFINITA', estado: 'paid', cuota: Infinity }]);
  assert.deepEqual(r.sinCuota, ['INFINITA'], '🔴 `Infinity` ha entrado como cuota declarable');
  assert.equal(r.cuotaCobrada, 0);
  assert.equal(r.miradas, 1, '🔴 `miradas` tiene que contar la fila aunque no se pueda clasificar');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 2 · 🔴 UNA LÍNEA QUE NO ES UNA LÍNEA — `leerMarcaSuplido`
//
// Los suplidos salen de la base imponible, así que leer mal esta marca mueve dinero de sitio.
// `scrum500` ya cubre la marca ILEGIBLE (un `'sí'` en vez de un booleano). Lo que no se probaba
// es la línea que no es un objeto: un `'texto'` o un `42` no tienen propiedades, así que
// `linea[MARCA_SUPLIDO]` sale `undefined` y eso se lee como «línea normal, no es suplido» —
// un veredicto tranquilo sobre algo que nadie ha podido leer.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844f · 🔴 una línea que NO es un objeto se declara ILEGIBLE, no «no es suplido»', () => {
  for (const basura of ['una línea', 42, true, Symbol('x')]) {
    const r = leerMarcaSuplido(basura);
    assert.equal(r.ok, false,
      `🔴 \`${String(basura)}\` (${typeof basura}) se ha leído como línea válida y ha salido `
      + '«no es suplido». Sin propiedades, la marca sale `undefined` y el «no» es indistinguible '
      + 'del de una línea normal de verdad.');
  }
});

test('SCRUM-844f · ✅ y una línea de verdad SÍ se lee (los tres desenlaces siguen separados)', () => {
  assert.deepEqual(leerMarcaSuplido({ concept: 'Tasa', [MARCA_SUPLIDO]: true }), { ok: true, suplido: true });
  assert.deepEqual(leerMarcaSuplido({ concept: 'Mano de obra' }), { ok: true, suplido: false });
  assert.equal(leerMarcaSuplido({ [MARCA_SUPLIDO]: 'sí' }).ok, false);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 3 · 🔴 UN PRECIO NEGATIVO EN UNA FACTURA SUELTA — `validarFacturaSuelta`
//
// `scrum289b` ya rechaza el IVA fuera de rango y la cantidad ≤ 0. El precio negativo no tenía
// caso: una línea a −100 € pasa la validación, entra en la factura y sale como un descuento que
// nadie ha autorizado. En una factura SUELTA —la que se escribe a mano, sin presupuesto detrás—
// no hay ningún otro sitio donde ese signo se compruebe.
//
// ⚠️ El cero SÍ es legítimo (una línea informativa a 0,00 €), así que el corte es `< 0` y no
//    `<= 0`: los dos casos van juntos porque separarlos es justo lo que se puede romper.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const cuerpo = (linea) => ({ customerId: 1, lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21, ...linea }] });

test('SCRUM-844f · SUELO: una factura suelta correcta se acepta', () => {
  const r = validarFacturaSuelta(cuerpo({}));
  assert.equal(r.ok, true, `🔴 el banco bueno se rechaza (${r.error}): los rechazos de abajo `
    + 'saldrían verdes sobre una validación que dice que no a todo');
  assert.equal(r.lineas[0].price, 100);
});

test('SCRUM-844f · 🔴 un PRECIO NEGATIVO se rechaza, con su error nombrado', () => {
  const r = validarFacturaSuelta(cuerpo({ price: -100 }));
  assert.equal(r.ok, false,
    '🔴 una línea a −100,00 € entra en una factura suelta. Es un descuento que no ha autorizado '
    + 'nadie, en el único documento que no tiene un presupuesto detrás que lo respalde.');
  assert.equal(r.error, ERROR_LINEAS_INVALIDAS,
    `🔴 se rechaza, pero con otro error (${r.error}): quien lo reciba mirará donde no es`);
});

test('SCRUM-844f · ✅ EL BORDE: un precio de 0,00 € SÍ se acepta (el corte es `< 0`, no `<= 0`)', () => {
  const r = validarFacturaSuelta(cuerpo({ price: 0 }));
  assert.equal(r.ok, true,
    '🔴 una línea a 0,00 € se rechaza. Es legítima —una línea informativa, un concepto incluido— '
    + 'y prohibirla obliga a inventar un céntimo para poder facturar.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 4 · 🔴 UNA SECUENCIA QUE NO ES UN ENTERO — `vistaPreviaSerie`
//
// Esta es la pantalla de última oportunidad: enseña el número que va a salir antes de confirmar.
// `scrum780` cubre que sin `seqF` LANZA en vez de adivinar. Lo que no se probaba es un `seqF`
// presente pero imposible: un `2.5` o un `NaN` pasan `!= null` y `>= 1`, y entonces la pantalla
// promete `F262.5` — un número que no existe y que el profesional confirma creyendo que sabe
// qué confirma.
//
// 🔒 La fecha del caso se deriva de `CORTE_FORMATO_F`, no se escribe a mano: el día que el corte
//    se mueva, este test tiene que seguir cayendo del lado nuevo, no del que tenía el calendario
//    cuando se escribió.
//
// ── ⚠️ LA TRAMPA, CAZADA AL PROBAR EL ROJO Y NO ANTES ─────────────────────────────────────────
//
// La primera versión de estos dos casos decía `assert.throws(fn, RangeError)` y **pasaba en
// verde con la guarda arrancada**. Medido: sin `Number.isInteger`, `formatInvoiceNumber` lanza
// SU PROPIO `RangeError` cuarenta líneas más abajo («secuencia inválida: 2.5»). El tipo de error
// es el mismo, así que el test no distinguía una puerta de la otra.
//
// > Un test escrito a la ligera puede pasar en verde habiendo probado otra puerta. (SCRUM-844)
//
// Por eso aquí se exige el MENSAJE de ESTA guarda. Y el hallazgo se queda escrito, porque vale
// más que el test: este punto está **defendido en profundidad**: aunque se caiga la guarda de
// arriba, la de abajo sigue impidiendo que se componga un número falso. Lo que se pierde no es
// la protección, es el mensaje que dice QUÉ HACER —«deriva la secuencia con `leerSeqDeLaSerieF`»—
// a cambio de uno genérico que manda a mirar donde no es.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const TRAS_EL_CORTE = new Date(CORTE_FORMATO_F.desde.getTime() + 24 * 3600 * 1000);
const PAR = { invoiceSeriesYear: 2026, nextInvoiceNumber: 6 };

test('SCRUM-844f · SUELO: tras el corte, con una secuencia buena, la vista previa compone', () => {
  const n = vistaPreviaSerie(null, PAR, 2026, false, TRAS_EL_CORTE, 1);
  assert.match(n, /^F\d{2}\d{4}$/,
    `🔴 la vista previa no produce el formato F tras el corte: ${n}. Si el caso bueno ya no pasa `
    + 'por aquí, los rechazos de abajo no están midiendo esta rama.');
});

/** El que para el paso es ÉSTE, no el de `formatInvoiceNumber`: se mira por su frase. */
const esLaGuardaDeLaVistaPrevia = (e) => {
  assert.ok(e instanceof RangeError, `🔴 no lanzó un RangeError sino ${e?.constructor?.name}`);
  assert.match(e.message, /^vistaPreviaSerie: tras el corte hace falta `seqF`/,
    '🔴 se ha parado, pero NO en la guarda de la vista previa: el mensaje es otro '
    + `(«${e.message.slice(0, 60)}…»). Con esta comprobación por TIPO el test salía verde `
    + 'habiendo probado la guarda de `formatInvoiceNumber`, que está cuarenta líneas más abajo '
    + 'y manda al profesional a mirar donde no es.');
  return true;
};

test('SCRUM-844f · 🔴 un `seqF` DECIMAL no compone un número: para AQUÍ, y lo dice', () => {
  assert.throws(
    () => vistaPreviaSerie(null, PAR, 2026, false, TRAS_EL_CORTE, 2.5),
    esLaGuardaDeLaVistaPrevia,
    '🔴 con `seqF = 2.5` la pantalla enseña un número de factura con decimales. Pasa `!= null` y '
    + 'pasa `>= 1`: lo único que lo para es `Number.isInteger`.',
  );
});

test('SCRUM-844f · 🔴 un `seqF` NaN tampoco cuela (ni `>= 1` ni `!= null` lo paran)', () => {
  assert.throws(
    () => vistaPreviaSerie(null, PAR, 2026, false, TRAS_EL_CORTE, NaN),
    esLaGuardaDeLaVistaPrevia,
    '🔴 `NaN` ha compuesto un número de factura',
  );
});

test('SCRUM-844f · ✅ ANTES del corte no se exige `seqF` (la exigencia es de la serie nueva)', () => {
  const antes = new Date(CORTE_FORMATO_F.desde.getTime() - 24 * 3600 * 1000);
  const n = vistaPreviaSerie(null, PAR, 2026, false, antes, null);
  assert.ok(n && !n.startsWith('F'),
    `🔴 una factura anterior al corte está pidiendo la secuencia de la serie nueva (salió ${n}). `
    + 'Eso renumeraría hacia atrás, que es lo que la regla 29 prohíbe.');
});
