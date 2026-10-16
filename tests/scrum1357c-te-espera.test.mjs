// SCRUM-1357c · PARADOS: la sesión que ACABÓ SU TURNO y sigue viva te está esperando.
//
// EL DEFECTO QUE ESTO CIERRA (15-oct-2026, medido el 16-oct en los `timeline.jsonl`): una sesión de fondo
// que termina su turno queda en `state=done · tempo=idle`, y `done` NO es terminal: con un mensaje vuelve
// a `working`. `s3-15octb` pasó a `done` a las 16:54Z y volvió a `working` a las 17:33Z — 39 min
// esperando al orquestador. `parados.mjs` leía el `done` como «acabada» sin mirar el proceso, y salía 0
// con ✅. Ese día el fundador avisó de cinco puestos sin atender. El primer caso de este fichero ES ese.
//
// Y la otra mitad: un puesto sin NINGUNA sesión viva no salía en la tabla, porque la tabla sólo tenía
// filas para los puestos que tenían alguna sesión.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { medir, SALIDA_NADIE, SALIDA_HAY, SALIDA_CIEGO } from '../scripts/equipo/parados.mjs';

const GUION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'equipo', 'parados.mjs');
const AHORA = Date.parse('2026-10-15T17:33:00Z');
const hace = (min) => AHORA - min * 60_000;
const iso = (ms) => new Date(ms).toISOString();

/** Una sesión como la devuelve `leerTrabajos` del latido. */
const reg = (id, nombre, estado, extra = {}) => ({
  id, nombre, estado, tempo: estado === 'working' ? 'active' : estado === 'blocked' ? 'blocked' : 'idle',
  detalle: '', needs: undefined, actualizado: hace(5), creado: hace(120), ...extra,
});
const registroDe = (...sesiones) => ({ sesiones, ilegibles: [], sinEstado: [] });
/** Una entrada como la de `claude agents --json`. Sin `pid` = sin proceso. */
const enPanel = (id, name, state, extra = {}) => ({ id, name, kind: 'background', state, cwd: 'D:\\repo', ...extra });
const linea = (...eventos) => eventos.map(([min, state]) => JSON.stringify({ at: iso(hace(min)), state })).join('\n');
const texto = (r) => r.lineas.join('\n');

test('EL CASO DEL 15-OCT: `done` CON proceso es una sesión que TE ESPERA → sale, con su hora, y la salida es 1', () => {
  const r = medir({
    panel: [enPanel('8a745bff', 's3-15octb', 'done', { pid: 4100, status: 'idle' })],
    registro: registroDe(reg('8a745bff', 's3-15octb', 'done', { detalle: 'entregado 1173, push hecho', actualizado: hace(39) })),
    lineaDe: (id) => (id === '8a745bff' ? linea([45, 'working'], [39, 'done']) : null),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.equal(r.datos.esperan.length, 1);
  const e = r.datos.esperan[0];
  assert.equal(e.nombre, 's3-15octb');
  assert.equal(e.clase, 'espera');
  assert.equal(e.desde, hace(39));
  assert.equal(e.fuente, 'timeline');
  assert.deepEqual(r.datos.puestos.S3.espera, ['s3-15octb']);
  assert.deepEqual(r.datos.puestos.S3.acabada, []);
  assert.match(r.lineas[0], /^🔴 PARADOS · 1 SESIÓN\(ES\) TE ESPERA\(N\) \(acabaron su turno y siguen vivas\) en 1 puesto\(s\) \(S3\) · la que más, hace 39 min/);
  assert.doesNotMatch(texto(r), /✅/);
  const t = texto(r);
  assert.match(t, /\| S3 \| s3-15octb \| 8a745bff \| 2026-10-15T16:54Z \| 39 min \| pid 4100 \| panel: state=done · registro: state=done · panel: status=idle \| «entregado 1173, push hecho» \|/);
  // Una sesión que te espera está VIVA: el puesto no está vacío.
  assert.doesNotMatch(t, /\| S3 \| 0 ⚠️ NADIE/);
});

test('`done` SIN proceso sigue siendo «acabada»: no espera a nadie', () => {
  const r = medir({
    panel: [enPanel('aaaa0001', 's3-15octb', 'done')],
    registro: registroDe(reg('aaaa0001', 's3-15octb', 'done')),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_NADIE);
  assert.deepEqual(r.datos.puestos.S3.acabada, ['s3-15octb']);
  assert.equal(r.datos.esperan.length, 0);
});

test('`working` con proceso trabaja; y un bloqueo gana a un `done` (la pregunta es lo que hay que contestar)', () => {
  const r = medir({
    panel: [
      enPanel('aaaa0002', 's1-15oct', 'working', { pid: 1, status: 'busy' }),
      enPanel('aaaa0003', 's2-15oct', 'done', { pid: 2, status: 'idle' }),
    ],
    registro: registroDe(
      reg('aaaa0002', 's1-15oct', 'working'),
      reg('aaaa0003', 's2-15oct', 'done', { needs: '¿sigo con el 1144?' }),
    ),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.deepEqual(r.datos.puestos.S1.trabajando, ['s1-15oct']);
  assert.deepEqual(r.datos.puestos.S2.bloqueada, ['s2-15oct']);
  assert.equal(r.datos.esperan.length, 0);
});

test('lo dice CUALQUIERA de las dos: el panel aún da `working`, el registro ya dice `done`, y hay proceso', () => {
  const r = medir({
    panel: [enPanel('aaaa0004', 's4-15octb', 'working', { pid: 3 })],
    registro: registroDe(reg('aaaa0004', 's4-15octb', 'done', { actualizado: hace(12) })),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.deepEqual(r.datos.esperan.map((e) => e.nombre), ['s4-15octb']);
  assert.match(texto(r), /\| registro: state=done ⚠️ el panel la da por «working» \|/);
});

test('PUESTOS SIN NINGUNA SESIÓN VIVA: salen con su línea y la salida es 1; un resto sin proceso no cuenta como viva', () => {
  const r = medir({
    panel: [
      enPanel('aaaa0005', 's1-16oct', 'working', { pid: 1 }),
      enPanel('aaaa0006', 's3-16oct', 'done', { pid: 2 }),
      enPanel('df2fa38f', 'sesion-5', 'working'),
    ],
    registro: registroDe(reg('aaaa0005', 's1-16oct', 'working'), reg('aaaa0006', 's3-16oct', 'done'), reg('df2fa38f', 'sesion-5', 'done')),
    puestos: ['S0', 'S1', 'S3', 'S5'],
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.deepEqual(r.datos.vacios, ['S0', 'S5']);
  assert.match(r.lineas[0], /PUESTO\(S\) SIN NINGUNA SESIÓN VIVA: S0, S5/);
  const t = texto(r);
  assert.match(t, /\| S0 \| 0 ⚠️ NADIE \| 0 \| 0 \| 0 \| 0 \| 0 \|/);
  assert.match(t, /\| S5 \| 0 ⚠️ NADIE \| 0 \| 0 \| 1 \(sesion-5\) \| 0 \| 0 \|/);
});

test('un puesto vacío y NADA MÁS basta para salir 1 (el S1 muerto del 15-oct, con los demás trabajando)', () => {
  const r = medir({
    panel: [enPanel('aaaa0011', 's0-16oct', 'working', { pid: 1 })],
    registro: registroDe(reg('aaaa0011', 's0-16oct', 'working')),
    puestos: ['S0', 'S1'],
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.equal(r.lineas[0], '🔴 PARADOS · PUESTO(S) SIN NINGUNA SESIÓN VIVA: S1');
  assert.equal(r.lineas[1], '   ninguna te espera · puestos pedidos: S0, S1 — SIN sesión viva: S1');
});

test('todos los puestos con una sesión trabajando y nadie esperando → 0, el verde de siempre', () => {
  const r = medir({
    panel: [enPanel('aaaa0007', 's0-16oct', 'working', { pid: 1 }), enPanel('aaaa0008', 's1-16oct', 'working', { pid: 2 })],
    registro: registroDe(reg('aaaa0007', 's0-16oct', 'working'), reg('aaaa0008', 's1-16oct', 'working')),
    puestos: ['S0', 'S1'],
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_NADIE);
  // El titular verde es el de 1357b, intacto; lo nuevo va justo debajo, con lo que se pidió mirar.
  assert.equal(r.lineas[0], '✅ PARADOS · ninguna sesión bloqueada');
  assert.equal(r.lineas[1], '   ninguna te espera · puestos pedidos: S0, S1 — todos con alguna sesión viva');
});

test('sin puestos pedidos no se afirma nada sobre puestos', () => {
  const r = medir({ panel: [enPanel('aaaa0010', 's0-16oct', 'working', { pid: 1 })], registro: registroDe(reg('aaaa0010', 's0-16oct', 'working')), ahora: AHORA });
  assert.equal(r.codigo, SALIDA_NADIE);
  assert.equal(r.lineas[1], '   ninguna te espera · no se pidió mirar puestos (--puestos)');
});

test('🔴 LA CEGUERA SE CONSERVA: sin panel no se sabe quién espera ni qué puesto está vacío → 2, nunca 0 ni «vacío»', () => {
  const r = medir({
    panel: null, motivoPanel: 'no contestó en 60 s',
    registro: registroDe(reg('aaaa0009', 's3-15octb', 'done')),
    puestos: ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'],
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_CIEGO);
  assert.match(r.lineas[0], /NO PUDE MIRAR \(salida 2\)/);
  // Sin panel no hay procesos que ver: ni «te espera» ni «vacío» se pueden afirmar.
  assert.deepEqual(r.datos.vacios, []);
  assert.equal(r.datos.esperan.length, 0);
  assert.doesNotMatch(texto(r), /✅|SIN NINGUNA SESIÓN VIVA/);
  assert.match(texto(r), /y con lo que falta por mirar eso NO vale como «nadie parado»/);
});

test('de punta a punta: el guion de verdad pide S0-S5 por defecto, y `--puestos` lo cambia', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1357c-'));
  try {
    const jobs = path.join(tmp, 'jobs');
    const ahora = Date.now();
    fs.mkdirSync(path.join(jobs, 'eeee0001'), { recursive: true });
    fs.writeFileSync(path.join(jobs, 'eeee0001', 'state.json'), JSON.stringify({ name: 's5-16oct', state: 'done', tempo: 'idle', updatedAt: iso(ahora - 20 * 60_000), createdAt: iso(ahora - 90 * 60_000) }));
    fs.writeFileSync(path.join(jobs, 'eeee0001', 'timeline.jsonl'), [[30, 'working'], [20, 'done']].map(([min, state]) => JSON.stringify({ at: iso(ahora - min * 60_000), state })).join('\n'));
    const panel = [{ id: 'eeee0001', name: 's5-16oct', kind: 'background', state: 'done', pid: 777, status: 'idle' }];
    const f = path.join(tmp, 'panel.mjs');
    fs.writeFileSync(f, `process.stdout.write(${JSON.stringify(JSON.stringify(panel))});\n`);
    const correr = (...args) => spawnSync(process.execPath, [GUION, '--jobs', jobs, ...args], { encoding: 'utf8', env: { ...process.env, PARADOS_CLAUDE: JSON.stringify([process.execPath, f]) } });

    const r = correr();
    assert.equal(r.status, SALIDA_HAY, r.stdout + r.stderr);
    assert.match(r.stdout, /^🔴 PARADOS · 1 SESIÓN\(ES\) TE ESPERA\(N\) .* \(S5\) · la que más, hace 20 min · PUESTO\(S\) SIN NINGUNA SESIÓN VIVA: S0, S1, S2, S3, S4/);
    assert.deepEqual(JSON.parse(correr('--json').stdout).vacios, ['S0', 'S1', 'S2', 'S3', 'S4']);

    const solo = correr('--puestos', 'S5');
    assert.equal(solo.status, SALIDA_HAY);
    assert.doesNotMatch(solo.stdout, /SIN NINGUNA SESIÓN VIVA/);
    // Un `--puestos` que no se entiende no se lee como «ninguno»: se dice y sale 2.
    const malo = correr('--puestos', 'cinco');
    assert.equal(malo.status, SALIDA_CIEGO, malo.stdout + malo.stderr);
    assert.match(malo.stdout, /--puestos no se deja leer/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
