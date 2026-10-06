// SCRUM-1302 (C) · «ORDENAR EN LÍNEAS» QUE FALLA: SE DICE, Y NO BORRA LA PROPUESTA QUE YA HAY.
//
// El defecto, ejecutado en yaqu.app el 6-oct-2026 (c.18486, 18 filas): si la ruta del dictado no
// contesta (sin red, 500, 502) el párrafo del aviso existe con texto «» y alto 0, y si en pantalla
// había una propuesta —con lo que el técnico corrigió a mano— DESAPARECE entera sin una palabra.
//
// Firmado en SCRUM-1302 c.18491 (6-oct-2026), las tres cosas juntas:
//   · el literal, que aquí se compara letra a letra;
//   · conducta 1: un intento que falla NO toca la propuesta que ya hay;
//   · conducta 2: 409 y 404 releen el parte, SIN texto nuevo.
//
// Monta la vista de verdad en el banco y sirve por `fetch`, así que el error que decide la vista es
// el que fabrica el `apiRequest` de verdad (`status`, `sinRed`), no uno escrito aquí a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMADO_EN_18491 = 'No se ha podido ordenar el dictado — vuelve a intentarlo o escribe las líneas tú';
const NINGUNA_LINEA = 'No se ha podido sacar ninguna línea — escríbelas tú';
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
  dictado_vacio: 'No se ha entendido el dictado — vuelve a dictar o escríbelo a mano',
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
const VACIA = Object.freeze({
  propuesta: { vacia: true, motivo: 'sin_lineas_reconocidas', mano_obra: [], materiales: [], sinBloque: [] },
  avisos: AVISOS,
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const con = (c, a) => todos(c).filter((x) => attr(x, a) != null);
const avisosC = (c) => con(c, 'data-dictado-no-ordenado');
const filas = (c) => con(c, 'data-propuesta');
const descripciones = (c) => con(c, 'data-propuesta-desc').map((x) => x.value);
const pausa = () => new Promise((r) => setTimeout(r, 8));
const copia = (x) => JSON.parse(JSON.stringify(x));

/**
 * Un servidor por `fetch`. `dictado` dice qué contesta la ruta del dictado en el siguiente intento:
 * 'propuesta' | 'vacia' | 'sin-red' | un código HTTP. El 409 firma el parte de verdad —es lo que
 * ese código significa—, así que la relectura lo trae firmado; `lecturaDa` fuerza el GET.
 */
function servidor() {
  let parte = copia(BASE);
  const estado = { dictado: 'propuesta', lecturaDa: 200, pedidas: [] };
  const responder = (status, data) => ({
    ok: status < 400, status, statusText: 'x',
    headers: { get: () => 'application/json' },
    json: async () => { if (data === undefined) throw new SyntaxError('Unexpected token <'); return copia(data); },
    blob: async () => ({}), text: async () => '',
  });
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    estado.pedidas.push({ metodo, url: String(url), body: opts.body ? JSON.parse(opts.body) : undefined });
    if (metodo === 'POST' && /\/dictado$/.test(String(url))) {
      const que = estado.dictado;
      if (que === 'sin-red') throw new TypeError('Failed to fetch');
      if (que === 'propuesta') return responder(200, PROPUESTA);
      if (que === 'vacia') return responder(200, VACIA);
      if (que === 502) return responder(502, undefined);
      if (que === 409) {
        parte = { ...parte, estado: 'firmado', firmadoAt: '2026-09-02T12:00:00.000Z', firmadoPorNombre: 'Ana',
          puedeEditarContenido: { ok: false, motivo: 'El parte ya está firmado.' } };
        return responder(409, { error: 'parte_locked', message: 'El parte ya está firmado.' });
      }
      if (que === 404) return responder(404, { error: 'not_found' });
      if (que === 403) return responder(403, { error: 'forbidden' });
      return responder(que, { error: 'internal_error' });
    }
    if (metodo === 'PATCH') { parte = { ...parte, ...JSON.parse(opts.body) }; return responder(200, parte); }
    if (estado.lecturaDa !== 200) return responder(estado.lecturaDa, { error: 'not_found' });
    return responder(200, parte);
  };
  const de = (metodo, patron) => estado.pedidas.filter((p) => p.metodo === metodo && patron.test(p.url));
  return { fetch, estado, de };
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
  // Sin `apiRequest` en las opciones: la vista pide por el de verdad, que es quien tipa el error.
  const ok = await b.ctx.renderParteDetailView(c, 7);
  assert.notEqual(ok, false, '🔴 SUELO: la vista del parte no se ha montado');
  assert.equal(con(c, 'data-dictado-ordenar').length, 1, '🔴 SUELO: el parte no se pintó editable, no hay botón de ordenar');
  return { c, traidos };
}

/** Escribe el dictado y pulsa «Ordenar en líneas», con la ruta contestando `que`. */
async function ordenar(c, srv, que) {
  srv.estado.dictado = que;
  const antes = srv.de('POST', /\/dictado$/).length;
  con(c, 'data-dictado-texto')[0].value = DICTADO;
  assert.ok(con(c, 'data-dictado-ordenar')[0].disparar('click') > 0, '🔴 SUELO: nadie escucha «Ordenar en líneas»');
  await pausa();
  assert.equal(srv.de('POST', /\/dictado$/).length, antes + 1, '🔴 SUELO: el dictado no llegó a mandarse');
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

test('SCRUM-1302c · 🔴 la ruta no contesta (500, sin red, 502): sale el texto firmado, bajo el botón y sobre el hueco de la propuesta', async () => {
  for (const que of [500, 'sin-red', 502]) {
    const srv = servidor();
    const { c } = await montar(srv);
    await ordenar(c, srv, que);

    const salen = avisosC(c);
    assert.equal(salen.length, 1, `🔴 [${que}] «Ordenar en líneas» ha fallado y la ficha no dice nada`);
    assert.equal(salen[0].textContent, FIRMADO_EN_18491, `[${que}] el texto no es el firmado, letra a letra`);
    assert.equal(attr(salen[0], 'role'), 'alert');
    const orden = todos(c);
    const boton = con(c, 'data-dictado-ordenar')[0];
    const hueco = con(c, 'data-dictado-propuesta')[0];
    assert.ok(orden.indexOf(boton) < orden.indexOf(salen[0]) && orden.indexOf(salen[0]) < orden.indexOf(hueco),
      `🔴 [${que}] el aviso no está entre el botón y el hueco de la propuesta`);
    assert.equal(con(c, 'data-dictado-texto')[0].value, DICTADO, `🔴 [${que}] el dictado escrito se ha perdido: «vuelve a intentarlo» sería mentira`);
    assert.equal(boton.disabled, false, `🔴 [${que}] el botón se queda apagado: no se puede volver a intentar`);
    assert.equal(con(c, 'data-propuesta-vacia').length, 0, `[${que}] no se pinta además el párrafo del «ninguna línea»`);
  }
});

test('SCRUM-1302c · 🔴 CONDUCTA 1: con una propuesta corregida a mano en pantalla, un intento que falla NO la toca', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 500);

  assert.equal(filas(c).length, 3, '🔴 un fallo de red ha borrado la propuesta que el técnico tenía en pantalla');
  assert.deepEqual(descripciones(c), ['Purga del circuito', CORREGIDA, 'Sirena interior'],
    '🔴 la corrección hecha a mano se ha perdido');
  assert.equal(con(c, 'data-propuesta-confirmar').length, 1, '🔴 la propuesta sigue pero ya no se puede añadir');
  assert.equal(avisosC(c).length, 1, '🔴 la propuesta se conserva pero el fallo no se dice');
  assert.equal(avisosC(c)[0].textContent, FIRMADO_EN_18491);
});

test('SCRUM-1302c · 🔴 tras un intento fallido, «Añadir al parte» guarda UNA vez, y lo corregido', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 500);
  await ordenar(c, srv, 'sin-red');
  assert.equal(avisosC(c).length, 1, '🔴 dos intentos fallidos dejan el aviso dos veces');

  const confirmar = con(c, 'data-propuesta-confirmar')[0];
  assert.equal(confirmar.disabled, false, '🔴 SUELO: «Añadir al parte» está apagado');
  assert.ok(confirmar.disparar('click') > 0, '🔴 SUELO: nadie escucha «Añadir al parte»');
  await pausa();
  const guardados = srv.de('PATCH', /\/admin\/partes\/7$/);
  assert.equal(guardados.length, 1,
    '🔴 cada intento fallido ata otra escucha al mismo botón: las líneas se guardan repetidas en un documento que se firma');
  assert.deepEqual(guardados[0].body.lineas.map((l) => l.descripcion),
    ['Revisión', 'Purga del circuito', CORREGIDA, 'Sirena interior']);
});

test('SCRUM-1302c · el aviso se quita cuando el siguiente intento sí contesta, y esa propuesta nueva sí sustituye', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  await ordenar(c, srv, 500);
  assert.equal(avisosC(c).length, 1, '🔴 SUELO: el aviso no llegó a salir');

  await ordenar(c, srv, 'propuesta');
  assert.equal(avisosC(c).length, 0, '🔴 el dictado ya se ha ordenado y la ficha sigue diciendo que no');
  assert.deepEqual(descripciones(c), ['Purga del circuito', 'Detector', 'Sirena interior'],
    'CONTROL: una respuesta buena sí pinta su propuesta (es lo que el técnico ha pedido)');
});

test('SCRUM-1302c · el aviso se trae a la vista: él, ya colgado y sin saltar si ya se ve', async () => {
  const srv = servidor();
  const { c, traidos } = await montar(srv);
  await ordenar(c, srv, 500);

  const aviso = avisosC(c)[0];
  const suyos = traidos.filter((t) => t.nodo === aviso);
  assert.equal(suyos.length, 1, '🔴 el aviso no se trae a la vista: con el botón al borde de la ventana cae fuera (SCRUM-1475)');
  assert.equal(suyos[0].colgado, true, '🔴 se pide traerlo antes de colgarlo: no hay nada que traer');
  assert.deepEqual({ ...suyos[0].opciones }, { block: 'nearest' });
});

test('SCRUM-1302c · 🔴 CONDUCTA 2: un 409 (firmado desde otro sitio) RELEE el parte, y no sale texto nuevo', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  const lecturas = srv.de('GET', /\/admin\/partes\/7$/).length;
  await ordenar(c, srv, 409);

  assert.equal(srv.de('GET', /\/admin\/partes\/7$/).length, lecturas + 1, '🔴 el parte no se ha releído');
  assert.equal(con(c, 'data-dictado-ordenar').length, 0, '🔴 la ficha sigue ofreciendo ordenar un parte que ya está firmado');
  assert.equal(con(c, 'data-parte-campo').length, 0, '🔴 la ficha releída sigue teniendo casillas: no ha salido firmada');
  assert.equal(avisosC(c).length, 0);
  assert.ok(!c.innerHTML.includes('vuelve a intentarlo'), '🔴 en un 409 «vuelve a intentarlo» es falso: no va a funcionar nunca');
  assert.equal(con(c, 'data-parte-error').length, 0, 'CONTROL: el parte se pudo releer, no sale el aviso de carga');
});

test('SCRUM-1302c · CONDUCTA 2: un 404 relee, y si tampoco se puede leer manda el aviso de carga ya aprobado', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  srv.estado.lecturaDa = 404;
  await ordenar(c, srv, 404);

  const error = con(c, 'data-parte-error');
  assert.equal(error.length, 1, '🔴 el parte ya no existe y la ficha sigue como si nada');
  assert.equal(error[0].textContent, 'No se ha podido cargar el parte. Vuelve a intentarlo.');
  assert.equal(avisosC(c).length, 0);
});

test('SCRUM-1302c · la firma no se estira: otro rechazo (403) no enseña el texto firmado, y tampoco toca la propuesta', async () => {
  const srv = servidor();
  const { c } = await conPropuestaCorregida(srv);
  const lecturas = srv.de('GET', /\/admin\/partes\/7$/).length;
  await ordenar(c, srv, 403);

  assert.equal(avisosC(c).length, 0, 'el literal está firmado para «no llega, 5xx, 502», no para un rechazo');
  assert.deepEqual(descripciones(c), ['Purga del circuito', CORREGIDA, 'Sirena interior'],
    '🔴 un rechazo ha borrado la propuesta que el técnico tenía en pantalla');
  assert.equal(srv.de('GET', /\/admin\/partes\/7$/).length, lecturas, 'releer está firmado para 409 y 404, no para éste');
});

test('SCRUM-1302c · CONTROL: la ruta SÍ contesta y no saca nada (200): manda su aviso, el del servidor, y no el nuevo', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await ordenar(c, srv, 'vacia');

  const vacia = con(c, 'data-propuesta-vacia');
  assert.equal(vacia.length, 1, '🔴 SUELO: el aviso del servidor no se ha pintado');
  assert.equal(vacia[0].textContent, NINGUNA_LINEA);
  assert.equal(avisosC(c).length, 0, '🔴 el servicio contestó: decir «no se ha podido ordenar» sería otro mensaje para el mismo hecho');
});
