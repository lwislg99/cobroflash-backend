// SCRUM-1356 · EL LATIDO, ENGANCHADO — escrito no es corriendo.
//
// El latido (SCRUM-1350) solo servía si quien reparte se acordaba de lanzarlo, y `latido cierre` solo
// si la sesión se acordaba de mirarlo. Dos hooks lo quitan de la memoria de nadie:
//   · `.claude/hooks/latido-arranque.mjs` (SessionStart) → el parte, delante del orquestador.
//   · `.claude/hooks/latido-cierre.mjs`   (Stop)         → el obligatorio de lo que la sesión empujó.
// Lo que un hook así puede hacer mal son DOS cosas opuestas, y aquí se comprueban las dos:
//   CALLAR  (no pudo mirar y se lee como «nada que atender»)   y
//   PARAR   (bloquear sin decir por qué, o bloquear dos veces por lo mismo).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  esPuesto, decidir, recortar, contextoDe, corrio, plazoDe, SEGUNDOS as SEGUNDOS_ARRANQUE, TOPE_CARACTERES, HORAS_DE_RASTRO,
} from '../.claude/hooks/latido-arranque.mjs';
import {
  ramasEmpujadas, veredictoDeRama, decidirCierre, OBLIGATORIO, SEGUNDOS as SEGUNDOS_CIERRE,
} from '../.claude/hooks/latido-cierre.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARRANQUE = path.join(RAIZ, '.claude', 'hooks', 'latido-arranque.mjs');
const CIERRE = path.join(RAIZ, '.claude', 'hooks', 'latido-cierre.mjs');
const hooksDe = (evento) => {
  const s = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8'));
  return ((s.hooks && s.hooks[evento]) || []).flatMap((g) => g.hooks || []);
};
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const run = (conclusion, extra = {}) => ({ name: 'build + tests (con banco desechable)', status: 'completed', conclusion, started_at: '2026-10-01T09:00:00Z', ...extra });
const uso = (command) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'PowerShell', input: { command } }] } });

// ───────────────────────────── enganchado de verdad ─────────────────────────────

test('SCRUM-1356 · 🔴 los dos hooks están REGISTRADOS en settings.json, y sus plazos caben en el del arnés', () => {
  const inicio = hooksDe('SessionStart').find((h) => /latido-arranque\.mjs/.test(h.command));
  const parada = hooksDe('Stop').find((h) => /latido-cierre\.mjs/.test(h.command));
  assert.ok(inicio, 'SessionStart no lanza latido-arranque.mjs: el latido vuelve a depender de acordarse');
  assert.ok(parada, 'Stop no lanza latido-cierre.mjs: el cierre vuelve a depender de acordarse');
  assert.ok(fs.existsSync(ARRANQUE) && fs.existsSync(CIERRE));
  // Si el arnés corta antes que el hook, el hook muere sin decir nada: justo lo que no puede pasar.
  assert.ok(inicio.timeout > SEGUNDOS_ARRANQUE, `timeout ${inicio.timeout} s ≤ plazo interno ${SEGUNDOS_ARRANQUE} s`);
  assert.ok(parada.timeout > SEGUNDOS_CIERRE, `timeout ${parada.timeout} s ≤ plazo interno ${SEGUNDOS_CIERRE} s`);
});

test('SCRUM-1356 · el obligatorio del cierre es el MISMO literal que el del latido (una copia atada, no dos sueltas)', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'equipo', 'latido.mjs'), 'utf8');
  const m = fuente.match(/const OBLIGATORIO_POR_DEFECTO = '([^']+)'/);
  assert.ok(m, 'no encuentro OBLIGATORIO_POR_DEFECTO en latido.mjs: este test se ha quedado ciego');
  assert.equal(OBLIGATORIO, m[1]);
});

// ───────────────────────────── arranque: a quién ─────────────────────────────

test('SCRUM-1356 · arranque: corre para quien reparte, NO para un puesto', () => {
  for (const n of ['s3-1oct', 'sesion-2', 's0-1octb', 'j4-30sep', 'puesto-j1', 'S5-x']) assert.equal(esPuesto(n), true, n);
  for (const n of ['', undefined, 'orquestador', 'cobroflash-backend-57', 'sd-21b', 'jefe']) assert.equal(esPuesto(n), false, String(n));
  assert.equal(decidir({ titulo: 's3-1oct' }).correr, false);
  assert.equal(decidir({ titulo: 'orquestador' }).correr, true);
  assert.equal(decidir({ titulo: '' }).correr, true, 'una sesión sin nombre es de quien la abre a mano: el orquestador');
  assert.equal(decidir({ titulo: 'orquestador', env: { YAQU_LATIDO: 'no' } }).correr, false);
});

test('SCRUM-1356 · arranque: un puesto NO recibe nada y el hook sale 0 (proceso de verdad, sin red)', () => {
  const r = spawnSync(process.execPath, [ARRANQUE], { input: JSON.stringify({ session_title: 's3-1oct', source: 'startup' }), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

// ───────────────────────────── arranque: no callar ─────────────────────────────

test('SCRUM-1356 · arranque: la pasada completa llega ENTERA, con lo que tardó', () => {
  const c = contextoDe({ pasada: { estado: 'ok', salida: 'LATIDO · x\n🔴 PR · 9 PR abiertos\n→ HAY COSAS QUE ATENDER (salida 1)\n', segundos: 62 }, atraso: 0 });
  assert.match(c, /pasada completa en 62 s/);
  assert.match(c, /9 PR abiertos/);
  assert.doesNotMatch(c, /NO PUDE MIRAR/);
});

test('SCRUM-1356 · 🔴 arranque: si la pasada NO cabe en el plazo, lo DICE y da lo local — nunca un silencio', () => {
  const c = contextoDe({ pasada: { estado: 'tiempo', segundos: SEGUNDOS_ARRANQUE }, locales: { texto: '🔴 SESIONES · 3 blocked\n   · s2-1octb BLOQUEADA · espera: Login expired' }, atraso: 0 });
  assert.match(c, /PR, MAIN y DESPLIEGUE: NO PUDE MIRAR/);
  assert.match(c, /NO quiere decir que no haya PR en rojo/);
  assert.match(c, /Login expired/, 'las secciones locales son las que vieron las tres bloqueadas del 1-oct');
});

test('SCRUM-1356 · arranque: el plazo se puede acortar, NUNCA alargar por encima del corte del arnés', () => {
  assert.equal(plazoDe({}), SEGUNDOS_ARRANQUE);
  assert.equal(plazoDe({ YAQU_LATIDO_SEGUNDOS: '20' }), 20);
  for (const malo of ['600', '0', '-5', 'mucho']) assert.equal(plazoDe({ YAQU_LATIDO_SEGUNDOS: malo }), SEGUNDOS_ARRANQUE, malo);
  assert.match(contextoDe({ pasada: { estado: 'tiempo', segundos: 20 }, locales: { texto: 'x' }, atraso: 0, plazo: 20 }), /no cupo en 20 s/);
});

test('SCRUM-1356 · arranque: si TAMPOCO hay locales, no se inventa un parte', () => {
  const c = contextoDe({ pasada: { estado: 'fallo', motivo: 'este árbol no tiene scripts/equipo/latido.mjs', segundos: 0 }, locales: { motivo: 'ERR_MODULE_NOT_FOUND' }, atraso: undefined });
  assert.match(c, /la pasada completa falló: este árbol no tiene/);
  assert.match(c, /locales TAMPOCO: ERR_MODULE_NOT_FOUND/);
  assert.match(c, /no pude medir cuánto va este árbol por detrás/);
});

test('SCRUM-1356 · arranque: un árbol atrasado se DICE (el parte de un árbol viejo es el de un latido viejo)', () => {
  assert.match(contextoDe({ pasada: { estado: 'ok', salida: 'x', segundos: 1 }, atraso: 1400 }), /1400 commit\(s\) por detrás de origin\/main/);
  assert.doesNotMatch(contextoDe({ pasada: { estado: 'ok', salida: 'x', segundos: 1 }, atraso: 0 }), /por detrás/);
});

test('SCRUM-1356 · arranque: lo que no cabe se recorta DICIÉNDOLO, y un rastro que no se pudo escribir también', () => {
  const largo = recortar('x'.repeat(TOPE_CARACTERES + 500));
  assert.match(largo, /RECORTADO: faltan 500 caracteres/);
  assert.equal(recortar('corto'), 'corto');
  assert.match(contextoDe({ pasada: { estado: 'ok', salida: 'x', segundos: 1 }, atraso: 0, rastro: false }), /No pude escribir el rastro/);
});

// ───────────────────────────── escrito no es corriendo ─────────────────────────────

test('SCRUM-1356 · 🔴 `corrio`: sin rastro NO es «corrió»; viejo tampoco; reciente sí', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1356-'));
  try {
    const ruta = path.join(dir, 'latido-arranque.log');
    const ahora = Date.parse('2026-10-01T12:00:00Z');
    assert.equal(corrio({ ruta, ahora }).codigo, 2, 'sin fichero: no ha corrido nunca');
    assert.match(corrio({ ruta, ahora }).texto, /NO HAY RASTRO/);
    const fila = (cuando) => `${JSON.stringify({ cuando, sesion: 'orquestador', source: 'startup', resultado: 'ok', segundos: 62 })}\n`;
    fs.writeFileSync(ruta, fila(new Date(ahora - (HORAS_DE_RASTRO + 1) * 36e5).toISOString()));
    assert.equal(corrio({ ruta, ahora }).codigo, 1, 'un rastro de ayer no prueba que siga enganchado');
    fs.appendFileSync(ruta, fila(new Date(ahora - 10 * 60000).toISOString()));
    const r = corrio({ ruta, ahora });
    assert.equal(r.codigo, 0);
    assert.match(r.texto, /2 pasada\(s\) apuntadas .* hace 10 min/);
    fs.appendFileSync(ruta, 'esto no es json\n');
    assert.equal(corrio({ ruta, ahora }).codigo, 2, 'un rastro ilegible no es un verde');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ───────────────────────────── cierre: qué ramas ─────────────────────────────

test('SCRUM-1356 · cierre: las ramas salen de los `git push` del transcript, por su DESTINO', () => {
  const jsonl = [
    uso('git -C "D:\\\\MILLONARIO\\\\wt-s0-1356" push origin HEAD:scrum-1356-latido-enganchado'),
    uso('git add .; git commit -m x; git push -u origin scrum-1192-censo-cierre-transitivo'),
    uso('git push --force-with-lease origin +HEAD:refs/heads/scrum-1a-b'),
    uso('git push origin HEAD:scrum-1356-latido-enganchado'), // repetida: una sola vez
  ].join('\n');
  assert.deepEqual(ramasEmpujadas(jsonl).sort(), ['scrum-1192-censo-cierre-transitivo', 'scrum-1356-latido-enganchado', 'scrum-1a-b']);
});

test('SCRUM-1356 · cierre: lo que NO es un empujón de rama propia no cuenta', () => {
  const jsonl = [
    uso('git push origin main'),
    uso('git push origin --delete scrum-9-vieja'),
    uso('git push'), // sin rama: no se inventa
    uso('git push origin HEAD:$rama'), // variable: no se inventa
    uso('git log --oneline origin/scrum-7-x; echo push'),
    JSON.stringify({ type: 'user', message: { content: 'para salir de un rojo: git push origin HEAD:scrum-5-del-prompt' } }), // lo DICE alguien, no lo HACE la sesión
    'push "tool_use" esto no es json',
  ].join('\n');
  assert.deepEqual(ramasEmpujadas(jsonl), []);
});

// ───────────────────────────── cierre: el veredicto ─────────────────────────────

test('SCRUM-1356 · cierre: solo VERDE es verde — rojo, «todavía no», sin empujar y ciego son cuatro cosas distintas', () => {
  const v = (e) => veredictoDeRama({ rama: 'scrum-1-x', remoto: SHA_A, local: SHA_A, ...e }).estado;
  assert.equal(v({ runs: [run('success')] }), 'VERDE');
  assert.equal(v({ runs: [run('failure')] }), 'ROJO');
  assert.equal(v({ runs: [run(null, { status: 'in_progress' })] }), 'TODAVIA-NO');
  assert.equal(v({ runs: [{ name: 'meta-guard', status: 'completed', conclusion: 'success' }] }), 'TODAVIA-NO', 'un informativo verde no es el obligatorio');
  assert.equal(v({ runs: [] }), 'TODAVIA-NO');
  assert.equal(v({ runs: undefined }), 'CIEGO');
  assert.equal(v({ local: SHA_B, runs: [run('success')] }), 'SIN-EMPUJAR', 'el verde es de OTRO commit');
  assert.equal(v({ local: null, runs: [run('success')] }), 'VERDE', 'sin rama local no hay con qué comparar: vale lo empujado');
  assert.equal(v({ remoto: null }), 'FUERA');
  assert.equal(v({ remoto: undefined }), 'CIEGO');
  // La corrida que cuenta es la ÚLTIMA: un rojo viejo relanzado en verde es verde, y al revés.
  assert.equal(v({ runs: [run('failure', { started_at: '2026-10-01T08:00:00Z' }), run('success', { started_at: '2026-10-01T10:00:00Z' })] }), 'VERDE');
  assert.equal(v({ runs: [run('success', { started_at: '2026-10-01T08:00:00Z' }), run('failure', { started_at: '2026-10-01T10:00:00Z' })] }), 'ROJO');
});

// ───────────────────────────── cierre: ni callar ni parar de más ─────────────────────────────

const VERDE = veredictoDeRama({ rama: 'scrum-1-a', remoto: SHA_A, local: SHA_A, runs: [run('success')] });
const ROJO = veredictoDeRama({ rama: 'scrum-2-b', remoto: SHA_B, local: SHA_B, runs: [run('failure')] });
const ESPERA = veredictoDeRama({ rama: 'scrum-2-b', remoto: SHA_B, local: SHA_B, runs: [] });
const FUERA = veredictoDeRama({ rama: 'scrum-3-c', remoto: null });

test('SCRUM-1356 · 🔴 cierre: con el obligatorio rojo o sin veredicto, parar exige que quede DICHO', () => {
  for (const malo of [ROJO, ESPERA]) {
    const d = decidirCierre({ activo: false, veredictos: [VERDE, malo] });
    assert.equal(d.bloquear, true);
    assert.match(d.razon, /2 rama\(s\) empujadas por esta sesión/, 'la población va en el aviso');
    assert.match(d.razon, /1 sin verde/);
    assert.match(d.razon, /scrum-2-b/);
    assert.match(d.razon, /NO te impide parar/, 'un bloqueo que no dice que es de una sola vez es un bloqueo sin explicar');
  }
});

test('SCRUM-1356 · cierre: todo verde, o nada empujado, NO gasta un turno', () => {
  assert.equal(decidirCierre({ activo: false, veredictos: [VERDE] }).bloquear, false);
  assert.equal(decidirCierre({ activo: false, veredictos: [VERDE, FUERA] }).bloquear, false, 'una rama mergeada y borrada no es un pendiente');
  assert.equal(decidirCierre({ activo: false, veredictos: [] }).bloquear, false);
});

test('SCRUM-1356 · 🔴 cierre: NUNCA dos veces por lo mismo — una vez por estado, y con stop_hook_active pasa siempre', () => {
  const primero = decidirCierre({ activo: false, veredictos: [VERDE, ROJO] });
  assert.equal(primero.bloquear, true);
  assert.equal(decidirCierre({ activo: false, veredictos: [VERDE, ROJO], dicho: primero.clave }).bloquear, false, 'ya se dijo: pasa');
  assert.equal(decidirCierre({ activo: true, veredictos: [VERDE, ROJO] }).bloquear, false, 'ya está continuando por un hook de Stop: pasa');
  // Pero si el estado CAMBIA (de «todavía no» a rojo), es otra cosa que decir.
  const espera = decidirCierre({ activo: false, veredictos: [ESPERA] });
  assert.equal(decidirCierre({ activo: false, veredictos: [ROJO], dicho: espera.clave }).bloquear, true);
});

test('SCRUM-1356 · cierre: «no pude mirar» se dice UNA vez y deja pasar; no es un verde ni un cerrojo', () => {
  const d = decidirCierre({ activo: false, ciego: 'no encuentro el transcript' });
  assert.equal(d.bloquear, true);
  assert.match(d.razon, /NO PUDE MIRAR/);
  assert.match(d.razon, /no es verde/);
  assert.equal(decidirCierre({ activo: false, ciego: 'no encuentro el transcript', dicho: d.clave }).bloquear, false);
});

test('SCRUM-1356 · cierre: proceso de verdad, sin red — stop_hook_active, sin empujones y entrada rota salen 0 y callados', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1356-'));
  try {
    const transcript = path.join(dir, 't.jsonl');
    fs.writeFileSync(transcript, `${uso('git status')}\n`);
    const lanzar = (entrada) => spawnSync(process.execPath, [CIERRE], { input: entrada, encoding: 'utf8', env: { ...process.env, LOCALAPPDATA: dir, TMPDIR: dir, TEMP: dir, TMP: dir } });
    for (const entrada of [
      JSON.stringify({ session_id: 'x', stop_hook_active: true, transcript_path: transcript }),
      JSON.stringify({ session_id: 'x', stop_hook_active: false, transcript_path: transcript }),
      // Con BOM delante (así canaliza PowerShell 5.1): se lee igual. Sin quitarlo, el hook no entendía
      // su entrada y acusaba «no encuentro el transcript» a una sesión que lo tenía.
      `﻿${JSON.stringify({ session_id: 'x', transcript_path: transcript })}`,
    ]) {
      const r = lanzar(entrada);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout, '');
    }
    // Sin transcript que leer: lo DICE (bloqueo de una vez), y la segunda vez pasa.
    const ciega = JSON.stringify({ session_id: 'scrum1356-sin-transcript', transcript_path: path.join(dir, 'no-existe.jsonl') });
    const r1 = lanzar(ciega);
    assert.equal(r1.status, 0, r1.stderr);
    assert.equal(JSON.parse(r1.stdout).decision, 'block');
    assert.match(JSON.parse(r1.stdout).reason, /NO PUDE MIRAR/);
    const r2 = lanzar(ciega);
    assert.equal(r2.status, 0);
    assert.equal(r2.stdout, '', 'la segunda vez por lo mismo, pasa');
    // Y deja rastro de cada vez que MIDIÓ (con stop_hook_active no mide: no apunta).
    assert.equal(fs.readFileSync(path.join(dir, 'yaqu-equipo', 'latido-cierre.log'), 'utf8').trim().split('\n').length, 4);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
