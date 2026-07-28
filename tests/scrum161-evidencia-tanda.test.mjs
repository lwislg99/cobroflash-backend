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
// Por eso cada una de las cuatro comprobaciones tiene aquí su caso, con la trampa concreta que
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
const AHORA = Date.parse('2026-07-28T15:00:00.000Z');
const h = (n) => n * 3600000;

/** Un recibo IMPECABLE. Cada test de abajo estropea UNA cosa y nada más. */
function reciboBueno(extra = {}) {
  return {
    commit: COMMIT,
    terminadaEn: new Date(AHORA - 60000).toISOString(),
    total: 640, pass: 640, fail: 0, skip: 0,
    ficheros: 337,
    hijos: { a55: 0, bot: 0, qa: 0 },
    autotest: false,
    runner: 'scripts/test-staging-gated.mjs',
    ...extra,
  };
}
const validar = (recibo, opts = {}) => validarEvidencia({
  texto: recibo === null ? null : JSON.stringify(recibo),
  commitActual: COMMIT,
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
// LAS CUATRO VÍAS DEL DISEÑO — una por trampa
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-161 · ① recibo AUSENTE → no hay evidencia', () => {
  // La trampa base: cerrar la tarea sin haber corrido nada.
  const res = validar(null);
  assert.equal(res.ok, false);
  assert.deepEqual(claves(res), ['ausente']);
  assert.match(mensajeVeredicto(res, { activo: true }), /npm run test:staging:gated/,
    'el mensaje tiene que decir qué comando arregla esto');
});

test('SCRUM-161 · ② recibo de OTRO COMMIT → evidencia caducada', () => {
  // La trampa: correr la tanda, seguir programando y cerrar con la evidencia de antes.
  // Es lo que separa este guard de un «sí»: caduca sola en cuanto tocas una línea.
  const res = validar(reciboBueno({ commit: 'ffffffffffffffffffffffffffffffffffffffff' }));
  assert.equal(res.ok, false);
  assert.deepEqual(claves(res), ['commit-viejo']);
  assert.match(res.problemas[0].detalle, /ffffffff/, 'debe decir de qué commit era el recibo');
});

test('SCRUM-161 · ③ recibo con fail>0 → «la corrí» habiendo salido en rojo', () => {
  const res = validar(reciboBueno({ fail: 1, pass: 639 }));
  assert.equal(res.ok, false);
  assert.deepEqual(claves(res), ['rojo']);
});

test('SCRUM-161 · ③b un hijo en rojo con fail=0 → los DOS criterios, no uno', () => {
  // Por qué hacen falta los dos: un hijo que CRASHEA sin ejecutar tests (regla A del runner) o
  // uno ABORTADO POR TIEMPO (SCRUM-181) NO agrega sus contadores. `fail` sigue siendo 0 y la
  // tanda es basura. Mirando solo `fail`, este recibo pasaría.
  const crash = validar(reciboBueno({ hijos: { a55: 0, bot: 3221225794, qa: 0 } }));
  assert.equal(crash.ok, false);
  assert.deepEqual(claves(crash), ['rojo']);
  assert.match(crash.problemas[0].detalle, /bot/);

  const timeout = validar(reciboBueno({ hijos: { a55: 0, bot: 0, qa: null } }));
  assert.equal(timeout.ok, false, '🔴 un hijo que NO llegó a terminar no es un hijo que pasó');
  assert.match(timeout.problemas[0].detalle, /no llegó a terminar/);
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
    const hijos = { a55: 0, bot: 0, qa: 0 };
    delete hijos[clave];
    const res = validar(reciboBueno({ hijos }));
    assert.equal(res.ok, false, `🔴 sin «${clave}» el recibo pasó: un hijo ausente no es un hijo en verde`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL INTERRUPTOR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-161 · el guard está APAGADO y dice por qué', () => {
  assert.equal(ACTIVO, false,
    'si esto ya es true, la tanda debería estar verde (o cada rojo con ticket y cuarentena, ' +
    'SCRUM-160) y este assert es lo que hay que actualizar CONSCIENTEMENTE.');
  assert.ok(MOTIVO_APAGADO.length > 80, 'un interruptor sin motivo escrito nadie sabe cuándo tocarlo');
  assert.match(mensajeApagado(), /APAGADO/);
  assert.match(mensajeApagado(), /no bloquea/i);
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
  assert.match(fuente, /hijos: exitHijos/, 'y con los exit reales, no con ceros optimistas');
  for (const clave of CLAVES_HIJOS) {
    assert.match(fuente, new RegExp(`clave: '${clave}'`), `falta la clave «${clave}» en el runner`);
  }
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
