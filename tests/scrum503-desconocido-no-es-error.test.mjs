// tests/scrum503-desconocido-no-es-error.test.mjs — SCRUM-503
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// `desconocido` NO ES UN VALOR ROTO: ES UNA RESPUESTA
//
// Se creaba un cobro por MercadoPago, la pasarela no decía todavía con qué iba a pagar el cliente,
// y el sistema lo guardaba como `desconocido` — que es lo correcto: **declarar que no consta** en
// vez de inventar «suele ser tarjeta» (SCRUM-486/489). Y luego la pantalla contestaba
// «⚠️ Método no reconocido (desconocido)»: que no entendemos nuestra propia declaración, y de paso
// el valor crudo de la base delante del profesional.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SON TRES ESTADOS Y NO PUEDEN COMPARTIR SALIDA
//
//   ausencia (`null`, `''`)  → nadie registró nada                  → «⚠️ Sin método»
//   `desconocido`            → SE PREGUNTÓ y consta que no se sabe  → «⚠️ Método sin especificar»
//   fuera de `PAID_VIA`      → alguien escribió algo que no existe   → «⚠️ Método no reconocido (x)»
//
// El tercero **se queda como está**: es un defecto real y tiene que verse como tal, con su valor
// dentro para poder investigarlo (SCRUM-398). Los tres por líneas distintas o se pierde un hecho —
// es la misma distinción que separó el MÉTODO del REGISTRO en SCRUM-491.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE FICHERO NO DA POR BUENO
//
//   · **Que exista la entrada no prueba que llegue.** El camino se comprueba entero —quién lo
//     ESCRIBE, quién lo LEE y quién lo PINTA—, no solo la puerta.
//   · **Que las tres pantallas coincidan hoy** no prueba que lean de un sitio: se exige que las
//     tres pasen por `metodoDeUnCobro` (SCRUM-499).
//   · **Que el paquete de disputa siga CRUDO**: ahí el valor es prueba ante un banco, y traducirlo
//     rompería lo que SCRUM-499 dejó decidido.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const DICCIONARIO = 'public/dashboard/js/paidViaEtiquetas.js';
const DOMINIO_METODO = 'src/modules/billing/domain/metodoDeCobro.ts';
const RUTA_COBROS = 'src/modules/billing/app/routes/charges.routes.ts';
const PASARELA_MP = 'src/integrations/mercadopago.ts';
const RUTA_DISPUTA = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';

// ── LAS FUENTES, tal y como corren ───────────────────────────────────────────────────────────
const { ETIQUETAS_HEREDADAS, ETIQUETAS_PAID_VIA, etiquetaMetodoCobro } =
  require_(path.join(RAIZ, DICCIONARIO));
const { metodoDeUnCobro, cuboDeCobro, CUBO_SIN_METODO, ROTULO_SIN_METODO, METODO_DESCONOCIDO,
  esMetodoValido, metodoDesdePreferencia, metodoDesdeMercadoPago } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
const { PAID_VIA } = await import('../dist/modules/billing/domain/paidVia.js');
const { filasDelInforme } = await import('../dist/modules/reports/domain/cobrosPorCubo.js');
const { fundirCobros } = await import('../dist/modules/billing/domain/cobros.service.js');

/** El texto APROBADO (regla 30). Se escribe una vez y se compara literal. */
const TEXTO_APROBADO = '⚠️ Método sin especificar';

/** Lo que lee el profesional en INFORMES para esa fila. */
const pintada = (fila) => etiquetaMetodoCobro(fila.method);
const factura = (paidVia, total, id = 1) => ({
  id, createdAt: new Date('2026-08-12T10:00:00Z'), total, currency: 'EUR', status: 'paid',
  number: `F-${id}`, paidVia,
});

/**
 * LOS TRES ESTADOS, declarados con su significado. Es el corpus del ticket: si alguno se cae de
 * aquí, el censo de abajo compara de menos y no lo diría nadie.
 */
const ESTADOS = [
  { que: 'ausencia', valores: [null, '', '   ', undefined], esperado: /^⚠️ Sin método$/ },
  { que: 'desconocido declarado', valores: [METODO_DESCONOCIDO], esperado: /^⚠️ Método sin especificar$/ },
  { que: 'fuera del conjunto', valores: ['card:paypal', 'mp', 'lo_que_sea'], esperado: /^⚠️ Método no reconocido \(/ },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — va primero: un cero tiene que salir por una línea distinta de «no hay defecto»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-503 · SUELO: se leen el diccionario, el conjunto y los tres estados', () => {
  assert.equal(typeof METODO_DESCONOCIDO, 'string',
    '🔴 ESCÁNER CIEGO: no se lee `METODO_DESCONOCIDO`. Todo lo de abajo compararía contra `undefined`.');
  assert.equal(METODO_DESCONOCIDO, 'desconocido',
    `🔴 el valor declarado ha cambiado a «${METODO_DESCONOCIDO}»: re-mide antes de fiarte del diccionario.`);
  assert.ok(Object.keys(ETIQUETAS_HEREDADAS).length >= 3,
    `🔴 ESCÁNER CIEGO: los heredados traen ${Object.keys(ETIQUETAS_HEREDADAS).length} entradas.`);
  assert.equal(ESTADOS.length, 3, '🔴 el corpus ya no declara los tres estados.');
  assert.equal(ESTADOS.reduce((a, e) => a + e.valores.length, 0), 8,
    '🔴 el corpus ha encogido: se estaría midiendo de menos.');
  // Control positivo del instrumento: traduce de verdad antes de que se compare nada.
  assert.equal(etiquetaMetodoCobro('card'), '💳 Tarjeta');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① ¿HAY VÍCTIMA? — quién ESCRIBE `desconocido`, medido, no supuesto
// ═════════════════════════════════════════════════════════════════════════════════════════

/** ¿Este fichero LLAMA a alguno de los productores? Del AST: un import sin uso no escribe nada. */
function llamaA(codigo, nombreFichero, fn) {
  const sf = ts.createSourceFile(nombreFichero, codigo, ts.ScriptTarget.Latest, true);
  let llama = false;
  (function rec(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === fn) llama = true;
    ts.forEachChild(n, rec);
  })(sf);
  return llama;
}

test('SCRUM-503 · ① SUELO + AUTOPRUEBA: el detector de llamadas ve y DISCRIMINA', () => {
  assert.equal(llamaA('const m = metodoDesdePreferencia(p);', 'x.ts', 'metodoDesdePreferencia'), true,
    '🔴 el detector no ve la llamada escrita delante de sus narices.');
  assert.equal(llamaA("import { metodoDesdePreferencia } from './x';", 'x.ts', 'metodoDesdePreferencia'), false,
    '🔴 el detector da por buena una IMPORTACIÓN sin llamada: mencionar no es hacer, y un productor '
    + 'sin llamante no produce nada.');
});

test('SCRUM-503 · ① 🔴 HAY VÍCTIMA: dos caminos VIVOS escriben `desconocido` hoy', () => {
  // 🔴 Sin productor no habría víctima y este ticket se caería (regla 37). Se comprueba por los DOS
  // instrumentos: qué devuelven las funciones, y que alguien las llame de verdad.
  assert.equal(metodoDesdePreferencia('mp'), METODO_DESCONOCIDO,
    '🔴 la preferencia `mp` ha dejado de declararse desconocida. MercadoPago es una PASARELA, no un '
    + 'método: si esto devuelve `card`, se está inventando el dato más probable (regla 22).');
  assert.equal(metodoDesdeMercadoPago(null), METODO_DESCONOCIDO,
    '🔴 un pago de MP sin `payment_type_id` ya no se declara desconocido.');

  const escritores = [
    { fichero: RUTA_COBROS, fn: 'metodoDesdePreferencia' },
    { fichero: PASARELA_MP, fn: 'metodoDesdeMercadoPago' },
  ];
  const mudos = escritores
    .filter(({ fichero, fn }) => !llamaA(fs.readFileSync(path.join(RAIZ, fichero), 'utf8'), fichero, fn))
    .map(({ fichero }) => fichero);
  assert.deepEqual(mudos, [],
    `🔴 UN PRODUCTOR SE HA QUEDADO SIN LLAMANTE: ${mudos.join(' · ')}. Si ya nadie escribe ` +
    '`desconocido`, este ticket dejó de tener víctima y su entrada del diccionario sobra — pero eso ' +
    'se decide midiendo, no dejándola por si acaso.');

  // Y NO está en `PAID_VIA`: por eso su etiqueta va en los HEREDADOS y el conjunto no se amplía.
  assert.equal((PAID_VIA).includes(METODO_DESCONOCIDO), false,
    '🔴 `desconocido` ha entrado en `PAID_VIA`. Es cambio de la regla 22 y de master, no de este ticket.');
  assert.equal(esMetodoValido(METODO_DESCONOCIDO), false,
    '🔴 `esMetodoValido` acepta el desconocido: dejaría de ser una declaración para ser un método.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② CONTROL POSITIVO — el desconocido se lee como lo que es
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-503 · ② 🔴 CONTROL POSITIVO: `desconocido` se lee «⚠️ Método sin especificar»', () => {
  assert.equal(etiquetaMetodoCobro(METODO_DESCONOCIDO), TEXTO_APROBADO,
    `🔴 la pantalla dice «${etiquetaMetodoCobro(METODO_DESCONOCIDO)}» de una respuesta que el ` +
    'sistema declaró a propósito. El texto está aprobado (regla 30) y se compara literal.');
  assert.equal(ETIQUETAS_HEREDADAS[METODO_DESCONOCIDO], TEXTO_APROBADO);
  // La entrada va en los HEREDADOS, no en el conjunto cerrado: si sube arriba, el guard de
  // SCRUM-398 cae por «etiquetas para valores que NO están en el conjunto».
  assert.equal(ETIQUETAS_PAID_VIA[METODO_DESCONOCIDO], undefined,
    '🔴 la entrada se ha metido en el conjunto cerrado: eso tumba el guard de SCRUM-398.');

  // Y LLEGA A LA FILA del informe por el camino de verdad, no solo al diccionario.
  const [fila] = filasDelInforme([factura(METODO_DESCONOCIDO, '80.00')]).byMethod;
  assert.equal(pintada(fila), TEXTO_APROBADO,
    `🔴 la fila del informe se pinta «${pintada(fila)}»: la entrada existe y no llega. Que un ` +
    'diccionario tenga la clave no prueba que la pantalla pase por ella.');
  assert.equal(fila.eur, 80, '🔴 el importe no ha llegado entero a su fila.');
});

test('SCRUM-503 · ② las TRES pantallas leen el MISMO valor, por `metodoDeUnCobro` (SCRUM-499)', () => {
  const f = factura(METODO_DESCONOCIDO, '80.00');

  // ① INFORMES · ② COBROS · ③ el paquete de disputa — cada una por su puerta real.
  const [fila] = filasDelInforme([f]).byMethod;
  const [cobro] = fundirCobros({ charges: [], candidatas: [f], invoiced: [] });
  const enDisputa = metodoDeUnCobro(f) ?? ROTULO_SIN_METODO;

  assert.equal(fila.method, METODO_DESCONOCIDO, '🔴 INFORMES no conserva el valor declarado.');
  assert.equal(cobro.metodo, METODO_DESCONOCIDO, '🔴 COBROS no conserva el valor declarado.');
  assert.equal(enDisputa, METODO_DESCONOCIDO, '🔴 el paquete de disputa no conserva el valor declarado.');

  // El CUBO también coincide: el desconocido no es un método, así que cae en «sin método» en las
  // dos pantallas que agrupan — y ahí NO se confunde con nada porque su rótulo lo dice.
  assert.equal(fila.cubo, CUBO_SIN_METODO);
  assert.equal(cobro.metodoCubo, fila.cubo,
    `🔴 COBROS lo pone en «${cobro.metodoCubo}» e INFORMES en «${fila.cubo}».`);

  // 🔴 EL PAQUETE DE DISPUTA NO TRADUCE, y eso es de SCRUM-499: ahí el valor es PRUEBA ante un
  // banco. Si esto empieza a devolver un rótulo, se ha roto lo que aquel ticket dejó decidido.
  assert.notEqual(enDisputa, TEXTO_APROBADO,
    '🔴 el paquete de evidencia de disputa ha empezado a TRADUCIR el método. Ahí va crudo a ' +
    'propósito: es lo que el banco cruza, y un rótulo no se puede cotejar con nada.');
  const disputa = fs.readFileSync(path.join(RAIZ, RUTA_DISPUTA), 'utf8');
  assert.doesNotMatch(disputa, /etiquetaMetodoCobro|Método sin especificar/,
    '🔴 el paquete de disputa ha empezado a traducir el método con el vocabulario de la pantalla.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 CONTROL NEGATIVO — EL QUE DECIDE: los tres estados, por líneas distintas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-503 · ③ 🔴 los TRES estados salen por LÍNEAS DISTINTAS, y ninguno pisa a otro', () => {
  // Si dos comparten salida se ha perdido un hecho: «nadie lo registró», «se preguntó y no consta»
  // y «alguien escribió algo que no existe» son tres cosas, y el profesional decide distinto con
  // cada una.
  const salidas = new Map();
  for (const { que, valores, esperado } of ESTADOS) {
    for (const v of valores) {
      const etiqueta = etiquetaMetodoCobro(v);
      assert.match(etiqueta, esperado,
        `🔴 «${JSON.stringify(v)}» (${que}) se lee «${etiqueta}», que no es la línea de su estado.`);
      salidas.set(que, [...(salidas.get(que) ?? []), etiqueta]);
    }
  }
  // Y las tres líneas son DISTINTAS entre sí, no solo cada una la suya.
  const representantes = [...salidas.values()].map((v) => v[0]);
  assert.equal(new Set(representantes).size, 3,
    `🔴 DOS ESTADOS COMPARTEN SALIDA: ${JSON.stringify(representantes)}. Se ha perdido un hecho — ` +
    'y el que se pierde siempre es el del medio, porque «se preguntó y no consta» se parece a los ' +
    'otros dos y no es ninguno.');

  // 🔴 EL TERCERO SE QUEDA COMO ESTABA: es un defecto real y tiene que verse, con su valor dentro.
  assert.equal(etiquetaMetodoCobro('card:paypal'), '⚠️ Método no reconocido (card:paypal)',
    '🔴 se ha tocado la salida del valor fuera del conjunto. Ése SÍ es un error y así se ve: quien ' +
    'lo lea tiene que poder investigarlo (SCRUM-398).');
  assert.equal(etiquetaMetodoCobro(''), '⚠️ Sin método',
    '🔴 se ha tocado la salida de la AUSENCIA. `null` y `desconocido` no son lo mismo: en el ' +
    'segundo SÍ hay constancia, y lo que consta es que no se sabe.');
});

test('SCRUM-503 · ③ 🔴 ROJO POR EL MECANISMO: devolver el desconocido al camino del error se ve', () => {
  // Se provoca sobre una COPIA del mapa —sin tocar el fichero, restaurando en `finally`— y se
  // comprueba que el censo lo caza Y que el mensaje dice qué se ha roto. Un guard que dice «algo
  // cambió» sin decir qué obliga a repetir la medición entera.
  const original = ETIQUETAS_HEREDADAS[METODO_DESCONOCIDO];
  try {
    delete ETIQUETAS_HEREDADAS[METODO_DESCONOCIDO];   // ← vuelve a caer en «no reconocido»
    const etiqueta = etiquetaMetodoCobro(METODO_DESCONOCIDO);
    assert.match(etiqueta, /no reconocido/,
      '🔴 el mecanismo no es el que se cree: quitar la entrada tenía que devolverlo al camino del ' +
      'error, y no lo hace. Entonces el verde de arriba no significa lo que parece.');
    const mensaje = `🔴 LA PANTALLA TRATA COMO ERROR UNA RESPUESTA QUE EL PROFESIONAL NOS DIO: ` +
      `«${METODO_DESCONOCIDO}» se lee «${etiqueta}». No es un valor roto — es una declaración ` +
      '(«se preguntó y no consta»), y contestarle que no la reconocemos es decirle que no ' +
      'entendemos su propia respuesta, con el valor crudo de la base delante.';
    assert.match(mensaje, /desconocido/);
    assert.match(mensaje, /no reconocido/, '🔴 el mensaje no trae lo que se pinta de verdad.');
    // Y los tres estados dejan de ser tres: dos comparten camino.
    assert.equal(etiquetaMetodoCobro(METODO_DESCONOCIDO).startsWith('⚠️ Método no reconocido'), true);
  } finally {
    ETIQUETAS_HEREDADAS[METODO_DESCONOCIDO] = original;   // el módulo está cacheado
  }
  assert.equal(etiquetaMetodoCobro(METODO_DESCONOCIDO), TEXTO_APROBADO,
    '🔴 no se ha restaurado el diccionario: el resto de la tanda mediría un mapa envenenado.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL INVARIANTE — un rótulo no mueve dinero
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-503 · ④ 🔴 EL INVARIANTE: total, importe y cubos idénticos antes y después', () => {
  const banco = [
    { charge: { method: 'card' }, total: '100.00' },
    { charge: { method: METODO_DESCONOCIDO }, total: '40.00' },
    factura(METODO_DESCONOCIDO, '80.00', 3),
    factura(null, '25.00', 4),
    factura('transfer', '300.00', 5),
  ];
  const { byMethod, marcadosAMano } = filasDelInforme(banco);

  // Control positivo dentro: con un banco vacío todo esto sumaría 0 y pasaría sin medir.
  assert.ok(byMethod.length >= 3, `🔴 el banco produce ${byMethod.length} filas: no se mide nada.`);
  assert.equal(byMethod.reduce((a, f) => a + f.count, 0), banco.length,
    '🔴 se han perdido o duplicado cobros al cambiar un RÓTULO.');
  assert.equal(byMethod.reduce((a, f) => a + Math.round(f.eur * 100), 0), 54500,
    '🔴 EL TOTAL DEL INFORME HA CAMBIADO. Un texto no puede mover dinero de sitio.');
  // Y el pie de SCRUM-499 sigue contando lo suyo: las tres facturas sin `Charge`.
  assert.equal(marcadosAMano.count, 3, '🔴 el pie de «marcado a mano» ha cambiado con un rótulo.');

  // 🔴 Y el CUBO no se mueve: el desconocido y la ausencia siguen en «sin método», que es donde
  // estaban. Cambiar cómo se llama una cosa no puede cambiar en qué cubo cae ni cuánto suma.
  for (const v of [METODO_DESCONOCIDO, null, '', '   ']) {
    assert.equal(cuboDeCobro(v), CUBO_SIN_METODO,
      `🔴 «${JSON.stringify(v)}» ha cambiado de cubo al ponerle nombre.`);
  }
  // ⚠️ Y el tercer estado NO cae ahí, que es un contraste medido y no un descuido: `card:paypal`
  // agrupa en `card` porque `cuboDeCobro` SÍ parte por «:» y `card` está en el conjunto —la
  // pasarela es libre (SCRUM-474)—, mientras que el diccionario NO parte y por eso su etiqueta
  // suelta dice «no reconocido». O sea que en el informe esa fila viaja con el representante del
  // cubo y se lee «💳 Tarjeta»; el «no reconocido» se ve donde el método base tampoco existe.
  assert.equal(cuboDeCobro('card:paypal'), 'card',
    '🔴 `card:paypal` ha dejado de agrupar con las tarjetas: eso sí movería dinero de sitio.');
  assert.equal(etiquetaMetodoCobro('card:paypal'), '⚠️ Método no reconocido (card:paypal)');
  const [soloPaypal] = filasDelInforme([factura('card:paypal', '10.00')]).byMethod;
  assert.equal(pintada(soloPaypal), '💳 Tarjeta',
    '🔴 ha cambiado cómo se lee una pasarela nueva en el informe. Va por el representante de su ' +
    'cubo (SCRUM-488), no por su etiqueta suelta: re-mide antes de tocar nada.');
  const desconocidos = byMethod.filter((f) => f.metodos.includes(METODO_DESCONOCIDO));
  assert.equal(desconocidos.length, 1,
    '🔴 los dos cobros con método declarado desconocido se han separado en filas distintas.');
  assert.equal(Math.round(desconocidos[0].eur * 100), 12000,
    '🔴 la fila del desconocido no suma sus dos cobros.');
});
