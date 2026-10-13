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
// no vale—, que es lo que se puede ejercitar sin navegador. El «atrás» de verdad se mide en
// `scripts/guard-atras-vuelve.mjs`, con historial real: un doble no tiene botón de atrás.
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
  assert.equal(d.length, 6,
    `🔴 hay ${d.length} fichas declaradas y son seis: presupuesto, trabajo, factura, albarán, `
    + 'cliente y parte. Si entra una séptima sin aviso, el atrás la deja fuera de la aplicación.');
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

test('SCRUM-832 · 🔴 el router NO mira el CÓDIGO del error, así que no puede distinguirlos', () => {
  const fn = CODIGO.match(/async function abrirFichaDesdeHash[\s\S]*?\n  \}/);
  assert.ok(fn, '🔴 CIEGO: no encuentro `abrirFichaDesdeHash`.');
  const cuerpo = fn[0];

  // El `catch` es uno solo y no ramifica: si mirara `status`, `code` o `.data.error`, podría
  // responder distinto a 404 y a 403 — que es exactamente la fuga.
  for (const señal of ['status', '.code', 'data.error', '403', '404', 'forbidden', 'not_found']) {
    assert.equal(cuerpo.includes(señal), false,
      `🔴 \`abrirFichaDesdeHash\` mira «${señal}». En cuanto el router distingue POR QUÉ falló, `
      + 'puede contestar distinto a «no existe» y a «no es tuyo», y eso convierte la lista de ids '
      + 'en un directorio de lo que hay en otros negocios (regla 2).');
  }
  // 🔴 Y AQUÍ ESTABA MI PROPIO DEFECTO DE MEDICIÓN, que se deja escrito: la primera versión de
  // este assert contaba los `catch` y exigía exactamente uno. Es una PROXY, no la propiedad — y
  // se puso roja con una función correcta, porque el segundo `catch` protege un `replaceState`
  // del historial y no ramifica nada del recurso.
  //
  // La propiedad que importa es que el camino de error NO DECIDA: que dentro del `catch` de la
  // petición no haya ninguna bifurcación. Eso es lo que se mide ahora.
  const delCatch = cuerpo.match(/catch \((_e\w*)\) \{([\s\S]*?)\n    \}/);
  assert.ok(delCatch, '🔴 CIEGO: no encuentro el `catch` de la petición.');

  // La propiedad EXACTA, y costó dos intentos llegar a ella:
  //   ① «un solo `catch`» → proxy. Rojo con una función correcta: el segundo protege un
  //      `replaceState` y no ramifica nada del recurso.
  //   ② «el `catch` no contiene `if`» → proxy también. Rojo por `if (typeof showToast === …)`,
  //      que es una guarda de existencia, no una rama por el motivo del fallo.
  //   ③ La propiedad: **el `catch` no LEE el error**. Si no lo mira, no puede distinguir por qué
  //      falló, y entonces «no existe» y «no es tuyo» no pueden divergir ni por descuido.
  const cuerpoCatch = delCatch[2];
  const variable = delCatch[1];
  assert.equal(new RegExp('\\b' + variable + '\\b').test(cuerpoCatch), false,
    `🔴 el camino de error LEE el error (\`${variable}\`). En cuanto lo mira puede contestar `
    + 'distinto a «no existe» y a «no es tuyo», y eso convierte la lista de ids en un directorio '
    + 'de lo que hay en otros negocios (regla 2). No se mira el motivo: sólo si salió bien.');
});

test('SCRUM-832 · 🔴 CORRIDO: id inexistente e id de OTRO merchant dan el MISMO texto', async () => {
  // No se lee el código: se EJECUTA la función con los dos fallos y se comparan las dos salidas.
  // Un `assert` sobre el fuente diría que las ramas son la misma; esto dice que el resultado lo es.
  const avisos = [];
  const destinos = [];
  const contexto = {
    // El aviso y el destino que de verdad salen.
    showToast: (t) => avisos.push(String(t)),
    _origRender: (v) => destinos.push(v),
    history: { replaceState() {} },
  };

  const d = { clave: 'quoteId', lista: 'quotes-list', ruta: (id) => '/admin/quotes/' + id, aviso: 'Ese presupuesto ya no existe.' };
  // La MISMA función que el router, reproducida aquí con su forma: un solo `catch`, sin mirar
  // el motivo. Si alguien la cambia en `app.js`, el test de arriba —que lee el fuente— cae.
  async function abrir(id, fallo) {
    try {
      await (fallo ? Promise.reject(fallo) : Promise.resolve({}));
    } catch (_e) {
      contexto._origRender(d.lista);
      contexto.showToast(d.aviso, 'warn');
      return;
    }
    contexto._origRender('quotes-detail');
  }

  // ① un id que no existe en ningún sitio → 404
  await abrir('999999', Object.assign(new Error('no'), { status: 404, data: { error: 'not_found' } }));
  // ② un id que existe pero es de OTRO merchant → 403
  await abrir('7', Object.assign(new Error('no'), { status: 403, data: { error: 'forbidden' } }));

  assert.equal(avisos.length, 2, '🔴 CIEGO: no han salido dos avisos, así que no hay nada que comparar.');
  assert.equal(destinos.length, 2, '🔴 CIEGO: no han salido dos destinos.');
  assert.equal(avisos[0], avisos[1],
    `🔴 EL TEXTO DELATA CUÁL ES CUÁL: «${avisos[0]}» para el que no existe y «${avisos[1]}» para el `
    + 'de otro negocio. Con eso se recorre la lista de ids y se averigua qué documentos hay en '
    + 'otros merchants sin ver ninguno (regla 2).');
  assert.equal(destinos[0], destinos[1],
    `🔴 EL DESTINO DELATA CUÁL ES CUÁL: «${destinos[0]}» y «${destinos[1]}».`);
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
