// SCRUM-1357g · `parados.mjs --control`: el control positivo que se corre sin `npm test`.
//
// POR QUÉ. El 18-oct-2026 el orquestador pidió pasar a `scripts/equipo/` un vigía suyo que llevaba
// `--control`. Medido contra el panel de verdad: con su filtro por defecto salía 0 sin mirar a nadie, y no
// veía una sesión BLOQUEADA. Su control seguía verde porque probaba una COPIA de la condición, no la que
// usaba el programa. Éste pasa por las piezas de verdad (`leerPanel`, `leerTrabajos`, `medir`).
//
// LO QUE SE PRUEBA AQUÍ: que la orden sale 0 y nombra los cinco casos; y, sobre todo, que el control CAE
// cuando una pieza se equivoca. Cada pieza rota es un defecto que ya tuvimos:
//   · `leerPanel` que devuelve una lista vacía cuando no pudo leer (el vigía del 13-oct: «nadie parado»);
//   · `leerTrabajos` que se salta el state.json ilegible (el `continue` que corrigió SCRUM-1357);
//   · `medir` que no mira `needs`/`tempo` (el panel da por `working` a una bloqueada);
//   · `medir` que con el panel ciego contesta 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { control, medir, leerPanel } from '../scripts/equipo/parados.mjs';
import { leerTrabajos } from '../scripts/equipo/latido.mjs';

const GUION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'equipo', 'parados.mjs');

/** El caso del control que sale 🔴, por su nombre. */
const caidos = (c) => c.lineas.filter((l) => /^ {2}🔴 /.test(l));

test('SCRUM-1357g · `--control` sale 0, nombra los cinco casos y NO mira el panel de verdad', () => {
  // Con `PARADOS_CLAUDE` roto, la foto de verdad saldría 2 («no pude mirar el PANEL»): si el control
  // la estuviera haciendo, se vería aquí.
  const r = spawnSync(process.execPath, [GUION, '--control'], { encoding: 'utf8', timeout: 60000, env: { ...process.env, PARADOS_CLAUDE: '["no-existe-esta-orden-1357g"]' } });
  assert.equal(r.status, 0, `el control tenía que salir 0:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /^✅ PARADOS · CONTROL: caza los 5 casos/);
  for (const caso of ['una que trabaja', 'una que acabó su turno con proceso', 'una bloqueada que el panel da por working', 'un panel que no se puede leer', 'un state.json ilegible']) {
    assert.match(r.stdout, new RegExp(`✔ ${caso} → `), `falta el caso «${caso}»:\n${r.stdout}`);
  }
  // «NO PUDE MIRAR» a secas no vale de chivato: lo dice la descripción del cuarto caso. La foto de verdad
  // lo escribe detrás de «PARADOS ·».
  assert.doesNotMatch(r.stdout, /mirado a las|PARADOS · NO PUDE MIRAR|🔴/, `el control ha hecho la foto de verdad, o algo ha caído:\n${r.stdout}`);
});

test('SCRUM-1357g · con las piezas de verdad, `control()` da ok', () => {
  const c = control();
  assert.equal(c.ok, true, c.lineas.join('\n'));
  assert.deepEqual(caidos(c), []);
});

test('SCRUM-1357g · 🔴 un `leerPanel` que devuelve [] cuando no pudo leer (el vigía del 13-oct): el control CAE', () => {
  const c = control({ leerPanel: (o) => { const r = leerPanel(o); return r.panel ? r : { panel: [] }; } });
  assert.equal(c.ok, false, c.lineas.join('\n'));
  assert.match(c.lineas[0], /^🔴 PARADOS · CONTROL: falla en/);
  assert.deepEqual(caidos(c).map((l) => l.split(' → ')[0].trim()), ['🔴 un panel que no se puede leer']);
});

test('SCRUM-1357g · 🔴 un `medir` que con el panel ciego contesta 0: el control CAE', () => {
  const c = control({ medir: (e) => (e.panel ? medir(e) : { ...medir(e), codigo: 0 }) });
  assert.equal(c.ok, false, c.lineas.join('\n'));
  assert.deepEqual(caidos(c).map((l) => l.split(' → ')[0].trim()), ['🔴 un panel que no se puede leer']);
});

test('SCRUM-1357g · 🔴 un `medir` que no mira `needs` ni `tempo` (cree al panel): el control CAE', () => {
  const ciego = (s) => ({ ...s, needs: undefined, tempo: 'active' });
  const c = control({ medir: (e) => medir({ ...e, registro: e.registro && { ...e.registro, sesiones: e.registro.sesiones.map(ciego) } }) });
  assert.equal(c.ok, false, c.lineas.join('\n'));
  assert.deepEqual(caidos(c).map((l) => l.split(' → ')[0].trim()), ['🔴 una bloqueada que el panel da por working']);
});

test('SCRUM-1357g · 🔴 un `leerTrabajos` que se salta el state.json ilegible: el control CAE', () => {
  const c = control({ leerTrabajos: (dir) => { const t = leerTrabajos(dir); return t && { ...t, ilegibles: [] }; } });
  assert.equal(c.ok, false, c.lineas.join('\n'));
  assert.deepEqual(caidos(c).map((l) => l.split(' → ')[0].trim()), ['🔴 un state.json ilegible']);
});

test('SCRUM-1357g · 🔴 un `medir` que revienta: el control lo DICE en cada caso, no revienta él', () => {
  const c = control({ medir: () => { throw new Error('pieza rota'); } });
  assert.equal(c.ok, false);
  assert.equal(caidos(c).length, 5, c.lineas.join('\n'));
  assert.ok(caidos(c).every((l) => /reventó: pieza rota/.test(l)), c.lineas.join('\n'));
});
