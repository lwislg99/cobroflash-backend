// SCRUM-1633 · `carriles.mjs de <ruta>` afirmaba el dueño de ficheros QUE NO EXISTEN. Una errata bajo un patrón
// contestaba un puesto con su fila y su línea (`public/dashboard/js/jobsVieww.js` → «S2», y el bueno es de S4), y
// fuera de todo patrón contestaba «nadie lo reclama». Las dos con salida 0: una ruta mal tecleada y una buena no se
// distinguían, y la mala venía con toda la pinta de una medida.
//
// Ahora una ruta que no está ni en `git ls-files` ni en disco sale NO-PUDE-MIRAR, con salida 2 y SIN nombrar
// puesto. Quien va a CREAR un fichero lo pregunta a propósito (`de --nueva <ruta>`), y la respuesta lo dice.
// Y lo que NO cambia es la otra mitad: los ficheros reales contestan lo de antes, y el huérfano de verdad sigue
// saliendo huérfano, distinto de «no existe» (si no, el arreglo sería «no contestar nunca»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { construirMapa, reglaDe, testDeTicket, FUENTE } from '../scripts/_carriles.mjs';
import { ficherosDelRepo, respuestaDe } from '../scripts/carriles.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'carriles.mjs');
const TABLA = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8');

// Los `node` hijos NO heredan el entorno de la tanda (SCRUM-1349).
const entorno = { ...process.env };
delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;
const de = (...args) => spawnSync(process.execPath, [CLI, 'de', ...args.map((a) => (a.startsWith('--') ? a : path.join(RAIZ, a)))], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Los rojos de partida, medidos por S3 (29-oct-2026, ~10:25Z) y por S0 (17:3xZ) sobre `5deff8b3b` y `eafca9fe1`.
const INEXISTENTES = [
  'public/dashboard/js/inventado-xyz-1630.js', // dentro de public/** → decía «S2»
  'zzz-inventado/no-existe-1630.txt', // fuera de todo patrón → decía «nadie lo reclama»
  'public/dashboard/js/jobsVieww.js', // errata de jobsView.js (S4) → decía «S2»
  'src/modules/fiscal/nada-inventado.ts', // → decía «J1»
  'tests/no-existe-scrum1295.test.mjs', // → decía «nadie lo reclama»
];

test('SCRUM-1633 · población: ninguna de las rutas inventadas existe, y sí existen las de control', () => {
  for (const f of INEXISTENTES) assert.equal(fs.existsSync(path.join(RAIZ, f)), false, `${f} existe: ya no sirve de rojo`);
  for (const f of ['public/dashboard/js/settingsView.js', 'public/dashboard/js/jobsView.js', 'scripts/carriles.mjs']) {
    assert.ok(fs.existsSync(path.join(RAIZ, f)), `${f}: el control tiene que existir`);
  }
});

test('SCRUM-1633 · una ruta que no existe sale NO-PUDE-MIRAR con salida 2, y no nombra ningún puesto', () => {
  for (const f of INEXISTENTES) {
    const r = de(f);
    assert.equal(r.status, 2, `${f}: salida 2, no un verde:\n${r.stdout}${r.stderr}`);
    const linea = r.stdout.split(/\r?\n/).find((l) => l.startsWith(`${f} → `));
    assert.ok(linea, `${f}: contesta su ruta:\n${r.stdout}`);
    assert.match(linea, /^[^ ]+ → NO-PUDE-MIRAR: esa ruta no existe/, linea);
    assert.doesNotMatch(linea, /nadie lo reclama|SIN CERRADURA|\((?:puesto|contenedor)\)|\b[SJ]\d\b/, `${f}: no afirma dueño: ${linea}`);
  }
});

test('SCRUM-1633 · varias rutas: una inexistente pone la salida en 2 aunque las demás contesten bien', () => {
  const r = de('scripts/carriles.mjs', 'zzz-inventado/no-existe-1630.txt');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /^scripts\/carriles\.mjs → S0 \(puesto\)/m, r.stdout);
});

test('SCRUM-1633 · CONTROL POSITIVO: los ficheros reales contestan lo de siempre, con su fila', () => {
  const r = de('public/dashboard/js/settingsView.js', 'public/dashboard/js/jobsView.js', 'scripts/carriles.mjs');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`^public/dashboard/js/settingsView\\.js → J3 \\(contenedor\\) · ${escapar(FUENTE)}:\\d+ `, 'm'), r.stdout);
  assert.match(r.stdout, /^public\/dashboard\/js\/jobsView\.js → S4 /m, r.stdout);
  assert.match(r.stdout, /^scripts\/carriles\.mjs → S0 \(puesto\)/m, r.stdout);
  assert.doesNotMatch(r.stdout, /no existe|RUTA NUEVA/, r.stdout);
});

test('SCRUM-1633 · censo: ningún fichero del repo cae en «no existe», y cada uno contesta lo que dice su fila', () => {
  const ficheros = ficherosDelRepo();
  const mapa = construirMapa(TABLA, ficheros);
  const existe = new Set(ficheros);
  // Población: medido el 29-oct-2026 en eafca9fe1, 7852 ficheros.
  assert.ok(ficheros.length >= 5000, `población: ${ficheros.length} ficheros`);
  let conDueno = 0;
  for (const f of ficheros) {
    const { linea, ciego } = respuestaDe(f, { mapa, tabla: TABLA, existe: (x) => existe.has(x) });
    assert.doesNotMatch(linea, /no existe|RUTA NUEVA/, linea);
    const r = reglaDe(f, mapa);
    if (r) { conDueno++; assert.ok(linea.startsWith(`${f} → ${r.puesto ?? 'SIN CERRADURA'} (${r.tipo}) · `), linea); }
    assert.equal(ciego, !r && Boolean(testDeTicket(f, TABLA)), `${f}: sólo el test de un ticket sin fila deja la salida en 2`);
  }
  assert.ok(conDueno >= 1000, `población: ${conDueno} con fila`);
});

test('SCRUM-1633 · CONTROL del huérfano de verdad: existe, no tiene fila, y sale «nadie lo reclama» con 0, distinto de «no existe»', () => {
  const ficheros = ficherosDelRepo();
  const mapa = construirMapa(TABLA, ficheros);
  const huerfano = ficheros.find((f) => f.startsWith('tests/_') && !reglaDe(f, mapa) && !testDeTicket(f, TABLA));
  assert.ok(huerfano, 'población: hay al menos un huérfano de verdad');
  const r = de(huerfano);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`^${escapar(huerfano)} → sin fila en §3: nadie lo reclama$`, 'm'), r.stdout);
});

test('SCRUM-1633 · `--nueva` contesta sobre una ruta que aún no existe, y lo DICE en la misma línea', () => {
  const r = de('--nueva', 'public/dashboard/js/inventado-xyz-1630.js', 'zzz-inventado/no-existe-1630.txt');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^public\/dashboard\/js\/inventado-xyz-1630\.js → RUTA NUEVA \(hoy no existe\) · S2 \(puesto\)/m, r.stdout);
  assert.match(r.stdout, /^zzz-inventado\/no-existe-1630\.txt → RUTA NUEVA \(hoy no existe\) · sin fila en §3: nadie lo reclama$/m, r.stdout);
  // Sobre un fichero que SÍ existe, `--nueva` no cambia nada: no lo marca como nuevo.
  const s = de('--nueva', 'scripts/carriles.mjs');
  assert.equal(s.status, 0, s.stdout + s.stderr);
  assert.match(s.stdout, /^scripts\/carriles\.mjs → S0 \(puesto\)/m, s.stdout);
  assert.doesNotMatch(s.stdout, /RUTA NUEVA/, s.stdout);
});

test('SCRUM-1633 · un fichero que existe en disco y aún no está en git (el que estás creando) contesta normal', () => {
  const ficheros = ficherosDelRepo();
  const mapa = construirMapa(TABLA, ficheros);
  const f = 'public/dashboard/js/inventado-xyz-1630.js';
  assert.match(respuestaDe(f, { mapa, tabla: TABLA, existe: () => true }).linea, /^public\/dashboard\/js\/inventado-xyz-1630\.js → S2 \(puesto\)/);
  assert.match(respuestaDe(f, { mapa, tabla: TABLA, existe: () => false }).linea, /→ NO-PUDE-MIRAR: esa ruta no existe/);
});
