// SCRUM-273 · EL REGISTRO DE TRABAJO SALE DEL MÁSTER. El conflicto no se resuelve mejor:
// deja de existir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PROBLEMA, MEDIDO
//
// El 2-ago-2026 **siete ramas distintas chocaron en `docs/YAQU_MASTER.md`**, todas por lo mismo:
// cada ticket añade su entrada al final de la misma sección, y cuatro sesiones a la vez escriben
// en el mismo punto. Cada choque cuesta ~10 min de sesión más una vuelta con el fundador.
//
// Y el coste peor no es el tiempo: **resolver conflictos a mano en la única fuente de verdad del
// proyecto es la operación de más riesgo que se hace aquí**, y se hizo siete veces en un día. Ya
// rozó — en la rama de SCRUM-234 el script de resolución ancló con `$` sobre un fichero en CRLF,
// encontró 2 de 3 marcadores y abortó. Sin ese guard habría dejado un `=======` dentro del máster.
//
// LA GEOMETRÍA, que es la causa y no la mala suerte: el máster tiene **1713 líneas y 110
// entradas**, pero **las últimas 12 viven entre las líneas 1406 y 1449** — el 11 % de las
// entradas en el 2,5 % del fichero, y ahí escriben cuatro sesiones. No es que el documento sea
// grande: es que todo el mundo apunta al mismo sitio.
//
// LA CAUSA RAÍZ, un nivel más abajo: el máster mezcla **lo que casi nunca cambia** (reglas 1-36,
// decisiones, estrategia) con **lo que cambia cinco veces al día** (el registro de trabajo). Esa
// mezcla es lo que hace que un apunte rutinario toque el documento más delicado del repo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA SOLUCIÓN: UN FICHERO POR TICKET
//
// Las entradas NUEVAS van a `docs/master/SCRUM-<n>.md`. **Dos ficheros nunca colisionan porque
// dos tickets nunca tienen el mismo número.** Mismo principio que SCRUM-207 (imposible mejor que
// vigilado) y que 251/254 (cero superficie mejor que superficie filtrada).
//
// LO QUE NO CAMBIA, y conviene decirlo porque es lo que la gente teme al leer esto:
//   · **La primacía del máster no se toca.** Sigue siendo la fuente de verdad sobre reglas,
//     decisiones y estrategia (regla 35). Esto cambia DÓNDE se escribe el registro, no QUÉ manda.
//   · **El histórico NO se migra.** Las 110 entradas se quedan exactamente donde están, con su
//     redacción y su orden. Reescribir 476 KB para esto sería aceptar hoy justo el riesgo que el
//     ticket elimina.
//   · **No se duplica ni se enlaza hacia atrás.** Quien busca SCRUM-243 lo encuentra en el
//     máster; quien busque SCRUM-274 lo encontrará en `docs/master/`. Un puntero fechado explica
//     el corte. Dos verdades sobre la misma entrada sería el defecto que este ticket evita,
//     cometido por el propio arreglo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO SE CONGELA POR NÚMERO **Y CANTIDAD**, no por línea
//
// Por línea sería inútil: cualquier edición diez líneas más arriba pondría el guard en rojo, y un
// guard que grita sin motivo se acaba puenteando igual que uno que no grita nunca (SCRUM-182/203).
//
// Y no basta el número a secas: hoy hay **7 tickets con más de una entrada** (139 tiene SEIS,
// 245 tiene tres), porque una enmienda posterior es legítima. Si el censo guardase solo el
// conjunto de números, añadir una entrada NUEVA sobre un ticket YA presente pasaría inadvertida —
// justo el hueco por el que se colaría la costumbre otra vez. Por eso se congela `número → cuántas`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(RAIZ, 'docs', 'YAQU_MASTER.md');
const DIR_REGISTRO = path.join(RAIZ, 'docs', 'master');

/**
 * Las 110 entradas que había en `main` el 3-ago-2026, por número de ticket y cuántas tiene cada
 * uno. Congelado a propósito: lo que se vigila es que no CREZCA, no cuáles son.
 */
const CENSO = {
  3: 1, 10: 1, 11: 1, 12: 1, 13: 1, 17: 1, 27: 1, 28: 1, 31: 1, 32: 1, 33: 1, 34: 1,
  43: 1, 44: 1, 45: 1, 55: 2, 62: 1, 65: 1, 66: 1, 67: 1, 68: 1, 71: 1, 73: 1, 74: 1,
  75: 1, 78: 1, 80: 1, 82: 1, 83: 1, 85: 1, 90: 1, 92: 1, 93: 1, 94: 1, 98: 1, 102: 1,
  105: 1, 109: 1, 115: 1, 117: 1, 119: 1, 120: 1, 128: 1, 129: 1, 130: 1, 132: 1, 133: 1, 134: 1,
  135: 1, 136: 1, 138: 1, 139: 6, 140: 1, 141: 1, 147: 1, 149: 1, 151: 2, 153: 1, 161: 1, 162: 1,
  164: 1, 168: 1, 170: 1, 171: 2, 175: 1, 178: 1, 182: 1, 183: 2, 188: 1, 198: 1, 200: 1, 201: 1,
  202: 1, 203: 1, 205: 2, 206: 1, 207: 1, 219: 1, 222: 1, 227: 1, 228: 1, 232: 1, 234: 1, 235: 1,
  237: 1, 239: 1, 243: 1, 245: 3, 247: 1, 249: 1, 250: 1, 254: 1, 259: 1, 260: 1, 262: 1, 263: 1,
  265: 1, 271: 1, 272: 1,
};
const TOTAL_CENSADAS = Object.values(CENSO).reduce((a, b) => a + b, 0);   // 111
// SCRUM-271 se sumo durante el rebase de este mismo ticket: entro en main mientras se
// construia. Es, literalmente, el ultimo choque que este fichero va a tener.

/** Cuenta las entradas de trabajo del máster, por número de ticket. */
function entradasDelMaster() {
  const texto = fs.readFileSync(MASTER, 'utf8');
  const cuenta = {};
  for (const m of texto.matchAll(/^> \*\*✅ SCRUM-(\d+)/gm)) {
    const n = Number(m[1]);
    cuenta[n] = (cuenta[n] || 0) + 1;
  }
  return cuenta;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-273 · SUELO: el extractor encuentra las entradas que ya existen', () => {
  // El guard de abajo es NEGATIVO («no hay ninguna nueva»). Un cero es la respuesta buena y
  // también la de un extractor ciego: si el patrón dejara de casar —porque alguien cambia el
  // formato, o porque el fichero se lee mal—, no habría entradas nuevas NUNCA y el máster
  // volvería a ser barra libre sin que nadie se entere.
  const cuenta = entradasDelMaster();
  const total = Object.values(cuenta).reduce((a, b) => a + b, 0);

  assert.ok(total >= TOTAL_CENSADAS,
    `🔴 el extractor encuentra ${total} entradas y el censo declara ${TOTAL_CENSADAS}. ` +
    'Menos no significa que se hayan borrado: significa que el patrón dejó de reconocerlas, y ' +
    'entonces el guard de abajo pasa en verde sobre un fichero que no está mirando.');

  // Y que reconoce el caso difícil: los tickets con varias entradas.
  assert.equal(cuenta[139], CENSO[139],
    '🔴 SCRUM-139 tiene 6 entradas en el máster y el extractor no las cuenta todas: si no sabe ' +
    'contar repetidos, tampoco detectará una entrada NUEVA sobre un ticket ya presente.');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-273 · ninguna entrada de trabajo NUEVA se escribe en YAQU_MASTER.md', () => {
  const cuenta = entradasDelMaster();

  const nuevas = Object.entries(cuenta)
    .filter(([n, c]) => !(n in CENSO) || c > CENSO[n])
    .map(([n, c]) => (n in CENSO
      ? `SCRUM-${n}: el censo declara ${CENSO[n]} entrada(s) y hay ${c}`
      : `SCRUM-${n}: ticket NUEVO, ${c} entrada(s)`));

  assert.deepEqual(nuevas, [],
    '🔴 HAY UNA ENTRADA DE TRABAJO NUEVA EN EL MÁSTER:\n    ' + nuevas.join('\n    ') +
    '\n\n  El registro de trabajo ya no vive aquí. Cada ticket escribe su entrada en su propio\n' +
    '  fichero: `docs/master/SCRUM-<n>.md`.\n\n' +
    '  No es una preferencia de orden. El 2-ago-2026 SIETE ramas chocaron en este fichero en un\n' +
    '  solo día, y resolver conflictos a mano en la única fuente de verdad del proyecto es la\n' +
    '  operación de más riesgo que se hace aquí — una de esas veces estuvo a punto de dejar un\n' +
    '  marcador `=======` dentro del máster. Con un fichero por ticket el conflicto no se\n' +
    '  resuelve mejor: NO PUEDE OCURRIR, porque dos tickets no comparten número.\n\n' +
    '  ⚠️ Esto NO afecta a las reglas, las decisiones ni la estrategia: eso sigue viviendo aquí\n' +
    '  y el máster sigue siendo la fuente de verdad (regla 35). Cambia dónde se escribe el\n' +
    '  REGISTRO, no qué manda.');
});

// ── EL FORMATO DEL NUEVO REGISTRO ────────────────────────────────────────────────────────

/**
 * EL MENSAJE DICE QUÉ HACER EN SU LUGAR, no solo qué está prohibido.
 *
 * Tres sesiones distintas crearon un fichero suelto en tres días —`SCRUM-403-ESPEC-COLUMNAS.md`,
 * `SCRUM-242-RUNBOOK.md` y `SCRUM-406-canal.md`—. Tres personas cometiendo el MISMO error no es un
 * despiste: es que el mensaje decía qué estaba prohibido y **no decía qué hacer cuando el contenido
 * no cabe en la entrada**, y entonces la salida obvia es crear un fichero al lado.
 *
 * Mismo arreglo que en el guard de SCRUM-391: un mensaje que acusa sin dar salida empuja a pedir
 * una excepción. Las dos salidas van AQUÍ, en el texto que se lee cuando el guard se pone rojo.
 */
const MENSAJE_MAL_NOMBRADOS = (malNombrados) =>
  '🔴 hay ficheros en docs/master/ que no siguen `SCRUM-<n>.md`:\n    ' + malNombrados.join('\n    ')
  + '\n\n  El nombre NO es cosmético: es lo que garantiza que dos tickets nunca escriban en el\n'
  + '  mismo fichero, que es la propiedad entera de este ticket. Un nombre libre reintroduce la\n'
  + '  colisión por la puerta de atrás.\n\n'
  + '  QUÉ HACER EN SU LUGAR — hay dos salidas, y ninguna es crear un fichero al lado:\n\n'
  + '    · Si es REGISTRO DE TRABAJO: va como SECCIÓN dentro de `SCRUM-<n>.md`. Si ese fichero\n'
  + '      ya existe, se añade como APÉNDICE al final y NO se borra nada de lo que hubiera\n'
  + '      (precedente: `SCRUM-244.md`, que lleva dos entradas seguidas).\n\n'
  + '    · Si es un documento OPERATIVO (runbook, procedimiento, algo que alguien EJECUTA):\n'
  + '      va a `docs/RUNBOOKS.md`, y la entrada `SCRUM-<n>.md` lo NOMBRA con su ruta. Así el\n'
  + '      que busca el procedimiento lo encuentra donde viven los procedimientos, y el que lee\n'
  + '      el ticket sabe que existe.'
  // SCRUM-414 · LA TERCERA COSA: la salida sirve de poco si el rojo sigue llegando por el PR.
  + '\n\n  Y CÓMO COMPROBARLO ANTES DE EMPUJAR — este no es el único guard que vigila una\n'
  + '  entrada del registro: son CUATRO (273, 267, 391, 242), y cada sesión los ha ido\n'
  + '  descubriendo EN ROJO ya con el PR abierto. Los cuatro juntos, en segundos:\n\n'
  + '      npm run guards:entrada\n';

test('SCRUM-273 · los ficheros de docs/master/ se llaman como su ticket', () => {
  assert.ok(fs.existsSync(DIR_REGISTRO),
    '🔴 no existe docs/master/. Es donde vive el registro desde SCRUM-273.');

  const malNombrados = fs.readdirSync(DIR_REGISTRO)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .filter((f) => !/^SCRUM-\d+\.md$/.test(f));

  assert.deepEqual(malNombrados, [], MENSAJE_MAL_NOMBRADOS(malNombrados));
});

test('SCRUM-273 · 🔴 el mensaje del guard ENUNCIA LA ALTERNATIVA, no solo la prohibición', () => {
  // Este test existe porque el mensaje anterior ya empujó a tres sesiones a crear un fichero
  // suelto. Si alguien lo recorta «para que sea más corto», vuelve el mismo error dentro de una
  // semana: lo que evita la reincidencia no es la regla, es la SALIDA escrita en el rojo.
  const m = MENSAJE_MAL_NOMBRADOS(['SCRUM-999-ejemplo.md']);

  const exigido = [
    [/SECCIÓN dentro de `SCRUM-<n>\.md`/, 'la salida 1: va como sección dentro de la entrada'],
    [/AP[ÉE]NDICE|apéndice/, 'que si el fichero ya existe, se añade como apéndice'],
    [/NO se borra nada/, 'que no se borra nada de lo que hubiera'],
    [/docs\/RUNBOOKS\.md/, 'la salida 2: los documentos operativos van a docs/RUNBOOKS.md'],
    [/NOMBRA/, 'que la entrada nombra el runbook con su ruta'],
    // SCRUM-414 · y la tercera: cómo comprobarlo antes de empujar.
    [/npm run guards:entrada/, 'CÓMO comprobarlo antes de empujar: `npm run guards:entrada`'],
    [/CUATRO \(273, 267, 391, 242\)/, 'que son CUATRO los guards de entrada, y cuáles son'],
  ];
  const faltan = exigido.filter(([re]) => !re.test(m)).map(([, q]) => q);
  assert.deepEqual(faltan, [],
    '🔴 al mensaje del guard le falta enunciar:\n    - ' + faltan.join('\n    - ')
    + '\n\n  Un mensaje que acusa sin dar salida empuja a pedir una excepción, o a crear un\n'
    + '  fichero al lado. Ya pasó tres veces en tres días con tres sesiones distintas.');

  // Y que el fichero que se acusa se siga NOMBRANDO: una salida sin el culpable obliga a
  // buscarlo a mano.
  assert.match(m, /SCRUM-999-ejemplo\.md/,
    '🔴 el mensaje ya no nombra el fichero mal nombrado: la salida sin el culpable no sirve');
});

test('SCRUM-273 · el mensaje bueno es el que se USA de verdad', () => {
  // Anti-verde-hueco: sin esto, alguien puede dejar `MENSAJE_MAL_NOMBRADOS` intacto (test de
  // arriba en verde) y a la vez volver a poner un texto corto en línea dentro del `assert`. El
  // guard seguiría acusando sin dar salida, y nadie se enteraría.
  const fuente = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.match(fuente, /assert\.deepEqual\(malNombrados, \[\], MENSAJE_MAL_NOMBRADOS\(malNombrados\)\)/,
    '🔴 la aserción de nombres ya no usa `MENSAJE_MAL_NOMBRADOS`: el mensaje con las salidas está\n'
    + '  escrito pero no es el que ve quien rompe la regla.');
});

test('SCRUM-273 · el máster dice dónde vive el registro ahora', () => {
  // Sin este puntero, alguien que abra el máster buscando la entrada de un ticket reciente no
  // encuentra nada y concluye que no se documentó. El corte tiene que ser legible desde dentro.
  const texto = fs.readFileSync(MASTER, 'utf8');
  assert.match(texto, /docs\/master\//,
    '🔴 el máster no menciona `docs/master/`. El puntero es lo único que explica por qué las ' +
    'entradas se cortan en una fecha: sin él, el corte se lee como un olvido.');
});
