// tests/scrum698-vistas-que-no-se-miden.test.mjs — SCRUM-698
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS PANTALLAS QUE NINGÚN GUARD PODÍA MIRAR, Y EL FALLO QUE NO DECÍA QUIÉN FUE.
//
// SCRUM-697 dejó dos hallazgos al cerrar. Éste los cierra, y ninguno era del producto:
//
// ① SEIS VISTAS NO LLEGABAN A MONTARSE en el banco. Medido una por una, con su error y su
//    línea, ANTES de tocar nada:
//      · cinco fallaban porque el `fetch` del banco devuelve `{}` cuando nadie le pasa datos,
//        y `{}.filter` no existe. Con la forma mínima que cada una PIDE, las cinco se montan.
//      · `settings` fallaba por `insertAdjacentHTML`, una API del DOM que el banco NO TENÍA
//        (cero menciones en el fichero). Mismo hueco que `prepend` (SCRUM-460) y `parentNode`
//        (SCRUM-609): una pantalla entera fuera de alcance por el banco, no por la vista.
//    NINGUNA es un fallo de producto, y por eso no se ha tocado una línea de `public/`.
//
// ② 🔴 `reportsView` DISPARA SU CARGA SIN ESPERARLA, y su rechazo huérfano MATABA EL PROCESO
//    ENTERO. Eso es SCRUM-672 con otra cara y es lo caro: un fichero que muere a nivel de
//    proceso SE LLEVA SUS TESTS CON ÉL, sin un `fail` que diga quién fue. La tanda sigue
//    verde con menos cobertura, y el porcentaje de verdes puede hasta MEJORAR. El suelo del
//    total lo cazaría después; esto lo cierra antes.
//
// 🔴 EL SUELO DE ESTE FICHERO, Y ES LA TRAMPA QUE HAY QUE EVITAR: un censo que dijera «26 de
// 26 se montan» no probaría que se ha arreglado nada — probaría que se ha dejado de mirar. Por
// eso se miden DOS POBLACIONES: cuántas se montan DESNUDAS (sin datos) y cuántas CON la forma
// mínima. La primera es la que vigila que nadie rompa una vista; la segunda, que todas sean
// alcanzables.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Ninguna lista a mano: las vistas son las que el banco publica. Una lista envejece. */
function vistasDelBanco() {
  const b = cargarDashboard(RAIZ);
  return Object.keys(b.ctx)
    .filter((k) => /^render[A-Z].*View$/.test(k) && typeof b.ctx[k] === 'function')
    .sort();
}

async function montarTodas(opciones) {
  const rotas = [];
  const montadas = [];
  for (const v of vistasDelBanco()) {
    const r = await pintarVista(cargarDashboard(RAIZ, opciones), v);
    if (r.error) rotas.push(`${v} → ${String(r.error.message).slice(0, 60)}`);
    else montadas.push(v);
  }
  return { rotas, montadas };
}

// ═══ ① LA POBLACIÓN, Y SU SUELO ══════════════════════════════════════════════════════════

test('SCRUM-698 · SUELO: el censo VE las vistas del panel, y son muchas', () => {
  const vistas = vistasDelBanco();
  assert.ok(vistas.length >= 20,
    `🔴 CIEGO: el censo sólo ve ${vistas.length} vistas. Todo lo que diga este fichero se apoya `
    + 'en esta población: si no la ve, sus ceros no valen nada.');
  // Y que la lista no sea una invención: las que el ticket nombraba tienen que estar.
  for (const v of ['renderReportsView', 'renderSettingsView', 'renderTeamView']) {
    assert.ok(vistas.includes(v), `🔴 «${v}» ha desaparecido del panel o el censo dejó de verla.`);
  }
});

// ═══ ② TODAS SE MONTAN, Y LAS QUE NO SE NOMBRAN ══════════════════════════════════════════

test('SCRUM-698 · 🔴 con la forma mínima, TODAS las vistas del panel se montan', async () => {
  const { rotas, montadas } = await montarTodas({ datos: datosDeMuestra });
  assert.ok(montadas.length >= 20,
    `🔴 SUELO: sólo ${montadas.length} vistas montadas. Un cero de «rotas» sobre una población `
    + 'recortada no significa nada.');
  assert.deepEqual(rotas, [],
    `🔴 estas pantallas del panel NO llegan a montarse, así que ningún guard apoyado en el banco `
    + `puede afirmar nada sobre ellas: ${rotas.join(' · ')}.`);
});

test('SCRUM-698 · 🔴 y SIN datos, la lista de las que necesitan fixture NO CRECE', async () => {
  // 🔴 ÉSTE ES EL QUE VIGILA DE VERDAD. El de arriba pasaría aunque alguien rompiera una vista,
  // si el fixture le tapara el fallo. Aquí se mira la pantalla DESNUDA: la que hoy se monta sin
  // datos tiene que seguir haciéndolo, y si aparece una nueva en la lista es que se ha roto.
  const { rotas } = await montarTodas(undefined);
  const nombres = rotas.map((r) => r.split(' → ')[0]).sort();
  assert.deepEqual(nombres, [
    'renderAlbaranDetailView',
    'renderPlansView',
    'renderQuoteRequestsView',
    'renderTeamView',
    'renderTemplatesView',
  ],
  '🔴 ha cambiado el conjunto de vistas que necesitan datos para montarse. Si hay una NUEVA, '
  + 'alguien ha roto una pantalla que se montaba sola. Si falta una, se ha arreglado y hay que '
  + `quitarla de aquí diciéndolo. Lo que hay ahora: ${nombres.join(', ')}.`);

  // 🔴 Y EL SUELO DE ESTE SUELO: si la lista se quedara VACÍA sin que nadie lo haya hecho, es
  // que el censo dejó de mirar. Un cero aquí es una noticia que hay que escribir, no un verde.
  assert.ok(nombres.length > 0,
    '🔴 CERO vistas necesitan datos. O alguien las ha arreglado todas —y entonces este test '
    + 'sobra y se retira A MANO— o el censo ha dejado de montar nada.');
});

// ═══ ③ EL RECHAZO HUÉRFANO: LO CARO ══════════════════════════════════════════════════════

test('SCRUM-698 · 🔴 un rechazo huérfano NO mata el proceso: se recoge y NOMBRA la vista', async () => {
  const r = await pintarVista(cargarDashboard(RAIZ), 'renderReportsView');
  assert.equal(r.error, null, `🔴 la vista de informes ha dejado de montarse: ${r.error}`);

  // El contenido de `rechazos` no se fija —eso caduca—, pero SÍ que exista el canal y que,
  // cuando haya algo, diga de qué vista salió. «El proceso se cayó» no dice quién fue.
  assert.ok(Array.isArray(r.rechazos),
    '🔴 `pintarVista` ya no devuelve `rechazos`: sin ese canal, una promesa suelta que rechace '
    + 'vuelve a tumbar el proceso entero y a llevarse los tests del fichero sin un `fail`.');
  for (const m of r.rechazos) {
    assert.match(m, /^renderReportsView: /,
      `🔴 el rechazo «${m}» no dice de qué vista salió, que es justo lo que el proceso muriéndose `
      + 'no decía.');
  }
});

test('SCRUM-698 · 🔴 EL MECANISMO: una vista con una promesa suelta se recoge, no revienta', async () => {
  // Se inyecta el defecto EN EL BANCO, no en el producto: una vista que dispara algo que
  // rechaza y no lo espera — exactamente lo que hace `reportsView`. Si `pintarVista` no
  // recogiera el rechazo, esto no fallaría: mataría el proceso y se llevaría el fichero entero.
  const banco = cargarDashboard(RAIZ);
  banco.ctx.renderVistaDePrueba = (c) => {
    Promise.reject(new Error('la carga que nadie espera'));
    c.appendChild(banco.mk('span'));
  };
  const r = await pintarVista(banco, 'renderVistaDePrueba');

  assert.equal(r.error, null, '🔴 la vista no se ha montado.');
  assert.equal(todos(r.contenedor).length, 2,
    '🔴 la vista no llegó a pintar: el rechazo la ha interrumpido en vez de quedar recogido.');
  assert.deepEqual(r.rechazos, ['renderVistaDePrueba: la carga que nadie espera'],
    `🔴 el rechazo huérfano no se ha recogido con su vista delante. Salió: ${JSON.stringify(r.rechazos)}.`);
});

test('SCRUM-698 · 🔴 y los oyentes de rechazo SE DEVUELVEN al terminar', async () => {
  // Si no se devolvieran, a partir de la primera vista montada un fallo async de CUALQUIER otro
  // test dejaría de verse. El arreglo sería peor que el defecto, y en silencio.
  //
  // ⚠️ ESTE TEST HUBO QUE ARREGLARLO, y lo cazó su propia prueba de rojo. La primera versión
  // comparaba `process.listeners(…).length` antes y después: una diferencia RELATIVA que no cae
  // si el daño ya se hizo en una llamada anterior —y para cuando llega este test ya se han
  // montado vistas de sobra—. Antes y después valían cero, así que pasaba siempre. Ahora se
  // pone un oyente PROPIO y se exige que SIGA AHÍ: eso es absoluto y no depende de quién haya
  // corrido antes.
  const mio = () => {};
  process.on('unhandledRejection', mio);
  try {
    await pintarVista(cargarDashboard(RAIZ), 'renderReportsView');
    assert.ok(process.listeners('unhandledRejection').includes(mio),
      '🔴 `pintarVista` se ha quedado con los oyentes de rechazo que apartó. A partir de aquí, un '
      + 'fallo async de otro test pasaría desapercibido — y eso es peor que el defecto que este '
      + 'ticket vino a arreglar, porque falla en silencio.');
  } finally {
    process.off('unhandledRejection', mio);
  }
});

// ═══ ④ `insertAdjacentHTML`, LA API QUE FALTABA ══════════════════════════════════════════

test('SCRUM-698 · 🔴 `insertAdjacentHTML` coloca en las CUATRO posiciones', () => {
  const b = cargarDashboard(RAIZ);
  const padre = b.mk('div');
  const n = b.mk('p');
  padre.appendChild(n);

  n.insertAdjacentHTML('afterbegin', '<b>uno</b>');
  assert.deepEqual(n.hijos.map((h) => h.tagName), ['B'], '🔴 `afterbegin` no ha metido nada dentro.');
  n.insertAdjacentHTML('beforeend', '<i>dos</i>');
  assert.deepEqual(n.hijos.map((h) => h.tagName), ['B', 'I'], '🔴 `beforeend` no va al final.');

  n.insertAdjacentHTML('beforebegin', '<em>antes</em>');
  n.insertAdjacentHTML('afterend', '<u>despues</u>');
  assert.deepEqual(padre.hijos.map((h) => h.tagName), ['EM', 'P', 'U'],
    '🔴 `beforebegin`/`afterend` no colocan al hermano en su sitio.');
  assert.equal(padre.hijos[0]._padre, padre, '🔴 el hermano insertado no sabe quién es su padre.');
});

test('SCRUM-698 · CONTROL NEGATIVO: sin padre no se inventa un sitio, y una posición mala LANZA', () => {
  const b = cargarDashboard(RAIZ);
  const suelto = b.mk('div');
  suelto.insertAdjacentHTML('beforebegin', '<b>x</b>');
  assert.deepEqual(suelto.hijos, [],
    '🔴 sin padre, `beforebegin` ha metido el marcado DENTRO. El navegador no hace nada; '
    + 'inventarle un sitio pondría el nodo donde el producto no lo pidió.');

  assert.throws(() => suelto.insertAdjacentHTML('encima-del-todo', '<b>x</b>'), /no válida/,
    '🔴 una posición inexistente se ha tratado como buena: el marcado acabaría en un sitio '
    + 'cualquiera y la vista mediría otra cosa.');
});

test('SCRUM-698 · 🔴 y `settings` se monta POR ESO, no por casualidad', async () => {
  // El caso real que lo destapó: la vista pone la nota del IBAN con `insertAdjacentHTML`.
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: datosDeMuestra }), 'renderSettingsView');
  assert.equal(r.error, null, `🔴 ajustes vuelve a no montarse: ${r.error}`);
  assert.ok(todos(r.contenedor).length > 100,
    `🔴 ajustes monta sólo ${todos(r.contenedor).length} nodos: se está quedando a medias.`);
});

// ═══ ⑤ CONTROL POSITIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-698 · CONTROL POSITIVO: las vistas que ya se montaban dan los MISMOS nodos', async () => {
  // Lo que NO debe cambiar. Números medidos sobre `origin/main` ANTES de tocar el banco: si el
  // cambio moviera el montaje de una pantalla que no venía a arreglar, se vería aquí.
  //
  // 🔴 CONFLICTO RESUELTO SUMANDO, no eligiendo (3-sep-2026): DOS tickets subieron números
  // DISTINTOS de este mismo array. Quedarse con un lado habría borrado en silencio la línea
  // base del otro, y un control positivo con una línea base borrada deja de controlar. Los dos
  // comentarios se conservan porque documentan dos números distintos.
  //
  // 🔴 SCRUM-591 (3-sep-2026) · `renderQuotesView` 236 → 237, y el motivo importa porque este
  // control existe para que un arreglo DEL BANCO no mueva pantallas ajenas: la subida NO es del
  // banco, es del PRODUCTO — el selector de cliente pasa a ofrecer «+ Nuevo cliente» sin salir
  // del documento, y eso es UNA `<option>` más. AISLADO, no supuesto: quitando ese `appendChild`
  // con el resto del ticket puesto, este control vuelve a 236 y pasa. Las otras tres, intactas.
  //
  // 🔴 SCRUM-599 · CLIENTES SUBE DE 62 A 63, Y ES DELIBERADO. El guard hizo su trabajo: cazó un
  // nodo nuevo y obligó a decir cuál. Identificado POR IDENTIDAD antes de tocar el número —no por
  // posición ni por texto—: es el ÚNICO `<kbd>` de la vista, con la tecla «N», dentro del botón
  // que registra el destino del atajo (`atajoNuevo.accionDe('customers')`).
  //
  // ⚠️ Y un matiz que la medición corrigió: **el botón NO es nuevo**. Ya estaba en `main` como
  // «+ Nuevo cliente»; lo que entra es la TECLA que se pinta dentro. Por eso sube UNO y no dos.
  //
  // La exigencia no baja: sigue siendo una igualdad exacta, sin rango ni tolerancia. Lo que sube
  // es la línea base, con su motivo escrito aquí para que el siguiente sepa de dónde salió.
  // 🔴 SCRUM-591 + SCRUM-594 · DOS SUBIDAS QUE SE ACUMULAN, Y EL MERGE NO PODÍA SUMARLAS.
  //
  // Main lo dejó en 237 (SCRUM-591: la opción «+ Nuevo cliente» del selector) y esta rama en 241
  // (SCRUM-594: el bloque del descuento global). Las dos son del PRODUCTO y ninguna anula a la
  // otra, así que quedarse con cualquiera de los dos números perdería el cambio del otro **en
  // silencio y en verde** — que es exactamente el conflicto que este árbol lleva días cazando.
  // El número de abajo está MEDIDO sobre el árbol ya mezclado, no sumado a ojo.
  //
  // Los cinco de SCRUM-594, identificados POR IDENTIDAD antes de tocar nada: `.quote-dto-global`,
  // su botón «+ Añadir descuento», la etiqueta `.quote-dto-global__campo`, su rótulo y su input.
  // Y lo que NO sube: `.quote-line__dto` da 0 aquí, porque el campo de la línea vive en la hoja
  // de ajustes de cada fila y esta pantalla no monta el editor de líneas.
  //
    // 🔴 SCRUM-582 (CONT-09) · `renderCustomersView` 63 → 68. CINCO nodos, y aquí están CUÁLES,
    // identificados POR IDENTIDAD antes de tocar el número —no por posición ni por su texto—:
    //
    //   1. el `<th data-columna="seleccion">`, que sale de `FC.COLUMNAS` como los otros ocho
    //   2. su casilla de cabecera — `aria-label="Seleccionar todos"`, padre `<th>`
    //   3. el `<div>` de la barra de selección
    //   4. la casilla ESPEJO de la barra — mismo `aria-label`, padre `<div>`
    //   5. el `<span>` del contador
    //
    // La barra existe porque esta tabla es `table--stack-mobile` y a ≤640px su CSS hace
    // `thead{display:none}`: sin ella, en el móvil no habría forma de «seleccionar todos».
    //
    // Las casillas POR FILA no entran en este número: el banco monta la vista sin datos, así que
    // no hay filas. Es otra medición y no se mezcla con ésta.
    //
    // 🔴 4-sep-2026 · `renderQuotesView` 242 → 253, y son DOS tickets a la vez. Las dos subidas
    // son del PRODUCTO, no del banco, y SE SUMAN:
    //   · SCRUM-602 · +8 · el control de la dirección de la obra (los dos subárboles del
    //     `.field`), aislados por identidad.
    //   · SCRUM-587 · +3 · la tira que PROPONE el descuento pactado — el `div.alert`, su `<span>`
    //     y el botón—, que nace `hidden` y sólo se enseña si ese cliente trae descuento y queda
    //     alguna línea sin él.
    // MEDIDO sobre el árbol mezclado y comprobado por mitades: sin la tira da 250, sin los dos
    // `.field` da 245. Las otras tres vistas, intactas.
  for (const [vista, nodos] of [['renderQuotesView', 253], ['renderProductsView', 166],
    ['renderCustomersView', 68], ['renderHomeView', 109]]) {
    const r = await pintarVista(cargarDashboard(RAIZ), vista);
    assert.equal(r.error, null, `🔴 ${vista} ha dejado de montarse: ${r.error}`);
    assert.equal(todos(r.contenedor).length, nodos,
      `🔴 ${vista} monta ${todos(r.contenedor).length} nodos y antes montaba ${nodos}. Este `
      + 'ticket no debía mover ni uno.');
  }
});

test('SCRUM-698 · CONTROL NEGATIVO: el fixture NO se impone a quien ya pasaba los suyos', async () => {
  // `datosDeMuestra` se OFRECE, no es el defecto de `cargarDashboard`. Si lo fuera, cambiaría lo
  // que reciben todas las vistas que hoy se montan y movería mediciones ajenas sin pedirlo.
  const conLoSuyo = await pintarVista(
    cargarDashboard(RAIZ, { datos: () => ({ items: [], quotes: [] }) }), 'renderQuotesView');
  assert.equal(conLoSuyo.error, null, '🔴 pasar datos propios ha dejado de funcionar.');

  const desnuda = await pintarVista(cargarDashboard(RAIZ), 'renderQuotesView');
  // SCRUM-591 + SCRUM-594 + SCRUM-602 + SCRUM-587 · las CUATRO subidas, acumuladas y MEDIDAS
  // sobre el árbol mezclado (ver arriba). Lo que este control vigila —que el fixture no se
  // imponga— sigue intacto: lo que importa es que los dos montajes den el mismo número, sea cual sea.
  assert.equal(todos(desnuda.contenedor).length, 253,
    '🔴 montar sin `datos` ya no da lo de siempre: el fixture se ha colado como valor por '
    + 'defecto y está moviendo lo que miden otros.');
});
