// SCRUM-1357b · PARADOS: quién está bloqueado AHORA, contado por SESIÓN y nunca por puesto.
//
// EL DEFECTO QUE ESTO CIERRA (13-oct-2026): el vigía del orquestador miraba un puesto, cogía su sesión
// más reciente y, si estaba viva, daba el puesto por bueno. Con 31 sesiones bloqueadas decía «nadie
// parado». El primer caso de este fichero ES ese día: un puesto con una sesión viva y otra bloqueada
// debajo. Si `medir` deja de ver a la de debajo, cae.
//
// Todo lo demás son las formas de decir «nadie» sin haber mirado: el panel que no contesta, el
// registro que no existe, la sesión sin `state.json`, la que dice `working` sin proceso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  medir, leerPanel, paradaDesde, ordenPorDefecto, SALIDA_NADIE, SALIDA_HAY, SALIDA_CIEGO,
} from '../scripts/equipo/parados.mjs';

const GUION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'equipo', 'parados.mjs');
const AHORA = Date.parse('2026-10-13T14:00:00Z');
const hace = (min) => AHORA - min * 60_000;
const iso = (ms) => new Date(ms).toISOString();

/** Una sesión como la devuelve `leerTrabajos` del latido. */
const reg = (id, nombre, estado, extra = {}) => ({
  id, nombre, estado, tempo: estado === 'blocked' ? 'blocked' : 'active', detalle: '', needs: undefined,
  actualizado: hace(5), creado: hace(60), ...extra,
});
const registroDe = (...sesiones) => ({ sesiones, ilegibles: [], sinEstado: [] });
/** Una entrada como la de `claude agents --json`. Sin `pid` = sin proceso. */
const enPanel = (id, name, state, extra = {}) => ({ id, name, kind: 'background', state, cwd: 'D:\\repo', ...extra });
const linea = (...eventos) => eventos.map(([min, state, detail = '']) => JSON.stringify({ at: iso(hace(min)), state, detail })).join('\n');
const texto = (r) => r.lineas.join('\n');

test('EL CASO DEL 13-OCT: un puesto con una sesión VIVA y otra BLOQUEADA debajo → la bloqueada sale', () => {
  const r = medir({
    panel: [enPanel('dddd0001', 's1-13octd', 'working', { pid: 100, status: 'busy' }), enPanel('cccc0001', 's1-13octc', 'blocked')],
    registro: registroDe(
      reg('dddd0001', 's1-13octd', 'working'),
      reg('cccc0001', 's1-13octc', 'blocked', { needs: 'Los cinco hallazgos van a S1: ¿los repartes tú?', actualizado: hace(70) }),
    ),
    lineaDe: (id) => (id === 'cccc0001' ? linea([75, 'working'], [70, 'blocked', 'pregunta']) : null),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.equal(r.datos.bloqueadas.length, 1);
  const b = r.datos.bloqueadas[0];
  assert.equal(b.nombre, 's1-13octc');
  assert.equal(b.puesto, 'S1');
  assert.equal(b.pregunta, 'Los cinco hallazgos van a S1: ¿los repartes tú?');
  assert.equal(b.desde, hace(70));
  assert.equal(b.fuente, 'timeline');
  // La viva sigue contando como viva: no se la traga la bloqueada, ni al revés.
  assert.deepEqual(r.datos.puestos.S1.trabajando, ['s1-13octd']);
  assert.deepEqual(r.datos.puestos.S1.bloqueada, ['s1-13octc']);
  const t = texto(r);
  assert.match(r.lineas[0], /^🔴 PARADOS · 1 SESIÓN\(ES\) BLOQUEADA\(S\) en 1 puesto\(s\) \(S1\) · la más antigua, hace 70 min/);
  assert.match(t, /\| S1 \| s1-13octc \| cccc0001 \| 2026-10-13T12:50Z \| 70 min \| sin proceso \|/);
  assert.match(t, /«Los cinco hallazgos van a S1: ¿los repartes tú\?»/);
  assert.match(t, /\| S1 \| 1 \(s1-13octd\) \| 1 \(s1-13octc\) \|/);
});

test('se cuenta por SESIÓN: cuatro bloqueadas bajo una viva del mismo puesto son CUATRO', () => {
  const viejas = ['a', 'b', 'c', 'd'].map((x, i) => ({ id: `0000000${x}`, nombre: `s2-13oct${x}`, min: 20 + i * 10 }));
  const r = medir({
    panel: [enPanel('eeee0001', 's2-13octe', 'working', { pid: 7 }), ...viejas.map((v) => enPanel(v.id, v.nombre, 'blocked'))],
    registro: registroDe(reg('eeee0001', 's2-13octe', 'working'), ...viejas.map((v) => reg(v.id, v.nombre, 'blocked', { needs: `pregunta de ${v.nombre}`, actualizado: hace(v.min) }))),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.equal(r.datos.bloqueadas.length, 4);
  // De la que más lleva a la que menos.
  assert.deepEqual(r.datos.bloqueadas.map((b) => b.nombre), ['s2-13octd', 's2-13octc', 's2-13octb', 's2-13octa']);
  assert.match(r.lineas[0], /4 SESIÓN\(ES\) BLOQUEADA\(S\) en 1 puesto\(s\) \(S2\) · la más antigua, hace 50 min/);
});

test('nadie bloqueado → 0, con la población que miró', () => {
  const r = medir({
    panel: [enPanel('aaaa0001', 's0-13octd', 'working', { pid: 1 }), { pid: 9, name: 'cobroflash-backend-83', kind: 'interactive', status: 'busy' }],
    registro: registroDe(reg('aaaa0001', 's0-13octd', 'working')),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_NADIE);
  assert.match(r.lineas[0], /^✅ PARADOS · ninguna sesión bloqueada$/);
  assert.match(texto(r), /panel: 2 entradas — 1 trabajos de fondo, 1 interactivas \(cobroflash-backend-83;/);
  assert.match(texto(r), /registro: 1 trabajos con state\.json · 0 ilegibles · 0 carpetas sin state\.json/);
});

test('el panel NO CONTESTA → 2, nunca «ninguna»; y debajo va lo que el registro sí dice', () => {
  const sin = medir({ panel: null, motivoPanel: 'no contestó en 60 s', registro: registroDe(reg('aaaa0001', 's0-13octd', 'done')), ahora: AHORA });
  assert.equal(sin.codigo, SALIDA_CIEGO);
  assert.match(sin.lineas[0], /NO PUDE MIRAR \(salida 2\)/);
  assert.match(texto(sin), /no pude mirar el PANEL \(`claude agents --json`\): no contestó en 60 s/);
  assert.doesNotMatch(texto(sin), /✅|ninguna sesión bloqueada/);
  assert.match(texto(sin), /hay 0 bloqueadas, y con lo que falta por mirar eso NO vale como «nadie parado»/);

  const con = medir({ panel: null, motivoPanel: 'salió con código 1', registro: registroDe(reg('cccc0001', 's4-13octc', 'blocked', { needs: '¿sigo?', actualizado: hace(30) })), ahora: AHORA });
  assert.equal(con.codigo, SALIDA_CIEGO);
  assert.equal(con.datos.bloqueadas.length, 1);
  assert.match(texto(con), /\| S4 \| s4-13octc \| cccc0001 \|.*NO sale en el panel.*«¿sigo\?»/);
});

test('sin REGISTRO → 2, aunque el panel diga que todos trabajan', () => {
  const r = medir({ panel: [enPanel('aaaa0001', 's0-13octd', 'working', { pid: 1 })], registro: undefined, ahora: AHORA });
  assert.equal(r.codigo, SALIDA_CIEGO);
  assert.match(texto(r), /no pude mirar el REGISTRO/);
  assert.doesNotMatch(texto(r), /✅/);
});

test('una bloqueada del panel sin state.json que leer: sale en la tabla, y la salida es 2', () => {
  const base = { panel: [enPanel('cccc0001', 's3-13octc', 'blocked', { pid: 5 })], ahora: AHORA };
  const sinFichero = medir({ ...base, registro: { sesiones: [], ilegibles: [], sinEstado: ['cccc0001'] } });
  assert.equal(sinFichero.codigo, SALIDA_CIEGO);
  assert.equal(sinFichero.datos.bloqueadas.length, 1);
  assert.match(texto(sinFichero), /\| S3 \| s3-13octc \| cccc0001 \|.*NO PUDE LEERLO: no tiene state\.json/);
  const ilegible = medir({ ...base, registro: { sesiones: [], ilegibles: [{ id: 'cccc0001', motivo: 'SyntaxError' }], sinEstado: [] } });
  assert.equal(ilegible.codigo, SALIDA_CIEGO);
  assert.match(texto(ilegible), /su state\.json es ILEGIBLE \(SyntaxError\)/);
});

test('el disfraz: el panel dice `working` y el bloqueo vive en `tempo`/`needs` del registro', () => {
  const r = medir({
    panel: [enPanel('bbbb0001', 's3-13octc', 'working', { pid: 22048 })],
    registro: registroDe(reg('bbbb0001', 's3-13octc', 'working', { tempo: 'blocked', needs: 'approve Entering worktree', actualizado: hace(97) })),
    lineaDe: () => linea([97, 'working']),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  const b = r.datos.bloqueadas[0];
  assert.equal(b.disfraz, true);
  // Sin evento de parada en la línea de tiempo, el dato es otro y se rotula como otro.
  assert.equal(b.fuente, 'updatedAt');
  assert.match(texto(r), /2026-10-13T12:23Z \(`updatedAt`\) \| 97 min \| pid 22048 \| registro: tempo=blocked · registro: needs ⚠️ el panel la da por «working» \| «approve Entering worktree»/);
  assert.deepEqual(r.datos.puestos.S3.trabajando, []);
});

test('lo que sólo sabe el panel: espera un permiso y el registro no trae pregunta', () => {
  const r = medir({
    panel: [enPanel('bbbb0002', 's3-13octc', 'working', { pid: 3, status: 'waiting', waitingFor: 'permission prompt' })],
    registro: registroDe(reg('bbbb0002', 's3-13octc', 'working', { detalle: 'Fetching origin/main' })),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.match(texto(r), /panel: espera permission prompt/);
  // La pregunta no se inventa con el `detail`: se dice que no la hay y se enseña el `detail` con su nombre.
  assert.match(texto(r), /NO LO DICE \(sin `needs`\) · el panel: permission prompt · su `detail`: «Fetching origin\/main»/);
});

test('un RESTO no trabaja: el panel lo da por `working`, no tiene proceso y su registro dice que terminó', () => {
  const r = medir({
    panel: [enPanel('df2fa38f', 'sesion-5', 'working')],
    registro: registroDe(reg('df2fa38f', 'sesion-5', 'done', { actualizado: Date.parse('2026-09-18T13:50:15Z') })),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_NADIE);
  assert.deepEqual(r.datos.puestos.S5.trabajando, []);
  assert.deepEqual(r.datos.puestos.S5.resto, ['sesion-5']);
  assert.match(texto(r), /\| S5 \| 0 ⚠️ NADIE \| 0 \| 0 \| 1 \(sesion-5\) \| 0 \|/);
});

test('`working` sin proceso y sin haber terminado: no se sabe si trabaja → 2', () => {
  const r = medir({ panel: [enPanel('aaaa0002', 's1-13octd', 'working')], registro: registroDe(reg('aaaa0002', 's1-13octd', 'working')), ahora: AHORA });
  assert.equal(r.codigo, SALIDA_CIEGO);
  assert.match(texto(r), /1 sesión\(es\) que no sé si trabajan \(s1-13octd \(aaaa0002\): sin pid, pero su state\.json no dice que haya terminado\)/);
  assert.deepEqual(r.datos.puestos.S1.trabajando, []);
});

test('un `state` del panel que no se conoce no se cuenta como nada: → 2', () => {
  const r = medir({ panel: [enPanel('aaaa0003', 's1-13octd', 'paused', { pid: 4 })], registro: registroDe(reg('aaaa0003', 's1-13octd', 'working')), ahora: AHORA });
  assert.equal(r.codigo, SALIDA_CIEGO);
  assert.match(texto(r), /un state que no conozco \(«paused»\)/);
});

test('lo que el panel NO lista y el registro sí', async (t) => {
  await t.test('bloqueada de hoy → sale, marcada', () => {
    const r = medir({ panel: [], registro: registroDe(reg('ffff0001', 's3-1octb', 'working', { tempo: 'blocked', needs: 'approve X', actualizado: hace(40) })), ahora: AHORA });
    assert.equal(r.codigo, SALIDA_HAY);
    assert.match(texto(r), /\| S3 \| s3-1octb \| ffff0001 \|.*⚠️ NO sale en el panel \| «approve X»/);
  });
  await t.test('`working` de hoy → no se sabe si trabaja: 2', () => {
    const r = medir({ panel: [], registro: registroDe(reg('ffff0002', 's3-1octb', 'working', { actualizado: hace(40) })), ahora: AHORA });
    assert.equal(r.codigo, SALIDA_CIEGO);
    assert.match(texto(r), /el registro la da por «working» y el panel NO la lista/);
  });
  await t.test('terminada sin pregunta → no es nada', () => {
    const r = medir({ panel: [], registro: registroDe(reg('ffff0003', 's3-1octb', 'done'), reg('ffff0004', 's3-1octc', 'stopped')), ahora: AHORA });
    assert.equal(r.codigo, SALIDA_NADIE);
    assert.equal(r.datos.filas.length, 0);
  });
  await t.test('bloqueada de hace tres días → no entra en la tabla; se cuenta y se manda al cementerio', () => {
    const r = medir({ panel: [], registro: registroDe(reg('ffff0005', 's3-10oct', 'blocked', { needs: 'vieja', actualizado: hace(3 * 24 * 60) })), ahora: AHORA });
    assert.equal(r.codigo, SALIDA_NADIE);
    assert.equal(r.datos.viejas, 1);
    assert.match(texto(r), /1 trabajo\(s\) de más de 24 h .*latido\.mjs preguntas/);
  });
});

test('una sesión que no es de ningún puesto también cuenta si está bloqueada', () => {
  const r = medir({
    panel: [enPanel('883375c0', '883375c0', 'blocked', { pid: 9128, status: 'idle' })],
    registro: registroDe(reg('883375c0', '883375c0', 'working', { tempo: 'blocked', needs: 'send a prompt to start', actualizado: hace(4) })),
    ahora: AHORA,
  });
  assert.equal(r.codigo, SALIDA_HAY);
  assert.match(r.lineas[0], /1 SESIÓN\(ES\) BLOQUEADA\(S\) en 1 puesto\(s\) \(sin puesto\)/);
  assert.match(texto(r), /\| sin puesto \| 0 \| 1 \(883375c0\) \|/);
});

test('paradaDesde: la línea de tiempo manda; sin parada en ella, la última escritura; sin nada, no se sabe', () => {
  const r = reg('x', 's0-a', 'blocked', { actualizado: hace(10) });
  // Dos paradas seguidas sin `working` en medio son la MISMA espera: cuenta desde la primera.
  assert.deepEqual(paradaDesde(r, linea([90, 'working'], [80, 'blocked'], [10, 'blocked'])), { desde: hace(80), fuente: 'timeline' });
  assert.deepEqual(paradaDesde(r, linea([90, 'working'])), { desde: hace(10), fuente: 'updatedAt' });
  assert.deepEqual(paradaDesde(r, null), { desde: hace(10), fuente: 'updatedAt' });
  assert.deepEqual(paradaDesde(undefined, null), { desde: null, fuente: 'no se sabe' });
});

test('leerPanel: o la lista, o POR QUÉ no — nunca una lista vacía por un fallo', () => {
  const con = (r) => leerPanel({ orden: ['claude-de-prueba', '--previo'], topeMs: 5000, lanzar: (...llamada) => { con.llamada = llamada; return r; } });
  assert.deepEqual(con({ status: 0, stdout: '[{"id":"a"}]', stderr: '' }), { panel: [{ id: 'a' }] });
  assert.equal(con.llamada[0], 'claude-de-prueba');
  assert.deepEqual(con.llamada[1], ['--previo', 'agents', '--json']);
  assert.equal(con.llamada[2].timeout, 5000);
  // Una lista vacía de verdad es una lista: quien decide qué significa es `medir`, con el registro delante.
  assert.deepEqual(con({ status: 0, stdout: '[]', stderr: '' }), { panel: [] });
  assert.deepEqual(con({ error: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }), { panel: null, motivo: 'no contestó en 5 s' });
  assert.deepEqual(con({ error: Object.assign(new Error('x'), { code: 'ENOENT' }) }), { panel: null, motivo: 'no se pudo lanzar (ENOENT)' });
  assert.deepEqual(con({ status: 1, stdout: '[]', stderr: 'not logged in\n' }), { panel: null, motivo: 'salió con código 1: not logged in' });
  assert.deepEqual(con({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' }), { panel: null, motivo: 'salió con la señal SIGKILL' });
  assert.deepEqual(con({ status: 0, stdout: 'Usage: claude …', stderr: '' }), { panel: null, motivo: 'su salida no es JSON' });
  assert.deepEqual(con({ status: 0, stdout: '{"agents":[]}', stderr: '' }), { panel: null, motivo: 'su salida no es una lista' });
});

test('ordenPorDefecto: en Windows `claude` es un .cmd y se lanza por el intérprete', () => {
  assert.deepEqual(ordenPorDefecto('win32', { ComSpec: 'C:\\W\\cmd.exe' }), ['C:\\W\\cmd.exe', '/d', '/s', '/c', 'claude']);
  assert.deepEqual(ordenPorDefecto('linux', {}), ['claude']);
});

test('de punta a punta: el guion de verdad, con un panel doblado y un registro fabricado', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1357b-'));
  try {
    const jobs = path.join(tmp, 'jobs');
    const ahora = Date.now();
    const trabajo = (id, estado, eventos) => {
      fs.mkdirSync(path.join(jobs, id), { recursive: true });
      fs.writeFileSync(path.join(jobs, id, 'state.json'), JSON.stringify(estado));
      fs.writeFileSync(path.join(jobs, id, 'timeline.jsonl'), eventos.map(([min, state]) => JSON.stringify({ at: iso(ahora - min * 60_000), state })).join('\n'));
    };
    trabajo('dddd0001', { name: 's1-13octd', state: 'working', tempo: 'active', updatedAt: iso(ahora - 60_000), createdAt: iso(ahora - 600_000) }, [[10, 'working']]);
    trabajo('cccc0001', { name: 's1-13octc', state: 'blocked', tempo: 'blocked', needs: '¿los repartes tú?', updatedAt: iso(ahora - 70 * 60_000), createdAt: iso(ahora - 120 * 60_000) }, [[75, 'working'], [70, 'blocked']]);
    const doble = (nombre, cuerpo) => { const f = path.join(tmp, nombre); fs.writeFileSync(f, cuerpo); return JSON.stringify([process.execPath, f]); };
    const panel = [{ id: 'dddd0001', name: 's1-13octd', kind: 'background', state: 'working', pid: 4242, status: 'busy' }, { id: 'cccc0001', name: 's1-13octc', kind: 'background', state: 'blocked' }];
    const correr = (orden, ...args) => spawnSync(process.execPath, [GUION, '--jobs', jobs, ...args], { encoding: 'utf8', env: { ...process.env, PARADOS_CLAUDE: orden } });

    // El doble comprueba que le piden lo mismo que al panel: `agents --json`.
    const bueno = doble('panel.mjs', `if (process.argv.slice(2).join(' ') !== 'agents --json') process.exit(9);\nprocess.stdout.write(${JSON.stringify(JSON.stringify(panel))});\n`);
    const r = correr(bueno);
    assert.equal(r.status, SALIDA_HAY, r.stdout + r.stderr);
    assert.match(r.stdout, /^🔴 PARADOS · 1 SESIÓN\(ES\) BLOQUEADA\(S\) en 1 puesto\(s\) \(S1\) · la más antigua, hace 70 min/);
    assert.match(r.stdout, /\| S1 \| s1-13octc \| cccc0001 \|.*«¿los repartes tú\?»/);
    assert.match(r.stdout, /\| S1 \| 1 \(s1-13octd\) \| 1 \(s1-13octc\) \|/);
    const j = correr(bueno, '--json');
    assert.equal(j.status, SALIDA_HAY);
    assert.deepEqual(JSON.parse(j.stdout).bloqueadas.map((b) => b.id), ['cccc0001']);

    // El panel que falla, el que no es JSON y la orden ilegible: los tres son «no pude mirar».
    for (const [orden, patron] of [
      [doble('roto.mjs', 'process.stderr.write("boom\\n"); process.exit(3);\n'), /no pude mirar el PANEL \(`claude agents --json`\): salió con código 3: boom/],
      [doble('prosa.mjs', 'process.stdout.write("no agents\\n");\n'), /su salida no es JSON/],
      ['claude agents', /PARADOS_CLAUDE no se deja leer/],
    ]) {
      const c = correr(orden);
      assert.equal(c.status, SALIDA_CIEGO, c.stdout + c.stderr);
      assert.match(c.stdout, /^🔴 PARADOS · NO PUDE MIRAR \(salida 2\)/);
      assert.match(c.stdout, patron);
      assert.doesNotMatch(c.stdout, /✅/);
      // Y lo que el registro sí dice no se pierde por eso.
      assert.match(c.stdout, /\| S1 \| s1-13octc \| cccc0001 \|/);
    }

    // Sin carpeta de trabajos tampoco hay «nadie».
    const sinJobs = spawnSync(process.execPath, [GUION, '--jobs', path.join(tmp, 'no-existe')], { encoding: 'utf8', env: { ...process.env, PARADOS_CLAUDE: bueno } });
    assert.equal(sinJobs.status, SALIDA_CIEGO, sinJobs.stdout + sinJobs.stderr);
    assert.match(sinJobs.stdout, /no pude mirar el REGISTRO/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
