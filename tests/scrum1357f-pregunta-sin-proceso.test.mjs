// SCRUM-1357f · PREGUNTA: una sesión muerta que conserva su pregunta NO es un puesto vacío.
//
// EL DEFECTO QUE ESTO CIERRA (17-oct-2026): `sesion-2` pasó a `blocked` a las 20:07:56Z pidiendo una
// firma, y su `needs` lo decía. Nadie la contestó hasta pararla a las 21:32:58Z: 85 minutos. El panel del
// orquestador pintaba «VACIO|S2|ninguna sesión suya con proceso|su puesto está SIN CUBRIR», igual que un
// puesto que se cubre cuando se pueda. `sala.mjs` ya traía la pregunta como BLOQUEADA «sin proceso», pero
// DEBAJO de un VACIO del mismo puesto que la contradecía. Ahora sale PRIMERO y con su propio rótulo, y se
// come el VACIO de su puesto.
//
// Los DOS sentidos, que es lo que pidió el orquestador: muerta CON `needs` → PREGUNTA; muerta SIN `needs`
// → VACIO, como siempre. Y la frontera con la viva: con proceso sigue siendo BLOQUEADA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { medir } from '../scripts/equipo/parados.mjs';
import { aLineas, SALIDA_HAY } from '../scripts/equipo/sala.mjs';

// Las mutaciones se corrieron a mano y están en `docs/master/SCRUM-1357.md` (1357f), como las de 1357d.
const AHORA = Date.parse('2026-10-17T21:31:00Z');
const hace = (min) => AHORA - min * 60_000;
const PUESTOS = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
const FIRMA = 'Ficha de gasto 1156c lista; falta tu firma en SCRUM-1156';

const reg = (id, nombre, estado, extra = {}) => ({
  id, nombre, estado, tempo: estado === 'working' ? 'active' : 'idle',
  detalle: '', needs: undefined, actualizado: hace(2), creado: hace(200), ...extra,
});
const enPanel = (id, name, state, extra = {}) => ({ id, name, kind: 'background', state, cwd: 'D:\\repo', ...extra });

/** Los cinco puestos que no son S2, vivos y trabajando. */
const OTROS = [['a0', 'sesion-0'], ['a1', 'sesion-1'], ['a3', 'sesion-3'], ['a4', 'sesion-4'], ['a5', 'sesion-5']];
const base = () => ({
  panel: OTROS.map(([id, n], i) => enPanel(id, n, 'working', { pid: 100 + i, status: 'busy' })),
  registro: { sesiones: OTROS.map(([id, n]) => reg(id, n, 'working')), ilegibles: [], sinEstado: [] },
});
const traducir = (e, ahora = AHORA) => aLineas(medir({ ...e, ahora, puestos: PUESTOS }).datos);

test('🔴 MUERTA CON PREGUNTA (bloqueada, el panel ya no la lista): sale PREGUNTA, y NO sale VACIO|S2', () => {
  const e = base();
  e.registro.sesiones.push(reg('7ffe11d9', 'sesion-2', 'blocked', { needs: FIRMA, actualizado: hace(83) }));
  const r = traducir(e);
  assert.deepEqual(r.lineas, [`PREGUNTA|S2|sesion-2|hace 83 min|sin proceso|«${FIRMA}»|su puesto está SIN CUBRIR`]);
  assert.equal(r.codigo, SALIDA_HAY);
});

test('🔴 LA PREGUNTA SOBREVIVE A LA SESIÓN: parada (`stopped`) con su `needs` dentro sigue siendo PREGUNTA', () => {
  const e = base();
  e.registro.sesiones.push(reg('7ffe11d9', 'sesion-2', 'stopped', { needs: FIRMA, actualizado: hace(30) }));
  assert.deepEqual(traducir(e).lineas, [`PREGUNTA|S2|sesion-2|hace 30 min|sin proceso|«${FIRMA}»|su puesto está SIN CUBRIR`]);
  // Y si el panel aún la lista, pero sin proceso, igual.
  const p = base();
  p.panel.push(enPanel('7ffe11d9', 'sesion-2', 'blocked'));
  p.registro.sesiones.push(reg('7ffe11d9', 'sesion-2', 'blocked', { needs: FIRMA, actualizado: hace(83) }));
  assert.match(traducir(p).lineas[0], /^PREGUNTA\|S2\|sesion-2\|hace 83 min\|sin proceso\|/);
});

test('✅ CONTROL: muerta SIN `needs` sigue saliendo VACIO, y sólo eso', () => {
  const e = base();
  e.registro.sesiones.push(reg('7ffe11d9', 'sesion-2', 'stopped', { actualizado: hace(30) }));
  const r = traducir(e);
  assert.deepEqual(r.lineas, ['VACIO|S2|ninguna sesión suya con proceso|su puesto está SIN CUBRIR']);
  assert.equal(r.codigo, SALIDA_HAY);
});

test('✅ FRONTERA: VIVA con pregunta sigue siendo BLOQUEADA con su pid, no PREGUNTA', () => {
  const e = base();
  e.panel.push(enPanel('b2', 'sesion-2', 'blocked', { pid: 4100 }));
  e.registro.sesiones.push(reg('b2', 'sesion-2', 'blocked', { needs: FIRMA, actualizado: hace(8) }));
  assert.deepEqual(traducir(e).lineas, [`BLOQUEADA|S2|sesion-2|hace 8 min|pid 4100|«${FIRMA}»`]);
});

test('con el puesto ya relanzado, la pregunta vieja sigue saliendo (nadie sabe si se contestó), sin «SIN CUBRIR»', () => {
  const e = base();
  e.registro.sesiones.push(reg('7ffe11d9', 'sesion-2', 'blocked', { needs: FIRMA, actualizado: hace(83) }));
  e.panel.push(enPanel('a6141a0f', 'sesion-2', 'working', { pid: 26628, status: 'busy' }));
  e.registro.sesiones.push(reg('a6141a0f', 'sesion-2', 'working'));
  assert.deepEqual(traducir(e).lineas, [`PREGUNTA|S2|sesion-2|hace 83 min|sin proceso|«${FIRMA}»`]);
});

test('la PREGUNTA va antes que los VACIO de otros puestos, y su huella no cambia de un repintado a otro', () => {
  const e = base();
  e.panel = e.panel.filter((a) => a.name !== 'sesion-4');
  e.registro.sesiones = e.registro.sesiones.filter((s) => s.nombre !== 'sesion-4');
  e.registro.sesiones.push(reg('7ffe11d9', 'sesion-2', 'blocked', { needs: FIRMA, actualizado: hace(83) }));
  const r = traducir(e);
  assert.equal(r.lineas.length, 2, r.lineas.join('\n'));
  assert.match(r.lineas[0], /^PREGUNTA\|S2\|/);
  assert.equal(r.lineas[1], 'VACIO|S4|ninguna sesión suya con proceso|su puesto está SIN CUBRIR');
  // El plugin decide si el aviso es nuevo por los tres primeros campos: tres minutos después, la misma.
  const huella = (l) => l.split('|').slice(0, 3).join('|');
  assert.equal(huella(traducir(e, AHORA + 3 * 60_000).lineas[0]), huella(r.lineas[0]));
});
