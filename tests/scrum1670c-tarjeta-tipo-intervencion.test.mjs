// tests/scrum1670c-tarjeta-tipo-intervencion.test.mjs — SCRUM-1670c
//
// LA TARJETA DE LA LISTA DE TRABAJOS DICE QUÉ CLASE DE TRABAJO ES (EL TIPO DE INTERVENCIÓN).
//
// El alta de un trabajo pide «Tipo de intervención», el servidor lo guarda y desde SCRUM-1670 lo
// devuelve en la lista (`jobs.routes.ts`, `serializeJob`). La tarjeta no lo pintaba: medido en
// yaqu.app el 18-nov-2026 con el trabajo QA #86, creado como «Reparación / Asistencia técnica».
//
// LA FORMA (decisión del orquestador por delegación, SCRUM-1670 c.22036): SOLO el valor, sin
// «Tipo de intervención» delante, en un renglón propio entre el cliente y la tarea.
//
// QUÉ ATA ESTE FICHERO:
//   · con un tipo del vocabulario → la tarjeta pinta SU RÓTULO, el que da el servidor, una vez;
//   · va entre el cliente y la tarea (quién · qué clase · qué hay que hacer · dónde);
//   · sin tipo (`null`, ausente, vacío) → no nace renglón;
//   · un valor que el vocabulario NO conoce → no nace renglón, y el código crudo no se ve;
//   · el vocabulario es el del SERVIDOR: si mañana cambia un rótulo allí, la tarjeta dice el nuevo
//     (no hay lista escrita en el navegador). Sin vocabulario cargado, tampoco se inventa nada.
//
// QUÉ NO MIDE: el aspecto (gris, cuerpo, recorte): es CSS, y lo dan las capturas del registro a 390
// y 1280. Ni la ficha del trabajo, que es de otro carril (SCRUM-1670b).
//
// POBLACIÓN: los valores del vocabulario REAL (`tiposIntervencionParaUI()`, de `dist/`), más 5
// casos de borde, sobre el banco de vistas (`_banco-vistas.mjs`), que ejecuta los scripts REALES
// del panel. SUELO en cada montaje: si la tarjeta no monta, cae diciendo CIEGO; y si el vocabulario
// llega vacío, el primer test cae antes de dar nada por bueno.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { tiposIntervencionParaUI } = await import('../dist/modules/jobs/domain/tipoIntervencion.js');
const VOCABULARIO = tiposIntervencionParaUI();

const clases = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
const tiene = (n, c) => clases(n).includes(c);
const texto = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();

const TAREA = 'Revisar la presión de la caldera';

/** Monta la lista con UN trabajo y el vocabulario que se le pase (por defecto, el del servidor). */
async function tarjeta(cambios, vocabulario = VOCABULARIO) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const datos = (url, opts) => {
    const p = new URL(String(url), 'https://yaqu.app').pathname;
    if (p === '/admin/jobs' && (!opts || !opts.method || opts.method === 'GET')) {
      const base = dc.datos('/admin/jobs')[0];
      return [{ ...structuredClone(base), id: 101, status: 'agendado', tituloPropio: null, queHayQueHacer: TAREA, direccion: 'Calle Mayor 14', tipoIntervencion: null, ...cambios }];
    }
    return dc.datos(url, opts);
  };
  const banco = cargarDashboard(RAIZ, { datos });
  if (vocabulario === null) delete banco.ctx.appTiposIntervencion; // null = el panel aún no ha cargado /admin/me
  else banco.ctx.appTiposIntervencion = vocabulario;
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 SUELO: la lista no monta (${r.error && r.error.message})`);
  const celdas = todos(r.contenedor).filter((n) => n.tagName === 'TD' && tiene(n, 'cell-client'));
  assert.equal(celdas.length, 1, `🔴 CIEGO: se esperaba UNA tarjeta y la lista pinta ${celdas.length}`);
  const de = (clase) => todos(celdas[0]).filter((n) => tiene(n, clase));
  return { celda: celdas[0], de };
}

test('SCRUM-1670c · SUELO: el vocabulario del servidor trae tipos con valor y rótulo', () => {
  assert.ok(VOCABULARIO.length >= 2, `🔴 CIEGO: el vocabulario trae ${VOCABULARIO.length} tipos; con menos de dos no se distingue «pinta el suyo» de «pinta siempre lo mismo»`);
  for (const t of VOCABULARIO) {
    assert.ok(t.valor && t.rotulo && t.valor !== t.rotulo, `🔴 CIEGO: tipo sin valor o sin rótulo propio: ${JSON.stringify(t)}`);
  }
  console.log(`scrum1670c · población: ${VOCABULARIO.length} tipos del vocabulario (${VOCABULARIO.map((t) => t.valor).join(', ')}) + 5 casos de borde`);
});

test('SCRUM-1670c · con un tipo del vocabulario, la tarjeta dice SU rótulo, una vez y sin rótulo delante', async () => {
  for (const t of VOCABULARIO) {
    const { celda, de } = await tarjeta({ tipoIntervencion: t.valor });
    const [tipo, ...mas] = de('jobs-fila-tipo');
    assert.ok(tipo, `🔴 la tarjeta de un trabajo ${t.valor} no dice qué clase de trabajo es: sólo «${texto(celda)}»`);
    assert.equal(mas.length, 0, `🔴 el tipo ${t.valor} sale más de una vez`);
    assert.equal(texto(tipo), t.rotulo, `🔴 el renglón no dice el rótulo del servidor, ni sólo el rótulo`);
    assert.ok(!texto(celda).includes(t.valor), `🔴 el código crudo «${t.valor}» se ve en la tarjeta: «${texto(celda)}»`);
  }
});

test('SCRUM-1670c · el tipo va entre el cliente y la tarea', async () => {
  const { celda } = await tarjeta({ tipoIntervencion: VOCABULARIO[0].valor });
  const orden = todos(celda)
    .filter((n) => ['jobs-fila-cliente', 'jobs-fila-tipo', 'jobs-fila-tarea', 'jobs-fila-direccion'].some((c) => tiene(n, c)))
    .map((n) => clases(n)[0]);
  assert.deepEqual(orden, ['jobs-fila-cliente', 'jobs-fila-tipo', 'jobs-fila-tarea', 'jobs-fila-direccion']);
});

test('SCRUM-1670c · sin tipo no nace ningún renglón', async () => {
  for (const vacio of [{ tipoIntervencion: null }, { tipoIntervencion: undefined }, { tipoIntervencion: '' }]) {
    const { de, celda } = await tarjeta(vacio);
    assert.equal(de('jobs-fila-tipo').length, 0, `🔴 renglón de tipo con ${JSON.stringify(vacio)}: «${texto(celda)}»`);
    // Control: la tarjeta sí se pintó entera (si no, el cero de arriba sería cierto por vacío).
    assert.equal(de('jobs-fila-tarea').length, 1, '🔴 CIEGO: la tarjeta no pinta ni la tarea');
  }
});

test('SCRUM-1670c · un valor que el vocabulario no conoce no se pinta, ni crudo', async () => {
  // CONTROL POSITIVO de la negación de abajo: si ese mismo valor SÍ estuviera en el vocabulario, con ese
  // mismo texto por rótulo, la tarjeta lo pintaría y este instrumento lo vería. Sin esto, «no se ve» sería
  // cierto también con un instrumento que no lee la celda (SCRUM-237).
  const control = await tarjeta({ tipoIntervencion: 'TIPO_QUE_NO_EXISTE' }, [{ valor: 'TIPO_QUE_NO_EXISTE', rotulo: 'TIPO_QUE_NO_EXISTE' }]);
  assert.ok(texto(control.celda).includes('TIPO_QUE_NO_EXISTE'), `🔴 CIEGO: con el valor en el vocabulario la tarjeta no lo pinta o el instrumento no lo lee: «${texto(control.celda)}»`);
  const { de, celda } = await tarjeta({ tipoIntervencion: 'TIPO_QUE_NO_EXISTE' });
  assert.equal(de('jobs-fila-tipo').length, 0, `🔴 se pinta un tipo desconocido: «${texto(celda)}»`);
  assert.ok(!texto(celda).includes('TIPO_QUE_NO_EXISTE'), `🔴 el valor crudo se ve en la tarjeta: «${texto(celda)}»`);
  assert.equal(de('jobs-fila-tarea').length, 1, '🔴 CIEGO: la tarjeta no pinta ni la tarea');
});

test('SCRUM-1670c · el rótulo es el del SERVIDOR: si cambia allí, cambia en la tarjeta; sin vocabulario, nada', async () => {
  const valor = VOCABULARIO[0].valor;
  // Otro rótulo para el mismo valor: si la tarjeta llevara su propia lista, seguiría diciendo el de siempre.
  const otro = await tarjeta({ tipoIntervencion: valor }, [{ valor, rotulo: 'Rótulo que sólo existe en este test' }]);
  const [pintado] = otro.de('jobs-fila-tipo');
  assert.ok(pintado, `🔴 con el vocabulario cambiado la tarjeta no pinta el tipo: «${texto(otro.celda)}»`);
  assert.equal(texto(pintado), 'Rótulo que sólo existe en este test', '🔴 la tarjeta no lee el rótulo del vocabulario que le da el servidor');
  for (const sin of [[], null]) {
    const { de, celda } = await tarjeta({ tipoIntervencion: valor }, sin);
    assert.equal(de('jobs-fila-tipo').length, 0, `🔴 sin vocabulario (${JSON.stringify(sin)}) la tarjeta pinta un tipo: «${texto(celda)}»`);
    assert.ok(!texto(celda).includes(VOCABULARIO[0].rotulo), '🔴 hay una lista de rótulos escrita en el navegador');
  }
});
