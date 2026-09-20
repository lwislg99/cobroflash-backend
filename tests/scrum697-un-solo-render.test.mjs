// tests/scrum697-un-solo-render.test.mjs — SCRUM-697
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// MONTAR UNA VISTA TIENE QUE PRODUCIR **UN** RENDER. Y el defecto no era ése.
//
// El hallazgo decía «la vista de clientes se pinta dos veces: 16 `<th>` para 8 columnas». Se
// midió y NO se pinta dos veces:
//
//   · la vista se llama **una** sola vez (instrumentada: `llamadas = 1`),
//   · crea **una** tabla,
//   · y `tablas[0] === tablas[1]` da **`true`** — los dos `<table>` que salían del recorrido
//     eran **EL MISMO NODO**, contado dos veces.
//
// LA CAUSA, y es del BANCO: en el navegador `appendChild` **MUEVE** el nodo — lo desengancha de
// donde estuviera. Aquí sólo hacía `hijos.push(...)`, así que el nodo se quedaba en las dos
// listas a la vez y `todos()` pasaba dos veces por él. `customersView` hace DOM de manual
// perfectamente legítimo: mete la tabla en el `table-scroll` (l. 183) y luego la mueve al
// `data-card` (l. 207). En el navegador acaba en un sitio; en el banco estaba en los dos.
//
// 🔴 POR QUÉ IMPORTA, Y NO ES COSMÉTICA: esto no produce rojos falsos, produce **MEDICIONES**
// falsas, que es de donde salen los verdes falsos. Tres sesiones han contado hoy sobre esa
// vista. Y el modo de fallo más probable es el peor: alguien ve un test pedir 8, lo ve caer con
// 16, y lo «arregla» poniendo 16 — fosilizando el defecto DENTRO de la aserción, donde ya no
// parece un defecto sino una constante.
//
// SE ARREGLA EN EL BANCO, no rodeándolo desde la vista ni desde el test. Es lo que este mismo
// fichero lleva escrito desde SCRUM-444: «un banco infiel hace que el test mida el banco y no
// el producto».
//
// ⚠️ LA TRAMPA DEL ARREGLO, y por eso hay un test para ella: desenganchar NO puede pasar por
// `removeChild`, porque `removeChild` DESREGISTRA el id (SCRUM-444, a propósito). Mover un nodo
// no lo saca del documento: si el desenganche borrase el id, `getElementById` dejaría de
// encontrar todo lo que una vista mueva, que es un defecto peor que el que se venía a quitar.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las vistas que fallan al montarse por huecos del banco AJENOS a este ticket (datos que la
// vista da por hechos y el banco no sirve). No se tocan aquí: se cuentan aparte y se declaran,
// que es distinto de esconderlas.
function vistasDelBanco(banco) {
  return Object.keys(banco.ctx)
    .filter((k) => /^render[A-Z].*View$/.test(k) && typeof banco.ctx[k] === 'function')
    .sort();
}

/** Los nodos que el recorrido visita MÁS DE UNA VEZ, por identidad. */
function repetidos(contenedor) {
  const lista = todos(contenedor);
  const vistos = new Set();
  const dobles = [];
  for (const n of lista) {
    if (vistos.has(n)) dobles.push(n);
    vistos.add(n);
  }
  return { total: lista.length, distintos: vistos.size, dobles };
}

// ═══ ① EL CONTROL POSITIVO, PRIMERO ══════════════════════════════════════════════════════

test('SCRUM-697 · CONTROL POSITIVO: la vista de clientes SE MONTA y su tabla está ahí', async () => {
  // 🔴 Va primero a propósito. Si tras el arreglo el recuento de tablas baja a 0, no se ha
  // quitado un duplicado: se ha roto el montaje. Y «no hay duplicados» sería verdad en un
  // contenedor vacío, así que sin este test el de abajo no probaría nada.
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la vista de clientes ni siquiera se monta: ${r.error}`);

  const nodos = todos(r.contenedor);
  assert.ok(nodos.length > 20,
    `🔴 SUELO: la vista sólo produce ${nodos.length} nodos. Con tan poco, cualquier recuento de `
    + 'duplicados daría cero por no haber nada que contar.');

  const tablas = nodos.filter((n) => n.tagName === 'TABLE');
  assert.ok(tablas.length >= 1,
    '🔴 la tabla de clientes NO está. Si esto cae después de tocar el banco, el arreglo no ha '
    + 'quitado un nodo repetido: ha quitado la tabla.');
  assert.ok(nodos.some((n) => n.tagName === 'TH' && n.textContent === 'Teléfono'),
    '🔴 la cabecera de la tabla no está montada, así que no hay nada que contar.');
});

// ═══ ② EL DEFECTO ════════════════════════════════════════════════════════════════════════

test('SCRUM-697 · 🔴 montar la vista de clientes recorre CADA NODO UNA VEZ', async () => {
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la vista no se monta: ${r.error}`);

  const { total, distintos, dobles } = repetidos(r.contenedor);
  const porEtiqueta = {};
  for (const n of dobles) porEtiqueta[n.tagName] = (porEtiqueta[n.tagName] || 0) + 1;

  assert.deepEqual(dobles.length === 0 ? {} : porEtiqueta, {},
    `🔴 renderCustomersView: el recorrido pasa ${total} veces por ${distintos} nodos — `
    + `${dobles.length} de más: ${JSON.stringify(porEtiqueta)}. NO es que la vista pinte dos `
    + 'veces (se llama una y crea una tabla): es que un mismo nodo está colgando de DOS padres, '
    + 'porque `appendChild` no lo desengancha del anterior como hace el navegador. Cualquier '
    + 'recuento sobre esta vista sale al doble. NO se arregla ajustando el número esperado del '
    + 'test que caiga: eso fosiliza el defecto dentro de la aserción.');
});

test('SCRUM-697 · 🔴 y contar un elemento ÚNICO da 1, no 2', async () => {
  // La forma en que esto se manifiesta y por la que se abrió el ticket: 16 `<th>` para 8
  // columnas. Se fija sobre un elemento del que sólo puede haber uno.
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderCustomersView');
  const tablas = todos(r.contenedor).filter((n) => n.tagName === 'TABLE');
  assert.equal(tablas.length, 1,
    `🔴 la vista de clientes enseña ${tablas.length} \`<table>\` al recorrerla, y sólo crea UNA. `
    + (tablas.length === 2 && tablas[0] === tablas[1]
      ? 'Y son EL MISMO OBJETO: no hay dos tablas, hay una contada dos veces.'
      : ''));

  const cabeceras = todos(r.contenedor).filter((n) => n.tagName === 'TH');
  assert.equal(cabeceras.length, new Set(cabeceras).size,
    `🔴 hay ${cabeceras.length} \`<th>\` recorridos pero sólo `
    + `${new Set(cabeceras).size} distintos: es de aquí de donde salía el «16 para 8 columnas».`);
});

// ═══ ③ EL CENSO: ¿le pasa a UNA o a TODAS? ═══════════════════════════════════════════════

test('SCRUM-697 · 🔴 NINGUNA vista del panel recorre un nodo dos veces (censo, sin lista a mano)', async () => {
  // Ninguna lista a mano: las vistas se derivan de lo que el banco publica. Una lista envejece
  // el día que entra una vista nueva y nadie se entera de que no está vigilada.
  const banco0 = cargarDashboard(RAIZ);
  const vistas = vistasDelBanco(banco0);
  assert.ok(vistas.length >= 20,
    `🔴 SUELO: el censo sólo ve ${vistas.length} vistas. Si no las ve, su cero no vale nada: `
    + '«no hay defecto» y «no supe mirar» son el mismo número.');

  // ⚠️ Hay vistas que fallan DENTRO de un `async` que nadie espera —`reportsView` lo hace: pide
  // datos que el banco no sirve—, y ese rechazo tumba el proceso entero, así que una sola vista
  // sin alimentar impediría censar las otras veintitrés. Es PREEXISTENTE: el mismo `TypeError`
  // mató la primera medición de este ticket, antes de tocar una línea del banco.
  //
  // Y es HUÉRFANO: la vista dispara su carga sin esperarla, así que la promesa que rechaza no
  // pasa por `pintarVista` ni por ninguna envoltura que se le pueda poner a la vista. La única
  // forma de que una vista sin alimentar no impida censar las otras veintitrés es apartar los
  // oyentes de rechazo MIENTRAS dura el censo y devolverlos después.
  //
  // 🔴 Y esto NO es «tragarse los errores»: se APUNTAN, se DECLARAN abajo con un tope, y la
  // restauración va en `finally`, así que ni un fallo del propio censo se lleva por delante al
  // resto del fichero. Lo que se aparta es el veredicto automático del runner, no la medición.
  const rechazos = [];
  const oyentes = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  const anota = (e) => rechazos.push(String((e && e.message) || e).slice(0, 60));
  process.on('unhandledRejection', anota);

  const sucias = [];
  const rotas = [];
  try {
    for (const v of vistas) {
      const b = cargarDashboard(RAIZ);
      const r = await pintarVista(b, v);
      if (r.error) { rotas.push(v); continue; }
      const { total, distintos, dobles } = repetidos(r.contenedor);
      if (dobles.length) sucias.push(`${v} (${total} recorridos / ${distintos} distintos)`);
    }
  } finally {
    process.off('unhandledRejection', anota);
    for (const o of oyentes) process.on('unhandledRejection', o);
  }

  assert.equal(process.listeners('unhandledRejection').length, oyentes.length,
    '🔴 el censo no ha devuelto los oyentes de rechazo que apartó: a partir de aquí, un fallo '
    + 'async de cualquier otro test pasaría desapercibido.');

  // 🔴 Y LAS QUE NO SE MONTAN SE DECLARAN. Si mañana la mitad del panel dejara de montarse, el
  // censo daría cero «sucias» y parecería una buena noticia.
  assert.ok(rotas.length <= 6,
    `🔴 hay ${rotas.length} vistas que no se montan (${rotas.join(', ')}) y antes eran 6. El `
    + 'censo mide MENOS panel que ayer, así que su cero vale menos.');
  assert.ok(vistas.length - rotas.length >= 15,
    `🔴 SUELO: sólo ${vistas.length - rotas.length} vistas llegan a montarse; el censo no puede `
    + 'afirmar nada del panel con eso.');

  assert.deepEqual(sucias, [],
    `🔴 estas vistas recorren nodos repetidos: ${sucias.join(' · ')}. Si es UNA, es un caso; si `
    + 'son varias, el defecto es del banco y se arregla en el banco.');

  // 🔴 Y los rechazos se DECLARAN, no se tragan: son vistas que el banco no puede alimentar, y
  // el día que sean muchas más el censo estará midiendo un panel que ya no se monta.
  assert.ok(rechazos.length <= 3,
    `🔴 el censo ha provocado ${rechazos.length} rechazos sin capturar (${rechazos.join(' · ')}) `
    + 'y se conocían como mucho 3. No se silencian: si crecen, es que hay más panel roto.');
});

// ═══ ④ EL MECANISMO, SUJETO ══════════════════════════════════════════════════════════════

test('SCRUM-697 · 🔴 `appendChild` MUEVE: un nodo insertado en B deja de estar en A', () => {
  const banco = cargarDashboard(RAIZ);
  const a = banco.mk('div');
  const b = banco.mk('div');
  const hijo = banco.mk('span');

  a.appendChild(hijo);
  assert.deepEqual(a.hijos, [hijo], '🔴 SUELO: `appendChild` ni siquiera mete el nodo.');

  b.appendChild(hijo);
  assert.deepEqual(b.hijos, [hijo], '🔴 el nodo no ha llegado a su nuevo padre.');
  assert.deepEqual(a.hijos, [],
    '🔴 el nodo SIGUE colgando del padre viejo. En el navegador `appendChild` lo desengancha; '
    + 'aquí se queda en las dos listas y todo recorrido lo cuenta dos veces.');
  assert.equal(hijo.parentNode, b, '🔴 `parentNode` no señala al padre nuevo.');
});

test('SCRUM-697 · 🔴 `insertBefore`, `append` y `prepend` mueven IGUAL', () => {
  // Las cuatro formas de insertar comparten el defecto y por eso comparten el arreglo. Si sólo
  // se corrigiera `appendChild`, la próxima vista que use `prepend` traería el mismo síntoma
  // con otra cara, y costaría otro ticket entenderlo.
  const banco = cargarDashboard(RAIZ);
  for (const via of ['insertBefore', 'append', 'prepend']) {
    const a = banco.mk('div');
    const b = banco.mk('div');
    const hijo = banco.mk('span');
    a.appendChild(hijo);
    b[via](hijo);
    assert.deepEqual(a.hijos, [],
      `🔴 con \`${via}\` el nodo se queda también en el padre viejo.`);
    assert.deepEqual(b.hijos, [hijo], `🔴 con \`${via}\` el nodo no llega al padre nuevo.`);
  }
});

test('SCRUM-697 · 🔴 mover un nodo NO le borra el `id` (la trampa del arreglo)', () => {
  // `removeChild` desregistra el id A PROPÓSITO (SCRUM-444): en el navegador `getElementById`
  // no encuentra lo que ya no está en el documento. Pero MOVER no es quitar. Si el desenganche
  // se hiciera llamando a `removeChild`, toda vista que mueva un nodo con id lo perdería —
  // y eso es peor que el defecto que se venía a arreglar, porque falla en silencio.
  const banco = cargarDashboard(RAIZ);
  const a = banco.mk('div');
  const b = banco.mk('div');
  const hijo = banco.mk('div');
  hijo.id = 'lo-que-se-mueve';
  a.appendChild(hijo);
  assert.equal(banco.ctx.document.getElementById('lo-que-se-mueve'), hijo,
    '🔴 SUELO: el id no se encuentra ni antes de mover, así que la prueba no probaría nada.');

  b.appendChild(hijo);
  assert.equal(banco.ctx.document.getElementById('lo-que-se-mueve'), hijo,
    '🔴 al mover el nodo se ha perdido su `id`. Mover no es quitar: el nodo sigue en el '
    + 'documento y el navegador lo sigue encontrando.');

  // Y el contrapunto: quitarlo DE VERDAD sí lo desregistra, que es lo que SCRUM-444 decidió.
  b.removeChild(hijo);
  assert.equal(banco.ctx.document.getElementById('lo-que-se-mueve'), null,
    '🔴 `removeChild` ha dejado de desregistrar el id: eso es lo que SCRUM-444 arregló y no '
    + 'puede perderse por el camino.');
});

// ═══ ⑤ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-697 · CONTROL NEGATIVO: otra vista se sigue montando igual que antes', async () => {
  // Lo que NO debe hacerlo caer: una vista que nunca movió un nodo. Si el arreglo tocara el
  // montaje en general, aquí se vería — y con números medidos ANTES de tocar el banco.
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderQuotesView');
  assert.equal(r.error, null, `🔴 la vista de presupuestos ha dejado de montarse: ${r.error}`);

  const nodos = todos(r.contenedor);
  assert.equal(nodos.length, new Set(nodos).size,
    '🔴 la vista de presupuestos, que no repetía ningún nodo, ha empezado a repetirlos.');
  // 🔴 SCRUM-591 (3-sep-2026) · 236 → 237, y el motivo importa porque este control existe para
  // que un arreglo DEL BANCO no cambie el montaje: la subida NO es del banco, es del PRODUCTO —
  // el selector de cliente pasa a ofrecer el alta sin salir del documento, y eso es UNA `<option>`
  // más. Comprobado aislándolo, no supuesto: quitando ese `appendChild` el control vuelve a 236
  // con el resto del ticket puesto (el `reset()` que SCRUM-591 añadió al banco no crea nodos).
  //
  // 🔴 SCRUM-594 (4-sep-2026) · 237 → 242, y TAMPOCO es del banco: son los cinco nodos del bloque
  // del descuento global (`.quote-dto-global` y sus cuatro hijos), identificados por identidad en
  // `scrum698`. Las dos subidas SE ACUMULAN: el merge no podía sumarlas, y quedarse con 241 o con
  // 237 habría perdido el cambio del otro ticket en silencio y en verde. El número está MEDIDO
  // sobre el árbol ya mezclado, no sumado a ojo.
  //
  // 🔴 4-sep-2026 · 242 → 253, y son DOS tickets a la vez. Ninguna de las dos subidas es del
  // banco: las dos son del PRODUCTO, y SE SUMAN. Quedarse con 245 o con 250 habría perdido el
  // cambio del otro en silencio y en verde — que es justo lo que SCRUM-594 ya dejó escrito aquí.
  //
  //   · SCRUM-602 · +8 · el control de la dirección de la obra: los dos `<div class="field">`, el
  //     `<label>`, el `<select name="shipping_address_mode">`, sus tres `<option>` y el `<input>`
  //     del campo libre. Aislados POR IDENTIDAD (los dos subárboles del `.field`).
  //   · SCRUM-587 · +3 · la tira que PROPONE el descuento pactado con el cliente: el `div.alert`,
  //     su `<span>` de texto y el botón de aceptar. Nace oculta.
  //   · SCRUM-586 · +3 · la tira que PROPONE las FORMAS DE PAGO pactadas: misma forma exacta —
  //     `div.alert`, su `<span>` y el botón—, porque deriva de la anterior. Nace oculta también.
  //     Identificados POR IDENTIDAD sobre el árbol montado (6-sep-2026), no restando 256 − 253.
  //
  // 🔴 EL 253 ESTÁ MEDIDO SOBRE EL ÁRBOL YA MEZCLADO, NO SUMADO A OJO, y las dos mitades se
  // comprobaron por separado sobre ese mismo árbol: quitando sólo el `appendChild` de la tira da
  // 250, y quitando sólo los dos `.field` de la dirección da 245.
  // 🔴 SCRUM-589 (CONT-18) · 6-sep-2026 · 256 → 263. SIETE nodos, identificados POR IDENTIDAD
  // sobre el árbol montado y NO restando 263 − 256: el div.inline-options de la elección de
  // nombre, sus dos label.radio-label, sus dos input[type=radio][name=df-nombre] y los dos
  // #TEXT de los rótulos firmados. AISLADO: los siete son exactamente el subárbol de ese div
  // (todos(div) = 7), así que el delta entero vive dentro del control nuevo.
  // 🔴 SCRUM-794 · 6-sep-2026 · 263 → 262. LA PRIMERA BAJADA de este número, y es un BORRADO
  // firmado: había DOS «+ Añadir línea» idénticos en la sección «2. Líneas» y el fundador mandó
  // quedarse con el de abajo. El nodo que se va es UNO y está identificado POR IDENTIDAD sobre el
  // árbol de antes (no restando 263 − 262): el `button.btn.btn-secondary` de la cabecera, cuyo
  // subárbol medido es de 1 nodo —`textContent` en el banco es una propiedad, no un hijo—.
  // Medido también el que SE QUEDA (`button.btn-ghost.quote-add-line`): subárbol de 1 nodo, y
  // sigue ahí. O sea que el delta entero es el botón borrado y esta pantalla no ha movido nada más.
  // 🔴 SCRUM-713 · 8-sep-2026 · 262 → 264. Y SÍ se ha tocado el banco en esa rama —entra
  // `buscadorDeClientes.js` en `SCRIPTS_DEL_DASHBOARD`—, así que la advertencia de abajo aplica de
  // lleno y por eso el delta se aisló ANTES de mover el número: los DOS nodos son del PRODUCTO.
  //
  // IDENTIFICADOS POR IDENTIDAD sobre el árbol montado, no restando 264 − 262:
  //
  //   1. `input[type=search]` del bloque «1. Cliente», el buscador. Subárbol medido: 1 nodo.
  //   2. la `<option disabled>` del selector de cliente. Subárbol medido: 1 nodo. Aparece porque
  //      este banco monta SIN clientes, y con la lista vacía el desplegable ahora DICE que no hay
  //      ninguno en vez de quedarse mudo. Con clientes en la lista, esta segunda no se pinta.
  //
  // AISLADO: quitando esos dos subárboles el árbol vuelve a 262 exactos, así que el delta entero
  // vive en el control nuevo y esta pantalla no ha movido nada más. El script añadido al banco no
  // aporta ningún nodo: sólo publica `window.buscadorDeClientes`.
  // 🔴 SCRUM-669 · 15-sep-2026 · 264 → 261. LA SEGUNDA BAJADA, y es una RETIRADA medida: el
  // aviso «Final: …» (`priceHint`) quedaba SIEMPRE vacío desde que DOC-08 sacó el margen de la
  // línea, así que se retiró con su clase. El banco NO se ha tocado en esta rama.
  //
  // IDENTIFICADOS POR IDENTIDAD sobre el árbol montado, no restando 264 − 261: montando la vista
  // con `priceHint` de vuelta salen 264 y **3 × `span.price-final-hint`**; sin él, 261 y cero.
  // La diferencia (3) es exactamente el recuento de esa clase, ni un nodo más — uno por cada
  // línea inicial del presupuesto. Si mañana bajara 4, no sería esto.
  // 🔴 SCRUM-897 · 17-sep-2026 · 261 → 237. LA PRIMERA VEZ QUE ESTA CIFRA LA MUEVE EL BANCO, y a
  // propósito: `innerHTML = …` APILABA la pintada nueva sobre la vieja. El número se RECALCULÓ
  // con este mismo contador sobre el árbol arreglado, no restando. Los 24, POR IDENTIDAD sobre el
  // árbol de main: las 3 pintadas anteriores de `.quote-totals` (DIV 6 · SPAN 6 · STRONG 6) y de
  // `.quote-total-kpi` (SPAN 3 · STRONG 3), idénticas a la última. Y una segunda sonda sin
  // mini-DOM, Edge pintando la vista con los mismos scripts y datos: 227 elementos, que son estos
  // 237 menos los 10 `#text` del banco, y la diferencia por etiqueta era exactamente esa.
  // 🔴 SCRUM-915d · 18-sep-2026 · 237 → 282, y NO es del banco: la rama no toca
  // `tests/_banco-vistas.mjs` (comprobado con `git diff origin/main...HEAD --stat`). Son los 45
  // nodos del andamio de los pasos del editor, IDENTIFICADOS POR IDENTIDAD en el bloque SCRUM-915d
  // de `scrum698-vistas-que-no-se-miden.test.mjs` (Cliente 6 · Conceptos 3 · pie de totales 4 ·
  // Condiciones 21 · Ajustes 6 · Revisar 5), que mide este mismo árbol con el mismo `todos` y da
  // 282. Este fichero es la segunda copia de esa cifra y se quedó fuera del subconjunto de la
  // primera pasada: lo cazó la re-pasada tras mergear main, no el diseño.
  // 🔴 SCRUM-915e1 · 20-sep-2026 · 282 → 283, y lo mueve la VISTA, no el banco. EL NODO, POR
  // IDENTIDAD sobre los dos árboles montados con el mismo contador y no restando: `.quote-preview-
  // subtitle` sale **1** en la rama y **0** en `origin/main`, y es un `<P>` con «Se actualiza
  // mientras escribes» —el rótulo firmado (comentario 15868) que promete el repintado que este
  // corte construye—. Subárbol de 1: el `<p>` no lleva hijos. Y el resto del corte NO mueve la
  // cuenta, medido en la misma pasada: `.preview-footer` sigue siendo **1** en los dos (cambia lo
  // que DICE —«válido durante 30 días» → «válido hasta el 20/10/2026»— no cuántos nodos es), y
  // `createElement("linesBody")` → `createElement("tbody")` cambia la ETIQUETA de un nodo que ya
  // existía. Si mañana subiera 2, no es esto.
  // 🔴 SCRUM-915e2 · 20-sep-2026 · 283 → 286, y lo mueve la VISTA. LOS TRES NODOS, POR IDENTIDAD y
  // no restando: se comparan las FIRMAS (etiqueta + clase + texto) de los dos árboles montados con
  // el mismo contador, y lo único que SOBRA en la rama es **3 × `button.quote-ver-documento`** con
  // «Ver documento» — uno en el pie de cada paso que no es el último (Cliente, Conceptos,
  // Condiciones). Y no falta nada en el otro lado: el delta no esconde una resta compensada.
  assert.equal(nodos.length, 286,
    `🔴 la vista de presupuestos produce ${nodos.length} nodos y se esperaban 286 `
    + '(236 sobre `origin/main` = 80db312b, + la opción de alta de SCRUM-591, + el bloque de '
    + 'descuento global de SCRUM-594, + el control de la dirección de la obra de SCRUM-602, '
    + '+ la tira de propuesta de SCRUM-587, + la tira de formas de pago de SCRUM-586, + la elección de nombre de SCRUM-589, − el «+ Añadir línea» duplicado de SCRUM-794, + el buscador de cliente y su aviso de lista vacía de SCRUM-713). Un arreglo del BANCO no debe cambiar ni uno: si '
    + '− los 3 avisos «Final: …» retirados por SCRUM-669, − las 24 pintadas viejas que el banco '
    + 'apilaba hasta SCRUM-897, + los 45 del andamio de los pasos de SCRUM-915d, + el rótulo «Se '
    + 'actualiza mientras escribes» de SCRUM-915e1, + los 3 «Ver documento» de SCRUM-915e2). Si no '
    + 'has tocado el banco y esto se mueve, el arreglo pinta.');

  const tablas = nodos.filter((n) => n.tagName === 'TABLE');
  assert.equal(tablas.length, 1, '🔴 la vista de presupuestos ya no monta su tabla.');
});

test('SCRUM-697 · CONTROL NEGATIVO: mover un nodo NO se lleva a sus hermanos por delante', () => {
  // El arreglo desengancha por IDENTIDAD. Si filtrase por parecido —misma etiqueta, misma
  // clase— al mover un nodo se llevaría a sus hermanos iguales, y una lista de tres filas
  // pasaría a tener una sin que nadie la tocara.
  //
  // ⚠️ ESTE TEST HUBO QUE ARREGLARLO: la primera versión ponía dos hermanos nuevos en un padre
  // y comprobaba que seguían siendo dos. Pasaba SIEMPRE — `desengancha` sólo actúa cuando el
  // nodo YA tiene padre, así que aquella versión no llegaba a ejecutar el filtro y la mutación
  // «compara por parecido» no la tumbaba. Lo cazó la prueba de rojo: era una regla que siempre
  // pasa. Ahora el nodo que se mueve viene CON padre y con un hermano igual al lado.
  const banco = cargarDashboard(RAIZ);
  const viejo = banco.mk('div');
  const nuevo = banco.mk('div');
  const seMueve = banco.mk('span');
  const seQueda = banco.mk('span');
  seMueve.className = 'igual';
  seQueda.className = 'igual';
  viejo.appendChild(seMueve);
  viejo.appendChild(seQueda);
  assert.deepEqual(viejo.hijos, [seMueve, seQueda],
    '🔴 SUELO: los dos hermanos no llegan a estar juntos, así que mover uno no probaría nada.');

  nuevo.appendChild(seMueve);
  assert.deepEqual(nuevo.hijos, [seMueve], '🔴 el nodo movido no ha llegado a su nuevo padre.');
  assert.deepEqual(viejo.hijos, [seQueda],
    '🔴 al mover un nodo ha desaparecido también su HERMANO, que nadie tocó: el desenganche '
    + 'está comparando por parecido y no por identidad.');
  assert.equal(seQueda.parentNode, viejo,
    '🔴 el hermano que se queda ha perdido a su padre.');
});
