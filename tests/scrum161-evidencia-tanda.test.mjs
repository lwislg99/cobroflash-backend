// SCRUM-161 — evidencia de que la tanda gateada corrió de verdad.
// SIN GATE: corre en `npm test`. No toca BD, ni red, ni disco: el validador recibe el TEXTO del
// recibo y devuelve el veredicto.
//
// ES LA DISTINCIÓN QUE IMPORTA: lo que va al CI es el VALIDADOR, no la exigencia. Comprobar
// que HUBO evidencia no necesita staging; solo generarla. Por eso la lógica vive aquí, ungated,
// y el que aprieta (`verificar-evidencia-tanda.mjs`) cuelga de `/yaqu-release-check`.
//
// 🔴 EL GUARD ESTÁ APAGADO (`ACTIVO = false`). Estos tests validan el MECANISMO, no que esté
// encendido — a propósito: el día que se encienda no debe hacer falta tocar ni un assert. Hay
// un test que comprueba que, apagado, el veredicto se calcula igual y no bloquea.
//
// LO QUE ESTO PERSIGUE: que el guard no acabe siendo «la misma convención humana con un paso
// más». Un guard que pregunta «¿la corriste?» y se conforma con un «sí» solo añade ceremonia.
// Por eso cada una de las seis comprobaciones tiene aquí su caso, con la trampa concreta que
// cierra escrita al lado — y cada una se verificó EN ROJO antes de darla por buena.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';

import {
  RUTA_RECIBO,
  ACTIVO,
  MOTIVO_APAGADO,
  VENTANA_MS,
  MARGEN_FUTURO_MS,
  SUELO_TOTAL,
  CLAVES_HIJOS,
  AVISO_ALCANCE,
  estaActivo,
  validarEvidencia,
  mensajeVeredicto,
  mensajeApagado,
} from '../scripts/_evidencia-tanda.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
// SCRUM-239: el ancla del recibo ya no es la identidad del commit, es la HUELLA del contenido
// del codigo. El `commit` sigue en el recibo, pero como contexto declarado. Los dos sentidos en
// que `commit === HEAD` fallaba se fijan en tests/scrum239-huella-de-codigo.test.mjs.
const HUELLA = '0123456789abcdef0123456789abcdef01234567';
const HUELLA_ACTUAL = { huella: HUELLA, ficheros: 556 };
const AHORA = Date.parse('2026-07-28T15:00:00.000Z');
const h = (n) => n * 3600000;

// SCRUM-197: cada hijo del recibo trae su DESGLOSE {exit, tests, pass, fail}, no solo el exit.
const HIJO_OK = { exit: 0, tests: 1, pass: 1, fail: 0 };
const HIJO_CRASH = { exit: 3221225794, tests: 0, pass: 0, fail: 0 }; // exit≠0 SIN fails: crasheó → «hijo»
const hijoRojo = (fail) => ({ exit: 1, tests: 640, pass: 640 - fail, fail }); // exit≠0 CON fail propio: rojo
// Todos verdes, DERIVADO de CLAVES_HIJOS (no literal): si el spec crece, la base lo sigue sola.
const todosVerdes = () => Object.fromEntries(CLAVES_HIJOS.map((k) => [k, { ...HIJO_OK }]));

/** Un recibo IMPECABLE. Cada test de abajo estropea UNA cosa y nada más. */
function reciboBueno(extra = {}) {
  return {
    commit: COMMIT,
    huella: HUELLA,
    huellaFicheros: 556,
    terminadaEn: new Date(AHORA - 60000).toISOString(),
    total: 646, pass: 646, fail: 0, skip: 0, // SCRUM-161: el suelo subió a 646 al encender (agregado real 2a1d053)
    ficheros: 337,
    hijos: todosVerdes(),
    autotest: false,
    runner: 'scripts/test-staging-gated.mjs',
    ...extra,
  };
}
const validar = (recibo, opts = {}) => validarEvidencia({
  texto: recibo === null ? null : JSON.stringify(recibo),
  commitActual: COMMIT,
  huellaActual: HUELLA_ACTUAL,
  ahoraMs: AHORA,
  ficherosEsperados: 337,
  ...opts,
});
const claves = (res) => res.problemas.map((p) => p.clave).sort();

test('SCRUM-161 · el control: un recibo bueno pasa', () => {
  const res = validar(reciboBueno());
  assert.equal(res.ok, true,
    `🔴 falso positivo: ${JSON.stringify(res.problemas)}. Un guard que grita sin motivo se ` +
    'desactiva igual que uno que no grita nunca.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS VÍAS DEL DISEÑO — una por trampa. NACIERON CUATRO (commit, rojo, ventana, suelo); el
// mecanismo creció y hoy son seis comprobaciones. El «cuatro» es historia del origen, no un
// inventario: cuenta las de verdad en los tests de abajo, no en este rótulo.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-161 · ① recibo AUSENTE → no hay evidencia', () => {
  // La trampa base: cerrar la tarea sin haber corrido nada.
  const res = validar(null);
  assert.equal(res.ok, false);
  assert.deepEqual(claves(res), ['ausente']);
  assert.match(mensajeVeredicto(res, { activo: true }), /npm run test:staging:gated/,
    'el mensaje tiene que decir qué comando arregla esto');
});

test('SCRUM-161 · ② recibo de OTRO CÓDIGO → evidencia caducada', () => {
  // La trampa: correr la tanda, seguir programando y cerrar con la evidencia de antes.
  // Es lo que separa este guard de un «sí»: caduca sola en cuanto tocas una línea.
  //
  // SCRUM-239: «tocas una línea» se mide por CONTENIDO, no por identidad de commit. Antes este
  // test movía el `commit` y esperaba `commit-viejo`; eso probaba el proxy, no la propiedad —
  // y el proxy fallaba en los dos sentidos (un commit de docs invalidaba un árbol intacto; una
  // edición sin commitear NO invalidaba nada). Los dos sentidos, en scrum239-huella-de-codigo.
  const res = validar(reciboBueno(), { huellaActual: { huella: 'f'.repeat(40), ficheros: 556 } });
  assert.equal(res.ok, false);
  assert.deepEqual(claves(res), ['codigo-cambiado']);
  assert.match(res.problemas[0].detalle, /01234567/, 'debe decir de qué código era el recibo');
});

test('SCRUM-161 · ②b un commit NUEVO con el mismo código NO caduca la evidencia', () => {
  // El otro sentido, aquí porque es donde vivía la regla vieja: anotar la tarea en el máster es
  // un commit que no toca código, y con el criterio anterior invalidaba el recibo de la tanda
  // que acababa de anotarse. El acto de registrar la prueba destruía la prueba (SCRUM-239).
  const res = validar(reciboBueno(), { commitActual: 'ffffffffffffffffffffffffffffffffffffffff' });
  assert.deepEqual(res.problemas, [], '🔴 el bucle de SCRUM-239 ha vuelto');
});

test('SCRUM-161 · ③ recibo con fail>0 → ticket y cuarentena, NUNCA re-correr', () => {
  // Un rojo real no se arregla re-corriendo: reproduce el mismo rojo y el mismo bloqueo, y un
  // mensaje que manda a repetir lo que acaba de fallar enseña a saltarse el guard. Va a ticket y
  // cuarentena (SCRUM-160), sin el pie de «corre la tanda ENTERA».
  const solo = validar(reciboBueno({ fail: 1, pass: 639 }));
  assert.equal(solo.ok, false);
  assert.deepEqual(claves(solo), ['rojo']);

  // Y EL CASO NORMAL de una tanda roja: el hijo que CONTIENE esos rojos sale exit≠0. Ese exit no
  // es información nueva —es el mismo hecho que `fail>0`—, así que NO genera clave propia. Si la
  // generara, el veredicto mostraría «cuarentena» y «re-correr» a la vez y la gente haría la fácil.
  const normal = validar(reciboBueno({ fail: 21, pass: 619, hijos: { ...todosVerdes(), qa: hijoRojo(21) } }));
  assert.equal(normal.ok, false);
  assert.deepEqual(claves(normal), ['rojo'],
    '🔴 el exit≠0 del hijo que lleva los rojos es redundante con `fail>0`: no debe dar clave');

  for (const res of [solo, normal]) {
    const msg = mensajeVeredicto(res, { activo: true });
    assert.match(msg, /cuarentena/, 'un rojo va a ticket y cuarentena (SCRUM-160)');
    assert.match(msg, /SCRUM-160/);
    assert.doesNotMatch(msg, /tanda ENTERA/, '🔴 a un rojo no se le manda a re-correr');
  }
});

test('SCRUM-161 · ③b hijo que no da resultados de fiar → «tanda no válida», y DOMINA sobre el rojo', () => {
  // Un hijo que CRASHEA sin ejecutar tests (regla A del runner) o uno ABORTADO POR TIEMPO
  // (SCRUM-181) NO agrega sus contadores: `fail` puede ser 0 con un proceso muerto y los números
  // del recibo quedan INCOMPLETOS. Eso es más grave que unos rojos —no sabemos si están todos— y
  // por eso es clave PROPIA (`hijo`) con su propio remedio: re-correr, no cuarentena.
  const timeout = validar(reciboBueno({ hijos: { ...todosVerdes(), qa: null } }));
  assert.equal(timeout.ok, false, '🔴 un hijo que NO llegó a terminar no es un hijo que pasó');
  assert.deepEqual(claves(timeout), ['hijo']);
  assert.match(timeout.problemas[0].detalle, /no llegó a terminar/);

  const muerto = validar(reciboBueno({ hijos: { ...todosVerdes(), bot: HIJO_CRASH } }));
  assert.equal(muerto.ok, false);
  assert.deepEqual(claves(muerto), ['hijo']);
  assert.match(muerto.problemas[0].detalle, /bot/);

  for (const res of [timeout, muerto]) {
    const msg = mensajeVeredicto(res, { activo: true });
    assert.match(msg, /NO ES VÁLIDA/, 'un hijo caído invalida la tanda, y hay que decirlo');
    assert.match(msg, /test:staging:gated/, 'y se arregla re-corriéndola, no con cuarentena');
    assert.doesNotMatch(msg, /cuarentena/, '🔴 un timeout/crash NO va a cuarentena — eso es de un rojo real');
  }

  // LA COEXISTENCIA REALISTA que este arreglo cierra: reds Y un hijo caído a la vez. El hijo con
  // los reds sale exit≠0 (redundante, sin clave); OTRO se cayó. Debe salir UN SOLO remedio, y es
  // el del más grave: la tanda no es válida. Ni rastro de «cuarentena» ni doble mensaje.
  const mixto = validar(reciboBueno({ fail: 21, pass: 619, hijos: { ...todosVerdes(), bot: null, qa: hijoRojo(21) } }));
  assert.equal(mixto.ok, false);
  assert.deepEqual(claves(mixto).sort(), ['hijo', 'rojo'], 'el rojo se lista, pero el hijo caído es el que manda');
  const msgMixto = mensajeVeredicto(mixto, { activo: true });
  assert.match(msgMixto, /NO ES VÁLIDA/, 'domina el remedio del hijo caído, no el del rojo');
  assert.doesNotMatch(msgMixto, /cuarentena/, '🔴 no se ponen en cuarentena rojos de una tanda incompleta');
});

test('SCRUM-197 · crash de un hijo + rojos de OTRO → tanda NO VÁLIDA, no cuarentena', () => {
  // El caso que el desglose por hijo cierra, y que la heurística vieja (hayReds) enmascaraba: un
  // hijo CRASHEA (exit≠0, fail propio 0) a la vez que OTRO tiene rojos legítimos. El agregado trae
  // fail>0, así que la lógica vieja descartaba el crash como redundante y decía «cuarentena» — sobre
  // una tanda a la que le faltan los tests del que murió. Con el fail PROPIO, el crash da clave
  // `hijo` y DOMINA. (Un null ya se cazaba; el CRASH con exit≠0 no-null es el que se escapaba.)
  const mixto = validar(reciboBueno({
    fail: 21, pass: 619,
    hijos: { ...todosVerdes(), a55: HIJO_CRASH, qa: hijoRojo(21) },
  }));
  assert.equal(mixto.ok, false);
  assert.deepEqual(claves(mixto).sort(), ['hijo', 'rojo'],
    'el rojo se lista, pero el crash del OTRO hijo es información nueva y manda');
  assert.match(mixto.problemas.find((p) => p.clave === 'hijo').detalle, /a55/, 'nombra al hijo que crasheó');
  const msg = mensajeVeredicto(mixto, { activo: true });
  assert.match(msg, /NO ES VÁLIDA/, 'domina la tanda incompleta, no la cuarentena del rojo');
  assert.doesNotMatch(msg, /cuarentena/, '🔴 no se ponen en cuarentena rojos de una tanda incompleta');
});

test('SCRUM-161 · el 4º hijo (scrum180, SCRUM-180) también se vigila: si NO da verde, el guard lo caza', () => {
  // Añadir 'scrum180' a CLAVES_HIJOS no sirve de nada si ningún caso comprueba que el guard MIRE
  // ese hijo cuando falla — que es el defecto («un hijo roto que nadie mira») que la clave cierra.
  // ANTES de SCRUM-180 (CLAVES_HIJOS = ['a55','bot','qa']) estos dos recibos pasaban en VERDE: el
  // bucle no iteraba scrum180. El contraste es la prueba de que la clave sirve, no haberla añadido.
  const crash = validar(reciboBueno({ hijos: { ...todosVerdes(), scrum180: HIJO_CRASH } }));
  assert.equal(crash.ok, false, '🔴 scrum180 con exit≠0 y sin fails (crash) tiene que invalidar la tanda');
  assert.deepEqual(claves(crash), ['hijo']);
  assert.match(crash.problemas[0].detalle, /scrum180/, 'el mensaje tiene que NOMBRAR al hijo que falló');

  const abortado = validar(reciboBueno({ hijos: { ...todosVerdes(), scrum180: null } }));
  assert.equal(abortado.ok, false, '🔴 scrum180 abortado por tiempo no es un hijo en verde');
  assert.deepEqual(claves(abortado), ['hijo']);
  assert.match(abortado.problemas[0].detalle, /no llegó a terminar/);
  assert.match(mensajeVeredicto(abortado, { activo: true }), /NO ES VÁLIDA/,
    'un hijo abortado invalida la tanda: domina el remedio de re-correr, no cuarentena');
});

test('SCRUM-161 · ④ recibo FÓSIL → la ventana temporal', () => {
  // El caso tiene que caer DENTRO del mecanismo (incidente #12): se prueba a un minuto de cada
  // lado del borde, no con un recibo de 1970 — que cualquier implementación, incluso una rota,
  // declararía viejo.
  const justoDentro = validar(reciboBueno({ terminadaEn: new Date(AHORA - VENTANA_MS + 60000).toISOString() }));
  assert.equal(justoDentro.ok, true, 'a 23 h 59 min todavía vale');

  const justoFuera = validar(reciboBueno({ terminadaEn: new Date(AHORA - VENTANA_MS - 60000).toISOString() }));
  assert.equal(justoFuera.ok, false, '🔴 pasado el borde ya no vale');
  assert.deepEqual(claves(justoFuera), ['fosil']);
});

test('SCRUM-161 · ④b un recibo fechado en el FUTURO no caducaría nunca', () => {
  const dentroDelMargen = validar(reciboBueno({ terminadaEn: new Date(AHORA + MARGEN_FUTURO_MS - 60000).toISOString() }));
  assert.equal(dentroDelMargen.ok, true, 'un reloj algo adelantado no puede bloquear a nadie');

  const imposible = validar(reciboBueno({ terminadaEn: new Date(AHORA + h(48)).toISOString() }));
  assert.equal(imposible.ok, false);
  assert.deepEqual(claves(imposible), ['fecha-imposible']);
});

test('SCRUM-161 · ⑤ EL SUELO: correr UN fichero y llamarlo tanda', () => {
  // La más importante de todas y la que más fácil se olvida: sin ella,
  // `node --test un-fichero.mjs` produce un recibo formalmente impecable.
  const unFichero = validar(reciboBueno({ total: 12, pass: 12, ficheros: 1 }));
  assert.equal(unFichero.ok, false);
  assert.deepEqual(claves(unFichero), ['ficheros', 'suelo']);

  // Y el borde, otra vez DENTRO del mecanismo, no a mil de distancia.
  assert.equal(validar(reciboBueno({ total: SUELO_TOTAL })).ok, true, 'justo en el suelo vale');
  assert.equal(validar(reciboBueno({ total: SUELO_TOTAL - 1 })).ok, false, 'uno por debajo, no');
});

test('SCRUM-161 · ⑤b el suelo EXACTO: menos ficheros de los que hay hoy en tests/', () => {
  // La versión del suelo que no necesita número mágico: caza el caso real de correr la tanda y
  // DESPUÉS añadir tests sin volver a correrla — donde `total` sigue muy por encima del suelo.
  const res = validar(reciboBueno({ ficheros: 336 }), { ficherosEsperados: 337 });
  assert.equal(res.ok, false, '🔴 336 < 337: la tanda es anterior a los tests que hay en el árbol');
  assert.deepEqual(claves(res), ['ficheros']);
  assert.equal(validar(reciboBueno({ ficheros: 337 })).ok, true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// FORMAS DE TENER UN RECIBO QUE NO PRUEBA NADA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-161 · un recibo de MODO AUTOTEST se rechaza por su nombre', () => {
  // El autotest del runner apunta los tres hijos a UN fichero: es diagnóstico, no cobertura.
  // El suelo también lo cazaría, pero por el rodeo; que se rechace nombrándolo evita mandar a
  // nadie a investigar «¿por qué solo 12 tests?» cuando la respuesta es «no era la tanda».
  const res = validar(reciboBueno({ autotest: true, total: 3, ficheros: 1 }));
  assert.equal(res.ok, false);
  assert.ok(claves(res).includes('autotest'));
});

test('SCRUM-161 · un recibo ilegible o incompleto no cuela por defecto', () => {
  const roto = validarEvidencia({ texto: '{esto no es json', commitActual: COMMIT, ahoraMs: AHORA, ficherosEsperados: 337 });
  assert.equal(roto.ok, false);
  assert.deepEqual(claves(roto), ['ilegible']);

  const vacio = validarEvidencia({ texto: '   ', commitActual: COMMIT, ahoraMs: AHORA, ficherosEsperados: 337 });
  assert.deepEqual(claves(vacio), ['ausente']);

  const lista = validarEvidencia({ texto: '[]', commitActual: COMMIT, ahoraMs: AHORA, ficherosEsperados: 337 });
  assert.deepEqual(claves(lista), ['ilegible']);

  // Un objeto vacío no puede pasar por «no encontré nada malo».
  const vacioObj = validar({});
  assert.equal(vacioObj.ok, false);
  assert.ok(claves(vacioObj).includes('incompleto'));
});

test('SCRUM-161 · falta una clave de hijo → no se lee como 0', () => {
  for (const clave of CLAVES_HIJOS) {
    // DERIVADO de CLAVES_HIJOS (no literal): con {a55,bot,qa} a mano, iterar sobre 'scrum180'
    // borraría una clave ausente y el test pasaría por coincidencia, sin probar nada de scrum180.
    const hijos = todosVerdes();
    delete hijos[clave];
    const res = validar(reciboBueno({ hijos }));
    assert.equal(res.ok, false, `🔴 sin «${clave}» el recibo pasó: un hijo ausente no es un hijo en verde`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL INTERRUPTOR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-161 · el guard está ENCENDIDO y BLOQUEA', () => {
  // Encendido el 28-jul-2026 con la tanda 2a1d053 verde (646/646/0), ensayo VÁLIDA, 126=126.
  // No basta el flag: se comprueba que el MECANISMO ACTÚA — con el guard encendido, un recibo
  // inválido produce el mensaje que BLOQUEA («no cierres la tarea»), no el aviso blando.
  assert.equal(ACTIVO, true, 'el guard quedó encendido en el commit del encendido (SCRUM-161)');
  assert.match(mensajeVeredicto(validar(null), { activo: true }), /no cierres la tarea/,
    'encendido, un recibo inválido tiene que BLOQUEAR, no avisar');
  // El camino apagado sigue vivo y coherente por si alguien vuelve a poner ACTIVO=false.
  assert.ok(MOTIVO_APAGADO.length > 80, 'si se apaga, el motivo tiene que estar escrito');
  assert.match(mensajeApagado(), /APAGADO/);
});

test('SCRUM-161 · apagado, el veredicto se calcula IGUAL — solo cambia si aprieta', () => {
  // Lo que se apaga es la exigencia, no la comprobación: el día que se encienda no puede haber
  // sorpresas sobre qué habría dicho.
  const res = validar(null);
  assert.equal(res.ok, false, 'el veredicto no depende del interruptor');
  assert.match(mensajeVeredicto(res, { activo: false }), /⚠️/, 'apagado: avisa');
  assert.match(mensajeVeredicto(res, { activo: true }), /no cierres la tarea/, 'encendido: bloquea');
});

test('SCRUM-161 · la variable de entorno ENCIENDE, y NUNCA apaga', () => {
  // ⚠️ Con el guard ENCENDIDO (ACTIVO=true) este primer assert ya NO discrimina: estaActivo({})
  // da true porque ACTIVO domina el OR — pasaría igual con la rama del env var rota. Su valor vive
  // en el camino reversible (si ACTIVO vuelve a false); probar esa rama exige inyectar ACTIVO, otro
  // alcance. Se deja dicho para que nadie lo lea como cobertura de la variable. El assert del FUENTE
  // (abajo) SÍ sigue discriminando: no depende de ACTIVO.
  assert.equal(estaActivo({}), ACTIVO);
  assert.equal(estaActivo({ YAQU_EVIDENCIA_TANDA: '1' }), true, 'puede encender para un ensayo');
  // La dirección prohibida: que exista una variable capaz de desactivarlo. Una puerta de escape
  // en un guard se acaba usando siempre, y entonces el guard no guarda nada.
  const fuente = leerFuente(path.join(RAIZ, 'scripts', '_evidencia-tanda.mjs'));
  assert.doesNotMatch(fuente, /YAQU_EVIDENCIA_TANDA\s*(===|==|!==|!=)\s*['"]0['"]/,
    '🔴 hay una comparación con "0": eso sería una puerta para APAGARLO desde el entorno');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ALCANCE, ESCRITO DONDE SE LEE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-161 · el aviso de alcance dice las dos cosas, y se IMPRIME', () => {
  // No basta con tenerlo en el fuente: la confusión que hay que evitar («ya tenemos CI de los
  // gateados») se produce leyendo la SALIDA, no el código. Por eso el CLI lo imprime siempre,
  // pase o no pase la validación.
  assert.match(AVISO_ALCANCE, /olvido/i);
  assert.match(AVISO_ALCANCE, /mala fe/i);
  assert.match(AVISO_ALCANCE, /NO sustituye a un CI/i);

  const cli = leerFuente(path.join(RAIZ, 'scripts', 'verificar-evidencia-tanda.mjs'));
  assert.match(cli, /process\.stdout\.write\(AVISO_ALCANCE\)/,
    '🔴 el aviso tiene que salir por pantalla, no solo vivir en un comentario');
});

test('SCRUM-161 · el recibo NO se commitea', () => {
  // Si viajara con la rama sería un artefacto que se COPIA entre ramas, y una prueba que se
  // copia deja de probar nada. Mismo motivo que el sentinel de `db push`.
  const ignore = leerFuente(path.join(RAIZ, '.gitignore'), { conComentarios: true });
  assert.ok(ignore.split('\n').some((l) => l.trim() === RUTA_RECIBO),
    `🔴 ${RUTA_RECIBO} no está en .gitignore`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RUNNER — que el recibo lo escriba ÉL, y en el sitio correcto
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-161 · el recibo lo escribe el runner, con los exit REALES de sus hijos', () => {
  const fuente = leerFuente(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'));
  assert.match(fuente, /writeFileSync\(RUTA_RECIBO/, 'el runner tiene que escribirlo');
  assert.match(fuente, /hijos: desgloseHijos/, 'y con el desglose real por hijo (SCRUM-197), no con ceros optimistas');
  // SCRUM-199: las claves ya NO son literales en el runner — se DERIVAN de HIJOS_SPEC. Se comprueba
  // que el runner construye los hijos Y el mapa de exits DESDE el spec: así toda clave queda cubierta
  // por construcción, no por una lista a mano que hubiera que mantener en paralelo (el hueco que cerró
  // SCRUM-199). Que las claves NO reaparezcan como literales lo vigila scrum199-fuente-unica-hijos.
  assert.match(fuente, /hijos\s*=\s*HIJOS_SPEC\.map/, 'los hijos se construyen iterando HIJOS_SPEC (fuente única)');
  assert.match(fuente, /desgloseHijos\s*=\s*Object\.fromEntries\(hijos\.map/, 'el mapa de desgloses se deriva de los hijos, no se enumera (SCRUM-197)');
});

test('SCRUM-161 · el recibo se escribe DESPUÉS de los guards de «no pude comprobar»', () => {
  // Turno ajeno (5), preflight sin veredicto (2), números que no cuadran (3) y árbol movido (4)
  // son todos casos en los que los números NO son evidencia de nada. Un recibo escrito antes de
  // esas puertas diría más de lo que se sabe — y encima con pinta de bueno.
  const fuente = leerFuente(path.join(RAIZ, 'scripts', 'test-staging-gated.mjs'));
  const iArbol = fuente.indexOf('CODIGO_SALIDA_ARBOL_MOVIDO)');
  const iRecibo = fuente.indexOf('writeFileSync(RUTA_RECIBO');
  assert.ok(iArbol > 0 && iRecibo > 0);
  assert.ok(iRecibo > iArbol,
    '🔴 el recibo se escribe ANTES del guard del árbol movido: estaría certificando una tanda ' +
    'que leyó artefactos reescritos a mitad.');
});
