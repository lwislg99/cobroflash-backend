// tests/scrum1811-vigia-lista-procesos.test.mjs — SCRUM-1811 (hijo de SCRUM-1527, para S5)
//
// Sin gate, sin BD, sin red. El vigía de la tanda (`scripts/tanda-con-veredicto.mjs`) paraba el árbol del hijo
// al pasar su tope de silencio SIN listar qué mataba (SCRUM-1527b §⑧.1), y así cada colgada del CI se
// clasificaba a ciegas. Ahora, antes de matar, escribe al log (salida de error) cada proceso del árbol con su
// pid, su padre, su RSS y su línea de órdenes.
//
//   ① POR EFECTO: una tanda muda de verdad sale con 3, y ANTES de parar su árbol lista el proceso colgado
//      —encontrado por una marca en su línea de órdenes— con su RSS;
//   ② el árbol es el del hijo: descendientes por padre y su grupo; un node ajeno con la MISMA orden no entra;
//   ③ leer `ps`: líneas de órdenes con espacios, y basura que no es una fila;
//   ④ no poder listar se DICE (fail-closed): ni el error ni una lista vacía pasan por «no había nada».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leerPs, leerProcesosWindows, arbolDeProcesos, redactarArbol, listarArbol } from '../scripts/_huella-de-la-caida.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El vigía vuelve a matar sin listar.
    fichero: 'scripts/tanda-con-veredicto.mjs',
    // La señal va PARTIDA: este test no lee la plataforma, sólo cita la línea (el censo de SCRUM-702 la contaría).
    // Se parte con un ESCAPE dentro de un único literal (el escape unicode del punto): el meta-guard sólo acepta un
    // literal de cadena y lee su valor ya cocinado, así que la mutación es la línea exacta. Con una plantilla
    // `${…}` el meta-guard la declara ILEGIBLE y sale 2 (CI del 24-nov, run 45463680370).
    de: '  process.stderr.write(redactarArbol(listarArbol(hijo.pid, { spawnSync, plataforma: process\u002eplatform }), hijo.pid));\n',
    a: '',
    cae: 'SCRUM-1811 ① ·',
  },
  {
    // El árbol se ensancha a TODA la tabla de procesos de la máquina.
    fichero: 'scripts/_huella-de-la-caida.mjs',
    de: '  return filas.filter((f) => dentro.has(f.pid)).sort((a, b) => a.pid - b.pid);',
    a: '  return filas.slice().sort((a, b) => a.pid - b.pid);',
    cae: 'SCRUM-1811 ② ·',
  },
  {
    // Una lista vacía pasa por un listado bueno.
    fichero: 'scripts/_huella-de-la-caida.mjs',
    de: "  if (!r.filas.length) return `   🔴 la lista de procesos no trae ni el propio hijo",
    a: "  if (false) return `   🔴 la lista de procesos no trae ni el propio hijo",
    cae: 'SCRUM-1811 ④ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENVOLTORIO = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');
const entorno = (extra = {}) => { const e = { ...process.env, ...extra }; delete e.NODE_TEST_CONTEXT; delete e.NODE_OPTIONS; delete e.FORCE_COLOR; return e; };

test('SCRUM-1811 ① · POR EFECTO: antes de parar una tanda muda, el vigía lista el proceso colgado con su RSS', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1811-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // Un hijo que calla y no escribe nunca; la marca en su línea de órdenes lo identifica en la lista.
  const marca = `marca1811${process.pid}`;
  const r = spawnSync(process.execPath, [ENVOLTORIO, 'node', '-e', `setInterval(()=>{},1000) // ${marca}`],
    { cwd: dir, env: entorno({ TANDA_SILENCIO_MAX_MIN: '0.05' }), encoding: 'utf8', timeout: 120_000 });
  assert.notEqual(r.error?.code, 'ETIMEDOUT', 'la tanda muda no salió: la mató el tope externo del test');
  assert.equal(r.status, 3, `salida ${r.status}: ${r.stderr.slice(-600)}`);
  assert.match(r.stderr, /TANDA SIN VEREDICTO/);
  assert.match(r.stderr, /PROCESOS DEL ÁRBOL \d+ antes de pararlo \(SCRUM-1811\): \d+, RSS sumado [\d.]+ MB/, `sin la lista: ${r.stderr.slice(-800)}`);
  const linea = r.stderr.split('\n').find((l) => l.includes(marca) && /^\s+pid \d+ · padre \d+ · RSS [\d.]+ MB · /.test(l));
  assert.ok(linea, `el proceso colgado no está en la lista:\n${r.stderr.slice(-1200)}`);
});

const FILAS = [
  { pid: 100, ppid: 1, pgid: 100, rssKB: 51200, orden: 'node scripts/tanda-con-veredicto.mjs node --test' },
  { pid: 101, ppid: 100, pgid: 100, rssKB: 1024 * 900, orden: 'node --test tests/a.test.mjs' },
  { pid: 105, ppid: 101, pgid: 100, rssKB: 2048, orden: 'node tests/a.test.mjs' },
  // Re-parentado a init al morir su padre, pero sigue en el grupo del hijo: es del árbol.
  { pid: 107, ppid: 1, pgid: 100, rssKB: 4096, orden: 'node huerfano.mjs' },
  // Otra sesión de la máquina, con la MISMA orden: no es del árbol.
  { pid: 200, ppid: 1, pgid: 200, rssKB: 999999, orden: 'node --test tests/a.test.mjs' },
];

test('SCRUM-1811 ② · el árbol es el del hijo (padre y grupo), nunca «todos los node»', () => {
  assert.deepEqual(arbolDeProcesos(FILAS, 101).map((f) => f.pid), [105, 101].sort((a, b) => a - b));
  assert.deepEqual(arbolDeProcesos(FILAS, 100).map((f) => f.pid), [100, 101, 105, 107]);
  const sinGrupo = FILAS.map((f) => ({ ...f, pgid: null })); // así llega en Windows
  assert.deepEqual(arbolDeProcesos(sinGrupo, 100).map((f) => f.pid), [100, 101, 105]);
  const texto = redactarArbol({ filas: arbolDeProcesos(FILAS, 100) }, 100);
  assert.match(texto, /: 4, RSS sumado 956\.0 MB/); // 50 + 900 + 2 + 4
  assert.match(texto, /pid 101 · padre 100 · RSS 900\.0 MB · node --test tests\/a\.test\.mjs/);
  assert.doesNotMatch(texto, /pid 200/);
});

test('SCRUM-1811 ③ · `ps` se lee con espacios en la orden y sin tragarse basura', () => {
  const salida = '  100     1   100 51200 node scripts/tanda-con-veredicto.mjs node --test a b\n'
    + '101 100 100 2048 /usr/bin/node --test --test-reporter=spec "tests/x y.test.mjs"\n'
    + 'no es una fila\n\n';
  assert.deepEqual(leerPs(salida), [
    { pid: 100, ppid: 1, pgid: 100, rssKB: 51200, orden: 'node scripts/tanda-con-veredicto.mjs node --test a b' },
    { pid: 101, ppid: 100, pgid: 100, rssKB: 2048, orden: '/usr/bin/node --test --test-reporter=spec "tests/x y.test.mjs"' },
  ]);
  // Windows: tabuladores, bytes, un proceso del sistema sin línea de órdenes y sin memoria leída.
  const win = '4\t0\t\t\r\n100\t1\t52428800\t"C:\\node.exe" scripts\\tanda-con-veredicto.mjs\r\nbasura\r\n';
  assert.deepEqual(leerProcesosWindows(win).map((f) => [f.pid, f.ppid, f.rssKB, f.orden]),
    [[4, 0, NaN, ''], [100, 1, 51200, '"C:\\node.exe" scripts\\tanda-con-veredicto.mjs']]);
  assert.match(redactarArbol({ filas: [{ pid: 4, ppid: 0, rssKB: NaN, orden: '' }] }, 4), /RSS ¿\? MB · \(sin línea de órdenes\)/);
});

test('SCRUM-1811 ④ · no poder listar se dice, y una lista vacía no es «no había nada»', () => {
  assert.match(redactarArbol({ error: 'ps salió 1' }, 42), /NO PUDE LISTAR los procesos del árbol 42 antes de pararlo: ps salió 1\. Se para igual\./);
  assert.match(redactarArbol(undefined, 42), /NO PUDE LISTAR .*sin respuesta/);
  assert.match(redactarArbol({ filas: [] }, 42), /no trae ni el propio hijo \(42\): NO es «no había nada»/);
  // Sin plataforma no adivina, y un `ps` que falla es un error, no una lista vacía.
  assert.deepEqual(listarArbol(42, { spawnSync: () => ({ status: 0, stdout: '' }) }), { error: 'quien llama no dijo la plataforma' });
  assert.deepEqual(listarArbol(42, { spawnSync: () => ({ status: 1, stdout: '' }), plataforma: 'linux' }), { error: 'ps salió 1' });
});
