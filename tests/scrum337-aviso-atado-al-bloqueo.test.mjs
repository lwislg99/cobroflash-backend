// SCRUM-337 · UN CORREO QUE PROMETE UNA CONSECUENCIA Y EL CÓDIGO QUE LA EJECUTA NO PUEDEN
// DIVERGIR EN SILENCIO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA — y el que NO cierra
//
// El aviso del día 12 le dice al usuario que perdería el acceso a su panel. Medido: al vencer la
// prueba el panel NO se pierde. El bloqueo real (`requireActivePlan`) está montado en 4 sitios de
// 96 rutas de escritura, y no hay ningún `.use(...)` global: siguen funcionando facturar, cobrar,
// clientes, productos, gastos, informes y equipo. Lo único que caduca es crear presupuestos y
// enviar por WhatsApp presupuestos y albaranes.
//
// LA DECISIÓN, TOMADA POR EL FUNDADOR (5-ago-2026): **se corrige el TEXTO, no se amplía el
// bloqueo.** Gatear 95 rutas cambiaría el comportamiento de todas las cuentas en prueba y es un
// cambio de producto que nadie ha pedido; dejar ver los datos e impedir crear cosas nuevas es una
// decisión razonable. El que mentía era el texto, y ya está corregido (día 12 y día 3).
//
// LO QUE ESTE GUARD HACE: **congela el ESTADO DE LA PREGUNTA, no su respuesta.** El día que
// alguien reescriba uno de esos correos, monte o desmonte el gate, o añada un borrado, la suite se
// pone roja y le obliga a mirar la otra cara. No dice cuál de las dos es la correcta —eso sigue
// siendo del fundador—: dice que no pueden moverse por separado, que es exactamente cómo nació
// este defecto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ LA HUELLA ES DE LA PROMESA Y NO DEL TEXTO
//
// Un guard que mirase el texto («que no diga panel») sería un guard de TEXTO: se cazaría a sí
// mismo en el comentario que explica la prohibición —este fichero la contiene— y se esquivaría
// reformulando. Una regla que depende de cómo escribas la frase no es una regla
// (SCRUM-176/168/3/193/254/267).
//
// Y sobre todo: **no me corresponde leer el texto**. La huella solo sabe decir «cambió / no
// cambió», que es todo lo que hace falta para forzar la revisión y todo lo que se puede afirmar
// sin invadir la microcopy del fundador. Cubre CUÁNDO se manda (`age >= 12`), a quién y con qué
// asunto, el cuerpo y el botón, porque todas cambian lo que el usuario entiende que va a pasarle.
//
// ⚠️ Hasta SCRUM-509 la huella era del BLOQUE ENTERO, y eso la hacía saltar con cualquier cambio de
// plomería. Ver la nota de SCRUM-509 más abajo: se estrechó al hecho, no se aflojó.
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
  censarAvisos, censarEjecucionDelVencimiento, censarBorrados,
  FICHERO_AVISOS, EVALUADOR_DIARIO, GATE_DEL_VENCIMIENTO,
} from './_censo-aviso-vs-bloqueo.mjs';

// 🔴 SCRUM-509 · LA HUELLA SE ESTRECHA AL HECHO, y aquí está por qué no es aflojarla.
//
// Era del bloque `if` ENTERO, o sea que incluía la PLOMERÍA: cómo se captura el resultado del
// envío, cómo se llama la variable, el `continue`. Medido con el guard puesto: renombrar `r` a
// `resultado` —sin tocar asunto, cuerpo, botón ni condición— movía la huella y este guard saltaba
// diciendo que un aviso había cambiado. Dos días rehaciendo huellas por eso, y un guard que cobra
// peaje por código correcto acaba apagado por alguien que lo relaja «solo esta vez».
//
// Ahora la huella es de las CINCO piezas de la promesa: cuándo · a quién · asunto · cuerpo · botón.
// Lo que sale de la huella —que `markSent` dependa del resultado— NO queda sin vigilar: lo cubre
// `tests/scrum475-ignoran-el-resultado.test.mjs:499` sobre el fichero real y con su propio suelo,
// y con más precisión que una huella que solo sabía decir «algo cambió». Está medido, no supuesto.

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const avisosDerivados = censarAvisos(fs.readFileSync(path.join(RAIZ, FICHERO_AVISOS), 'utf8'));
const ejecucion = censarEjecucionDelVencimiento(path.join(RAIZ, 'src'));
const borrados = censarBorrados(path.join(RAIZ, 'src'));

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA CORRESPONDENCIA DECLARADA — tres estados, y ninguno es un juicio sobre el texto
//
//   · `ATADO`            — el aviso promete algo y hay un MECANISMO que vigila que siga siendo
//                          cierto. `atadura` dice cuál: si ese mecanismo se mueve, el guard cae.
//   · `SIN_CONSECUENCIA` — el aviso anuncia un hecho y no promete ninguna consecuencia del
//                          vencimiento. No hay claim que atar. Meterlo en la lista de deudas
//                          sería declarar una que no existe, y un ratchet lleno de deudas falsas
//                          deja de significar algo.
//   · `NO_ATADO`         — promete algo que el árbol NO ejecuta. Lleva ticket obligatorio.
//                          **Hoy está VACÍO: SCRUM-337 corrigió los dos que había.**
//
// ⚠️ `ATADO` NO SE CONCEDE POR AUSENCIA. Que hoy nada contradiga un aviso no es una atadura: es
// un hueco con suerte. Cada `ATADO` nombra el mecanismo que lo sostiene, y ese mecanismo es un
// assert de este fichero. Ver la nota de `trialExpired`, que es el caso que lo obligó.
//
// La HUELLA se congela para los tres estados por igual: cambiar el texto de uno «sin
// consecuencia» también tiene que hacer mirar el bloqueo.
//
// ── HUELLAS REHECHAS EL 12-ago-2026 · SCRUM-475 (los ocho que ignoraban el resultado) ─────
//
// Las CINCO huellas se movieron a la vez, y este guard hizo exactamente lo que existe para hacer:
// obligó a mirar el otro lado antes de darlas por buenas. Mirado, y esto es lo que cambió:
//
//   `await sendEmail(m.email, '<asunto>', html);`   →   `const r = await sendEmail(...);`
//   `await markSent(m.id, …, '<clave>');`           →   `if (anotarEnvio(...)) await markSent(...);`
//
// Y nada más: NINGÚN asunto, NINGÚN cuerpo (`wrap(...)`), NINGÚN botón y NINGUNA condición
// (`age >= 12`, `isTrial`, `quoteCount === 0`, `recent === 0`) cambia — comprobado en el diff. Lo
// que se arregló es que `markSent` marcaba como ENVIADO un correo que podía no haber salido: cuando
// `sendEmail` DEVUELVE `sin_destino` sin lanzar, la ejecución seguía. O sea que estas cinco promesas
// dicen lo mismo que decían y AHORA además solo se dan por dichas cuando salen.
//
// Las ataduras (`censo de montajes`, `censo de borrados`) no se han tocado y siguen verdes.
//
// ── HUELLAS REHECHAS OTRA VEZ EL 13-ago-2026 · SCRUM-508 (los cinco emisores dejan fila) ──
//
// Las cinco se movieron a la vez, por segundo día consecutivo, y este guard volvió a hacer lo que
// existe para hacer. Mirado, y lo único que cambia en cada bloque es UN ARGUMENTO:
//
//   `await sendEmail(m.email, '<asunto>', html)`  →  `await sendEmail(m.id, m.email, '<asunto>', html)`
//
// El `merchantId` entra para que el correo deje fila en `email_messages` (SCRUM-508). NINGÚN asunto,
// NINGÚN cuerpo, NINGÚN botón y NINGUNA condición cambian — comprobado en el diff, filtrando por
// `wrap(`, `label:`, `url:`, `age >=`, `isTrial`, `quoteCount` y `recent ===`: solo salen las siete
// líneas del `sendEmail`. Las cinco promesas dicen exactamente lo que decían.
//
// ── 🔴 Y REHECHAS UNA TERCERA VEZ EL 13-ago-2026 · SCRUM-509 — pero por un motivo DISTINTO ──
//
// Las dos veces anteriores se movieron porque cambió el CÓDIGO. Esta vez **no ha cambiado ni una
// línea de `lifecycle.service.ts`**: lo que ha cambiado es el CRITERIO con el que se calcula la
// huella, que ha pasado del bloque entero a las piezas de la promesa (ver la nota de arriba). Por
// eso los cinco valores son nuevos aunque los cinco correos digan exactamente lo mismo.
//
// Es la última vez que se mueven sin que cambie una promesa: el peaje que las movía —la plomería—
// ya no entra en el cálculo, y hay un control positivo que exige que las cinco promesas SÍ sigan
// moviéndolas, una a una, con el fixture derivado del propio fichero.
const CORRESPONDENCIA = {
  // SCRUM-337 · TEXTO CORREGIDO. Antes: «lo tienes precargado por oficio», afirmado sin condición
  // y dependiente de cuatro (oficio · que no sea «otro» · no desmarcar la casilla · que la carga
  // no falle en silencio → SCRUM-338). Ahora no afirma el estado del usuario y apunta a Productos.
  // ATADURA: promete que en Productos se pueden añadir servicios — o sea que esa escritura NO
  // caduca. Lo vigila el censo de montajes: el día que alguien gatee productos, salta.
  day3:         { estado: 'ATADO', ticket: null, atadura: 'censo de montajes', huella: 'f5e5148e8d5ddd92' },

  // «Tu prueba expira en unos 7 días» — un hecho, y además EXACTO: la prueba es de 14 días
  // (`auth.service.ts:301`) y el aviso sale con `age >= 7`. No promete qué pasa después.
  day7:         { estado: 'SIN_CONSECUENCIA', ticket: null, atadura: null, huella: '9e11eaade1872fe3' },

  // SCRUM-337 · TEXTO CORREGIDO. Antes: «perderías el acceso a tu panel», y el panel no se pierde.
  // ATADURA: el texto enumera exactamente lo que caduca, y eso son los 4 montajes de
  // `requireActivePlan`. Si alguien monta o desmonta uno, el texto deja de describir el mecanismo
  // y el censo de montajes salta.
  // ⚠️ La enumeración de lo que SIGUE funcionando no usa el posesivo del documento fiscal: el
  // trinquete de SCRUM-299 (Parte M) lo caza como promesa, y tenía razón (reglas 24/26).
  day12:        { estado: 'ATADO', ticket: null, atadura: 'censo de montajes', huella: 'c4b11c8cfefc3175' },

  // «tus datos siguen aquí» — cierto. ¿Atado a qué? A que NADA los borra, que es una AUSENCIA.
  // Por eso la atadura es el censo de borrados de abajo (forma + sitio): sin él, esto sería
  // «verde por ausencia» y una purga por inactividad rompería el claim sin que nadie se enterase.
  trialExpired: { estado: 'ATADO', ticket: null, atadura: 'censo de borrados', huella: '0626829dfe9f8ddb' },

  // Reenganche puro: no menciona prueba, plan ni bloqueo.
  inactive:     { estado: 'SIN_CONSECUENCIA', ticket: null, atadura: null, huella: '3f8a2aa6feb71efa' },
};

// Los borrados del árbol, congelados por identidad (fichero + modelo.método + nº de ocurrencia),
// nunca por línea. Es la ATADURA de `trialExpired`: ver el bloque del censo C en el derivador.
const BORRADOS_DECLARADOS = [
  'src/modules/auth/domain/auth.service.ts::authSession.deleteMany#1',
  'src/modules/expenses/domain/expenses.service.ts::expense.delete#1',
  'src/modules/maintenance/domain/maintenance.service.ts::quote.delete#1',
  'src/modules/maintenance/domain/maintenance.service.ts::quote.delete#2',
  'src/modules/products/domain/products.service.ts::product.delete#1',
  'src/modules/providers/domain/providers.service.ts::provider.delete#1',
  'src/modules/system/app/routes/invoicesAdmin.routes.ts::albaranLineaFacturada.deleteMany#1',
  'src/modules/system/customerAdmin.ts::customer.deleteMany#1',
  'src/modules/system/domain/borradoMerchant.ts::botSession.deleteMany#1',
  'src/modules/system/domain/borradoMerchant.ts::merchant.deleteMany#1',
  'src/modules/team/domain/team.service.ts::authSession.deleteMany#1',
  'src/modules/templates/app/routes/templates.routes.ts::quoteTemplate.delete#1',
];
const MINIMO_BORRADOS = 10;

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

  // 🔴 SCRUM-509 · la huella se compone de CINCO piezas (cuándo · a quién · asunto · cuerpo ·
  // botón). Si alguna no aparece, NO se compone a medias: el aviso se queda sin huella y aquí se
  // declara ciego. Una huella incompleta daría verde sobre un aviso sin mirar.
  const incompletos = avisosDerivados.avisos
    .filter((a) => a.bloqueEncontrado && a.faltan && a.faltan.length)
    .map((a) => `${a.clave} (línea ${a.linea}): falta ${a.faltan.join(', ')}`);
  assert.deepEqual(incompletos, [],
    '🔴 NO SE HAN PODIDO EXTRAER LAS PIEZAS DE LA PROMESA:\n    ' + incompletos.join('\n    ') +
    '\n\n  La huella cubre cuándo se manda, a quién, el asunto, el cuerpo y el botón. Si el aviso\n' +
    '  dejó de usar `sendEmail` o `wrap`, la extracción ya no es fiable: arregla el derivador en\n' +
    '  vez de dejar que ese aviso pase sin huella.');
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

test('SCRUM-337 · 🔴 CONTROL POSITIVO (SCRUM-509): la huella SIGUE cazando las cinco promesas', () => {
  // 🔴 EL TEST QUE DECIDE SI SCRUM-509 ES UN ARREGLO O UN APAGÓN. Estrechar la huella al hecho solo
  // vale si sigue moviéndose con TODO lo que es una promesa. Aquí se cambia cada pieza, una a una,
  // sobre una COPIA sintética del evaluador, y se exige que la huella se mueva en las cinco.
  //
  // «Ya no da falsos positivos» y «ya no vigila» son el mismo verde. Éste los separa.
  // 🔴 EL FIXTURE SE DERIVA DEL CÓDIGO REAL, NUNCA SE ESCRIBE A MANO. Escribiéndolo a mano me
  // mordió mientras hacía este ticket: usé la firma `sendEmail(destinatario, asunto, html)` y
  // SCRUM-508 ya le había metido el `merchantId` delante, así que el control positivo daba verde
  // sobre una huella que se había quedado SIN EL ASUNTO. Un fixture desalineado del código no
  // prueba nada, y encima lo dice en verde.
  const fuenteReal = fs.readFileSync(path.join(RAIZ, FICHERO_AVISOS), 'utf8');

  const huellaDe = (fuente) => {
    const c = censarAvisos(fuente);
    assert.equal(c.evaluadorEncontrado, true, '🔴 el censo no encuentra el evaluador.');
    const aviso = c.avisos.find((a) => a.clave === 'day12');
    assert.ok(aviso, '🔴 no se encuentra `day12` en la fuente derivada: el fixture ha dejado de servir.');
    assert.deepEqual(aviso.faltan, [], `🔴 piezas sin extraer: ${aviso.faltan.join(', ')}`);
    return aviso.huella;
  };

  const base = huellaDe(fuenteReal);
  assert.ok(base, '🔴 SUELO: no se ha podido componer la huella del evaluador real.');

  /** Cambia UNA cosa en la fuente real y devuelve la fuente mutada. Post-condición: cambió algo. */
  const mutando = (viejo, nuevo) => {
    assert.ok(fuenteReal.includes(viejo),
      `🔴 el fixture ya no encaja con el código real: no aparece «${viejo.slice(0, 50)}…». ` +
      'Actualízalo contra el fichero, no inventes uno que sí encaje.');
    return fuenteReal.replace(viejo, nuevo);
  };

  // Cada una es UNA promesa distinta, tomada del bloque `day12` tal y como está escrito hoy.
  const PROMESAS = [
    ['CUÁNDO se manda', mutando("isTrial && age >= 12 && !alreadySent(m, 'day12')",
      "isTrial && age >= 13 && !alreadySent(m, 'day12')")],
    ['A QUIÉN se manda', mutando("await sendEmail(m.id, m.email, 'Solo 2 días de prueba en YaQu'",
      "await sendEmail(m.id, m.emailFacturacion, 'Solo 2 días de prueba en YaQu'")],
    ['el ASUNTO', mutando("'Solo 2 días de prueba en YaQu'", "'Solo 3 días de prueba en YaQu'")],
    ['el CUERPO', mutando('Te quedan unos 2 días de prueba', 'Te quedan unos 3 días de prueba')],
    ['el BOTÓN', mutando("{ label: 'Activar plan Pro', url: `${DASHBOARD_URL}#plans` }",
      "{ label: 'Activar plan Empresa', url: `${DASHBOARD_URL}#plans` }")],
  ];
  const ciegas = PROMESAS.filter(([, fuente]) => huellaDe(fuente) === base).map(([que]) => que);
  assert.deepEqual(ciegas, [],
    `🔴 LA HUELLA HA DEJADO DE VER ESTAS PROMESAS: ${ciegas.join(' · ')}.\n\n` +
    '  Eso NO es haber quitado un falso positivo: es haber apagado el guard. Cambiar cualquiera de\n' +
    '  las cinco cambia lo que el usuario entiende que va a pasarle cuando venza su prueba, y este\n' +
    '  guard existe para obligar a mirar el otro lado antes de darlo por bueno.');

  // 🔴 Y EL CONTROL NEGATIVO, que es el ticket entero: la PLOMERÍA no la mueve. Es el caso medido
  // en el PASO 0 de SCRUM-509, con el guard viejo puesto: renombrar `r` movía las huellas.
  const renombrada = mutando(
    "const r = await sendEmail(m.id, m.email, 'Solo 2 días de prueba en YaQu', html);",
    "const resultado = await sendEmail(m.id, m.email, 'Solo 2 días de prueba en YaQu', html);")
    .replace('if (anotarEnvio(parte, m.email, r)) await markSent(m.id, m.lifecycleEmailsSent, \'day12\');',
      'if (anotarEnvio(parte, m.email, resultado)) await markSent(m.id, m.lifecycleEmailsSent, \'day12\');');
  assert.equal(huellaDe(renombrada), base,
    '🔴 renombrar una variable local sigue moviendo la huella. Es el falso positivo que SCRUM-509 ' +
    'cierra: dos días rehaciendo huellas por un cambio que no toca ninguna promesa.');

  // SUELO del propio control positivo: vaciar la lista sería la forma barata de aflojar.
  assert.equal(PROMESAS.length, 5, '🔴 la lista de promesas ha encogido: el control se vuelve trivial.');
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

test('SCRUM-337 · ningún aviso promete algo que el producto no hace (y si vuelve, con ticket)', () => {
  // Mismo mecanismo que el censo heredado de SCRUM-267 y el ratchet de SCRUM-243. Ahora la lista
  // está VACÍA: SCRUM-337 corrigió los dos que había (day12 y day3). Que esté vacía es lo que hay
  // que defender — cualquier promesa nueva sin respaldo es el defecto de 337 otra vez, con otro
  // correo. Y si algún día vuelve a haber una legítima, entra aquí CON SU TICKET: una deuda sin
  // nombre es indistinguible de un olvido.
  const noAtados = Object.entries(CORRESPONDENCIA)
    .filter(([, v]) => v.estado === 'NO_ATADO')
    .map(([k, v]) => `${k} → ${v.ticket ?? 'SIN TICKET'}`)
    .sort();

  assert.deepEqual(noAtados, [],
    '🔴 HAY AVISOS QUE PROMETEN ALGO QUE EL PRODUCTO NO HACE:\n    ' + noAtados.join('\n    ') +
    '\n\n  Es el defecto de SCRUM-337 otra vez. Las dos salidas son las mismas y las dos son del\n' +
    '  fundador: corregir el texto (microcopy, regla 30) o ampliar el bloqueo (afecta a TODAS las\n' +
    '  cuentas en prueba). Si la deuda se acepta a sabiendas, declárala aquí con su ticket.');

  // `ATADO` no se concede por ausencia: cada uno nombra el mecanismo que lo sostiene.
  const atadosSinAtadura = Object.entries(CORRESPONDENCIA)
    .filter(([, v]) => v.estado === 'ATADO' && !v.atadura)
    .map(([k]) => k);
  assert.deepEqual(atadosSinAtadura, [],
    '🔴 HAY AVISOS DECLARADOS `ATADO` SIN NOMBRAR SU ATADURA: ' + atadosSinAtadura.join(', ') +
    '\n\n  Que hoy nada contradiga un aviso no es una atadura: es un hueco con suerte, y «verde por\n' +
    '  ausencia» no vale. O nombras el mecanismo que lo vigila —y ese mecanismo es un assert de\n' +
    '  este fichero— o el estado honesto es otro.');
});

// ── LA ATADURA DE `trialExpired`: EL CENSO DE BORRADOS, EN DOS CAPAS ─────────────────────

test('SCRUM-337 · SUELO ③ el censo de borrados ve el árbol', () => {
  assert.ok(borrados.length >= MINIMO_BORRADOS,
    `🔴 el censo ve ${borrados.length} borrados y debería ver al menos ${MINIMO_BORRADOS}. Cero ` +
    'borrados no significa «nadie borra nada»: significa que el detector está ciego, y las dos ' +
    'capas de abajo pasarían en verde sin comprobar nada.');
});

test('SCRUM-337 · capa ① ningún borrado se filtra por vencimiento, plan o inactividad', () => {
  const sospechosos = borrados
    .filter((b) => b.sospechoso)
    .map((b) => `${b.fichero}:${b.linea}  ${b.modelo}.${b.metodo}  →  ${b.filtro}`);

  assert.deepEqual(sospechosos, [],
    '🔴 HAY UN BORRADO QUE PARECE UNA PURGA:\n    ' + sospechosos.join('\n    ') +
    '\n\n  El aviso `trialExpired` le dice al usuario que sus datos siguen ahí cuando termina la\n' +
    '  prueba. Un borrado filtrado por umbral de tiempo, por plan o por inactividad convierte esa\n' +
    '  frase en mentira, y el usuario ya la ha recibido.\n\n' +
    '  Si el borrado es legítimo y NO toca datos del profesional, dilo en el ticket y ajusta el\n' +
    '  aviso ANTES de mergear. El orden importa: primero el texto, después la purga.');
});

test('SCRUM-337 · capa ② no aparece ni desaparece ningún sitio de borrado sin que se mire el aviso', () => {
  // Esta capa existe porque la ① tiene un punto ciego CONOCIDO: una purga que primero consulte los
  // vencidos y luego borre por `id` no tiene forma sospechosa. Como sitio nuevo, sí salta aquí.
  const ids = borrados.map((b) => b.id);
  const nuevos = ids.filter((id) => !BORRADOS_DECLARADOS.includes(id));
  const desaparecidos = BORRADOS_DECLARADOS.filter((id) => !ids.includes(id));

  assert.deepEqual({ nuevos, desaparecidos }, { nuevos: [], desaparecidos: [] },
    '🔴 EL CENSO DE BORRADOS HA CAMBIADO:\n' +
    (nuevos.length ? '    SITIOS NUEVOS:\n      ' + nuevos.join('\n      ') + '\n' : '') +
    (desaparecidos.length ? '    SITIOS QUE HAN DESAPARECIDO:\n      ' + desaparecidos.join('\n      ') + '\n' : '') +
    '\n  LA PREGUNTA QUE HAY QUE CONTESTAR: ¿este borrado se dispara al vencer la prueba o por\n' +
    '  inactividad? Si la respuesta es sí, `trialExpired` («tus datos siguen aquí») deja de ser\n' +
    '  cierto y hay que corregirlo ANTES de mergear.\n\n' +
    '  Si la respuesta es no, actualiza BORRADOS_DECLARADOS en el mismo commit.\n\n' +
    '  ⚠️ Y que quede dicho: se puede actualizar esta lista y contestar mal. Entonces será UNA\n' +
    '  MENTIRA EN UN DIFF, NO UN SILENCIO — que es el estándar de la casa, no una excusa.');
});
