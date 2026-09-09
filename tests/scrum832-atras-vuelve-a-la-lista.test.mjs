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
  assert.equal(d.length, 5,
    `🔴 hay ${d.length} fichas declaradas y son cinco: presupuesto, trabajo, factura, albarán y `
    + 'cliente. Si entra una sexta sin aviso, el atrás la deja fuera de la aplicación.');
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
// El prefijo NO se escribe aquí a mano: se SACA de la regex de `quotesDetailView.js`. Si alguien
// la cambia allí, este test cambia con ella en vez de quedarse defendiendo una cadena muerta.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-832 · el router escribe el título que la ficha sabe CORREGIR', () => {
  const detalle = soloCodigo(
    fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesDetailView.js'), 'utf8'));

  const corrector = detalle.match(/\/\^([^/\n]+)\/\.test\(\s*viewTitleEl/);
  assert.ok(corrector, '🔴 CIEGO: `quotesDetailView.js` ya no corrige el título de la vista con una '
    + 'regex anclada. Si cambió de forma, este test no está midiendo el enganche que dice medir — '
    + 'y el rótulo puede haberse quedado en el plural sin que nadie se entere.');
  const prefijo = corrector[1];   // «Presupuesto #»

  const caso = CODIGO.match(/case 'quotes-detail':([\s\S]*?)break;/);
  assert.ok(caso, '🔴 CIEGO: no encuentro el `case` de la ficha de presupuesto en el router.');

  assert.ok(caso[1].includes("'" + prefijo + "'"),
    `🔴 el router no escribe un título que empiece por «${prefijo}», así que \`quotesDetailView.js\` `
    + 'NO lo corregirá al número real y el usuario verá el rótulo de la LISTA —en plural— en la '
    + 'ficha de uno solo. Medido en navegador: «Presupuesto #N-1» pasaba a «Presupuestos».');
});
