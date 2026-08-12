// tests/scrum481-metodo-en-castellano.test.mjs — SCRUM-481
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA HABLABA DOS IDIOMAS, Y LO VIO EL FUNDADOR EN LA SUYA
//
// La columna MÉTODO pintaba `c.metodo` TAL CUAL: `card:stripe`, `card`, `transfer`. Tres
// centímetros más arriba las pestañas del filtro decían «Bizum · tarjeta · transferencia ·
// efectivo · Método no registrado», en castellano y aprobadas el 10-ago.
//
// Y el agravante nació con SCRUM-474: arreglado el filtro, el profesional pulsa «tarjeta» y las
// filas que le salen dicen `card`. Antes el filtro también fallaba, así que la incoherencia no se
// veía — arreglar una mitad destapó la otra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL RÓTULO SALE DEL MISMO SITIO QUE LA PESTAÑA, Y DESDE LA FASE 2 ESE SITIO ES EL SERVIDOR
//
// `cubosDeMetodo` (derivado de `PAID_VIA`) manda los rótulos en el arranque, y `cuboDeCobro` dice
// en qué cubo cae cada cobro (`c.metodoCubo`). La columna CONSUME los dos: no es que columna y
// pestaña se parezcan, es que es el mismo dato. Por eso las fixtures de aquí derivan su
// `metodoCubo` de `cuboDeCobro` importada de `dist` — una fixture escrita a mano se queda atrás en
// cuanto el serializador cambia, y entonces el test mide una pantalla que ningún navegador pinta.
//
// El SUELO local (`cuboDeMetodo` + `COBROS_METODOS`) se ejerce aquí abajo en sus dos escenarios
// reales: arranque sin cubos, y fila sin `metodoCubo` servida por el Service Worker.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ MICROCOPY APROBADA (asesor + fundador, 11 y 12-ago-2026)
//   FORMATO:  <método> · <calificador>   EJEMPLOS: «tarjeta · Stripe» «tarjeta» «transferencia»
//   LOS DOS BIZUM:  bizum_auto → «Bizum · automático» · bizum_manual → «Bizum · manual»
//   SIN CALIFICADOR: solo el método. NUNCA «tarjeta · » con nada detrás.
//   NO RESUELTO: «Método no registrado», el rótulo que YA existe en las pestañas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { redNormal } from './_banco-red.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const VISTA = 'public/dashboard/js/cobrosView.js';
const {
  COBROS_METODOS, COBROS_SIN_METODO, COBROS_PASARELAS, COBROS_MATICES,
  COBROS_DESCONOCIDO,   // SCRUM-506 · el segundo hecho del cubo «sin método»
  cuboDeMetodo, rotuloDeMetodo, pasarelaDeMetodo,
} = require_(path.join(RAIZ, VISTA));

// El SERVIDOR: lo que corre, no una copia. `cuboDeCobro` es lo que `camposDeMetodo` pone en cada
// fila; `cubosDeMetodo` es lo que `/admin/me` deja en `window.appCobrosCubos`.
const { cuboDeCobro, cubosDeMetodo, ROTULO_SIN_METODO } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
const { PAID_VIA } = await import('../dist/modules/billing/domain/paidVia.js');

const CUBOS_DEL_ARRANQUE = cubosDeMetodo(ROTULO_SIN_METODO);

/** Un cobro como lo serializa el servidor: el crudo AL LADO del cubo derivado, nunca a mano. */
const cobro = (id, metodo) => ({
  origen: 'charge', id, fecha: '2026-08-01T10:00:00.000Z', cliente: `Cliente ${id}`,
  concepto: 'Trabajo', importe: '100.00', moneda: 'EUR', metodo, metodoCubo: cuboDeCobro(metodo),
  estado: 'paid', referencia: null, numero: null, tipo: null, invoiceId: null, chargeId: id,
});

/** El rótulo tal y como lo compone la pantalla en producción: con cubo y cubos del servidor. */
const rotulo = (metodo) => rotuloDeMetodo(metodo, cuboDeCobro(metodo), CUBOS_DEL_ARRANQUE);

const filas = (n) => todos(n).filter((x) => x.className === 'cell-client').length;

/** Los textos de la columna MÉTODO, leídos de la tabla pintada. */
function celdasDeMetodo(nodo) {
  return todos(nodo).filter((x) => x.tagName === 'TD' && x.className === 'col-hide-mobile')
    .map((x) => x.textContent);
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-481 · SUELO: la vista publica lo que este fichero mide, o no mide nada', () => {
  for (const [n, v] of Object.entries({ rotuloDeMetodo, pasarelaDeMetodo, cuboDeMetodo })) {
    assert.equal(typeof v, 'function', `🔴 la vista no publica \`${n}\`.`);
  }
  assert.ok(Array.isArray(COBROS_METODOS) && COBROS_METODOS.length >= 4,
    `🔴 solo se leen ${COBROS_METODOS?.length} cubos: el corpus derivado de abajo sería un puñado.`);
  assert.equal(COBROS_SIN_METODO.rotulo, 'Método no registrado',
    '🔴 el rótulo de «no consta» no es el aprobado, y es el que usa la columna cuando no resuelve.');
  // Y el SERVIDOR: si el arranque no trae cubos, media docena de tests de abajo medirían el suelo
  // creyendo que miden el camino normal.
  assert.ok(CUBOS_DEL_ARRANQUE.length >= 5,
    `🔴 el arranque trae ${CUBOS_DEL_ARRANQUE.length} cubos: no es lo que sirve \`/admin/me\`.`);
  assert.equal(cuboDeCobro('card:stripe'), 'card',
    '🔴 el clasificador del servidor no clasifica: las fixtures de aquí nacerían mal derivadas.');
});

// ── EL CONTROL POSITIVO ──────────────────────────────────────────────────────────────────────

test('SCRUM-481 · 🔴 `card:stripe` y `card` se leen en castellano Y caen bajo la misma pestaña', async () => {
  assert.equal(rotulo('card:stripe'), 'tarjeta · Stripe',
    '🔴 la columna sigue sin hablar castellano en el caso que vio el fundador.');
  assert.equal(rotulo('card'), 'tarjeta');
  assert.equal(cuboDeCobro('card:stripe'), cuboDeCobro('card'),
    '🔴 los dos se leen igual pero NO filtran igual: la pantalla volvería a decir dos cosas.');

  // Y en la pantalla de verdad, pintada: los datos entran por el `fetch` del banco de SCRUM-362.
  const b = cargarDashboard(RAIZ, { red: redNormal([cobro(1, 'card:stripe'), cobro(2, 'card')]) });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta: ${r.error && r.error.message}`);
  const celdas = celdasDeMetodo(r.contenedor);
  assert.deepEqual(celdas, ['tarjeta · Stripe', 'tarjeta'],
    `🔴 la columna pinta ${JSON.stringify(celdas)}. El profesional pulsa «tarjeta» y las filas le ` +
    'contestan en el idioma de la base de datos.');
});

// ── 🔴 LOS DOS BIZUM: LA DISTINCIÓN QUE VIVE EN LA FILA ───────────────────────────────────────

test('SCRUM-481 · 🔴 `bizum_auto` y `bizum_manual` se leen DISTINTO, y filtran igual', async () => {
  // 🔴 «Filtrar por cuatro, leer los cinco» (`cobrosView.js`, `COBROS_METODOS`) es una frase que
  // solo es cierta si la FILA los distingue. `paidVia.ts:17`: «uno lo confirma una PERSONA, el otro
  // un WEBHOOK. Son dos cadenas de evidencia distintas ante una inspección». Con los dos leyéndose
  // «Bizum», ese comentario explicaría un mecanismo inexistente — peor que ningún comentario.
  assert.equal(rotulo('bizum_auto'), 'Bizum · automático');
  assert.equal(rotulo('bizum_manual'), 'Bizum · manual');
  assert.notEqual(rotulo('bizum_auto'), rotulo('bizum_manual'),
    '🔴 LOS DOS BIZUM SE LEEN IGUAL. La distinción de evidencia —persona frente a webhook— vivía ' +
    'justo en esta columna y aquí es donde se ha perdido.');
  assert.equal(cuboDeCobro('bizum_auto'), cuboDeCobro('bizum_manual'),
    '🔴 y sin embargo el filtro los separa: el diseño nombra CUATRO métodos, no cinco.');

  const b = cargarDashboard(RAIZ, {
    red: redNormal([cobro(1, 'bizum_auto'), cobro(2, 'bizum_manual')]),
  });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta: ${r.error && r.error.message}`);
  assert.deepEqual(celdasDeMetodo(r.contenedor), ['Bizum · automático', 'Bizum · manual'],
    '🔴 en la pantalla pintada los dos Bizum no se distinguen.');
});

test('SCRUM-481 · 🔴 dos métodos del MISMO cubo nunca se leen igual en la fila', () => {
  // El guard que sobrevive a este ticket: si mañana `PAID_VIA` estrena un `bizum_x` y cae en el
  // cubo «Bizum» sin grafía aprobada, se leería «Bizum» igual que otro — y la distinción se
  // perdería EN SILENCIO, que es como se perdió la primera vez. Esto lo pone en rojo.
  for (const cubo of COBROS_METODOS) {
    if (cubo.casa.length < 2) continue;
    const leidos = cubo.casa.map((v) => rotulo(v));
    assert.equal(new Set(leidos).size, cubo.casa.length,
      `🔴 el cubo «${cubo.clave}» tiene ${cubo.casa.length} métodos y solo ` +
      `${new Set(leidos).size} rótulo(s) distinto(s): ${JSON.stringify(leidos)}. Dos hechos ` +
      'distintos con el mismo nombre en una pantalla de dinero. Si el valor nuevo es legítimo, su ' +
      'grafía se aprueba y entra en `COBROS_MATICES`; no se resuelve dejándolos indistinguibles.');
  }
});

test('SCRUM-481 · el rótulo se DERIVA: todo el corpus, sin lista a mano', () => {
  // El corpus sale de `COBROS_METODOS` y `COBROS_MATICES`, no se escribe. Si mañana nace un
  // método, entra solo.
  let comprobados = 0;
  for (const cubo of COBROS_METODOS) {
    for (const valor of cubo.casa) {
      const matiz = COBROS_MATICES[valor];
      const esperado = matiz ? `${cubo.rotulo} · ${matiz}` : cubo.rotulo;
      assert.equal(rotulo(valor), esperado,
        `🔴 «${valor}» debería leerse «${esperado}» y se lee «${rotulo(valor)}».`);
      comprobados++;
      for (const [pas, marca] of Object.entries(COBROS_PASARELAS)) {
        // La ranura es UNA: con matiz de la casa gana el matiz, sin él va la marca. Nunca dos.
        const conPasarela = matiz ? `${cubo.rotulo} · ${matiz}` : `${cubo.rotulo} · ${marca}`;
        assert.equal(rotulo(`${valor}:${pas}`), conPasarela,
          `🔴 «${valor}:${pas}» no compone el rótulo aprobado.`);
        comprobados++;
      }
    }
  }
  assert.ok(comprobados >= 15,
    `🔴 solo se han comprobado ${comprobados} combinaciones: el corpus derivado se ha quedado corto ` +
    'y este test estaría dando un verde barato.');
});

test('SCRUM-481 · la pasarela se escribe como su marca, y sale de la partición declarada', () => {
  assert.equal(pasarelaDeMetodo('card:stripe'), 'stripe');
  assert.equal(pasarelaDeMetodo('CARD:Stripe'), 'stripe', '🔴 no normaliza como `metodoSinPasarela`.');
  assert.equal(pasarelaDeMetodo('card'), null, '🔴 se inventa una pasarela donde no la hay.');
  assert.equal(pasarelaDeMetodo('card:'), null, '🔴 `card:` no tiene pasarela: `partirMetodo` lo rechaza.');
  assert.equal(rotulo('card:mercadopago'), 'tarjeta · MercadoPago',
    '🔴 la marca no se escribe como la escribe ella. «Mercadopago» no es su nombre.');
});

// ── 🔴 EL CONTRATO NUEVO: EL CUBO Y EL RÓTULO LOS MANDA EL SERVIDOR ───────────────────────────

test('SCRUM-481 · 🔴 el rótulo del cubo lo manda el SERVIDOR, no una tabla de esta vista', () => {
  // Si la vista tuviera su propia tabla ganadora, cambiar el rótulo en el servidor dejaría la
  // columna diciendo lo de antes mientras la pestaña de al lado ya dice lo nuevo: el defecto de
  // este ticket, reconstruido. Se comprueba con un rótulo que NO existe en el front.
  const inventado = [{ clave: 'card', rotulo: 'ROTULO-DEL-SERVIDOR', orden: 1 }];
  assert.equal(rotuloDeMetodo('card:stripe', 'card', inventado), 'ROTULO-DEL-SERVIDOR · Stripe',
    '🔴 la columna ignora el rótulo que manda el servidor y usa el suyo.');
});

test('SCRUM-481 · 🔴 el cubo que decide el SERVIDOR gana al cálculo local', () => {
  // `c.metodoCubo` es contra lo que compara el filtro (`visibles()`). Si la columna dedujera el
  // suyo, una fila podría leerse «tarjeta» y no salir al pulsar «tarjeta».
  assert.equal(rotuloDeMetodo('card', 'cash', CUBOS_DEL_ARRANQUE), 'efectivo',
    '🔴 la columna recalcula el cubo por su cuenta en vez de usar el del servidor: columna y ' +
    'filtro pueden volver a discrepar sobre el mismo cobro.');
});

test('SCRUM-481 · los rótulos del servidor y el suelo local dicen LO MISMO', () => {
  // El suelo solo vale si dice lo mismo que el camino normal: si divergen, el profesional leería
  // una cosa con arranque y otra sin él, sobre el mismo cobro.
  for (const cubo of COBROS_METODOS) {
    const delServidor = CUBOS_DEL_ARRANQUE.find((c) => c.clave === cubo.clave);
    assert.ok(delServidor, `🔴 el servidor no sirve el cubo «${cubo.clave}» que esta vista conoce.`);
    assert.equal(delServidor.rotulo, cubo.rotulo,
      `🔴 el cubo «${cubo.clave}» se llama «${delServidor.rotulo}» en el servidor y «${cubo.rotulo}» ` +
      'en el suelo de la vista. Con arranque diría una cosa y sin arranque otra.');
  }
  const sinMetodo = CUBOS_DEL_ARRANQUE.find((c) => c.clave === COBROS_SIN_METODO.clave);
  assert.equal(sinMetodo?.rotulo, COBROS_SIN_METODO.rotulo,
    '🔴 «no consta» no se llama igual en el servidor que en la vista.');
});

test('SCRUM-481 · 🔴 SUELO: sin cubos del arranque la columna SIGUE en castellano', async () => {
  // Escenario real: `/admin/me` viejo o caído. La barra de filtros se queda en «Todos» —decisión
  // de SCRUM-474 fase 2, y allí es la correcta— pero la COLUMNA no puede callarse: el método del
  // cobro ya vino en la respuesta. Decir «Método no registrado» de 51 cobros con método conocido
  // es la mentira que ese cubo existe para no contar.
  assert.equal(rotuloDeMetodo('card:stripe', 'card', []), 'tarjeta · Stripe');
  assert.equal(rotuloDeMetodo('bizum_manual', 'bizum', undefined), 'Bizum · manual');

  const b = cargarDashboard(RAIZ, {
    red: redNormal([cobro(1, 'card:stripe'), cobro(2, 'transfer')]), cobrosCubos: [],
  });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta sin cubos: ${r.error && r.error.message}`);
  const celdas = celdasDeMetodo(r.contenedor);
  assert.deepEqual(celdas, ['tarjeta · Stripe', 'transferencia'],
    `🔴 sin cubos del arranque la columna pinta ${JSON.stringify(celdas)}: o el valor crudo, o un ` +
    '«no consta» falso sobre cobros cuyo método sí consta.');
});

test('SCRUM-481 · 🔴 SUELO: una fila SIN `metodoCubo` se lee igual de bien', async () => {
  // El Service Worker sirve respuestas guardadas ANTES del despliegue: filas con `metodo` y sin
  // `metodoCubo`. Sin suelo, todas se leerían «Método no registrado» teniendo método.
  assert.equal(rotuloDeMetodo('card:stripe', undefined, CUBOS_DEL_ARRANQUE), 'tarjeta · Stripe');
  assert.equal(rotuloDeMetodo('bizum_auto', '', CUBOS_DEL_ARRANQUE), 'Bizum · automático');

  const viejo = { ...cobro(1, 'transfer') };
  delete viejo.metodoCubo;
  const b = cargarDashboard(RAIZ, { red: redNormal([viejo]) });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta: ${r.error && r.error.message}`);
  assert.deepEqual(celdasDeMetodo(r.contenedor), ['transferencia'],
    '🔴 una respuesta guardada por el Service Worker antes del despliegue deja la columna muda o ' +
    'mintiendo, y el profesional no tiene forma de saber que está viendo eso.');
});

// ── 🔴 EL CONTROL NEGATIVO, Y PROTEGE EL DINERO ──────────────────────────────────────────────

test('SCRUM-481 · 🔴 un método NO reconocido no desaparece y no se cuela en otro cubo', async () => {
  // Censo de huérfanos de SCRUM-473 §2 y §5. Un cobro que desaparece de una pantalla de dinero es
  // peor que uno mal etiquetado: el profesional cuenta lo que ve.
  //
  // 🔴 SCRUM-506 · `desconocido` SALE DE ESTA LISTA, y el guard se APRIETA al sacarlo. Estaba aquí
  // con los huérfanos de verdad —valores que nadie reconoce— y no lo es: es una declaración del
  // sistema («se preguntó y no consta»), así que tiene rótulo propio. Lo que este control negativo
  // protege NO era el texto: era que ninguno DESAPAREZCA ni se cuele en otro cubo. Eso sigue igual
  // para los dos grupos, y ahora se exige ADEMÁS que sus rótulos NO se confundan entre sí.
  const HUERFANOS = ['bank', 'mp', 'bizum', 'SCTinst', 'card:', '', null, 42];
  for (const h of HUERFANOS) {
    assert.equal(rotulo(h), COBROS_SIN_METODO.rotulo,
      `🔴 «${String(h)}» se lee «${rotulo(h)}» en vez de «${COBROS_SIN_METODO.rotulo}».`);
    assert.equal(cuboDeCobro(h), COBROS_SIN_METODO.clave,
      `🔴 «${String(h)}» se cuela en el cubo «${cuboDeCobro(h)}»: el profesional lo contaría como ` +
      'un método que no es.');
  }

  // EL DESCONOCIDO DECLARADO: mismo cubo —una sola pestaña, SCRUM-506— y rótulo DISTINTO.
  assert.equal(cuboDeCobro(COBROS_DESCONOCIDO.valor), COBROS_SIN_METODO.clave,
    '🔴 el desconocido declarado ha cambiado de cubo: eso sería una pestaña nueva en el filtro y ' +
    'ampliar el conjunto cerrado (regla 22), que NO es lo que hace SCRUM-506.');
  assert.equal(rotulo(COBROS_DESCONOCIDO.valor), COBROS_DESCONOCIDO.rotulo,
    `🔴 el desconocido declarado se lee «${rotulo(COBROS_DESCONOCIDO.valor)}»: vuelve a decir que ` +
    'no consta nada cuando lo que consta es que no se sabe.');
  assert.notEqual(COBROS_DESCONOCIDO.rotulo, COBROS_SIN_METODO.rotulo,
    '🔴 los dos hechos han vuelto a compartir rótulo dentro del mismo cubo: un hueco y un dato ' +
    'leyéndose igual.');

  // Y siguen EN LA LISTA: no se cae ninguna fila.
  const datos = ['bank', 'mp', null, 'card:'].map((m, i) => cobro(i + 1, m));
  const b = cargarDashboard(RAIZ, { red: redNormal(datos) });
  const r = await pintarVista(b, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la vista revienta: ${r.error && r.error.message}`);
  assert.equal(filas(r.contenedor), datos.length,
    `🔴 SE HAN PERDIDO COBROS: ${filas(r.contenedor)} filas de ${datos.length}. Un cobro que ` +
    'desaparece de una pantalla de dinero es la mentira por omisión que este bloque persigue.');
});

test('SCRUM-481 · 🔴 NUNCA se pinta «tarjeta · » colgando, ni la cadena vacía, ni el valor crudo', () => {
  const CORPUS = [...COBROS_METODOS.flatMap((c) => c.casa), 'card:', 'transfer:', ':stripe', ':',
    'card:stripe', 'card:revolut', 'bank', '', '   ', null, undefined, 42, {},
    // 🔸 La herencia del prototipo: `COBROS_PASARELAS['constructor']` es truthy y se concatenaba,
    // así que esto pintaba «tarjeta · function Object() { [native code] }». Medido en este ticket.
    'card:constructor', 'card:__proto__', 'card:toString', 'constructor', '__proto__'];
  for (const v of CORPUS) {
    const r = rotulo(v);
    assert.equal(typeof r, 'string', `🔴 «${String(v)}» produce ${typeof r}, no un rótulo.`);
    assert.notEqual(r.trim(), '', `🔴 «${String(v)}» produce la cadena VACÍA: la celda queda muda.`);
    assert.doesNotMatch(r, /·\s*$/,
      `🔴 «${String(v)}» produce «${r}»: un separador colgando sin nada detrás. La microcopy ` +
      'aprobada lo prohíbe expresamente.');
    assert.doesNotMatch(r, /:/,
      `🔴 «${String(v)}» produce «${r}», que lleva el «:» del valor de la base dentro.`);
    assert.doesNotMatch(r, /function|\[native code\]|\[object/i,
      `🔴 «${String(v)}» produce «${r}»: eso es fontanería de JavaScript colada por la herencia ` +
      'del prototipo, pintada en una celda de dinero.');
  }
});

test('SCRUM-481 · 🔴 SUELO: si la partición resuelve a un cubo SIN rótulo, no se cae al valor crudo', () => {
  // 🔴 ESTE TEST SE AÑADIÓ PORQUE LA MUTACIÓN NO DABA ROJO. Cambiando el suelo por
  // `return String(metodo)` —o sea, «si no sé el rótulo, enseña el valor de la base por si
  // acaso»— los tests seguían VERDES: esa rama es defensiva y no la alcanza nadie en el flujo
  // normal, porque todo cubo tiene rótulo hoy.
  //
  // «Hoy» es la palabra. Se provoca la condición contra la que defiende —un cubo al que nadie da
  // rótulo, ni el servidor ni el suelo— en vez de declararla imposible.
  const cubo = COBROS_METODOS.find((c) => c.clave === 'card');
  const original = cubo.rotulo;
  try {
    delete cubo.rotulo;
    const r = rotuloDeMetodo('card:stripe', 'card', []);
    assert.equal(r, COBROS_SIN_METODO.rotulo,
      `🔴 con el cubo sin rótulo se pinta «${r}». Si eso es el valor de la base, el «por si acaso» ` +
      'le enseña `card:stripe` al profesional justo el día en que algo se rompió — que es el peor ' +
      'momento para hablarle en el idioma de la base. Y si es la cadena vacía, la celda queda muda.');
    assert.notEqual(r.trim(), '');
    assert.doesNotMatch(r, /card/i);
  } finally {
    cubo.rotulo = original;   // el array es compartido: dejarlo tocado envenenaría los de abajo
  }
  assert.equal(rotuloDeMetodo('card', 'card', []), 'tarjeta',
    '🔴 el cubo no se ha restaurado: los demás tests medirían otra cosa.');
});

test('SCRUM-481 · una pasarela DESCONOCIDA no se inventa: se pinta solo el método', () => {
  // El conjunto de pasarelas es ABIERTO a propósito. Capitalizar por las bravas daría
  // «Mercadopago»; pintarla cruda sería el defecto de este ticket. Se pinta el método, que es
  // microcopy aprobada, y la grafía de la marca nueva se aprueba cuando llegue (va en la entrada).
  assert.equal(rotulo('transfer:revolut'), 'transferencia');
  assert.equal(rotulo('card:paypal'), 'tarjeta');
  assert.doesNotMatch(rotulo('card:paypal'), /paypal/i,
    '🔴 se pinta el nombre crudo de una pasarela cuya grafía no ha aprobado nadie.');
});

// ── LA CAJA, ATADA AL NÚMERO QUE SE MIDIÓ EN NAVEGADOR ───────────────────────────────────────

/**
 * 27 caracteres: «transferencia · MercadoPago», el más largo COMPONIBLE — y no es el que decía la
 * entrada de este ticket. La primera medición tomó «tarjeta · MercadoPago» (21) por máximo, pero la
 * pasarela vale para cualquier método (`tests/scrum474-filtro-cobros-un-cubo.test.mjs` ejercita
 * `transfer:mercadopago` como caso legítimo), así que 21 no era el techo: era el techo de la
 * tarjeta. Se volvió a medir con el peor caso de verdad.
 *
 * Medido EN NAVEGADOR el 12-ago-2026 —`index.html` servido del disco, CSS del árbol y
 * `renderCobrosView` del producto en su contenedor real— a 641 y 768 px: la columna ocupa **198 px**
 * en las dos, **ninguna celda se corta** y no hay scroll horizontal (página y `.table-scroll` con
 * `scrollWidth === clientWidth`). A ≤640 px la columna ni se pinta (`col-hide-mobile`), medido:
 * `display: none` y las 8 filas intactas. Los dos Bizum entran holgados: 18 y 14.
 *
 * 🔴 Y LA COLUMNA NO CRECE POR ESTE CAMBIO: con el mismo corpus y la misma pantalla, quitando y
 * poniendo `COBROS_MATICES`, el ancho sale **198 px en los dos casos**.
 *
 * Esto NO vuelve a medir la caja —eso se hace a mano, y consta en `docs/master/SCRUM-481.md`— sino
 * que ata el número: si alguien alarga un rótulo por encima de lo medido, se entera por un rojo y
 * no por una captura de un profesional con la columna cortada.
 */
const MAXIMO_MEDIDO = 27;

test('SCRUM-481 · ningún rótulo posible pasa de lo que se midió que cabe', () => {
  const posibles = [];
  for (const cubo of COBROS_METODOS) {
    for (const valor of cubo.casa) {
      posibles.push(rotulo(valor));
      for (const pas of Object.keys(COBROS_PASARELAS)) posibles.push(rotulo(`${valor}:${pas}`));
    }
  }
  posibles.push(COBROS_SIN_METODO.rotulo);
  const largos = posibles.filter((r) => r.length > MAXIMO_MEDIDO);
  assert.deepEqual(largos, [],
    `🔴 estos rótulos pasan de los ${MAXIMO_MEDIDO} caracteres que se midieron en navegador: ` +
    `${JSON.stringify(largos)}. La caja hay que VOLVER A MEDIRLA a mano (receta en ` +
    '`docs/master/SCRUM-481.md`) antes de aprobar un rótulo más largo.');
  // Y por el otro lado: el corpus tiene que SEGUIR conteniendo el caso que se midió. Si mañana
  // alguien lo estrecha, «ninguno pasa de 27» sería verdad por no estar mirando el largo.
  const masLargo = Math.max(...posibles.map((r) => r.length));
  assert.equal(masLargo, MAXIMO_MEDIDO,
    `🔴 el rótulo más largo del corpus mide ${masLargo} y se midieron ${MAXIMO_MEDIDO}. Si es más ` +
    'corto, este test ya no ejerce el caso que se llevó al navegador; si es más largo, hay que ' +
    'volver a medir la caja a mano antes de aprobarlo.');
});

// ── 🔴 EL ROJO POR EL MECANISMO ──────────────────────────────────────────────────────────────

/** ¿La celda de MÉTODO recibe el valor crudo del cobro? Detector sobre el AST, no sobre el texto. */
function celdasQuePintanElValorCrudo(ruta, texto) {
  const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  (function rec(n) {
    // `<algo>.textContent = <expresión que lee `.metodo` de un objeto>`
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'textContent') {
      // 🔴 NO SE DESCIENDE DENTRO DE UNA LLAMADA, y ésa es toda la precisión del detector:
      // `rotuloDeMetodo(c.metodo)` también contiene `.metodo`, pero ahí el valor va DE PASO hacia
      // el rotulador. Lo que se persigue es que el crudo llegue a la celda: directo, con `||`
      // detrás o por un ternario. Sin esta línea el detector marca el arreglo y se silencia.
      let crudo = false;
      (function busca(x) {
        if (ts.isCallExpression(x)) return;
        if (ts.isPropertyAccessExpression(x) && x.name.text === 'metodo') crudo = true;
        ts.forEachChild(x, busca);
      })(n.right);
      if (crudo) out.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, rec);
  })(sf);
  return out;
}

test('SCRUM-481 · 🔴 SUELO DEL DETECTOR: se autoprueba sobre fuente sintética antes de creerse su número', () => {
  // 🔴 REQUISITO NUEVO (12-ago-2026): una sesión vio su censo pasar de 4 a 0 al traer `main` —un
  // refactor CORRECTO de otro dejó ciego al guard sin tocarlo, y el guard contó cero. Así que
  // primero se demuestra que VE, y que DISCRIMINA.
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = c.metodo; }'),
    [1], '🔴 el detector NO ve una celda pintando el valor crudo delante de sus narices.');
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = c.metodo || "x"; }'),
    [1], '🔴 el detector se le escapa el valor crudo con un `||` detrás — que es como estaba escrito.');
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = rotuloDeMetodo(c.metodo, c.metodoCubo, cubos); }'),
    [], '🔴 el detector marca la llamada al rotulador. Un guard que salta con todo se silencia.');
  assert.deepEqual(
    celdasQuePintanElValorCrudo('s.js', 'function f(c){ var td={}; td.textContent = c.cliente; }'),
    [], '🔴 el detector marca celdas que no tienen nada que ver con el método.');
});

test('SCRUM-481 · 🔴 la pantalla NO le enseña el valor de la base al profesional', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  const crudas = celdasQuePintanElValorCrudo(VISTA, fuente);
  assert.deepEqual(crudas, [],
    `🔴 LA PANTALLA LE ESTÁ ENSEÑANDO EL VALOR DE LA BASE DE DATOS AL PROFESIONAL.\n` +
    `  ${VISTA}, línea(s) ${crudas.join(', ')}: la celda pinta \`c.metodo\` en crudo — «card:stripe», ` +
    '«card»— mientras la pestaña de al lado dice «tarjeta». No es que «falte un rótulo»: es que la ' +
    'pantalla habla dos idiomas y uno de ellos no es para el profesional.\n' +
    '  El rótulo sale de `rotuloDeMetodo`, que consume el cubo y los rótulos del servidor.');
});

// ── QUE EL RÓTULO NO SE DUPLIQUE POR COMODIDAD ───────────────────────────────────────────────

test('SCRUM-481 · «no consta» tiene UN solo nombre en esta pantalla', () => {
  // Aquí vivía `metodoSinRegistrar: 'No registrado'` para la columna mientras la pestaña decía
  // «Método no registrado». Dos rótulos para el mismo hecho en la misma pantalla es este ticket en
  // miniatura, y por eso se retiró.
  const fuente = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  const literales = [...fuente.matchAll(/'((?:No|Método no) registrado)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(literales)], ['Método no registrado'],
    `🔴 hay más de un rótulo para «no consta» en la vista: ${JSON.stringify(literales)}. El de la ` +
    'columna y el de la pestaña tienen que ser el mismo, o vuelven a divergir.');
});

test('SCRUM-481 · los matices son SOLO los aprobados, y cubren el conjunto cerrado que los pide', () => {
  // Regla 30: aquí no nace microcopy. Y regla 22: los matices se declaran sobre valores que existen
  // en `PAID_VIA`, no sobre inventos.
  assert.deepEqual(COBROS_MATICES, { bizum_auto: 'automático', bizum_manual: 'manual' },
    '🔴 los matices no son los aprobados por el asesor + fundador el 12-ago-2026 (regla 30).');
  for (const clave of Object.keys(COBROS_MATICES)) {
    assert.ok(PAID_VIA.includes(clave),
      `🔴 «${clave}» tiene grafía en la columna y NO está en el conjunto cerrado (regla 22).`);
  }
});
