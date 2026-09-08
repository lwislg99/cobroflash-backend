// tests/scrum686-cabecera-y-pie-viajan.test.mjs — SCRUM-686
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CLASIFICAR NO ES QUE VIAJEN. Y ésa es la diferencia entre apagar un rojo y arreglar algo.
//
// SCRUM-593 (DOC-03) añadió `quotes.doc_header_text` y `quotes.doc_footer_text`. El trinquete de
// SCRUM-655b los cazó sin clasificar y puso `main` en rojo — **haciendo bien su trabajo**: sólo
// puede ver el esquema del árbol en el que corre, y los dos carriles se mergearon sin verse.
//
// Añadirlos a `REVISION_HEREDA` apaga ese rojo. **Y no prueba nada sobre el dato.** El bucle de
// `nuevaRevisionDe` copia con `if (campo in anterior)`: si quien la llama no trae el campo en el
// objeto —un `select` de Prisma que no lo pida, un DTO que lo recorte—, el dato NO llega aunque
// esté clasificado. Es «mencionar no es hacer» con otra ropa, y el precio lo paga el profesional:
// la revisión nace sin la cabecera y el pie que él escribió, y no se entera hasta que su cliente
// le dice que faltan.
//
// Así que aquí se ejercita el COPIADO, no la lista:
//   ① VIAJAN         — con valor real, y se recuperan IGUALES.
//   ② 🔴 POSITIVO    — si se quita el copiado, esto CAE nombrando el campo.
//   ③ 🔴 NEGATIVO    — un campo que NO hereda no lo tumba.
//   ④ SUELO          — si el censo de campos sale vacío, falla.
//
// Sin gate: `nuevaRevisionDe` es pura. Ni BD, ni red, ni navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nuevaRevisionDe, REVISION_HEREDA, REVISION_NO_HEREDA,
} from '../dist/modules/quotes/domain/revision.js';

/** Los dos campos de este ticket, con texto que un profesional escribiría de verdad. */
const CABECERA = 'Tecnosel Instalaciones · Presupuesto sujeto a revisión de obra';
const PIE = 'Forma de pago: 50 % a la aceptación, 50 % a la entrega. IVA no incluido.';

/**
 * Una versión anterior como la que arma el llamador: el número base, la revisión y el contenido.
 * Se construye con TODOS los campos que hereda, para que el copiado se ejercite entero y no sólo
 * sobre los dos de este ticket.
 */
function anteriorCon(extra = {}) {
  const base = {
    merchantId: 71, // NO el demo (id 1): SCRUM-409 — ahí la política de WhatsApp, el PDF y la
                   // pasarela se comportan distinto, y un fixture en el demo desactiva comprobaciones
    quoteNumber: 'P2004226',
    revision: 1,
    docHeaderText: CABECERA,
    docFooterText: PIE,
  };
  for (const campo of REVISION_HEREDA) {
    if (!(campo in base)) base[campo] = `valor-de-${campo}`;
  }
  return { ...base, ...extra };
}

// ═══ ④ SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-686 · 🔴 SUELO: las listas traen campos y los dos del ticket están clasificados', () => {
  assert.ok(REVISION_HEREDA.length >= 10,
    `🔴 CENSO CIEGO: sólo ${REVISION_HEREDA.length} campos en REVISION_HEREDA. Si la lista se ` +
    'vaciara, todo lo de abajo sería cierto sobre un conjunto vacío — y «viajan» significaría ' +
    '«no había nada que viajara».');
  for (const campo of ['docHeaderText', 'docFooterText']) {
    assert.ok(REVISION_HEREDA.includes(campo),
      `🔴 «${campo}» ha salido de REVISION_HEREDA. Si se movió a otra lista a propósito, este ` +
      'fichero entero deja de aplicar y hay que decirlo aquí con su motivo (SCRUM-686).');
    assert.ok(!(campo in REVISION_NO_HEREDA),
      `🔴 «${campo}» está en LAS DOS listas: entonces la clasificación no significa nada.`);
  }
});

// ═══ ① QUE VIAJAN — el copiado, ejercitado ══════════════════════════════════════════════

test('SCRUM-686 · ① la cabecera y el pie LLEGAN a la revisión, con su valor', () => {
  const nueva = nuevaRevisionDe(anteriorCon(), 2);

  assert.equal(nueva.docHeaderText, CABECERA,
    '🔴 LA CABECERA NO VIAJA A LA REVISIÓN. El profesional la escribió una vez y la revisión ' +
    'nace sin ella: su cliente recibe un documento que se ve distinto del que aprobó, y nadie se ' +
    'entera hasta que lo dice el cliente.');
  assert.equal(nueva.docFooterText, PIE,
    '🔴 EL PIE NO VIAJA A LA REVISIÓN. Ahí es donde suele ir la forma de pago: perderlo cambia ' +
    'lo que el cliente cree que ha aceptado.');

  // Y que la revisión es la revisión, no una copia con otro nombre: lo que la identifica cambia.
  assert.equal(nueva.revision, 2);
  assert.equal(nueva.quoteNumber, 'P2004226', '🔴 el número BASE no puede cambiar al revisar.');
  assert.equal(nueva.status, 'draft');
  assert.equal(nueva.createdVia, 'revision');
});

test('SCRUM-686 · ① y viajan TAL CUAL: no se recortan, no se normalizan, no se rellenan', () => {
  // El texto es del profesional (regla 30). Si alguien mete un `.trim()` o un `.slice()` por el
  // camino, el documento del cliente cambia sin que nadie lo haya decidido.
  const raros = {
    docHeaderText: '  Con espacios al principio y al final  ',
    docFooterText: 'Dos líneas\ncon salto y «comillas» y ñ',
  };
  const nueva = nuevaRevisionDe(anteriorCon(raros), 2);
  assert.equal(nueva.docHeaderText, raros.docHeaderText,
    '🔴 la cabecera ha llegado MODIFICADA. Copiar es copiar: el texto es del profesional.');
  assert.equal(nueva.docFooterText, raros.docFooterText,
    '🔴 el pie ha llegado MODIFICADO.');
});

test('SCRUM-686 · ① un campo AUSENTE en el anterior no se inventa (y no revienta)', () => {
  // El bucle copia `if (campo in anterior)`. Si el llamador no lo trae, la revisión NO debe
  // inventarse un valor — pero tampoco puede petar. Se comprueba que sale limpio.
  const sinCabecera = anteriorCon();
  delete sinCabecera.docHeaderText;
  const nueva = nuevaRevisionDe(sinCabecera, 2);
  assert.ok(!('docHeaderText' in nueva),
    '🔴 la revisión se ha inventado una cabecera que el anterior no traía. Un valor inventado en ' +
    'un documento del profesional es peor que un hueco.');
  assert.equal(nueva.docFooterText, PIE, '🔴 y el pie, que sí venía, tiene que seguir viajando.');
});

// ═══ ② 🔴 CONTROL POSITIVO: que este test SEPA caer ═════════════════════════════════════
//
// Sin esto, los asserts de arriba podrían estar pasando porque `nuevaRevisionDe` devuelve un
// objeto con todo, o porque el corpus ya trae lo que se le pregunta. Se reproduce el COPIADO con
// una lista a la que le falta un campo y se comprueba que la ausencia se detecta — que es lo que
// pasaría si alguien quitara el campo de `REVISION_HEREDA` o rompiera el bucle.

/** El mismo copiado que hace `nuevaRevisionDe`, con la lista que se le dé. Para poder mutilarla. */
function copiarCon(lista, anterior) {
  const nueva = {};
  for (const campo of lista) if (campo in anterior) nueva[campo] = anterior[campo];
  return nueva;
}

test('SCRUM-686 · ② 🔴 POSITIVO: si el copiado pierde el campo, se DETECTA y se NOMBRA', () => {
  const anterior = anteriorCon();

  // Suelo del propio control: con la lista ENTERA, los dos llegan. Si esto fallara, lo de abajo
  // pasaría por el motivo equivocado.
  const completo = copiarCon(REVISION_HEREDA, anterior);
  assert.equal(completo.docHeaderText, CABECERA, '🔴 el control no reproduce el copiado real.');
  assert.equal(completo.docFooterText, PIE);

  // Y ahora la mutilación: fuera `docHeaderText` de la lista.
  const mutilada = REVISION_HEREDA.filter((c) => c !== 'docHeaderText');
  const roto = copiarCon(mutilada, anterior);

  const perdidos = ['docHeaderText', 'docFooterText'].filter((c) => roto[c] !== anterior[c]);
  assert.deepEqual(perdidos, ['docHeaderText'],
    '🔴 quitar `docHeaderText` del copiado NO se ha detectado. Entonces los asserts de arriba no ' +
    'miden el viaje del dato: miden otra cosa, y un cambio que rompiera el copiado pasaría en verde.');
  assert.equal(roto.docFooterText, PIE,
    '🔴 mutilar UN campo ha afectado al otro: el detector no distingue cuál se ha perdido.');
});

// ═══ ③ 🔴 CONTROL NEGATIVO ══════════════════════════════════════════════════════════════

test('SCRUM-686 · ③ 🔴 NEGATIVO: lo que NO hereda no llega, y eso NO es un fallo', () => {
  // La firma, el token y el cobro son hechos de la versión ANTERIOR. Que no viajen es la conducta
  // correcta: una revisión no nace firmada. Si este test cayera al añadir un campo a
  // `REVISION_NO_HEREDA`, el guard se habría vuelto un generador de rojos por decisiones legítimas.
  const NO_HEREDAN = Object.keys(REVISION_NO_HEREDA); // es un Record campo -> motivo, no un array
  assert.ok(NO_HEREDAN.length > 0, '🔴 SUELO: sin campos en NO_HEREDA esto no prueba nada.');

  const anterior = anteriorCon();
  for (const campo of NO_HEREDAN) anterior[campo] = `NO-DEBE-VIAJAR-${campo}`;

  const nueva = nuevaRevisionDe(anterior, 2);
  const colados = NO_HEREDAN.filter((c) => nueva[c] !== undefined);
  assert.deepEqual(colados, [],
    '🔴 HAN VIAJADO CAMPOS QUE NO DEBEN:\n    ' + colados.join('\n    ') +
    '\n\n  Una revisión que nace con la firma o el cobro de la versión anterior es peor que una ' +
    'que nace vacía: parece aceptada sin que nadie la haya aceptado.');

  // Y la otra mitad del negativo: tocarlos no ha estropeado el viaje de los que SÍ heredan.
  assert.equal(nueva.docHeaderText, CABECERA,
    '🔴 poner valores en los campos que no heredan ha tumbado el viaje de la cabecera.');
  assert.equal(nueva.docFooterText, PIE);
});
