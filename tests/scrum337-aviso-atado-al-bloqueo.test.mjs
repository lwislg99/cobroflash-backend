// SCRUM-337 · UN CORREO QUE PROMETE UNA CONSECUENCIA Y EL CÓDIGO QUE LA EJECUTA NO PUEDEN
// DIVERGIR EN SILENCIO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA — y el que NO cierra
//
// El aviso del día 12 le dice al usuario que perdería el acceso a su panel. Medido: al vencer la
// prueba el panel NO se pierde. El bloqueo real (`requireActivePlan`) está montado en 4 sitios de
// 95 rutas de escritura, y no hay ningún `.use(...)` global: siguen funcionando facturar, cobrar,
// clientes, productos, gastos, informes y equipo. Lo único que caduca es crear presupuestos y
// enviar por WhatsApp presupuestos y albaranes.
//
// 🔴 ESTE GUARD NO ARREGLA ESO, Y NO PUEDE. Las dos salidas —corregir el texto, o ampliar el
// bloqueo— son decisiones del FUNDADOR: la primera es microcopy (regla 30) y la segunda cambia el
// comportamiento de todas las cuentas en prueba. Un test que eligiera una estaría fijando por
// accidente la respuesta a una pregunta que nadie ha contestado.
//
// LO QUE SÍ HACE, que es la otra mitad: **congela el ESTADO DE LA PREGUNTA, no su respuesta.**
// El día que alguien reescriba uno de esos correos, o monte/desmonte el gate, la suite se pone
// roja y le obliga a mirar la otra cara. Hoy la divergencia existe y está DECLARADA; lo que este
// guard impide es que aparezca una NUEVA sin que nadie se entere — que es exactamente cómo llegó
// aquí la que hay.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ LA HUELLA ES DEL BLOQUE ENTERO Y NO DEL TEXTO
//
// Un guard que mirase el texto («que no diga panel») sería un guard de TEXTO: se cazaría a sí
// mismo en el comentario que explica la prohibición —este fichero la contiene— y se esquivaría
// reformulando. Una regla que depende de cómo escribas la frase no es una regla
// (SCRUM-176/168/3/193/254/267).
//
// Y sobre todo: **no me corresponde leer el texto**. La huella solo sabe decir «cambió / no
// cambió», que es todo lo que hace falta para forzar la revisión y todo lo que se puede afirmar
// sin invadir la microcopy del fundador. Cubre condición (`age >= 12`), asunto, cuerpo y botón,
// porque las cuatro cambian lo que el usuario entiende que va a pasarle.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS CENSOS SON DERIVADOS. NINGUNA LISTA A MANO.
//
// Las cuatro rutas gateadas NO están escritas aquí: salen del AST. Escribirlas sería crear otra
// lista sin guard, y en este repo las listas a mano han derivado dos de dos veces. Al derivar
// aparecieron además CINCO avisos donde el ticket nombra tres: `trialExpired` e `inactive` también
// hablan con el usuario sobre el final de la prueba y nadie los había mirado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  censarAvisos, censarEjecucionDelVencimiento, FICHERO_AVISOS, EVALUADOR_DIARIO, GATE_DEL_VENCIMIENTO,
} from './_censo-aviso-vs-bloqueo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const avisosDerivados = censarAvisos(fs.readFileSync(path.join(RAIZ, FICHERO_AVISOS), 'utf8'));
const ejecucion = censarEjecucionDelVencimiento(path.join(RAIZ, 'src'));

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA CORRESPONDENCIA DECLARADA — tres estados, y ninguno es un juicio sobre el texto
//
//   · `NO_ATADO`  — el fundador YA ha declarado que este aviso promete algo que el árbol no
//                   ejecuta. Lleva su ticket. NO es una excepción concedida: es una deuda con
//                   nombre, y el ratchet de abajo impide que crezca.
//   · `SIN_DECIDIR` — nadie ha dictaminado si lo que dice se corresponde con lo que pasa. Se
//                   declara como lo que es: una pregunta abierta. Es infinitamente más honesto
//                   que clasificarlo yo, que es justo lo que este ticket dice que no es mío.
//   · `ATADO`     — correspondencia verificada. **Hoy está vacío, y eso es el hallazgo, no un
//                   hueco por rellenar.** El día que el fundador decida, las entradas se mueven
//                   aquí y el censo de `NO_ATADO` BAJA — y el guard obliga a anotarlo.
//
// La HUELLA se congela para los tres estados por igual: cambiar el texto de uno «sin decidir»
// también tiene que hacer mirar el bloqueo.
const CORRESPONDENCIA = {
  // «tu catálogo, lo tienes precargado por oficio» — solo es cierto si el usuario completó el
  // paso 2 del wizard con un oficio distinto de «otro» (SCRUM-338). El correo lo afirma sin
  // condición. Declarado por el fundador en SCRUM-337.
  day3:         { estado: 'NO_ATADO', ticket: 'SCRUM-338', huella: '4a2e786d903c5aad' },
  day7:         { estado: 'SIN_DECIDIR', ticket: null,     huella: 'b7aff4fb61086e90' },
  // «perderías el acceso a tu panel» — el panel no se pierde. Es el defecto que abre SCRUM-337.
  day12:        { estado: 'NO_ATADO', ticket: 'SCRUM-337', huella: '7f4df8f34a7ff6ce' },
  trialExpired: { estado: 'SIN_DECIDIR', ticket: null,     huella: 'a9c9bad1b95297c9' },
  inactive:     { estado: 'SIN_DECIDIR', ticket: null,     huella: 'd2c934ccd6dbd3dd' },
};

// El censo de ejecución, congelado POR IDENTIDAD (fichero + método + ruta), nunca por línea.
// Por línea, cualquier edición diez líneas más arriba lo pondría en rojo, y un guard que grita
// sin motivo se acaba puenteando igual que uno que no grita nunca.
const MONTAJES_DECLARADOS = [
  'src/app.ts::POST /admin/quotes/:id/send-whatsapp',
  'src/app.ts::POST /quote/create',
  'src/modules/jobs/app/routes/albaranes.routes.ts::POST /:id/enviar-para-firmar',
  'src/modules/jobs/app/routes/albaranes.routes.ts::POST /:id/enviar-whatsapp',
];

// Suelos. No son redondos por gusto: hoy hay 5 avisos y 95 rutas de escritura, y el margen deja
// sitio a que el producto crezca sin obligar a tocar esto en cada PR ajeno.
const MINIMO_AVISOS = 3;
const MINIMO_RUTAS_ESCRITURA = 50;

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
// Sin esto, todo lo de abajo pasaría en verde con los dos censos vacíos: «coinciden» y «no supe
// mirar» dan el mismo verde y significan lo contrario.

test('SCRUM-337 · SUELO ① el censo de avisos ve el evaluador diario y empareja sus bloques', () => {
  assert.equal(avisosDerivados.evaluadorEncontrado, true,
    `🔴 no se ha encontrado \`${EVALUADOR_DIARIO}\` en ${FICHERO_AVISOS}. El guard entero estaría ` +
    'comparando dos listas vacías y diciendo que coinciden. Si la función se renombró, actualiza ' +
    'el censo — no lo desactives.');

  assert.ok(avisosDerivados.avisos.length >= MINIMO_AVISOS,
    `🔴 el censo ve ${avisosDerivados.avisos.length} avisos y debería ver al menos ${MINIMO_AVISOS}. ` +
    'Cero avisos no significa «no hay correos que prometan nada»: significa que la derivación está ciega.');

  const sinBloque = avisosDerivados.avisos.filter((a) => !a.bloqueEncontrado).map((a) => `${a.clave} (línea ${a.linea})`);
  assert.deepEqual(sinBloque, [],
    '🔴 HAY AVISOS QUE NO SE HAN PODIDO EMPAREJAR CON SU CORREO:\n    ' + sinBloque.join('\n    ') +
    '\n\n  El censo busca el `if` más cercano que contenga exactamente UNA plantilla de correo. Si\n' +
    '  no lo encuentra, la estructura del evaluador ha cambiado y el emparejamiento ya no es\n' +
    '  fiable. Emparejar «a ojo» sería inventarse el censo: arregla el derivador.');
});

test('SCRUM-337 · SUELO ② el censo de ejecución ve el gate y la superficie de escritura', () => {
  assert.ok(ejecucion.montajes.length > 0,
    `🔴 cero montajes de \`${GATE_DEL_VENCIMIENTO}\` derivados. O el gate se ha renombrado, o el ` +
    'detector está ciego. Un cero aquí haría que el guard de identidad de abajo comparase la nada ' +
    'con la nada.');

  assert.ok(ejecucion.rutasDeEscritura >= MINIMO_RUTAS_ESCRITURA,
    `🔴 el censo ve ${ejecucion.rutasDeEscritura} rutas de escritura y debería ver al menos ` +
    `${MINIMO_RUTAS_ESCRITURA}. Sin superficie no hay con qué comparar la cobertura del gate.`);
});

// ── EL ATADO ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-337 · todo aviso derivado está clasificado, y toda clasificación existe en el árbol', () => {
  const derivados = avisosDerivados.avisos.map((a) => a.clave).sort();
  const declarados = Object.keys(CORRESPONDENCIA).sort();

  const sinClasificar = derivados.filter((c) => !(c in CORRESPONDENCIA));
  assert.deepEqual(sinClasificar, [],
    '🔴 HAY AVISOS NUEVOS SIN CLASIFICAR: ' + sinClasificar.join(', ') +
    '\n\n  Alguien ha añadido un correo del ciclo de vida y nadie ha dicho si lo que promete se\n' +
    '  corresponde con lo que el producto hace al vencer la prueba. Clasifícalo en\n' +
    '  CORRESPONDENCIA: si no lo sabes —lo normal, es decisión del fundador— ponlo como\n' +
    '  SIN_DECIDIR con su huella. Declarar una pregunta abierta es correcto; dejarla invisible no.');

  const fantasmas = declarados.filter((c) => !derivados.includes(c));
  assert.deepEqual(fantasmas, [],
    '🔴 LA CLASIFICACIÓN NOMBRA AVISOS QUE YA NO EXISTEN: ' + fantasmas.join(', ') +
    '\n\n  Se ha borrado o renombrado un correo. Si de verdad ya no se manda, quítalo de\n' +
    '  CORRESPONDENCIA en el mismo commit: un censo que describe correos ausentes deja de medir.');
});

test('SCRUM-337 · si cambia lo que el correo DICE, hay que volver a mirar lo que el producto HACE', () => {
  const movidos = avisosDerivados.avisos
    .filter((a) => CORRESPONDENCIA[a.clave] && CORRESPONDENCIA[a.clave].huella !== a.huella)
    .map((a) => `${a.clave} (línea ${a.linea}): declarada ${CORRESPONDENCIA[a.clave].huella}, derivada ${a.huella}`);

  assert.deepEqual(movidos, [],
    '🔴 UN AVISO DEL CICLO DE VIDA HA CAMBIADO:\n    ' + movidos.join('\n    ') +
    '\n\n  Esto NO dice que el cambio esté mal. Dice que el texto y el bloqueo son dos caras de la\n' +
    '  misma promesa y acaban de moverse por separado — que es exactamente cómo nació SCRUM-337:\n' +
    '  un correo diciendo que se pierde el panel y un `requireActivePlan` montado en 4 de 95\n' +
    '  rutas de escritura.\n\n' +
    '  QUÉ HACER: mira el otro lado. Si el aviso ya no promete nada que el producto no ejecute,\n' +
    '  pásalo a ATADO. Si sigue prometiéndolo, déjalo como está. En los dos casos, actualiza la\n' +
    '  huella en CORRESPONDENCIA — a mano y en el mismo commit, para que la decisión se vea en el\n' +
    '  diff en vez de ocurrir sola.');
});

test('SCRUM-337 · si cambia lo que el producto HACE al vencer, hay que volver a mirar lo que el correo DICE', () => {
  const derivados = ejecucion.montajes.map((m) => m.id);

  const nuevos = derivados.filter((id) => !MONTAJES_DECLARADOS.includes(id));
  const desaparecidos = MONTAJES_DECLARADOS.filter((id) => !derivados.includes(id));

  assert.deepEqual({ nuevos, desaparecidos }, { nuevos: [], desaparecidos: [] },
    `🔴 LA EJECUCIÓN DEL VENCIMIENTO HA CAMBIADO (\`${GATE_DEL_VENCIMIENTO}\`):\n` +
    (nuevos.length ? '    MONTAJES NUEVOS:\n      ' + nuevos.join('\n      ') + '\n' : '') +
    (desaparecidos.length ? '    MONTAJES QUE HAN DESAPARECIDO:\n      ' + desaparecidos.join('\n      ') + '\n' : '') +
    '\n  Es la otra dirección del mismo atado. Ampliar o reducir el bloqueo cambia lo que le pasa\n' +
    '  de verdad al usuario cuando vence la prueba, y hay cinco correos contándoselo.\n\n' +
    '  QUÉ HACER: repasa CORRESPONDENCIA. Si el cambio hace cierto lo que un aviso promete, ese\n' +
    '  aviso pasa a ATADO. Después actualiza MONTAJES_DECLARADOS en el mismo commit.\n\n' +
    '  ⚠️ Y ojo con el atajo: ampliar el bloqueo afecta a TODAS las cuentas en prueba. Es decisión\n' +
    '  del fundador, no un efecto colateral de poner verde un test.');
});

test('SCRUM-337 · el censo de avisos NO ATADOS no crece, y si BAJA hay que anotarlo', () => {
  // Mismo mecanismo que el censo heredado de SCRUM-267 y el ratchet de SCRUM-243, y por el mismo
  // motivo: si bajar fuese silencioso, el censo seguiría declarando dos deudas cuando queda una y
  // nadie sabría nunca cuándo se vació del todo. Que el guard falle por una MEJORA es deliberado.
  const noAtados = Object.entries(CORRESPONDENCIA)
    .filter(([, v]) => v.estado === 'NO_ATADO')
    .map(([k, v]) => `${k} → ${v.ticket}`)
    .sort();

  assert.deepEqual(noAtados, ['day12 → SCRUM-337', 'day3 → SCRUM-338'],
    '🔴 HA CAMBIADO EL CENSO DE AVISOS QUE PROMETEN ALGO QUE EL PRODUCTO NO HACE:\n    ' +
    noAtados.join('\n    ') +
    '\n\n  · Si ha CRECIDO: se ha aceptado una promesa nueva sin respaldo. Eso es el defecto de\n' +
    '    SCRUM-337 otra vez, con otro correo.\n' +
    '  · Si ha BAJADO: enhorabuena, se ha cerrado una — actualiza esta lista para que la mejora\n' +
    '    quede anotada en vez de pasar desapercibida.\n\n' +
    '  Cada entrada tiene que llevar su ticket. Una deuda sin nombre es indistinguible de un olvido.');

  const sinTicket = Object.entries(CORRESPONDENCIA)
    .filter(([, v]) => v.estado === 'NO_ATADO' && !v.ticket)
    .map(([k]) => k);
  assert.deepEqual(sinTicket, [],
    '🔴 hay avisos declarados NO_ATADO sin ticket: ' + sinTicket.join(', '));
});
