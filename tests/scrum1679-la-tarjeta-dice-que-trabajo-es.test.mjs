// tests/scrum1679-la-tarjeta-dice-que-trabajo-es.test.mjs — SCRUM-1679
//
// LA TARJETA DE LA LISTA DE TRABAJOS DICE QUÉ TRABAJO ES Y DÓNDE, Y «ABRIR TRABAJO» ABRE LA FICHA.
//
// Hasta SCRUM-1679 la tarjeta pintaba el CLIENTE, el nombre propio del trabajo si lo tenía y los
// técnicos. Un trabajo sin nombre propio —lo normal: el alta pide «Qué hay que hacer», no un
// nombre— salía sólo con el cliente: dos trabajos del mismo cliente eran dos tarjetas iguales. El
// servidor ya manda en la lista `queHayQueHacer` y `direccion` (`jobs.routes.ts`, `serializeJob`).
//
// Y al crear un trabajo desde la lista («Nuevo trabajo» → «Abrir trabajo»), la lista se repintaba y
// se quedaba en `#jobs`: el botón dice «Abrir trabajo» y no lo abría.
//
// QUÉ ATA ESTE FICHERO:
//   · sin nombre propio y con tarea → la tarjeta pinta la tarea (`.jobs-fila-tarea`);
//   · con nombre propio → manda el nombre propio, como desde SCRUM-917c, y la tarea NO se repite;
//   · con dirección → la tarjeta la pinta (`.jobs-fila-direccion`);
//   · sin tarea ni dirección → no nace ningún renglón vacío;
//   · lo que escribió el profesional se pinta como TEXTO, nunca como marcado;
//   · «Abrir trabajo» con un trabajo creado → navega a su ficha; sin él → repinta la lista.
//
// QUÉ NO MIDE: el aspecto ni el recorte a dos líneas (CSS; lo dan las capturas del registro a 390
// y 1280), ni el modal de «Nuevo trabajo» por dentro (carril S2: aquí se sustituye por un doble
// que sólo guarda lo que la lista le pasa).
//
// POBLACIÓN: 6 casos sobre el banco de vistas (`_banco-vistas.mjs`), que ejecuta los scripts
// REALES del panel. Cada uno tiene su SUELO: si la tarjeta no monta, cae diciendo CIEGO.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const clases = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
const tiene = (n, c) => clases(n).includes(c);
const texto = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();

const TAREA = 'Cambiar los dos latiguillos del lavabo y revisar el sifón';
const DIRECCION = 'Calle Mayor 14, 3º B, 28801 Alcalá de Henares';

/** Monta la lista con UN trabajo (el de muestra del censo, con lo que diga `cambios`). */
async function lista(cambios, { modal = null } = {}) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const navegado = [];
  let pedidas = 0;
  const datos = (url, opts) => {
    const p = new URL(String(url), 'https://yaqu.app').pathname;
    if (p === '/admin/jobs' && (!opts || !opts.method || opts.method === 'GET')) {
      pedidas++;
      const base = dc.datos('/admin/jobs')[0];
      return [{ ...structuredClone(base), id: 101, status: 'agendado', tituloPropio: null, queHayQueHacer: null, direccion: null, ...cambios }];
    }
    return dc.datos(url, opts);
  };
  const banco = cargarDashboard(RAIZ, { datos });
  banco.ctx.renderAppView = (vista, o) => { navegado.push([vista, JSON.parse(JSON.stringify(o || null))]); };
  if (modal) banco.ctx.abrirModalTrabajoNuevo = modal;
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 SUELO: la lista no monta (${r.error && r.error.message})`);
  const celdas = todos(r.contenedor).filter((n) => n.tagName === 'TD' && tiene(n, 'cell-client'));
  assert.equal(celdas.length, 1, `🔴 CIEGO: se esperaba UNA tarjeta y la lista pinta ${celdas.length}`);
  const de = (clase) => todos(celdas[0]).filter((n) => tiene(n, clase));
  return { banco, r, celda: celdas[0], de, navegado, pedidas: () => pedidas };
}

test('SCRUM-1679 · sin nombre propio y con tarea, la tarjeta dice la TAREA', async () => {
  const { celda, de } = await lista({ queHayQueHacer: TAREA });
  const [tarea, ...mas] = de('jobs-fila-tarea');
  assert.ok(tarea, `🔴 la tarjeta no dice qué trabajo es: sólo «${texto(celda)}»`);
  assert.equal(mas.length, 0, '🔴 la tarea sale más de una vez');
  assert.equal(texto(tarea), TAREA);
});

test('SCRUM-1679 · con nombre propio manda el nombre propio, y la tarea no se repite debajo', async () => {
  const { celda, de } = await lista({ tituloPropio: 'Reforma del baño', queHayQueHacer: TAREA });
  const [linea] = de('jobs-fila-linea');
  assert.ok(linea && texto(linea).startsWith('Reforma del baño'), `🔴 el nombre propio deja de encabezar su línea (SCRUM-917c): «${linea && texto(linea)}»`);
  assert.equal(de('jobs-fila-tarea').length, 0, `🔴 con nombre propio la tarea también se pinta: «${texto(celda)}»`);
});

test('SCRUM-1679 · con dirección, la tarjeta dice DÓNDE', async () => {
  const { celda, de } = await lista({ queHayQueHacer: TAREA, direccion: DIRECCION });
  const [dir, ...mas] = de('jobs-fila-direccion');
  assert.ok(dir, `🔴 la tarjeta no dice dónde es el trabajo: «${texto(celda)}»`);
  assert.equal(mas.length, 0, '🔴 la dirección sale más de una vez');
  assert.equal(texto(dir), DIRECCION);
  // El orden que se lee: quién, qué, dónde.
  const orden = todos(celda).filter((n) => tiene(n, 'jobs-fila-cliente') || tiene(n, 'jobs-fila-tarea') || tiene(n, 'jobs-fila-direccion')).map((n) => clases(n)[0]);
  assert.deepEqual(orden, ['jobs-fila-cliente', 'jobs-fila-tarea', 'jobs-fila-direccion']);
});

test('SCRUM-1679 · sin tarea ni dirección no nace ningún renglón vacío', async () => {
  for (const vacio of [{}, { queHayQueHacer: '', direccion: '' }, { queHayQueHacer: '   ', direccion: '  ' }]) {
    const { de } = await lista(vacio);
    assert.equal(de('jobs-fila-tarea').length, 0, `🔴 renglón de tarea vacío con ${JSON.stringify(vacio)}`);
    assert.equal(de('jobs-fila-direccion').length, 0, `🔴 renglón de dirección vacío con ${JSON.stringify(vacio)}`);
  }
});

test('SCRUM-1679 · lo que escribió el profesional se pinta como TEXTO, no como marcado', async () => {
  const conMarcas = 'Cambiar el <b>termo</b> & revisar';
  const { de } = await lista({ queHayQueHacer: conMarcas, direccion: 'Calle <i>Ancha</i> 3' });
  const [tarea] = de('jobs-fila-tarea');
  const [dir] = de('jobs-fila-direccion');
  assert.ok(tarea && dir, '🔴 CIEGO: no hay renglones que mirar');
  assert.equal(texto(tarea), conMarcas);
  assert.equal(texto(dir), 'Calle <i>Ancha</i> 3');
  assert.equal(todos(tarea).length, 1, '🔴 la tarea ha creado nodos hijos: se está interpretando como marcado');
  assert.equal(todos(dir).length, 1, '🔴 la dirección ha creado nodos hijos: se está interpretando como marcado');
});

test('SCRUM-1679 · «Abrir trabajo»: con el trabajo creado se abre SU FICHA; sin él, se repinta la lista', async () => {
  let alCrear = null;
  let abiertos = 0;
  const { r, navegado, pedidas } = await lista({ queHayQueHacer: TAREA }, { modal: (f) => { abiertos++; alCrear = f; } });
  const nuevo = todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && n.id === 'jobs-nuevo-btn');
  assert.ok(nuevo, '🔴 CIEGO: la lista no pinta «Nuevo trabajo»');
  nuevo.click();
  assert.equal(abiertos, 1, '🔴 CIEGO: «Nuevo trabajo» no ha abierto el modal');
  assert.equal(typeof alCrear, 'function', '🔴 CIEGO: la lista no le pasa al modal qué hacer al crear');

  alCrear({ id: 555 });
  assert.deepEqual(navegado, [['jobs-detail', { jobId: 555 }]], `🔴 tras crear el trabajo 555 no se abre su ficha: ${JSON.stringify(navegado)}`);

  // Sin trabajo (un modal que no lo entregue) no se navega a ninguna parte: la lista se repinta.
  const antes = pedidas();
  alCrear();
  await new Promise((ok) => setTimeout(ok, 30));
  assert.equal(navegado.length, 1, `🔴 sin trabajo creado se ha navegado igualmente: ${JSON.stringify(navegado)}`);
  assert.ok(pedidas() > antes, '🔴 sin trabajo creado la lista no se repinta');
});
