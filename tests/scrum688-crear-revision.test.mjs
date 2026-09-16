// tests/scrum688-crear-revision.test.mjs — SCRUM-688
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAS REVISIONES YA SE PUEDEN CREAR, NO SÓLO VER.
//
// El motor (`nuevaRevisionDe`) llevaba desde SCRUM-655 construido, probado y con su propio
// trinquete de herencia… y **sin un solo llamador**. Medido antes de cablear, ejecutando la app:
//
//     rutas registradas: 223 · POST en total: 93 · POST que cree una revisión: 0
//
// «Construido ≠ alcanzable» en su forma pura: todo el trabajo de SCRUM-655b, 661 y 686 vigilaba un
// camino que ningún profesional podía recorrer.
//
// ── QUÉ HACÍA EL PROFESIONAL MIENTRAS TANTO, que es lo que decidió el tamaño del arreglo ──────
//
// No podía editar el original —no existe ninguna ruta que edite el cuerpo de un presupuesto— así
// que hacía **uno nuevo desde cero**, con OTRO número base. El cliente recibía `P2004227` en vez
// de `P2004226.1`: dos documentos sin relación visible, sin histórico de qué se le enseñó, y con
// los 24 campos heredables rellenados a mano otra vez.
//
// ── ⛔ Y LO QUE ESTE CAMINO NO ES: un rodeo a `puedeEditarse` ──────────────────────────────────
//
// Un presupuesto firmado sigue sin poder tocarse. Crear una revisión **no edita nada**: escribe
// una fila nueva y la anterior se queda exactamente como estaba. Eso se comprueba abajo, campo a
// campo, porque es la diferencia entre una salida y un agujero.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';
// El banco de la casa (SCRUM-417): carga los scripts del panel EN ORDEN y en un solo contexto,
// con `window === global`, que es lo que hace el navegador.
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const { REVISION_HEREDA, numeroConRevision } =
  await import('../dist/modules/quotes/domain/revision.js');
const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');

const MERCHANT = 4242;
const NUMERO = 2004226;

/** La versión vigente, con TODO lo que el `select` pueda pedirle. */
function versionVigente(over = {}) {
  const q = {
    id: 700, merchantId: MERCHANT, quoteNumber: NUMERO, revision: 0,
    signatureUrl: 'data:image/png;base64,FIRMA', // firmada: es el caso que motiva el ticket
  };
  // Todo lo heredable, con un valor reconocible por campo — así se ve CUÁL no viaja.
  for (const c of REVISION_HEREDA) q[c] = 'H:' + c;
  q.total = '3000.00';
  q.currency = 'EUR';
  q.lines = [{ concept: 'Reforma', qty: 1, price: 3000, tax: 0.21 }];
  q.customerId = 55;
  return { ...q, ...over };
}

/**
 * Monta el doble y ejecuta `crearRevisionDeQuote` por el camino real.
 * Devuelve lo creado, los `select` que la función pidió y las escrituras que hizo.
 */
async function crear({ anterior = versionVigente(), hermanas = null } = {}) {
  const selects = [];
  const escrituras = [];
  const actualizaciones = [];
  const grupo = hermanas || [{ id: anterior.id, revision: anterior.revision, signatureUrl: anterior.signatureUrl }];

  inyectarBase({
    'quote.findFirst': (args) => { selects.push(args && args.select); return anterior; },
    'quote.findMany': () => grupo,
    'quote.create': (args) => {
      escrituras.push(args.data);
      return { id: 999, quoteNumber: args.data.quoteNumber, revision: args.data.revision, status: args.data.status };
    },
    'quote.update': (args) => { actualizaciones.push(args); return {}; },
  }, ['../dist/modules/system/quoteAdmin.js']);

  const { crearRevisionDeQuote } = moduloDeDist('../dist/modules/system/quoteAdmin.js');
  const creada = await crearRevisionDeQuote(MERCHANT, anterior.id);
  return { creada, selects, escrituras, actualizaciones };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — sin esto, todo lo de abajo podría pasar sin haber ejecutado nada
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · SUELO: el banco monta un presupuesto y la función lo atiende', async () => {
  const { creada, escrituras } = await crear();
  assert.ok(creada && creada.id, '🔴 no se ha creado nada: el banco no llega a la función');
  assert.equal(escrituras.length, 1,
    `🔴 la función hizo ${escrituras.length} escrituras y tiene que hacer UNA. Con cero, los casos `
    + 'de abajo comprobarían el contenido de una fila que nunca se escribió.');
  assert.ok(REVISION_HEREDA.length >= 20,
    `🔴 CIEGO: REVISION_HEREDA tiene ${REVISION_HEREDA.length} campos. El censo de abajo recorre `
    + 'esa lista, así que con una lista vacía diría «todos viajan» sin mirar ninguno.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② a) 🔴 EL CENSO DE LOS CAMPOS HEREDABLES — el hueco que el ticket declaró para este día
//
// `nuevaRevisionDe` copia con `if (campo in anterior)`: **un campo clasificado que el llamador no
// traiga en su `select` NO VIAJA, y los tests seguirían verdes**. Por eso no se cuenta lo que el
// código dice pedir — se cuenta lo que PIDIÓ, capturando el `select` real desde el doble.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · 🔴 el `select` PIDE los campos heredables, contados uno a uno', async () => {
  const { selects } = await crear();

  assert.ok(selects.length >= 1 && selects[0],
    '🔴 CIEGO: la función no pasó ningún `select`. Sin él Prisma traería el objeto entero y este '
    + 'censo no mediría nada — pero tampoco sabríamos si el día de mañana sigue trayéndolo.');

  const pedidos = Object.keys(selects[0]).filter((k) => selects[0][k] === true);
  const faltan = REVISION_HEREDA.filter((c) => !pedidos.includes(c));

  assert.deepEqual(faltan, [],
    `🔴 el \`select\` NO pide ${faltan.length} campo(s) clasificado(s) como HEREDA: ${faltan.join(', ')}. `
    + 'No falla nada al crearla: el dato simplemente no viaja, y se descubre cuando el cliente echa '
    + 'de menos algo en el papel de la versión nueva.');

  // El recuento, dicho: el censo ha mirado los campos, no ha pasado de largo.
  assert.equal(REVISION_HEREDA.length - faltan.length, REVISION_HEREDA.length);
  assert.ok(pedidos.length > REVISION_HEREDA.length,
    '🔴 el `select` pide exactamente los heredables y ninguno más: falta lo que la función '
    + 'necesita para trabajar (`merchantId`, `quoteNumber`, `revision`).');
});

test('SCRUM-688 · 🔴 y lo que se pidió LLEGA a la fila nueva, campo a campo', async () => {
  const { escrituras } = await crear();
  const nueva = escrituras[0];
  const noViajaron = REVISION_HEREDA.filter((c) => !(c in nueva));
  assert.deepEqual(noViajaron, [],
    `🔴 ${noViajaron.length} campo(s) clasificado(s) no llegaron a la fila: ${noViajaron.join(', ')}. `
    + 'Clasificar NO es que viaje — es la lección de SCRUM-686, y aquí se comprueba el viaje.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ 🔴 EL QUE DECIDE: la revisión queda VINCULADA, no es un documento nuevo suelto
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · 🔴 EL QUE DECIDE: sale `P2004226.1`, no un número nuevo', async () => {
  const { creada, escrituras } = await crear();
  assert.equal(escrituras[0].quoteNumber, NUMERO,
    '🔴 la revisión ha tomado OTRO número base. Entonces no es una revisión: es un documento nuevo '
    + 'sin relación con el que el cliente ya vio, que es exactamente lo que se hacía antes.');
  assert.equal(escrituras[0].revision, 1, '🔴 la revisión nueva no es la 1');
  assert.equal(creada.numero, numeroConRevision({ numero: String(NUMERO), revision: 1 }));
  assert.match(String(creada.numero), /\.1$/, `🔴 el número visible no lleva el «.1»: ${creada.numero}`);
});

test('SCRUM-688 · 🔴 el número sale del GRUPO ENTERO, no de sumar uno a la abierta', async () => {
  // Con dos versiones y revisando la `.0`, sumar uno daría `.1` — que ya existe — y el grupo
  // tendría dos filas con la misma revisión: «cuál está vigente» dejaría de tener respuesta.
  const { escrituras } = await crear({
    hermanas: [
      { id: 700, revision: 0, signatureUrl: 'x' },
      { id: 701, revision: 1, signatureUrl: null },
    ],
  });
  assert.equal(escrituras[0].revision, 2,
    `🔴 la revisión nueva es la ${escrituras[0].revision} y el grupo ya tiene una .1. Dos filas con `
    + 'la misma revisión hacen que «cuál está vigente» no tenga respuesta.');
});

test('SCRUM-688 · ✅ y nace en `draft`, marcada como venida de una revisión', async () => {
  const { escrituras } = await crear();
  assert.equal(escrituras[0].status, 'draft', '🔴 la revisión no nace como borrador');
  assert.equal(escrituras[0].createdVia, 'revision',
    '🔴 la revisión no queda marcada como tal: no se podría distinguir de un presupuesto suelto');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO — un presupuesto FIRMADO no se toca. La revisión es la salida, no un rodeo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · ✅ crear una revisión NO escribe en la versión anterior', async () => {
  const { actualizaciones, escrituras } = await crear();
  assert.deepEqual(actualizaciones, [],
    `🔴 la función ha hecho ${actualizaciones.length} UPDATE. Crear una revisión escribe una fila `
    + 'NUEVA y no toca la anterior: si toca la firmada, esto es un rodeo a `puedeEditarse` y no '
    + 'la salida que el ticket pedía.');
  // Y la firma NO se hereda: el trazo del cliente cubre lo que vio, no otra versión.
  assert.equal('signatureUrl' in escrituras[0], false,
    '🔴 la revisión hereda la FIRMA de la anterior. Eso es firmar por el cliente un documento que '
    + 'no ha visto.');
});

test('SCRUM-688 · ✅ POSITIVO: ver revisiones sigue funcionando igual', async () => {
  const { vistaDeRevisiones } = await import('../dist/modules/quotes/domain/revision.js');
  const grupo = [
    { id: 1, numero: 'P2004226', revision: 0, firmado: true },
    { id: 2, numero: 'P2004226', revision: 1, firmado: false },
  ];
  const v = vistaDeRevisiones(grupo[0], grupo);
  assert.equal(v.revisiones.length, 2);
  assert.equal(v.vigenteId, 2, '🔴 la vigente ha dejado de ser la revisión más alta');
  assert.equal(v.revisiones[0].esVigente, false);
  assert.equal(v.revisiones[1].esVigente, true);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② b) 🔴 EL PDF DE UNA REVISIÓN CREADA POR ESTE CAMINO — el segundo hueco declarado
//
// El ticket lo dijo: «nadie ha verificado el PDF de una revisión creada por este camino».
// Aquí se genera el papel CON LOS DATOS QUE LA FUNCIÓN ESCRIBIÓ, no con un objeto inventado.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · ✅ el PDF de la revisión SALE, con su contenido heredado', async () => {
  const { escrituras } = await crear();
  const fila = escrituras[0];

  const { outPath } = await generateQuotePdf({
    quoteId: 6881,
    quoteNumber: NUMERO,
    merchantId: MERCHANT,
    merchant: { name: 'Taller de prueba' },
    customer: { name: 'Cliente QA' },
    currency: fila.currency,
    lines: fila.lines,
    total: fila.total,
    qrData: 'x',
  });

  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true,
    `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un texto vacío pasaría por «no dice nada».`);
  assert.ok(r.texto.includes('3.000,00') || r.texto.includes('3000,00'),
    '🔴 el total heredado no ha llegado al papel de la revisión');
  assert.ok(r.texto.includes('Reforma'),
    '🔴 las líneas heredadas no han llegado al papel de la revisión');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 DEFECTO VIVO, MEDIDO Y NO ARREGLADO AQUÍ · el PDF no puede decir DE QUÉ VERSIÓN es
//
// El ticket mandaba verificar «el PDF de una revisión creada por este camino». Verificado, y sale
// un defecto real que NO se toca en este encargo:
//
//     ParamsPdfPresupuesto.quoteNumber?: number | null        ← un ENTERO
//     .text(`${QUOTE_LABEL} #${params.quoteNumber ?? params.quoteId}`)   (pdf.service.ts:749)
//
// El número del papel es un entero, así que **no admite el «.1»**: la revisión y la original salen
// con el MISMO `#2004226`. El cliente recibe dos documentos que se llaman igual — exactamente lo
// que las revisiones existen para evitar.
//
// ⛔ POR QUÉ NO SE ARREGLA AQUÍ: cambiarlo es modificar `pdf.service.ts`, el fichero del camino de
// emisión (regla 38: se lee, no se modifica). Y no es un detalle de formato — es decidir qué
// número ve el cliente en un documento, que además es microcopy (regla 30).
//
// Este caso FIJA el estado de hoy. Si alguien arregla el PDF, cae, y ése es el aviso de que hay
// que venir aquí a cambiarlo por la afirmación contraria.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · 🔴 DEFECTO VIVO: el PDF de la revisión NO lleva el «.1» que la distingue', async () => {
  const { creada } = await crear();
  const { outPath } = await generateQuotePdf({
    quoteId: 6882, quoteNumber: NUMERO, merchantId: MERCHANT,
    merchant: { name: 'Taller de prueba' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', lines: [{ concept: 'Reforma', qty: 1, price: 3000, tax: 0.21 }],
    total: '3000.00', qrData: 'x',
  });
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);

  assert.equal(r.texto.includes(String(creada.numero)), false,
    '🔴 EL PDF YA LLEVA EL NÚMERO CON REVISIÓN. Es una buena noticia y hay que anotarla: el defecto '
    + 'que este caso fijaba está arreglado, así que este test tiene que pasar a EXIGIRLO en vez de '
    + 'declararlo. No lo borres: gíralo.');
  assert.ok(r.texto.includes(String(NUMERO)),
    `🔴 el PDF no lleva ni el número base (${NUMERO}): entonces este caso no está midiendo lo que `
    + 'dice, porque el papel no identifica el documento de ninguna forma.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ EL TEXTO DEL BOTÓN YA ESTÁ FIRMADO — este caso está GIRADO, no borrado
//
// Nació el 15-sep-2026 exigiendo lo CONTRARIO: que el centinela
// `⛔ PENDIENTE DE MICROCOPY (SCRUM-688)` siguiera puesto mientras el fundador no escribiera los
// textos, y que no se colara ninguno en `TEXTOS`. Su propio mensaje decía cómo terminaría:
//
//     «si el fundador ya aprobó ese texto, se mueve a `TEXTOS`»
//
// El 16-sep-2026 los firmó, así que el caso pasa a EXIGIR lo firmado en vez de declarar lo
// pendiente. Se gira porque el hecho que vigila no ha desaparecido —sigue habiendo dos rótulos de
// esta pantalla que son del fundador—, sólo ha cambiado de estado.
//
// 🔴 Y NO SE FÍA DE MI PALABRA: el literal se contrasta contra el registro de aprobaciones con
// `constaAprobado()`, la única función que barre `docs/microcopy/` y el registro congelado. Un
// texto en pantalla sin ficha es exactamente el defecto que la regla 30 persigue, y comprobarlo
// escribiéndolo dos veces aquí no comprobaría nada.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// El fichero se CARGA como lo carga el navegador —`cargarDashboard` lo corre en su vm con
// `ctx.window = ctx`— en vez de leer su texto. Leerlo mediría el parecido; cargarlo mide lo que
// la pantalla tendrá delante. (Un `require()` no vale: el fichero publica en `window` al final.)
test('SCRUM-688 · ✅ los dos textos del botón están FIRMADOS, y constan en el registro', () => {
  const banco = cargarDashboard(RAIZ);

  // SUELO: si el fichero no llegó a cargarse, todo lo de abajo saldría `undefined` y el caso
  // pasaría por «no hay microcopy sin firmar», que es la conclusión contraria a la verdadera.
  const roto = banco.fallos.find((f) => f.fichero.includes('quoteRevisiones'));
  assert.equal(roto, undefined,
    `🔴 CIEGO: la pantalla de revisiones no carga (${roto && roto.error}). Sin cargar, este caso `
    + 'no puede afirmar nada sobre sus textos.');

  const aprobadas = banco.ctx.REVISIONES_TEXTOS;
  assert.equal(typeof aprobadas, 'object', '🔴 la pantalla ya no publica sus textos aprobados');

  // Ocho: las SEIS del 3-sep-2026 más las DOS de hoy. Ni una más — un rótulo nuevo aquí dentro
  // sería microcopy sin firmar disfrazada de firmada, que es lo que este caso existe para impedir.
  assert.equal(Object.keys(aprobadas).length, 8,
    `🔴 \`TEXTOS\` tiene ${Object.keys(aprobadas).length} entradas y son 8: las 6 del 3-sep-2026 y `
    + '`crearRevision` + `errorCrear`, firmadas el 16-sep-2026. Si has añadido una, necesita ficha '
    + 'en `docs/microcopy/` antes de entrar aquí (regla 30).');

  assert.equal(aprobadas.crearRevision, 'Crear revisión',
    '🔴 el rótulo del botón no es el literal firmado. El texto es del fundador: no se retoca.');
  assert.equal(aprobadas.errorCrear, 'No se ha podido crear la revisión. Vuelve a intentarlo.',
    '🔴 el aviso de fallo no es el literal firmado. Va en la voz pasiva de la casa —«no se ha '
    + 'podido»—, y cambiarle una palabra es escribir microcopy propia.');

  // 🔴 EL CENTINELA NO SOBREVIVE EN NINGÚN RÓTULO. Un texto firmado que saliera a pantalla
  // diciendo «PENDIENTE» es el defecto al revés, y se vería en el papel del cliente.
  for (const [clave, txt] of Object.entries(aprobadas)) {
    assert.equal(/PENDIENTE DE MICROCOPY/.test(String(txt)), false,
      `🔴 «${clave}» está en los APROBADOS y arrastra el centinela de pendiente.`);
  }

  // Y el bloque de pendientes se fue ENTERO, no se quedó vacío: una caja que ya no distingue nada
  // sólo puede engañar al que la lea después.
  assert.equal(banco.ctx.REVISIONES_TEXTOS_SIN_APROBAR, undefined,
    '🔴 la pantalla sigue publicando un bloque de textos sin aprobar. Si hay uno nuevo, se dice en '
    + 'el informe; si es el de SCRUM-688, ya está firmado y sobra.');
});

test('SCRUM-688 · 🔴 los dos literales CONSTAN aprobados en el registro — con su suelo', async () => {
  const { constaAprobado } = await import('./_microcopy-aprobada.mjs');

  // SUELO DEL INSTRUMENTO: si `constaAprobado` no encontrara NADA de lo que ya está firmado, su
  // «no consta» de abajo no distinguiría «sin ficha» de «no sé buscar». Se prueba con uno de los
  // seis del 3-sep-2026, que llevan en registro desde entonces.
  assert.ok(constaAprobado('No se ha podido leer el historial de revisiones.').length > 0,
    '🔴 CIEGO: el buscador de aprobaciones no encuentra un literal que SÍ está en registro desde '
    + 'el 3-sep-2026. Con él ciego, lo de abajo diría «no consta» sin haber mirado.');

  for (const literal of ['Crear revisión', 'No se ha podido crear la revisión. Vuelve a intentarlo.']) {
    const fichas = constaAprobado(literal);
    assert.ok(fichas.length > 0,
      `🔴 «${literal}» se pinta en pantalla y NO consta aprobado por quien puede aprobarlo. `
      + 'Eso es microcopy sin firma en producción (regla 30): o falta su ficha en `docs/microcopy/`, '
      + 'o la ficha no lleva la firma del fundador.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA RUTA EXISTE **Y DECLARA ROL** — lo puso el guard de SCRUM-55, no yo
//
// La ruta nació sin `requireRole` y la red fail-closed dio rojo con su nombre dentro. Se arregló
// el código, no el guard (regla 41). Este caso lo fija aquí, en el banco del ticket: si mañana
// alguien quita la puerta, no hace falta leerse por qué otro fichero se puso rojo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · 🔴 la ruta está montada y exige rol `admin`', async () => {
  // 🔴 EL ORDEN IMPORTA, y el suelo de abajo lo cazó: los montajes se registran AL CARGAR la app.
  // Sin esta línea, `getAdminMounts()` devuelve `[]` y el caso diría «la ruta no declara rol»
  // sin haber mirado ninguna ruta — la conclusión contraria a la verdadera, con el mismo rojo.
  await import('../dist/app.js');
  const { getAdminMounts } = await import('../dist/core/http/adminMounts.js');
  const montajes = getAdminMounts();
  assert.ok(montajes.length > 0,
    '🔴 CIEGO: no hay montajes /admin. Sin ellos este caso no puede encontrar ninguna ruta y '
    + 'pasaría por «la ruta no declara nada» sin haber mirado.');

  const rolDe = (h) => (h && h.__requiredRole) || null;
  let encontrada = null;
  for (const m of montajes) {
    for (const l of m.router.stack) {
      if (!l.route || l.route.path !== '/:id/revisiones' || !l.route.methods.post) continue;
      encontrada = {
        ruta: m.prefix + l.route.path,
        rol: l.route.stack.map((s) => rolDe(s.handle)).find(Boolean)
          || m.gates.map(rolDe).find(Boolean)
          || m.router.stack.filter((x) => !x.route).map((x) => rolDe(x.handle)).find(Boolean)
          || null,
      };
    }
  }
  assert.ok(encontrada,
    '🔴 `POST /:id/revisiones` NO está montada bajo ningún router /admin: el motor vuelve a no '
    + 'tener llamador alcanzable.');
  assert.equal(encontrada.ruta, '/admin/quotes/:id/revisiones',
    `🔴 la ruta cuelga de ${encontrada.ruta} y no de los presupuestos`);
  assert.equal(encontrada.rol, 'admin',
    `🔴 la ruta declara rol ${JSON.stringify(encontrada.rol)}. Crear una revisión CREA un `
    + 'presupuesto, y `POST /admin/quotes` tampoco es del Operario: el default de S1 es admin.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA PANTALLA CABLEA EL BOTÓN SOBRE LA VIGENTE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-688 · 🔴 el botón apunta a la VIGENTE, no a la versión abierta', () => {
  const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quoteRevisiones.js'), 'utf8');
  assert.match(VISTA, /data-revision-crear/,
    '🔴 la pantalla ya no ofrece crear una revisión: el motor vuelve a no tener llamador');
  assert.match(VISTA, /\/admin\/quotes\/'\s*\+\s*id\s*\+\s*'\/revisiones/,
    '🔴 la pantalla no llama a `POST /admin/quotes/:id/revisiones`');
  // La vigente la decide el SERVIDOR: si la pantalla la derivara, tendríamos dos criterios.
  assert.match(VISTA, /if \(filas\[k\]\.vigente\) vigente = filas\[k\]/,
    '🔴 la pantalla ha dejado de tomar la vigente del dato del servidor');
});
