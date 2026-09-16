// tests/scrum725-dato-inventado-en-la-descripcion.test.mjs — SCRUM-725 ①
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN DATO QUE EL TEXTO NO DICE, TAMPOCO APARECE EN LA DESCRIPCIÓN.
//
// SCRUM-683 cerró las CANTIDADES: `cantidadRespaldadaPorElTexto` retira cualquier `unds` que el
// dictado no sostenga. La `descripcion` seguía pasando **verbatim, sin comprobar nada**. Medido
// contra el mecanismo de entonces, con los casos adversarios del encargo:
//
//   ✅ «cambie los detectores del pasillo» → `unds: 3` retirada
//   ✅ «puse cable»                        → `unds: 20` retirada
//   🔴 «reviso la central»                 → «Revision de central Honeywell Galaxy G3-144»
//   ✅ «cambié 3 detectores Honeywell»     → el 3 y la marca sobreviven
//
// El tercero pasaba entero: marca, gama y modelo, inventados. El prompt YA lo prohibía
// (*«NUNCA completes marcas, modelos ni referencias»*) — y por eso el hueco es de la familia
// cara: **una prohibición sin mecanismo**. Un prompt es una petición, no un guard.
//
// 🔒 La empresa es de SEGURIDAD. Ese `G3-144` es el modelo de la central de alarma del cliente,
// escrito en un documento que el cliente FIRMA y que después se factura.
//
// ── DÓNDE SE PONE EL LISTÓN, Y POR QUÉ NO MÁS ALTO ───────────────────────────────────────
// Exigir que TODA palabra esté en el dictado mataría la función: redactar es justamente pasar de
// «cambie los detectores» a «Cambio de detectores». Se exige respaldo sólo donde vive el daño —
// tokens con DÍGITO (modelos, medidas) y tokens en Mayúscula que no abren la frase (marcas)— y
// el cotejo va por RAÍZ, para que `reviso` respalde a `Revisión`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanearDictadoDelParte, PROMPT_PARTE_APROBADO }
  from '../dist/modules/jobs/domain/parteDictado.js';

// 🔴 SE MIDE POR LA SUPERFICIE PÚBLICA, no por el detector suelto. Lo pidió `scrum411`: el
// detector no tiene más consumidor que este fichero, y un `export` puesto sólo para poder
// probarlo es un export huérfano — desde fuera, indistinguible de uno muerto. Se prueba lo que
// de verdad usa el producto, `sanearDictadoDelParte`, y el detector queda cubierto por dentro.
const datosNoRespaldados = (descripcion, dictado) => sanearDictadoDelParte(
  [{ bloque: 'materiales', descripcion, unds: null }], dictado,
).datosRetirados.flatMap((d) => d.tokens);

const linea = (descripcion, unds = null, bloque = 'materiales') => [{ bloque, descripcion, unds }];
const tokensDe = (dictado, propuesta) => sanearDictadoDelParte(propuesta, dictado)
  .datosRetirados.flatMap((d) => d.tokens);

// ═══ 🔴 SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-725 · 🔴 SUELO: el detector distingue, no dice «sí» ni «no» a todo', () => {
  // Sin esto, un detector que devolviera siempre `[]` pasaría todos los casos buenos de abajo, y
  // uno que devolviera todo pasaría los malos. Se comprueba que hace las dos cosas.
  assert.deepEqual(datosNoRespaldados('Cable Nexans', 'puse cable'), ['Nexans'],
    '🔴 no está viendo una marca inventada: el resto de este fichero no probaría nada');
  assert.deepEqual(datosNoRespaldados('Cable de dos hilos', 'puse cable de dos hilos'), [],
    '🔴 marca como inventada una frase que el dictado sostiene entera');
});

// ═══ 🔴 LOS CUATRO CASOS ADVERSARIOS DEL ENCARGO ══════════════════════════════════════════

test('SCRUM-725 · 🔴 «cambie los detectores del pasillo» NO produce «3 detectores»', () => {
  const r = sanearDictadoDelParte(linea('Detectores de humo', 3), 'cambie los detectores del pasillo');
  const todas = [...r.mano_obra, ...r.materiales, ...r.sinBloque];
  assert.equal(todas[0].unds, undefined,
    '🔴 ha entrado una cantidad que el dictado no dice. Una cantidad inventada en un parte es una '
    + 'cantidad facturada.');
  assert.equal(r.cantidadesRetiradas.length, 1, '🔴 se retiró en silencio: hay que poder decir cuál era');
});

test('SCRUM-725 · 🔴 «puse cable» NO produce «20 m»', () => {
  const r = sanearDictadoDelParte(linea('Cable manguera', 20), 'puse cable');
  assert.equal([...r.materiales][0].unds, undefined, '🔴 se ha colado un metraje que nadie dictó');
});

test('SCRUM-725 · 🔴 «reviso la central» NO puede traer marca, gama ni modelo', () => {
  // EL CASO QUE FALTABA. Con el mecanismo de SCRUM-683 salía entero y sin una sola señal.
  const tokens = tokensDe('reviso la central',
    linea('Revision de central Honeywell Galaxy G3-144', null, 'mano_obra'));
  assert.deepEqual(tokens, ['Honeywell', 'Galaxy', 'G3-144'],
    '🔴 marca, gama o modelo inventados llegan a la descripción del parte sin que nada lo diga');
});

test('SCRUM-725 · 🔴 EL SIMÉTRICO: «cambié 3 detectores Honeywell» los conserva INTACTOS', () => {
  // 🔴 El que se olvida, y es igual de caro: un corrector que se come los datos buenos es tan
  // malo como uno que los inventa. Aquí el 3 y la marca están DICHOS.
  const r = sanearDictadoDelParte(linea('Detectores Honeywell', 3), 'cambie 3 detectores Honeywell');
  const l = [...r.materiales][0];
  assert.equal(l.unds, 3, '🔴 se ha comido una cantidad que el técnico SÍ dijo');
  assert.match(l.descripcion, /Honeywell/, '🔴 se ha comido una marca que el técnico SÍ dijo');
  assert.deepEqual(r.datosRetirados, [], '🔴 marca como inventado un dato que está en el dictado');
});

// ═══ ✅ CONTROL NEGATIVO — redactar NO puede disparar el aviso ═════════════════════════════

test('SCRUM-725 · ✅ CONTROL NEGATIVO: una redacción legítima no salta', () => {
  // Es LO QUE SE PIDE que haga: el técnico escribe deprisa y mal, y el texto queda redactado.
  // Si esto saltara, el arreglo habría matado la función que venía a proteger.
  for (const [dictado, redactado] of [
    ['cambie los detectores del pasillo', 'Cambio de detectores en el pasillo'],
    ['reviso la central', 'Revisión de la central'],
    ['puse cable y lo grapé', 'Colocación de cable y grapado'],
    ['limpie los sensores y ajuste la sirena', 'Limpieza de sensores y ajuste de la sirena'],
  ]) {
    assert.deepEqual(datosNoRespaldados(redactado, dictado), [],
      `🔴 «${redactado}» sale marcado desde «${dictado}», y es exactamente la redacción que se pide`);
  }
});

test('SCRUM-725 · ✅ CONTROL NEGATIVO: la raíz aguanta la conjugación y el plural', () => {
  // Un cotejo por igualdad habría dado `Revisión` por inventada desde `reviso`, y el guard se
  // habría convertido en un generador de falsos positivos — que es como se acaba apagando.
  assert.deepEqual(datosNoRespaldados('Revisión Central', 'reviso la central'), []);
  assert.deepEqual(datosNoRespaldados('Detectores', 'cambie el detector'), []);
});

test('SCRUM-725 · ✅ CONTROL NEGATIVO: la PRIMERA palabra no se marca por ir en mayúscula', () => {
  // Una frase redactada empieza en mayúscula SIEMPRE. Exigirlo daría un falso positivo por línea.
  assert.deepEqual(datosNoRespaldados('Cable de dos hilos', 'puse cable de dos hilos'), []);
  // Pero la exención es SÓLO de la mayúscula, no del dígito: una frase no empieza por un modelo.
  assert.deepEqual(datosNoRespaldados('G3-144 revisada', 'reviso la central'), ['G3-144'],
    '🔴 la exención de la primera palabra está tapando un modelo inventado');
});

// ═══ ⛔ LA VOZ NUNCA DICTA IMPORTES ═══════════════════════════════════════════════════════

test('SCRUM-725 · ⛔ ni la propuesta ni su forma admiten un IMPORTE', () => {
  // En el parte real firmado de Tecnosel la columna IMPORTE está VACÍA: el técnico no conoce los
  // precios y no le corresponden. Que no haya CAMINO es más fuerte que prohibirlo por prompt.
  const r = sanearDictadoDelParte(
    [{ bloque: 'materiales', descripcion: 'Detector', unds: 1, precio: 42, importe: 42, iva: 21 }],
    'puse 1 detector',
  );
  const l = [...r.materiales][0];
  assert.deepEqual(Object.keys(l).sort(), ['descripcion', 'unds'],
    '🔴 la línea propuesta ha ganado un campo de dinero. La voz no dicta importes: si existe el '
    + 'campo, existe el camino.');
  assert.match(PROMPT_PARTE_APROBADO, /NO devuelvas precios ni IVA/,
    '🔴 el prompt ha dejado de prohibir precios — y el prompt es la primera puerta, no la única');
});
