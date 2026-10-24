// tests/scrum1238b-clase-de-sesion.test.mjs — SCRUM-1238b
//
// `scripts/clase-de-sesion.mjs`: qué es de verdad una sesión de fondo, cruzando la lista de procesos
// (`claude agents --json`) con su `state.json`. Sin red y sin tocar sesiones: los state.json se
// FABRICAN aquí, uno por clase, en una carpeta temporal. Los positivos se siembran, no se toman
// prestados de `~/.claude/jobs` (un positivo prestado se jubila el día que la máquina cambia), y se
// comprueba que quitando cualquiera de ellos el censo de clases dice CIEGO, no verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CLASES, ESTADOS_DE_FIN, claseDeSesion, desdeStateJson, procesoDe, avisoDe, clasificarTrabajos,
} from '../scripts/clase-de-sesion.mjs';
import { ESTADOS_TERMINALES } from '../scripts/equipo/sesion.mjs';

const T0 = '2026-10-24T08:00:00.000Z';
const AHORA = Date.parse('2026-10-24T10:00:00.000Z');
const job = (o) => ({ updatedAt: T0, createdAt: T0, tempo: 'idle', ...o });

// Un state.json fabricado por clase, con la forma de los casos medidos que nombra el registro.
const SIEMBRA = {
  // con proceso, trabajando
  a1000001: { esperada: 'VIVA-TRABAJANDO', pid: 101, raw: job({ name: 'sembrada-trabajando', state: 'working', tempo: 'active' }) },
  // con proceso, parada en el arranque (la forma de `aa4c32ac` de SCRUM-1238 y de jv-j1bh el 24-oct)
  a1000002: { esperada: 'VIVA-BLOQUEADA', pid: 102, raw: job({ name: 'sembrada-arranque', state: 'working', tempo: 'blocked', needs: 'open this session to continue setup' }) },
  // sin proceso, terminó su turno preguntando (la forma de la J2 `4d9f556d` del 28-sep)
  a1000003: { esperada: 'TERMINADA-ESPERANDO', pid: 0, raw: job({ name: 'sembrada-4d9f556d', state: 'blocked', firstTerminalAt: '2026-09-28T13:50:10.174Z', needs: '1) approve generic error message on dropped connection; 2) decide if six other routes get a ticket' }) },
  // sin proceso, turno acabado sin pregunta
  a1000004: { esperada: 'TERMINADA', pid: 0, raw: job({ name: 'sembrada-done', state: 'done', firstTerminalAt: T0, lastTerminalAt: T0 }) },
  // sin proceso, «blocked» con pregunta y SIN ningún turno terminado: la de jv-j1bb/jv-j6bg tras el reinicio del 24-oct
  a1000005: { esperada: 'MUERTA-SIN-PROCESO', pid: 0, raw: job({ name: 'sembrada-reinicio', state: 'blocked', tempo: 'blocked', needs: 'approve Update: src/x.ts' }) },
  // state.json ilegible
  a1000006: { esperada: 'NO-PUDE-MIRAR', pid: 106, texto: '{ esto no es json' },
};

function sembrar(siembra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1238b-'));
  // `anadir` escribe en la carpeta de ESTA función: así el censo de SCRUM-824 ve de dónde cuelga.
  const anadir = (id, texto) => {
    fs.mkdirSync(path.join(dir, id));
    fs.writeFileSync(path.join(dir, id, 'state.json'), texto);
  };
  for (const [id, f] of Object.entries(siembra)) anadir(id, f.texto ?? JSON.stringify(f.raw));
  // Una entrada sin pid: la lista también trae así a las que no tienen proceso.
  const agentes = Object.entries(siembra).map(([id, f]) => (f.pid > 0 ? { id, pid: f.pid, kind: 'background' } : { id, kind: 'background' }));
  return { dir, agentes, anadir };
}
const borrar = (dir) => fs.rmSync(dir, { recursive: true, force: true });

/** El censo de clases: qué clase de CLASES no tiene ningún positivo en `filas`. */
const faltan = (filas) => CLASES.filter((k) => !filas.some((f) => f.clase === k));

test('SCRUM-1238b · SIEMBRA: un state.json fabricado de cada clase sale con su clase, y el censo cubre las seis', () => {
  const { dir, agentes } = sembrar(SIEMBRA);
  try {
    const filas = clasificarTrabajos({ dir, agentes, ahora: AHORA });
    assert.equal(filas.length, Object.keys(SIEMBRA).length, `población: ${filas.length} trabajos leídos de ${Object.keys(SIEMBRA).length} sembrados`);
    for (const f of filas) assert.equal(f.clase, SIEMBRA[f.id].esperada, `${f.id} (${f.nombre}): ${f.motivo} · ${f.fuente}`);
    assert.deepEqual(faltan(filas), [], 'ninguna clase sin positivo');
    assert.equal(CLASES.length, 6);
  } finally { borrar(dir); }
});

test('SCRUM-1238b · quitar CUALQUIER positivo sembrado deja su clase sin positivo: el censo dice CIEGO, no verde', () => {
  for (const id of Object.keys(SIEMBRA)) {
    const resto = Object.fromEntries(Object.entries(SIEMBRA).filter(([k]) => k !== id));
    const { dir, agentes } = sembrar(resto);
    try {
      const filas = clasificarTrabajos({ dir, agentes, ahora: AHORA });
      assert.deepEqual(faltan(filas), [SIEMBRA[id].esperada], `sin ${id} falta exactamente ${SIEMBRA[id].esperada}`);
    } finally { borrar(dir); }
  }
});

test('SCRUM-1238b · la J2 del 28-sep (sin pid, turno terminado, con needs) NO es muerta: el vigía dice «te está esperando»', () => {
  const s = desdeStateJson(SIEMBRA.a1000003.raw);
  const c = claseDeSesion(s, 0);
  assert.equal(c.clase, 'TERMINADA-ESPERANDO');
  const linea = avisoDe('jv-j2', '4d9f556d', c);
  assert.match(linea, /te está esperando: 1\) approve generic error message/);
  assert.doesNotMatch(linea, /MUERTA|SIN PROCESO/);
  // La misma forma con `done` (que también escribe un fin de turno) sigue esperando si trae pregunta.
  assert.equal(claseDeSesion({ ...s, estado: 'done' }, 0).clase, 'TERMINADA-ESPERANDO');
});

test('SCRUM-1238b · «blocked» sin proceso tras un reinicio NO es «BLOQUEADA»: sale SIN PROCESO y con su pregunta', () => {
  const c = claseDeSesion(desdeStateJson(SIEMBRA.a1000005.raw), 0);
  assert.equal(c.clase, 'MUERTA-SIN-PROCESO');
  const linea = avisoDe('jv-j1bb', 'bc31d8e5', c);
  assert.match(linea, /SIN PROCESO/);
  assert.match(linea, /approve Update: src\/x\.ts/);
  assert.doesNotMatch(linea, /BLOQUEADA/);
  // Con proceso, la misma forma sí es una bloqueada que se puede contestar.
  assert.equal(claseDeSesion(desdeStateJson(SIEMBRA.a1000005.raw), 4242).clase, 'VIVA-BLOQUEADA');
});

test('SCRUM-1238b · MUERTA sólo con un final de verdad o sin proceso a mitad de turno; `done` no es final', () => {
  assert.deepEqual([...ESTADOS_DE_FIN].sort(), ESTADOS_TERMINALES.filter((e) => e !== 'done').sort(),
    'los finales son los terminales de sesion.mjs menos `done`');
  for (const estado of ESTADOS_DE_FIN) {
    const c = claseDeSesion({ estado, needs: 'una pregunta que se quedó', primerFin: T0 }, 0);
    assert.equal(c.clase, 'MUERTA-SIN-PROCESO', estado);
    assert.match(avisoDe('x', 'y', c), /su pregunta era: una pregunta que se quedó/);
  }
  assert.equal(claseDeSesion({ estado: 'done', primerFin: T0 }, 0).clase, 'TERMINADA');
  assert.equal(claseDeSesion({ estado: 'working', primerFin: T0 }, 0).clase, 'MUERTA-SIN-PROCESO');
  assert.equal(avisoDe('x', 'y', claseDeSesion({ estado: 'stopped', primerFin: T0 }, 0)), null, 'una muerta sin pregunta no avisa');
});

test('SCRUM-1238b · sin lista de procesos no hay veredicto: todo NO-PUDE-MIRAR, ninguna MUERTA', () => {
  const { dir } = sembrar(SIEMBRA);
  try {
    for (const agentes of [null, undefined, () => null, { no: 'es una lista' }]) {
      const filas = clasificarTrabajos({ dir, agentes, ahora: AHORA });
      assert.equal(filas.length, Object.keys(SIEMBRA).length);
      assert.deepEqual([...new Set(filas.map((f) => f.clase))], ['NO-PUDE-MIRAR'], String(agentes));
    }
  } finally { borrar(dir); }
  assert.equal(procesoDe(null, 'a1000001'), null);
  assert.equal(procesoDe([], 'a1000001'), 0, 'lista leída y vacía: sin proceso, no «no pude mirar»');
  assert.equal(procesoDe([{ id: 'a1000001', pid: 7 }, { id: 'a1000001' }], 'a1000001'), 7, 'basta una entrada con pid');
});

test('SCRUM-1238b · la lista de procesos se lee DESPUÉS de los state.json (una sesión lanzada entre medias no sale muerta)', () => {
  const { dir, agentes, anadir } = sembrar(SIEMBRA);
  try {
    let llamadas = 0;
    const filas = clasificarTrabajos({
      dir, ahora: AHORA,
      agentes: () => {
        llamadas++;
        // Se lanza una sesión justo ahora: su state.json aparece cuando los demás ya se leyeron.
        anadir('a1000099', JSON.stringify(job({ name: 'recien-lanzada', state: 'working', tempo: 'active' })));
        return agentes;
      },
    });
    assert.equal(llamadas, 1);
    assert.equal(filas.some((f) => f.id === 'a1000099'), false, 'no se juzga un state.json que no estaba al leer la carpeta');
    assert.equal(filas.length, Object.keys(SIEMBRA).length);
  } finally { borrar(dir); }
});

test('SCRUM-1238b · cada veredicto dice de qué fuentes sale, y la población por horas filtra por `updatedAt`', () => {
  const { dir, agentes } = sembrar(SIEMBRA);
  try {
    for (const f of clasificarTrabajos({ dir, agentes, ahora: AHORA })) {
      if (f.clase === 'NO-PUDE-MIRAR') continue;
      assert.match(f.fuente, /claude agents: (pid \d+|sin proceso)/, f.id);
      assert.match(f.fuente, /state\.json: state=/, f.id);
    }
    assert.equal(clasificarTrabajos({ dir, agentes, ahora: AHORA + 30 * 36e5, horas: 24 })
      .filter((f) => f.id !== 'a1000006').length, 0, 'a 30 h, los legibles salen de la ventana');
  } finally { borrar(dir); }
  assert.equal(clasificarTrabajos({ dir: path.join(os.tmpdir(), 'scrum1238b-no-existe-jamas'), agentes: [] }), undefined);
});
