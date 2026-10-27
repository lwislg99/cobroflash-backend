// SCRUM-1493 · LA PROPUESTA DEL DICTADO, CON LO CORREGIDO A MANO, NO SE BORRA POR NINGÚN CAMINO.
//
// SCRUM-1302 (C) la protegió cuando la ruta del dictado NO contesta. Quedaban dos caminos, medidos en
// yaqu.app el 6-oct-2026 (descripción del ticket, 2 de 2 ventanas), en los que la ruta SÍ contesta
// o el fallo es de otra petición, y el trabajo se perdía igual:
//   1 · se vuelve a ordenar y la ruta contesta 200 SIN líneas (es lo que hace con la IA caída);
//   2 · se pulsa «Añadir al parte» y el `PATCH` falla.
//
// Ningún texto nuevo: el del camino 1 lo manda el servidor, y el del camino 2 es el literal firmado
// el 3-sep-2026 (SCRUM-704), que aquí se compara letra a letra.
//
// Monta la vista de verdad en el banco y sirve por `fetch`, como `scrum1302c`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NO_SE_GUARDARON = 'No se han podido guardar las líneas — vuelve a intentarlo';
const NINGUNA_LINEA = 'No se ha podido sacar ninguna línea — escríbelas tú';
const NO_SE_ENTENDIO = 'No se ha entendido el dictado — vuelve a dictar o escríbelo a mano';
const NO_SE_ORDENO = 'No se ha podido ordenar el dictado — vuelve a intentarlo o escribe las líneas tú';
const DICTADO = 'He cambiado dos detectores y he purgado el circuito';
const CORREGIDA = 'Detector volumétrico de techo';

const BASE = Object.freeze({
  id: 7, numero: 'PT-2026-007', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'R-9',
  entrada: '08:00', salida: '11:30', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: 'Llave en portería', estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});

const AVISOS = Object.freeze({
  cantidadesRetiradas: 'Falta la cantidad',
  datosRetirados: 'Revisa este dato',
  sin_lineas_reconocidas: NINGUNA_LINEA,
  dictado_vacio: NO_SE_ENTENDIO,
});
const PROPUESTA = Object.freeze({
  propuesta: {
    vacia: false,
    mano_obra: [{ unds: 1, descripcion: 'Purga del circuito' }],
    materiales: [{ unds: 2, descripcion: 'Detector' }, { unds: 1, descripcion: 'Sirena interior' }],
    sinBloque: [], datosRetirados: [],
  },
  avisos: AVISOS,
});
const vacia = (motivo) => ({
  propuesta: { vacia: true, motivo, mano_obra: [], materiales: [], sinBloque: [] },
  avisos: AVISOS,
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const con = (c, a) => todos(c).filter((x) => attr(x, a) != null);
const filas = (c) => con(c, 'data-propuesta');
const descripciones = (c) => con(c, 'data-propuesta-desc').map((x) => x.value);
const sitioDelAviso = (c) => con(c, 'data-dictado-aviso')[0];
/** Lo que hay DICHO en el sitio del aviso del dictado, sea del tipo que sea. */
const dichos = (c) => todos(sitioDelAviso(c)).filter((x) => x !== sitioDelAviso(c) && attr(x, 'role') === 'alert');
const pausa = () => new Promise((r) => setTimeout(r, 8));
const copia = (x) => JSON.parse(JSON.stringify(x));

/**
 * Un servidor por `fetch`. `dictado` dice qué contesta la ruta del dictado en el siguiente intento
 * ('propuesta' | 'sin_lineas_reconocidas' | 'dictado_vacio' | un código HTTP) y `guardar`, qué pasa
 * con el `PATCH` ('ok' | 'sin-red' | un código HTTP).
 */
function servidor() {
  let parte = copia(BASE);
  const estado = { dictado: 'propuesta', guardar: 'ok', pedidas: [] };
  const responder = (status, data) => ({
    ok: status < 400, status, statusText: 'x',
    headers: { get: () => 'application/json' },
    json: async () => copia(data),
    blob: async () => ({}), text: async () => '',
  });
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    estado.pedidas.push({ metodo, url: String(url), body: opts.body ? JSON.parse(opts.body) : undefined });
    if (metodo === 'POST' && /\/dictado$/.test(String(url))) {
      const que = estado.dictado;
      if (que === 'propuesta') return responder(200, PROPUESTA);
      if (typeof que === 'string') return responder(200, vacia(que));
      return responder(que, { error: 'internal_error' });
    }
    if (metodo === 'PATCH') {
      if (estado.guardar === 'sin-red') throw new TypeError('Failed to fetch');
      if (estado.guardar !== 'ok') return responder(estado.guardar, { error: 'internal_error' });
      parte = { ...parte, ...JSON.parse(opts.body) };
      return responder(200, parte);
    }
    return responder(200, parte);
  };
  const de = (metodo, patron) => estado.pedidas.filter((p) => p.metodo === metodo && patron.test(p.url));
  return { fetch, estado, de, leer: () => parte };
}

async function montar(srv) {
  const b = cargarDashboard(RAIZ, { red: { fetch: srv.fetch } });
  const c = b.mk('div');
  b.ctx.document.body.appendChild(c);
  const traidos = [];
  const crear = b.ctx.document.createElement;
  b.ctx.document.createElement = function (etiqueta) {
    const n = crear.call(this, etiqueta);
    n.scrollIntoView = function (opciones) { traidos.push({ nodo: n, opciones, colgado: todos(c).includes(n) }); };
    return n;
  };
  const ok = await b.ctx.renderParteDetailView(c, 7);
  assert.notEqual(ok, false, '🔴 SUELO: la vista del parte no se ha montado');
  assert.equal(con(c, 'data-dictado-ordenar').length, 1, '🔴 SUELO: el parte no se pintó editable, no hay botón de ordenar');
  return { c, traidos };
}

async function ordenar(c, srv, que) {
  srv.estado.dictado = que;
  const antes = srv.de('POST', /\/dictado$/).length;
  con(c, 'data-dictado-texto')[0].value = DICTADO;
  assert.ok(con(c, 'data-dictado-ordenar')[0].disparar('click') > 0, '🔴 SUELO: nadie escucha «Ordenar en líneas»');
  await pausa();
  assert.equal(srv.de('POST', /\/dictado$/).length, antes + 1, '🔴 SUELO: el dictado no llegó a mandarse');
}

/** Pulsa «Añadir al parte» con el `PATCH` contestando `que`. Devuelve cuántos `PATCH` salieron. */
async function anadir(c, srv, que) {
  srv.estado.guardar = que;
  const antes = srv.de('PATCH', /\/admin\/partes\/7$/).length;
  const confirmar = con(c, 'data-propuesta-confirmar')[0];
  assert.ok(confirmar, '🔴 SUELO: no hay botón «Añadir al parte»');
  assert.equal(confirmar.disabled, false, '🔴 SUELO: «Añadir al parte» está apagado');
  assert.ok(confirmar.disparar('click') > 0, '🔴 SUELO: nadie escucha «Añadir al parte»');
  await pausa();
  return srv.de('PATCH', /\/admin\/partes\/7$/).length - antes;
}

/** Una propuesta de tres líneas en pantalla, con una descripción corregida a mano. */
async function conPropuestaCorregida(srv) {
  const m = await montar(srv);
  await ordenar(m.c, srv, 'propuesta');
  assert.equal(filas(m.c).length, 3, '🔴 SUELO: la propuesta de tres líneas no se ha pintado');
  const campo = con(m.c, 'data-propuesta-desc').find((x) => x.value === 'Detector');
  assert.ok(campo, '🔴 SUELO: no encuentro la descripción que se va a corregir');
  campo.value = CORREGIDA;
  campo.disparar('input');
  return m;
}

const SIGUE_LO_CORREGIDO = ['Purga del circuito', CORREGIDA, 'Sirena interior'];

// ═══ CAMINO 2 · «Añadir al parte» con el guardado fallando ═══════════════════════════════════════

test('SCRUM-1493 · 🔴 «Añadir al parte» con el guardado en 500: las líneas y la corrección SIGUEN en pantalla, y se dice', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  assert.equal(await anadir(c, srv, 500), 1, '🔴 SUELO: el guardado no llegó a intentarse');

  assert.equal(filas(c).length, 3, '🔴 el guardado ha fallado y se ha llevado la propuesta: no queda qué reintentar');
  assert.deepEqual(descripciones(c), SIGUE_LO_CORREGIDO, '🔴 la corrección hecha a mano se ha perdido');
  assert.equal(con(c, 'data-propuesta-confirmar').length, 1, '🔴 dice «vuelve a intentarlo» y ya no hay botón con el que intentarlo');
  const salen = dichos(c);
  assert.equal(salen.length, 1, '🔴 el guardado ha fallado y la ficha no dice nada');
  assert.equal(salen[0].textContent, NO_SE_GUARDARON, 'el texto no es el firmado el 3-sep, letra a letra');
  assert.notEqual(attr(salen[0], 'data-dictado-no-guardado'), null);
  assert.equal(srv.leer().lineas.length, 1, 'CONTROL: en el servidor no ha entrado nada');
});

test('SCRUM-1493 · el aviso de «no se han guardado» va bajo el botón de ordenar y SOBRE la propuesta, no dentro de ella', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await anadir(c, srv, 500);

  const aviso = dichos(c)[0];
  assert.ok(aviso, '🔴 SUELO: no hay aviso');
  const orden = todos(c);
  const boton = con(c, 'data-dictado-ordenar')[0];
  const hueco = con(c, 'data-dictado-propuesta')[0];
  assert.ok(orden.indexOf(boton) < orden.indexOf(aviso) && orden.indexOf(aviso) < orden.indexOf(hueco),
    '🔴 el aviso no está entre el botón y el hueco de la propuesta');
  assert.equal(todos(hueco).includes(aviso), false, '🔴 el aviso se ha pintado DENTRO del hueco de la propuesta');
});

test('SCRUM-1493 · 🔴 sin red al añadir: lo mismo, la propuesta sigue y se dice', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  assert.equal(await anadir(c, srv, 'sin-red'), 1, '🔴 SUELO: el guardado no llegó a intentarse');

  assert.deepEqual(descripciones(c), SIGUE_LO_CORREGIDO, '🔴 un corte de red al añadir ha borrado la propuesta');
  assert.equal(dichos(c).length, 1);
  assert.equal(dichos(c)[0].textContent, NO_SE_GUARDARON);
});

test('SCRUM-1493 · 🔴 el segundo toque, con el guardado ya bien, guarda UNA vez y lo corregido', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await anadir(c, srv, 500);
  await anadir(c, srv, 500);
  assert.equal(dichos(c).length, 1, '🔴 dos guardados fallidos dejan el aviso dos veces');

  assert.equal(await anadir(c, srv, 'ok'), 1, '🔴 un toque ha mandado más de un guardado: las líneas entrarían repetidas en un documento que se firma');
  const guardados = srv.de('PATCH', /\/admin\/partes\/7$/);
  assert.deepEqual(guardados[guardados.length - 1].body.lineas.map((l) => l.descripcion),
    ['Revisión', 'Purga del circuito', CORREGIDA, 'Sirena interior']);
  assert.equal(srv.leer().lineas.length, 4, '🔴 SUELO: las líneas no han entrado en el parte');
  assert.equal(dichos(c).length, 0, '🔴 ya está guardado y la ficha sigue diciendo que no');
  assert.equal(filas(c).length, 0, 'CONTROL: tras guardar, el parte se repinta desde el servidor y ya no hay propuesta');
});

test('SCRUM-1493 · el aviso de «no se han guardado» se trae a la vista, ya colgado', async () => {
  const srv = servidor();
  const { c, traidos } = await conPropuestaCorregida(srv);
  await anadir(c, srv, 500);

  const suyos = traidos.filter((t) => t.nodo === dichos(c)[0]);
  assert.equal(suyos.length, 1, '🔴 el aviso no se trae a la vista: está encima de la propuesta y el botón pulsado, debajo');
  assert.equal(suyos[0].colgado, true, '🔴 se pide traerlo antes de colgarlo');
  assert.deepEqual({ ...suyos[0].opciones }, { block: 'nearest' });
});

// ═══ CAMINO 1 · se vuelve a ordenar y la ruta contesta 200 sin líneas ═══════════════════════════

test('SCRUM-1493 · 🔴 200 sin líneas (la IA caída) con una propuesta corregida en pantalla: NO la borra, y se dice lo que manda el servidor', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 'sin_lineas_reconocidas');

  assert.equal(filas(c).length, 3, '🔴 la ruta ha contestado «ninguna línea» y la vista ha borrado las tres que había');
  assert.deepEqual(descripciones(c), SIGUE_LO_CORREGIDO, '🔴 la corrección hecha a mano se ha perdido');
  assert.equal(con(c, 'data-propuesta-confirmar').length, 1, '🔴 la propuesta sigue pero ya no se puede añadir');
  const salen = dichos(c);
  assert.equal(salen.length, 1, '🔴 el intento no ha sacado nada y la ficha no lo dice');
  assert.equal(salen[0].textContent, NINGUNA_LINEA, 'el texto es el que manda el servidor, sin tocar');
  assert.equal(todos(con(c, 'data-dictado-propuesta')[0]).includes(salen[0]), false, '🔴 el aviso se ha pintado dentro de la propuesta');
  assert.equal(con(c, 'data-propuesta-vacia').length, 0, '🔴 se ha pintado además el párrafo de «propuesta vacía» sobre una que no lo está');
});

test('SCRUM-1493 · el otro motivo que la ruta manda vacío (`dictado_vacio`) tampoco borra, y dice SU texto', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 'dictado_vacio');

  assert.deepEqual(descripciones(c), SIGUE_LO_CORREGIDO, '🔴 un dictado que no se entiende ha borrado la propuesta');
  assert.equal(dichos(c).length, 1);
  assert.equal(dichos(c)[0].textContent, NO_SE_ENTENDIO, '🔴 la vista ha elegido el texto: lo elige el servidor, por el motivo');
});

test('SCRUM-1493 · 🔴 tras un 200 sin líneas, «Añadir al parte» guarda UNA vez, y lo corregido', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 'sin_lineas_reconocidas');
  await ordenar(c, srv, 'sin_lineas_reconocidas');
  assert.equal(dichos(c).length, 1, '🔴 dos intentos sin líneas dejan el aviso dos veces');

  assert.equal(await anadir(c, srv, 'ok'), 1, '🔴 cada intento ha atado otra escucha al botón que ya había');
  const guardados = srv.de('PATCH', /\/admin\/partes\/7$/);
  assert.deepEqual(guardados[0].body.lineas.map((l) => l.descripcion),
    ['Revisión', 'Purga del circuito', CORREGIDA, 'Sirena interior']);
});

test('SCRUM-1493 · una respuesta buena después SÍ sustituye la propuesta y quita el aviso', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 'sin_lineas_reconocidas');
  assert.equal(dichos(c).length, 1, '🔴 SUELO: el aviso no llegó a salir');

  await ordenar(c, srv, 'propuesta');
  assert.equal(dichos(c).length, 0, '🔴 el dictado ya se ha ordenado y la ficha sigue diciendo que no ha salido ninguna línea');
  assert.deepEqual(descripciones(c), ['Purga del circuito', 'Detector', 'Sirena interior'],
    'CONTROL: una propuesta nueva es lo que el técnico ha pedido, y sustituye a la de antes');
});

// ═══ UN AVISO A LA VEZ, Y LOS CONTROLES ═════════════════════════════════════════════════════════

test('SCRUM-1493 · en el sitio del aviso hay UNO, el del último intento: guardar que falla sustituye al de «no se ha podido ordenar»', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 500);
  assert.deepEqual(dichos(c).map((x) => x.textContent), [NO_SE_ORDENO], '🔴 SUELO: el aviso de SCRUM-1302 (C) no ha salido');

  await anadir(c, srv, 500);
  assert.deepEqual(dichos(c).map((x) => x.textContent), [NO_SE_GUARDARON], '🔴 quedan dos avisos, o el viejo');

  await ordenar(c, srv, 500);
  assert.deepEqual(dichos(c).map((x) => x.textContent), [NO_SE_ORDENO], '🔴 quedan dos avisos, o el viejo');
  assert.deepEqual(descripciones(c), SIGUE_LO_CORREGIDO, 'y en todo el recorrido la propuesta no se ha tocado');
});

test('SCRUM-1493 · CONTROL: SIN propuesta en pantalla, el 200 sin líneas se pinta donde siempre', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await ordenar(c, srv, 'sin_lineas_reconocidas');

  const parrafo = con(c, 'data-propuesta-vacia');
  assert.equal(parrafo.length, 1, '🔴 sin propuesta que proteger, el aviso del servidor ha dejado de pintarse en su hueco');
  assert.equal(parrafo[0].textContent, NINGUNA_LINEA);
  assert.equal(dichos(c).length, 0, 'y no sale además arriba');
});

test('SCRUM-1493 · CONTROL: un guardado que sale bien repinta el parte desde el servidor, sin aviso', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  assert.equal(await anadir(c, srv, 'ok'), 1);

  assert.equal(srv.leer().lineas.length, 4, '🔴 SUELO: las líneas no han entrado');
  assert.equal(filas(c).length, 0, '🔴 el guardado salió bien y la propuesta sigue en pantalla: se añadiría otra vez');
  assert.equal(dichos(c).length, 0);
  assert.ok(con(c, 'data-dictado-ordenar').length === 1, 'la ficha sigue editable');
});
