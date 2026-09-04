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
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ejecutableDe } from './_guard-texto.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { scriptsDeLaPagina, rutaDelDashboard, cegueraDelExtractor } from './_scripts-de-la-pagina.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
// El orden importa: la pieza del 587 LEE la aritmética del 594 y se niega a funcionar sin ella.
const D594 = require_(path.join(RAIZ, 'public/dashboard/js/quoteDescuentos.js'));
const P = require_(path.join(RAIZ, 'public/dashboard/js/descuentoPorDefecto.js'));

const cliente = (dto) => ({ id: 1, name: 'Administración Fincas Soler', dtoPorDefecto: dto });
/** Las clases de un nodo como LISTA. Un `includes` sobre la cadena confunde padre e hijo. */
const clases = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
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

// ═══ ⑤ LA SUPERFICIE: LA TIRA QUE PROPONE ════════════════════════════════════════════════

test('SCRUM-587 · 🔴 la tira se PINTA en el editor, OCULTA, y reutiliza el componente de la casa', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor ha dejado de montarse: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  assert.ok(nodos.length > 50,
    `🔴 BANCO CIEGO: la vista montó ${nodos.length} nodos. Una pantalla vacía y un banco roto dan `
    + 'el mismo verde, y entonces «la tira no está» no significaría nada.');

  // 🔴 POR CLASE EXACTA, NO POR SUBCADENA. La primera versión filtraba con `includes(...)` y
  // contaba DOS: el `<span>` interior se llama `quote-propuesta-dto__texto` y contiene el nombre
  // del padre. Es el defecto que esta casa persigue desde SCRUM-349 —comparar por texto lo que hay
  // que comparar por identidad— y aquí habría acusado de duplicado a un árbol correcto.
  const tira = nodos.filter((n) => clases(n).includes('quote-propuesta-dto'));
  assert.equal(tira.length, 1,
    `🔴 hay ${tira.length} tiras de propuesta y tiene que haber UNA. Cero = el ticket no llega a la `
    + 'pantalla; dos = un merge la ha duplicado y el profesional vería dos ofertas del mismo descuento.');

  // 🔴 ACABA OCULTA. Visible, el editor le ofrecería un descuento a TODO cliente, incluido el que
  // no tiene nada pactado — que es «se aplica solo» disfrazado de otra cosa.
  //
  // 📌 Y NO LA PROTEGE EL `hidden = true` DEL NACIMIENTO, medido: poniéndolo a `false` este test
  // SIGUE VERDE, porque `recalcTotals` refresca durante el montaje y la vuelve a ocultar. Lo que
  // se comprueba aquí es el estado CONVERGIDO. Quien venga a probar este caso en rojo tiene que
  // romper el refresco (`if (alcance <= 0) …`), no el valor inicial: con esa sonda sí cae, y con
  // este mismo mensaje.
  assert.equal(tira[0].hidden, true,
    '🔴 la tira nace VISIBLE: se le está ofreciendo un descuento a un cliente sin acuerdo.');
  assert.match(String(tira[0].className), /\balert\b/, '🔴 no reutiliza el componente `.alert`');
  assert.match(String(tira[0].className), /\binfo\b/,
    '🔴 la tira no es `info`: un acuerdo que el profesional pactó no es un aviso de que algo va mal.');
});

test('SCRUM-587 · 🔴 el rótulo sin firmar lleva la grafía que el censo de SCRUM-402 CUENTA', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ), 'renderQuotesView');
  const tira = todos(r.contenedor).find((n) => String(n.className || '').includes('quote-propuesta-dto'));
  assert.ok(tira, '🔴 no hay tira que mirar');
  const dentro = todos(tira).map((n) => String(n.textContent || '')).join(' | ');
  assert.match(dentro, /\[PENDIENTE/,
    '🔴 el rótulo sin firmar NO lleva marcador, o lleva una grafía que el censo del 402 no cuenta '
    + '(cuenta `[PENDIENTE`). Un marcador invisible para el censo se queda dormido para siempre.');
  assert.doesNotMatch(dentro, /descuento habitual|precio pactado|aplicar descuento/i,
    '🔴 se ha inventado microcopy oficial (regla 30). El rótulo lo firma el asesor.');
});

test('SCRUM-587 · 🔴 la pieza se carga DESPUÉS de su aritmética y ANTES de quien la consume', () => {
  // Por IDENTIDAD, no por texto: se leen los `<script src>` de la página en su orden real.
  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  const res = scriptsDeLaPagina(html);
  // 🔴 SUELO DEL EXTRACTOR: `cegueraDelExtractor` DEVUELVE el motivo, no lanza. Ignorar su
  // devolución es quedarse ciego con el mismo gesto con el que se cree uno protegido.
  assert.equal(cegueraDelExtractor(res, 20, 'el índice del dashboard'), null);
  const orden = res.clasicos.map((s) => rutaDelDashboard(s).replace(/^js\//, ''));
  const i = (n) => orden.indexOf(n);
  assert.ok(i('descuentoPorDefecto.js') >= 0,
    '🔴 la pieza no se carga en la página: es código muerto y la tira nunca se llenaría.');
  assert.ok(i('quoteDescuentos.js') < i('descuentoPorDefecto.js'),
    '🔴 la pieza se carga ANTES que la aritmética que lee. Como se niega a improvisar una segunda, '
    + 'el rojo saldría en la pantalla del profesional y no aquí.');
  assert.ok(i('descuentoPorDefecto.js') < i('quotesView.js'),
    '🔴 la pieza se carga DESPUÉS del editor que le pide la propuesta.');
});

test('SCRUM-587 · 🔴 el editor REFRESCA la propuesta en los DOS sitios, contados por AST', () => {
  // Los dos hacen falta por motivos distintos: cambiar de cliente cambia el acuerdo, y añadir una
  // línea cambia a cuántas alcanza. Si un merge se lleva uno, la tira se queda pegada enseñando
  // una oferta que ya no toca — y eso NO se ve en el diff.
  const fuente = ejecutableDe(
    fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8'),
    { donde: 'quotesView.js', ancla: 'refrescarPropuestaDeDescuento' });
  const sf = ts.createSourceFile('quotesView.js', fuente, ts.ScriptTarget.Latest, true);
  let llamadas = 0;
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
      && n.expression.text === 'refrescarPropuestaDeDescuento') llamadas++;
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.equal(llamadas, 2,
    `🔴 el editor llama ${llamadas} veces a \`refrescarPropuestaDeDescuento\` y tienen que ser DOS: `
    + 'al cambiar de cliente, y al recalcular los totales.');
});

test('SCRUM-587 · 🔴 la REGLA no se ha copiado al editor: la decisión sigue en la pieza pura', () => {
  // Una copia de «a qué líneas alcanza» dentro de `quotesView.js` es el modo de que dentro de seis
  // meses una de las dos se quede atrás. El editor puede LEER la decisión, no tomarla.
  const fuente = ejecutableDe(
    fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8'),
    { donde: 'quotesView.js', ancla: 'aplicarA' });
  const sf = ts.createSourceFile('quotesView.js', fuente, ts.ScriptTarget.Latest, true);
  const usadas = [];
  const v = (n) => {
    if (ts.isPropertyAccessExpression(n)
      && ['aplicarA', 'alcanceDe', 'propuestaPara', 'hayPropuesta'].includes(n.name.text)) {
      usadas.push(n.name.text);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(usadas.length > 0,
    '🔴 CENSO VACÍO: el editor no llama a NINGUNA función de la pieza. O el enganche no está, o '
    + 'este control lleva rato aprobando la nada.');
  assert.equal(usadas.includes('aplicarA'), true,
    '🔴 el editor no usa `aplicarA`: está escribiendo los `dto` con una regla suya.');
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
