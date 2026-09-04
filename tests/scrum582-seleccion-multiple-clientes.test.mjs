// tests/scrum582-seleccion-multiple-clientes.test.mjs — SCRUM-582 (CONT-09)
//
// Sin gate: la pieza es pura y la vista se monta en el banco. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// LA VÍCTIMA: un profesional con 300 clientes actúa de uno en uno. Con 2 clientes nada de esto se
// nota; con 300 es, literalmente, la diferencia entre usar el producto y abandonarlo.
//
// ⛔ Y EL DEFECTO QUE MÁS VIGILA ESTE FICHERO NO ES LA FALTA DE SELECCIÓN: es que alguien añada
// UNA ACCIÓN EN BLOQUE. Qué se ofrece en bloque lo decide el fundador; este ticket entrega el
// ESTADO y nada más. Un menú «Acciones» con acciones que nadie aprobó —o un contenedor vacío, que
// es una promesa rota cada vez que se pulsa— es exactamente lo prohibido.
//
// ⚠️ Y por escrito, aunque hoy no aplique: cualquier acción en bloque que ENVÍE MENSAJES pasa por
// la tabla anti-spam de la regla 28 ANTES de existir. Seleccionar 300 clientes y mandarles algo es
// el peor botón que se puede construir mal.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/customersView.js');

/** La pieza, cargada como la carga el navegador. */
function filtro() {
  const w = {};
  new Function('window', 'module', fs.readFileSync(
    path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'), 'utf8'))(w, {});
  return w.filtroClientes;
}
const FC = filtro();

const CLIENTES = [
  { id: 1, name: 'Comunidad Los Olivos', contactKind: 'EMPRESA', phone: '600111222', tags: ['administrador'] },
  { id: 2, name: 'Ana Ruiz', contactKind: 'PERSONA', phone: '600333444', tags: ['moroso'] },
  { id: 3, name: 'Beta SL', contactKind: 'EMPRESA', phone: '600555666', tags: [] },
];

/** Monta la lista de clientes CON filas. Sin filas, nada de lo de abajo mediría nada. */
async function listaMontada() {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/customers/.test(String(url)) ? CLIENTES : []),
  });
  const r = await pintarVista(banco, 'renderCustomersView');
  return { banco, r };
}

const casillas = (raiz) => todos(raiz).filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox');
/** Las casillas DE FILA: las de cabecera y barra se distinguen por su nombre accesible. */
const casillasDeFila = (raiz) => casillas(raiz)
  .filter((c) => c.getAttribute('aria-label') !== FC.TEXTOS_SELECCION.todos)
  .filter((c) => !(c.dataset && c.dataset.columna)); // las del selector de columnas de SCRUM-584

// ═══ ① LA DECISIÓN, PURA ═════════════════════════════════════════════════════════════════

test('SCRUM-582 · 🔴 SELECCIONAR TODO selecciona LO FILTRADO, no la base entera', () => {
  // Es la evidencia que pide el ticket. Si «todos» significara los 300, el profesional marcaría a
  // ciegas gente que la pantalla no le está enseñando — y el día que haya una acción en bloque,
  // eso es un desastre con su nombre.
  const visibles = FC.filtrarPorPestana(CLIENTES, 'EMPRESA');
  assert.equal(visibles.length, 2, '🔴 SUELO: el filtro de prueba no deja dos, así que no filtra.');
  assert.deepEqual(FC.seleccionarTodos(visibles), ['1', '3'],
    '🔴 «seleccionar todos» no se ha ceñido a lo filtrado.');
  assert.equal(FC.seleccionarTodos(visibles).length !== CLIENTES.length, true,
    '🔴 ha seleccionado la lista entera: el filtro no está limitando nada.');
});

test('SCRUM-582 · 🔴 al cambiar de filtro, la selección se RECORTA a lo visible', () => {
  // La decisión del ticket, y va escrita: guardar lo que ya no se ve deja una selección INVISIBLE
  // —el contador diría «12» con tres filas marcadas— y así es como se borra lo que nadie quería
  // borrar. Se pierde trabajo al cambiar de filtro, y ése es el precio.
  const todosMarcados = FC.seleccionarTodos(CLIENTES);
  assert.equal(todosMarcados.length, 3, '🔴 SUELO: no se han marcado los tres.');
  const soloPersonas = FC.filtrarPorPestana(CLIENTES, 'PERSONA');
  assert.deepEqual(FC.limitarAVisibles(todosMarcados, soloPersonas), ['2'],
    '🔴 la selección sobrevive al cambio de filtro: quedan marcados clientes que ya no se ven.');
  assert.deepEqual(FC.limitarAVisibles(todosMarcados, []), [],
    '🔴 con la lista vacía queda selección: sería un contador sobre filas que no existen.');
});

test('SCRUM-582 · 🔴 LOS TRES ESTADOS de la casilla de cabecera, y el del medio es el que importa', () => {
  assert.equal(FC.estadoDeCabecera([], CLIENTES), FC.CABECERA_NINGUNO);
  assert.equal(FC.estadoDeCabecera(['1'], CLIENTES), FC.CABECERA_PARCIAL,
    '🔴 con algunos marcados NO dice «parcial». Sin el estado intermedio, «algunas» se pinta igual '
    + 'que «ninguna» y la casilla le miente al profesional.');
  assert.equal(FC.estadoDeCabecera(['1', '2', '3'], CLIENTES), FC.CABECERA_TODOS);
  // Sin filas visibles NO hay «todos»: hay «ninguno». Un «todos» sobre cero filas sería una
  // casilla marcada que no representa a nadie.
  assert.equal(FC.estadoDeCabecera([], []), FC.CABECERA_NINGUNO);
  assert.equal(FC.estadoDeCabecera(['9'], []), FC.CABECERA_NINGUNO);
});

test('SCRUM-582 · el id se compara como CADENA: `1` y `"1"` son el mismo cliente', () => {
  // Un `id` numérico del servidor y el `value` de un `<input>`, que siempre es cadena. Sin esto,
  // marcar una fila y volver a pintarla la dejaría desmarcada sin que nada fallara.
  assert.equal(FC.estaMarcado(['1'], 1), true, '🔴 un id numérico no reconoce su marca.');
  assert.deepEqual(FC.alternar([], 1), ['1'], '🔴 al marcar no se guarda como cadena.');
  assert.deepEqual(FC.alternar(['1'], '1'), [], '🔴 no se desmarca.');
});

// ═══ ② LA COLUMNA: CONVIVE CON EL SELECTOR DE COLUMNAS DE SCRUM-584 ══════════════════════

test('SCRUM-582 · 🔴 la columna de selección NO es ocultable, y va la PRIMERA', () => {
  const col = FC.COLUMNAS.filter((c) => c.id === 'seleccion')[0];
  assert.ok(col, '🔴 no existe la columna de selección en la lista que gobierna la tabla.');
  assert.equal(FC.COLUMNAS[0].id, 'seleccion', '🔴 la selección ya no es la primera columna.');
  assert.equal(col.fija, true,
    '🔴 la columna de selección es ELEGIBLE en el selector de columnas. Un profesional podría '
    + 'apagarla sin querer y quedarse sin forma de seleccionar — y sin forma de recuperarla, '
    + 'porque el control que la enciende estaría detrás de la propia columna.');
  assert.equal(FC.columnasElegibles().some((c) => c.id === 'seleccion'), false,
    '🔴 el selector de columnas la está listando.');
  assert.equal(FC.claseDeColumna('seleccion', []), '',
    '🔴 la columna nace con `col-hide-mobile`: la casilla desaparecería en el móvil, que es donde '
    + 'el profesional con 300 clientes trabaja de pie.');
  assert.equal(FC.colSpanDeLaTabla(), FC.COLUMNAS.length,
    '🔴 el `colSpan` del vacío ya no sale de la misma lista: se descuadraría al añadir columnas.');
});

// ═══ ③ LA PANTALLA, MONTADA ══════════════════════════════════════════════════════════════

test('SCRUM-582 · 🔴 SUELO: la lista monta filas Y cada una tiene su casilla', async () => {
  // Si el censo de filas seleccionables diera cero, todo lo de abajo sería cierto sobre un
  // conjunto vacío — un verde peor que un rojo.
  const { r } = await listaMontada();
  assert.equal(r.error, null, `🔴 la lista de clientes no se monta: ${r.error && r.error.message}`);
  const filas = todos(r.contenedor).filter((n) => n.tagName === 'TR');
  assert.ok(filas.length >= 3, `🔴 CIEGO: sólo veo ${filas.length} filas; esperaba al menos tres.`);
  const cajas = casillasDeFila(r.contenedor);
  assert.equal(cajas.length, CLIENTES.length,
    `🔴 hay ${CLIENTES.length} clientes y ${cajas.length} casillas de fila: no se puede seleccionar.`);
});

test('SCRUM-582 · 🔴 cada casilla dice A QUIÉN selecciona (nombre accesible)', async () => {
  const { r } = await listaMontada();
  const nombres = casillasDeFila(r.contenedor).map((c) => c.getAttribute('aria-label'));
  assert.deepEqual(nombres, CLIENTES.map((c) => c.name),
    '🔴 las casillas no llevan el nombre del cliente. Un lector de pantalla diría «casilla» tres '
    + 'veces seguidas, y en una tabla de 300 filas eso es no decir nada.');
});

test('SCRUM-582 · 🔴 EL QUE MÁS RABIA DA: marcar NO abre la ficha del cliente', async () => {
  // La FILA entera navega a la ficha 360. Sin `stopPropagation`, marcar tres clientes te saca de
  // la lista a la primera — y al volver, la selección ya no está.
  const { r } = await listaMontada();
  const caja = casillasDeFila(r.contenedor)[0];
  assert.ok(caja, '🔴 SUELO: no hay casilla que pulsar.');

  let paro = false;
  const ev = { type: 'click', target: caja, preventDefault() {}, stopPropagation() { paro = true; } };
  for (const fn of (caja._oyentes && caja._oyentes.click) || []) fn.call(caja, ev);
  assert.equal(paro, true,
    '🔴 la casilla NO detiene la propagación del click. La fila que la contiene abre la ficha del '
    + 'cliente, así que seleccionar navegaría: marcas tres clientes para una acción en bloque y el '
    + 'producto te echa de la lista.');

  let paroCambio = false;
  const ev2 = { type: 'change', target: caja, preventDefault() {}, stopPropagation() { paroCambio = true; } };
  for (const fn of (caja._oyentes && caja._oyentes.change) || []) fn.call(caja, ev2);
  assert.equal(paroCambio, true, '🔴 el `change` tampoco la detiene.');
});

test('SCRUM-582 · 🔴 la casilla de cabecera EXISTE, y también en la barra (el móvil)', async () => {
  // Medido en el PASO 0: esta tabla es `table--stack-mobile` —NO `table--cards-mobile`— y a ≤640px
  // su CSS hace `thead{display:none}`. Sin la casilla de la barra, en el móvil no habría forma de
  // «seleccionar todos»: sólo de una en una, que es justo lo que este ticket viene a arreglar.
  const { r } = await listaMontada();
  const conNombre = casillas(r.contenedor)
    .filter((c) => c.getAttribute('aria-label') === FC.TEXTOS_SELECCION.todos);
  assert.equal(conNombre.length, 2,
    `🔴 esperaba DOS casillas de «seleccionar todos» —la de la cabecera y la de la barra— y veo ` +
    `${conNombre.length}. Si sólo hay una, comprueba cuál se ha perdido: si es la de la barra, el `
    + 'móvil se queda sin seleccionar todo.');
  const padres = conNombre.map((c) => String(c._padre && c._padre.tagName).toUpperCase()).sort();
  assert.deepEqual(padres, ['DIV', 'TH'],
    `🔴 las dos casillas no están donde deben (vi: ${padres.join(', ')}).`);
});

test('SCRUM-582 · ⛔ NO HAY NI UNA ACCIÓN EN BLOQUE, y esto es el ticket', async () => {
  // La forma barata de «rematar» esto era un menú de acciones. El ticket lo prohíbe con esas
  // palabras: qué se ofrece en bloque lo decide el fundador. Este test cae el día que alguien
  // añada un botón a la barra «para probar».
  const { r } = await listaMontada();
  const barras = todos(r.contenedor).filter((n) => n.tagName === 'DIV'
    && todos(n).some((h) => h.tagName === 'INPUT'
      && h.getAttribute('aria-label') === FC.TEXTOS_SELECCION.todos));
  assert.ok(barras.length >= 1, '🔴 SUELO: no encuentro la barra de selección.');
  const barra = barras[barras.length - 1];
  const botones = todos(barra).filter((n) => n.tagName === 'BUTTON' || n.tagName === 'A');
  assert.deepEqual(botones.map((b) => b.textContent), [],
    '🔴 HA APARECIDO UNA ACCIÓN EN BLOQUE en la barra de selección. Qué se ofrece en bloque lo '
    + 'decide el FUNDADOR: este ticket entrega el mecanismo de selección y NADA más. Y si la '
    + 'acción envía mensajes, antes pasa por la tabla anti-spam de la regla 28.');
});

// ═══ ④ MICROCOPY ═════════════════════════════════════════════════════════════════════════

test('SCRUM-582 · ✅ «Seleccionar todos» es literal, y ⚠️ el contador va con MARCADOR', () => {
  assert.equal(FC.TEXTOS_SELECCION.todos, 'Seleccionar todos',
    '🔴 el nombre accesible de la casilla de cabecera no es el aprobado por el asesor (4-sep-2026). '
    + 'Se compara con `===`: un `includes` dejaría colar «Seleccionar todo» sin que nada cayera.');
  assert.ok(FC.TEXTOS_SELECCION.contador.startsWith('[PENDIENTE'),
    '🔴 el contador ya no lleva marcador, o lo lleva con una grafía que el censo de SCRUM-402 NO '
    + 'cuenta: ese censo busca `[PENDIENTE`, y un marcador invisible al trinquete es una frase sin '
    + 'aprobar en pantalla que nadie está vigilando. Si el asesor lo ha firmado, hay que quitar '
    + 'también la entrada de `filtroClientes.js` del censo — y este test con ella.');
  assert.equal(FC.textoDelContador(3).startsWith('3 '), true,
    '🔴 el contador ha dejado de decir CUÁNTOS hay marcados, que es el único dato que da.');
});

// ═══ ⑤ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-582 · CONTROL NEGATIVO: renombrar una columna NO tumba nada de esto', () => {
  // Lo que NO debe hacerlo caer. Si este guard estuviera atado al rótulo de una columna, daría
  // rojo el día que alguien cambie «Alta» por «Fecha de alta» — un rojo que no es un defecto.
  const copia = FC.COLUMNAS.map((c) => (c.id === 'alta' ? { ...c, texto: 'Fecha de alta' } : c));
  const seleccion = copia.filter((c) => c.id === 'seleccion')[0];
  assert.equal(seleccion.fija, true, '🔴 renombrar otra columna ha movido la de selección.');
  assert.equal(copia[0].id, 'seleccion', '🔴 renombrar otra columna la ha desplazado.');
  assert.equal(copia.length, FC.COLUMNAS.length, '🔴 renombrar ha cambiado el número de columnas.');
  // Y la decisión pura no depende de rótulos en absoluto:
  assert.deepEqual(FC.seleccionarTodos(CLIENTES), ['1', '2', '3'],
    '🔴 la selección depende de los rótulos de las columnas.');
});

test('SCRUM-582 · CONTROL NEGATIVO: la vista NO repite los textos, los lee de la pieza', () => {
  const v = fs.readFileSync(VISTA, 'utf8');
  const codigo = v.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
    .filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/["'`]Seleccionar todos["'`]/.test(codigo), false,
    '🔴 la vista repite el literal «Seleccionar todos» en vez de leerlo de `FC.TEXTOS_SELECCION`. '
    + 'Un texto suelto en un `setAttribute` deriva sin que nada chille.');
  assert.match(codigo, /FC\.TEXTOS_SELECCION\.todos/,
    '🔴 la vista ya no lee el texto de la pieza.');
});
