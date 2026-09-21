// SCRUM-917f · «LO QUE FALTA»: el rótulo deja de afirmar «para cobrar», y el caso sin presupuesto
// deja de ser un silencio.
//
// Sin gate: lee el fuente y ejercita el motor puro (`jobCobroHuecos.js`), que no toca red ni DOM.
// El DOM pintado lo mide `guard:detalle-trabajo-917`, que es de navegador y va en su tanda.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA, Y POR QUÉ ESE Y NO OTRO
//
// ① EL RÓTULO MIENTE EN UN TRABAJO PAGADO. La tarjeta se llama «Qué falta para cobrar» y se pinta
//    siempre que haya CUALQUIER hueco — incluidos los que no son dinero. Un Trabajo cobrado del
//    todo con un albarán sin firmar enseña hoy una cabecera que afirma que falta cobrar algo.
//    Son dos preguntas distintas y la tarjeta contesta a las dos: el rótulo tiene que admitirlo.
//    Texto FIRMADO: `docs/prototipos/SCRUM-917/textos-propuestos.md`, «El detalle», fila
//    «Lo que falta» — firmado por delegación permanente (com. 15881).
//
// ② EL CASO SIN PRESUPUESTO NO SE NOMBRA. Medido en el PASO 0: un Trabajo con `totalAceptado`
//    nulo no pinta esta sección EN ABSOLUTO —`seccionCobroVisible` deriva de los huecos y no hay
//    ninguno—, así que la pantalla se calla justo donde hay algo importante que decir: no es que
//    no falte nada, es que no se puede saber. Tres literales FIRMADOS (misma tabla, fila
//    «Este trabajo no tiene presupuesto aceptado»).
//
// ③ Y LA TARJETA NO REPITE LA CIFRA DE LA FRANJA. Es el ticket entero de 917: el mismo importe se
//    leía SIETE veces en esta pantalla. 917e dejó la franja; si ahora un hueco vuelve a decir
//    «te falta por cobrar N €», el defecto vuelve por la puerta de al lado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const VISTA = leer('public/dashboard/js/jobDetailView.js');
// Para PROHIBIR un literal hay que leer CÓDIGO, no prosa: los comentarios que explican por qué se
// retira «Qué falta para cobrar» contienen, necesariamente, la cadena que prohíben. Es la trampa
// de autorreferencia que este repo ya tiene documentada (`_guard-texto.mjs`).
const VISTA_CODIGO = ejecutableDe(VISTA, {
  ancla: 'renderJobDetailView', donde: 'jobDetailView.js', almohadillaEsComentario: false,
});
const G5 = createRequire(import.meta.url)('../public/dashboard/js/jobCobroHuecos.js');

// Un Trabajo SIN presupuesto aceptado. `totalAceptado` NULO, que no es lo mismo que cero:
// SCRUM-651 lo dejó dicho y 917e lo volvió a medir en la franja.
const sinPresupuesto = (extra = {}) => ({
  id: 3101, totalAceptado: null, totalCobrado: 0, albaranes: [], invoices: [], ...extra,
});

test('SCRUM-917f · el rótulo es «Lo que falta» y ya no afirma «para cobrar»', () => {
  assert.match(
    VISTA, /detail-section-title">Lo que falta</,
    '🔴 la tarjeta no se llama «Lo que falta».\n\n' +
      '  Se pinta siempre que haya CUALQUIER hueco, y no todos son dinero: un albarán sin firmar\n' +
      '  y una línea sin entregar no son «lo que falta para cobrar». En un Trabajo cobrado del\n' +
      '  todo con un albarán pendiente de firma, ese rótulo afirma algo FALSO.\n' +
      '  Texto firmado: docs/prototipos/SCRUM-917/textos-propuestos.md, «El detalle».',
  );
  assert.ok(
    !/Qué falta para cobrar/.test(VISTA_CODIGO),
    '🔴 ha vuelto «Qué falta para cobrar» al código pintado. El rótulo viejo no convive con el\n' +
      '  nuevo: o la tarjeta admite que contesta dos preguntas, o vuelve a mentir en una de ellas.',
  );
  // ✅ SUELO: si `VISTA_CODIGO` viniera vacía, la prohibición de arriba sería un verde permanente.
  assert.match(VISTA_CODIGO, /detail-section-title/,
    '🔴 ESCÁNER CIEGO: el ejecutable no contiene ni una cabecera de sección; la prohibición de ' +
      'arriba no está midiendo nada.');
});

test('SCRUM-917f · SIN PRESUPUESTO ACEPTADO: la pantalla lo DICE, en vez de callarse', () => {
  const h = G5.huecosDeCobro(sinPresupuesto());
  const hueco = h.find((x) => x.id === 'sin-presupuesto');
  assert.ok(
    hueco,
    '🔴 un Trabajo sin presupuesto aceptado no produce ningún hueco, así que\n' +
      '  `seccionCobroVisible` da falso y la sección NO SE PINTA. La pantalla se calla justo\n' +
      '  donde hay algo que decir: no es que no falte nada, es que no se puede saber cuánto\n' +
      '  falta. Medido en el PASO 0 sobre el Trabajo 3101.',
  );
  assert.equal(hueco.accion, 'hacer-presupuesto',
    '🔴 el hueco no lleva a hacer el presupuesto, que es lo único que lo resuelve.');
  assert.ok(
    G5.seccionCobroVisible(sinPresupuesto()),
    '🔴 el hueco existe pero la sección sigue sin pintarse: `seccionCobroVisible` no lo ve.',
  );
});

test('SCRUM-917f · 🔴 CONTROL: aceptado por 0 € NO es «sin presupuesto»', () => {
  // La corrección que ya cazó a 917e al re-anclar SCRUM-318. Un presupuesto aceptado por 0 €
  // CONSTA: el dato está, y vale cero. Confundir ausencia con cero aquí haría que un Trabajo con
  // presupuesto enseñara «no tiene presupuesto aceptado», que es rotundamente falso.
  const h = G5.huecosDeCobro(sinPresupuesto({ totalAceptado: 0 }));
  assert.ok(
    !h.some((x) => x.id === 'sin-presupuesto'),
    '🔴 con `totalAceptado: 0` sale el hueco de «sin presupuesto». Cero no es ausencia: el\n' +
      '  criterio es `totalAceptado == null`, el MISMO que decide si se pinta la franja (917e).\n' +
      '  Si los dos criterios se separan, habrá Trabajos con franja Y con «no tiene presupuesto».',
  );
  // ✅ CONTROL POSITIVO, o el de arriba sería cierto por no salir nunca: con `null` sí sale.
  assert.ok(
    G5.huecosDeCobro(sinPresupuesto()).some((x) => x.id === 'sin-presupuesto'),
    '🔴 ESCÁNER CIEGO: con `null` tampoco sale, así que la negación de arriba no discrimina nada.',
  );
});

test('SCRUM-917f · el hueco nuevo está DECLARADO en el orden canónico', () => {
  // `HUECOS_COBRO` es una lista de IGUALDAD: si el motor produce un id que no está aquí, o al
  // revés, el guard de SCRUM-320 cae. Es lo que impide que un hueco nuevo se pinte sin declararse.
  assert.ok(
    G5.HUECOS_COBRO.includes('sin-presupuesto'),
    '🔴 `sin-presupuesto` no está en `HUECOS_COBRO`: se pinta sin declararse.',
  );
  assert.equal(
    G5.HUECOS_COBRO[0], 'sin-presupuesto',
    '🔴 `sin-presupuesto` no va el PRIMERO. El orden de esta sección no es estético y lo dejó\n' +
      '  escrito SCRUM-320: primero lo que el pro puede resolver HOY, luego lo suyo, y al final lo\n' +
      '  que depende del cliente. Hacer el presupuesto es lo más «hoy» de los seis, y además es la\n' +
      '  condición de que los demás importes signifiquen algo.',
  );
  // 🔒 EL ORDEN DE LOS CINCO DE ANTES NO SE TOCA. Este corte AÑADE; si además reordenara, el rojo
  // de SCRUM-320 no distinguiría una cosa de la otra.
  assert.deepEqual(
    G5.HUECOS_COBRO.slice(1),
    ['sin-firmar', 'sin-facturar', 'sin-facturar-nada', 'sin-entregar', 'sin-cobrar'],
    '🔴 917f ha REORDENADO los cinco huecos que ya existían. Este corte solo añade uno.',
  );
});

test('SCRUM-917f · la tarjeta NO repite la cifra que la franja acaba de decir', () => {
  // ③ El ticket entero de 917: «590,00 €» se leía SIETE veces en esta pantalla. 917e dejó la
  // franja con lo que falta, el aceptado y el cobrado. Si un hueco vuelve a decir «te falta por
  // cobrar N €», el defecto vuelve por la puerta de al lado.
  //
  // Con presupuesto aceptado y todo pendiente, los huecos que salen hablan de FACTURAR y de
  // ENTREGAR — ninguno enuncia el pendiente de cobro, que es lo que dice la franja.
  const conFranja = {
    id: 3104, totalAceptado: 590, totalCobrado: 100,
    albaranes: [{ id: 1, estado: 'firmado', facturado: false, totales: { total: 300 } }],
    invoices: [],
  };
  const ids = G5.huecosDeCobro(conFranja).map((x) => x.id);
  assert.ok(ids.length > 0, '🔴 ESCÁNER CIEGO: sin huecos, este test no compara nada.');
  assert.ok(
    !ids.includes('falta-por-cobrar') && !ids.includes('sin-presupuesto'),
    `🔴 con franja ha aparecido un hueco que repite su cifra. Salen: ${JSON.stringify(ids)}`,
  );
  // Y la otra mitad, que es la que hace verdad a la de arriba: la franja SÍ está en esa pantalla,
  // o «no lo repite» sería cierto porque no se dice en ningún sitio.
  assert.match(
    VISTA, /if \(job\.totalAceptado != null\) \{/,
    '🔴 la franja ha dejado de pintarse por `totalAceptado != null`. Si la franja desaparece, ' +
      'este test pasa a certificar un silencio en vez de una no-repetición.',
  );
});

test('SCRUM-917f · los tres literales del hueco nuevo son los FIRMADOS, palabra por palabra', () => {
  // Regla 30: aquí no se escribe copy, se coloca. Los tres salen de la tabla firmada por
  // delegación permanente (com. 15881) y se comprueban contra el FICHERO de la tabla, no contra
  // una copia escrita en este test — si no, el test y el código podrían derivar juntos.
  const TABLA = leer('docs/prototipos/SCRUM-917/textos-propuestos.md');
  for (const literal of [
    'Este trabajo no tiene presupuesto aceptado',
    'Sin un importe de referencia no se puede saber cuánto falta por cobrar.',
    'Hacer presupuesto',
  ]) {
    assert.ok(TABLA.includes(literal),
      `🔴 «${literal}» no está en la tabla de textos: o no está firmado, o cambió de forma.`);
    assert.ok(VISTA.includes(literal),
      `🔴 la vista no pinta el literal firmado «${literal}».`);
  }
  // 🔴 Y LOS DOS QUE NO ESTÁN FIRMADOS NO SE CONSTRUYEN (línea 49 de la tabla, y la decisión del
  // propio documento: «no propongo nada para el caso cobrado de más como decisión»). Para ese caso
  // se reutiliza el literal ya firmado de SCRUM-887, que ya vive en `jobCobroHuecos.js`.
  for (const prohibido of ['Se ha cobrado de más', 'El cobro supera el importe aceptado']) {
    assert.ok(
      !VISTA_CODIGO.includes(prohibido),
      `🔴 se ha construido «${prohibido}», que NO está firmado. El caso de cobrado de más ya ` +
        'tiene su aviso firmado en SCRUM-887 (`avisoCobradoDeMas`): se reutiliza, no se reescribe.',
    );
  }
  // ✅ SUELO de las dos prohibiciones: el aviso firmado que SÍ se usa tiene que verse desde aquí.
  assert.match(VISTA_CODIGO, /avisoCobradoDeMas\(/,
    '🔴 ESCÁNER CIEGO: no veo la llamada al aviso firmado de SCRUM-887; las dos prohibiciones de ' +
      'arriba estarían midiendo una cadena vacía.');
});
