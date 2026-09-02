// tests/scrum683-parte-dictado.test.mjs — SCRUM-683
//
// LA VÍCTIMA: un instituto público al que se le factura una cámara que nadie instaló, porque el
// dictado no dijo cuántas y una máquina puso 1.
//
// Este fichero prueba UNA cosa por encima de las demás: que una cantidad que el texto no dice NO
// APARECE. Y la prueba con el contraste que decide si el trabajo hacía falta — el motor anterior,
// `cantidadUtilizable`, sobre las MISMAS entradas.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  cantidadRespaldadaPorElTexto, sanearDictadoDelParte, aLineaDelParte, PROMPT_PARTE_APROBADO,
  AVISOS_DEL_DICTADO,
} = await import('../dist/modules/jobs/domain/parteDictado.js');

// El motor de presupuestos, para el contraste. Si ÉSTE aprobara lo mismo, no habría ticket.
const { cantidadUtilizable } = await import('../dist/modules/ai/domain/lineasSugeridas.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CORPUS REAL. Cuatro líneas de un parte de Tecnosel, tal cual se dictan: con marcas mal
// escritas («acerofles» es Hikvision mal pronunciado o una marca local), sin puntuación fina y
// con un «cat 6» que lleva un número que NO es una cantidad.
// ═════════════════════════════════════════════════════════════════════════════════════════
const DICTADO_REAL = [
  'Hacer algo de canalización con acerofles y con canaleta',
  'Meter los 2 puntos de las cámaras nuevas con cable UTP cat 6',
  'Instalar las 2 cámaras minidomo Uniview',
  'Sustituir el videograbador y el disco duro',
].join('. ');

test('SCRUM-683 · SUELO: el corpus real tiene las dos clases y el módulo está cargado', () => {
  assert.equal(typeof sanearDictadoDelParte, 'function', '🔴 el módulo no exporta el saneador');
  assert.match(DICTADO_REAL, /\b2\b/, '🔴 el corpus ya no tiene ninguna cantidad dicha: no probaría el caso bueno');
  assert.match(DICTADO_REAL, /videograbador/, '🔴 el corpus ya no tiene la línea SIN cantidad: no probaría el caso que importa');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE TODO EL TICKET
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683 · 🔴 una cantidad que el texto NO DICE no aparece: ni 1, ni vacío que se lea como uno', () => {
  const dictado = 'Sustituir el videograbador y el disco duro';
  // El modelo propone de todo: lo que se calla, lo que pone a 1, y lo que se saca de la manga.
  const delModelo = [
    { bloque: 'materiales', descripcion: 'Videograbador' },                 // sin campo
    { bloque: 'materiales', descripcion: 'Disco duro', unds: 1 },           // el 1 clásico
    { bloque: 'materiales', descripcion: 'Latiguillos', unds: 4 },          // inventado del todo
  ];

  const p = sanearDictadoDelParte(delModelo, dictado);
  const todas = [...p.mano_obra, ...p.materiales, ...p.sinBloque];
  assert.equal(todas.length, 3, 'las tres líneas se PROPONEN: no desaparece ninguna');

  for (const l of todas) {
    assert.ok(!('unds' in l),
      `🔴 «${l.descripcion}» ha salido con cantidad ${l.unds} y el dictado no la dice. ` +
      'Una cantidad inventada en un parte se convierte en una cantidad FACTURADA.');
  }

  // Y no es un cero disfrazado: la clave NO ESTÁ. `undefined` y `0` se leen distinto río abajo.
  assert.equal(todas[0].unds, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(todas[0], 'unds'), '🔴 `unds` presente con valor vacío');

  // Lo retirado se ENSEÑA: el técnico tiene que saber que hubo un número y cuál era.
  assert.deepEqual(
    p.cantidadesRetiradas.map((c) => c.propuesta).sort(), [1, 4],
    '🔴 las cantidades retiradas no se están contando: quitarlas en silencio es otro fallo mudo',
  );
});

test('SCRUM-683 · 🔴 Y CAE CON EL MECANISMO VIEJO: `cantidadUtilizable` aprueba exactamente esto', () => {
  const dictado = 'Sustituir el videograbador y el disco duro';

  // El motor de presupuestos, sobre las mismas entradas. No es un defecto suyo: para un
  // presupuesto el fundador decidió justo esto el 2-ago-2026. Es la decisión que aquí se invierte.
  assert.equal(cantidadUtilizable(undefined), 1, 'el motor viejo inventa un 1 donde no hay nada');
  assert.equal(cantidadUtilizable(1), 1, 'y deja pasar el 1 que el modelo se saca solo');
  assert.equal(cantidadUtilizable(4), 4, 'y el 4 que el dictado no dice en ninguna parte');

  // El mecanismo nuevo, sobre lo mismo.
  assert.equal(cantidadRespaldadaPorElTexto(undefined, dictado), undefined);
  assert.equal(cantidadRespaldadaPorElTexto(1, dictado), undefined);
  assert.equal(cantidadRespaldadaPorElTexto(4, dictado), undefined);

  // 🔴 El contraste, dicho como aserto: si algún día los dos coincidieran, este test es el que
  // avisa de que el mecanismo nuevo dejó de aportar y alguien está protegido por una ilusión.
  assert.notEqual(
    cantidadUtilizable(undefined), cantidadRespaldadaPorElTexto(undefined, dictado),
    '🔴 el mecanismo nuevo y el viejo dan LO MISMO: entonces este ticket no hacía falta, o el ' +
    'mecanismo nuevo se ha roto y ya no protege nada.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO — con el corpus real, no con español de manual
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683 · CONTROL POSITIVO: lo que el técnico SÍ dice sobrevive, en sus dos bloques', () => {
  const delModelo = [
    { bloque: 'mano_obra', descripcion: 'Canalización con canaleta' },
    { bloque: 'mano_obra', descripcion: 'Puntos de cámara con cable UTP cat 6', unds: 2 },
    { bloque: 'materiales', descripcion: 'Cámara minidomo Uniview', unds: 2 },
    { bloque: 'materiales', descripcion: 'Videograbador y disco duro' },
  ];

  const p = sanearDictadoDelParte(delModelo, DICTADO_REAL);

  assert.equal(p.vacia, false);
  assert.equal(p.mano_obra.length, 2, 'las dos de mano de obra, en SU lista');
  assert.equal(p.materiales.length, 2, 'las dos de materiales, en la suya');
  assert.equal(p.sinBloque.length, 0);

  // El 2 lo dice el dictado dos veces: sobrevive en las dos líneas.
  assert.equal(p.mano_obra[1].unds, 2, 'el «2 puntos» que el técnico dictó tiene que quedarse');
  assert.equal(p.materiales[0].unds, 2, 'y el «2 cámaras» también');

  // Lo que no se dijo, sigue sin decirse.
  assert.ok(!('unds' in p.mano_obra[0]), 'la canalización no llevaba cantidad y sigue sin llevarla');
  assert.ok(!('unds' in p.materiales[1]), 'el videograbador tampoco');
  assert.deepEqual(p.cantidadesRetiradas, [], 'no se ha retirado nada: el modelo no inventó');
});

test('SCRUM-683 · el número dicho EN PALABRA también cuenta, y «uno» NO', () => {
  assert.equal(cantidadRespaldadaPorElTexto(3, 'estuvimos tres horas con el rack'), 3);
  assert.equal(cantidadRespaldadaPorElTexto(0.5, 'media hora de desplazamiento'), 0.5);

  // 🔴 «una» es la palabra más frecuente del castellano hablado. Aceptarla reintroduciría el 1
  // por la puerta de atrás: aquí el dictado NO está diciendo una cantidad.
  assert.equal(
    cantidadRespaldadaPorElTexto(1, 'hicimos una revision de una de las camaras'), undefined,
    '🔴 «una» se está leyendo como la cantidad 1: es exactamente el 1 inventado con otro disfraz',
  );
  // Y una palabra dentro de otra no cuenta.
  assert.equal(cantidadRespaldadaPorElTexto(6, 'pedimos seiscientos metros de cable'), undefined);
});

test('SCRUM-683 · un número pegado a otro no es una cantidad', () => {
  // «cat 6» sí lo es (el 6 está suelto y el técnico confirma); «2026» no cede un 2.
  assert.equal(cantidadRespaldadaPorElTexto(6, 'cable UTP cat 6'), 6);
  assert.equal(cantidadRespaldadaPorElTexto(2, 'el contrato de 2026'), undefined);
  assert.equal(cantidadRespaldadaPorElTexto(20, 'el contrato de 2026'), undefined);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ROJO POR EL MECANISMO: darse por buena la extracción sin confirmación
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683 · 🔴 una propuesta SIN confirmar no puede convertirse en línea del parte', () => {
  const propuesta = { descripcion: 'Cámara minidomo Uniview' };   // el dictado no dijo cuántas

  assert.throws(
    () => aLineaDelParte('materiales', propuesta, undefined),
    (e) => e.message.includes('Cámara minidomo Uniview') && /confirmada/i.test(e.message),
    '🔴 una propuesta sin cantidad confirmada ha entrado en el parte, y el parte se firma y se factura',
  );

  // Las tres formas de «no hay confirmación» caen igual, y ninguna se lee como 1.
  for (const malo of [undefined, null, 0, -2, '', 'dos', NaN]) {
    assert.throws(() => aLineaDelParte('materiales', propuesta, malo),
      `🔴 «${String(malo)}» se está aceptando como cantidad confirmada`);
  }

  // Y con la confirmación del técnico, pasa — y pasa CON SU BLOQUE.
  assert.deepEqual(aLineaDelParte('materiales', propuesta, 2),
    { bloque: 'materiales', unds: 2, descripcion: 'Cámara minidomo Uniview' });
});

test('SCRUM-683 · 🔴 el mensaje NOMBRA la línea: «no se puede» a secas manda a adivinar', () => {
  try {
    aLineaDelParte('mano_obra', { descripcion: 'Canalización con canaleta' }, null);
    assert.fail('no lanzó');
  } catch (e) {
    assert.match(e.message, /Canalización con canaleta/,
      '🔴 el error no dice QUÉ línea: el técnico no puede arreglar lo que no sabe cuál es');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO Y AUSENCIA DE RED
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683 · SUELO: sin líneas, el parte se queda EN BLANCO y lo DICE', () => {
  const vacio = sanearDictadoDelParte([], 'hicimos cosas');
  assert.equal(vacio.vacia, true);
  assert.equal(vacio.motivo, 'sin_lineas_reconocidas');
  assert.deepEqual([...vacio.mano_obra, ...vacio.materiales, ...vacio.sinBloque], [],
    '🔴 se ha rellenado algo: una propuesta vacía se dice, no se inventa');

  const sinDictado = sanearDictadoDelParte([{ descripcion: 'lo que sea', unds: 3 }], '   ');
  assert.equal(sinDictado.vacia, true);
  assert.equal(sinDictado.motivo, 'dictado_vacio',
    '🔴 sin texto dictado no hay nada contra lo que comprobar: no se puede aprobar ninguna cantidad');
});

test('SCRUM-683 · SIN RED: que el modelo no conteste NO bloquea el parte', () => {
  // Lo que llega cuando Gemini falla: nada, o basura. Ninguna forma puede lanzar — el técnico
  // sigue escribiendo a mano y el dictado del teclado funciona sin nosotros.
  for (const caido of [null, undefined, 'gemini_unreachable', {}, 0, false]) {
    const p = sanearDictadoDelParte(caido, DICTADO_REAL);
    assert.equal(p.vacia, true, `🔴 «${String(caido)}» no se ha tratado como propuesta vacía`);
    assert.equal(p.motivo, 'sin_lineas_reconocidas');
  }
});

test('SCRUM-683 · nada desaparece en silencio: un bloque ilegible va a `sinBloque`', () => {
  const p = sanearDictadoDelParte(
    [{ bloque: 'varios', descripcion: 'Ajuste del rack', unds: 2 }],
    'estuvimos con 2 ajustes del rack',
  );
  assert.equal(p.sinBloque.length, 1, '🔴 la línea se ha tirado: el técnico hizo ese trabajo');
  assert.equal(p.mano_obra.length + p.materiales.length, 0, '🔴 se le ha adivinado un bloque');
  assert.equal(p.sinBloque[0].unds, 2, 'y su cantidad, que el texto sí respalda, se conserva');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL MECANISMO NO DEPENDE DEL PROMPT
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683 · 🔴 el prompt no es el mecanismo: sin él, la protección sigue en pie', () => {
  // El prompt pide `null` cuando no se dice la cantidad. Si el modelo lo ignora por completo y
  // devuelve un 1 en todas, el saneador tiene que seguir retirándolas.
  const comoSiElPromptNoExistiera = [
    { bloque: 'mano_obra', descripcion: 'Canalización', unds: 1 },
    { bloque: 'materiales', descripcion: 'Videograbador', unds: 1 },
  ];
  const p = sanearDictadoDelParte(comoSiElPromptNoExistiera, 'Canalización y sustituir el videograbador');
  assert.ok([...p.mano_obra, ...p.materiales].every((l) => !('unds' in l)),
    '🔴 la protección dependía del prompt: si el modelo lo ignora, entran cantidades inventadas');

  // Y el prompt, APROBADO, pide lo coherente con el mecanismo: que se calle la cantidad en vez de
  // rellenarla, y que no devuelva importes.
  assert.match(PROMPT_PARTE_APROBADO, /NUNCA pongas 1 por defecto/);
  assert.match(PROMPT_PARTE_APROBADO, /NO devuelvas precios ni IVA/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// MICROCOPY APROBADA (regla 30) — literal, y sin que pueda derivar
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683 · los dos avisos aprobados son LITERALES, con su raya larga', () => {
  // Aprobados por el fundador el 2-sep-2026. Se comparan con `===` y carácter a carácter: un
  // retoque «de paso» reabre una aprobación sin que nadie se entere.
  assert.equal(AVISOS_DEL_DICTADO.dictado_vacio,
    'No se ha entendido el dictado — vuelve a dictar o escríbelo a mano');
  assert.equal(AVISOS_DEL_DICTADO.sin_lineas_reconocidas,
    'No se ha podido sacar ninguna línea — escríbelas tú');
  // 🔴 SINGULAR, y lo decidió la medición: se pinta una vez EN CADA línea sin cantidad.
  assert.equal(AVISOS_DEL_DICTADO.cantidadesRetiradas, 'Falta la cantidad — ponla tú');
  assert.doesNotMatch(AVISOS_DEL_DICTADO.cantidadesRetiradas, /Faltan|cantidades|ponlas/,
    '🔴 ha vuelto el plural: `cantidadesRetiradas` trae UNA entrada por línea, y el aviso es de ' +
    'línea. Un resumen («3 líneas sin cantidad») sería un texto DISTINTO, y lo aprueba el fundador.');

  // La raya es `—` (U+2014), UN carácter, como el aviso ya aprobado de `voiceInput.js`.
  for (const t of Object.values(AVISOS_DEL_DICTADO)) {
    assert.ok(t.includes('—'), `🔴 «${t}» no lleva la raya larga de un solo carácter`);
    assert.ok(!t.includes('--') && !t.includes('['), `🔴 «${t}» lleva guiones dobles o corchete de marcador`);
  }

});

test('SCRUM-683 · 🔴 `cantidadesRetiradas` puede traer UNA sola: por eso el aviso es SINGULAR', () => {
  // La medición que decidió la concordancia, ejercitada en vez de afirmada. Si dejara de poder
  // darse el caso de UNA sola, el singular habría que volver a preguntarlo.
  const una = sanearDictadoDelParte(
    [{ bloque: 'materiales', descripcion: 'Disco duro', unds: 1 }],
    'Sustituir el disco duro',
  );
  assert.equal(una.cantidadesRetiradas.length, 1,
    '🔴 si ya no se puede dar el caso de UNA sola, el singular aprobado deja de estar respaldado ' +
    'por el dato y hay que volver a preguntar al fundador, no cambiarlo por cuenta propia.');
  assert.equal(una.cantidadesRetiradas[0].descripcion, 'Disco duro',
    'cada entrada nombra SU línea: el dato es por línea, no un resumen');
});

test('SCRUM-683 · ⛔ este módulo no toca importes en ninguna dirección', () => {
  const conPrecios = [
    { bloque: 'materiales', descripcion: 'Cámara', unds: 2, precioUnitario: 180, tipoIva: 0.21, price: 180 },
  ];
  const p = sanearDictadoDelParte(conPrecios, 'dos cámaras');
  const linea = p.materiales[0];
  assert.deepEqual(Object.keys(linea).sort(), ['descripcion', 'unds'],
    '🔴 ha entrado algo más que descripción y unidades: en el parte firmado la columna IMPORTE va vacía');

  const delParte = aLineaDelParte('materiales', linea, 2);
  assert.deepEqual(Object.keys(delParte).sort(), ['bloque', 'descripcion', 'unds'],
    '🔴 la línea del parte lleva importes');
});
