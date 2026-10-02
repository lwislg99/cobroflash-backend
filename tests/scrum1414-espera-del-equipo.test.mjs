// SCRUM-1414 · la medida de cuánto espera el equipo, y a quién.
// Todo con líneas de tiempo FABRICADAS: las de verdad viven en ~/.claude/jobs y no van al repositorio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  puestoDe, quienEs, queDice, leerLinea, leerDespertadores, tramosDe, despertadorDe, paradoDeLasJornadas, medir, leerTrabajos,
  HUECO_MIN, LARGA_MIN,
} from '../scripts/espera-del-equipo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'espera-del-equipo.mjs');
const T0 = Date.parse('2026-09-29T08:00:00Z');
const min = (n) => new Date(T0 + n * 60e3).toISOString();
const ev = (n, state, text = '') => JSON.stringify({ at: min(n), state, detail: '', text });
const linea = (...evs) => evs.join('\n');
const entrada = (n, kind, nombre) => JSON.stringify({
  type: 'user', timestamp: min(n), origin: { kind },
  message: { role: 'user', content: nombre ? `Another Claude session sent a message:\n<cross-session-message from="uds:x" from-name="${nombre}">hola` : 'hola' },
});
const AHORA = T0 + 24 * 3600e3;

test('SCRUM-1414 · el puesto sale del nombre de la sesión, y lo que no es un puesto no se inventa', () => {
  assert.deepEqual(['s0-2oct', 'sesion-3', 's4-29c', 'S5-1octc'].map(puestoDe), ['S0', 'S3', 'S4', 'S5']);
  assert.deepEqual(['orquestador', 'cobroflash-backend-57', 'sd-1', 's12-x', '', undefined].map(puestoDe), [null, null, null, null, null, null]);
});

test('SCRUM-1414 · quién despierta sale del ORIGEN de la entrada, no de lo que diga el texto', () => {
  assert.equal(quienEs({ kind: 'peer', nombre: 'cobroflash-backend-57' }), 'el orquestador');
  assert.equal(quienEs({ kind: 'peer', nombre: 'orquestador' }), 'el orquestador');
  assert.equal(quienEs({ kind: 'peer', nombre: 's2-29a' }), 'otra sesión del equipo');
  assert.equal(quienEs({ kind: 'peer', nombre: null }), 'otra sesión (sin nombre)');
  assert.equal(quienEs({ kind: 'human', nombre: null }), 'una persona');
  assert.equal(quienEs({ kind: 'task-notification', nombre: null }), 'aviso de una tarea propia');
  assert.equal(quienEs(null), 'sin dato');
  // Una persona que escribe la palabra «orquestador» sigue siendo una persona.
  const d = leerDespertadores(JSON.stringify({ type: 'user', timestamp: min(1), origin: { kind: 'human' }, message: { content: 'soy el orquestador' } }));
  assert.equal(quienEs(d[0]), 'una persona');
  // Y un resultado de herramienta no despierta a nadie.
  assert.equal(leerDespertadores(JSON.stringify({ type: 'user', timestamp: min(1), origin: { kind: 'human' }, toolUseResult: {}, message: {} })).length, 0);
});

test('SCRUM-1414 · 🔴 los tramos: cada instante cae en UNO, y `done` seguido de trabajo ES una espera', () => {
  const { eventos } = leerLinea(linea(ev(0, 'working'), ev(5, 'working'), ev(10, 'done', 'hecho'), ev(30, 'working'), ev(35, 'blocked', 'necesito un GO'), ev(40, 'done'), ev(50, 'working'), ev(55, 'done')));
  const t = tramosDe(eventos);
  assert.deepEqual(t.map((x) => [x.tipo, (x.desde - T0) / 60e3, x.hasta == null ? null : (x.hasta - T0) / 60e3]), [
    ['trabajo', 0, 5], ['trabajo', 5, 10], ['espera', 10, 30], ['trabajo', 30, 35], ['espera', 35, 50], ['trabajo', 50, 55], ['cola', 55, null],
  ]);
  assert.equal(t[4].estado, 'blocked', 'dos paradas seguidas son UNA espera, y manda la primera');
  assert.match(t[4].dice, /GO/);
  // Sin huecos ni solapes: la suma de los tramos cerrados es del primer al último evento.
  assert.equal(t.filter((x) => x.hasta).reduce((s, x) => s + x.hasta - x.desde, 0), 55 * 60e3);
});

test('SCRUM-1414 · 🔴 un hueco entre dos «working» no es trabajo ni espera: se cuenta aparte', () => {
  const { eventos } = leerLinea(linea(ev(0, 'working'), ev(HUECO_MIN + 1, 'working'), ev(HUECO_MIN + 2, 'working')));
  assert.deepEqual(tramosDe(eventos).map((x) => x.tipo), ['hueco', 'trabajo']);
  assert.deepEqual(tramosDe(leerLinea(linea(ev(0, 'working'), ev(HUECO_MIN, 'working'))).eventos).map((x) => x.tipo), ['trabajo'], 'justo en el umbral todavía es trabajo');
});

test('SCRUM-1414 · una línea ilegible, sin hora o con un estado desconocido se CUENTA, no se salta en silencio', () => {
  const r = leerLinea([ev(0, 'working'), '{roto', JSON.stringify({ at: 'ayer', state: 'working' }), JSON.stringify({ at: min(1), state: 'pensando' }), ev(2, 'done')].join('\n'));
  assert.equal(r.eventos.length, 2);
  assert.equal(r.ilegibles, 3);
});

test('SCRUM-1414 · quién despertó una espera: la última entrada que llegó MIENTRAS estaba parada', () => {
  const tramo = { desde: T0 + 10 * 60e3, hasta: T0 + 30 * 60e3 };
  const desp = leerDespertadores([entrada(2, 'human'), entrada(12, 'peer', 's2-29a'), entrada(29, 'peer', 'cobroflash-backend-57'), entrada(45, 'human')].join('\n'));
  assert.equal(despertadorDe(tramo, desp), 'el orquestador');
  assert.equal(despertadorDe({ desde: T0 + 60 * 60e3, hasta: T0 + 70 * 60e3 }, desp), 'sin dato', 'nadie escribió en ese tramo');
  assert.equal(despertadorDe(tramo, null), 'sin transcripción', 'sin transcripción no se supone a nadie');
});

test('SCRUM-1414 · lo que DIJO que esperaba es por palabras, y lo que no casa cae en «sin clasificar»', () => {
  assert.equal(queDice('se acabó el límite semanal'), 'cuota');
  assert.equal(queDice('el hook denegó la escritura'), 'permiso del sistema');
  assert.equal(queDice('empujado, CI sin veredicto'), 'veredicto de CI');
  assert.equal(queDice('falta la firma del fundador'), 'el fundador');
  assert.equal(queDice('awaiting decision'), 'decisión del orquestador');
  assert.equal(queDice('ok'), 'sin clasificar');
});

// Tres puestos: S1 espera 20 min al orquestador; S2 espera 10 min a una persona y 3 h (larga) al orquestador;
// S4 trabaja y se para sin volver (cola). Más un orquestador, que no es puesto, y un puesto sin línea.
const EQUIPO = [
  { id: 'a', nombre: 's1-29a', linea: linea(ev(0, 'working'), ev(10, 'working'), ev(20, 'blocked', 'CI sin veredicto'), ev(40, 'working'), ev(50, 'done')), transcripcion: entrada(39, 'peer', 'cobroflash-backend-57') },
  { id: 'b', nombre: 's2-29a', linea: linea(ev(0, 'working'), ev(10, 'done', 'zzz'), ev(20, 'working'), ev(30, 'done'), ev(210, 'working'), ev(220, 'working')), transcripcion: [entrada(19, 'human'), entrada(209, 'peer', 'orquestador')].join('\n') },
  { id: 'c', nombre: 's4-29a', linea: linea(ev(0, 'working'), ev(10, 'working'), ev(12, 'blocked', 'awaiting decision')), transcripcion: '' },
  { id: 'd', nombre: 'cobroflash-backend-57', linea: linea(ev(0, 'working'), ev(500, 'done')), transcripcion: '' },
  { id: 'e', nombre: 's5-29a', linea: null, transcripcion: null },
];

test('SCRUM-1414 · 🔴 la medida entera: población, la cifra, por quién, y lo que NO se pudo reconstruir', () => {
  const r = medir(EQUIPO, { ahora: AHORA });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 0);
  assert.match(t, /trabajos mirados: 5 · puestos del equipo con línea de tiempo en la ventana: 3/);
  assert.match(t, /1 no es un puesto/);
  assert.match(t, /1 puesto sin línea de tiempo/);
  const d = r.datos;
  assert.equal(d.suma.trabajo / 60e3, 20 + 10 + 10 + 10 + 10 + 12, 'S1 20+10 · S2 10+10+10 · S4 12');
  assert.equal(d.suma.corta / 60e3, 30, '20 de S1 y 10 de S2');
  assert.equal(d.suma.larga / 60e3, 180, 'la de tres horas va APARTE: no mide a quien contesta');
  assert.deepEqual([d.porQuien['el orquestador'].ms / 60e3, d.porQuien['una persona'].ms / 60e3], [20, 10]);
  assert.equal(d.porQuien['el orquestador'].n, 1, 'la espera larga que despertó el orquestador NO cuenta en su cifra');
  assert.deepEqual([d.porEstado.blocked.n, d.porEstado.done.n], [1, 1]);
  assert.equal(d.colas, 2, 'S1 acabó en done y S4 en blocked: ninguna de las dos volvió');
  assert.match(t, /de él, ESPERANDO: 0\.5 h = 29 % · en 2 esperas/);
  assert.match(t, /la despertó EL ORQUESTADOR: 0\.3 h = 67 % de la espera · 20 % del tiempo vivo/);
  assert.match(t, /sesiones que se pararon y NUNCA volvieron: 2/);
  assert.match(t, /esperas largas \(> 120 min\): 1, 3\.0 h/);
  assert.match(t, /\| sin clasificar \| /, 'el cubo «sin clasificar» sale siempre');
  assert.ok(LARGA_MIN === 120);
});

test('SCRUM-1414 · 🔴 fail-closed: sin ninguna línea de tiempo de un puesto sale 2, y no da cifra', () => {
  for (const trabajos of [[], [EQUIPO[3]], [EQUIPO[4]], [{ id: 'x', nombre: 's1-x', linea: '{roto', transcripcion: null }]]) {
    const r = medir(trabajos, { ahora: AHORA });
    assert.equal(r.codigo, 2);
    assert.match(r.lineas.join('\n'), /NO VALE \(salida 2\)/);
    assert.doesNotMatch(r.lineas.join('\n'), /LA CIFRA/);
  }
});

test('SCRUM-1414 · un puesto sin transcripción se mide, pero su espera queda «sin transcripción» y se cuenta', () => {
  const r = medir([{ ...EQUIPO[0], transcripcion: null }], { ahora: AHORA });
  assert.equal(r.datos.porQuien['sin transcripción'].ms / 60e3, 20);
  assert.equal(r.datos.porQuien['el orquestador'], undefined);
  assert.match(r.lineas.join('\n'), /puestos sin transcripción \(no se sabe quién los despertó\): 1/);
});

test('SCRUM-1414 · el techo: la jornada del PUESTO cuenta lo que ninguna de sus sesiones trabajó, sin contar dos veces el solape', () => {
  const m = (a, b) => [T0 + a * 60e3, T0 + b * 60e3];
  assert.deepEqual(paradoDeLasJornadas({ 'd S1': [m(0, 10), m(5, 20), m(50, 60)] }), { n: 1, total: 60 * 60e3, parado: 30 * 60e3 });
  // Dos sesiones del mismo puesto relevándose: el relevo no deja espera en ninguna, pero sí puesto parado.
  const relevo = [
    { id: 'a', nombre: 's3-29a', linea: linea(ev(0, 'working'), ev(10, 'working'), ev(11, 'done')), transcripcion: '' },
    { id: 'b', nombre: 's3-29b', linea: linea(ev(41, 'working'), ev(51, 'working')), transcripcion: '' },
  ];
  const r = medir(relevo, { ahora: AHORA });
  assert.equal(r.datos.suma.corta, 0);
  assert.deepEqual([r.datos.jornada.total / 60e3, r.datos.jornada.parado / 60e3], [51, 30]);
});

test('SCRUM-1414 · las paradas de HOY que no han vuelto salen con nombre; las de otros días, no', () => {
  const hoy = T0 + 100 * 60e3;
  const r = medir(EQUIPO, { ahora: hoy });
  assert.deepEqual(r.datos.abiertas.map((a) => [a.nombre, Math.round(a.ms / 60e3)]), [['s4-29a', 88], ['s1-29a', 50]]);
  assert.equal(medir(EQUIPO, { ahora: AHORA + 48 * 3600e3 }).datos.abiertas.length, 0);
});

test('SCRUM-1414 · --desde recorta la ventana, y el 1-oct sale marcado como día no representativo', () => {
  const uno = Date.parse('2026-10-01T09:00:00Z') - T0;
  const e = (n, s) => JSON.stringify({ at: new Date(T0 + uno + n * 60e3).toISOString(), state: s, detail: '', text: '' });
  const trabajos = [EQUIPO[0], { id: 'z', nombre: 's3-1oct', linea: [e(0, 'working'), e(10, 'working')].join('\n'), transcripcion: '' }];
  const todo = medir(trabajos, { ahora: AHORA }).lineas.join('\n');
  assert.match(todo, /2026-10-01 ⚠️/);
  assert.match(todo, /2026-10-01 NO es un día representativo/);
  const r = medir(trabajos, { desde: '2026-10-01', ahora: AHORA });
  assert.equal(r.datos.leidas, 1);
  assert.match(r.lineas.join('\n'), /1 puesto sin actividad en la ventana/);
});

test('SCRUM-1414 · el comando de verdad: lee una carpeta de trabajos, y una que no existe sale 2', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1414-'));
  try {
    const dir = path.join(tmp, 'j1'); fs.mkdirSync(dir);
    const tr = path.join(tmp, 't.jsonl'); fs.writeFileSync(tr, EQUIPO[0].transcripcion);
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ respawnFlags: ['-n', 's1-29a'], linkScanPath: tr }));
    fs.writeFileSync(path.join(dir, 'timeline.jsonl'), EQUIPO[0].linea);
    fs.mkdirSync(path.join(tmp, 'j2')); // un trabajo sin nada dentro: se cuenta, no revienta
    assert.deepEqual(leerTrabajos(tmp).map((t) => [t.nombre, t.linea != null]), [['s1-29a', true], ['', false]]);
    const ok = spawnSync(process.execPath, [SCRIPT, '--jobs', tmp], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /la despertó EL ORQUESTADOR: 0\.3 h = 100 % de la espera/);
    assert.match(ok.stdout, /1 sin nombre/);
    const mal = spawnSync(process.execPath, [SCRIPT, '--jobs', path.join(tmp, 'no-existe')], { encoding: 'utf8' });
    assert.equal(mal.status, 2);
    assert.match(mal.stdout, /NO VALE \(salida 2\)/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
