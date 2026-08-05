// SCRUM-344 · CERRAR UN TRABAJO CON SALDO PENDIENTE — se AVISA, no se impide.
//
// EL DEFECTO: `cerrado` es el único estado terminal de la FSM (`job.service.ts:27`) y cerrar mata la
// vía de cobro (`jobs.routes.ts:552` exige `terminado` para `collect-rest`). Hasta este ticket el
// botón se ofrecía suelto en el renglón de acciones, sin mirar un solo número de dinero.
//
// EL ROJO SOBRE EL DEFECTO REAL, SIN INYECTAR — reproducible en un comando:
//   git show origin/main:public/dashboard/js/jobsView.js > /tmp/antes.js
//   …y pasarle `censarCierreTrabajo`: sección NO encontrada, el cierre vive en `jobCard` y sus
//   guardas son []. Los tests 2, 3 y 4 de este fichero caen con esos bytes, que son los que corren
//   hoy en producción. No hay nada inyectado: es el fichero tal cual.
// Ese rojo no se puede dejar dentro de la suite —en cuanto esto entre en `main`, esos bytes dejan
// de ser los de `main` y el test se volvería mentira—, así que aquí quedan las INYECCIONES, que sí
// son estables: cada una rompe una pieza y comprueba que su test la caza.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarCierreTrabajo, FUNCION_SECCION } from './_censo-cierre-trabajo.mjs';
import regla from '../public/dashboard/js/jobsCierreTrabajo.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'jobsView.js');
const codigoReal = fs.readFileSync(VISTA, 'utf8');
const censo = censarCierreTrabajo(codigoReal);

const MUESTRA_IMPORTE = '1.234,56 €';

// ── LA MICROCOPY APROBADA, CARÁCTER A CARÁCTER (regla 30) ────────────────────────────────────
//
// Aprobada por el fundador el 5-ago-2026. Este bloque es la COPIA CANÓNICA y el módulo tiene que
// coincidir con ella exactamente.
//
// ⚠️ SUSTITUYE al guard anterior, que exigía `[PENDIENTE microcopy oficial]` en cada ranura. No se
// borra una comprobación: se cambia por otra MÁS FUERTE. El del marcador solo impedía INVENTAR texto
// mientras no hubiera texto aprobado; en cuanto lo hay, deja de poder decir nada y lo que hace falta
// es impedir **cambiar lo aprobado**. Eso es lo que la regla 30 quiere decir y hasta ahora solo
// aproximaba: el texto lo aprueba el fundador, también cuando se toca después.
//
// El guard ESTRUCTURAL («la sección no escribe ni una palabra suelta») no se toca: es la mitad que
// no caduca, y sigue impidiendo que alguien escriba una frase directamente en la vista y esquive
// esta tabla por completo.
const APROBADA = {
  titulo: 'Cerrar el trabajo',
  boton: 'Cerrar trabajo',
  explicacion: 'Cerrar da el trabajo por acabado. No se puede reabrir.',
  avisoSaldo: 'Quedan 1.234,56 € que todavía no has cobrado. Si cierras el trabajo, el botón '
    + '«Cobrar el resto» desaparece y ya no podrás cobrarlos desde YaQu. Puedes cerrarlo igualmente: '
    + 'por ejemplo, si ya lo cobraste por otra vía o lo das por perdido.',
  confirmar: 'Quedan 1.234,56 € sin cobrar. Al cerrar el trabajo ya no podrás cobrarlos desde YaQu. '
    + '¿Cerrar de todas formas?',
};

// ── EL MECANISMO, en funciones compartidas ───────────────────────────────────────────────────
// Los tests y sus inyecciones llaman a LO MISMO. Si la comprobación viviera escrita dos veces, la
// inyección podría "caer" por un motivo distinto del que caza el test de verdad, y el rojo no
// probaría nada.

/** Cierres que NO están protegidos por el aviso (ni por el flag ni por la confirmación). */
function cierresSinAviso(cierres) {
  return cierres.filter((c) => {
    const g = c.guardas.join(' § ');
    return !(g.includes('haySaldoPendiente') && g.includes('confirm'));
  });
}

/** Textos de la sección cuyo origen NO es la fuente única (ni un importe). */
function textosInventados(textosDeSeccion) {
  return textosDeSeccion.filter((x) => x.origen !== 'CIERRE_TEXTOS' && x.origen !== 'importe');
}

/** Ranuras cuyo texto NO coincide con el aprobado, carácter a carácter. */
function ranurasQueNoCoinciden(textos, ranuras) {
  const leer = (r) => (typeof textos[r] === 'function' ? textos[r](MUESTRA_IMPORTE) : textos[r]);
  return ranuras.filter((r) => leer(r) !== APROBADA[r]).map((r) => `${r}\n       es: «${leer(r)}»\n    debía: «${APROBADA[r]}»`);
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Un cero de «no hay cierres sin guarda» y uno de «no supe encontrar los cierres» son el mismo
// número y significan lo contrario. Si el escáner se queda ciego, esto falla ANTES que nada.
test('SCRUM-344 · SUELO: el censo encuentra la acción de cerrar y las ranuras de texto', () => {
  assert.ok(
    censo.cierres.length >= 1,
    `🔴 ESCÁNER CIEGO: 0 transiciones a 'cerrado' en jobsView.js. El censo dejó de ver lo que vigila.`,
  );
  assert.ok(
    regla.CIERRE_RANURAS.length >= 4,
    `🔴 ESCÁNER CIEGO: el módulo declara ${regla.CIERRE_RANURAS.length} ranuras de texto (esperaba ≥4).`,
  );
});

// ── 1 · SECCIÓN PROPIA (regla 5, la excepción de los actos irreversibles) ─────────────────────
test('SCRUM-344 · cerrar vive en su SECCIÓN PROPIA, no suelto entre las acciones del día a día', () => {
  assert.ok(censo.seccionEncontrada, `🔴 no existe ${FUNCION_SECCION}: el cierre volvería al renglón de acciones.`);

  const sueltos = censo.cierres.filter((c) => c.funcion !== FUNCION_SECCION);
  assert.deepEqual(
    sueltos.map((c) => `L${c.linea} en ${c.funcion}`), [],
    '🔴 hay cierres FUERA de la sección propia. Lo irreversible va en su bloque con su explicación: ' +
      'esconderlo en el «⋮» tampoco vale, porque aquí el riesgo es no entender, no el clic accidental.',
  );
});

// ── 2 · EL AVISO (se avisa, no se impide) ────────────────────────────────────────────────────
test('SCRUM-344 · ningún cierre con saldo pendiente pasa sin aviso', () => {
  const sinAviso = cierresSinAviso(censo.cierres);
  assert.deepEqual(
    sinAviso.map((c) => `L${c.linea} guardas=[${c.guardas.join(' | ')}]`), [],
    '🔴 se puede cerrar con saldo pendiente sin que nadie diga nada — el defecto de SCRUM-344.',
  );
});

// ── 3 · MICROCOPY (regla 30) ─────────────────────────────────────────────────────────────────
test('SCRUM-344 · la sección no escribe ni una palabra suelta: todo texto sale de CIERRE_TEXTOS', () => {
  // Su propio suelo, y va AQUÍ y no en el general: con 0 textos vistos `textosInventados` devuelve
  // [] y este test pasaría en vacío — verde por no haber mirado, que es el peor verde que hay.
  assert.ok(
    censo.textosDeSeccion.length >= 3,
    `🔴 ESCÁNER CIEGO: solo veo ${censo.textosDeSeccion.length} textos en ${FUNCION_SECCION} (esperaba ≥3: título, explicación y confirmación).`,
  );
  const inventados = textosInventados(censo.textosDeSeccion);
  assert.deepEqual(
    inventados.map((x) => `L${x.linea}: ${x.expr} (${x.origen})`), [],
    '🔴 texto escrito a mano en la vista. La microcopy la aprueba el fundador y vive en UNA fuente ' +
      '(CIERRE_TEXTOS); un renombre también es microcopy nueva.',
  );
});

test('SCRUM-344 · las cinco ranuras dicen EXACTAMENTE el texto aprobado (regla 30)', () => {
  // Suelo: si el módulo dejara de declarar ranuras, comparar cero contra cero pasaría en vacío.
  assert.deepEqual(
    [...regla.CIERRE_RANURAS].sort(), Object.keys(APROBADA).sort(),
    '🔴 el juego de ranuras del módulo no es el aprobado: sobra o falta alguna, y las que no están ' +
      'en la tabla NO las vigila nadie.',
  );
  assert.deepEqual(
    ranurasQueNoCoinciden(regla.CIERRE_TEXTOS, regla.CIERRE_RANURAS), [],
    '🔴 la microcopy de la sección de cierre ha cambiado respecto a la APROBADA por el fundador el ' +
      '5-ago-2026 (regla 30). El texto lo aprueba él, también al cambiarlo: si el cambio es ' +
      'deliberado, actualiza `APROBADA` en el mismo commit y que se vea en el diff.',
  );
});

test('SCRUM-344 · el texto aprobado NO nombra el documento fiscal (Parte M)', () => {
  // Un merchant ES sin INVOICING_ES_ENABLED recibe un JUSTIFICANTE, no una factura — y este texto lo
  // lee él. NO se puede delegar en el trinquete de SCRUM-299: ese excluye `public/dashboard/` a
  // propósito (scrum299-copy-factura-publico.test.mjs:128), así que aquí su verde no significa nada.
  const todo = regla.CIERRE_RANURAS
    .map((r) => (typeof regla.CIERRE_TEXTOS[r] === 'function' ? regla.CIERRE_TEXTOS[r](MUESTRA_IMPORTE) : regla.CIERRE_TEXTOS[r]))
    .join(' § ');
  // Control positivo del propio detector: si el patrón dejara de casar, el barrido de abajo sería
  // verde pasara lo que pasara.
  const PALABRAS = /factura|justificante|recibo/i;
  assert.match('aquí tienes tu factura', PALABRAS, '🔴 el detector no reconoce la palabra que vigila.');
  assert.doesNotMatch(
    todo, PALABRAS,
    '🔴 el texto nombra el documento fiscal. Para un merchant sin INVOICING_ES_ENABLED ese nombre es ' +
      'falso (Parte M), y este copy lo lee él.',
  );
});

// ── 4 · LA REGLA PURA · LAS DOS CARAS ────────────────────────────────────────────────────────
test('SCRUM-344 · CON saldo por facturar: avisa, y con el importe que ya enseña la pantalla', () => {
  const job = { status: 'terminado', totalAceptado: 1000, totalCobrado: 400, estadoCobro: 'Parcial',
                remaining: { amount: 600, currency: 'EUR' }, quote: { currency: 'EUR' } };
  const a = regla.avisoCierreTrabajo(job);
  assert.equal(a.haySaldoPendiente, true, '🔴 con 600 € por facturar el aviso no salta.');
  // El MISMO número que pinta el botón «Cobrar el resto» (jobsView.js: j.remaining.amount) — no un
  // segundo cálculo que pueda separarse del primero.
  assert.equal(a.importe, job.remaining.amount, '🔴 el aviso enseñaría un importe distinto del botón de cobrar.');
  assert.equal(a.currency, job.remaining.currency);
});

test('SCRUM-344 · LA OTRA CARA — sin saldo por facturar, cerrar sigue siendo UN clic', () => {
  // Todo facturado y cobrado: el camino normal de cerrar. Sin fricción nueva.
  const pagado = { status: 'terminado', totalAceptado: 1000, totalCobrado: 1000, estadoCobro: 'Pagado', remaining: null };
  assert.equal(regla.avisoCierreTrabajo(pagado).haySaldoPendiente, false, '🔴 fricción nueva sobre un cierre limpio.');

  // Tramo pendiente de importe 0 (plan que no deja nada por facturar): tampoco hay nada que perder.
  const cero = { status: 'terminado', totalAceptado: 1000, totalCobrado: 1000, remaining: { amount: 0, currency: 'EUR' } };
  assert.equal(regla.avisoCierreTrabajo(cero).haySaldoPendiente, false, '🔴 avisa de 0 €.');
});

// ── 5 · CONTROL NEGATIVO · EL CASO DEGENERADO ────────────────────────────────────────────────
// `estadoCobroFor` exige `aceptado > 0` para decir 'Pagado' (job.service.ts:215). Con totalAceptado
// nulo o 0 NUNCA lo dice: se queda en 'Pendiente' para siempre. Y 'Pendiente' ahí significa a la vez
// «te deben todo» y «aquí no hay importe contra el que cobrar». Si el disparador fuera el semáforo,
// el aviso saltaría en un Trabajo donde no hay absolutamente nada que perder.
test('SCRUM-344 · CONTROL NEGATIVO: «Pendiente» sin importe NO dispara el aviso', () => {
  const degenerado = { status: 'terminado', totalAceptado: null, totalCobrado: 0, estadoCobro: 'Pendiente',
                       remaining: null, quote: null };
  const a = regla.avisoCierreTrabajo(degenerado);
  assert.equal(a.haySaldoPendiente, false,
    '🔴 avisa a quien no debe: sin total aceptado el semáforo dice «Pendiente» para siempre, y ahí no hay cobro que perder.');
  assert.equal(a.importe, 0);

  const cero = { status: 'terminado', totalAceptado: 0, totalCobrado: 0, estadoCobro: 'Pendiente', remaining: { amount: 0, currency: 'EUR' } };
  assert.equal(regla.avisoCierreTrabajo(cero).haySaldoPendiente, false, '🔴 avisa con total aceptado 0.');

  // …y el complemento, que es lo que impide que este control pase por estar todo apagado: el MISMO
  // estadoCobro 'Pendiente', pero con importe real, SÍ avisa. El disparador es el dinero, no el semáforo.
  const conDinero = { status: 'terminado', totalAceptado: 800, totalCobrado: 0, estadoCobro: 'Pendiente',
                      remaining: { amount: 800, currency: 'EUR' } };
  assert.equal(regla.avisoCierreTrabajo(conDinero).haySaldoPendiente, true,
    '🔴 el control está apagado: con 800 € por facturar tampoco avisa.');
});

test('SCRUM-344 · la sección de cierre solo existe donde la FSM deja cerrar (terminado)', () => {
  assert.equal(regla.puedeCerrarTrabajo({ status: 'terminado' }), true);
  for (const s of ['pendiente_agendar', 'agendado', 'en_curso', 'cerrado']) {
    assert.equal(regla.puedeCerrarTrabajo({ status: s }), false, `🔴 ofrece cerrar desde '${s}' (la FSM no lo permite).`);
  }
});

// ── 6 · INYECCIONES · que el verde no sea una casualidad ─────────────────────────────────────
test('SCRUM-344 · INYECCIÓN: quitar la confirmación deja el cierre sin aviso y el guard lo caza', () => {
  const inyectado = codigoReal.replace(
    /\n\s*if \(aviso\.haySaldoPendiente && !window\.confirm\([^\n]*\n/,
    '\n',
  );
  assert.notEqual(inyectado, codigoReal, '🔴 la inyección no encontró la confirmación (¿cambió de forma?).');
  const sinAviso = cierresSinAviso(censarCierreTrabajo(inyectado).cierres);
  assert.ok(sinAviso.length >= 1, '🔴 el guard NO ve la diferencia entre cerrar con aviso y cerrar sin él.');
});

test('SCRUM-344 · INYECCIÓN: sacar el cierre de su sección y dejarlo suelto hace caer el guard', () => {
  // El cierre se muda a `jobCard`, que es exactamente donde vivía antes de este ticket.
  const inyectado = codigoReal.replace(
    'function jobCard(j, container) {',
    "function jobCard(j, container) {\n  const escape = () => patch({ status: 'cerrado' }, 'x');",
  );
  assert.notEqual(inyectado, codigoReal, '🔴 la inyección no encontró jobCard.');
  const sueltos = censarCierreTrabajo(inyectado).cierres.filter((c) => c.funcion !== FUNCION_SECCION);
  assert.ok(sueltos.length >= 1, '🔴 el guard NO distingue un cierre suelto de uno en su sección.');
});

test('SCRUM-344 · INYECCIÓN: un texto plausible escrito en la vista hace caer el guard', () => {
  const inyectado = codigoReal.replace(
    "explicacion.textContent = textoCierre('explicacion', importeFmt);",
    "explicacion.textContent = 'Cerrar da el trabajo por acabado y no se puede deshacer.';",
  );
  assert.notEqual(inyectado, codigoReal, '🔴 la inyección no encontró el texto de la explicación.');
  const inventados = textosInventados(censarCierreTrabajo(inyectado).textosDeSeccion);
  assert.ok(inventados.length >= 1, '🔴 el guard sería ciego a una frase colada en la vista.');
});

test('SCRUM-344 · INYECCIÓN: cambiar UN carácter del texto aprobado hace caer el guard', () => {
  // El rojo más pequeño que existe: un punto por una coma en la explicación. Si esto no cae, el
  // guard no fija el texto — solo comprueba que hay texto, que es lo que hacía el del marcador.
  const uno = regla.CIERRE_TEXTOS.explicacion.replace('acabado.', 'acabado,');
  assert.notEqual(uno, regla.CIERRE_TEXTOS.explicacion, '🔴 la inyección no encontró dónde cambiar el carácter.');
  const malas = ranurasQueNoCoinciden({ ...regla.CIERRE_TEXTOS, explicacion: uno }, regla.CIERRE_RANURAS);
  assert.ok(malas.length >= 1, '🔴 el guard NO ve un cambio de un solo carácter en la microcopy aprobada.');
  assert.ok(malas.some((m) => m.startsWith('explicacion')), `🔴 señala la ranura equivocada: ${malas.join(' | ')}`);

  // …y el importe cambia con el Trabajo, así que la comparación NO puede depender de él: la misma
  // frase con otra cifra sigue siendo la misma frase aprobada.
  const otroImporte = regla.CIERRE_TEXTOS.avisoSaldo('9.999,99 €');
  assert.ok(otroImporte.includes('9.999,99 €'), '🔴 la ranura ignora el importe que se le pasa.');
  assert.equal(
    otroImporte.replace('9.999,99 €', MUESTRA_IMPORTE), APROBADA.avisoSaldo,
    '🔴 la frase cambia por algo más que el importe.',
  );
});

test('SCRUM-344 · INYECCIÓN: nombrar el documento fiscal en el texto hace caer su guard', () => {
  const colado = 'Quedan 1.234,56 € sin cobrar: te falta emitir la factura del resto.';
  assert.match(colado, /factura|justificante|recibo/i,
    '🔴 el detector no caza la palabra en una frase que SÍ la lleva: sería ciego a lo que vigila.');
});
