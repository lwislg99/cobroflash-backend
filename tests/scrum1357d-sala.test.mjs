// SCRUM-1357d · SALA: el formato del panel «La sala», sacado de `parados.mjs`.
//
// EL DEFECTO QUE ESTO CIERRA (16-oct-2026): el vigía que alimentaba el panel del fundador sólo conocía los
// nombres `sN-…`; ese día las sesiones se lanzaron como `sesion-N` y el panel enseñó los SEIS puestos
// «SIN CUBRIR» con los seis trabajando. Su control positivo no podía cazarlo: probaba que lo AUSENTE se
// ve ausente, nunca que lo PRESENTE se ve presente. Aquí van los dos sentidos, y un tercero: una sesión
// viva que no es de ningún puesto sale como huérfana en vez de callarse.
//
// Y LA OTRA MITAD: el plugin pinta «los 6 trabajando» cuando no lee ninguna línea. Una salida vacía tiene
// que significar «miré y no hay nada», nunca «no pude mirar».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs';
import { medir } from '../scripts/equipo/parados.mjs';
import { aLineas, correrParados, SALIDA_NADA, SALIDA_HAY, SALIDA_AVERIA } from '../scripts/equipo/sala.mjs';

const GUION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'equipo', 'sala.mjs');
const PUESTOS = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];

// Las mutaciones se corrieron a mano y están en `docs/master/SCRUM-1357.md` (1357d). No se declaran en
// `MUTACIONES_QUE_ME_TUMBAN`: cada una se paga en el CI de todos (SCRUM-935), como las de 1357b y 1357c.
const AHORA = Date.parse('2026-10-16T12:00:00Z');
const hace = (min) => AHORA - min * 60_000;

const reg = (id, nombre, estado, extra = {}) => ({
  id, nombre, estado, tempo: estado === 'working' ? 'active' : estado === 'blocked' ? 'blocked' : 'idle',
  detalle: '', needs: undefined, actualizado: hace(2), creado: hace(60), ...extra,
});
const enPanel = (id, name, state, extra = {}) => ({ id, name, kind: 'background', state, cwd: 'D:\\repo', ...extra });

/** Las seis, una por puesto, con las CUATRO formas de nombre que existen. */
const SEIS = [
  ['a0', 's0'], ['a1', 's1-16oct'], ['a2', 'sesion-2'], ['a3', 'sesion-3-16oct'], ['a4', 's4-16octb'], ['a5', 'sesion-5'],
];
const trabajando = (pares) => ({
  panel: pares.map(([id, n], i) => enPanel(id, n, 'working', { pid: 100 + i, status: 'busy' })),
  registro: { sesiones: pares.map(([id, n]) => reg(id, n, 'working')), ilegibles: [], sinEstado: [] },
});
const traducir = (e) => aLineas(medir({ ...e, ahora: AHORA, puestos: PUESTOS }).datos);

test('🔴 LO PRESENTE SE VE PRESENTE: las seis vivas, con las cuatro formas de nombre → ninguna línea, salida 0', () => {
  const r = traducir(trabajando(SEIS));
  assert.deepEqual(r.lineas, []);
  assert.equal(r.codigo, SALIDA_NADA);
});

test('🔴 LO AUSENTE SE VE AUSENTE: sin la de S3, sale VACIO|S3 y sólo eso', () => {
  const r = traducir(trabajando(SEIS.filter(([, n]) => !n.startsWith('sesion-3'))));
  assert.deepEqual(r.lineas, ['VACIO|S3|ninguna sesión suya con proceso|su puesto está SIN CUBRIR']);
  assert.equal(r.codigo, SALIDA_HAY);
});

test('🔴 una sesión VIVA que no es de ningún puesto sale como HUÉRFANA, no se calla', () => {
  const r = traducir(trabajando([...SEIS, ['a9', 'javier-16oct'], ['a8', 's12-16oct']]));
  assert.deepEqual(r.lineas, ['HUÉRFANAS|2 sesión(es) VIVA(S) que no son de ningún puesto: javier-16oct, s12-16oct|¿han cambiado los nombres?']);
  assert.equal(r.codigo, SALIDA_HAY);
  // Control: sin proceso no está viva, y no es huérfana de nadie.
  const muerta = trabajando(SEIS);
  muerta.panel.push(enPanel('a7', 'javier-15oct', 'done'));
  muerta.registro.sesiones.push(reg('a7', 'javier-15oct', 'done'));
  assert.deepEqual(traducir(muerta).lineas, []);
});

test('BLOQUEADA y TE ESPERA salen con su puesto, desde cuándo, su proceso y lo que dicen', () => {
  const e = trabajando(SEIS.filter(([, n]) => !['sesion-3-16oct', 'sesion-2'].includes(n)));
  e.panel.push(enPanel('b3', 'sesion-3', 'blocked', { pid: 14304, waitingFor: 'permission prompt' }));
  e.registro.sesiones.push(reg('b3', 'sesion-3', 'working', { tempo: 'blocked', needs: 'approve Entering worktree', actualizado: hace(8) }));
  e.panel.push(enPanel('b2', 'sesion-2', 'done', { pid: 4100, status: 'idle' }));
  e.registro.sesiones.push(reg('b2', 'sesion-2', 'done', { detalle: 'entregado 1158c', actualizado: hace(39) }));
  const r = traducir(e);
  assert.deepEqual(r.lineas, [
    'BLOQUEADA|S3|sesion-3|hace 8 min|pid 14304|«approve Entering worktree»',
    'TE ESPERA|S2|sesion-2|hace 39 min|pid 4100|«entregado 1158c»',
  ]);
  assert.equal(r.codigo, SALIDA_HAY);
});

test('una pregunta con `|` o saltos de línea no parte la línea del plugin', () => {
  const e = trabajando(SEIS.filter(([, n]) => n !== 's0'));
  e.panel.push(enPanel('c0', 's0', 'blocked', { pid: 9 }));
  e.registro.sesiones.push(reg('c0', 's0', 'blocked', { needs: '¿A | B?\n¿o C?', actualizado: hace(200) }));
  const [l] = traducir(e).lineas;
  assert.equal(l.split('|').length, 6, l);
  assert.equal(l, 'BLOQUEADA|S0|s0|hace 3.3 h|pid 9|«¿A B? ¿o C?»');
});

test('🔴 si parados.mjs NO PUDO MIRAR, sale AVERIA y 2: nunca la salida vacía', () => {
  const r = aLineas(medir({ panel: null, motivoPanel: 'no contestó en 60 s', registro: { sesiones: [], ilegibles: [], sinEstado: [] }, ahora: AHORA, puestos: PUESTOS }).datos);
  assert.equal(r.codigo, SALIDA_AVERIA);
  assert.ok(r.lineas.length > 0);
  assert.match(r.lineas[0], /^AVERIA\|no pude mirar el PANEL/);
  // Lo que no es un informe, tampoco se lee como «nada».
  for (const basura of [null, {}, { filas: [] }, 'texto']) {
    const b = aLineas(basura);
    assert.equal(b.codigo, SALIDA_AVERIA, JSON.stringify(basura));
    assert.match(b.lineas[0], /^AVERIA\|/);
  }
});

test('🔴 un informe que no cuadra con la salida de parados.mjs es AVERIA', () => {
  const doble = (status, stdout, extra = {}) => () => ({ status, stdout, stderr: '', ...extra });
  assert.ok(correrParados({ lanzar: doble(0, JSON.stringify({ codigo: 0, filas: [], ciegos: [] })) }).datos);
  assert.match(correrParados({ lanzar: doble(0, JSON.stringify({ codigo: 2, filas: [], ciegos: ['x'] })) }).averia, /no cuadran/);
  assert.match(correrParados({ lanzar: doble(1, 'Error: Cannot find module') }).averia, /sin un informe legible/);
  assert.match(correrParados({ lanzar: doble(null, '', { error: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }) }).averia, /ETIMEDOUT/);
});

test('POR EFECTO: el guion de verdad, con parados.mjs de verdad y un panel doblado', () => {
  const tmp = temporal('scrum1357d-');
  try {
    const jobs = path.join(tmp, 'jobs');
    const iso = (ms) => new Date(ms).toISOString();
    const ahora = Date.now();
    for (const [id, name] of SEIS) {
      fs.mkdirSync(path.join(jobs, id), { recursive: true });
      fs.writeFileSync(path.join(jobs, id, 'state.json'), JSON.stringify({ name, state: 'working', tempo: 'active', updatedAt: iso(ahora - 60_000), createdAt: iso(ahora - 600_000) }));
    }
    const doble = (nombre, panel) => {
      const f = path.join(tmp, nombre);
      fs.writeFileSync(f, `if (process.argv.slice(2).join(' ') !== 'agents --json') process.exit(9);\nprocess.stdout.write(${JSON.stringify(JSON.stringify(panel))});\n`);
      return JSON.stringify([process.execPath, f]);
    };
    const correr = (orden) => spawnSync(process.execPath, [GUION, '--jobs', jobs], { encoding: 'utf8', env: { ...process.env, PARADOS_CLAUDE: orden } });
    const vivas = SEIS.map(([id, name], i) => ({ id, name, kind: 'background', state: 'working', pid: 500 + i, status: 'busy' }));

    const bien = correr(doble('seis.mjs', vivas));
    assert.equal(bien.status, SALIDA_NADA, bien.stdout + bien.stderr);
    assert.equal(bien.stdout, '');

    const sinS5 = correr(doble('cinco.mjs', vivas.filter((a) => a.name !== 'sesion-5')));
    assert.equal(sinS5.status, SALIDA_AVERIA, sinS5.stdout + sinS5.stderr);
    // El registro dice `working` y el panel no la lista: parados.mjs no lo sabe, y lo dice.
    assert.match(sinS5.stdout, /^AVERIA\|no pude mirar .*sesion-5/m);

    // Control: el panel roto NO deja la salida vacía.
    const roto = correr(JSON.stringify([process.execPath, '-e', 'process.exit(3)']));
    assert.equal(roto.status, SALIDA_AVERIA, roto.stdout + roto.stderr);
    assert.match(roto.stdout, /^AVERIA\|no pude mirar el PANEL/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
