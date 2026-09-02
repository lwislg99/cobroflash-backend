// tests/scrum286-bloques-orden.test.mjs — SCRUM-286 (B3), guard estructural, sin gate.
//
// NINGÚN CAMPO SE PIERDE AL TROCEAR EL FORMULARIO EN BLOQUES — Y SE DICE CUÁL.
//
// El guard que ya vivía en `scrum286-censo-nuevo-presupuesto.test.mjs` comprueba que siguen
// viajando DIEZ campos. Es necesario y no basta: dice «solo 9 (esperados ≥10)» sin decir CUÁL,
// y un campo puede seguir viajando y haberse quedado en el bloque equivocado. Este fichero une
// las dos poblaciones —lo que se ENVÍA y lo que se PINTA— y nombra lo que falla.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivarOrdenDePintado } from './_orden-pintado-presupuesto.mjs';
import { censarCantidadInventada, esExcepcion } from './_censo-cantidad-inventada.mjs';
import {
  revisarAsignacionDeBloques, BLOQUES_EN_ORDEN, CAMPO_A_BLOQUE,
  VIAJAN_SIN_PINTARSE, CAMPOS_DE_LINEA, MARCA_MICROCOPY,
} from './_asignacion-bloques-presupuesto.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA = 'public/dashboard/js/quotesView.js';
const FUENTE = fs.readFileSync(path.join(AQUI, '..', RUTA), 'utf8');
const R = revisarAsignacionDeBloques(FUENTE, 'quotesView.js');

/** El fichero es CRLF. Derivar el salto en vez de escribir `\n` evita que las mutaciones de más
 *  abajo no casen y el rojo «no salga» por un motivo que no tiene nada que ver con el guard. */
const NL = FUENTE.includes('\r\n') ? '\r\n' : '\n';

/**
 * Muta la fuente REAL y comprueba que la mutación se aplicó de verdad.
 *
 * Sin esta comprobación, un patrón que dejara de existir haría que la mutación no cambiara nada
 * y el test seguiría en verde «demostrando» un rojo que nunca ocurrió. Es la misma trampa que
 * este ticket persigue: no distinguir «no pasa» de «no supe mirar».
 */
function mutar(buscar, reemplazo) {
  assert.ok(FUENTE.includes(buscar), `🔴 el patrón a mutar ya no existe en la fuente: ${buscar}`);
  const mutada = FUENTE.replace(buscar, reemplazo);
  assert.notEqual(mutada, FUENTE, 'la mutación no cambió nada: el rojo que salga no probaría nada');
  return revisarAsignacionDeBloques(mutada, 'quotesView.js');
}

// ── SUELOS ───────────────────────────────────────────────────────────────────
// Si el derivador deja de ver el formulario, TODO lo de abajo daría «0 problemas». Un cero de
// «está bien» y uno de «no supe mirar» son el mismo número, y aquí se separan primero.

test('SCRUM-286 · SUELO: el derivador encuentra la raíz del formulario', () => {
  assert.equal(R.pintado.raiz, 'leftCard',
    '🔴 no se ha podido derivar el contenedor del formulario. Sin raíz no hay orden que medir, ' +
    'y este guard estaría dando verde sobre un árbol vacío.');
});

test('SCRUM-286 · SUELO: el derivador ve los bloques y los controles', () => {
  assert.ok(R.bloquesDelFormulario.length >= 4,
    `🔴 solo ${R.bloquesDelFormulario.length} bloques derivados (esperados ≥4).`);
  assert.ok(R.pintado.inserciones >= 150,
    `🔴 solo ${R.pintado.inserciones} inserciones en el árbol: el recorrido está roto.`);
  assert.ok(R.bloqueDe.size >= 20,
    `🔴 solo ${R.bloqueDe.size} nodos colocados en un bloque: el árbol se está quedando corto.`);
});

test('SCRUM-286 · SUELO: el censo del ENVÍO sigue encontrando lo que viaja', () => {
  assert.ok(R.clavesDeEnvio.length >= 10,
    `🔴 solo ${R.clavesDeEnvio.length} campos en el envío (esperados ≥10). Sin esto, «0 campos ` +
    'perdidos» significaría «no supe mirar».');
  assert.ok(R.envio.linea.length >= CAMPOS_DE_LINEA.length,
    `🔴 solo ${R.envio.linea.length} campos por línea (esperados ≥${CAMPOS_DE_LINEA.length}).`);
});

test('SCRUM-286 · SUELO: el orden del código SIGUE SIENDO el orden del DOM', () => {
  // Todo lo que este guard afirma se apoya en que la construcción es recta. Si alguien mete un
  // `insertBefore` sobre un bloque, el orden derivado sería FALSO — y prefiero un rojo a un
  // orden inventado. Los reordenadores de `linesBody` (mover una línea) y de la modal de
  // compartir están FUERA del esqueleto y se declaran, no se ignoran en silencio.
  assert.deepEqual(R.pintado.reordenadoresEnElFormulario, [],
    '🔴 hay una inserción posicional sobre un contenedor del formulario: el orden que deriva ' +
    'este censo ya no es el orden real del DOM.');
  assert.ok(R.pintado.reordenadoresFuera.length >= 3,
    '🔴 han desaparecido los reordenadores conocidos de fuera del esqueleto: el detector no está ' +
    'mirando, porque `moverLinea` y la modal de compartir siguen usándolos.');
  assert.deepEqual(R.pintado.duplicados, [],
    '🔴 un nombre del formulario está declarado dos veces: el grafo por nombre mentiría.');
});

// ── EL ORDEN, QUE ES LO QUE PIDE EL TICKET ───────────────────────────────────
test('SCRUM-286 · los cuatro bloques se pintan en el orden de la decisión humana', () => {
  const esperados = BLOQUES_EN_ORDEN.map((b) => b.variable);
  const reales = R.bloquesDelFormulario.filter((b) => esperados.includes(b));
  assert.deepEqual(reales, esperados,
    '🔴 el orden de los bloques no es a quién · qué · cómo se paga · cómo se envía:\n' +
    `   esperado: ${esperados.join(' → ')}\n   real:     ${reales.join(' → ')}`);
});

test('SCRUM-286 · el bloque de Líneas se pinta ANTES que el de Condiciones', () => {
  // Es literalmente el defecto del título del ticket: «pide la forma de pago antes de saber el
  // cliente». Va suelto para que, si cae, el mensaje diga esto y no «una lista no coincide».
  const orden = R.bloquesDelFormulario;
  assert.ok(orden.indexOf('blockLines') < orden.indexOf('blockConditions'),
    '🔴 las condiciones de pago vuelven a pintarse antes que las líneas.');
  assert.ok(orden.indexOf('blockClient') < orden.indexOf('blockLines'),
    '🔴 el cliente ya no es lo primero del formulario.');
});

// ── LA ASIGNACIÓN, NOMBRANDO LO QUE FALLA ────────────────────────────────────
test('SCRUM-286 · ningún campo del envío ha dejado de viajar', () => {
  assert.deepEqual(R.dejaronDeViajar, [],
    '🔴 EL FALLO MUDO DE ESTE TICKET: estos campos estaban en el envío y ya no están. No se ve ' +
    'en la pantalla; se paga en el servidor:\n   · ' + R.dejaronDeViajar.join('\n   · '));
});

test('SCRUM-286 · todo campo que viaja tiene su control pintado en algún bloque', () => {
  assert.deepEqual(R.sinControlEnPantalla, [],
    '🔴 estos campos siguen viajando pero su control ya no está en ningún bloque del ' +
    'formulario — el pro no puede gobernarlos:\n   · ' + R.sinControlEnPantalla.join('\n   · '));
});

test('SCRUM-286 · ningún control se ha quedado en el bloque equivocado', () => {
  assert.deepEqual(R.enElBloqueEquivocado, [],
    '🔴 el reordenado ha dejado controles fuera de su bloque:\n   · ' +
    R.enElBloqueEquivocado.join('\n   · '));
});

test('SCRUM-286 · ningún campo del envío se queda SIN SITIO', () => {
  // La lección de SCRUM-284: una lista escrita a mano no avisa de lo que le falta. Si mañana
  // alguien añade un campo al payload y no lo coloca en ningún bloque, sale aquí en rojo.
  assert.deepEqual(R.sinSitio, [],
    '🔴 estos campos viajan y nadie los ha colocado en un bloque ni los ha declarado como ' +
    '«viajan sin pintarse»:\n   · ' + R.sinSitio.join('\n   · '));
});

test('SCRUM-286 · ningún campo está asignado a un bloque que ya no existe', () => {
  assert.deepEqual(R.bloquesFantasma, [],
    '🔴 la asignación apunta a bloques inexistentes: describe un formulario que no es el de hoy.');
});

test('SCRUM-286 · los tres campos que VIAJAN SIN PINTARSE siguen siendo esos tres', () => {
  // `merchant_id`, `currency`, `created_via`: contexto, no ajustes del pro. Constan para que
  // nadie los busque en la pantalla. Si aparece un cuarto, es una decisión que alguien debe tomar.
  const sinPintar = VIAJAN_SIN_PINTARSE.filter((k) => R.clavesDeEnvio.includes(k));
  assert.deepEqual(sinPintar, VIAJAN_SIN_PINTARSE,
    '🔴 uno de los campos de contexto ha dejado de viajar.');
});

// ── MICROCOPY SIN APROBAR (regla 30) ─────────────────────────────────────────
test('SCRUM-286 · todo título de bloque sale con el marcador de microcopy pendiente', () => {
  const bloques = R.pintado.orden.filter((n) => BLOQUES_EN_ORDEN.some((b) => b.variable === n.nombre));
  assert.equal(bloques.length, BLOQUES_EN_ORDEN.length, 'no están los cuatro bloques');
  // 17-ago-2026 · APROBADOS los cuatro, y la fábrica `TITULO_PENDIENTE` se borró con ellos.
  // Lo que este guard protegía —que nadie cuele un rótulo que «suena bien»— sigue protegido, solo
  // que ahora contra el TEXTO APROBADO en vez de contra el marcador: un renombre sigue cayendo.
  for (const b of bloques) {
    const esperado = BLOQUES_EN_ORDEN.find((x) => x.variable === b.nombre).borrador;
    assert.equal(b.titulo, esperado,
      `🔴 el título de \`${b.nombre}\` no es el aprobado («${esperado}») sino «${b.titulo}». Un ` +
      'renombre también es microcopy nueva y lo aprueba el fundador (regla 30).');
  }
  // Y el marcador tiene que ser el de verdad, no una función que se llame parecido.
  // La comprobación de que la FÁBRICA usaba el marcador oficial se retira: la fábrica ya no existe
  // porque los cuatro títulos están aprobados. Lo que la sustituye es la igualdad de arriba, que es
  // más fuerte — antes bastaba con pasar por la fábrica, ahora el texto tiene que ser EL que es.
  assert.ok(!FUENTE.includes('[PENDIENTE microcopy oficial]'),
    '🔴 ha vuelto un marcador a los títulos del formulario: o hay un bloque nuevo sin aprobar, o se ' +
    'ha reintroducido la fábrica. Si es un bloque nuevo, su rótulo va al censo de SCRUM-402.');
});

test('SCRUM-286 · los borradores de título son los cuatro decididos', () => {
  const bloques = R.pintado.orden.filter((n) => BLOQUES_EN_ORDEN.some((b) => b.variable === n.nombre));
  assert.deepEqual(bloques.map((b) => b.titulo), BLOQUES_EN_ORDEN.map((b) => b.borrador));
});

// ── 🔴 ROJO POR EL MECANISMO ─────────────────────────────────────────────────
// «Quita un bloque y el test cae nombrándolo». Se hace sobre la fuente REAL, mutilada en
// memoria: un guard que sólo se ha visto en verde no se ha probado.

test('SCRUM-286 · ROJO: si un campo deja de enviarse, se dice CUÁL', () => {
  const r = mutar('        docFields: selectedDocFields(),', '');
  assert.deepEqual(r.dejaronDeViajar, ['docFields'],
    'quitar `docFields` del payload tiene que caer nombrándolo, no dar «solo 9 campos»');
});

test('SCRUM-286 · ROJO: si se descuelga el control de un bloque, se dice CUÁL', () => {
  const r = mutar('    blockDelivery.appendChild(docFieldsWrapper);', '');
  assert.deepEqual(r.sinControlEnPantalla, ['docFields (control `docFieldsWrapper`)'],
    'un control que deja de colgarse del formulario tiene que salir nombrado');
  assert.deepEqual(r.dejaronDeViajar, [],
    'y hay que distinguirlo de dejar de viajar: sigue viajando, ya no se pinta');
});

test('SCRUM-286 · ROJO: si un control acaba en el bloque equivocado, se dice CUÁL y DÓNDE', () => {
  const r = mutar('    blockDelivery.appendChild(payMethodsWrapper);',
    '    blockClient.appendChild(payMethodsWrapper);');
  assert.equal(r.enElBloqueEquivocado.length, 1);
  assert.match(r.enElBloqueEquivocado[0], /^payMethods: `payMethodsWrapper` está en `blockClient`/);
});

test('SCRUM-286 · ROJO: un campo NUEVO que nadie coloca no pasa en silencio', () => {
  const r = mutar('        created_via: quoteFormCreatedVia,',
    `        notas: notasInput.value,${NL}        created_via: quoteFormCreatedVia,`);
  assert.deepEqual(r.sinSitio, ['notas'],
    'un campo del payload que no está ni asignado ni declarado tiene que salir en rojo');
});

test('SCRUM-286 · ROJO: quitar un bloque entero cae nombrando SUS campos', () => {
  // El caso literal del ticket. `blockConditions` gobierna tres campos del envío.
  let mutada = FUENTE
    .replace('    blockConditions.appendChild(fieldPaymentTerms.wrapper);', '')
    .replace('    blockConditions.appendChild(stagesWrapper);', '')
    .replace('    blockConditions.appendChild(validWrapper);', '');
  assert.notEqual(mutada, FUENTE, 'la mutación no se aplicó');
  const r = revisarAsignacionDeBloques(mutada, 'quotesView.js');
  assert.deepEqual(r.sinControlEnPantalla, [
    'paymentTerms (control `fieldPaymentTerms`)',
    'customBillingPlan (control `stagesWrapper`)',
    'validUntil (control `validWrapper`)',
  ], 'vaciar el bloque de Condiciones tiene que nombrar sus tres campos, uno a uno');
});

test('SCRUM-286 · ROJO: si el censo del envío se queda ciego, falla el SUELO', () => {
  // La trampa que cazó el censo anterior: `createQuote(quotePayload)` no lleva el literal
  // dentro. Si el censo mirase el sitio equivocado devolvería CERO — y cero se lee como «no
  // hay». Aquí se comprueba que ese caso cae por el suelo, no como «7 campos perdidos».
  const mutada = FUENTE.replace('const quote = await createQuote(quotePayload);',
    'const quote = await createQuote(otroObjetoQueNoEsElPayload);');
  assert.notEqual(mutada, FUENTE, 'la mutación no se aplicó');
  const r = revisarAsignacionDeBloques(mutada, 'quotesView.js');
  assert.equal(r.clavesDeEnvio.length, 0, 'el censo debe quedarse a cero al perder el payload');
  assert.ok(!(r.clavesDeEnvio.length >= 10),
    '🔴 el suelo de «≥10 campos» tiene que ser quien caiga aquí. Sin él, este árbol reportaría ' +
    '«7 campos perdidos», que suena a diagnóstico y es ceguera.');
});

// ── CONTROLES NEGATIVOS ──────────────────────────────────────────────────────
// Un guard que se pone rojo con cualquier cosa se acaba desactivando.

test('SCRUM-286 · NEGATIVO: un cambio inocuo NO pone el guard en rojo', () => {
  const r = mutar('  const linesVatRow = document.createElement("div");',
    `  // un comentario nuevo, que no cambia nada${NL}  const linesVatRow = document.createElement("div");`);
  assert.deepEqual(
    [r.dejaronDeViajar, r.sinControlEnPantalla, r.enElBloqueEquivocado, r.sinSitio],
    [[], [], [], []],
    'añadir un comentario no puede tumbar el guard');
});

test('SCRUM-286 · NEGATIVO: reordenar DENTRO de un bloque no es un campo perdido', () => {
  // Mover un control dentro de su propio bloque es una decisión de diseño legítima; sólo cambia
  // de bloque lo que este guard vigila. Si tumbara esto, nadie podría volver a tocar el orden
  // interno sin pelearse con el test.
  const r = mutar('    blockConditions.appendChild(validWrapper);',
    '    blockConditions.appendChild(validWrapper); // mismo bloque, otro sitio');
  assert.deepEqual([r.dejaronDeViajar, r.enElBloqueEquivocado], [[], []]);
});

// ── SCRUM-271 / SCRUM-311: la forma que ya mordió en esta pantalla ───────────
test('SCRUM-286 · el reordenado NO reintroduce la cantidad inventada de SCRUM-271', () => {
  // `<input type="number">` vacío devuelve "", `Number("")` es 0, y `0 || 1` da 1 en silencio.
  // El guard vivo de SCRUM-311 vigila todo el front; esto lo comprueba en el fichero que este
  // ticket toca, para que el rojo apunte aquí si la forma vuelve por este reordenado.
  const c = censarCantidadInventada(FUENTE, RUTA);
  const vivos = c.hallazgos.filter((h) => !esExcepcion(h, c.hallazgos));
  assert.deepEqual(vivos, [],
    '🔴 una lectura de input vuelve a caer a un número distinto de cero en quotesView.js:\n' +
    vivos.map((h) => `   · ${h.ruta}:${h.linea} — \`${h.sujeto} || ${h.reserva}\``).join('\n'));
  // Suelo MEDIDO, no elegido: hoy el DETECTOR cuenta 77 lecturas de `.value` (eran 92 antes de SCRUM-598, que
  // retiró el campo del margen y sus lecturas: el número se RECUENTA, no se hereda). El margen es
  // para que un borrado legítimo no lo tumbe, no para que quepa un detector ciego.
  assert.ok(c.lecturasDeValue >= 77,
    `🔴 el detector solo vio ${c.lecturasDeValue} lecturas de \`.value\` (hoy hay 77): no está ` +
    'mirando, y un «0 hallazgos» suyo no significaría nada.');
});

// ── EL INFORME ───────────────────────────────────────────────────────────────
test('SCRUM-286 · el orden de pintado, impreso, con su POBLACIÓN declarada', () => {
  const p = R.pintado.poblacion;
  const bloques = R.pintado.orden.filter((n) => n.esBloque);
  console.log(
    `\n📐 SCRUM-286 · orden de PINTADO de «Nuevo presupuesto»\n` +
    `   POBLACIÓN — fichero:  ${p.fichero}\n` +
    `               frontera: ${p.frontera}\n` +
    `               mide:     ${p.mide}\n` +
    `               excluido: ${p.excluido}\n\n` +
    bloques.map((b, i) => `   ${i + 1}. L${String(b.linea).padStart(4)}  ${b.nombre}` +
      (b.titulo ? `  «${b.titulo}»` : '  (sin título)')).join('\n') +
    `\n\n   ASIGNACIÓN campo del envío → bloque:\n` +
    Object.entries(CAMPO_A_BLOQUE).map(([k, v]) => `     ${k.padEnd(18)} → ${v.bloque}`).join('\n') +
    `\n     ${VIAJAN_SIN_PINTARSE.join(', ')} → viajan sin pintarse (contexto)\n`,
  );
  assert.ok(bloques.length > 0);
});
