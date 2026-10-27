// tests/scrum832-atras-vuelve-a-la-lista.test.mjs — SCRUM-832
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: quien entra a una ficha en el móvil, pulsa ATRÁS —que ahí es EL gesto de
// navegación— y se sale de la aplicación.
//
// 🔴 EL ENUNCIADO DECÍA OTRA COSA, y medirlo lo cambió. Decía que Presupuestos falla «por saltarse
// el router». Se salta el router, sí. Pero medido en navegador con historial real, **fallaban las
// CINCO listas**, y las otras cuatro sí usan el router: abrir una ficha creaba **0 entradas** en
// todas, porque los `*-detail` no estaban en `HASH_VIEWS` y `replaceState` **sustituye** la
// entrada de la lista en vez de añadir una. Abrir una ficha BORRABA la lista del historial.
//
// La nota que los dejaba fuera tenía razón en su motivo —«necesitan un id que el hash no lleva»—:
// el arreglo no era meterlos en la lista, era **darle el id al hash**.
//
// ── LO QUE ESTE FICHERO VIGILA, y lo que no ────────────────────────────────────────────────
// Aquí se vigila la PIEZA del router —partir el hash, componerlo, y qué se responde cuando el id
// no vale—, que es lo que se puede ejercitar sin navegador. ⚠️ SCRUM-1177 · El «atrás» de una
// FICHA a su lista, con historial real, NO lo mide nadie: aquí se citaba un guard de navegador que
// no ha existido nunca. `guard:rastro-del-menu` pulsa «atrás», pero entre pantallas del MENÚ.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { tituloProvisionalDelRouter } from './_titulo-provisional-del-router.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'app.js'), 'utf8');
const CODIGO = soloCodigo(APP);

/** Las cinco fichas y su aviso, leídas del propio `DETALLES` — no escritas a mano aquí. */
function detallesDeclarados() {
  const bloque = CODIGO.match(/const DETALLES = \{([\s\S]*?)\n  \};/);
  if (!bloque) return null;
  const filas = [...bloque[1].matchAll(/'([a-z0-9-]+)':\s*\{[^}]*?lista:\s*'([a-z0-9-]+)'[^}]*?aviso:\s*'([^']+)'/g)];
  return filas.map(([, view, lista, aviso]) => ({ view, lista, aviso }));
}

test('SCRUM-832 · SUELO: se encuentran las cinco fichas declaradas', () => {
  const d = detallesDeclarados();
  assert.ok(d, '🔴 CIEGO: no encuentro `DETALLES` en app.js. Si cambió de forma, este guard dejó '
    + 'de mirar lo que cree que mira y todo lo de abajo es un verde vacío.');
  // SCRUM-980 · la SEXTA: `parte-detail`, que ahora se abre desde el historial de la ficha del
  // cliente. Entra CON su aviso firmado (P8) y vuelve a Trabajos, que es lo que este suelo exige.
  // SCRUM-1156 · la SÉPTIMA: `expenses-detail`, la ficha del gasto, con su ruta propia (1156b) y su
  // aviso firmado por el orquestador el 16-oct-2026. Vuelve a Gastos.
  assert.equal(d.length, 7,
    `🔴 hay ${d.length} fichas declaradas y son siete: presupuesto, trabajo, factura, albarán, `
    + 'cliente, parte y gasto. Si entra una octava sin aviso, el atrás la deja fuera de la aplicación.');
});

test('SCRUM-832 · cada ficha vuelve a SU lista, y su lista es una vista real', () => {
  const vistas = new Set([...CODIGO.matchAll(/case '([a-z0-9-]+)':/g)].map((m) => m[1]));
  for (const { view, lista } of detallesDeclarados()) {
    assert.ok(vistas.has(lista),
      `🔴 «${view}» dice volver a «${lista}», que no es ninguna vista del router. Volver a una `
      + 'vista que no existe cae en el `default:` y te deja en Inicio — el defecto de SCRUM-727.');
  }
});

test('SCRUM-832 · 🔴 REGLA 30: los cinco avisos están FIRMADOS, uno a uno', () => {
  // SUELO: si el registro no encontrara nada, el bucle pasaría en verde sin comprobar ni una firma.
  assert.ok(constaAprobado('Ese presupuesto ya no existe.').length > 0,
    '🔴 CIEGO: el registro de microcopy no encuentra un literal que SÍ está firmado.');
  const sinFirma = detallesDeclarados()
    .filter((d) => constaAprobado(d.aviso).length === 0)
    .map((d) => `${d.view} → «${d.aviso}»`);
  assert.deepEqual(sinFirma, [],
    '🔴 un aviso que se le enseña al usuario NO está firmado (regla 30):\n     ' + sinFirma.join('\n     '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TEST QUE NO SE NEGOCIA: «no existe» y «no es tuyo» son INDISTINGUIBLES
//
// 🔒 Dos respuestas distintas a «no existe» y «no es tuyo» convierten la lista de ids en un
// directorio de la competencia: cualquiera recorre números y averigua QUÉ documentos hay en otros
// negocios sin llegar a ver ninguno. Es fuga de tenencia (regla 2) aunque no se enseñe un dato.
//
// Y se compara EL TEXTO, no sólo el destino. Comparar sólo el destino dejaría pasar la fuga más
// fácil de escribir: mismo sitio, mensajes distintos.
// ═════════════════════════════════════════════════════════════════════════════════════════════

// ── 🔴 ESTE BLOQUE CAMBIÓ EL 14-oct-2026 (SCRUM-1150d), A PROPÓSITO, y aquí va por qué ─────────
// Hasta ese día exigía que el `catch` NO LEYERA el error: con cualquier fallo, a la lista y «Ese
// presupuesto ya no existe.». Con un 500 o sin red eso es FALSO —el presupuesto está en la lista de
// al lado (medido en SCRUM-1150 c.19286)— y el orquestador decidió separarlos (encargo del 14-oct,
// SCRUM-1150 punto 2), con una condición: el test nuevo NO puede ser más flojo que el viejo.
//
// Lo que se protegía era «no existe» = «no es tuyo», y eso se sigue exigiendo, ahora CORRIDO sobre
// la función REAL de `app.js` (antes se corría una copia escrita a mano en el test, que no habría
// cambiado aunque cambiara el router). Lo único que el `catch` puede preguntar es si el servidor
// contestó 4xx; dentro de los 4xx, todo da lo mismo. Y lo que el router no puede hacer nunca es
// pintar el error: ni su `message`, ni su código.
//
// Por qué no abre la fuga: las seis rutas filtran por negocio en el `where` antes de nada que pueda
// lanzar, así que un id de otro negocio y uno inexistente dan el mismo 404 (leído en SCRUM-1150).
// Un 5xx no depende de quién es el dueño del id.

// Las mutaciones que este fichero tiene que cazar; las corre `npm run meta:mutaciones` en cada PR.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · vuelve el «ya no existe» con un 500: el defecto medido en SCRUM-1150 c.19286.
    fichero: 'public/dashboard/js/app.js',
    de: 'if (!elServidorDijoQueNo(e)) { _origRender(view, { [d.clave]: id }); return; }',
    a: 'void elServidorDijoQueNo;',
    cae: 'SCRUM-1150d · 🔴 CORRIDO: con un 5xx o sin red NO dice «ya no existe»: abre la ficha, que dice lo suyo',
  },
  {
    // M2 · se distingue DENTRO de los 4xx: «no existe» y «no es tuyo» divergen (la fuga de la regla 2).
    fichero: 'public/dashboard/js/app.js',
    de: 'return typeof s === \'number\' && s >= 400 && s < 500;',
    a: 'return s === 404;',
    cae: 'SCRUM-832 · 🔴 CORRIDO: id inexistente e id de OTRO merchant dan el MISMO texto y destino, en las SIETE fichas',
  },
  {
    // M3 · el router pinta el error crudo en vez de su aviso firmado.
    fichero: 'public/dashboard/js/app.js',
    de: "if (typeof showToast === 'function') showToast(d.aviso, 'warn');",
    a: "if (typeof showToast === 'function') showToast(e.message, 'warn');",
    cae: 'SCRUM-832 · 🔴 CORRIDO: id inexistente e id de OTRO merchant dan el MISMO texto y destino, en las SIETE fichas',
  },
];

/** La función REAL del router, sacada de `app.js` y ejecutada con dobles de lo que toca. */
function routerDeVerdad() {
  const detalles = CODIGO.match(/const DETALLES = \{[\s\S]*?\n  \};/);
  const pregunta = CODIGO.match(/function elServidorDijoQueNo[\s\S]*?\n  \}/);
  const abrir = CODIGO.match(/async function abrirFichaDesdeHash[\s\S]*?\n  \}/);
  assert.ok(detalles && abrir, '🔴 CIEGO: no encuentro `DETALLES` o `abrirFichaDesdeHash` en app.js.');
  assert.ok(pregunta, '🔴 CIEGO: no encuentro `elServidorDijoQueNo` en app.js.');
  // eslint-disable-next-line no-new-func
  return new Function('apiRequest', '_origRender', 'showToast', 'history',
    `${detalles[0]}\n${pregunta[0]}\n${abrir[0]}\nreturn { DETALLES, abrirFichaDesdeHash };`);
}
// Se saca al USARLO, no al cargar el fichero: si falta una función, cae el caso que la necesita con
// su «CIEGO», y no el fichero entero llevándose por delante los casos que no tienen que ver.
async function abrirDesdeElHash(view, fallo) {
  const r = { avisos: [], destinos: [], hashes: [] };
  const { DETALLES: D, abrirFichaDesdeHash } = routerDeVerdad()(
    async () => { if (fallo) throw fallo; return {}; },
    (v, opts) => r.destinos.push(JSON.stringify([v, opts || null])),
    (t) => r.avisos.push(String(t)),
    { replaceState: (_a, _b, h) => r.hashes.push(h) },
  );
  await abrirFichaDesdeHash(view, '7');
  r.d = D[view];
  return r;
}
/** Un error con la forma EXACTA que lanza `_pedir` (`api.js`) cuando el servidor contesta. */
const contesta = (status, code, message) =>
  Object.assign(new Error(message || `API ${status}: ${code}`), { status, code, data: { error: code, ...(message ? { message } : {}) } });
/** Y la de `_pedir` sin red: `sinRed`, sin `status`. */
const sinRed = () => Object.assign(new Error('Failed to fetch'), { sinRed: true });

test('SCRUM-832 · 🔴 el `catch` sólo pregunta SI el servidor contestó, y nada más del error', () => {
  const abrir = CODIGO.match(/async function abrirFichaDesdeHash[\s\S]*?\n  \}/);
  const pregunta = CODIGO.match(/function elServidorDijoQueNo[\s\S]*?\n  \}/);
  assert.ok(abrir && pregunta, '🔴 CIEGO: no encuentro las dos funciones del router.');

  // Ni el router ni su pregunta pueden nombrar un código concreto ni leer el cuerpo del error.
  for (const [nombre, cuerpo] of [['abrirFichaDesdeHash', abrir[0]], ['elServidorDijoQueNo', pregunta[0]]]) {
    for (const señal of ['.code', '.data', 'message', '403', '404', 'forbidden', 'not_found']) {
      assert.equal(cuerpo.includes(señal), false,
        `🔴 \`${nombre}\` mira «${señal}». En cuanto el router distingue POR QUÉ dijo que no el servidor, `
        + 'puede contestar distinto a «no existe» y a «no es tuyo», y eso convierte la lista de ids '
        + 'en un directorio de lo que hay en otros negocios (regla 2).');
    }
  }
  // Dentro del `catch`, el error se usa UNA vez y sólo para preguntarle a `elServidorDijoQueNo`.
  const delCatch = abrir[0].match(/catch \((\w+)\) \{([\s\S]*?)\n    \}/);
  assert.ok(delCatch, '🔴 CIEGO: no encuentro el `catch` de la petición.');
  const [, variable, cuerpoCatch] = delCatch;
  const usos = cuerpoCatch.match(new RegExp('\\b' + variable + '\\b', 'g')) || [];
  const preguntas = cuerpoCatch.match(new RegExp('elServidorDijoQueNo\\(' + variable + '\\)', 'g')) || [];
  assert.equal(preguntas.length, 1, `🔴 el \`catch\` no le pregunta a \`elServidorDijoQueNo(${variable})\`.`);
  assert.equal(usos.length, 1,
    `🔴 el \`catch\` usa \`${variable}\` ${usos.length} veces: fuera de la pregunta, el error no se lee ni se pinta.`);
});

test('SCRUM-832 · 🔴 CORRIDO: id inexistente e id de OTRO merchant dan el MISMO texto y destino, en las SIETE fichas', async () => {
  // Se EJECUTA la función de `app.js`. Cuatro 4xx con mensajes DISTINTOS entre sí: si el router
  // pintara el error, o distinguiera un código de otro, las salidas dejarían de ser iguales.
  const vistas = detallesDeclarados().map((d) => d.view);
  assert.equal(vistas.length, 7, '🔴 CIEGO: no salen las siete fichas.');
  for (const view of vistas) {
    const salidas = [];
    for (const fallo of [
      contesta(404, 'not_found'),
      contesta(403, 'forbidden', 'No tienes acceso a este documento.'),
      contesta(400, 'invalid_id'),
      contesta(403, 'trial_expired', 'Tu prueba ha terminado. Elige un plan para continuar.'),
    ]) {
      const r = await abrirDesdeElHash(view, fallo);
      assert.deepEqual(r.avisos, [r.d.aviso], `🔴 ${view} con ${fallo.status}: el aviso no es el firmado, tal cual.`);
      assert.deepEqual(r.destinos, [JSON.stringify([r.d.lista, null])], `🔴 ${view} con ${fallo.status}: no vuelve a su lista.`);
      salidas.push(JSON.stringify([r.avisos, r.destinos, r.hashes]));
    }
    assert.equal(new Set(salidas).size, 1,
      `🔴 ${view}: el resultado DELATA cuál es cuál:\n     ${salidas.join('\n     ')}\n`
      + 'Con eso se recorre la lista de ids y se averigua qué documentos hay en otros negocios (regla 2).');
  }
});

test('SCRUM-1150d · 🔴 CORRIDO: con un 5xx o sin red NO dice «ya no existe»: abre la ficha, que dice lo suyo', async () => {
  // CONTROL POSITIVO: con la petición bien, la misma sonda ve la ficha abrirse; y con un 404 (caso
  // de arriba) ve el aviso. Así «ningún aviso» de abajo no puede ser una sonda sorda.
  const ok = await abrirDesdeElHash('quotes-detail', null);
  assert.deepEqual(ok.destinos, [JSON.stringify(['quotes-detail', { quoteId: '7' }])], '🔴 CIEGO: la sonda no ve abrirse la ficha.');
  const no = await abrirDesdeElHash('quotes-detail', contesta(404, 'not_found'));
  assert.equal(no.avisos.length, 1, '🔴 CIEGO: la sonda no ve el aviso de un 404.');

  for (const { view } of detallesDeclarados()) {
    for (const [rotulo, fallo] of [
      ['500', contesta(500, 'internal_error')],
      ['503', contesta(503, 'unavailable', 'Servicio no disponible')],
      ['sin red', sinRed()],
      ['un Error sin estado', new Error('algo')],
    ]) {
      const r = await abrirDesdeElHash(view, fallo);
      assert.deepEqual(r.avisos, [],
        `🔴 ${view} con ${rotulo}: el router pinta «${r.avisos.join(' | ')}». Sin respuesta del servidor no se sabe `
        + 'nada del documento: decir que no existe es afirmar algo falso, y pintar el error es enseñar la tripa.');
      assert.deepEqual(r.destinos, [JSON.stringify([view, { [r.d.clave]: '7' }])],
        `🔴 ${view} con ${rotulo}: no abre la ficha (va a ${r.destinos.join(', ')}).`);
      assert.deepEqual(r.hashes, [], `🔴 ${view} con ${rotulo}: el hash se cambia a la lista.`);
    }
  }
});

test('SCRUM-1150d · la ficha del presupuesto, abierta con un 500, dice su «Error cargando presupuesto.» y no el código', async () => {
  // El último eslabón: lo que se ve tras abrirla. Se monta la ficha REAL con su GET en 500.
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async () => ({
        ok: false, status: 500, statusText: 'Internal Server Error',
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'internal_error' }), text: async () => '{"error":"internal_error"}', blob: async () => ({}),
      }),
    },
  });
  const v = await pintarVista(banco, 'renderQuoteDetailView', 7);
  assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
  for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r));
  const textos = todos(v.contenedor).map((n) => String(n.textContent || '')).filter(Boolean);
  assert.ok(textos.includes('Error cargando presupuesto.'), `🔴 CIEGO o cambiado: la ficha no dice su error: ${JSON.stringify(textos)}`);
  assert.equal(textos.some((t) => /internal_error|API 500|ya no existe/.test(t)), false,
    `🔴 la ficha enseña el código o un «ya no existe»: ${JSON.stringify(textos)}`);
});

test('SCRUM-1150d · la ficha del albarán, abierta con un 500, dice el texto FIRMADO y no «API 500»', async () => {
  // Hasta SCRUM-1150d pintaba `'No se pudo cargar el albarán: ' + e.message`: con el hash abriendo la
  // ficha en un 5xx, eso se habría visto también por ahí. Literal: SCRUM-1150 c.19658.
  const FIRMADO = 'No se pudo cargar el albarán. Inténtalo de nuevo.';
  assert.ok(constaAprobado(FIRMADO).length > 0, '🔴 el literal del albarán no consta firmado (regla 30).');
  for (const [rotulo, cuerpo, espera] of [
    ['500 sin message', { error: 'internal_error' }, FIRMADO],
    ['500 con un message para personas', { error: 'x', message: 'Mensaje para personas.' }, 'Mensaje para personas.'],
  ]) {
    const banco = cargarDashboard(RAIZ, {
      red: {
        fetch: async () => ({
          ok: false, status: 500, statusText: 'Internal Server Error',
          headers: { get: () => 'application/json' },
          json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
        }),
      },
    });
    const v = await pintarVista(banco, 'renderAlbaranDetailView', 7);
    assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
    for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r));
    const textos = todos(v.contenedor).map((n) => String(n.textContent || '')).filter(Boolean);
    assert.ok(textos.includes(espera), `🔴 ${rotulo}: la ficha no dice «${espera}»: ${JSON.stringify(textos)}`);
    assert.equal(textos.some((t) => /internal_error|API 500|ya no existe/.test(t)), false,
      `🔴 ${rotulo}: la ficha enseña el código o un «ya no existe»: ${JSON.stringify(textos)}`);
  }
});

test('SCRUM-832 · el hash se parte por la PRIMERA barra, y no se renombra ninguna clave', () => {
  // La decisión ① del fundador: `#quotes-detail/123`, aditivo. Si alguien partiera por la última
  // barra o por todas, un id con barra rompería la vista en silencio.
  assert.match(CODIGO, /indexOf\('\/'\)/,
    '🔴 `viewFromHash` ya no parte por la PRIMERA barra. La forma acordada es `#clave/id`, y las '
    + 'claves existentes no se renombran: el router sólo aprende a partir.');
  for (const clave of ['quotes-detail', 'jobs-detail', 'invoice-detail', 'albaran-detail', 'customer-360']) {
    assert.match(CODIGO, new RegExp(`case '${clave}':`),
      `🔴 ha desaparecido la vista «${clave}» del router. El cambio era ADITIVO: ninguna clave se `
      + 'renombra.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ENGANCHE QUE ME MORDIÓ, y por eso tiene test propio
//
// Mandar Presupuestos por el router parecía gratis: una línea en vez de cinco. Medido en
// navegador, NO era gratis: el usuario pasaba de ver «Presupuesto #N-1» arriba a ver
// «Presupuestos», el plural, en la ficha de UNO.
//
// La causa no se ve leyendo el router. `quotesDetailView.js` corrige el título al número REAL del
// presupuesto —que no es el id— **sólo si el título ya empieza por «Presupuesto #»**. Ese es el
// contrato: quien navega escribe el rótulo provisional con el id, y la ficha lo corrige al cargar.
// El camino viejo lo cumplía por casualidad, porque escribía el título a mano.
//
// ── 🔴 ESTE CASO CAMBIÓ EL 13-oct-2026 (SCRUM-1482b), y aquí va por qué ───────────────────────
// Hasta ese día comparaba DOS CADENAS del fuente: sacaba el prefijo de la regex de la ficha
// («Presupuesto #») y exigía que el router lo llevara escrito entre comillas. Eso obligaba al
// router a escribir «Presupuesto #» y algo detrás ANTES de tener la respuesta, y lo único que tiene
// entonces es el id de la ruta, que es el de la tabla y no el número del presupuesto. El caso no
// pasaba a pesar del defecto de SCRUM-1482: lo EXIGÍA. Y no veía el defecto que sí quería ver: un
// título que se queda sin corregir con las dos cadenas en su sitio.
//
// El texto firmado para ese título (SCRUM-1482 c.18490) es la palabra del documento, sola, leída
// del locale. Lo cambia la orden del orquestador escrita en SCRUM-1482 c.19093: «el caso 7 se
// CAMBIA, no se rodea». Ahora no lee dos cadenas: EJECUTA el enganche. El título de partida es el
// que escribe el router de verdad (`_titulo-provisional-del-router.mjs` lo saca de su `case`), y
// sobre él se monta la ficha de verdad.
//
// Su control positivo (`docs/master/SCRUM-1482.md`, sección 1482b): con el router y la ficha de
// antes, este caso sale ROJO; con el router nuevo y la ficha de antes, también (es el título que
// se quedaba sin número para siempre, medido en c.18498).
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-832 · el router escribe el título que la ficha sabe CORREGIR', async () => {
  const ID = 205;       // el id de la ruta: el de la tabla
  const NUMERO = 4;     // el número del presupuesto: lo que el profesional ve en su lista
  const respuesta = (status, cuerpo) => ({
    ok: status < 400, status,
    headers: { get: () => 'application/json' },
    json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
  });
  const presupuesto = {
    id: ID, number: NUMERO, quoteNumber: NUMERO, revision: 0, numeroConRevision: 'P4', revisiones: [], vigenteId: ID,
    status: 'draft', total: '1.00', currency: 'EUR', payToken: 'tok832',
    lines: [{ concept: 'Punto de luz', qty: 1, price: 1, tax: 0 }],
    createdAt: '2026-10-13T10:00:00.000Z', updatedAt: '2026-10-13T10:00:00.000Z',
    customer: { id: 3, name: 'Ana Ruiz', phone: null, email: null, notes: null },
    merchant: { id: 7, name: 'QA 832', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
    charge: null, invoices: [],
    decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: null, evidence: null },
    billingPlan: [], nextStage: null, hasCustomPlan: false,
    asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
    albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  };
  const LOCALES = [
    { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteVerb: 'presupuesto', currency: 'EUR' },
    { quote: 'Cotización', quotePlural: 'Cotizaciones', quoteVerb: 'cotización', currency: 'MXN' },
  ];

  for (const locale of LOCALES) {
    // ① Lo que el router escribe al abrir la ficha, ejecutando SU expresión (CIEGO si no la hay).
    const provisional = tituloProvisionalDelRouter(RAIZ, { quoteId: ID, locale });
    assert.ok(provisional.length > 0, '🔴 CIEGO: el router deja el título de la ficha vacío.');

    // ② La ficha de verdad, montada sobre ese título, con su carga EN VUELO.
    let contestar;
    const enVuelo = new Promise((res) => { contestar = res; });
    let pedidas = 0;
    const fetch = async (url, opts = {}) => {
      const metodo = String(opts.method || 'GET').toUpperCase();
      if (metodo === 'GET' && new RegExp(`/admin/quotes/${ID}$`).test(String(url))) { pedidas++; return enVuelo; }
      return respuesta(200, []);
    };
    const banco = cargarDashboard(RAIZ, { red: { fetch } });
    banco.ctx.appLocale = locale;
    const titulo = banco.mk('span');
    titulo.id = 'view-title';
    titulo.textContent = provisional;
    banco.ctx.document.body.appendChild(titulo);
    const v = await pintarVista(banco, 'renderQuoteDetailView', ID);
    assert.equal(v.error, null, `🔴 la ficha revienta: ${v.error && v.error.message}`);
    assert.equal(pedidas, 1, '🔴 CIEGO: la ficha no ha pedido el presupuesto, así que no hay nada que corregir.');

    // ③ Mientras carga, el título no lleva un número que todavía no se sabe.
    assert.equal(titulo.textContent.includes(String(ID)) || titulo.textContent.includes('#'), false,
      `🔴 mientras la ficha carga, el título de la vista dice «${titulo.textContent}»: lleva el id de la ruta `
      + `(${ID}, el de la tabla) o una almohadilla. El router aún no sabe el número del presupuesto: lo firmado `
      + 'es la palabra del documento, sola (SCRUM-1482 c.18490).');

    // ④ EL ENGANCHE: cargada, la ficha corrige ESE título al número del presupuesto.
    contestar(respuesta(200, presupuesto));
    for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r));
    assert.equal(titulo.textContent, `${locale.quote} #${NUMERO}`,
      `🔴 el router escribe «${provisional}» y la ficha, ya cargada, deja el título en «${titulo.textContent}»: `
      + `no lo ha corregido a «${locale.quote} #${NUMERO}». Lo que escribe el router y lo que la ficha sabe `
      + 'reconocer se han separado, y en el fuente no se ve: el profesional se queda con un rótulo provisional '
      + 'para siempre (el defecto de SCRUM-832, y la V1 medida en SCRUM-1482 c.18498).');
    const h2 = todos(v.contenedor).filter((n) => n.tagName === 'H2').map((n) => n.textContent);
    assert.deepEqual(h2, [`${locale.quote} #${NUMERO}`], '🔴 CIEGO: la ficha no ha terminado de cargar.');
  }
});
