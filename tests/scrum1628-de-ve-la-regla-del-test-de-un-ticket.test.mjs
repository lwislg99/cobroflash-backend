// SCRUM-1628 · `carriles.mjs de tests/<test de un ticket>` decía «sin fila en §3: nadie lo reclama» para
// CUALQUIER test, también para los que tienen dueño: `dos-equipos.md` §3 dice que «el test de un ticket» es
// del puesto que trabaja ese ticket, y eso es una REGLA, no una ruta. El instrumento sólo casa rutas, así que
// no la veía y contestaba como si no existiera: su «no» era indistinguible de «no puedo verlo».
//
// Ahora lo dice: NO-PUDE-MIRAR, el ticket, la línea de la regla y dónde está el dueño (la etiqueta de Jira),
// con salida 2. Y lo que NO cambia es la mitad del arreglo: un test huérfano de verdad sigue saliendo huérfano
// (si no, el arreglo sería «todo tiene dueño», la mentira contraria) y un fichero que no es test contesta igual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { construirMapa, reglaDe, testDeTicket, filasSinRuta, FUENTE } from '../scripts/_carriles.mjs';
import { ficherosDelRepo } from '../scripts/carriles.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'carriles.mjs');
const TABLA = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8');

// Los `node` hijos NO heredan el entorno de la tanda (SCRUM-1349).
const entorno = { ...process.env };
delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;
const de = (...rels) => spawnSync(process.execPath, [CLI, 'de', ...rels.map((r) => path.join(RAIZ, r))], { cwd: RAIZ, env: entorno, encoding: 'utf8' });

// El rojo de partida, medido por la S5 el 27-oct-2026: el test de su propio ticket.
const ROJO = 'tests/scrum1621-latido-vigia-de-main-y-tanda.test.mjs';
// La línea de la regla se BUSCA en la tabla por su texto: si se mueve, el test la sigue; si desaparece, cae.
const REGLA = TABLA.replace(/\r\n/g, '\n').split('\n').findIndex((l) => /^\| `tests\/`: el test de un ticket \|/.test(l)) + 1;

test('SCRUM-1628 · la regla «el test de un ticket» está en la tabla y el instrumento la encuentra donde está', () => {
  assert.ok(REGLA > 0, `${FUENTE} ya no tiene la fila «\`tests/\`: el test de un ticket»: este test describe una regla que no existe`);
  const filas = filasSinRuta(TABLA);
  assert.ok(filas.some((f) => f.linea === REGLA && f.prefijo === 'tests/'), `filasSinRuta la ve en :${REGLA} (vio: ${filas.map((f) => `:${f.linea} ${f.que}`).join(' · ')})`);
});

test('SCRUM-1628 · el rojo de partida: el test de SCRUM-1621 deja de decir «nadie lo reclama» y dice que no puede mirar, y dónde mirar', () => {
  // No se exige que exista: el 27-oct vivía en la rama de S5, sin mergear, y la S5 preguntó igual por él. Que la
  // regla vale también para los que SÍ existen lo mide el censo de abajo, sobre todo tests/.
  const r = de(ROJO);
  assert.equal(r.status, 2, `salida 2 = NO-PUDE-MIRAR, no un verde:\n${r.stdout}${r.stderr}`);
  assert.doesNotMatch(r.stdout, /nadie lo reclama$/m, r.stdout);
  assert.match(r.stdout, new RegExp(`^${ROJO} → NO-PUDE-MIRAR: .*el test de SCRUM-1621\\b`, 'm'), 'nombra el ticket');
  assert.match(r.stdout, new RegExp(`${FUENTE.replace(/[.]/g, '\\.')}:${REGLA}\\b`), `cita la regla en :${REGLA}`);
  assert.match(r.stdout, /etiqueta area-… de SCRUM-1621 en Jira/, 'y dice dónde está el dueño');
});

test('SCRUM-1628 · censo de tests/: cada test sin fila es O test de un ticket (NO-PUDE-MIRAR) O huérfano de verdad, nunca los dos', () => {
  const ficheros = ficherosDelRepo();
  const mapa = construirMapa(TABLA, ficheros);
  assert.deepEqual(mapa.errores, [], 'la tabla se convierte sin errores');
  const tests = ficheros.filter((f) => f.startsWith('tests/'));
  const sinFila = tests.filter((f) => !reglaDe(f, mapa));
  const deTicket = sinFila.filter((f) => testDeTicket(f, TABLA));
  const huerfanos = sinFila.filter((f) => !testDeTicket(f, TABLA));
  // Población y suelos: medido el 27-oct-2026, 1784 en tests/ · 1771 sin fila · 1514 de ticket · 257 huérfanos.
  assert.ok(tests.length >= 1000, `población: ${tests.length} ficheros en tests/`);
  assert.ok(deTicket.length >= 1000, `población: ${deTicket.length} tests de ticket sin fila de ruta (suelo 1000)`);
  assert.ok(huerfanos.length >= 1, `población: ${huerfanos.length} huérfanos de verdad; sin ninguno no hay control positivo`);
  for (const f of deTicket) assert.match(f, /^tests\/scrum-?\d+/i, `${f}: sólo un nombre con número de ticket es «el test de un ticket»`);
  for (const f of huerfanos) assert.doesNotMatch(f, /^tests\/scrum-?\d+/i, `${f}: lleva número de ticket y salió huérfano`);
});

test('SCRUM-1628 · CONTROL POSITIVO: un fichero de tests/ huérfano de verdad sigue saliendo «nadie lo reclama», con salida 0', () => {
  const ficheros = ficherosDelRepo();
  const mapa = construirMapa(TABLA, ficheros);
  const huerfano = ficheros.find((f) => f.startsWith('tests/_') && !reglaDe(f, mapa) && !testDeTicket(f, TABLA));
  assert.ok(huerfano, 'población: hay al menos un ayudante de tests/ sin fila');
  for (const f of [huerfano, 'tests/_un-ayudante-que-no-existe-1628.mjs']) {
    const r = de(f);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`^${f.replace(/[.]/g, '\\.')} → sin fila en §3: nadie lo reclama$`, 'm'), r.stdout);
    assert.doesNotMatch(r.stdout, /NO-PUDE-MIRAR/, r.stdout);
  }
});

test('SCRUM-1628 · un test de ticket CON fila de ruta sigue dando su fila; la regla sólo habla donde no hay fila', () => {
  const f = 'tests/scrum1516c-frontera-en-el-obligatorio.test.mjs';
  const r = de(f);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`^${f.replace(/[.]/g, '\\.')} → J6 \\(puesto\\)`, 'm'), r.stdout);
});

test('SCRUM-1628 · CONTROL NEGATIVO: fuera de tests/ la regla nunca se aplica (todo el repo), y `de` contesta lo de antes', () => {
  const fuera = ficherosDelRepo().filter((f) => !f.startsWith('tests/'));
  assert.ok(fuera.length >= 1000, `población: ${fuera.length} ficheros fuera de tests/`);
  assert.deepEqual(fuera.filter((f) => testDeTicket(f, TABLA)), [], 'ninguno es «el test de un ticket»');
  const r = de('scripts/equipo/latido.mjs', 'public/dashboard/js/homeView.js', 'scripts/carriles.mjs');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lineas = r.stdout.split(/\r?\n/).filter((l) => / → /.test(l) && !l.startsWith(' '));
  assert.ok(lineas[0].startsWith('scripts/equipo/latido.mjs → S5 (puesto) · docs/equipo/dos-equipos.md:'), lineas[0]);
  assert.ok(lineas[1].startsWith('public/dashboard/js/homeView.js → S2 '), lineas[1]);
  assert.ok(lineas[2].startsWith('scripts/carriles.mjs → S0 '), lineas[2]);
});

test('SCRUM-1628 · sin la fila «el test de un ticket» en la tabla, el instrumento no la inventa: vuelve a «nadie lo reclama»', () => {
  const sinRegla = TABLA.replace(/\r\n/g, '\n').split('\n').filter((l) => !/^\| `tests\/`: el test de un ticket \|/.test(l)).join('\n');
  assert.notEqual(sinRegla.length, TABLA.replace(/\r\n/g, '\n').length, 'la mutación se aplicó');
  assert.equal(testDeTicket(ROJO, sinRegla), null);
  assert.deepEqual(testDeTicket(ROJO, TABLA), { ticket: 'SCRUM-1621', fila: filasSinRuta(TABLA).find((x) => x.linea === REGLA) });
});
