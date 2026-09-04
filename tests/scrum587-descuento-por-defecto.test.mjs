// tests/scrum587-descuento-por-defecto.test.mjs — SCRUM-587 (CONT-14)
//
// Sin gate: piezas puras. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DESCUENTO PACTADO CON EL CLIENTE, PROPUESTO — NUNCA APLICADO SOLO
//
// LA VÍCTIMA: el profesional con un 10 % acordado con un administrador de fincas hoy tiene que
// ACORDARSE y teclearlo en cada presupuesto. El día que se le olvida factura de más y lo descubre
// cuando el cliente se queja; o factura de menos y no lo descubre nunca.
//
// ── 🔴 LOS DOS TESTS QUE DECIDEN ESTÁN LOS PRIMEROS ─────────────────────────────────────────
// ① Un cliente SIN descuento pactado tiene que dar EXACTAMENTE los mismos céntimos que antes de
//    este ticket. ② Cambiar el descuento del cliente NO puede mover un presupuesto YA CREADO.
// El ② no es cortesía: un valor por defecto que reescribe documentos existentes es SCRUM-729 con
// otra cara, y ése está abierto en Highest precisamente por esto.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
// El orden importa: la pieza del 587 LEE la aritmética del 594 y se niega a funcionar sin ella.
const D594 = require_(path.join(RAIZ, 'public/dashboard/js/quoteDescuentos.js'));
const P = require_(path.join(RAIZ, 'public/dashboard/js/descuentoPorDefecto.js'));

const cliente = (dto) => ({ id: 1, name: 'Administración Fincas Soler', dtoPorDefecto: dto });
const LINEAS = [
  { concept: 'Mano de obra', qty: 4, price: 35, vat: 21 },
  { concept: 'Material', qty: 1, price: 120, vat: 21 },
];
const centimos = (lineas) => D594.totalesConDescuento(lineas, null).totalCents;

// ═══ ① EL CLIENTE SIN DESCUENTO: NADA CAMBIA ═════════════════════════════════════════════

test('SCRUM-587 · 🔴 un cliente SIN descuento pactado da los MISMOS céntimos que hoy', () => {
  const base = centimos(LINEAS);
  for (const sin of [null, undefined, '']) {
    assert.equal(P.propuestaPara(cliente(sin)), null,
      `🔴 con \`dtoPorDefecto = ${JSON.stringify(sin)}\` se está proponiendo algo. «No hay `
      + 'descuento pactado» se acaba de convertir en un descuento.');
    assert.equal(P.hayPropuesta(cliente(sin)), false);
    assert.equal(centimos(P.aplicarA(LINEAS, P.propuestaPara(cliente(sin)))), base,
      '🔴 el total ha cambiado para un cliente sin descuento: este ticket acaba de mover dinero '
      + 'de un profesional que no pactó nada.');
  }
  // Y un cliente que no existe todavía —el selector vacío— tampoco propone.
  assert.equal(P.propuestaPara(null), null);
  assert.equal(P.propuestaPara(undefined), null);
});

test('SCRUM-587 · 🔴 un 0 % PACTADO consta, y aun así no mueve un céntimo', () => {
  // `null` = «no hay acuerdo» · `0` = «se pactó expresamente un 0 %». La columna es NULLABLE Y SIN
  // DEFAULT justo para poder distinguirlos; si aquí se colapsaran, la columna sobraría.
  assert.equal(P.propuestaPara(cliente(0)), 0,
    '🔴 un 0 % pactado se está leyendo como «no consta»: se ha perdido la diferencia que la '
    + 'columna nullable existe para guardar.');
  assert.notEqual(P.propuestaPara(cliente(0)), P.propuestaPara(cliente(null)),
    '🔴 «pactó un 0 %» y «no pactó nada» están dando el mismo resultado.');
  assert.equal(P.hayPropuesta(cliente(0)), false);
  assert.equal(centimos(P.aplicarA(LINEAS, 0)), centimos(LINEAS));
  // Y no escribe la clave: una línea sin descuento sigue siendo el MISMO objeto de siempre.
  assert.equal(Object.prototype.hasOwnProperty.call(P.aplicarA(LINEAS, 0)[0], 'dto'), false,
    '🔴 se ha colado un `dto: 0` en la línea. El criterio del 594 es que la clave NO VIAJA.');
});

// ═══ ② EL PRESUPUESTO YA CREADO NO SE TOCA ═══════════════════════════════════════════════

test('SCRUM-587 · 🔴 cambiar el descuento del cliente NO mueve un presupuesto YA CREADO', () => {
  // `Quote.lines` es una columna **Json**: una instantánea congelada al crear. El documento no
  // vuelve a preguntarle nada al cliente, y por eso el acuerdo puede cambiar mañana sin reescribir
  // el pasado. Aquí se EJECUTA: se guardan las líneas, se cambia el cliente, se recalcula.
  const guardadas = P.aplicarA(LINEAS, P.propuestaPara(cliente(10)));
  const totalAlGuardar = centimos(guardadas);

  for (const nuevo of [25, 0, null, 100]) {
    // El acuerdo con el cliente cambia…
    const despues = cliente(nuevo);
    assert.equal(P.propuestaPara(despues), nuevo === null ? null : nuevo);
    // …y el documento ya creado sigue valiendo lo mismo, porque se recalcula de SUS líneas.
    assert.equal(centimos(guardadas), totalAlGuardar,
      `🔴 al pasar el descuento del cliente a ${nuevo} se ha movido un presupuesto ya creado. `
      + 'Eso es SCRUM-729 con otra cara.');
  }
  // Y las líneas guardadas no las ha tocado nadie: `aplicarA` devuelve copias, no muta.
  assert.deepEqual(LINEAS[0], { concept: 'Mano de obra', qty: 4, price: 35, vat: 21 },
    '🔴 `aplicarA` ha MUTADO el array que recibió: el documento de origen se ha modificado solo.');
});

// ═══ ③ EL 10 % SE PROPONE, Y SE PUEDE QUITAR O CAMBIAR ═══════════════════════════════════

test('SCRUM-587 · 🔴 un 10 % pactado se PROPONE, y el profesional puede QUITARLO o CAMBIARLO', () => {
  const c = cliente(10);
  assert.equal(P.propuestaPara(c), 10);
  assert.equal(P.hayPropuesta(c), true);
  assert.equal(P.alcanceDe(LINEAS, 10), 2, '🔴 la propuesta no alcanza a las dos líneas');

  const conPropuesta = P.aplicarA(LINEAS, 10);
  assert.equal(conPropuesta[0].dto, 10);
  assert.ok(centimos(conPropuesta) < centimos(LINEAS), '🔴 el 10 % no ha rebajado nada');

  // QUITARLO: el profesional no acepta. Nadie ha llamado a `aplicarA`, y el total es el de siempre.
  assert.equal(centimos(LINEAS), centimos(LINEAS));
  // CAMBIARLO: acepta pero pone otro número.
  const conOtro = P.aplicarA(LINEAS, 5);
  assert.equal(conOtro[0].dto, 5);
  assert.ok(centimos(conOtro) > centimos(conPropuesta),
    '🔴 bajar la propuesta del 10 % al 5 % no ha subido el total: el número que el profesional '
    + 'escribe no está mandando sobre el pactado.');
});

test('SCRUM-587 · 🔴 la propuesta NO pisa el descuento que el profesional ya tecleó', () => {
  // Un 15 % escrito a mano en UNA línea es más reciente y más específico que el acuerdo general.
  const conSuyo = [{ ...LINEAS[0], dto: 15 }, LINEAS[1]];
  const r = P.aplicarA(conSuyo, 10);
  assert.equal(r[0].dto, 15,
    '🔴 la propuesta ha pisado el 15 % que el profesional acababa de escribir.');
  assert.equal(r[1].dto, 10, '🔴 la línea que NO tenía descuento propio no ha recibido la propuesta');
  assert.equal(P.alcanceDe(conSuyo, 10), 1, '🔴 el alcance no distingue las líneas ya tocadas');
});

// ═══ ④ SUELO Y CONTROLES ═════════════════════════════════════════════════════════════════

test('SCRUM-587 · 🔴 SUELO: si el censo de clientes con descuento sale vacío, esto falla', () => {
  // Sin este suelo, todas las afirmaciones de arriba podrían ser ciertas sobre un conjunto vacío
  // — el modo favorito de este repo de estar verde sin mirar nada.
  const POBLACION = [0, 5, 10, 21.5, 33.33, 100].map(cliente);
  const conDescuento = POBLACION.filter((c) => P.hayPropuesta(c));
  assert.ok(conDescuento.length > 0,
    `🔴 CENSO VACÍO: de ${POBLACION.length} clientes, NINGUNO da propuesta. O la lectura del `
    + 'valor por defecto está rota, o este test lleva rato aprobando la nada.');
  assert.equal(conDescuento.length, 5,
    '🔴 el censo ha cambiado de tamaño: sólo el 0 % debe quedarse fuera de «hay propuesta».');
  // Y los dos decimales del `dto` de la línea: un 33,33 % tiene que sobrevivir entero.
  assert.equal(P.propuestaPara(cliente(33.33)), 33.33,
    '🔴 se están perdiendo decimales del porcentaje pactado: el valor propuesto no pasaría el '
    + 'validador de la línea en la que va a aterrizar.');
});

test('SCRUM-587 · ✅ CONTROL NEGATIVO: renombrar rótulos NO toca el cálculo', () => {
  // El cálculo depende del DATO, no de cómo se llame el campo en pantalla. Si un cambio de texto
  // pudiera tumbar esto, el guard estaría atado al rótulo y no al dinero — y el rótulo, además,
  // todavía no está firmado.
  const antes = P.aplicarA(LINEAS, P.propuestaPara(cliente(10)));
  const conOtrosRotulos = {
    id: 1, name: 'OTRO NOMBRE', legalName: 'Y OTRO', internalRef: 'REF-9', dtoPorDefecto: 10,
  };
  assert.equal(P.propuestaPara(conOtrosRotulos), 10);
  assert.equal(centimos(P.aplicarA(LINEAS, P.propuestaPara(conOtrosRotulos))), centimos(antes),
    '🔴 cambiar textos del cliente ha movido el total: el cálculo está atado a un rótulo.');
});

test('SCRUM-587 · 🔴 esta pieza NO reimplementa la aritmética del 594, y lo dice si falta', () => {
  // Un segundo cálculo de descuento es el modo de que uno de los dos se quede atrás. Se comprueba
  // por el MECANISMO: sin `quoteDescuentos`, esto tiene que negarse a responder, no improvisar.
  const previo = globalThis.quoteDescuentos;
  try {
    delete globalThis.quoteDescuentos;
    assert.throws(() => P.propuestaPara(cliente(10)), /quoteDescuentos/,
      '🔴 sin el módulo del 594 la pieza ha seguido dando un número: se ha escrito una segunda '
      + 'aritmética del dinero.');
  } finally {
    globalThis.quoteDescuentos = previo;
  }
  assert.equal(P.propuestaPara(cliente(10)), 10, '🔴 no se ha restaurado el módulo del 594');
});
