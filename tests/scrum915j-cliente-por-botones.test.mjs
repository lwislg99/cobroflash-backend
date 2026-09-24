// tests/scrum915j-cliente-por-botones.test.mjs — SCRUM-915j
//
// Sin gate: lee ficheros y monta el dashboard en el banco. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// El prototipo v3 aprobado (`docs/prototipos/SCRUM-915/editor-presupuesto.html`, `pasoCliente()`)
// elige al cliente por BOTONES —hasta 4 coincidencias, nombre y teléfono, «+ Nuevo cliente» al
// final— y el editor seguía enseñando un `<select>` de 200 opciones. Es el «diseño aprobado que no
// está en la pantalla NO está hecho».
//
// LO QUE ESTE FICHERO VIGILA NO ES «HAY BOTONES». Es lo que se rompe al meterlos:
//
//   ① el `<select name="customer_id">` SIGUE en el documento y sigue guardando el valor —doce sitios
//     lo leen y el restaurador de borradores lo escribe—: los botones son la mano, el `<select>` la
//     memoria, y va `hidden`;
//   ② pulsar un botón es EXACTAMENTE lo que hacía elegir la opción (mismo camino, no uno paralelo);
//   ③ el ELEGIDO cabe siempre en los cuatro, viva donde viva en la lista: recortar a 4 no puede
//     esconder al cliente que el profesional ya eligió;
//   ④ ni un literal nuevo (regla 30) y ni un `aria-label` estrenado.
//
// Lo que se ve en un navegador de verdad (medidas, foco, el clic real) lo juzga
// `guard:pasos-del-editor` (bloque J). Aquí, lo que el banco puede ejecutar.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const B = require_(path.join(RAIZ, 'public/dashboard/js/buscadorDeClientes.js'));

// ── LOS CLIENTES DEL BANCO: seis, para que haya algo que recortar ───────────────────────────
const OLIVOS = { id: 21, name: 'Comunidad Los Olivos', phone: '34000000021', email: 'olivos@correo.es' };
const FINCAS = { id: 22, name: 'Fincas García SL', phone: '34000000022', email: 'fincas@correo.es', internalRef: 'FG-01' };
const ORTEGA = { id: 23, name: 'Reformas Ortega', phone: '34000000023', email: 'ortega@correo.es' };
const PUERTO = { id: 24, name: 'Bar El Puerto', phone: '34000000024', email: 'puerto@correo.es' };
const MARTIN = { id: 25, name: 'Taller Martín', phone: '34000000025', email: 'martin@correo.es' };
const LOLA = { id: 26, name: 'Peluquería Lola', phone: '34000000026', email: 'lola@correo.es' };
const SEIS = [OLIVOS, FINCAS, ORTEGA, PUERTO, MARTIN, LOLA];

function banco({ clientes = SEIS, localStorage } = {}) {
  return cargarDashboard(RAIZ, {
    localStorage,
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
      if (/\/admin\/customers/.test(u)) return clientes;
      return datosDeMuestra(u);
    },
  });
}

const selectorDeCliente = (r) =>
  todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.name === 'customer_id') || null;
const listaDeBotones = (r) =>
  todos(r.contenedor).find((n) => n.tagName === 'UL' && /\bquote-clientes\b/.test(String(n.className || ''))) || null;
/** Los botones de CLIENTE (sin el de alta), en el orden en que se ven. */
const botonesDeCliente = (r) =>
  todos(listaDeBotones(r)).filter((n) => n.tagName === 'BUTTON' && n.dataset.customerId !== undefined);
const botonDeAlta = (r) =>
  todos(listaDeBotones(r)).find((n) => n.tagName === 'BUTTON' && /quote-cliente-opcion--nuevo/.test(String(n.className || ''))) || null;
const idsDe = (r) => botonesDeCliente(r).map((b) => b.dataset.customerId);
const marcadosDe = (r) =>
  botonesDeCliente(r).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.customerId);
const notaDe = (r) => {
  const n = todos(listaDeBotones(r)).find((x) => /quote-clientes__nota/.test(String(x.className || '')));
  return n ? n.textContent : null;
};
const buscadorDe = (r) =>
  todos(selectorDeCliente(r)._padre).find((n) => n.tagName === 'INPUT' && n.type === 'search') || null;
const teclear = (r, texto) => { const c = buscadorDe(r); c.value = texto; return c.disparar('input'); };
/** Cuántas veces se lee el nombre FUERA de los botones y del `<select>`: lo que enseña la vista previa. */
const lecturasDelNombre = (r, nombre) => todos(r.contenedor).filter((n) =>
  !['BUTTON', 'OPTION', 'B', 'SELECT'].includes(n.tagName) && n.hijos.length === 0
  && String(n.textContent || '').includes(nombre)).length;

// ═══ ① SUELO — sin esto, lo de abajo sería cierto sobre un conjunto vacío ═════════════════

test('SCRUM-915j · 🔴 SUELO: el editor monta, con SU lista de botones y con los seis clientes en el select', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor ha dejado de montarse: ${r.error && r.error.message}`);
  assert.ok(listaDeBotones(r), '🔴 no hay `ul.quote-clientes`: el cliente no se elige por botones.');
  const sel = selectorDeCliente(r);
  assert.ok(sel, '🔴 ha desaparecido el `<select name="customer_id">`: es el portador del valor.');
  const opciones = todos(sel).filter((n) => n.tagName === 'OPTION').map((o) => o.textContent).join(' | ');
  for (const c of SEIS) {
    assert.ok(opciones.includes(c.name), `🔴 «${c.name}» no está en el select: la lista no llegó y lo de abajo mediría el vacío.`);
  }
});

// ═══ ② EL SELECT SE QUEDA, ESCONDIDO ══════════════════════════════════════════════════════

test('SCRUM-915j · el <select name="customer_id"> sigue en el documento y va `hidden`', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const sel = selectorDeCliente(r);
  assert.equal(sel.hidden, true,
    '🔴 el `<select>` se ve: los botones son el control y él sólo guarda el valor. Dos controles '
    + 'para lo mismo es justo lo que el prototipo v3 quita.');
  assert.equal(todos(r.contenedor).filter((n) => n.tagName === 'SELECT' && n.name === 'customer_id').length, 1,
    '🔴 tiene que haber UN solo `<select name="customer_id">`: doce sitios lo leen por su valor.');
});

// ═══ ③ HASTA 4 BOTONES, CON SU NOMBRE Y SU TELÉFONO ═══════════════════════════════════════

test('SCRUM-915j · con seis clientes se pintan CUATRO botones, los cuatro primeros, y ninguno marcado', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  assert.deepEqual(idsDe(r), ['21', '22', '23', '24'],
    '🔴 el prototipo v3 enseña «hasta 4 coincidencias»: con seis clientes y la búsqueda vacía, los cuatro primeros.');
  assert.deepEqual(marcadosDe(r), [], '🔴 sin elegir a nadie hay un botón marcado.');
  assert.equal(B.MAX_COINCIDENCIAS, 4, '🔴 el máximo de botones es 4 (prototipo v3).');
});

test('SCRUM-915j · cada botón dice el NOMBRE en negrita y, debajo, «teléfono · referencia»', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const b = botonesDeCliente(r).find((x) => x.dataset.customerId === '22');
  const dentro = todos(b);
  const nombre = dentro.find((n) => n.tagName === 'B');
  const detalle = dentro.find((n) => n.tagName === 'SMALL');
  assert.equal(nombre && nombre.textContent, FINCAS.name, '🔴 el nombre del cliente no va en `<b>`.');
  assert.equal(detalle && detalle.textContent, '34000000022 · FG-01', '🔴 el detalle no es «teléfono · referencia».');
  const sinRef = botonesDeCliente(r).find((x) => x.dataset.customerId === '23');
  const detalle2 = todos(sinRef).find((n) => n.tagName === 'SMALL');
  assert.equal(detalle2 && detalle2.textContent, '34000000023',
    '🔴 un cliente sin referencia enseña sólo su teléfono, sin un «·» colgando.');
  assert.equal(b.type, 'button', '🔴 el botón de cliente no es `type="button"`: dentro de un formulario enviaría.');
});

test('SCRUM-915j · 🔴 ni un aria-label estrenado (regla 30): el nombre accesible es el contenido del botón', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  for (const b of todos(listaDeBotones(r)).filter((n) => n.tagName === 'BUTTON')) {
    assert.equal(b.getAttribute('aria-label'), null,
      `🔴 un botón de la lista de clientes lleva \`aria-label\` («${b.getAttribute('aria-label')}»): es un literal sin firmar.`);
  }
});

// ═══ ④ PULSAR = ELEGIR ════════════════════════════════════════════════════════════════════

test('SCRUM-915j · pulsar un botón guarda el cliente en el select y lo MARCA (y sólo a él)', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const sel = selectorDeCliente(r);
  const antes = lecturasDelNombre(r, FINCAS.name);
  const corrieron = botonesDeCliente(r).find((b) => b.dataset.customerId === '22').click();
  assert.ok(corrieron > 0, '🔴 el botón existe pero NADIE ESCUCHA el clic: 0 oyentes.');
  assert.equal(sel.value, '22', '🔴 pulsar el botón no guardó el cliente en el `<select>`.');
  assert.deepEqual(marcadosDe(r), ['22'], '🔴 tras pulsar, el marcado no es sólo el pulsado.');
  assert.ok(lecturasDelNombre(r, FINCAS.name) > antes,
    '🔴 pulsar el botón NO llegó a la vista previa: el clic guardó el valor pero no ejecutó lo que ejecuta '
    + 'un `change` (recalcular propuestas, repintar, guardar borrador). Tiene que ser EL MISMO camino.');
});

test('SCRUM-915j · cambiar de idea MUEVE la marca: no queda ninguna colgando', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  botonesDeCliente(r).find((b) => b.dataset.customerId === '22').click();
  botonesDeCliente(r).find((b) => b.dataset.customerId === '24').click();
  assert.equal(selectorDeCliente(r).value, '24');
  assert.deepEqual(marcadosDe(r), ['24'], '🔴 tras elegir otro, la marca no se movió (o quedó en los dos).');
});

test('SCRUM-915j · elegir por el select (change, como el guard y el borrador) también marca el botón', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const sel = selectorDeCliente(r);
  sel.value = '23';
  assert.ok(sel.disparar('change') > 0, '🔴 el `<select>` ya no tiene oyente de `change`.');
  assert.deepEqual(marcadosDe(r), ['23'], '🔴 el select dice 23 y los botones no lo siguen.');
});

// ═══ ⑤ EL ELEGIDO CABE SIEMPRE ════════════════════════════════════════════════════════════

test('SCRUM-915j · 🔴 el elegido que vive FUERA de los cuatro primeros va a la CABEZA: el paso no se queda sin decir cuál', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const sel = selectorDeCliente(r);
  sel.value = '26';
  sel.disparar('change');
  assert.deepEqual(idsDe(r), ['26', '21', '22', '23'],
    '🔴 el cliente 26 está elegido y no se ve: recortar a 4 no puede esconder lo que el profesional eligió.');
  assert.deepEqual(marcadosDe(r), ['26']);
});

test('SCRUM-915j · 🔴 el cliente de un BORRADOR restaurado queda marcado y a la vista (el select lo escribe otro código)', async () => {
  // El restaurador ESCRIBE `select.value` a mano, sin evento: si los botones sólo siguieran al `change`,
  // el borrador volvería con su cliente puesto y ningún botón lo diría.
  const borrador = JSON.stringify({
    customerId: '26', paymentTerms: '', vatDefault: '21',
    lines: [{ concept: 'Punto de luz', qty: '1', price: '10', vat: '21' }],
  });
  const r = await pintarVista(banco({ localStorage: { pf_quote_draft_1: borrador } }), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor no monta con un borrador: ${r.error && r.error.message}`);
  assert.equal(selectorDeCliente(r).value, '26',
    '🔴 SUELO: el borrador no restauró el cliente en el select; lo de abajo mediría otra cosa.');
  assert.deepEqual(idsDe(r), ['26', '21', '22', '23'], '🔴 el cliente del borrador no está a la vista.');
  assert.deepEqual(marcadosDe(r), ['26'], '🔴 el cliente del borrador no aparece marcado.');
});

test('SCRUM-915j · el elegido que YA está entre los cuatro NO cambia de sitio', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  botonesDeCliente(r).find((b) => b.dataset.customerId === '23').click();
  assert.deepEqual(idsDe(r), ['21', '22', '23', '24'],
    '🔴 pulsar un botón REORDENA la lista: el botón que se acaba de tocar se mueve bajo el dedo.');
});

test('SCRUM-915j · pulsar un botón NO repinta la lista: el botón pulsado es el MISMO nodo (el teclado no pierde el foco)', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  const antes = botonesDeCliente(r).find((b) => b.dataset.customerId === '22');
  antes.click();
  const despues = botonesDeCliente(r).find((b) => b.dataset.customerId === '22');
  assert.strictEqual(despues, antes,
    '🔴 tras pulsar, el botón es OTRO nodo: se repintó la lista y quien navega con teclado pierde el foco.');
});

// ═══ ⑥ LA BÚSQUEDA ════════════════════════════════════════════════════════════════════════

test('SCRUM-915j · buscar trae al que casa aunque viva fuera de los cuatro, y el elegido no se cae', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  botonesDeCliente(r).find((b) => b.dataset.customerId === '21').click();
  assert.ok(teclear(r, 'lola') > 0, '🔴 el buscador no reacciona a lo que se teclea.');
  assert.deepEqual(idsDe(r), ['21', '26'], '🔴 buscando «lola» tienen que salir el elegido y el que casa.');
  assert.deepEqual(marcadosDe(r), ['21'], '🔴 al buscar se pierde la marca del elegido.');
  assert.equal(notaDe(r), null, '🔴 sale «sin resultados» habiendo un cliente que casa.');
});

test('SCRUM-915j · una búsqueda que no casa con nadie lo DICE aunque el elegido siga a la vista', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  botonesDeCliente(r).find((b) => b.dataset.customerId === '21').click();
  teclear(r, 'zzzz');
  assert.equal(notaDe(r), B.TEXTOS.sinResultados,
    '🔴 buscando «zzzz» con un cliente elegido no sale el aviso: se vería UN botón y nadie sabría que buscó en vano.');
  assert.deepEqual(idsDe(r), ['21'], '🔴 sin resultados, el elegido tiene que seguir a la vista.');
  assert.ok(botonDeAlta(r), '🔴 sin resultados, «+ Nuevo cliente» tiene que seguir ahí: es la salida.');
});

test('SCRUM-915j · sin ningún cliente, el aviso es «Primero necesitas un cliente.» y el alta está a mano', async () => {
  const r = await pintarVista(banco({ clientes: [] }), 'renderQuotesView');
  assert.deepEqual(idsDe(r), []);
  assert.equal(notaDe(r), B.TEXTOS.sinNinguno);
  assert.ok(botonDeAlta(r), '🔴 sin clientes tiene que estar «+ Nuevo cliente»: es lo ÚNICO que se puede hacer.');
});

test('SCRUM-915j · vaciar la búsqueda devuelve los cuatro primeros', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  teclear(r, 'lola');
  assert.deepEqual(idsDe(r), ['26']);
  teclear(r, '');
  assert.deepEqual(idsDe(r), ['21', '22', '23', '24']);
});

// ═══ ⑦ «+ NUEVO CLIENTE» ══════════════════════════════════════════════════════════════════

test('SCRUM-915j · «+ Nuevo cliente» es el MISMO literal firmado y abre el alta SIN tocar al elegido', async () => {
  const banc = banco();
  const r = await pintarVista(banc, 'renderQuotesView');
  const sel = selectorDeCliente(r);
  botonesDeCliente(r).find((b) => b.dataset.customerId === '22').click();
  const llamadas = [];
  banc.ctx.window.altaClienteModal.abrirNuevo = (op) => llamadas.push(op);
  const alta = botonDeAlta(r);
  assert.equal(alta.textContent, '+ Nuevo cliente', '🔴 el literal del alta no es el firmado (SCRUM-591).');
  assert.ok(alta.click() > 0, '🔴 el botón del alta no tiene oyente.');
  assert.equal(llamadas.length, 1, '🔴 pulsar «+ Nuevo cliente» no abrió el formulario de alta.');
  assert.equal(sel.value, '22', '🔴 abrir el alta cambió al cliente elegido: es una ACCIÓN, no un cliente.');
  assert.deepEqual(marcadosDe(r), ['22']);
});

test('SCRUM-915j · el cliente recién creado queda ELEGIDO y a la vista (a la cabeza), aunque no estuviera entre los cuatro', async () => {
  const banc = banco();
  const r = await pintarVista(banc, 'renderQuotesView');
  const llamadas = [];
  banc.ctx.window.altaClienteModal.abrirNuevo = (op) => llamadas.push(op);
  botonDeAlta(r).click();
  llamadas[0].alGuardar({ id: 99, name: 'Nuevo Cliente SL', phone: '34000000099', email: 'nuevo@correo.es' });
  assert.equal(selectorDeCliente(r).value, '99', '🔴 el recién creado no quedó elegido en el select.');
  assert.deepEqual(idsDe(r).slice(0, 1), ['99'], '🔴 el recién creado no está a la vista: el paso no dice a quién eligió.');
  assert.deepEqual(marcadosDe(r), ['99']);
});

// ═══ ⑧ LA PIEZA PURA `coincidencias` ═════════════════════════════════════════════════════

test('SCRUM-915j · coincidencias: sin búsqueda, los `max` primeros; con `max` distinto, ése', () => {
  assert.deepEqual(B.coincidencias(SEIS, '', '').map((c) => c.id), [21, 22, 23, 24]);
  assert.deepEqual(B.coincidencias(SEIS, '', '', 2).map((c) => c.id), [21, 22]);
  assert.deepEqual(B.coincidencias(SEIS.slice(0, 3), '', '').map((c) => c.id), [21, 22, 23], '🔴 con menos de 4, salen todos.');
  assert.deepEqual(B.coincidencias([], '', ''), []);
  assert.deepEqual(B.coincidencias(null, '', ''), [], '🔴 una lista que no es lista no puede reventar.');
});

test('SCRUM-915j · coincidencias: el elegido fuera del recorte va a la cabeza y se cae el ÚLTIMO, no el elegido', () => {
  assert.deepEqual(B.coincidencias(SEIS, '', '26').map((c) => c.id), [26, 21, 22, 23]);
  assert.deepEqual(B.coincidencias(SEIS, '', 26).map((c) => c.id), [26, 21, 22, 23], '🔴 el id llega como número o como texto.');
  assert.deepEqual(B.coincidencias(SEIS, '', '22').map((c) => c.id), [21, 22, 23, 24], '🔴 el elegido que ya cabe NO se mueve.');
  assert.deepEqual(B.coincidencias(SEIS, '', '26', 1).map((c) => c.id), [26], '🔴 con max 1 sale sólo el elegido.');
});

test('SCRUM-915j · coincidencias: un elegido que ya no existe no rompe nada ni se inventa', () => {
  assert.deepEqual(B.coincidencias(SEIS, '', '999').map((c) => c.id), [21, 22, 23, 24]);
});

test('SCRUM-915j · coincidencias: respeta la regla de búsqueda de `filtrar` y NO muta la lista de entrada', () => {
  const copia = SEIS.map((c) => c.id);
  assert.deepEqual(B.coincidencias(SEIS, 'garcia', '').map((c) => c.id), [22], '🔴 «garcia» sin tilde tiene que encontrar «García».');
  assert.deepEqual(B.coincidencias(SEIS, 'lola', '21').map((c) => c.id), [21, 26], '🔴 el elegido no casa y aun así va.');
  B.coincidencias(SEIS, 'lola', '26');
  assert.deepEqual(SEIS.map((c) => c.id), copia, '🔴 `coincidencias` MUTÓ la lista de entrada (`customersList` es fuente de verdad).');
});
